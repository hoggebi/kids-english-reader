import { NextRequest, NextResponse } from "next/server";
import { getGeminiClient, GEMINI_MODEL } from "@/lib/gemini";

export async function POST(req: NextRequest) {
  try {
    const { audioBase64, mimeType, expected } = await req.json();
    if (!audioBase64 || typeof audioBase64 !== "string") {
      return NextResponse.json({ error: "audioBase64가 필요합니다." }, { status: 400 });
    }

    const ai = getGeminiClient();

    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `이 오디오는 어린이가 영어 문장을 소리 내어 읽은 녹음이야.

아이가 읽으려고 한 원래 문장은 다음과 같아:
"""${expected ?? ""}"""

아이가 실제로 발음한 내용을 영어로 그대로 받아적어줘.
- 실제로 들린 대로만 적어. 원래 문장과 다르게 읽었다면 다르게 읽은 그대로 적어야 해.
- 원래 문장을 그대로 베껴 쓰지 마. 아이가 단어를 빠뜨렸거나 틀리게 읽었다면 그 상태로 적어.
- 아무 말도 안 들리면 빈 문자열로 응답해.

반드시 아래 JSON 형식으로만 응답해. 다른 설명은 절대 넣지 마.
{"transcript": "실제로 들린 영어 문장"}`,
            },
            {
              inlineData: {
                mimeType: mimeType || "audio/webm",
                data: audioBase64,
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
      return NextResponse.json({ error: "목소리를 인식하지 못했습니다." }, { status: 422 });
    }

    const parsed = JSON.parse(jsonMatch[0]);
    return NextResponse.json({ transcript: parsed.transcript ?? "" });
  } catch (err) {
    console.error(err);
    const message = err instanceof Error ? err.message : "알 수 없는 오류";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
