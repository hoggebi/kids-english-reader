"use client";
import type { VocabSet, VocabWord, VocabDailySession, VocabStudyMode } from "./types";

const VOCAB_KEY = "little-reader-vocab-sets";
const SESSION_KEY_PREFIX = "little-reader-vocab-session-"; // + setId

// 박스별 복습 간격(일). 3주 완주 목표에 맞춰 촘촘하게 설정.
const BOX_INTERVAL_DAYS: Record<number, number> = { 1: 1, 2: 2, 3: 3, 4: 5 };
export const DAILY_TARGET = 10;

function makeId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function todayKey(d = new Date()) {
  return d.toISOString().slice(0, 10); // "2026-08-26"
}

function daysFromNow(days: number) {
  return Date.now() + days * 24 * 60 * 60 * 1000;
}

// ---------- 마이그레이션 ----------
// 예전 데이터(단어에 id/box 등이 없는 경우)를 자동으로 채워준다.
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

// ---------- 세트 CRUD (기존 함수 유지) ----------
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
      return { ...w, box: 1 as VocabWord["box"], nextDueAt: daysFromNow(BOX_INTERVAL_DAYS[1]), wrongCount: w.wrongCount + 1 };
    }
  });
  sets[setIdx] = { ...sets[setIdx], words };
  saveVocabSets(sets);
  checkAndAdvanceSet(setId);
  return sets;
}

// ---------- 오늘의 세션(카드 큐) 저장/조회 ----------
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

// 오늘의 10개 단어로부터 카드 큐 생성
// - 신규단어(box 0): flash 먼저 → 나머지 3개 랜덤 순서로 테스트
// - 복습단어(box>=1): 4개 중 랜덤 1개만 테스트
export function buildDailySession(set: VocabSet): VocabDailySession {
  const dailyWords = selectDailyWords(set);
  const allModes: VocabStudyMode[] = ["meaning", "listen", "spell"];
  const cards: VocabDailySession["cards"] = [];

  for (const w of dailyWords) {
    if (w.box === 0) {
      cards.push({ wordId: w.id, mode: "flash" });
      for (const m of shuffle(allModes)) {
        cards.push({ wordId: w.id, mode: m });
      }
    } else {
      const m = shuffle(["flash", ...allModes] as VocabStudyMode[])[0];
      cards.push({ wordId: w.id, mode: m });
    }
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
