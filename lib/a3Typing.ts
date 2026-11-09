// SEED1_A3 Lesson 전용 영어 타이핑 학습(문장마다 3회: 가이드 → 스스로 → 반복).
//  - 다른 교재·단어장에서는 쓰지 않는다. 진입은 ChunkLessonView의 A3 분기 한 곳뿐이다.
//  - 진행은 별도 키에 저장한다(기존 Lesson 활동·진도 데이터는 읽지도 고치지도 않는다).
//  - 입력 대상은 영문자·숫자·띄어쓰기다. 문장부호(. , ! ’ “ ” -)는 키보드에 없으므로 화면에 자동으로 채운다.

import { shuffleOrder } from "./chunkLesson.ts";

const TYPING_KEY = "chunkbook-v2-a3-typing";

export const TOTAL_ROUNDS = 3;
export const BACKSPACE = "backspace";

export type TypingCell = { ch: string; slot: number }; // slot: 입력 위치, -1이면 자동으로 채우는 문장부호
export type TypingTarget = { cells: TypingCell[]; keys: string }; // keys: 소문자로 맞춘 입력 정답

export type TypingProgress = {
  order: number[]; // 문장 순서(섞임)
  pos: number; // 현재 문장 위치
  round: number; // 현재 회차 0~2
  completed: boolean;
  rewarded: string[]; // 코인을 이미 받은 문장
};

export function buildTarget(en: string): TypingTarget {
  const cells: TypingCell[] = [];
  let keys = "";
  for (const raw of en.trim()) {
    if (/\s/.test(raw)) {
      if (keys.length === 0 || keys.endsWith(" ")) cells.push({ ch: " ", slot: -1 });
      else {
        cells.push({ ch: " ", slot: keys.length });
        keys += " ";
      }
    } else if (/[a-z0-9]/i.test(raw)) {
      cells.push({ ch: raw, slot: keys.length });
      keys += raw.toLowerCase();
    } else {
      cells.push({ ch: raw, slot: -1 });
    }
  }
  // 문장 끝 공백이 입력 대상으로 남지 않게 한다(예: "word .")
  if (keys.endsWith(" ")) {
    const last = keys.length - 1;
    keys = keys.slice(0, last);
    for (const c of cells) if (c.slot === last) c.slot = -1;
  }
  return { cells, keys };
}

// 실제 키보드 이벤트 → 앱 입력값. 한글 입력 상태에서도 물리 키 위치로 영문을 받는다.
export function keyFromEvent(e: { key: string; code?: string; ctrlKey?: boolean; metaKey?: boolean; altKey?: boolean }): string | null {
  if (e.ctrlKey || e.metaKey || e.altKey) return null;
  if (e.key === "Backspace") return BACKSPACE;
  if (e.key === " " || e.code === "Space") return " ";
  if (/^[a-z0-9]$/i.test(e.key)) return e.key.toLowerCase();
  // 영문·숫자가 아닌 ASCII(문장부호)는 무시. 한글(ㅁ)이나 Process일 때만 물리 키 위치를 쓴다.
  if (e.key.length === 1 && e.key.charCodeAt(0) < 128) return null;
  const m = /^(?:Key([A-Z])|Digit([0-9]))$/.exec(e.code ?? "");
  return m ? (m[1] ?? m[2]).toLowerCase() : null;
}

// 1회차: 맞는 글자만 진행한다. 오타는 그 자리에 머문다.
export function pressGuided(keys: string, buf: string, k: string): { buf: string; ok: boolean } {
  if (k === BACKSPACE) return { buf, ok: true };
  return k === keys[buf.length] ? { buf: buf + k, ok: true } : { buf, ok: false };
}

// 2·3회차: 틀린 글자도 입력되고 지우기로 고친다(문장 길이까지만).
export function pressFree(keys: string, buf: string, k: string): string {
  if (k === BACKSPACE) return buf.slice(0, -1);
  return buf.length >= keys.length ? buf : buf + k;
}

export const hasTypo = (keys: string, buf: string) => [...buf].some((c, i) => c !== keys[i]);

export function advanceTyping(p: TypingProgress, n: number): { next: TypingProgress; sentenceDone: boolean; lessonDone: boolean } {
  if (p.round + 1 < TOTAL_ROUNDS) return { next: { ...p, round: p.round + 1 }, sentenceDone: false, lessonDone: false };
  if (p.pos + 1 < n) return { next: { ...p, pos: p.pos + 1, round: 0 }, sentenceDone: true, lessonDone: false };
  return { next: { ...p, round: TOTAL_ROUNDS - 1, completed: true }, sentenceDone: true, lessonDone: true };
}

// 저장값이 현재 문장 수와 맞으면 이어서, 아니면(또는 이미 끝냈으면) 새로 시작한다. 받은 코인 기록은 유지한다.
export function resumeTyping(saved: TypingProgress | null, n: number): TypingProgress {
  const valid =
    !!saved &&
    !saved.completed &&
    Array.isArray(saved.order) &&
    saved.order.length === n &&
    new Set(saved.order).size === n &&
    saved.order.every((v) => Number.isInteger(v) && v >= 0 && v < n) &&
    Number.isInteger(saved.pos) &&
    saved.pos >= 0 &&
    saved.pos < n &&
    Number.isInteger(saved.round) &&
    saved.round >= 0 &&
    saved.round < TOTAL_ROUNDS;
  const rewarded = Array.isArray(saved?.rewarded) ? saved.rewarded.filter((s) => typeof s === "string") : [];
  if (valid) return { ...saved, rewarded };
  return { order: shuffleOrder(n), pos: 0, round: 0, completed: false, rewarded };
}

function readAll(): Record<string, TypingProgress> {
  if (typeof window === "undefined") return {};
  try {
    const v = JSON.parse(localStorage.getItem(TYPING_KEY) ?? "{}") as unknown;
    return v && typeof v === "object" ? (v as Record<string, TypingProgress>) : {};
  } catch {
    return {};
  }
}

export const loadTyping = (lesson: number): TypingProgress | null => readAll()[String(lesson)] ?? null;

export function saveTyping(lesson: number, p: TypingProgress) {
  if (typeof window === "undefined") return;
  localStorage.setItem(TYPING_KEY, JSON.stringify({ ...readAll(), [String(lesson)]: p }));
}
