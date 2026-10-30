"use client";
import type { VocabSet, VocabWord, VocabDailySession, VocabStudyMode } from "./types";
import { lessonFromSetId } from "./lessonData";
import { a3FromSetId } from "./lessonDataA3";
import { localDateKey } from "./lessonPlanCore";
import { loadLessonPlanRaw, recordLessonGamePlayed } from "./lessonPlan";

const VOCAB_KEY = "chunkbook-v2-vocab-sets";
const SESSION_KEY_PREFIX = "chunkbook-v2-vocab-session-";
const GAMES_PLAYED_PREFIX = "chunkbook-v2-vocab-games-";
const A3_STUDY_DONE_KEY = "chunkbook-v2-a3-study-done";
const A2_STUDY_DONE_KEY = "chunkbook-v2-a2-study-done";

// Lesson 묶음(A2: lesson-N, A3: a3-lesson-N)은 같은 학습 흐름(소개 → 철자 시연 → 글자 눌러 완성)을 쓴다.
const isLessonLikeSetId = (setId: string) => lessonFromSetId(setId) !== null || a3FromSetId(setId) !== null;

// 박스별 복습 간격(일). 3주 완주 목표에 맞춰 촘촘하게 설정.
const BOX_INTERVAL_DAYS: Record<number, number> = { 1: 1, 2: 2, 3: 3, 4: 5 };
export const DAILY_TARGET = 10;

function makeId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// 기기 현지 날짜 기준 (UTC로 자르면 한국에서는 오전 9시에 하루가 바뀐다)
function todayKey(d = new Date()) {
  return localDateKey(d);
}

function daysFromNow(days: number) {
  return Date.now() + days * 24 * 60 * 60 * 1000;
}

// ---------- 마이그레이션 (예전 데이터에 신규 필드 채워넣기) ----------
function migrateWord(w: VocabWord): VocabWord {
  return {
    ...w,
    id: w.id ?? makeId(),
    box: w.box ?? 0,
    nextDueAt: w.nextDueAt ?? 0,
    wrongCount: w.wrongCount ?? 0,
  };
}

function migrateSets(sets: VocabSet[]): VocabSet[] {
  // 이전 단어장을 끝내지 않아도 어떤 단어장이든 시작할 수 있어서, 예전의 "locked"는 "active"로 푼다.
  return sets.map((s) => {
    const words = s.words.map(migrateWord);
    const status = !s.status || s.status === "locked" ? "active" : s.status;
    return { ...s, words, status };
  });
}

// ---------- 세트 CRUD ----------
export function loadVocabSets(): VocabSet[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(VOCAB_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as VocabSet[];
    return migrateSets(parsed);
  } catch {
    return [];
  }
}

export function saveVocabSets(sets: VocabSet[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(VOCAB_KEY, JSON.stringify(sets));
}

export function addVocabSet(set: Omit<VocabSet, "status"> & { status?: VocabSet["status"] }) {
  const sets = loadVocabSets();
  const newSet: VocabSet = { ...set, status: "active" };
  const updated = [...sets, newSet];
  saveVocabSets(updated);
  return updated;
}

export function deleteVocabSet(id: string) {
  const sets = loadVocabSets().filter((s) => s.id !== id);
  saveVocabSets(sets);
  return sets;
}

export function renameVocabSet(id: string, newTitle: string) {
  const sets = loadVocabSets().map((s) =>
    s.id === id ? { ...s, title: newTitle } : s
  );
  saveVocabSets(sets);
  return sets;
}

// ---------- 진행 관리 ----------
export function getActiveSet(sets: VocabSet[]): VocabSet | null {
  return sets.find((s) => s.status === "active") ?? null;
}

// 세트의 모든 단어가 마스터(box 5)에 도달했는지 확인하고, 완료 처리 
export function checkAndAdvanceSet(setId: string) {
  const sets = loadVocabSets();
  const idx = sets.findIndex((s) => s.id === setId);
  if (idx === -1) return sets;
  const set = sets[idx];
  const allMastered = set.words.length > 0 && set.words.every((w) => w.box >= 5);
  if (!allMastered || set.status !== "active") return sets;

  sets[idx] = { ...set, status: "completed" };
  saveVocabSets(sets);
  return sets;
}

// ---------- 오늘의 10개 선정 ----------
export function selectDailyWords(set: VocabSet): VocabWord[] {
  const now = Date.now();
  const due = set.words
    .filter((w) => w.box > 0 && w.box < 5 && w.nextDueAt <= now)
    .sort((a, b) => a.nextDueAt - b.nextDueAt);

  const fresh = set.words.filter((w) => w.box === 0);

  const picked: VocabWord[] = [...due.slice(0, DAILY_TARGET)];
  if (picked.length < DAILY_TARGET) {
    picked.push(...fresh.slice(0, DAILY_TARGET - picked.length));
  }
  return picked;
}

// ---------- 오답/정답 기록 ----------
export function recordAnswer(setId: string, wordId: string, correct: boolean) {
  const sets = loadVocabSets();
  const setIdx = sets.findIndex((s) => s.id === setId);
  if (setIdx === -1) return sets;
  const words = sets[setIdx].words.map((w) => {
    if (w.id !== wordId) return w;
    if (correct) {
      const nextBox = Math.min(5, (w.box || 1) + 1) as VocabWord["box"];
      const interval = BOX_INTERVAL_DAYS[nextBox] ?? 0;
      return { ...w, box: nextBox, nextDueAt: nextBox >= 5 ? 0 : daysFromNow(interval) };
    } else {
      return {
        ...w,
        box: 1 as VocabWord["box"],
        nextDueAt: daysFromNow(BOX_INTERVAL_DAYS[1]),
        wrongCount: w.wrongCount + 1,
      };
    }
  });
  sets[setIdx] = { ...sets[setIdx], words };
  saveVocabSets(sets);
  checkAndAdvanceSet(setId);
  return sets;
}

// ---------- 오늘의 세션(카드 큐) 저장/조회 ----------
const VALID_STUDY_MODES: VocabStudyMode[] = ["expose", "meaning", "toEnglish", "spell", "teach"];

function sessionKey(setId: string) {
  return SESSION_KEY_PREFIX + setId;
}

export function loadTodaySession(setId: string): VocabDailySession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(sessionKey(setId));
    if (!raw) return null;
    const s = JSON.parse(raw) as VocabDailySession;
    // 날짜 바뀌면 무효. 단, Lesson 묶음은 학습을 다 마치지 않았으면 날짜가 바뀌어도 이어서 한다.
    const resumable = isLessonLikeSetId(setId) && s.phase === "study" && s.cursor < s.cards.length;
    if (s.dateKey !== todayKey() && !resumable) return null;
    // 예전 버전(flash/listen/game phase 등)으로 저장된 캐시면 무효 처리하고 새로 만들게 함
    const hasUnknownMode = s.cards.some((c) => !VALID_STUDY_MODES.includes(c.mode));
    // Lesson 묶음은 새 학습 흐름("teach")만 쓴다. 이전 구성(expose/문제 카드)으로 저장된 세션은 새로 만든다.
    if (isLessonLikeSetId(setId) && s.cards.some((c) => c.mode !== "teach")) return null;
    const hasUnknownPhase = s.phase !== "study" && s.phase !== "done";
    if (hasUnknownMode || hasUnknownPhase) return null;
    return s;
  } catch {
    return null;
  }
}

export function saveTodaySession(session: VocabDailySession) {
  if (typeof window === "undefined") return;
  localStorage.setItem(sessionKey(session.setId), JSON.stringify(session));
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// 단어당 항상 2개: 노출(expose) 보장 + 나머지(뜻고르기/영어고르기/스펠링) 중 랜덤 1개 테스트
// (신규/복습 상관없이 항상 "단어 알려주기 → 문제풀기" 순서를 보장)
export function buildDailySession(set: VocabSet): VocabDailySession {
  const isLesson = isLessonLikeSetId(set.id);
  // Lesson 묶음은 하루 10개 제한 없이 그 Lesson의 전체 학습 단어를 쓴다(추가 단어 포함).
  const dailyWords = isLesson ? set.words : selectDailyWords(set);
  const testModes: VocabStudyMode[] = ["meaning", "toEnglish", "spell"];
  const cards: VocabDailySession["cards"] = [];

  for (const w of dailyWords) {
    if (isLesson) {
      // Lesson 단어는 단어당 카드 하나: 소개 → 철자 시연 → 글자 눌러 완성
      cards.push({ wordId: w.id, mode: "teach" });
      continue;
    }
    const testMode = shuffle(testModes)[0];
    cards.push({ wordId: w.id, mode: "expose" });
    cards.push({ wordId: w.id, mode: testMode });
  }

  const session: VocabDailySession = {
    setId: set.id,
    dateKey: todayKey(),
    cards,
    cursor: 0,
    phase: "study",
  };
  saveTodaySession(session);
  return session;
}

// 오늘 복습 기한이 된 단어가 없더라도, 아직 세트에 안 배운/덜 외운 단어가 남아있으면 계속 이어서 학습할 수 있게 해준다.
// (라이트너 스케줄과 무관하게, 오늘 이미 다룬 단어만 제외하고 박스가 낮은 순으로 뽑아줌)
export function getMoreStudyCandidates(set: VocabSet, session: VocabDailySession): VocabWord[] {
  const alreadyIncluded = new Set(session.cards.map((c) => c.wordId));
  const due = selectDailyWords(set).filter((w) => !alreadyIncluded.has(w.id));
  if (due.length > 0) return due;

  const remaining = set.words.filter((w) => !alreadyIncluded.has(w.id));
  return [...remaining].sort((a, b) => a.box - b.box).slice(0, DAILY_TARGET);
}

// 오늘의 학습을 다 마친 뒤, 원하면 이어서 더 학습할 수 있게 세션을 확장한다.
export function extendDailySession(set: VocabSet, session: VocabDailySession): VocabDailySession {
  const moreWords = getMoreStudyCandidates(set, session);
  const testModes: VocabStudyMode[] = ["meaning", "toEnglish", "spell"];
  const newCards: VocabDailySession["cards"] = [];

  for (const w of moreWords) {
    const testMode = shuffle(testModes)[0];
    newCards.push({ wordId: w.id, mode: "expose" });
    newCards.push({ wordId: w.id, mode: testMode });
  }

  const updated: VocabDailySession = {
    ...session,
    cards: [...session.cards, ...newCards],
    cursor: session.cards.length,
    phase: newCards.length > 0 ? "study" : "done",
  };
  saveTodaySession(updated);
  return updated;
}

// ---------- 오늘 이 단어장으로 어떤 게임을 마쳤는지 기록 ----------
// 게임별 성장은 다트·두더지·몬스터 3종 사이클(lib/pet.ts recordGameCycleProgress)이 맡는다.

export const LESSON_GAME_KINDS = ["hunt", "mole", "battle"] as const;

// 이 Lesson(단어장)으로 지금 회차 동안 마친 게임 종류(hunt=다트, mole=두더지, battle=몬스터).
// 하루 단위 기록들을 모두 합친다. 게임 3종을 하루에 몰아서 하지 않고 여러 날에 나눠 해도 완료로 인정하기 위해서다
// (캐릭터 성장 진행도도 날짜와 상관없이 3종을 모으는 방식이다). 현재 회차 시작일(startedOn) 이후 기록만 센다.
export function lessonGamesPlayed(setId: string): string[] {
  if (typeof window === "undefined") return [];
  const prefix = `${GAMES_PLAYED_PREFIX}${setId}-`;
  const since = loadLessonPlanRaw()?.startedOn ?? "";
  const kinds = new Set<string>();
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k || !k.startsWith(prefix)) continue;
      const date = k.slice(prefix.length);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date < since) continue;
      const list = JSON.parse(localStorage.getItem(k) ?? "[]") as string[];
      list.forEach((x) => kinds.add(x));
    }
  } catch {
    /* ignore */
  }
  return [...kinds];
}

// A3 Lesson 게임 기록: A2와 달리 회차 시작일(진행 계획)과 상관없이 지금까지 마친 게임 종류를 모두 센다.
export function a3GamesPlayed(setId: string): string[] {
  if (typeof window === "undefined") return [];
  const prefix = `${GAMES_PLAYED_PREFIX}${setId}-`;
  const kinds = new Set<string>();
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k || !k.startsWith(prefix)) continue;
      (JSON.parse(localStorage.getItem(k) ?? "[]") as string[]).forEach((x) => kinds.add(x));
    }
  } catch {
    /* ignore */
  }
  return [...kinds];
}

// A3 Lesson의 학습(카드) 완료 기록. A3 세트가 아니면 아무 일도 안 한다.
export function a3StudyDoneLessons(): number[] {
  if (typeof window === "undefined") return [];
  try {
    const list = JSON.parse(localStorage.getItem(A3_STUDY_DONE_KEY) ?? "[]") as unknown;
    return Array.isArray(list) ? list.filter((n): n is number => typeof n === "number") : [];
  } catch {
    return [];
  }
}
export function recordA3StudyDone(setId: string) {
  const lesson = a3FromSetId(setId);
  if (lesson === null || typeof window === "undefined") return;
  const done = a3StudyDoneLessons();
  if (!done.includes(lesson)) localStorage.setItem(A3_STUDY_DONE_KEY, JSON.stringify([...done, lesson]));
}
export function a3StudyDone(setId: string): boolean {
  const lesson = a3FromSetId(setId);
  return lesson !== null && a3StudyDoneLessons().includes(lesson);
}

export function recordVocabGamePlayed(
  setId: string,
  kind: string
): { allGamesDoneToday: boolean } {
  if (typeof window === "undefined") return { allGamesDoneToday: false };
  const key = `${GAMES_PLAYED_PREFIX}${setId}-${todayKey()}`;
  let played: string[] = [];
  try {
    const raw = localStorage.getItem(key);
    played = raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    played = [];
  }
  if (!played.includes(kind)) played.push(kind);
  localStorage.setItem(key, JSON.stringify(played));
  // Lesson의 "게임 완료"는 다트·두더지·몬스터 3가지를 모두 마쳤을 때(여러 날·여러 기기에 나눠 해도) 기록한다.
  // 마친 게임 종류는 진행 계획에 저장되어 동기화된다. (단어별 기록과는 별개)
  recordLessonGamePlayed(setId, kind);
  const total = lessonGamesPlayed(setId);
  const all = LESSON_GAME_KINDS.every((k) => total.includes(k));

  return { allGamesDoneToday: all };
}

// A2 Lesson(2~8)마다의 학습(카드) 완료 기록. 진행 계획은 "오늘의 Lesson" 하나만 세므로, 칩의 완료 ✓는 Lesson별로 따로 센다.
// 이 기록이 생기기 전에 공부한 Lesson도 반영하려고, 마지막 학습 세션이 "완료"로 남아 있으면 학습 완료로 본다.
export function a2StudyDoneLessons(): number[] {
  if (typeof window === "undefined") return [];
  const done = new Set<number>();
  try {
    const list = JSON.parse(localStorage.getItem(A2_STUDY_DONE_KEY) ?? "[]") as unknown;
    if (Array.isArray(list)) list.forEach((n) => typeof n === "number" && done.add(n));
  } catch {
    /* ignore */
  }
  for (let lesson = 1; lesson <= 20; lesson++) {
    if (done.has(lesson)) continue;
    try {
      const raw = localStorage.getItem(sessionKey(`lesson-${lesson}`));
      if (raw && (JSON.parse(raw) as VocabDailySession).phase === "done") done.add(lesson);
    } catch {
      /* ignore */
    }
  }
  return [...done];
}
export function recordA2StudyDone(setId: string) {
  const lesson = lessonFromSetId(setId);
  if (lesson === null || typeof window === "undefined") return;
  const done = a2StudyDoneLessons();
  if (!done.includes(lesson)) localStorage.setItem(A2_STUDY_DONE_KEY, JSON.stringify([...done, lesson]));
}
