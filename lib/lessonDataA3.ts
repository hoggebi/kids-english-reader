// 청크북 A3 Lesson 1~8의 핵심 단어("Write the word twice" 쪽 Key Vocabulary)와 교재 단어표(Vocabulary)의 뜻.
//  - Lesson 6만 핵심 단어가 8개이고, 나머지는 10개씩이다(교재 그대로).
//  - A2(Lesson 2~8, 세트 id lesson-N)와 겹치지 않도록 세트 id는 a3-lesson-N 이다.
//  - 교재에 ①②로 나뉜 뜻은 쉼표로 이어 썼다.
// 기준 데이터: SEED1_A3_CHUNK.pdf (24쪽).

import type { VocabSet, VocabWord } from "./types";

export const A3_WORDS: Record<number, [string, string][]> = {
  1: [
    ["another", "또 하나의"],
    ["checkup", "건강 검진"],
    ["coat", "코트"],
    ["kilogram", "킬로그램"],
    ["scale", "체중계"],
    ["scarf", "목도리, 스카프"],
    ["sweater", "스웨터"],
    ["take off", "벗다"],
    ["vest", "조끼"],
    ["weigh", "몸무게가 ~이다"],
  ],
  2: [
    ["arrive", "도착하다"],
    ["bean", "콩"],
    ["brain", "뇌"],
    ["change", "바꾸다"],
    ["eat", "먹다"],
    ["meat", "고기"],
    ["muscle", "근육"],
    ["send", "보내다"],
    ["signal", "신호"],
    ["work", "작동하다"],
  ],
  3: [
    ["air", "공기"],
    ["back and forth", "이리저리"],
    ["breath", "숨"],
    ["chest", "가슴"],
    ["deep", "깊은"],
    ["point", "점수"],
    ["relax", "긴장을 풀다"],
    ["rest", "쉬다, 휴식"],
    ["score", "점수를 올리다, 득점하다"],
    ["second", "(아주) 잠깐"],
  ],
  4: [
    ["either", "~도 (역시)"],
    ["expression", "표현"],
    ["hand", "손, 도움"],
    ["head", "머리"],
    ["help", "도움, 돕다"],
    ["put", "(특정한 위치에) 놓다, 두다"],
    ["sigh", "한숨을 쉬다"],
    ["together", "함께"],
    ["touch", "(머리를) 대다"],
    ["work", "노력하다"],
  ],
  5: [
    ["bin", "쓰레기통"],
    ["line", "(글의) 행"],
    ["messy", "지저분한"],
    ["pick up", "줍다"],
    ["plan", "계획"],
    ["program", "(컴퓨터) 명령 프로그램"],
    ["robot", "로봇"],
    ["room", "방"],
    ["shelf", "선반"],
    ["tidy up", "깔끔하게 정리하다"],
  ],
  6: [
    ["better", "더 좋은"],
    ["clever", "똑똑한"],
    ["coding", "코딩 (프로그램의 코드를 작성하는 일)"],
    ["pattern", "(반복되는) 패턴"],
    ["repeat", "반복하다"],
    ["stop", "멈추다"],
    ["tidy", "깔끔한"],
    ["way", "방법"],
  ],
  7: [
    ["breakfast", "아침 식사"],
    ["busy", "바쁜"],
    ["checkered", "체크무늬의"],
    ["choose", "선택하다"],
    ["pants", "바지"],
    ["pattern", "무늬"],
    ["polka-dot", "물방울무늬"],
    ["put on", "~을 걸치다, 입다"],
    ["shirt", "셔츠"],
    ["striped", "줄무늬의"],
  ],
  8: [
    ["escape", "달아나다"],
    ["hide", "숨다"],
    ["hunt", "사냥하다"],
    ["leopard", "표범"],
    ["light", "빛"],
    ["lion", "사자"],
    ["shadow", "그림자"],
    ["spot", "반점"],
    ["stripe", "줄무늬"],
    ["zebra", "얼룩말"],
  ],
};

export const A3_NUMBERS = Object.keys(A3_WORDS)
  .map(Number)
  .sort((a, b) => a - b);

export const a3SetId = (lesson: number) => `a3-lesson-${lesson}`;
export const a3WordId = (lesson: number, english: string) => `a3l${lesson}-${english.toLowerCase().replace(/\s+/g, "-")}`;
export function a3FromSetId(setId: string): number | null {
  const m = /^a3-lesson-(\d+)$/.exec(setId);
  return m ? Number(m[1]) : null;
}
export const isA3Set = (set: Pick<VocabSet, "id">) => a3FromSetId(set.id) !== null;

// A3 세트가 없으면 만들고, 있으면 단어 구성·뜻만 맞춘다. 단어별 학습 기록(box, nextDueAt, wrongCount)은 그대로 둔다.
// 확인 절차 없이 교재의 뜻을 그대로 쓴다. 바뀐 게 없으면 changed=false.
export function ensureA3Sets(existing: VocabSet[]): { sets: VocabSet[]; changed: boolean } {
  const byId = new Map(existing.map((s) => [s.id, s]));
  const next: VocabSet[] = A3_NUMBERS.map((lesson) => {
    const id = a3SetId(lesson);
    const prev = byId.get(id);
    const prevWords = new Map((prev?.words ?? []).map((w) => [w.id, w]));
    const words: VocabWord[] = A3_WORDS[lesson].map(([english, korean]) => {
      const wid = a3WordId(lesson, english);
      const old = prevWords.get(wid);
      return { id: wid, english, korean, box: old?.box ?? 0, nextDueAt: old?.nextDueAt ?? 0, wrongCount: old?.wrongCount ?? 0 };
    });
    return { id, title: `A3 Lesson ${lesson}`, words, createdAt: prev?.createdAt ?? Date.now(), status: prev?.status ?? "active" };
  });
  const prevA3 = existing.filter(isA3Set);
  const same = prevA3.length === next.length && prevA3.every((p) => JSON.stringify(p) === JSON.stringify(next.find((n) => n.id === p.id)));
  if (same) return { sets: existing, changed: false };
  return { sets: [...existing.filter((s) => !isA3Set(s)), ...next], changed: true };
}
