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
              text: `아이가 영어 문장을 소리 내어 읽은 녹음이야. 읽으려던 원문: """${expected ?? ""}"""

실제로 들린 대로만 영어로 받아적어. 원문을 그대로 베끼지 말고, 틀리게 읽었으면 틀린 대로 적어. 아무 말도 안 들리면 빈 문자열.

JSON만 응답: {"transcript": "..."}`,
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
        thinkingConfig: {
          thinkingLevel: "minimal",
        },
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
