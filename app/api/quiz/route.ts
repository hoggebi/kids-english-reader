import { NextRequest, NextResponse } from "next/server";

const STOPWORDS = new Set([
  "a", "an", "the", "is", "are", "was", "were", "am", "be", "been", "being",
  "to", "of", "in", "on", "at", "and", "but", "or", "it", "he", "she", "they",
  "we", "you", "i", "do", "does", "did", "has", "have", "had", "for", "with",
  "that", "this", "these", "those", "as", "so", "up", "out", "not", "no",
  "into", "onto", "his", "her", "its", "their", "our", "my", "your",
]);

const DISTRACTOR_POOL = [
  "red", "blue", "yellow", "green", "big", "small", "happy", "sad", "dog",
  "cat", "ball", "house", "run", "jump", "walk", "cold", "hot", "fast", "slow",
  "old", "new", "good", "bad", "cake", "book", "tree", "water", "sun", "moon",
  "friend", "family", "school", "morning", "night", "hungry", "tired",
];

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function tokenize(sentence: string): string[] {
  return sentence.match(/[A-Za-z']+/g) ?? [];
}

function pickContentWord(sentence: string, rand: () => number): string | null {
  const words = tokenize(sentence);
  const candidates = words.filter(
    (w) => w.length >= 3 && !STOPWORDS.has(w.toLowerCase())
  );
  const pool = candidates.length > 0 ? candidates : words;
  if (pool.length === 0) return null;
  return pool[Math.floor(rand() * pool.length)];
}

function pickDistractors(exclude: string[], count: number, rand: () => number): string[] {
  const excludeLower = new Set(exclude.map((w) => w.toLowerCase()));
  const available = DISTRACTOR_POOL.filter((w) => !excludeLower.has(w.toLowerCase()));
  const shuffled = [...available].sort(() => rand() - 0.5);
  return shuffled.slice(0, count);
}

function shuffleArr<T>(arr: T[], rand: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// 간단한 시드 기반 난수 (매 요청마다 다른 문제가 나오도록 시간 기반 시드 사용)
function makeRand(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

type QuizItem = {
  kind: "fill_blank" | "find_sentence" | "order_words" | "listen_word";
  sourceSentence: string;
  prompt?: string;
  options?: string[];
  answer?: string;
  words?: string[];
};

export async function POST(req: NextRequest) {
  try {
    const { passage } = await req.json();
    if (!passage || typeof passage !== "string") {
      return NextResponse.json({ error: "passage가 필요합니다." }, { status: 400 });
    }

    const sentences = (passage.match(/[^.!?]+[.!?]+(\s|$)|[^.!?]+$/g) ?? [])
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && tokenize(s).length > 0);

    if (sentences.length === 0) {
      return NextResponse.json({ error: "지문에서 문장을 찾지 못했습니다." }, { status: 422 });
    }

    const rand = makeRand(Date.now());
    const pickSentence = () => sentences[Math.floor(rand() * sentences.length)];

    const items: QuizItem[] = [];

    function buildFillBlank(): QuizItem | null {
      const sentence = pickSentence();
      const word = pickContentWord(sentence, rand);
      if (!word) return null;
      const prompt = sentence.replace(
        new RegExp(`\\b${escapeRegExp(word)}\\b`, "i"),
        "___"
      );
      const distractors = pickDistractors([word], 2, rand);
      if (distractors.length < 2) return null;
      const options = shuffleArr([word, ...distractors], rand);
      return { kind: "fill_blank", sourceSentence: sentence, prompt, options, answer: word };
    }

    function buildFindSentence(): QuizItem | null {
      const sentence = pickSentence();
      const word = pickContentWord(sentence, rand);
      if (!word) return null;
      const [distractor] = pickDistractors([word], 1, rand);
      if (!distractor) return null;
      const wrongSentence = sentence.replace(
        new RegExp(`\\b${escapeRegExp(word)}\\b`, "i"),
        distractor
      );
      const options = shuffleArr([sentence, wrongSentence], rand);
      return { kind: "find_sentence", sourceSentence: sentence, options, answer: sentence };
    }

    function buildOrderWords(): QuizItem | null {
      const shortSentences = sentences.filter((s) => tokenize(s).length >= 3 && tokenize(s).length <= 7);
      const sentence = shortSentences.length > 0
        ? shortSentences[Math.floor(rand() * shortSentences.length)]
        : pickSentence();
      const words = sentence.trim().split(/\s+/);
      if (words.length < 2) return null;
      return {
        kind: "order_words",
        sourceSentence: sentence,
        words: shuffleArr(words, rand),
        answer: sentence,
      };
    }

    function buildListenWord(): QuizItem | null {
      const sentence = pickSentence();
      const word = pickContentWord(sentence, rand);
      if (!word) return null;
      const distractors = pickDistractors([word], 2, rand);
      if (distractors.length < 2) return null;
      const options = shuffleArr([word, ...distractors], rand);
      return { kind: "listen_word", sourceSentence: sentence, options, answer: word };
    }

    // 5문제: fill_blank 2, find_sentence 1, order_words 1, listen_word 1
    const builders = [
      buildFillBlank, buildFillBlank, buildFindSentence, buildOrderWords, buildListenWord,
    ];

    for (const build of builders) {
      const item = build();
      if (item) items.push(item);
    }

    // 혹시 일부가 만들어지지 않았으면 fill_blank로 채워서 항상 문제가 나오게 함
    while (items.length < 3) {
      const fallback = buildFillBlank() ?? buildOrderWords();
      if (!fallback) break;
      items.push(fallback);
    }

    if (items.length === 0) {
      return NextResponse.json({ error: "퀴즈를 만들 만한 문장이 부족해요." }, { status: 422 });
    }

    return NextResponse.json({ items });
  } catch (err) {
    console.error(err);
    const message = err instanceof Error ? err.message : "알 수 없는 오류";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
