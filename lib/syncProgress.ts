// 기기 간에 맞춰야 하는 Lesson 진도(쓰기 완료·읽기 횟수·단어 학습 완료·A3 타이핑).
//  - 모두 "늘어나기만 하는" 기록이라 서버 값으로 덮어쓰지 않고 합친다(어느 기기의 진도도 사라지지 않는다).
//  - 각 기록의 원래 저장 키를 그대로 읽고 쓴다(저장 형식은 바꾸지 않는다).

import type { TypingProgress } from "./a3Typing.ts";

const KEYS = {
  written: "chunk-write-done",
  a2Study: "chunkbook-v2-a2-study-done",
  a3Study: "chunkbook-v2-a3-study-done",
  activity: "chunkbook-v2-lesson-activity",
  growthDay: "chunkbook-v2-lesson-growth-day",
  a3Typing: "chunkbook-v2-a3-typing",
} as const;

export type SyncProgress = {
  written: number[];
  a2Study: number[];
  a3Study: number[];
  listens: Record<string, number>;
  growthDay: Record<string, string>; // Lesson별 마지막 성장일(YYYY-MM-DD) — 같은 날 다른 기기에서 또 자라지 않게
  a3Typing: Record<string, TypingProgress>;
};

const nums = (v: unknown): number[] => (Array.isArray(v) ? v.filter((n): n is number => typeof n === "number") : []);
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const union = (a: unknown, b: unknown) => Array.from(new Set([...nums(a), ...nums(b)]));

function isTyping(v: unknown): v is TypingProgress {
  const p = v as TypingProgress | null;
  return !!p && typeof p === "object" && Array.isArray(p.order) && typeof p.pos === "number" && typeof p.round === "number";
}
const typingRank = (p: TypingProgress) => (p.completed ? 1e6 : p.pos * 10 + p.round);

function mergeTyping(a: unknown, b: unknown): TypingProgress | null {
  if (!isTyping(a)) return isTyping(b) ? b : null;
  if (!isTyping(b)) return a;
  const best = typingRank(b) > typingRank(a) ? b : a;
  const rewarded = [...(Array.isArray(a.rewarded) ? a.rewarded : []), ...(Array.isArray(b.rewarded) ? b.rewarded : [])];
  return { ...best, rewarded: Array.from(new Set(rewarded)) }; // 코인 받은 기록은 양쪽을 합쳐 중복 지급을 막는다
}

export function mergeProgress(local: SyncProgress, server: Partial<SyncProgress>): SyncProgress {
  const listens: Record<string, number> = { ...local.listens };
  for (const [k, v] of Object.entries(obj(server.listens))) {
    if (typeof v === "number") listens[k] = Math.max(listens[k] ?? 0, v);
  }
  const growthDay: Record<string, string> = { ...local.growthDay };
  for (const [k, v] of Object.entries(obj(server.growthDay))) {
    if (typeof v === "string" && v > (growthDay[k] ?? "")) growthDay[k] = v;
  }
  const a3Typing: Record<string, TypingProgress> = { ...local.a3Typing };
  for (const [k, v] of Object.entries(obj(server.a3Typing))) {
    const m = mergeTyping(a3Typing[k], v);
    if (m) a3Typing[k] = m;
  }
  return {
    written: union(local.written, server.written),
    a2Study: union(local.a2Study, server.a2Study),
    a3Study: union(local.a3Study, server.a3Study),
    listens,
    growthDay,
    a3Typing,
  };
}

// 쓰기와 읽기를 모두 마친 Lesson(기기를 나눠서 했어도)은 완료(✓)다.
export function lessonsReadyToStamp(p: SyncProgress, done: number[]): number[] {
  return p.written.filter((l) => (p.listens[String(l)] ?? 0) > 0 && !done.includes(l));
}

function read(key: string): unknown {
  try {
    return JSON.parse(localStorage.getItem(key) ?? "null");
  } catch {
    return null;
  }
}

export function loadProgress(): SyncProgress {
  const listens: Record<string, number> = {};
  for (const [k, v] of Object.entries(obj(read(KEYS.activity)))) {
    const n = (v as { listens?: unknown } | null)?.listens;
    if (typeof n === "number" && n > 0) listens[k] = n;
  }
  const a3Typing: Record<string, TypingProgress> = {};
  for (const [k, v] of Object.entries(obj(read(KEYS.a3Typing)))) if (isTyping(v)) a3Typing[k] = v;
  return {
    written: nums(read(KEYS.written)),
    a2Study: nums(read(KEYS.a2Study)),
    a3Study: nums(read(KEYS.a3Study)),
    listens,
    growthDay: obj(read(KEYS.growthDay)) as Record<string, string>,
    a3Typing,
  };
}

export function saveProgress(p: SyncProgress) {
  localStorage.setItem(KEYS.written, JSON.stringify(p.written));
  localStorage.setItem(KEYS.a2Study, JSON.stringify(p.a2Study));
  localStorage.setItem(KEYS.a3Study, JSON.stringify(p.a3Study));
  localStorage.setItem(KEYS.growthDay, JSON.stringify(p.growthDay));
  localStorage.setItem(KEYS.a3Typing, JSON.stringify(p.a3Typing));
  // 활동 기록은 읽기 횟수만 맞춘다(쓰기 순서·위치는 기기별로 둔다).
  const activity = { ...obj(read(KEYS.activity)) } as Record<string, Record<string, unknown>>;
  for (const [k, n] of Object.entries(p.listens)) {
    activity[k] = { order: [], pos: 0, completed: false, startedAt: 0, ...activity[k], listens: n };
  }
  localStorage.setItem(KEYS.activity, JSON.stringify(activity));
}
