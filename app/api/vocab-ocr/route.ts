import { NextRequest, NextResponse } from "next/server";
import { getGeminiClient, GEMINI_MODEL } from "@/lib/gemini";

export async function POST(req: NextRequest) {
  try {
    const { imageBase64, mimeType } = await req.json();
    if (!imageBase64 || typeof imageBase64 !== "string") {
      return NextResponse.json({ error: "imageBase64가 필요합니다." }, { status: 400 });
    }

    const ai = getGeminiClient();

    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `이 이미지는 영어 단어와 한글 뜻이 표로 정리된 단어 시험지야.

이미지 안의 표에서 영어 단어와 그에 대응하는 한글 뜻, 품사를 정확히 그대로 읽어서 추출해줘.
- 품사 표기(예: n., v., adj., adv., int.)가 괄호 안에 같이 있으면 pos에 그대로 넣고, 없으면 pos는 생략해.
- 절대 없는 단어를 지어내지 말고, 이미지에 실제로 있는 것만 옮겨 적어.
- 이미지 상단에 제목이나 시험 날짜 같은 게 있으면 title로 짧게 요약해줘. 없으면 "새 단어장"으로 해줘.

반드시 아래 JSON 형식으로만 응답해. 다른 설명이나 마크다운은 절대 포함하지 마.
{"title": "짧은 제목", "words": [{"english": "alike", "korean": "비슷한", "pos": "adj."}, ...]}`,
            },
            {
              inlineData: {
                mimeType: mimeType || "image/jpeg",
                data: imageBase64,
              },
            },
          ],
        },
      ],
      config: {
        responseMimeType: "application/json",
      },
    });

    const raw = response.text ?? "";
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json(
        { error: "단어를 인식하지 못했습니다. 더 선명한 사진으로 다시 시도해주세요.", raw },
        { status: 422 }
      );
    }

    const parsed = JSON.parse(jsonMatch[0]);
    if (!Array.isArray(parsed.words) || parsed.words.length === 0) {
      return NextResponse.json(
        { error: "단어를 찾지 못했습니다. 더 선명한 사진으로 다시 시도해주세요." },
        { status: 422 }
      );
    }

    return NextResponse.json(parsed);
  } catch (err) {
    console.error(err);
    const message = err instanceof Error ? err.message : "알 수 없는 오류";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
