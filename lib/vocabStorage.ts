"use client";
import type { VocabSet, VocabWord, VocabDailySession, VocabStudyMode } from "./types";
import { completeVocabRound } from "./pet";

const VOCAB_KEY = "little-reader-vocab-sets";
const SESSION_KEY_PREFIX = "little-reader-vocab-session-";
const GAMES_PLAYED_PREFIX = "little-reader-vocab-games-";

// 박스별 복습 간격(일). 3주 완주 목표에 맞춰 촘촘하게 설정.
const BOX_INTERVAL_DAYS: Record<number, number> = { 1: 1, 2: 2, 3: 3, 4: 5 };
export const DAILY_TARGET = 10;

function makeId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function todayKey(d = new Date()) {
  return d.toISOString().slice(0, 10);
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
  let activeAssigned = sets.some((s) => s.status === "active");
  return sets.map((s) => {
    const words = s.words.map(migrateWord);
    let status = s.status;
    if (!status) {
      status = activeAssigned ? "locked" : "active";
      if (status === "active") activeAssigned = true;
    }
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
  const hasActive = sets.some((s) => s.status === "active");
  const newSet: VocabSet = { ...set, status: hasActive ? "locked" : "active" };
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

// 세트의 모든 단어가 마스터(box 5)에 도달했는지 확인하고, 완료 처리 + 다음 세트 활성화
export function checkAndAdvanceSet(setId: string) {
  const sets = loadVocabSets();
  const idx = sets.findIndex((s) => s.id === setId);
  if (idx === -1) return sets;
  const set = sets[idx];
  const allMastered = set.words.length > 0 && set.words.every((w) => w.box >= 5);
  if (!allMastered || set.status !== "active") return sets;

  sets[idx] = { ...set, status: "completed" };
  const nextLockedIdx = sets.findIndex((s) => s.status === "locked");
  if (nextLockedIdx !== -1) {
    sets[nextLockedIdx] = { ...sets[nextLockedIdx], status: "active" };
  }
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
const VALID_STUDY_MODES: VocabStudyMode[] = ["expose", "meaning", "toEnglish", "spell"];

function sessionKey(setId: string) {
  return SESSION_KEY_PREFIX + setId;
}

export function loadTodaySession(setId: string): VocabDailySession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(sessionKey(setId));
    if (!raw) return null;
    const s = JSON.parse(raw) as VocabDailySession;
    if (s.dateKey !== todayKey()) return null; // 날짜 바뀌면 무효
    // 예전 버전(flash/listen/game phase 등)으로 저장된 캐시면 무효 처리하고 새로 만들게 함
    const hasUnknownMode = s.cards.some((c) => !VALID_STUDY_MODES.includes(c.mode));
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
  const dailyWords = selectDailyWords(set);
  const testModes: VocabStudyMode[] = ["meaning", "toEnglish", "spell"];
  const cards: VocabDailySession["cards"] = [];

  for (const w of dailyWords) {
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
// 오늘의 학습 + 게임 4종류(단어사냥/바구니담기/두더지잡기/함께달리기)를 전부 한 번씩 마치면
// 단어장 캐릭터(vocab 트랙)가 한 단계 성장한다.
const ALL_GAME_KINDS = ["hunt", "feed", "mole", "runner"];

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

  const allDone = ALL_GAME_KINDS.every((k) => played.includes(k));
  if (allDone) {
    // completeVocabRound는 같은 id로 이미 오늘 처리됐으면 아무 일도 안 하므로 중복 성장 걱정 없음
    completeVocabRound(`vocab-${setId}-${todayKey()}`);
  }
  return { allGamesDoneToday: allDone };
}
