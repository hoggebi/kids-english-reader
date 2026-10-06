import type { VocabWord } from "./types";

export type Direction = "toEng" | "toKor";
export type Opt = { word: VocabWord; label: string };
export type Question = { target: VocabWord; dir: Direction; prompt: string; options: Opt[]; correctSlot: number };

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const labelOf = (w: VocabWord, dir: Direction) => (dir === "toEng" ? w.english : w.korean);
const norm = (s: string) => s.trim().toLowerCase();

function buildQuestion(words: VocabWord[], target: VocabWord, dir: Direction): Question | null {
  const tl = norm(labelOf(target, dir));
  if (!tl) return null;
  const seen = new Set([tl]);
  const distractors: VocabWord[] = [];
  for (const w of shuffle(words.filter((x) => x.id !== target.id))) {
    const l = norm(labelOf(w, dir));
    if (!l || seen.has(l)) continue; // 같은 라벨이 두 번 보이지 않게
    seen.add(l);
    distractors.push(w);
    if (distractors.length === 2) break;
  }
  if (distractors.length < 2) return null;
  const options = shuffle([target, ...distractors]).map((word) => ({ word, label: labelOf(word, dir) }));
  return {
    target,
    dir,
    prompt: dir === "toEng" ? target.korean : target.english,
    options,
    correctSlot: options.findIndex((o) => o.word.id === target.id),
  };
}

// 홀수 문제(1,3,..)는 한국어→영어, 짝수 문제(2,4,..)는 영어→한국어. 직전 단어는 가능한 피한다.
// 서로 다른 단어가 3개 미만이면 null (단어 부족).
export function buildAlternatingQuestions(words: VocabWord[], count: number): Question[] | null {
  const ids = new Set<string>();
  const valid = words.filter((w) => {
    if (ids.has(w.id) || !w.english?.trim() || !w.korean?.trim()) return false;
    ids.add(w.id);
    return true;
  });
  if (valid.length < 3) return null;
  const qs: Question[] = [];
  let bag: VocabWord[] = [];
  let prevId: string | null = null;
  for (let guard = 0; qs.length < count && guard < 200; guard++) {
    if (bag.length === 0) {
      bag = shuffle(valid);
      if (bag.length > 1 && bag[0].id === prevId) [bag[0], bag[bag.length - 1]] = [bag[bag.length - 1], bag[0]];
    }
    const target = bag.shift()!;
    const q = buildQuestion(valid, target, qs.length % 2 === 0 ? "toEng" : "toKor");
    if (!q) continue;
    qs.push(q);
    prevId = target.id;
  }
  return qs.length === count ? qs : null;
}
