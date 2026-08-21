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
              text: `이 이미지는 아이를 위한 영어 동화책의 한 페이지야. 이미지 속 영어 텍스트를 정확히 그대로 읽어서 추출해줘.

장식적인 폰트나 삽화가 섞여 있어도, 실제로 인쇄된 문장을 있는 그대로 옮겨 적어야 해. 절대 비슷하게 생긴 다른 단어로 착각하거나 지어내지 마. 이미지에서 글자를 확신할 수 없으면 억지로 만들어내지 말고 최대한 정확하게만 옮겨줘.

반드시 아래 JSON 형식으로만 응답해. 다른 설명이나 마크다운은 절대 포함하지 마.
{"title": "짧은 제목(추측 가능하면)", "sentences": ["문장1", "문장2", ...]}
문장은 마침표/느낌표/물음표 기준으로 자연스럽게 나눠줘.`,
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
        { error: "글자를 인식하지 못했습니다. 더 선명한 사진으로 다시 시도해주세요.", raw },
        { status: 422 }
      );
    }

    const parsed = JSON.parse(jsonMatch[0]);
    if (!Array.isArray(parsed.sentences) || parsed.sentences.length === 0) {
      return NextResponse.json(
        { error: "문장을 찾지 못했습니다. 더 선명한 사진으로 다시 시도해주세요." },
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
