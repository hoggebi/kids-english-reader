"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from "react";
import type { VocabWord } from "@/lib/types";
import type { Question } from "@/lib/gameQuestions";
import { cancelSpeech, playSfx, speak, unlockAudio } from "@/lib/gameAudio";
import { COINS_MOLE_COMPLETE, COINS_MOLE_WORD, earnCoins } from "@/lib/pet";
import { CoinAmount } from "./Coin";
import { FeverHud, useFever } from "./FeverKit";

// ---------------------------------------------------------------------------
// 두더지 잡기 v2
//  - 한국어 뜻을 보여 주고 철자 보기 4개(정답 1 + 철자 오답 3) 중 올바른 철자의 두더지를 고른다. 총 10문제
//  - 정답: 납작 → 통통 튀기 / 오답: 두더지가 피하고 망치가 흙에 / 3콤보: 세 마리 모두 진화
//  - 두더지·라벨·터치 영역을 구멍(slot) 단위 한 묶음으로 관리한다
// ---------------------------------------------------------------------------

const M = "/assets/mole-game";

// ---------- 설정값 ----------
const FINAL_EVOLVE_AT = 8; // 기본 문제를 이만큼 완료하면 최종형으로 진화(재도전은 세지 않는다)
const T_FINAL_EVOLVE = 1300;
const COIN_COMPLETE = COINS_MOLE_COMPLETE; // 10문제 완료 보너스
const COIN_PER_FIRST_TRY = COINS_MOLE_WORD; // 첫 시도 정답마다 바로 지급
const EVOLVE_COMBO = 3;

const T_RISE_STAGGER = 120;
const T_RISE = 300;
const T_WINDUP = 120;
const T_SWING = 110;
const T_IMPACT = T_WINDUP + T_SWING;
const T_REVEAL_MIN = 1900; // 정답 연출 + 단어 확인 최소 시간
const T_WRONG_RECOVER = 650;
const T_WRONG_UNLOCK = 1000;
const T_WHIFF_LOCK = 500;
const T_EVOLVE = 1000;
const TIME_LIMIT_SEC = 18; // 몬스터 배틀과 비슷한 시간감(문제당 18초). 올라온 뒤 입력을 받는 동안만 흐른다.

// ---------- 스프라이트 아틀라스 (ASSET_MANIFEST.json 기준) ----------
type Frame = { x: number; y: number; cx: number; cy: number };
const COLX = [0, 444, 887, 1330];
const ROWY = [0, 444];
const mkFrames = (centers: [number, number][]): Frame[] =>
  centers.map(([cx, cy], i) => ({ x: COLX[i % 4], y: ROWY[Math.floor(i / 4)], cx, cy }));
const FX_SHEET = { w: 1774, h: 887, frame: 443 };
const CORRECT_FRAMES = mkFrames([[221.5, 226.5], [217.5, 219.5], [221, 223.5], [220, 221.5], [223.5, 212], [209.5, 223.5], [221, 226.5], [219, 231.5]]);
const WRONG_ALL = mkFrames([[253, 287], [228.5, 256], [220, 248.5], [232, 284.5], [255.5, 227.5], [243, 216], [229.5, 226.5], [215, 233]]);
const DUST_FRAMES = WRONG_ALL.slice(0, 4); // 위 행 = 오답 흙먼지
const WHIFF_FRAMES = WRONG_ALL.slice(4); // 아래 행 = 헛스윙(파란 효과)
const EVOLVE_FRAMES = mkFrames([[233.5, 244], [223, 242], [219, 239], [224.5, 239], [225.5, 205.5], [226, 201], [228.5, 224.5], [250.5, 223.5]]);

// moles.png 4x2: 위 행 일반(idle/squashed/bouncing/ducking), 아래 행 진화형. anchor = 발 기준점
type Pose = "idle" | "squash" | "bounce" | "duck";
const POSES: Pose[] = ["idle", "squash", "bounce", "duck"];
const MOLE_SHEET = { w: 1774, h: 887, cell: 444 };
const MOLE_ANCHOR: Record<Pose, { cx: number; fy: number }> = {
  idle: { cx: 220.5, fy: 396 },
  squash: { cx: 221, fy: 392 },
  bounce: { cx: 223.5, fy: 396 },
  duck: { cx: 223, fy: 396 },
};
const MOLE_BODY_W = 301; // idle 가로
const MOLE_BODY_H = 352; // idle 세로(머리~발)
// 라벨 중심(발 기준 위쪽 오프셋, 원본 단위)
const LABEL_UP: Record<Pose, number> = { idle: 112, squash: 48, bounce: 104, duck: 52 };

// moles_final_red.png 2x2 (1254x1254): 포즈마다 실제 그림 영역(연결 성분)의 외곽을 재서 프레임을 만들었다.
// cx = 몸 중심 x, fy = 발/바닥선 y(프레임 안), up = 배 중앙(팻말 위치)까지의 높이. 모두 원본 시트 px.
const FINAL_SHEET = { w: 1254, h: 1254 };
const FINAL_FRAMES: Record<Pose, { x: number; y: number; w: number; h: number; cx: number; fy: number; up: number }> = {
  idle: { x: 72, y: 30, w: 508, h: 574, cx: 254, fy: 568, up: 150 },
  squash: { x: 646, y: 204, w: 580, h: 382, cx: 290, fy: 376, up: 80 },
  bounce: { x: 44, y: 612, w: 586, h: 570, cx: 293, fy: 564, up: 235 },
  duck: { x: 694, y: 704, w: 540, h: 484, cx: 270, fy: 478, up: 100 },
};
const FINAL_SCALE = (MOLE_BODY_H / 562) * 1.12; // 기존 두더지보다 작아 보이지 않게 약간 크게

// holes.png 2x2: 기본 / 정답 강조 / 오답 먼지 / 진화. (ax, ay) = 구멍 입구 중심
const HOLE_SHEET = { w: 1536, h: 1024, cw: 768, ch: 512, ring: 636 };
const HOLE_CELLS = [
  { x: 0, y: 0, ax: 401, ay: 265 },
  { x: 768, y: 0, ax: 370, ay: 277 },
  { x: 0, y: 512, ax: 402, ay: 260 },
  { x: 768, y: 512, ax: 375, ay: 260 },
] as const;
type HoleState = "base" | "correct" | "wrong";
const HOLE_IDX = (s: HoleState, evolved: boolean) => (s === "correct" ? 1 : s === "wrong" ? 2 : evolved ? 3 : 0);

// hammers.png 2x2: 기본 대기 / 기본 타격 / 강화 대기 / 강화 타격. pivot = 손잡이 끝, L = 피벗~머리 중심
const HAM_SHEET = { w: 1536, h: 1024, cw: 768, ch: 512 };
const HAM = {
  idle: { px: 215, py: 440, L: 364, heading: -43.3 },
  strike: { px: 60, py: 295, L: 470, heading: 0 },
};

const IMAGES = ["background", "moles", "moles_final_red", "holes", "hammers", "correct_fx", "wrong_fx", "evolution_fx"].map((n) => `${M}/${n}.png`);

// ---------- 레이아웃 ----------
type Layout = {
  w: number; h: number; qTop: number; qH: number; sh: number; sm: number; ringW: number; moleH: number;
  slots: { x: number; y: number }[]; // 구멍 입구 중심(화면 좌표)
  revealY: number; portrait: boolean;
};
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

// ---------- 철자 문제: 단어의 마지막 두 글자를 두더지 4마리 중에서 골라 채운다 ----------
// 일반 3문제 다음에 철자 1문제(4번째, 8번째…). 문제 수는 그대로이고, 적합한 단어가 없으면 일반 문제로 둔다.
type MoleQuestion = Question & { spell?: { word: string }; retry?: boolean };
const shuffleList = <T,>(arr: T[]): T[] => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};
function validWords(words: VocabWord[]): VocabWord[] {
  const ids = new Set<string>();
  return words.filter((w) => {
    if (ids.has(w.id) || !w.english?.trim() || !w.korean?.trim()) return false;
    ids.add(w.id);
    return true;
  });
}

// ---------- 철자 보기: 정답 1개 + 그럴듯한 철자 오답 3개 ----------
// 철자 문제로 쓸 수 있는 단어: 알파벳이 3글자 이상이고 숫자가 없는 것
const spellable = (w: VocabWord) => /^[^0-9]*$/.test(w.english) && (w.english.match(/[A-Za-z]/g)?.length ?? 0) >= 3;
// 같은 단어의 다른 허용 철자(영/미식). 오답 보기로 나오면 안 된다.
const VARIANT_GROUPS = [["color", "colour"], ["favorite", "favourite"], ["gray", "grey"], ["center", "centre"], ["theater", "theatre"], ["neighbor", "neighbour"], ["program", "programme"], ["donut", "doughnut"], ["cozy", "cosy"], ["pajamas", "pyjamas"], ["traveling", "travelling"], ["mom", "mum"], ["tire", "tyre"], ["jewelry", "jewellery"], ["check", "cheque"], ["flavor", "flavour"], ["honor", "honour"], ["humor", "humour"], ["realize", "realise"], ["organize", "organise"]];
const VARIANTS = new Map<string, string[]>();
for (const g of VARIANT_GROUPS) for (const w of g) VARIANTS.set(w, g.filter((x) => x !== w));
// 검수된 오답 목록(있으면 우선 사용). 키 = 소문자 정답
const CURATED_MISSPELLINGS: Record<string, string[]> = {};
const VOWELS = "aeiou";
const VOWEL_SWAP: Record<string, string> = { a: "o", e: "i", i: "e", o: "a", u: "o" };
const VOWEL_SWAP2: Record<string, string> = { a: "e", e: "a", i: "y", o: "u", u: "a" };
function misspellCandidates(word: string): string[][] {
  const swap: string[] = [];
  const vowel: string[] = [];
  const omit: string[] = [];
  const dup: string[] = [];
  const isL = (c: string) => /[a-z]/.test(c);
  for (let i = 0; i < word.length - 1; i++) {
    if (isL(word[i]) && isL(word[i + 1]) && word[i] !== word[i + 1]) swap.push(word.slice(0, i) + word[i + 1] + word[i] + word.slice(i + 2)); // 인접 글자 교환
  }
  for (let i = 0; i < word.length; i++) {
    const c = word[i];
    if (VOWELS.includes(c)) {
      vowel.push(word.slice(0, i) + VOWEL_SWAP[c] + word.slice(i + 1)); // 모음 혼동
      vowel.push(word.slice(0, i) + VOWEL_SWAP2[c] + word.slice(i + 1));
    }
    if (isL(c) && i > 0 && i < word.length) omit.push(word.slice(0, i) + word.slice(i + 1)); // 글자 누락(첫 글자는 유지)
    if (isL(c)) dup.push(word.slice(0, i + 1) + c + word.slice(i + 1)); // 글자 중복
    if (isL(c) && i + 1 < word.length && word[i + 1] === c) dup.push(word.slice(0, i) + word.slice(i + 1)); // 겹글자 줄이기
  }
  return [swap, vowel, omit, dup];
}
function applyCase(src: string, out: string): string {
  if (src === src.toUpperCase() && src !== src.toLowerCase()) return out.toUpperCase();
  if (src[0] && src[0] === src[0].toUpperCase() && src[0] !== src[0].toLowerCase()) return out[0].toUpperCase() + out.slice(1);
  return out;
}
// 정답과 같거나, 허용되는 다른 철자이거나, 이 레슨의 다른 단어와 같은 보기는 제외한다.
export function buildMisspellings(english: string, pool: VocabWord[], count = 3): string[] {
  const src = english.trim();
  const base = src.toLowerCase();
  const banned = new Set<string>([base, ...(VARIANTS.get(base) ?? [])]);
  for (const w of pool) banned.add(w.english.trim().toLowerCase());
  const out: string[] = [];
  const add = (c: string) => {
    const k = c.trim().toLowerCase();
    if (!k || banned.has(k) || out.some((o) => o.toLowerCase() === k)) return false;
    out.push(applyCase(src, k));
    return true;
  };
  for (const c of CURATED_MISSPELLINGS[base] ?? []) {
    if (out.length >= count) break;
    add(c);
  }
  // 종류별로 하나씩 돌아가며 뽑아 한 가지 유형만 몰리지 않게 한다.
  const groups = misspellCandidates(base).map((g) => shuffleList(g));
  for (let round = 0; out.length < count && round < 40; round++) {
    let progressed = false;
    for (const g of groups) {
      while (g.length && out.length < count) {
        if (add(g.shift()!)) {
          progressed = true;
          break;
        }
      }
    }
    if (!progressed) break;
  }
  return out;
}
// 한국어 뜻을 보여 주고 영어 철자 4개 중 정답을 고르는 문제. 보기 위치는 문제를 만들 때 한 번만 섞는다.
function buildSpellingQuestion(target: VocabWord, pool: VocabWord[]): MoleQuestion | null {
  const correct = target.english.trim();
  const wrong = buildMisspellings(correct, pool);
  if (wrong.length < 3) return null;
  const options = shuffleList([{ word: target, label: correct, ok: true }, ...wrong.map((label) => ({ word: target, label, ok: false }))]);
  return { target, dir: "toEng", prompt: target.korean.trim(), options: options.map(({ word, label }) => ({ word, label })), correctSlot: options.findIndex((o) => o.ok) };
}
// 레슨 단어를 한 번씩, 섞은 순서로 문제로 만든다. 철자 보기를 만들 수 없는 단어는 건너뛴다.
function buildBaseQuestions(words: VocabWord[]): MoleQuestion[] | null {
  const valid = validWords(words);
  const qs = shuffleList(valid.filter(spellable))
    .map((w) => buildSpellingQuestion(w, valid))
    .filter((q): q is MoleQuestion => !!q);
  return qs.length >= 3 ? qs : null;
}
const slotIdx = (n: number) => Array.from({ length: n }, (_, i) => i);

function computeLayout(w: number, h: number, n = 3): Layout {
  const portrait = h > w * 1.1;
  const qTop = 52;
  const qH = clamp(h * 0.09, 52, 72);
  const regionTop = qTop + qH + 10;
  const regionBottom = h - 64;
  const regionH = Math.max(160, regionBottom - regionTop);
  let sh: number;
  let slots: { x: number; y: number }[];
  if (!portrait && n === 4) {
    // 철자 문제: 한 줄에 4마리
    sh = Math.min((w * 0.215) / HOLE_SHEET.ring, regionH / 480);
    const y = regionTop + regionH * 0.82;
    const gap = Math.min(w * 0.235, sh * HOLE_SHEET.ring * 1.06);
    slots = [0, 1, 2, 3].map((i) => ({ x: w / 2 + (i - 1.5) * gap, y }));
  } else if (!portrait) {
    sh = Math.min((w * 0.29) / HOLE_SHEET.ring, regionH / 480);
    const y = regionTop + regionH * 0.78;
    slots = [0, 1, 2].map((i) => ({ x: w / 2 + (i - 1) * Math.min(w * 0.31, sh * HOLE_SHEET.ring * 1.07), y }));
  } else if (n === 4) {
    sh = Math.min((w * 0.4) / HOLE_SHEET.ring, regionH / 2 / 500);
    const rowH = regionH / 2;
    slots = [0, 1, 2, 3].map((i) => ({ x: w * (i % 2 === 0 ? 0.3 : 0.7), y: regionTop + rowH * (Math.floor(i / 2) + 0.82) }));
  } else {
    sh = Math.min((w * 0.44) / HOLE_SHEET.ring, regionH / 3 / 500);
    const rowH = regionH / 3;
    const xs = [0.3, 0.7, 0.3];
    slots = xs.map((fx, i) => ({ x: w * fx, y: regionTop + rowH * (i + 0.82) }));
  }
  const sm = sh * 1.02;
  return { w, h, qTop, qH, sh, sm, ringW: HOLE_SHEET.ring * sh, moleH: MOLE_BODY_H * sm, slots, revealY: h - 34, portrait };
}

type Banner = { text: string; tone: "good" | "try" | "combo"; key: number };
type FxItem = { id: number; sheet: "correct" | "wrong" | "evolution"; frames: Frame[]; x: number; y: number; size: number; duration: number };
type Stats = { firstTry: number; bestCombo: number; retries: number; whiffs: number; evolved: boolean; level: number; baseCount: number; retryCount: number; coins: number };

function SpriteFx({ item, onEnd }: { item: FxItem; onEnd: (id: number) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const endRef = useRef(onEnd);
  useEffect(() => {
    endRef.current = onEnd;
  });
  const { frames, x, y, size, duration, id, sheet } = item;
  const s = size / FX_SHEET.frame;
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const t0 = performance.now();
    let raf = 0;
    let last = -1;
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / duration);
      const i = Math.min(frames.length - 1, Math.floor(p * frames.length));
      if (i !== last) {
        last = i;
        const f = frames[i];
        el.style.backgroundPosition = `${-f.x * s}px ${-f.y * s}px`;
        el.style.left = `${x - f.cx * s}px`;
        el.style.top = `${y - f.cy * s}px`;
        el.style.visibility = "visible";
      }
      if (p < 1) raf = requestAnimationFrame(tick);
      else endRef.current(id);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [frames, x, y, s, duration, id]);
  return (
    <div
      ref={ref}
      aria-hidden
      style={{
        position: "absolute",
        visibility: "hidden",
        pointerEvents: "none",
        width: FX_SHEET.frame * s,
        height: FX_SHEET.frame * s,
        backgroundImage: `url(${M}/${sheet === "correct" ? "correct_fx" : sheet === "wrong" ? "wrong_fx" : "evolution_fx"}.png)`,
        backgroundRepeat: "no-repeat",
        backgroundSize: `${FX_SHEET.w * s}px ${FX_SHEET.h * s}px`,
      }}
    />
  );
}

function MoleStyles() {
  return (
    <style>{`
      @keyframes mgBreathe { 0%, 100% { transform: scale(1, 1); } 50% { transform: scale(1.015, 1.035); } }
      @keyframes mgPop { 0% { transform: scale(0.6); opacity: 0; } 60% { transform: scale(1.12); opacity: 1; } 100% { transform: scale(1); opacity: 1; } }
      @keyframes mgCoin { 0% { transform: translate(-50%, 0); opacity: 0; } 20% { opacity: 1; } 100% { transform: translate(-50%, -70px); opacity: 0; } }
      @keyframes mgHint { 0%, 100% { box-shadow: 0 0 0 3px rgba(255,216,74,0.35); } 50% { box-shadow: 0 0 0 6px rgba(255,216,74,0.95), 0 0 14px #ffd84a; } }
      .mg-breathe { animation: mgBreathe 2.4s ease-in-out infinite; transform-origin: 0 0; }
      .mg-pop { animation: mgPop 0.35s ease-out both; }
      .mg-coin { animation: mgCoin 0.9s ease-out forwards; }
      .mg-hint { animation: mgHint 1s ease-in-out infinite; }
      @keyframes mgGold { 0% { opacity: 0; } 35% { opacity: 1; } 100% { opacity: 0; } }
      .mg-gold { animation: mgGold 1.2s ease-out forwards; }
      .mg-stage:focus-visible { outline: 4px solid #ffd84a; outline-offset: -4px; }
      .mg-btn:focus-visible { outline: 4px solid #ffd84a; outline-offset: 2px; border-radius: 24px; }
      @media (prefers-reduced-motion: reduce) {
        .mg-breathe, .mg-pop, .mg-coin, .mg-hint, .mg-gold { animation: none; }
      }
    `}</style>
  );
}

export default function MoleGame({
  words,
  onDone,
  onRetry,
  onExit,
  onComplete,
}: {
  words: VocabWord[];
  onDone: () => void;
  onRetry: () => void;
  onExit?: () => void;
  onComplete?: () => void; // 10문제를 끝내 결과 화면이 뜰 때 한 번 호출(자동 성장 기록)
}) {
  const [questions] = useState<MoleQuestion[] | null>(() => buildBaseQuestions(words));
  // 진행 큐: 기본 문제 + (틀린 단어의) 재도전. 재도전은 진행 중에 한 번만 끼워 넣는다.
  const queueRef = useRef<MoleQuestion[]>(questions ? [...questions] : []);
  const retryRegistered = useRef(new Set<string>());
  const wordPool = useMemo(() => validWords(words), [words]);
  const [prog, setProg] = useState({ base: 0, total: questions?.length ?? 0, retryLeft: 0 });
  const leave = onExit ?? onDone;
  const fever = useFever();

  const stageRef = useRef<HTMLDivElement>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 1024, h: 768 });
  const [slotCount, setSlotCount] = useState(3); // 일반 문제 3마리, 철자 문제 4마리
  const layout = useMemo(() => computeLayout(size.w, size.h, slotCount), [size, slotCount]);
  const layoutRef = useRef(layout);

  const [loaded, setLoaded] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [stage, setStage] = useState<"intro" | "play" | "result">("intro");
  const [q, setQ] = useState<Question | null>(null);
  const [qIndex, setQIndex] = useState(0);

  type Phase = "idle" | "rising" | "ready" | "busy" | "evolving";
  const phaseRef = useRef<Phase>("idle");
  const [phaseUi, setPhaseUi] = useState<Phase>("idle"); // 타이머 제어용 화면 상태(입력 판단은 phaseRef)
  const [timeLeftMs, setTimeLeftMs] = useState(TIME_LIMIT_SEC * 1000);
  const remainingRef = useRef(TIME_LIMIT_SEC * 1000);

  const [poses, setPoses] = useState<Pose[]>(["idle", "idle", "idle", "idle"]);
  const [holes, setHoles] = useState<HoleState[]>(["base", "base", "base", "base"]);
  // 철자 문제 화면 상태: cur = 지금 채울 빈칸(0/1, 2면 완성), filled = 채운 글자, used = 쓴 두더지, bad = 틀려서 비활성화된 두더지
  const [spellUi, setSpellUi] = useState<{ cur: number; filled: (string | null)[]; used: number[]; bad: number[]; glow: boolean } | null>(null);
  const [level, setLevel] = useState<0 | 1 | 2>(0); // 0 기본형 / 1 중간형(보라 뿔) / 2 최종형(레드)
  const levelRef = useRef<0 | 1 | 2>(0);
  const evolved = level >= 1;
  const [goldKey, setGoldKey] = useState(0); // 최종 진화 때 은은한 금색 빛
  const [, setHint] = useState(false); // 정답 위치를 알려 주지 않으므로 화면에는 쓰지 않는다
  const [combo, setCombo] = useState(0);
  const [banner, setBanner] = useState<Banner | null>(null);
  const [reveal, setReveal] = useState<{ english: string; korean: string } | null>(null);
  const [coinPop, setCoinPop] = useState<{ x: number; y: number; key: number; strong?: boolean; amount?: number } | null>(null);
  const [fxList, setFxList] = useState<FxItem[]>([]);
  const [muted, setMuted] = useState(false);
  const mutedRef = useRef(false);
  
  const reducedRef = useRef(false);
  const [finalStats, setFinalStats] = useState<Stats | null>(null);
  const [handsOn, setHandsOn] = useState(true); // 첫 안내용

  const game = useRef({
    q: null as Question | null,
    wrong: 0,
    answered: false,
    combo: 0,
    bestCombo: 0,
    firstTry: 0,
    retries: 0,
    whiffs: 0,
    evolveReached: false,
    evolvePlayed: false,
    finalPlayed: false,
    baseDone: 0,
    retryDone: 0,
    serial: 0,
    spell: null as null | { cur: number; used: number[]; bad: number[]; done: boolean },
    coins: 0, // 이번 판에 받은 코인(정답마다 쌓임)
    hint: false,
    finished: false,
    timeouts: 0,
    qTimeouts: 0,
  });
  const token = useRef(0);
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>());
  const keySeq = useRef(0);
  const nextKey = () => ++keySeq.current;

  const moveEls = useRef<(HTMLDivElement | null)[]>([null, null, null, null]);
  const labelEls = useRef<(HTMLDivElement | null)[]>([null, null, null, null]);
  const spriteEls = useRef<(HTMLDivElement | null)[]>([null, null, null, null]);
  const anims = useRef<Map<HTMLElement, Animation>>(new Map());
  const hamRef = useRef<HTMLDivElement>(null);
  const hamIdleRef = useRef<HTMLDivElement>(null);
  const hamStrikeRef = useRef<HTMLDivElement>(null);
  const hamAnim = useRef<Animation | null>(null);

  const downPointers = useRef(new Set<number>());
  const pending = useRef<{ kind: "mole" | "bg"; slot: number; id: number; x: number; y: number } | null>(null);

  useLayoutEffect(() => {
    layoutRef.current = layout;
  }, [layout]);

  // ---------- 초기 설정 ----------
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => {
      reducedRef.current = mq.matches;
    };
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    let cancelled = false;
    let left = IMAGES.length;
    let failed = false;
    const finish = () => {
      if (cancelled) return;
      if (failed) setLoadFailed(true);
      else setLoaded(true);
    };
    const fallback = setTimeout(finish, 10000);
    IMAGES.forEach((src) => {
      const img = new Image();
      img.onload = () => {
        if (--left === 0) finish();
      };
      img.onerror = () => {
        failed = true;
        if (--left === 0) finish();
      };
      img.src = src;
    });
    return () => {
      cancelled = true;
      clearTimeout(fallback);
    };
  }, []);

  useLayoutEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) setSize({ w: r.width, h: r.height });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const cancelPointer = () => {
      pending.current = null;
    };
    document.addEventListener("visibilitychange", cancelPointer);
    window.addEventListener("blur", cancelPointer);
    const timerSet = timers.current;
    const animMap = anims.current;
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("visibilitychange", cancelPointer);
      window.removeEventListener("blur", cancelPointer);
      token.current += 1;
      timerSet.forEach(clearTimeout);
      timerSet.clear();
      animMap.forEach((a) => a.cancel());
      animMap.clear();
      hamAnim.current?.cancel();
      cancelSpeech();
    };
  }, []);

  // ---------- 타이머 (문제가 바뀌면 이전 콜백은 무시) ----------
  function later(ms: number, fn: () => void) {
    const tk = token.current;
    const id = setTimeout(() => {
      timers.current.delete(id);
      if (token.current === tk) fn();
    }, ms);
    timers.current.add(id);
  }
  const setPhase = (p: Phase) => {
    phaseRef.current = p;
    setPhaseUi(p);
  };

  // ---------- 애니메이션 도우미 ----------
  // 같은 요소의 새 애니메이션은 이전 것을 대체한다(마지막 상태 유지: fill forwards).
  function play(el: HTMLElement | null, keyframes: Keyframe[], opts: KeyframeAnimationOptions) {
    if (!el || typeof el.animate !== "function") return null;
    const kf = reducedRef.current ? [keyframes[keyframes.length - 1]] : keyframes;
    const a = el.animate(kf, { fill: "forwards", ...opts, duration: reducedRef.current ? 1 : opts.duration });
    const prev = anims.current.get(el);
    anims.current.set(el, a);
    prev?.cancel();
    return a;
  }
  // 두더지와 라벨이 같은 움직임을 쓰도록 한 묶음으로 재생
  function playBoth(slot: number, keyframes: Keyframe[], opts: KeyframeAnimationOptions) {
    play(moveEls.current[slot], keyframes, opts);
    play(labelEls.current[slot], keyframes, opts);
  }
  const hiddenY = () => layoutRef.current.moleH * 1.25;
  const ty = (px: number) => ({ transform: `translateY(${px}px)` });

  function riseSlot(slot: number) {
    const L = layoutRef.current;
    playBoth(slot, [ty(hiddenY()), { ...ty(-L.moleH * 0.06), offset: 0.7 }, ty(0)], { duration: T_RISE, easing: "ease-out" });
  }
  function sinkSlot(slot: number, ms = 220) {
    playBoth(slot, [ty(0), ty(hiddenY())], { duration: ms, easing: "ease-in" });
  }
  function shakeBoard() {
    if (reducedRef.current) return;
    play(boardRef.current, [{ transform: "translate(0,0)" }, { transform: "translate(-4px,2px)" }, { transform: "translate(4px,-2px)" }, { transform: "translate(0,0)" }], { duration: 220, fill: "none" });
  }

  function setPoseAt(slot: number, p: Pose) {
    setPoses((prev) => prev.map((x, i) => (i === slot ? p : x)));
  }
  function setHoleAt(slot: number, s: HoleState) {
    setHoles((prev) => prev.map((x, i) => (i === slot ? s : x)));
  }
  function addFx(item: Omit<FxItem, "id">) {
    setFxList((prev) => [...prev, { ...item, id: nextKey() }]);
  }
  const removeFx = (id: number) => setFxList((prev) => prev.filter((f) => f.id !== id));

  // ---------- 망치: 손잡이 끝을 축으로 회전 → 타격 ----------
  function hammerScale() {
    return layoutRef.current.sm * 0.52;
  }
  function swing(T: { x: number; y: number }, onImpact: () => void) {
    const ham = hamRef.current;
    const idleEl = hamIdleRef.current;
    const strikeEl = hamStrikeRef.current;
    playSfx("swing", mutedRef.current);
    if (!ham || !idleEl || !strikeEl) {
      later(T_IMPACT, onImpact);
      return;
    }
    const s = hammerScale();
    // 타격 자세(머리가 아래)에서 머리 중심이 T에 오도록 피벗 위치를 정한다.
    ham.style.left = `${T.x}px`;
    ham.style.top = `${T.y - HAM.strike.L * s}px`;
    ham.style.display = "block";
    ham.style.opacity = "1";
    idleEl.style.display = "block";
    strikeEl.style.display = "none";
    hamAnim.current?.cancel();
    const rWind = -62;
    const rStrikeStart = -105;
    if (reducedRef.current) {
      idleEl.style.display = "none";
      strikeEl.style.display = "block";
      ham.style.transform = "rotate(90deg)";
      later(T_IMPACT, onImpact);
      return;
    }
    // 1) 대기 그림이 뒤로 젖혀짐
    hamAnim.current = ham.animate(
      [{ transform: "rotate(-25deg)", opacity: 0 }, { transform: `rotate(${rWind}deg)`, opacity: 1 }],
      { duration: T_WINDUP, easing: "ease-out", fill: "forwards" },
    );
    // 2) 타격 그림으로 바꿔 빠르게 내려침
    later(T_WINDUP, () => {
      idleEl.style.display = "none";
      strikeEl.style.display = "block";
      hamAnim.current?.cancel();
      hamAnim.current = ham.animate(
        [{ transform: `rotate(${rStrikeStart}deg)` }, { transform: "rotate(90deg)" }],
        { duration: T_SWING, easing: "cubic-bezier(.5,0,1,.7)", fill: "forwards" },
      );
    });
    later(T_IMPACT, onImpact);
  }
  function retractHammer() {
    const ham = hamRef.current;
    if (!ham) return;
    if (reducedRef.current || typeof ham.animate !== "function") {
      ham.style.display = "none";
      return;
    }
    hamAnim.current?.cancel();
    hamAnim.current = ham.animate(
      [{ transform: "rotate(90deg)", opacity: 1 }, { transform: "rotate(40deg)", opacity: 0 }],
      { duration: 180, easing: "ease-in", fill: "forwards" },
    );
    hamAnim.current.onfinish = () => {
      ham.style.display = "none";
    };
  }

  // 진행 표시: 기본 n/전체 · 재도전 m개 남음
  function updateProg(i: number) {
    const g = game.current;
    const cur = queueRef.current[i];
    const retryLeft = queueRef.current.slice(i).filter((x) => x.retry).length;
    setProg({ base: Math.min(g.baseDone + (cur && !cur.retry ? 1 : 0), questions?.length ?? 0), total: questions?.length ?? 0, retryLeft });
  }

  // 문제 하나가 끝났을 때(정답/시간 초과 종료) 한 번만: 기본 문제 완료 수 증가, 문제가 있었던 단어는 재도전 1개 등록.
  // 반환값: 이 뒤에 문제가 더 있는지.
  function settleQuestion(cq: MoleQuestion, problem: boolean): boolean {
    const g = game.current;
    if (!cq.retry) {
      g.baseDone += 1;
      if (problem && !retryRegistered.current.has(cq.target.id)) {
        retryRegistered.current.add(cq.target.id);
        const rb = buildSpellingQuestion(cq.target, wordPool);
        if (rb) {
          const rq: MoleQuestion = { ...rb, retry: true };
          const at = Math.min(qIndex + 3, queueRef.current.length); // 다른 문제 2개를 끝낸 뒤. 남은 문제가 부족하면 맨 뒤
          queueRef.current.splice(at, 0, rq);
        }
      }
    } else {
      g.retryDone += 1;
    }
    return qIndex + 1 < queueRef.current.length;
  }

  // ---------- 문제 시작 ----------
  function startQuestion(i: number) {
    const nq = queueRef.current[i];
    if (!nq) return;
    token.current += 1;
    timers.current.forEach(clearTimeout);
    timers.current.clear();
    const g = game.current;
    g.serial += 1; // 문제마다 고유 번호(같은 단어의 기본/재도전이 FEVER에서 같은 문제로 취급되지 않게)
    g.q = nq;
    g.wrong = 0;
    g.answered = false;
    g.hint = false;
    g.qTimeouts = 0;
    remainingRef.current = TIME_LIMIT_SEC * 1000;
    setTimeLeftMs(TIME_LIMIT_SEC * 1000);
    setQ(nq);
    setQIndex(i);
    updateProg(i);
    setPoses(["idle", "idle", "idle", "idle"]);
    setHoles(["base", "base", "base", "base"]);
    setHint(false);
    setBanner(null);
    setReveal(null);
    setFxList([]);
    const n = nq.options.length;
    setSlotCount(n);
    g.spell = nq.spell ? { cur: 0, used: [], bad: [], done: false } : null;
    setSpellUi(nq.spell ? { cur: 0, filled: [null, null], used: [], bad: [], glow: false } : null);
    setPhase("rising");
    // 구멍에서 0.12초 간격으로 통통 올라온다. 모두 나온 뒤에 입력을 받는다.
    slotIdx(n).forEach((slot) => later(slot * T_RISE_STAGGER + 30, () => riseSlot(slot)));
    later((n - 1) * T_RISE_STAGGER + T_RISE + 60, () => {
      setPhase("ready");
      void speak(nq.prompt, nq.dir === "toEng" ? "ko-KR" : "en-US", mutedRef.current);
    });
  }

  function start() {
    unlockAudio();
    fever.reset();
    setStage("play");
    setHandsOn(true);
    startQuestion(0);
    requestAnimationFrame(() => stageRef.current?.focus({ preventScroll: true }));
  }

  function finishGame() {
    const g = game.current;
    g.finished = true;
    setFinalStats({
      firstTry: g.firstTry,
      bestCombo: g.bestCombo,
      retries: g.retries,
      whiffs: g.whiffs,
      evolved: g.evolveReached || levelRef.current >= 1,
      level: Math.max(levelRef.current, g.finalPlayed ? 2 : 0, g.evolveReached ? 1 : 0),
      baseCount: g.baseDone,
      retryCount: g.retryDone,
      coins: g.coins + earnCoins(COIN_COMPLETE, "vocab").granted, // 완료 보너스는 한 판에 한 번만
    });
    token.current += 1;
    cancelSpeech();
    setStage("result");
    onComplete?.();
  }

  // 다음 문제로: 두더지가 내려갔다가 다음 문제의 세 마리가 올라온다.
  function goNext() {
    const i = qIndex + 1;
    if (i >= queueRef.current.length) {
      finishGame();
      return;
    }
    slotIdx(game.current.q?.options.length ?? 3).forEach((s) => sinkSlot(s));
    later(280, () => startQuestion(i));
  }

  // ---------- 제한시간 ----------
  // 첫 시간 초과: 콤보 0, 정답 라벨에 힌트를 주고 시간을 다시 채워 같은 문제를 이어간다(최초 정답은 못 받음).
  // 두 번째 시간 초과: 정답을 보여주고 다음 문제로 넘어간다(코인 없이 완료 처리). 점수/생명 차감은 없다.
  function handleTimeout() {
    const g = game.current;
    const cq = g.q;
    if (!cq || g.finished || phaseRef.current !== "ready") return;
    setPhase("busy");
    setHandsOn(false);
    g.qTimeouts += 1;
    g.timeouts += 1;
    g.answered = true; // 이 문제는 최초 정답 대상에서 제외
    g.combo = 0;
    setCombo(0);
    if (g.qTimeouts < 2) fever.retryWrong(); // 같은 문제를 이어가는 중간 실패: FEVER 남은 문제는 줄이지 않는다
    if (g.qTimeouts < 2) {
      g.hint = true;
      setHint(true);
      playSfx("plop", mutedRef.current);
      setBanner({ text: "시간 초과!", tone: "try", key: nextKey() });
      remainingRef.current = TIME_LIMIT_SEC * 1000;
      setTimeLeftMs(TIME_LIMIT_SEC * 1000);
      later(1000, () => {
        setBanner(null);
        setPhase("ready");
      });
      return;
    }
    setBanner({ text: "시간 초과!", tone: "try", key: nextKey() });
    setReveal({ english: cq.target.english, korean: cq.target.korean });
    setHint(true);
    const tk = token.current;
    const hasNext = settleQuestion(cq as MoleQuestion, true); // 시간 초과로 끝난 문제 = 기본 문제 완료 + 재도전 등록
    const fc = fever.complete(`q${g.serial}`, false, hasNext); // 최종 오답
    const spoken = speak(cq.target.english, "en-US", mutedRef.current);
    void Promise.all([new Promise<void>((r) => setTimeout(r, T_REVEAL_MIN)), spoken])
      .then(() => fever.playPost(fc, false))
      .then(() => {
        if (token.current !== tk || game.current.finished) return;
        afterReward(goNext);
      });
  }

  // 올라온 두더지를 누를 수 있는 동안(ready)만 시간이 흐른다
  useEffect(() => {
    if (stage !== "play" || phaseUi !== "ready") return;
    if ((game.current.q as MoleQuestion | null)?.spell) return; // 철자 문제는 재촉하는 카운트다운이 없다
    const iv = setInterval(() => {
      remainingRef.current -= 100;
      setTimeLeftMs(Math.max(0, remainingRef.current));
      if (remainingRef.current <= 0) {
        clearInterval(iv);
        handleTimeout();
      }
    }, 100);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, phaseUi, qIndex]);

  // ---------- 진화: 세 마리(또는 철자 4마리)가 함께 ----------
  // steps: 거치는 단계(1=중간형, 2=최종형). 중간형과 최종형이 겹치면 하나의 순서로 이어서 보여준다.
  function runEvolution(steps: (1 | 2)[], comboBanner: boolean, then: () => void) {
    setPhase("evolving");
    setHandsOn(false);
    const L = layoutRef.current;
    const n = game.current.q?.options.length ?? 3;
    let t = 0;
    steps.forEach((lv) => {
      const dur = lv === 2 ? T_FINAL_EVOLVE : steps.length > 1 ? 650 : T_EVOLVE;
      const at = t;
      later(at, () => {
        playSfx("evolve", mutedRef.current);
        if (lv === 2) {
          setBanner({ text: "최종 진화!", tone: "combo", key: nextKey() });
          setGoldKey((k) => k + 1);
        } else if (comboBanner) {
          setBanner({ text: "3 COMBO!", tone: "combo", key: nextKey() });
        }
        slotIdx(n).forEach((slot) => {
          // 모두 함께 살짝 움츠렸다가
          play(spriteEls.current[slot], [{ transform: "scale(1,1)" }, { transform: "scale(1.06,0.88)" }, { transform: "scale(1,1)" }], { duration: Math.min(260, dur * 0.3), easing: "ease-in-out" });
          const sl = L.slots[slot];
          addFx({ sheet: "evolution", frames: reducedRef.current ? [EVOLVE_FRAMES[3]] : EVOLVE_FRAMES, x: sl.x, y: sl.y - L.moleH * 0.42, size: L.ringW * 1.15, duration: dur });
        });
      });
      later(at + dur * 0.5, () => {
        levelRef.current = lv;
        setLevel(lv); // 일반 idle → 진화 idle (모두 동시에)
      });
      t += dur + 60;
    });
    later(t, then);
  }

  // 보상까지 끝난 뒤, 다음 문제를 시작하기 전에 진화할 조건을 확인한다.
  function afterReward(goNextFn: () => void) {
    const g = game.current;
    const hasMore = qIndex + 1 < queueRef.current.length;
    const lv = levelRef.current;
    const needFinal = lv < 2 && !g.finalPlayed && g.baseDone >= FINAL_EVOLVE_AT;
    const needMid = lv < 1 && !g.evolvePlayed && g.combo >= EVOLVE_COMBO;
    if (needFinal) {
      g.finalPlayed = true;
      if (!hasMore) {
        // 마지막 문제라 연출할 다음 문제가 없다. 결과 화면에 도달한 최종형을 보여준다.
        levelRef.current = 2;
        setLevel(2);
        goNextFn();
        return;
      }
      const steps: (1 | 2)[] = lv < 1 ? [1, 2] : [2];
      if (lv < 1) g.evolvePlayed = true;
      runEvolution(steps, needMid, goNextFn);
      return;
    }
    if (needMid && hasMore) {
      g.evolvePlayed = true;
      runEvolution([1], true, goNextFn);
      return;
    }
    goNextFn();
  }

  // ---------- 탭 처리 ----------
  // 철자 문제: 두더지(글자)를 눌러 현재 빈칸을 채운다. 선택지는 슬롯 번호(고유 ID)로 관리한다.
  function tapSpell(slot: number) {
    const g = game.current;
    const cq = g.q as MoleQuestion | null;
    const sp = g.spell;
    if (!cq || !cq.spell || !sp || sp.done || g.finished || phaseRef.current !== "ready") return;
    if (slot < 0 || slot >= cq.options.length) return;
    if (sp.used.includes(slot) || sp.bad.includes(slot)) return; // 이미 쓴/틀린 두더지는 다시 못 누른다
    unlockAudio();
    setHandsOn(false);
    const word = cq.spell.word;
    const need = word[word.length - 2 + sp.cur];
    const label = cq.options[slot].label;
    if (label.toLowerCase() === need) {
      const at = sp.cur;
      sp.used.push(slot);
      sp.cur += 1;
      playSfx("pop", mutedRef.current);
      play(spriteEls.current[slot], [{ transform: "scale(1,1)" }, { transform: "scale(1.1,0.92)" }, { transform: "scale(1,1)" }], { duration: 200, easing: "ease-out" });
      setSpellUi((u) => (u ? { ...u, cur: sp.cur, filled: u.filled.map((f, i) => (i === at ? label : f)), used: [...sp.used] } : u));
      if (sp.cur >= 2) {
        sp.done = true;
        completeSpell();
      }
    } else {
      // 오답: 글자를 넣지 않고 그 팻말만 흔든 뒤 비활성화. 하트/코인 차감 없음, 정답은 공개하지 않는다.
      sp.bad.push(slot);
      g.wrong += 1;
      g.retries += 1;
      g.combo = 0;
      setCombo(0);
      fever.retryWrong();
      playSfx("plop", mutedRef.current);
      play(
        labelEls.current[slot],
        [{ transform: "translateX(0)" }, { transform: "translateX(-8px)" }, { transform: "translateX(8px)" }, { transform: "translateX(-5px)" }, { transform: "translateX(0)" }],
        { duration: 260, easing: "ease-in-out" },
      );
      setSpellUi((u) => (u ? { ...u, bad: [...sp.bad] } : u));
    }
  }

  // 두 빈칸을 모두 채웠을 때만 한 문제 완료. 통계/콤보/FEVER는 여기서 한 번만 반영한다.
  function completeSpell() {
    const g = game.current;
    const cq = g.q as MoleQuestion;
    setPhase("busy");
    const hadWrong = g.wrong > 0;
    const hasNext = settleQuestion(cq, hadWrong || g.qTimeouts > 0);
    const fc = fever.complete(`q${g.serial}`, true, hasNext);
    let wordCoins = 0;
    if (!hadWrong && !cq.retry) {
      g.firstTry += 1;
      wordCoins = earnCoins(COIN_PER_FIRST_TRY, "vocab").granted; // 새 보너스 없이 기존 첫 시도 정답 코인만
      g.coins += wordCoins;
      g.combo += 1; // 중간 오답이 있었으면 콤보를 새로 올리지 않는다
      g.bestCombo = Math.max(g.bestCombo, g.combo);
    }
    setCombo(g.combo);
    if (g.combo >= EVOLVE_COMBO) g.evolveReached = true;
    setSpellUi((u) => (u ? { ...u, glow: true } : u)); // 금색 테두리 + 은은한 빛
    void speak(cq.target.english, "en-US", mutedRef.current); // 발음 한 번(실패해도 진행)
    const tk = token.current;
    const alive = () => token.current === tk && !game.current.finished;
    void new Promise<void>((r) => setTimeout(r, 1000)) // 완성 단어를 약 1초 또렷하게
      .then(() => (alive() ? fever.playPre(fc, { skipPause: true }) : undefined))
      .then(() => {
        if (!alive()) return;
        const L = layoutRef.current;
        const mid = L.slots[Math.min(1, L.slots.length - 1)];
        if (fc.enhanced) fever.burst(mid.x, mid.y - L.moleH * 0.6, true);
        if (wordCoins > 0) setCoinPop({ x: mid.x, y: mid.y - L.moleH * 0.7, key: nextKey(), strong: fc.enhanced, amount: wordCoins });
        setReveal({ english: cq.target.english, korean: cq.target.korean });
        return new Promise<void>((r) => setTimeout(r, 600));
      })
      .then(() => (alive() ? fever.playPost(fc, true) : undefined))
      .then(() => {
        if (!alive()) return;
        afterReward(goNext);
      });
  }

  function tapSlot(slot: number) {
    if (phaseRef.current !== "ready" || game.current.finished) return; // 한 번의 타격 중에는 입력 잠금
    const g = game.current;
    const cq = g.q;
    if (!cq) return;
    if ((cq as MoleQuestion).spell) {
      tapSpell(slot);
      return;
    }
    if (slot >= cq.options.length) return;
    setPhase("busy");
    setHandsOn(false);
    unlockAudio();
    const L = layoutRef.current;
    const sl = L.slots[slot];
    const isCorrect = slot === cq.correctSlot;
    const firstPick = !g.answered;
    g.answered = true;

    if (isCorrect) {
      const T = { x: sl.x, y: sl.y - L.moleH * 0.8 };
      swing(T, () => onCorrect(slot, T, firstPick));
    } else {
      // 오답: 망치는 두더지 옆 흙에. 망치가 내려오는 순간 두더지는 피한다.
      const side = slot >= 2 ? -1 : 1;
      const T = { x: sl.x + side * L.ringW * 0.43, y: sl.y + 6 * L.sh };
      swing(T, () => onWrong(slot, T, firstPick));
      later(T_WINDUP + 10, () => {
        setPoseAt(slot, "duck");
        sinkSlot(slot, 170);
      });
    }
  }

  function onCorrect(slot: number, T: { x: number; y: number }, firstPick: boolean) {
    const g = game.current;
    const cq = g.q!;
    const L = layoutRef.current;
    let wordCoins = 0;
    // 재도전에서는 첫 시도 코인을 다시 주지 않는다.
    if (firstPick && !(cq as MoleQuestion).retry) {
      g.firstTry += 1;
      wordCoins = earnCoins(COIN_PER_FIRST_TRY, "vocab").granted; // 맞힐 때마다 바로 지갑에
      g.coins += wordCoins;
    }
    const usedHint = g.hint;
    if (!usedHint) {
      g.combo += 1; // 힌트로 맞힌 정답은 콤보를 올리지 않는다
      g.bestCombo = Math.max(g.bestCombo, g.combo);
    }
    setCombo(g.combo);
    if (g.combo >= EVOLVE_COMBO) g.evolveReached = true;

    // 중간 오답/시간 초과가 있었으면 기본 문제는 재도전 대상이 된다. 완료 반영은 문제당 한 번.
    const hasNext = settleQuestion(cq as MoleQuestion, g.wrong > 0 || g.qTimeouts > 0);
    const fc = fever.complete(`q${g.serial}`, true, hasNext);
    playSfx("pop", mutedRef.current);
    setPoseAt(slot, "squash");
    setHoleAt(slot, "correct");
    shakeBoard();
    // 납작해졌다가
    play(spriteEls.current[slot], [{ transform: "scale(1,1)" }, { transform: "scale(1.16,0.8)" }, { transform: "scale(1.06,0.92)" }], { duration: 150, easing: "ease-out" });
    later(150, retractHammer);

    // FEVER 연출(CORRECT → COMBO)이 끝난 뒤에 기존 보상(통통, 별, 코인, 단어 확인)을 이어서 보여준다.
    const tk = token.current;
    void fever.playPre(fc).then(() => {
      if (token.current !== tk || game.current.finished) return;
      addFx({ sheet: "correct", frames: reducedRef.current ? [CORRECT_FRAMES[2]] : CORRECT_FRAMES, x: T.x, y: T.y - L.moleH * 0.12, size: L.ringW * 0.78 * (fc.enhanced ? 1.25 : 1), duration: reducedRef.current ? 500 : 700 });
      if (fc.enhanced) fever.burst(T.x, T.y - L.moleH * 0.12, true);
      setBanner({ text: "정답!", tone: "good", key: nextKey() });
      if (wordCoins > 0) setCoinPop({ x: T.x, y: T.y - L.moleH * 0.1, key: nextKey(), strong: fc.enhanced, amount: wordCoins });
      if (g.combo === 5) setBanner({ text: "SUPER COMBO", tone: "combo", key: nextKey() });
      if (g.combo === 7) setBanner({ text: "MEGA COMBO", tone: "combo", key: nextKey() });
      // 통통 튀어 오르고
      later(20, () => {
        setPoseAt(slot, "bounce");
        playSfx("boing", mutedRef.current);
        play(spriteEls.current[slot], [{ transform: "scale(0.92,1.12)" }, { transform: "scale(1.0,1.0)", offset: 0.5 }, { transform: "scale(1.08,0.9)", offset: 0.85 }, { transform: "scale(1,1)" }], { duration: 420, easing: "ease-in-out" });
        playBoth(slot, [ty(0), { ...ty(-L.moleH * 0.42), offset: 0.45 }, ty(0)], { duration: 420, easing: "ease-in-out" });
      });
      // 다시 idle로 착지
      later(470, () => {
        setPoseAt(slot, "idle");
        setHoleAt(slot, "base");
      });
      setReveal({ english: cq.target.english, korean: cq.target.korean });
      setHint(false);

      // 정답 단어 확인 + 영어 발음 → (FEVER 결과 확인/READY/START/END) → 다음 문제
      const spoken = speak(cq.target.english, "en-US", mutedRef.current);
      void Promise.all([new Promise<void>((r) => setTimeout(r, T_REVEAL_MIN)), spoken])
        .then(() => fever.playPost(fc, true))
        .then(() => {
          if (token.current !== tk || game.current.finished) return;
          afterReward(goNext);
        });
    });
  }

  function onWrong(slot: number, T: { x: number; y: number }, firstPick: boolean) {
    const g = game.current;
    void firstPick;
    g.wrong += 1;
    g.retries += 1;
    g.combo = 0; // 콤보는 끊지만 코인/생명 차감은 없다
    setCombo(0);
    fever.retryWrong();
    playSfx("plop", mutedRef.current);
    setHoleAt(slot, "wrong");
    shakeBoard();
    const L = layoutRef.current;
    addFx({ sheet: "wrong", frames: reducedRef.current ? [DUST_FRAMES[1]] : DUST_FRAMES, x: T.x, y: T.y - L.moleH * 0.12, size: L.ringW * 0.8, duration: reducedRef.current ? 400 : 420 });
    setBanner({ text: "다시 해봐!", tone: "try", key: nextKey() });
    if (g.wrong >= 2 && !g.hint) {
      g.hint = true; // 같은 문제에서 두 번 틀리면 정답 라벨이 살짝 반짝인다 (자동 정답 처리는 없음)
      setHint(true);
    }
    later(160, retractHammer);
    // 잠시 뒤 두더지가 다시 올라온다 (같은 문제·같은 위치 유지)
    later(T_WRONG_RECOVER, () => {
      setPoseAt(slot, "idle");
      setHoleAt(slot, "base");
      riseSlot(slot);
    });
    later(T_WRONG_UNLOCK, () => {
      setBanner(null);
      setPhase("ready");
    });
  }

  // 빈 곳 탭: 근처에서 헛스윙 (학습 오답/콤보 실패로 기록하지 않는다)
  function whiff(x: number, y: number) {
    if (phaseRef.current !== "ready" || game.current.finished) return;
    if ((game.current.q as MoleQuestion | null)?.spell) return; // 철자 문제에서는 빈 곳 헛스윙 없음
    setPhase("busy");
    setHandsOn(false);
    unlockAudio();
    const L = layoutRef.current;
    const T = { x, y };
    swing(T, () => {
      game.current.whiffs += 1;
      playSfx("whoosh", mutedRef.current);
      addFx({ sheet: "wrong", frames: reducedRef.current ? [WHIFF_FRAMES[1]] : WHIFF_FRAMES, x: T.x, y: T.y, size: L.ringW * 0.7, duration: reducedRef.current ? 400 : 420 });
    });
    later(T_IMPACT + 140, retractHammer);
    later(T_IMPACT + T_WHIFF_LOCK, () => setPhase("ready"));
  }

  // ---------- 포인터: 터치/마우스 통합 ----------
  function stagePoint(e: { clientX: number; clientY: number }) {
    const r = stageRef.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }
  function onStageDownCapture(e: ReactPointerEvent<HTMLDivElement>) {
    downPointers.current.add(e.pointerId);
    if (downPointers.current.size > 1) pending.current = null; // 멀티터치는 타격 없이 취소
  }
  function onStageEndCapture(e: ReactPointerEvent<HTMLDivElement>) {
    downPointers.current.delete(e.pointerId);
  }
  function onMoleDown(e: ReactPointerEvent<HTMLButtonElement>) {
    const slot = Number(e.currentTarget.dataset.slot);
    if (!e.isPrimary || (e.pointerType === "mouse" && e.button !== 0)) return;
    if (downPointers.current.size > 1) return;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    pending.current = { kind: "mole", slot, id: e.pointerId, x: e.clientX, y: e.clientY };
  }
  function onMoleUp(e: ReactPointerEvent<HTMLButtonElement>) {
    const slot = Number(e.currentTarget.dataset.slot);
    const p = pending.current;
    pending.current = null;
    if (!p || p.kind !== "mole" || p.id !== e.pointerId || p.slot !== slot) return;
    const r = e.currentTarget.getBoundingClientRect();
    const m = 10;
    if (e.clientX < r.left - m || e.clientX > r.right + m || e.clientY < r.top - m || e.clientY > r.bottom + m) return;
    tapSlot(slot);
  }
  function onBgDown(e: ReactPointerEvent<HTMLDivElement>) {
    if (!e.isPrimary || (e.pointerType === "mouse" && e.button !== 0)) return;
    if (downPointers.current.size > 1) return;
    pending.current = { kind: "bg", slot: -1, id: e.pointerId, x: e.clientX, y: e.clientY };
  }
  function onBgUp(e: ReactPointerEvent<HTMLDivElement>) {
    const p = pending.current;
    pending.current = null;
    if (!p || p.kind !== "bg" || p.id !== e.pointerId) return;
    if (Math.hypot(e.clientX - p.x, e.clientY - p.y) > 24) return; // 끌기는 탭이 아님
    const pt = stagePoint(e);
    whiff(pt.x, pt.y);
  }
  const onPointerCancelAny = () => {
    pending.current = null;
  };
  function onMoleKey(e: ReactKeyboardEvent<HTMLButtonElement>) {
    const slot = Number(e.currentTarget.dataset.slot);
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      tapSlot(slot);
    }
  }
  function onStageKey(e: ReactKeyboardEvent<HTMLDivElement>) {
    if (e.target !== e.currentTarget) return;
    const n = Number(e.key);
    if (n >= 1 && n <= 4) tapSlot(n - 1);
  }

  function replayPrompt() {
    const cq = game.current.q;
    if (!cq) return;
    unlockAudio();
    const sq = cq as MoleQuestion;
    if (sq.spell) void speak(sq.target.english, "en-US", mutedRef.current); // 철자 문제: 단어 발음
    else void speak(cq.prompt, cq.dir === "toEng" ? "ko-KR" : "en-US", mutedRef.current);
  }
  function toggleMute() {
    const m = !mutedRef.current;
    mutedRef.current = m;
    setMuted(m);
    if (m) cancelSpeech();
  }
  function handleExit() {
    token.current += 1;
    cancelSpeech();
    leave();
  }

  // ---------- 렌더 ----------
  const L = layout;
  const stageBase: CSSProperties = {
    position: "fixed",
    inset: 0,
    zIndex: 50,
    height: "100dvh",
    overflow: "hidden",
    touchAction: "none",
    userSelect: "none",
    WebkitUserSelect: "none",
    WebkitTouchCallout: "none",
    overscrollBehavior: "none",
    backgroundColor: "#6aa84f",
    backgroundImage: `url(${M}/background.png)`,
    backgroundSize: "cover",
    backgroundPosition: "center",
    color: "#fff",
  };

  const finalK = L.sm * FINAL_SCALE;
  const moleSprite = (pose: Pose, lv: number): CSSProperties => {
    if (lv >= 2) {
      const f = FINAL_FRAMES[pose];
      return {
        position: "absolute",
        left: -f.cx * finalK,
        top: -f.fy * finalK,
        width: f.w * finalK,
        height: f.h * finalK,
        backgroundImage: `url(${M}/moles_final_red.png)`,
        backgroundRepeat: "no-repeat",
        backgroundSize: `${FINAL_SHEET.w * finalK}px ${FINAL_SHEET.h * finalK}px`,
        backgroundPosition: `${-f.x * finalK}px ${-f.y * finalK}px`,
        pointerEvents: "none",
      };
    }
    const ev = lv >= 1;
    const idx = POSES.indexOf(pose) + (ev ? 4 : 0);
    const col = COLX[idx % 4];
    const row = ROWY[Math.floor(idx / 4)];
    const a = MOLE_ANCHOR[pose];
    return {
      position: "absolute",
      left: -a.cx * L.sm,
      top: -a.fy * L.sm,
      width: MOLE_SHEET.cell * L.sm,
      height: MOLE_SHEET.cell * L.sm,
      backgroundImage: `url(${M}/moles.png)`,
      backgroundRepeat: "no-repeat",
      backgroundSize: `${MOLE_SHEET.w * L.sm}px ${MOLE_SHEET.h * L.sm}px`,
      backgroundPosition: `${-col * L.sm}px ${-row * L.sm}px`,
      pointerEvents: "none",
    };
  };
  const holeSprite = (s: HoleState, ev: boolean, slot: number, front: boolean): CSSProperties => {
    const c = HOLE_CELLS[HOLE_IDX(s, ev)];
    const sl = L.slots[slot];
    const left = sl.x - c.ax * L.sh;
    const top = sl.y - c.ay * L.sh;
    const clipLine = sl.y + 30 * L.sh;
    return {
      position: "absolute",
      left,
      top,
      width: HOLE_SHEET.cw * L.sh,
      height: HOLE_SHEET.ch * L.sh,
      backgroundImage: `url(${M}/holes.png)`,
      backgroundRepeat: "no-repeat",
      backgroundSize: `${HOLE_SHEET.w * L.sh}px ${HOLE_SHEET.h * L.sh}px`,
      backgroundPosition: `${-c.x * L.sh}px ${-c.y * L.sh}px`,
      pointerEvents: "none",
      zIndex: front ? 4 : 1,
      clipPath: front ? `inset(${Math.max(0, clipLine - top)}px 0 0 0)` : undefined,
    };
  };
  const clipBox = (slot: number, z: number): CSSProperties => {
    const sl = L.slots[slot];
    const top = sl.y - L.moleH * 2.2;
    return {
      position: "absolute",
      left: sl.x - L.ringW * 0.8,
      width: L.ringW * 1.6,
      top,
      height: sl.y + 30 * L.sh - top,
      overflow: "hidden",
      pointerEvents: "none",
      zIndex: z,
    };
  };
  const anchorIn = (slot: number): CSSProperties => {
    const sl = L.slots[slot];
    const top = sl.y - L.moleH * 2.2;
    return { position: "absolute", left: L.ringW * 0.8, top: sl.y + 12 * L.sh - top, width: 0, height: 0, transform: `translateY(${L.moleH * 1.25}px)` };
  };

  if (!questions) {
    return (
      <div ref={stageRef} style={stageBase} className="mg-stage flex items-center justify-center p-6">
        <MoleStyles />
        <div className="rounded-3xl bg-white/95 text-gray-800 px-8 py-8 max-w-md text-center flex flex-col gap-4 shadow-xl">
          <p className="text-2xl font-black">단어가 조금 부족해요</p>
          <p className="text-base text-gray-600">두더지 잡기는 서로 다른 단어가 3개 이상 필요해요. 단어를 더 공부하고 다시 도전해요!</p>
          <button onClick={handleExit} className="mg-btn min-h-[48px] rounded-full bg-sky-600 text-white font-bold text-lg">
            나가기
          </button>
        </div>
      </div>
    );
  }

  if (stage === "result" && finalStats) {
    const rows: [string, string][] = [
      ["기본 단어", `${finalStats.baseCount}개`],
      ["재도전 단어", `${finalStats.retryCount}개`],
      ["최초 정답", `${finalStats.firstTry}개`],
      ["최고 콤보", `${finalStats.bestCombo}`],
      ["오답 횟수", `${finalStats.retries}번`],
      ["빈 곳 헛스윙", `${finalStats.whiffs}번`],
    ];
    const lvRes = finalStats.level;
    const col = 0;
    const row = lvRes >= 1 ? 1 : 0;
    const k = 0.34;
    const fk = (352 * k * 1.15) / FINAL_FRAMES.idle.h; // 결과 화면의 최종형 크기
    return (
      <div ref={stageRef} style={stageBase} className="mg-stage flex items-center justify-center p-4">
        <MoleStyles />
        <div className="rounded-3xl bg-white/95 text-gray-800 px-8 py-6 w-full max-w-md flex flex-col items-center gap-3 shadow-2xl">
          <p className="text-3xl font-black text-amber-700">두더지 완료!</p>
          <div style={{ width: 301 * k + 20, height: 352 * k * 1.2 + 10, position: "relative" }}>
            {lvRes >= 2 ? (
              <div
                style={{
                  position: "absolute",
                  left: "50%",
                  marginLeft: -(FINAL_FRAMES.idle.w * fk) / 2,
                  bottom: 0,
                  width: FINAL_FRAMES.idle.w * fk,
                  height: FINAL_FRAMES.idle.h * fk,
                  backgroundImage: `url(${M}/moles_final_red.png)`,
                  backgroundRepeat: "no-repeat",
                  backgroundSize: `${FINAL_SHEET.w * fk}px ${FINAL_SHEET.h * fk}px`,
                  backgroundPosition: `${-FINAL_FRAMES.idle.x * fk}px ${-FINAL_FRAMES.idle.y * fk}px`,
                }}
              />
            ) : (
              <div
                style={{
                  position: "absolute",
                  left: -(70 * k) + 10,
                  top: -(44 * k) + 352 * k * 0.2,
                  width: 444 * k,
                  height: 444 * k,
                  backgroundImage: `url(${M}/moles.png)`,
                  backgroundRepeat: "no-repeat",
                  backgroundSize: `${MOLE_SHEET.w * k}px ${MOLE_SHEET.h * k}px`,
                  backgroundPosition: `${-COLX[col] * k}px ${-ROWY[row] * k}px`,
                }}
              />
            )}
          </div>
          {lvRes >= 1 && (
            <p className="rounded-full bg-purple-100 text-purple-700 font-black px-4 py-1 text-base">
              {lvRes >= 2 ? "🌟 최종 진화 달성!" : "🌟 진화 달성!"}
            </p>
          )}
          <div className="w-full flex flex-col gap-1.5 text-lg font-bold">
            {rows.map(([kk, v]) => (
              <div key={kk} className="flex justify-between border-b border-gray-200 pb-1">
                <span className="text-gray-500">{kk}</span>
                <span>{v}</span>
              </div>
            ))}
            <div className="flex justify-between text-amber-600 text-xl pt-1">
              <span>획득 코인</span>
              <CoinAmount amount={finalStats.coins} prefix="+" size={26} />
            </div>
          </div>
          <div className="flex gap-3 w-full">
            <button onClick={onRetry} className="mg-btn flex-1 min-h-[52px] rounded-full bg-gray-200 text-gray-800 font-bold text-lg active:scale-95 transition">
              다시하기
            </button>
            <button onClick={onDone} className="mg-btn flex-1 min-h-[52px] rounded-full bg-sky-600 text-white font-bold text-lg active:scale-95 transition">
              나가기
            </button>
          </div>
        </div>
      </div>
    );
  }

  const hamS = L.sm * 0.52;
  const hamCell = (kind: "idle" | "strike"): CSSProperties => {
    const enh = evolved;
    const cx = kind === "idle" ? 0 : 768;
    const cy = enh ? 512 : 0;
    const pv = HAM[kind];
    return {
      position: "absolute",
      left: -pv.px * hamS,
      top: -pv.py * hamS,
      width: HAM_SHEET.cw * hamS,
      height: HAM_SHEET.ch * hamS,
      backgroundImage: `url(${M}/hammers.png)`,
      backgroundRepeat: "no-repeat",
      backgroundSize: `${HAM_SHEET.w * hamS}px ${HAM_SHEET.h * hamS}px`,
      backgroundPosition: `${-cx * hamS}px ${-cy * hamS}px`,
      display: kind === "idle" ? "block" : "none",
    };
  };
  const timePct = Math.max(0, Math.min(100, (timeLeftMs / (TIME_LIMIT_SEC * 1000)) * 100));
  const spellWord = (q as MoleQuestion | null)?.spell?.word ?? null;
  const isSpell = !!spellWord;
  const baseFs = clamp(MOLE_BODY_W * L.sm * 0.15, 18, 34);
  const labelFsFor = (label: string) => (isSpell ? baseFs * 1.7 : label.includes(" ") ? baseFs * 0.8 : clamp(Math.min(baseFs, (MOLE_BODY_W * L.sm * 1.05) / Math.max(1, [...label].length * 0.62)), 13, baseFs));
  const moleBtn = (slot: number): CSSProperties => {
    const sl = L.slots[slot];
    const w = Math.max(48, L.ringW * 0.86);
    const top = sl.y - L.moleH * 1.02;
    return { position: "absolute", left: sl.x - w / 2, top, width: w, height: Math.max(48, sl.y + 40 * L.sh - top), zIndex: 8, background: "transparent", border: 0, padding: 0, cursor: "pointer", touchAction: "none" };
  };

  return (
    <div
      ref={stageRef}
      style={stageBase}
      className="mg-stage"
      role="group"
      aria-label="두더지 잡기. 철자가 맞는 두더지를 눌러요. 키보드는 Tab으로 두더지를 고르고 Enter나 Space로 눌러요."
      tabIndex={0}
      onKeyDown={onStageKey}
      onPointerDownCapture={onStageDownCapture}
      onPointerUpCapture={onStageEndCapture}
      onPointerCancelCapture={onStageEndCapture}
      onContextMenu={(e) => e.preventDefault()}
    >
      <MoleStyles />
      <div role="status" aria-live="polite" className="sr-only">
        {banner ? banner.text : ""}
        {reveal ? ` ${reveal.english} ${reveal.korean}` : ""}
      </div>

      {/* 빈 곳 탭 = 헛스윙 (UI 요소는 이 위에 있으므로 영향 없음) */}
      <div
        data-bg
        style={{ position: "absolute", inset: 0, zIndex: 0 }}
        onPointerDown={onBgDown}
        onPointerUp={onBgUp}
        onPointerCancel={onPointerCancelAny}
      />

      {/* 게임판 (정답/오답 때 이 묶음만 아주 작게 흔들린다) */}
      <div ref={boardRef} style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
        {loaded &&
          q &&
          slotIdx(slotCount).map((slot) => (
            <div key={slot}>
              {/* 구멍 뒤쪽 흙 */}
              <div style={holeSprite(holes[slot], evolved, slot, false)} />
              {/* 구멍 안에 클리핑된 두더지 */}
              <div style={clipBox(slot, 2)}>
                <div
                  ref={(el) => {
                    moveEls.current[slot] = el;
                  }}
                  style={anchorIn(slot)}
                >
                  <div
                    ref={(el) => {
                      spriteEls.current[slot] = el;
                    }}
                    style={{ position: "absolute", left: 0, top: 0, transformOrigin: "0 0" }}
                  >
                    <div className="mg-breathe" style={{ position: "absolute", left: 0, top: 0 }}>
                      <div style={moleSprite(poses[slot], level)} />
                    </div>
                  </div>
                </div>
              </div>
              {/* 구멍 앞쪽 흙 마스크 (두더지가 테이블 위로 지나가지 않게) */}
              <div style={holeSprite(holes[slot], evolved, slot, true)} />
              {/* 가슴 단어 라벨: 두더지와 같은 움직임을 쓴다 */}
              <div style={clipBox(slot, 6)}>
                <div
                  ref={(el) => {
                    labelEls.current[slot] = el;
                  }}
                  style={anchorIn(slot)}
                >
                  <div
                    className={undefined}
                    style={{
                      position: "absolute",
                      left: 0,
                      top: level >= 2 ? -FINAL_FRAMES[poses[slot]].up * finalK : -LABEL_UP[poses[slot]] * L.sm,
                      transform: "translate(-50%, -50%)",
                      transition: "top 90ms ease-out",
                      minWidth: MOLE_BODY_W * L.sm * 0.6,
                      maxWidth: MOLE_BODY_W * L.sm * 1.25,
                      padding: `${labelFsFor(q.options[slot].label) * 0.22}px ${labelFsFor(q.options[slot].label) * 0.55}px`,
                      borderRadius: labelFsFor(q.options[slot].label) * 0.9,
                      background: "#fff6dc",
                      border: "3px solid #d9b26a",
                      boxShadow: "0 3px 6px rgba(0,0,0,0.25)",
                      color: "#3a2410",
                      opacity: spellUi && (spellUi.used.includes(slot) || spellUi.bad.includes(slot)) ? 0.35 : 1,
                      fontWeight: 900,
                      fontSize: labelFsFor(q.options[slot].label),
                      whiteSpace: q.options[slot].label.includes(" ") ? "normal" : "nowrap",
                      lineHeight: 1.1,
                      textAlign: "center",
                      wordBreak: "keep-all",
                      overflowWrap: "anywhere",
                    }}
                  >
                    {q.options[slot].label}
                  </div>
                </div>
              </div>
            </div>
          ))}

        {/* 효과 프레임 (한 번만 재생하고 제거) */}
        <div style={{ position: "absolute", inset: 0, zIndex: 5 }}>
          {fxList.map((f) => (
            <SpriteFx key={f.id} item={f} onEnd={removeFx} />
          ))}
        </div>

        {/* 뿅망치 */}
        <div ref={hamRef} style={{ position: "absolute", left: 0, top: 0, width: 0, height: 0, display: "none", transformOrigin: "0 0", zIndex: 9 }}>
          <div ref={hamIdleRef} style={hamCell("idle")} />
          <div ref={hamStrikeRef} style={hamCell("strike")} />
        </div>

        {coinPop && (
          <div
            key={coinPop.key}
            className="mg-coin"
            style={{ position: "absolute", left: coinPop.x, top: coinPop.y, zIndex: 10, fontWeight: 900, fontSize: coinPop.strong ? 30 : 22, color: "#ffe14a", textShadow: "0 2px 4px rgba(0,0,0,.6)" }}
          >
            <CoinAmount amount={coinPop.amount ?? COIN_PER_FIRST_TRY} prefix="+" size={coinPop.strong ? 32 : 24} />
          </div>
        )}
      </div>

      {/* 상단 HUD */}
      <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: 48, zIndex: 20, paddingLeft: 12, paddingRight: 12 }} className="flex items-center justify-between gap-2">
        <button onClick={handleExit} className="mg-btn min-h-[44px] min-w-[44px] px-4 rounded-full bg-black/45 text-white font-bold text-base active:scale-95 transition">
          ✕ 나가기
        </button>
        <span className="rounded-full bg-black/45 px-4 py-2 text-base font-black">
          기본 {prog.base}/{prog.total}
          {prog.retryLeft > 0 ? ` · 재도전 ${prog.retryLeft}개 남음` : ""}
        </span>
        <button
          onClick={toggleMute}
          aria-label={muted ? "소리 켜기" : "소리 끄기"}
          aria-pressed={muted}
          className="mg-btn min-h-[44px] min-w-[44px] rounded-full bg-black/45 text-xl active:scale-95 transition"
        >
          {muted ? "🔇" : "🔊"}
        </button>
      </div>

      {/* FEVER: 작고 정적인 게이지/남은 보상 문제 + 정답 보상 배너 */}
      {stage === "play" && <FeverHud hud={fever.hud} style={{ position: "absolute", left: 12, top: L.qTop + L.qH + 8, zIndex: 12 }} />}
      {fever.layer}

      {/* 문제 카드 */}
      {stage === "play" && q && (
        <div
          style={{ position: "absolute", left: "50%", top: L.qTop, height: L.qH, transform: "translateX(-50%)", zIndex: 10, maxWidth: "min(92vw, 720px)", minWidth: Math.min(L.w * 0.5, 320) }}
          className="rounded-3xl bg-white/95 text-gray-900 shadow-lg flex items-center justify-center gap-3 px-6"
        >
          <p
            key={qIndex}
            className="mg-pop font-black text-center leading-tight"
            style={{ fontSize: clamp(Math.min(L.qH * 0.42, ((L.w * 0.8 - 90) / Math.max(1, [...q.prompt].length)) * 1.05), 16, 32), whiteSpace: "nowrap" }}
          >
            {q.prompt}
          </p>
          <button onClick={replayPrompt} aria-label="다시 듣기" className="mg-btn shrink-0 min-h-[48px] min-w-[48px] rounded-full bg-sky-100 text-2xl active:scale-95 transition">
            🔈
          </button>
          {!isSpell && (
          <div
            role="progressbar"
            aria-label="남은 시간"
            aria-valuemin={0}
            aria-valuemax={TIME_LIMIT_SEC}
            aria-valuenow={Math.ceil(timeLeftMs / 1000)}
            style={{ position: "absolute", left: 16, right: 16, bottom: 5, height: 5, borderRadius: 999, background: "rgba(0,0,0,0.12)", overflow: "hidden" }}
          >
            <div
              className={`h-full ${timePct > 50 ? "bg-sky-400" : timePct > 20 ? "bg-yellow-400" : "bg-red-500"}`}
              style={{ width: `${timePct}%`, transition: "width 100ms linear" }}
            />
          </div>
          )}
        </div>
      )}

      {/* 철자 문제: 큰 단어. 빈 두 칸 중 지금 채울 칸만 노란 굵은 테두리 + 아래 화살표 */}
      {stage === "play" && q && spellWord && spellUi && (() => {
        const n = spellWord.length;
        const tile = clamp((L.w * 0.8) / (n * 1.12), 34, 78);
        return (
          <div
            role="group"
            aria-label={`철자 문제. ${spellWord.slice(0, n - 2).toUpperCase()} 다음 빈칸 두 개를 두더지 글자로 채워요`}
            style={{ position: "absolute", left: "50%", top: L.qTop + L.qH + 10, transform: "translateX(-50%)", zIndex: 11, display: "flex", gap: tile * 0.12, pointerEvents: "none" }}
          >
            {[...spellWord.toUpperCase()].map((ch, i) => {
              const b = i - (n - 2); // 빈칸 번호(0/1), 그 외는 처음부터 보이는 글자
              const isBlank = b >= 0;
              const shown = isBlank ? spellUi.filled[b] : ch;
              const isCur = isBlank && spellUi.cur === b;
              return (
                <div key={i} style={{ position: "relative", width: tile, height: tile * 1.15 }}>
                  {isCur && (
                    <span aria-hidden style={{ position: "absolute", left: "50%", top: -tile * 0.42, transform: "translateX(-50%)", fontSize: tile * 0.38, color: "#ffd84a", textShadow: "0 1px 3px rgba(0,0,0,.6)" }}>
                      ▼
                    </span>
                  )}
                  <div
                    className={isCur ? "mg-hint" : undefined}
                    style={{
                      width: "100%",
                      height: "100%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      borderRadius: tile * 0.2,
                      background: spellUi.glow ? "#fff3c4" : isBlank && !shown ? "rgba(255,255,255,0.55)" : "#ffffff",
                      border: spellUi.glow ? "4px solid #f5b800" : isCur ? "5px solid #ffd84a" : isBlank ? "3px dashed #8a6a2c" : "3px solid #d9b26a",
                      boxShadow: spellUi.glow ? "0 0 16px rgba(245,184,0,0.7)" : "0 3px 6px rgba(0,0,0,0.25)",
                      transform: isCur || spellUi.glow ? "scale(1.08)" : "scale(1)",
                      transition: "all 200ms ease-out",
                      color: "#3a2410",
                      fontWeight: 900,
                      fontSize: tile * 0.62,
                      lineHeight: 1,
                    }}
                  >
                    {shown ?? ""}
                  </div>
                </div>
              );
            })}
          </div>
        );
      })()}

      {/* 콤보 표시 (패드 가로에서는 오른쪽 여백) */}
      {stage === "play" && (
        <div
          style={{ position: "absolute", right: 12, top: L.portrait ? L.qTop + L.qH + 6 : L.qTop + 4, zIndex: 10 }}
          className="rounded-2xl bg-black/45 px-4 py-2 flex flex-col items-center"
          aria-label={`콤보 ${combo}`}
        >
          <span className="text-xs font-bold text-white/80">COMBO</span>
          <span className="text-3xl font-black leading-none">{combo}</span>
          <span className="flex gap-1 mt-1" aria-hidden>
            {[0, 1, 2].map((i) => (
              <span key={i} className={`w-3 h-3 rounded-full ${evolved || combo > i ? "bg-yellow-300" : "bg-white/30"}`} />
            ))}
          </span>
        </div>
      )}

      {/* 두더지 터치 영역: 캐릭터/라벨/영역 한 묶음 (그림 경계보다 넉넉하게) */}
      {loaded &&
        q &&
        stage === "play" &&
        slotIdx(slotCount).map((slot) => (
          <button
            key={slot}
            aria-label={q.options[slot].label}
            className="mg-btn"
            style={moleBtn(slot)}
            data-slot={slot}
            onPointerDown={onMoleDown}
            onPointerUp={onMoleUp}
            onPointerCancel={onPointerCancelAny}
            onLostPointerCapture={onPointerCancelAny}
            onKeyDown={onMoleKey}
          />
        ))}

      {/* 최종 진화: 은은한 금색 빛 1회 (깜빡임 없음) */}
      {goldKey > 0 && (
        <div
          key={goldKey}
          aria-hidden
          className="mg-gold"
          style={{ position: "absolute", inset: 0, zIndex: 12, pointerEvents: "none", background: "radial-gradient(ellipse at 50% 70%, rgba(255,215,90,0.38) 0%, rgba(255,215,90,0) 65%)" }}
        />
      )}

      {/* 결과 문구 */}
      {banner && (
        <div key={banner.key} style={{ position: "absolute", left: "50%", top: L.qTop + L.qH + 12, transform: "translateX(-50%)", zIndex: 14 }} className="pointer-events-none">
          <span
            className={`mg-pop inline-block rounded-full px-7 py-2 font-black text-3xl shadow-lg whitespace-nowrap ${
              banner.tone === "good" ? "bg-amber-300 text-amber-900" : banner.tone === "try" ? "bg-rose-400 text-white" : "bg-purple-500 text-white"
            }`}
          >
            {banner.text}
          </span>
        </div>
      )}

      {/* 정답 단어 확인 (영어 + 한국어 한 줄) */}
      {reveal && (
        <div key={`reveal-${qIndex}`} style={{ position: "absolute", left: "50%", top: L.revealY, transform: "translate(-50%, -50%)", zIndex: 14, maxWidth: "94vw" }} className="pointer-events-none">
          <div className="mg-pop flex items-center justify-center gap-3 rounded-2xl bg-white/95 text-gray-900 px-5 py-1.5 shadow-xl whitespace-nowrap">
            <span className="font-black" style={{ fontSize: 24 }}>{reveal.english}</span>
            <span className="text-gray-400 font-black" style={{ fontSize: 24 }}>·</span>
            <span className="font-black text-sky-700" style={{ fontSize: 24 }}>{reveal.korean}</span>
          </div>
        </div>
      )}

      {/* 첫 안내 */}
      {stage === "play" && handsOn && (
        <p style={{ position: "absolute", left: 0, right: 0, bottom: 14, zIndex: 11, textShadow: "0 2px 6px rgba(0,0,0,.6)" }} className="text-center text-base font-bold pointer-events-none">
          철자가 맞는 두더지를 톡!
        </p>
      )}

      {/* 로딩 / 시작 안내 */}
      {stage === "intro" && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/45 p-4">
          <div className="mg-pop rounded-3xl bg-white text-gray-800 px-8 py-8 max-w-md w-full flex flex-col items-center gap-5 text-center shadow-2xl">
            <p className="text-5xl" aria-hidden>🔨</p>
            {loadFailed ? (
              <>
                <p className="text-xl font-black">그림을 불러오지 못했어요</p>
                <p className="text-base text-gray-600">네트워크를 확인하고 다시 시도해 주세요.</p>
                <div className="flex gap-3 w-full">
                  <button onClick={onRetry} className="mg-btn flex-1 min-h-[52px] rounded-full bg-sky-600 text-white font-black text-lg">다시 시도</button>
                  <button onClick={handleExit} className="mg-btn flex-1 min-h-[52px] rounded-full bg-gray-200 text-gray-800 font-black text-lg">나가기</button>
                </div>
              </>
            ) : (
              <>
                <p className="text-2xl font-black leading-snug" style={{ wordBreak: "keep-all" }}>
                  철자가 맞는 두더지를 톡 눌러 잡아봐!
                </p>
                <button onClick={start} disabled={!loaded} className="mg-btn w-full min-h-[56px] rounded-full bg-sky-600 text-white font-black text-xl active:scale-95 transition disabled:opacity-60">
                  {loaded ? "시작!" : "불러오는 중…"}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
