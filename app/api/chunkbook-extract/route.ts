import { NextRequest, NextResponse } from "next/server";
import { getGeminiClient } from "@/lib/gemini";

// 청크북 Lesson 한 개를 두 번에 나눠 읽는다(한 번에 하면 오래 걸린다).
//  mode "body"   : 본문 페이지(들) → 인쇄된 영어 문장 + 한국어 번역
//  mode "writing": 문장쓰기 페이지 → 인쇄된 한국어 문제 + 본문 영어에서 대응 문장 고르기
// 결과는 "초안"이다. 앱에서 부모가 확인·수정해 저장한 뒤에만 학습에 쓰고, 저장 뒤에는 다시 부르지 않는다.
export const maxDuration = 60;

type Img = { data: string; mimeType?: string };
type Part = { text: string } | { inlineData: { mimeType: string; data: string } };

// 지금 쓸 수 있는 모델을 순서대로 시도한다. 과부하(503 등)는 잠깐 재시도하고,
// 모델이 없거나(404) 설정이 안 맞으면(400) 바로 다음 모델/설정으로 넘어간다.
const MODELS: { model: string; thinking?: string }[] = [
  // 글자 읽기+짧은 번역은 가벼운 모델로 충분하고 몇 초 안에 끝난다. 큰 모델은 과부하일 때 수 분이 걸리기도 해서 뒤로 둔다.
  { model: "gemini-3.1-flash-lite", thinking: "MINIMAL" },
  { model: "gemini-3.5-flash-lite", thinking: "MINIMAL" },
  { model: "gemini-3.8-flash", thinking: "LOW" },
  { model: "gemini-3-flash-preview", thinking: "MINIMAL" },
];

async function generate(parts: Part[]) {
  const ai = getGeminiClient();
  let lastErr: unknown;
  for (const { model, thinking } of MODELS) {
    for (const useThinking of thinking ? [true, false] : [false]) {
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const config: Record<string, unknown> = { responseMimeType: "application/json" };
          if (useThinking && thinking) config.thinkingConfig = { thinkingLevel: thinking };
          return await ai.models.generateContent({ model, contents: [{ role: "user", parts }], config });
        } catch (err) {
          lastErr = err;
          const msg = err instanceof Error ? err.message : String(err);
          if (/\b(429|500|503|504)\b|UNAVAILABLE|overloaded|high demand/i.test(msg)) {
            await new Promise((r) => setTimeout(r, 600));
            continue;
          }
          break; // 400/404: 다음 설정/모델로
        }
      }
    }
  }
  throw lastErr;
}

const BODY_PROMPT = `너는 초등학생용 영어 교재(청크북)의 "본문 페이지" 이미지를 읽는 도우미야.
규칙:
- 인쇄된 글자만 읽어. 손으로 쓴 글씨(연필/펜 필기)는 절대 옮기지 마.
- 이미지에 없는 내용을 지어내거나 보충하지 마. 문장이 중간에서 시작하거나 잘려 있어도 보이는 것만 옮겨.
- 영어는 인쇄된 문장을 그대로, 문장 단위로 순서대로 적어. 따옴표 안의 말은 따옴표를 포함하고 같은 줄의 말머리("he says" 등)도 같은 문장으로 둬.
- 페이지 아래쪽의 A/B 대화 연습은 section을 "dialogue", 나머지 읽기 지문은 "passage"로 표시해. 라벨/제목/주석/단어 뜻풀이는 제외해.
- 각 영어 문장마다 자연스럽고 쉬운 한국어 번역(ko)을 하나씩 써.
JSON만 출력: {"body":[{"en":"...","ko":"...","section":"passage"}]}`;

function writingPrompt(body: string[]) {
  return `너는 초등학생용 영어 교재(청크북)의 "문장쓰기 페이지" 이미지를 읽는 도우미야.
이 페이지에는 인쇄된 한국어 문장(문제)이 있고, 손글씨로 쓴 영어 답이 섞여 있을 수 있어. 손글씨는 무시해.
인쇄된 한국어 문제를 위에서 아래 순서로 읽어서, 각각에 대응하는 영어 문장을 아래 "본문 영어 목록"에서 골라 그대로 복사해 써.
목록에 대응하는 문장이 없으면 en을 빈 문자열로 둬(지어내지 마). 문항 번호는 쓰지 마.

본문 영어 목록:
${body.map((b, i) => `${i + 1}. ${b}`).join("\n")}

JSON만 출력: {"writing":[{"ko":"...","en":"..."}]}`;
}

function parseJson(raw: string) {
  const m = raw.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    return JSON.parse(m[0]) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  try {
    const input = (await req.json()) as { mode?: string; images?: Img[]; image?: Img; body?: string[] };

    if (input.mode === "writing") {
      if (!input.image?.data) return NextResponse.json({ error: "문장쓰기 페이지 이미지가 필요해요." }, { status: 400 });
      const body = (input.body ?? []).map((s) => String(s)).filter((s) => s.trim());
      const response = await generate([
        { text: writingPrompt(body) },
        { inlineData: { mimeType: input.image.mimeType || "image/jpeg", data: input.image.data } },
      ]);
      const parsed = parseJson(response.text ?? "");
      if (!parsed) return NextResponse.json({ error: "문장쓰기 페이지를 읽지 못했어요." }, { status: 422 });
      const writing = (Array.isArray(parsed.writing) ? parsed.writing : [])
        .map((w) => {
          const o = w as Record<string, unknown>;
          return { ko: String(o.ko ?? "").trim(), en: String(o.en ?? "").trim() };
        })
        .filter((w) => w.ko.length > 0);
      return NextResponse.json({ writing });
    }

    // body
    const images = input.images ?? [];
    if (images.length === 0 || images.some((i) => !i?.data)) {
      return NextResponse.json({ error: "본문 페이지 이미지가 필요해요." }, { status: 400 });
    }
    const parts: Part[] = [{ text: BODY_PROMPT }];
    images.forEach((img, i) => {
      parts.push({ text: `[본문 페이지 ${i + 1}]` });
      parts.push({ inlineData: { mimeType: img.mimeType || "image/jpeg", data: img.data } });
    });
    const response = await generate(parts);
    const parsed = parseJson(response.text ?? "");
    if (!parsed) return NextResponse.json({ error: "글자를 인식하지 못했어요. 페이지를 확인하고 다시 시도해 주세요." }, { status: 422 });
    const body = (Array.isArray(parsed.body) ? parsed.body : [])
      .map((b) => {
        const o = b as Record<string, unknown>;
        return {
          en: String(o.en ?? "").trim(),
          ko: String(o.ko ?? "").trim(),
          section: o.section === "dialogue" ? "dialogue" : "passage",
        };
      })
      .filter((b) => b.en.length > 0);
    if (body.length === 0) return NextResponse.json({ error: "본문 문장을 찾지 못했어요." }, { status: 422 });
    return NextResponse.json({ body });
  } catch (err) {
    console.error(err);
    const message = err instanceof Error ? err.message : "알 수 없는 오류";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
