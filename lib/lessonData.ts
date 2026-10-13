// 청크북 A2 Lesson 2~8의 "Write the word twice" 페이지(Word 열) 핵심 단어 10개씩.
//  - origin "seed": 기존 단어장 Seed 1_2610과 겹치는 단어 → 기존 한국어 뜻을 쓴다.
//  - origin "book": Seed에 없는 청크북 단어 → 교재(Word/Meaning 표)의 뜻. 저장 전 부모가 확인·수정한다.
//  - origin "seed-extra": Seed 1_2610에만 있는 단어(baseball, family tree, first, often). 하루 1개씩 Lesson에 섞는다.
// 기준 데이터: 호_청크북_A2.pdf (42쪽) + Seed 1_2610 (2026-10-13 기준).

import type { VocabSet, VocabWord } from "./types";

export type LessonWordOrigin = "seed" | "book" | "seed-extra";

export type LessonWordDef = {
  english: string;
  korean: string;
  pos?: string;
  origin: LessonWordOrigin;
  // 부모가 꼭 확인해야 하는 이유 (교재 표에서 직접 못 읽고 예문에서 가져온 뜻 등)
  note?: string;
};

const s = (english: string, korean: string, pos: string): LessonWordDef => ({ english, korean, pos, origin: "seed" });
const b = (english: string, korean: string, note?: string): LessonWordDef => ({ english, korean, origin: "book", ...(note ? { note } : {}) });
const x = (english: string, korean: string, pos: string): LessonWordDef => ({ english, korean, pos, origin: "seed-extra" });

export const FIRST_LESSON = 2;
export const LAST_LESSON = 8;

export const LESSON_DEFS: Record<number, LessonWordDef[]> = {
  2: [
    s("ask", "물어보다", "v."),
    s("call", "전화하다", "v."),
    b("class", "수업"),
    b("old", "나이가 ~인, (나이가) ~살"),
    s("person", "사람", "n."),
    b("play", "(놀이를) 하다"),
    b("same", "같은"),
    b("see", "보다"),
    s("surprise", "놀라운 일", "n."),
    b("twice", "두 배"),
    x("baseball", "야구공", "n."),
  ],
  3: [
    s("clean", "청소하다", "v."),
    s("please", "제발", "int."),
    b("point", "가리키다", "교재 단어표에서 뜻을 직접 확인하지 못했어요. 예문(points at his watch = 그의 손목시계를 가리킨다)에서 가져왔어요."),
    s("rule", "규칙", "n."),
    b("run", "뛰다"),
    b("sigh", "한숨을 쉬다"),
    b("son", "아들"),
    s("switch", "바꾸다", "v."),
    s("tired", "지친, 싫증 난", "adj."),
    b("watch", "손목시계"),
    x("family tree", "가계도", "n."),
  ],
  4: [
    s("activity", "활동", "n."),
    s("burn", "태우다", "v."),
    b("cooperation", "협동"),
    s("healthy", "건강한", "adj."),
    s("lesson", "교훈", "n."),
    b("manners", "예절"),
    s("muscle", "근육", "n."),
    b("sports", "스포츠"),
    b("teach", "가르쳐 주다"),
    b("weekend", "주말"),
    x("first", "먼저", "adv."),
  ],
  5: [
    s("angry", "화난", "adj."),
    s("feel", "기분이 들다", "v."),
    b("game", "게임"),
    b("house", "집"),
    b("keep", "~을 계속하다"),
    s("look at", "~을 보다", "v."),
    s("only", "오직", "adv."),
    b("player", "플레이어"),
    s("stand up", "일어나다", "v."),
    b("turn", "(무엇을 할) 차례"),
    x("often", "자주", "adv."),
  ],
  6: [
    s("exciting", "신나는", "adj."),
    s("excuse", "변명", "n."),
    s("feeling", "기분", "n."),
    b("forget", "잊어버리다"),
    b("forgive", "용서하다"),
    b("hang out", "같이 놀다"),
    b("hurt", "(감정을) 상하게 하다"),
    b("right", "옳은"),
    s("understand", "이해하다", "v."),
    s("yesterday", "어제", "adv./n."),
  ],
  7: [
    s("act", "행동하다", "v."),
    s("confused", "혼란스러운", "adj."),
    b("find out", "(~을) 알아내다"),
    s("look for", "찾아보다", "v."),
    b("nice", "멋진"),
    b("notice", "알아차리다"),
    b("run away", "도망가다"),
    b("strangely", "이상하게"),
    s("weird", "이상한", "adj."),
    s("whisper", "속삭이다", "v."),
  ],
  8: [
    s("care", "관심을 가지다", "v."),
    b("check", "확인하다"),
    s("get better", "나아지다", "v."),
    s("important", "중요한", "adj."),
    b("list", "목록"),
    b("listener", "말을 들어주는 사람"),
    b("nod", "고개를 끄덕이다"),
    s("practice", "연습하다", "v."),
    s("question", "질문", "n."),
    b("talk", "말하다"),
  ],
};

export const LESSON_NUMBERS = Object.keys(LESSON_DEFS)
  .map(Number)
  .sort((a, b2) => a - b2);

// 같은 단어가 여러 Lesson에 있어도 Lesson마다 별도 id를 쓴다(단어별 기록은 id 기준).
export function lessonSetId(lesson: number) {
  return `lesson-${lesson}`;
}
export function lessonWordId(lesson: number, english: string) {
  return `lesson${lesson}-${english.toLowerCase().replace(/\s+/g, "-")}`;
}
export function lessonFromSetId(setId: string): number | null {
  const m = /^lesson-(\d+)$/.exec(setId);
  return m ? Number(m[1]) : null;
}

export type MeaningDraft = Record<string, string>; // key = `${lesson}:${english}`
export const draftKey = (lesson: number, english: string) => `${lesson}:${english}`;

// 이미 만든 세트는 단어별 학습 기록(box, nextDueAt, wrongCount)을 그대로 두고 뜻만 갱신한다.
export function lessonSetsFromDefs(existing: VocabSet[], draft: MeaningDraft = {}): VocabSet[] {
  const byId = new Map(existing.map((s) => [s.id, s]));
  const out: VocabSet[] = [];
  for (const lesson of LESSON_NUMBERS) {
    const id = lessonSetId(lesson);
    const prev = byId.get(id);
    const prevWords = new Map((prev?.words ?? []).map((w) => [w.id, w]));
    const words: VocabWord[] = LESSON_DEFS[lesson].map((d) => {
      const wid = lessonWordId(lesson, d.english);
      const old = prevWords.get(wid);
      const korean = (draft[draftKey(lesson, d.english)] ?? old?.korean ?? d.korean).trim() || d.korean;
      return {
        id: wid,
        english: d.english,
        korean: d.origin === "seed" || d.origin === "seed-extra" ? d.korean : korean, // 기존 단어장 뜻은 고정
        ...(d.pos ? { pos: d.pos } : {}),
        box: old?.box ?? 0,
        nextDueAt: old?.nextDueAt ?? 0,
        wrongCount: old?.wrongCount ?? 0,
      };
    });
    out.push({
      id,
      title: `Lesson ${lesson}`,
      words,
      createdAt: prev?.createdAt ?? Date.now(),
      status: prev?.status ?? "active",
    });
  }
  return out;
}

