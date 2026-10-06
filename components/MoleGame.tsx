"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from "react";
import type { VocabWord } from "@/lib/types";
import { buildAlternatingQuestions, type Question } from "@/lib/gameQuestions";
import { cancelSpeech, playSfx, speak, unlockAudio } from "@/lib/gameAudio";

// ---------------------------------------------------------------------------
// 두더지 잡기 v2
//  - 한국어 ↔ 영어 번갈아 출제(방향 문구는 표시하지 않음), 총 10문제
//  - 정답: 납작 → 통통 튀기 / 오답: 두더지가 피하고 망치가 흙에 / 3콤보: 세 마리 모두 진화
//  - 두더지·라벨·터치 영역을 구멍(slot) 단위 한 묶음으로 관리한다
// ---------------------------------------------------------------------------

const M = "/assets/mole-game";

// ---------- 설정값 ----------
const ROUND_COUNT = 10;
const COIN_COMPLETE = 10;
const COIN_PER_FIRST_TRY = 2;
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

const IMAGES = ["background", "moles", "holes", "hammers", "correct_fx", "wrong_fx", "evolution_fx"].map((n) => `${M}/${n}.png`);

// ---------- 레이아웃 ----------
type Layout = {
  w: number; h: number; qTop: number; qH: number; sh: number; sm: number; ringW: number; moleH: number;
  slots: { x: number; y: number }[]; // 구멍 입구 중심(화면 좌표)
  revealY: number; portrait: boolean;
};
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

function computeLayout(w: number, h: number): Layout {
  const portrait = h > w * 1.1;
  const qTop = 52;
  const qH = clamp(h * 0.09, 52, 72);
  const regionTop = qTop + qH + 10;
  const regionBottom = h - 64;
  const regionH = Math.max(160, regionBottom - regionTop);
  let sh: number;
  let slots: { x: number; y: number }[];
  if (!portrait) {
    sh = Math.min((w * 0.29) / HOLE_SHEET.ring, regionH / 480);
    const y = regionTop + regionH * 0.78;
    slots = [0, 1, 2].map((i) => ({ x: w / 2 + (i - 1) * Math.min(w * 0.31, sh * HOLE_SHEET.ring * 1.07), y }));
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
type Stats = { firstTry: number; bestCombo: number; retries: number; whiffs: number; evolved: boolean; coins: number };

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
      .mg-stage:focus-visible { outline: 4px solid #ffd84a; outline-offset: -4px; }
      .mg-btn:focus-visible { outline: 4px solid #ffd84a; outline-offset: 2px; border-radius: 24px; }
      @media (prefers-reduced-motion: reduce) {
        .mg-breathe, .mg-pop, .mg-coin, .mg-hint { animation: none; }
      }
    `}</style>
  );
}

export default function MoleGame({
  words,
  onDone,
  onRetry,
  onExit,
}: {
  words: VocabWord[];
  onDone: () => void;
  onRetry: () => void;
  onExit?: () => void;
}) {
  const [questions] = useState<Question[] | null>(() => buildAlternatingQuestions(words, ROUND_COUNT));
  const leave = onExit ?? onDone;

  const stageRef = useRef<HTMLDivElement>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 1024, h: 768 });
  const layout = useMemo(() => computeLayout(size.w, size.h), [size]);
  const layoutRef = useRef(layout);

  const [loaded, setLoaded] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [stage, setStage] = useState<"intro" | "play" | "result">("intro");
  const [q, setQ] = useState<Question | null>(null);
  const [qIndex, setQIndex] = useState(0);

  type Phase = "idle" | "rising" | "ready" | "busy" | "evolving";
  const phaseRef = useRef<Phase>("idle");

  const [poses, setPoses] = useState<Pose[]>(["idle", "idle", "idle"]);
  const [holes, setHoles] = useState<HoleState[]>(["base", "base", "base"]);
  const [evolved, setEvolved] = useState(false);
  const evolvedRef = useRef(false);
  const [hint, setHint] = useState(false);
  const [combo, setCombo] = useState(0);
  const [banner, setBanner] = useState<Banner | null>(null);
  const [reveal, setReveal] = useState<{ english: string; korean: string } | null>(null);
  const [coinPop, setCoinPop] = useState<{ x: number; y: number; key: number } | null>(null);
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
    hint: false,
    finished: false,
  });
  const token = useRef(0);
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>());
  const keySeq = useRef(0);
  const nextKey = () => ++keySeq.current;

  const moveEls = useRef<(HTMLDivElement | null)[]>([null, null, null]);
  const labelEls = useRef<(HTMLDivElement | null)[]>([null, null, null]);
  const spriteEls = useRef<(HTMLDivElement | null)[]>([null, null, null]);
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

  // ---------- 문제 시작 ----------
  function startQuestion(i: number) {
    if (!questions) return;
    token.current += 1;
    timers.current.forEach(clearTimeout);
    timers.current.clear();
    const g = game.current;
    const nq = questions[i];
    g.q = nq;
    g.wrong = 0;
    g.answered = false;
    g.hint = false;
    setQ(nq);
    setQIndex(i);
    setPoses(["idle", "idle", "idle"]);
    setHoles(["base", "base", "base"]);
    setHint(false);
    setBanner(null);
    setReveal(null);
    setFxList([]);
    setPhase("rising");
    // 구멍에서 0.12초 간격으로 통통 올라온다. 모두 나온 뒤에 입력을 받는다.
    [0, 1, 2].forEach((slot) => later(slot * T_RISE_STAGGER + 30, () => riseSlot(slot)));
    later(2 * T_RISE_STAGGER + T_RISE + 60, () => {
      setPhase("ready");
      void speak(nq.prompt, nq.dir === "toEng" ? "ko-KR" : "en-US", mutedRef.current);
    });
  }

  function start() {
    unlockAudio();
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
      evolved: g.evolveReached,
      coins: COIN_COMPLETE + COIN_PER_FIRST_TRY * g.firstTry, // 한 게임에 한 번만 계산·표시
    });
    token.current += 1;
    cancelSpeech();
    setStage("result");
  }

  // 다음 문제로: 두더지가 내려갔다가 다음 문제의 세 마리가 올라온다.
  function goNext() {
    const i = qIndex + 1;
    if (i >= ROUND_COUNT) {
      finishGame();
      return;
    }
    [0, 1, 2].forEach((s) => sinkSlot(s));
    later(280, () => startQuestion(i));
  }

  // ---------- 3콤보 진화: 세 마리 모두 동시에 ----------
  function evolveAll(then: () => void) {
    const g = game.current;
    g.evolvePlayed = true;
    setPhase("evolving");
    const L = layoutRef.current;
    playSfx("evolve", mutedRef.current);
    setBanner({ text: "3 COMBO!", tone: "combo", key: nextKey() });
    L.slots.forEach((sl) => {
      addFx({ sheet: "evolution", frames: reducedRef.current ? [EVOLVE_FRAMES[3]] : EVOLVE_FRAMES, x: sl.x, y: sl.y - L.moleH * 0.42, size: L.ringW * 1.15, duration: T_EVOLVE });
    });
    later(T_EVOLVE * 0.5, () => {
      evolvedRef.current = true;
      setEvolved(true); // 일반 idle → 진화 idle (세 마리 동시)
    });
    later(T_EVOLVE + 60, then);
  }

  // ---------- 탭 처리 ----------
  function tapSlot(slot: number) {
    if (phaseRef.current !== "ready" || game.current.finished) return; // 한 번의 타격 중에는 입력 잠금
    const g = game.current;
    const cq = g.q;
    if (!cq) return;
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
      const side = slot === 2 ? -1 : 1;
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
    if (firstPick) g.firstTry += 1;
    const usedHint = g.hint;
    if (!usedHint) {
      g.combo += 1; // 힌트로 맞힌 정답은 콤보를 올리지 않는다
      g.bestCombo = Math.max(g.bestCombo, g.combo);
    }
    setCombo(g.combo);
    if (g.combo >= EVOLVE_COMBO) g.evolveReached = true;

    playSfx("pop", mutedRef.current);
    setPoseAt(slot, "squash");
    setHoleAt(slot, "correct");
    shakeBoard();
    // 납작해졌다가
    play(spriteEls.current[slot], [{ transform: "scale(1,1)" }, { transform: "scale(1.16,0.8)" }, { transform: "scale(1.06,0.92)" }], { duration: 150, easing: "ease-out" });
    addFx({ sheet: "correct", frames: reducedRef.current ? [CORRECT_FRAMES[2]] : CORRECT_FRAMES, x: T.x, y: T.y - L.moleH * 0.12, size: L.ringW * 0.78, duration: reducedRef.current ? 500 : 700 });
    setBanner({ text: "정답!", tone: "good", key: nextKey() });
    setCoinPop({ x: T.x, y: T.y - L.moleH * 0.1, key: nextKey() });
    if (g.combo === 5) setBanner({ text: "SUPER COMBO", tone: "combo", key: nextKey() });
    if (g.combo === 7) setBanner({ text: "MEGA COMBO", tone: "combo", key: nextKey() });
    later(150, retractHammer);
    // 통통 튀어 오르고
    later(170, () => {
      setPoseAt(slot, "bounce");
      playSfx("boing", mutedRef.current);
      play(spriteEls.current[slot], [{ transform: "scale(0.92,1.12)" }, { transform: "scale(1.0,1.0)", offset: 0.5 }, { transform: "scale(1.08,0.9)", offset: 0.85 }, { transform: "scale(1,1)" }], { duration: 420, easing: "ease-in-out" });
      playBoth(slot, [ty(0), { ...ty(-L.moleH * 0.42), offset: 0.45 }, ty(0)], { duration: 420, easing: "ease-in-out" });
    });
    // 다시 idle로 착지
    later(620, () => {
      setPoseAt(slot, "idle");
      setHoleAt(slot, "base");
    });
    setReveal({ english: cq.target.english, korean: cq.target.korean });
    setHint(false);

    // 정답 단어 확인 + 영어 발음 → 다음 문제
    const tk = token.current;
    const spoken = speak(cq.target.english, "en-US", mutedRef.current);
    void Promise.all([new Promise<void>((r) => setTimeout(r, T_REVEAL_MIN)), spoken]).then(() => {
      if (token.current !== tk || game.current.finished) return;
      const isLast = qIndex + 1 >= ROUND_COUNT;
      if (!isLast && game.current.combo >= EVOLVE_COMBO && !game.current.evolvePlayed) evolveAll(goNext);
      else goNext();
    });
  }

  function onWrong(slot: number, T: { x: number; y: number }, firstPick: boolean) {
    const g = game.current;
    void firstPick;
    g.wrong += 1;
    g.retries += 1;
    g.combo = 0; // 콤보는 끊지만 코인/생명 차감은 없다
    setCombo(0);
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
    if (n >= 1 && n <= 3) tapSlot(n - 1);
  }

  function replayPrompt() {
    const cq = game.current.q;
    if (!cq) return;
    unlockAudio();
    void speak(cq.prompt, cq.dir === "toEng" ? "ko-KR" : "en-US", mutedRef.current);
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

  const moleSprite = (pose: Pose, ev: boolean): CSSProperties => {
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
      ["완료한 문제", `${ROUND_COUNT} / ${ROUND_COUNT}`],
      ["최초 정답", `${finalStats.firstTry}개`],
      ["최고 콤보", `${finalStats.bestCombo}`],
      ["재도전", `${finalStats.retries}번`],
      ["빈 곳 헛스윙", `${finalStats.whiffs}번`],
    ];
    const col = finalStats.evolved ? 0 : 0;
    const row = finalStats.evolved ? 1 : 0;
    const k = 0.34;
    return (
      <div ref={stageRef} style={stageBase} className="mg-stage flex items-center justify-center p-4">
        <MoleStyles />
        <div className="rounded-3xl bg-white/95 text-gray-800 px-8 py-6 w-full max-w-md flex flex-col items-center gap-3 shadow-2xl">
          <p className="text-3xl font-black text-amber-700">두더지 완료!</p>
          <div style={{ width: 301 * k + 20, height: 352 * k + 10, position: "relative" }}>
            <div
              style={{
                position: "absolute",
                left: -(70 * k) + 10,
                top: -(44 * k),
                width: 444 * k,
                height: 444 * k,
                backgroundImage: `url(${M}/moles.png)`,
                backgroundRepeat: "no-repeat",
                backgroundSize: `${MOLE_SHEET.w * k}px ${MOLE_SHEET.h * k}px`,
                backgroundPosition: `${-COLX[col] * k}px ${-ROWY[row] * k}px`,
              }}
            />
          </div>
          {finalStats.evolved && <p className="rounded-full bg-purple-100 text-purple-700 font-black px-4 py-1 text-base">🌟 진화 달성!</p>}
          <div className="w-full flex flex-col gap-1.5 text-lg font-bold">
            {rows.map(([kk, v]) => (
              <div key={kk} className="flex justify-between border-b border-gray-200 pb-1">
                <span className="text-gray-500">{kk}</span>
                <span>{v}</span>
              </div>
            ))}
            <div className="flex justify-between text-amber-600 text-xl pt-1">
              <span>획득 코인</span>
              <span>🪙 +{finalStats.coins}</span>
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
  const baseFs = clamp(MOLE_BODY_W * L.sm * 0.15, 18, 34);
  const labelFsFor = (label: string) => (label.includes(" ") ? baseFs : clamp(Math.min(baseFs, (MOLE_BODY_W * L.sm * 1.05) / Math.max(1, [...label].length * 0.62)), 13, baseFs));
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
      aria-label="두더지 잡기. 정답 단어가 쓰인 두더지를 눌러요. 키보드는 Tab으로 두더지를 고르고 Enter나 Space로 눌러요."
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
          [0, 1, 2].map((slot) => (
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
                      <div style={moleSprite(poses[slot], evolved)} />
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
                    className={hint && slot === q.correctSlot ? "mg-hint" : undefined}
                    style={{
                      position: "absolute",
                      left: 0,
                      top: -LABEL_UP[poses[slot]] * L.sm,
                      transform: "translate(-50%, -50%)",
                      transition: "top 90ms ease-out",
                      minWidth: MOLE_BODY_W * L.sm * 0.6,
                      maxWidth: MOLE_BODY_W * L.sm * 1.1,
                      padding: `${labelFsFor(q.options[slot].label) * 0.22}px ${labelFsFor(q.options[slot].label) * 0.55}px`,
                      borderRadius: labelFsFor(q.options[slot].label) * 0.9,
                      background: "#fff6dc",
                      border: "3px solid #d9b26a",
                      boxShadow: "0 3px 6px rgba(0,0,0,0.25)",
                      color: "#3a2410",
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
            style={{ position: "absolute", left: coinPop.x, top: coinPop.y, zIndex: 10, fontWeight: 900, fontSize: 22, color: "#ffe14a", textShadow: "0 2px 4px rgba(0,0,0,.6)" }}
          >
            🪙 +{COIN_PER_FIRST_TRY}
          </div>
        )}
      </div>

      {/* 상단 HUD */}
      <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: 48, zIndex: 20, paddingLeft: 12, paddingRight: 12 }} className="flex items-center justify-between gap-2">
        <button onClick={handleExit} className="mg-btn min-h-[44px] min-w-[44px] px-4 rounded-full bg-black/45 text-white font-bold text-base active:scale-95 transition">
          ✕ 나가기
        </button>
        <span className="rounded-full bg-black/45 px-4 py-2 text-base font-black">
          {Math.min(qIndex + 1, ROUND_COUNT)} / {ROUND_COUNT}
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
        </div>
      )}

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
        [0, 1, 2].map((slot) => (
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
          정답 단어가 쓰인 두더지를 톡!
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
                  정답 단어가 쓰인 두더지를 톡 눌러 잡아봐!
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
