import { NextRequest, NextResponse } from "next/server";
import { getGeminiClient, GEMINI_MODEL } from "@/lib/gemini";

export async function POST(req: NextRequest) {
  try {
    const { passage } = await req.json();
    if (!passage || typeof passage !== "string") {
      return NextResponse.json({ error: "passage가 필요합니다." }, { status: 400 });
    }

    const ai = getGeminiClient();

    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: `다음은 어린이 영어책에서 아이가 방금 읽은 지문이야:

"""
${passage}
"""

이 지문을 이해했는지 확인하는 객관식 퀴즈 3개를 만들어줘.
- 반드시 위 지문에 실제로 나온 내용만으로 문제와 정답을 만들 것. 지문에 없는 내용을 지어내지 말 것.
- 문제와 보기는 쉬운 영어로 작성 (어린이 수준)
- 각 문제는 보기 4개, 정답은 1개
- 각 문제마다 정답 해설을 한국어로 간단히 작성 (아이가 이해하도록)
- 반드시 아래 JSON 형식으로만 응답:
{"questions": [{"question": "...", "options": ["...", "...", "...", "..."], "correctIndex": 0, "explanation": "..."}]}`,
      config: {
        responseMimeType: "application/json",
      },
    });

    const raw = response.text ?? "";
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json(
        { error: "퀴즈를 생성하지 못했습니다.", raw },
        { status: 422 }
      );
    }

    const parsed = JSON.parse(jsonMatch[0]);
    return NextResponse.json(parsed);
  } catch (err) {
    console.error(err);
    const message = err instanceof Error ? err.message : "알 수 없는 오류";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
