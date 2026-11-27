// 청크북 B1 Lesson 1~8의 핵심 단어("Write the word twice" 쪽 Key Vocabulary, Lesson마다 10개)와 교재 단어표의 뜻.
//  - A2(lesson-N)·A3(a3-lesson-N)와 겹치지 않도록 세트 id는 b1-lesson-N 이다.
//  - 시험 단어(seed1_B1_단어.pdf, 40개, 12월 21/22일)는 모두 이 핵심 단어 안에 있다. 겹치는 단어의 뜻은 시험 PDF에 맞췄다(A3와 같은 방식).
//    예외: exciting은 시험 PDF의 "흥미진진하다"가 형용사인데 동사처럼 적혀 있어 교재 뜻 "흥미진진한"을 쓴다.
//          hurt는 시험 PDF에서 글자가 깨져 있어 교재 뜻 "아프게 하다"를 쓴다.
//          exercise·walk는 교재 지문에선 명사(운동·산책), 시험은 동사라 두 뜻을 함께 쓴다.
//  - 교재에 ①②로 나뉜 뜻은 쉼표로 이어 썼다. bring은 교재에 "bring [brought]"로 적혀 있다(지문엔 brought).
// 기준 데이터: SEED1_B1_CHUNK.pdf (24쪽), seed1_B1_단어.pdf (1쪽).

import type { VocabSet, VocabWord } from "./types";

export const B1_WORDS: Record<number, [string, string][]> = {
  1: [
    ["cage", "(동물의) 우리"],
    ["check on", "확인하다"],
    ["empty", "비어 있는"],
    ["feed", "먹이를 주다"],
    ["find", "찾다"],
    ["own", "가지고 있다, 소유하다"],
    ["pet", "반려동물"],
    ["remember", "기억하다"],
    ["take care of", "~를 돌보다"],
    ["turn", "차례"],
  ],
  2: [
    ["behind", "뒤에"],
    ["bookshelf", "책장"],
    ["classmate", "반 친구"],
    ["help", "도와주다, 돕다"],
    ["inside", "안에"],
    ["look for", "~을 찾아보다"],
    ["noise", "소리"],
    ["peanut", "땅콩"],
    ["under", "밑에"],
    ["unusual", "이상한"],
  ],
  3: [
    ["around", "주위에"],
    ["cheerfully", "기분 좋게"],
    ["classroom", "교실"],
    ["hide", "숨기다"],
    ["hold up", "들어 올리다"],
    ["loud", "시끄러운"],
    ["secret", "비밀"],
    ["table", "탁자"],
    ["wonder", "궁금해하다"],
    ["work", "작업물"],
  ],
  4: [
    ["amazing", "놀라운"],
    ["exciting", "흥미진진한"],
    ["long ago", "먼 옛날"],
    ["old", "고대의"],
    ["place", "장소"],
    ["rainforest", "열대우림"],
    ["right", "바로"],
    ["street", "거리"],
    ["take", "데려가다"],
    ["visit", "방문하다"],
  ],
  5: [
    ["complain", "불평하다"],
    ["exercise", "운동, 운동하다"],
    ["hour", "시간"],
    ["nap", "낮잠을 자다"],
    ["puppy", "강아지"],
    ["question", "질문"],
    ["sleep", "잠, 잠을 자다"],
    ["tail", "꼬리"],
    ["wake up", "깨어나다"],
    ["walk", "산책, 산책하다"],
  ],
  6: [
    ["agree", "동의하다"],
    ["bath", "목욕"],
    ["catch", "잡다"],
    ["ready", "준비가 된"],
    ["responsibility", "책임"],
    ["smell", "냄새가 나다"],
    ["squeaky", "찍찍 소리를 내는"],
    ["terrible", "고약한"],
    ["throw", "던지다"],
    ["toy", "장난감"],
  ],
  7: [
    ["bring", "데려오다"],
    ["care", "관리"],
    ["diary", "일기"],
    ["excited", "신이 난"],
    ["explain", "설명하다"],
    ["greet", "인사하다"],
    ["other", "다른"],
    ["pet", "반려동물"],
    ["proper", "올바른"],
    ["talk", "이야기하다"],
  ],
  8: [
    ["dangerous", "위험한"],
    ["diet", "식습관"],
    ["food", "먹이"],
    ["healthy", "건강한"],
    ["hurt", "아프게 하다"],
    ["important", "중요한"],
    ["never", "절대 ~ 않은"],
    ["piece", "조각"],
    ["treat", "간식"],
    ["watch", "주의하다"],
  ],
};

// 시험 단어(seed1_B1_단어.pdf) 40개. 모두 위 핵심 단어 안에 있다(테스트로 확인).
export const B1_TEST_WORDS: readonly string[] = [
  "agree", "amazing", "around", "behind", "bookshelf", "care", "catch", "check on", "exercise", "exciting",
  "explain", "feed", "find", "greet", "healthy", "hide", "hurt", "important", "inside", "loud",
  "noise", "place", "proper", "question", "ready", "remember", "secret", "street", "talk", "terrible",
  "toy", "treat", "turn", "unusual", "visit", "wake up", "walk", "watch", "wonder", "nap",
];

export const B1_NUMBERS = Object.keys(B1_WORDS)
  .map(Number)
  .sort((a, b) => a - b);

export const b1SetId = (lesson: number) => `b1-lesson-${lesson}`;
export const b1WordId = (lesson: number, english: string) => `b1l${lesson}-${english.toLowerCase().replace(/\s+/g, "-")}`;
export function b1FromSetId(setId: string): number | null {
  const m = /^b1-lesson-(\d+)$/.exec(setId);
  return m ? Number(m[1]) : null;
}
export const isB1Set = (set: Pick<VocabSet, "id">) => b1FromSetId(set.id) !== null;

// B1 세트가 없으면 만들고, 있으면 단어 구성·뜻만 맞춘다. 단어별 학습 기록(box, nextDueAt, wrongCount)은 그대로 둔다.
// 확인 절차 없이 교재(시험) 뜻을 그대로 쓴다. 바뀐 게 없으면 changed=false.
export function ensureB1Sets(existing: VocabSet[]): { sets: VocabSet[]; changed: boolean } {
  const byId = new Map(existing.map((s) => [s.id, s]));
  const next: VocabSet[] = B1_NUMBERS.map((lesson) => {
    const id = b1SetId(lesson);
    const prev = byId.get(id);
    const prevWords = new Map((prev?.words ?? []).map((w) => [w.id, w]));
    const words: VocabWord[] = B1_WORDS[lesson].map(([english, korean]) => {
      const wid = b1WordId(lesson, english);
      const old = prevWords.get(wid);
      return { id: wid, english, korean, box: old?.box ?? 0, nextDueAt: old?.nextDueAt ?? 0, wrongCount: old?.wrongCount ?? 0 };
    });
    return { id, title: `B1 Lesson ${lesson}`, words, createdAt: prev?.createdAt ?? Date.now(), status: prev?.status ?? "active" };
  });
  const prevB1 = existing.filter(isB1Set);
  const same = prevB1.length === next.length && prevB1.every((p) => JSON.stringify(p) === JSON.stringify(next.find((n) => n.id === p.id)));
  if (same) return { sets: existing, changed: false };
  return { sets: [...existing.filter((s) => !isB1Set(s)), ...next], changed: true };
}
