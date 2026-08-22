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
      contents: `다음은 아이가 방금 읽은 영어 지문이야:

"""
${passage}
"""

이 지문에 나온 문장과 단어만 이용해서 복습 문제 8개를 만들어줘. 이 문제의 목적은 "영어 질문을 이해하고 답하기"가 아니라 "방금 읽은 문장과 단어를 다시 알아보는 복습"이야. 사용하는 아이는 아직 영어 의문문 자체를 이해하기 어려운 수준이야.

절대 규칙:
- What, Who, Where, Which, Why, How 같은 영어 의문문을 절대 만들지 마.
- 그림이나 이미지 내용을 봐야 풀 수 있는 문제는 만들지 마. 오직 위 지문의 텍스트만 사용해.
- 정답은 반드시 지문에 실제로 나온 단어/문장 그대로여야 해. 오답은 지문 내용과 다르지만 초등 저학년이 이해할 수 있는 쉬운 단어로만 만들어.

문제 유형은 아래 4가지야. 8문제 기준으로 대략 fill_blank 3~4개, find_sentence 2개, order_words 2개, listen_word 1~2개 비율로 만들어줘. 지문 문장이 부족해서 비율을 못 맞추면 fill_blank를 가장 많이 만들어.

1. fill_blank (빈칸 단어 고르기): 지문 문장에서 핵심 단어 하나를 ___ 로 비우고, 정답 1개 + 오답 2개를 options로 줘.
   예) prompt: "Tom has a ___ ball.", options: ["red","blue","yellow"], answer: "red"

2. find_sentence (책에서 읽은 문장 찾기): 지문에 실제로 있는 문장 그대로 1개(정답)와, 단어 하나만 바꿔 살짝 틀리게 만든 문장 1개를 options로 줘.
   예) options: ["Tom has a red ball.","Tom has a blue ball."], answer: "Tom has a red ball."

3. order_words (문장 순서 맞추기): 지문의 짧은 문장 하나를 단어 단위로 쪼개서 무작위 순서로 words 배열에 담고, answer에는 원래 문장을 그대로 적어.
   예) words: ["sleeping","The","is","cat"], answer: "The cat is sleeping."

4. listen_word (듣고 단어 찾기): 지문의 짧은 문장 하나를 sourceSentence로 정하고, 그 문장에 실제 포함된 핵심 단어 1개(정답)와 문장에 없는 쉬운 단어 2개(오답)를 options로 줘.
   예) sourceSentence: "The rabbit is jumping.", options: ["rabbit","monkey","apple"], answer: "rabbit"

모든 문제에 sourceSentence(정답 확인 후 다시 보여주고 읽어줄, 완전한 형태의 원본 지문 문장)를 반드시 포함해.

반드시 아래 JSON 형식으로만 응답해. 다른 설명이나 마크다운은 절대 포함하지 마:
{"items": [
  {"kind": "fill_blank", "sourceSentence": "...", "prompt": "...", "options": ["...","...","..."], "answer": "..."},
  {"kind": "find_sentence", "sourceSentence": "...", "options": ["...","..."], "answer": "..."},
  {"kind": "order_words", "sourceSentence": "...", "words": ["...","...","...","..."], "answer": "..."},
  {"kind": "listen_word", "sourceSentence": "...", "options": ["...","...","..."], "answer": "..."}
]}`,
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
    if (!Array.isArray(parsed.items) || parsed.items.length === 0) {
      return NextResponse.json({ error: "퀴즈 문항을 만들지 못했습니다." }, { status: 422 });
    }

    return NextResponse.json(parsed);
  } catch (err) {
    console.error(err);
    const message = err instanceof Error ? err.message : "알 수 없는 오류";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
