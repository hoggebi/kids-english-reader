"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent, Ref } from "react";
import type { VocabWord } from "@/lib/types";
import { loadPet, getPetImagePath } from "@/lib/pet";
import { shuffle } from "./VocabGame";

// ---------------------------------------------------------------------------
// 다트 게임 v2 — 직접 조준해서 던지는 방식
//  - 한국어 ↔ 영어를 번갈아 출제 (방향 문구는 화면에 표시하지 않는다)
//  - 큰 다트판 하나에 표적 3개. 다트를 끌어서 조준 → 놓으면 그 지점으로 발사
//  - 표적 렌더링과 충돌 판정은 같은 정규화 좌표(TARGET_LAYOUT)를 쓴다
// ---------------------------------------------------------------------------

const A = "/assets/dart-game/v2";

// ---------- 설정값 ----------
const ROUND_COUNT = 10;
const COIN_COMPLETE = 10; // 10문제 완료 보상
const COIN_PER_FIRST_TRY = 2; // 최초 시도 정답당 보상
const AIM_OFFSET_KEY = "dartAimOffsetPx";
const AIM_OFFSET_DEFAULT = 40; // 손가락에 가려지지 않도록 조준점을 포인터보다 위로 띄우는 값(CSS px)
const AIM_OFFSET_MIN = 0;
const AIM_OFFSET_MAX = 100;
const AIM_OFFSET_STEP = 10;

const T_FLIGHT = 540;
const T_FLIGHT_REDUCED = 200;
const T_CELEBRATE = 800; // 정답 축하 연출
const T_WORD_CONFIRM = 1100; // 정답 단어 확인(최소)
const T_TRY_AGAIN = 1100; // 오답/빗나감 피드백 후 다트 복귀
const SPEECH_CAP_MS = 4500;

// ---------- 다트판 정규화 좌표 (다트판 중심 = 0,0 / 단위 = 다트판 지름) ----------
const TARGET_LAYOUT = [
  { u: 0, v: -0.225 },
  { u: -0.1949, v: 0.1125 },
  { u: 0.1949, v: 0.1125 },
] as const;
const TARGET_R = 0.175; // 화면에 보이는 표적 링 반지름
const HIT_R = TARGET_R * 1.03; // 판정 반지름 (표적끼리 겹치지 않는 범위)
const BOARD_R = 0.485; // board.png 바깥 원 반지름

// ---------- 스프라이트 아틀라스 (ASSET_MANIFEST.json 기준) ----------
// targets.png 2x2: 0 기본, 1 정답, 2 오답, 3 힌트. 링 중심은 셀마다 조금씩 달라 보정한다.
const TARGET_SHEET = { w: 1536, h: 1024, cellW: 768, cellH: 512, ring: 231, faceR: 166 };
const TARGET_CELLS = [
  { x: 0, y: 0, cx: 437.4, cy: 236 },
  { x: 768, y: 0, cx: 319, cy: 237 },
  { x: 0, y: 512, cx: 437, cy: 228 },
  { x: 768, y: 512, cx: 319, cy: 229 },
] as const;

type TState = "base" | "correct" | "wrong" | "hint";
const TCELL: Record<TState, number> = { base: 0, correct: 1, wrong: 2, hint: 3 };

// darts.png 2x2: 0 기본, 1 불꽃, 2 얼음, 3 번개 (위를 향함). tip = 다트 끝, pivY = 몸통 중심
type DartKind = "basic" | "fire" | "ice" | "lightning";
const DART_SHEET = { w: 1287, h: 1222 };
const DART_CELLS: Record<DartKind, { x: number; y: number; w: number; h: number; tipX: number; tipY: number; pivY: number }> = {
  basic: { x: 0, y: 0, w: 644, h: 611, tipX: 327.5, tipY: 36, pivY: 261.5 },
  fire: { x: 644, y: 0, w: 643, h: 611, tipX: 316.7, tipY: 37, pivY: 307 },
  ice: { x: 0, y: 611, w: 644, h: 611, tipX: 327.5, tipY: 21, pivY: 297 },
  lightning: { x: 644, y: 611, w: 643, h: 611, tipX: 316.6, tipY: 21, pivY: 297 },
};
const DART_BODY_LEN = 449; // 기본 다트 세로 길이(px, 원본)
const TRAIL_COLORS: Record<Exclude<DartKind, "basic">, string[]> = {
  fire: ["#ff7a1a", "#ffd23a", "#ff4a2a"],
  ice: ["#8fe3ff", "#ffffff", "#5db8ff"],
  lightning: ["#ffe14a", "#b58cff", "#ffffff"],
};

// hit_fx / retry_fx: 4열 x 2행, 프레임별 중심(불투명 영역 기준)을 맞춰 흔들림을 없앤다.
const FX_SHEET = { w: 1774, h: 887, frame: 443 };
type Frame = { x: number; y: number; cx: number; cy: number };
const COLX = [0, 444, 887, 1330];
const ROWY = [0, 444];
const HIT_FRAMES: Frame[] = [
  [232, 247.5], [218.5, 253.5], [205.5, 245], [203, 239.5],
  [224.5, 216.5], [218.5, 219.5], [210.5, 219], [200.5, 225.5],
].map(([cx, cy], i) => ({ x: COLX[i % 4], y: ROWY[Math.floor(i / 4)], cx, cy }));
const RETRY_FRAMES: Frame[] = [
  [238, 229.5], [230, 234], [223, 230.5], [205, 247],
  [229, 219], [225, 206], [229, 218], [216.5, 222],
].map(([cx, cy], i) => ({ x: COLX[i % 4], y: ROWY[Math.floor(i / 4)], cx, cy }));
const WRONG_FRAMES = RETRY_FRAMES.slice(0, 4); // 위 행 = 오답(산호색 연기)
const MISS_FRAMES = RETRY_FRAMES.slice(4); // 아래 행 = 빗나감(파란 슝)

const IMAGES = ["background", "board", "targets", "darts", "hit_fx", "retry_fx"].map((n) => `${A}/${n}.png`);

// ---------- 타입 ----------
type Direction = "toEng" | "toKor";
type Opt = { word: VocabWord; label: string };
type Question = { target: VocabWord; dir: Direction; prompt: string; options: Opt[]; correctSlot: number };
type Phase = "idle" | "aiming" | "flight" | "result";
type Banner = { text: string; sub?: string; tone: "good" | "try" | "miss"; key: number };
type Fx = { kind: "hit" | "wrong" | "miss"; u: number; v: number; key: number };
type Stuck = { u: number; v: number; angle: number; kind: DartKind; key: number };
type Stats = { firstTry: number; bestCombo: number; retries: number; coins: number };
type Layout = {
  w: number; h: number; qTop: number; qH: number; playTop: number; trayTop: number; trayH: number;
  bx: number; by: number; D: number; sd: number;
};

// ---------- 출제 ----------
function labelOf(w: VocabWord, dir: Direction) {
  return dir === "toEng" ? w.english : w.korean;
}
function promptOf(w: VocabWord, dir: Direction) {
  return dir === "toEng" ? w.korean : w.english;
}
const norm = (s: string) => s.trim().toLowerCase();

function buildQuestion(words: VocabWord[], target: VocabWord, dir: Direction): Question | null {
  const tl = norm(labelOf(target, dir));
  if (!tl) return null;
  const seen = new Set([tl]);
  const distractors: VocabWord[] = [];
  for (const w of shuffle(words.filter((x) => x.id !== target.id))) {
    const l = norm(labelOf(w, dir));
    if (!l || seen.has(l)) continue; // 같은 라벨이 두 번 보이지 않게
    seen.add(l);
    distractors.push(w);
    if (distractors.length === 2) break;
  }
  if (distractors.length < 2) return null;
  const options = shuffle([target, ...distractors]).map((word) => ({ word, label: labelOf(word, dir) }));
  return {
    target,
    dir,
    prompt: promptOf(target, dir),
    options,
    correctSlot: options.findIndex((o) => o.word.id === target.id),
  };
}

// 홀수 문제(1,3,..)는 한국어→영어, 짝수 문제(2,4,..)는 영어→한국어. 직전 단어는 가능한 피한다.
function buildQuestions(words: VocabWord[]): Question[] | null {
  const seenIds = new Set<string>();
  const valid = words.filter((w) => {
    if (seenIds.has(w.id) || !w.english?.trim() || !w.korean?.trim()) return false;
    seenIds.add(w.id);
    return true;
  });
  if (valid.length < 3) return null;
  const qs: Question[] = [];
  let bag: VocabWord[] = [];
  let prevId: string | null = null;
  for (let guard = 0; qs.length < ROUND_COUNT && guard < 200; guard++) {
    if (bag.length === 0) {
      bag = shuffle(valid);
      if (bag.length > 1 && bag[0].id === prevId) [bag[0], bag[bag.length - 1]] = [bag[bag.length - 1], bag[0]];
    }
    const target = bag.shift()!;
    const q = buildQuestion(valid, target, qs.length % 2 === 0 ? "toEng" : "toKor");
    if (!q) continue;
    qs.push(q);
    prevId = target.id;
  }
  return qs.length === ROUND_COUNT ? qs : null;
}

function kindForCombo(c: number): DartKind {
  if (c >= 7) return "lightning";
  if (c >= 5) return "ice";
  if (c >= 3) return "fire";
  return "basic";
}

// ---------- 레이아웃 ----------
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

function computeLayout(w: number, h: number): Layout {
  const qTop = 52;
  const qH = clamp(h * 0.09, 52, 72);
  const playTop = qTop + qH + 4;
  const trayH = clamp(h * 0.17, 96, 150);
  const trayTop = h - trayH;
  const availH = Math.max(120, trayTop - 4 - playTop);
  const D = Math.min(availH, w * 0.92);
  return {
    w, h, qTop, qH, playTop, trayTop, trayH,
    bx: w / 2,
    by: playTop + availH / 2,
    D,
    sd: (trayH * 0.72) / DART_BODY_LEN,
  };
}

// ---------- 좌표 / 다트 기하 (렌더에서도 쓰므로 순수 함수로 둔다) ----------
function toPx(L: Layout, u: number, v: number) {
  return { x: L.bx + u * L.D, y: L.by + v * L.D };
}
function toN(L: Layout, x: number, y: number) {
  return { u: (x - L.bx) / L.D, v: (y - L.by) / L.D };
}
function isValidAimAt(L: Layout, x: number, y: number) {
  return x >= 0 && x <= L.w && y >= L.playTop && y <= L.trayTop;
}
// 트레이 다트의 회전축(몸통 중심)
function pivotOf(L: Layout, kind: DartKind) {
  const c = DART_CELLS[kind];
  return { x: L.w / 2, y: L.trayTop + L.trayH * 0.08 + (c.pivY - c.tipY) * L.sd };
}
function angleFrom(L: Layout, kind: DartKind, x: number, y: number) {
  const p = pivotOf(L, kind);
  return clamp((Math.atan2(x - p.x, p.y - y) * 180) / Math.PI, -70, 70);
}
function tipAt(L: Layout, kind: DartKind, angleDeg: number) {
  const p = pivotOf(L, kind);
  const c = DART_CELLS[kind];
  const len = (c.pivY - c.tipY) * L.sd;
  const a = (angleDeg * Math.PI) / 180;
  return { x: p.x + Math.sin(a) * len, y: p.y - Math.cos(a) * len };
}

function spawnTrail(layer: HTMLDivElement | null, x: number, y: number, kind: Exclude<DartKind, "basic">) {
  if (!layer || typeof layer.animate !== "function") return;
  const colors = TRAIL_COLORS[kind];
  const d = document.createElement("div");
  const sz = 6 + Math.random() * 8;
  Object.assign(d.style, {
    position: "absolute",
    left: `${x - sz / 2}px`,
    top: `${y - sz / 2}px`,
    width: `${sz}px`,
    height: `${sz}px`,
    borderRadius: "50%",
    background: colors[Math.floor(Math.random() * colors.length)],
    boxShadow: `0 0 8px ${colors[0]}`,
    pointerEvents: "none",
  });
  layer.appendChild(d);
  const dx = (Math.random() - 0.5) * 24;
  const anim = d.animate(
    [{ opacity: 0.95, transform: "translate(0,0) scale(1)" }, { opacity: 0, transform: `translate(${dx}px, 22px) scale(0.2)` }],
    { duration: 420, easing: "ease-out" },
  );
  anim.onfinish = () => d.remove();
}

// 짧은 곡선 비행 + 회전 + 축소. 도착하면 onLand(최종 각도)를 한 번 호출한다. 반환값은 취소 함수.
function runFlight(o: {
  outer: HTMLDivElement;
  inner: HTMLDivElement;
  layer: HTMLDivElement | null;
  S: { x: number; y: number };
  a0: number;
  aimN: { u: number; v: number };
  getLayout: () => Layout;
  kind: DartKind;
  duration: number;
  reduced: boolean;
  onLand: (angle: number) => void;
}): () => void {
  const { outer, inner, S, a0, aimN, kind } = o;
  const t0 = performance.now();
  let raf = 0;
  let lastTrail = 0;
  let cancelled = false;
  outer.style.display = "block";
  const tick = (now: number) => {
    if (cancelled) return;
    const p = Math.min(1, (now - t0) / o.duration);
    const e = 1 - Math.pow(1 - p, 2);
    const E = toPx(o.getLayout(), aimN.u, aimN.v);
    const dist = Math.hypot(E.x - S.x, E.y - S.y);
    const arc = o.reduced ? 0 : Math.min(dist * 0.22, 90);
    const C = { x: (S.x + E.x) / 2, y: (S.y + E.y) / 2 - arc };
    const x = (1 - e) * (1 - e) * S.x + 2 * (1 - e) * e * C.x + e * e * E.x;
    const y = (1 - e) * (1 - e) * S.y + 2 * (1 - e) * e * C.y + e * e * E.y;
    const tx = 2 * (1 - e) * (C.x - S.x) + 2 * e * (E.x - C.x);
    const ty = 2 * (1 - e) * (C.y - S.y) + 2 * e * (E.y - C.y);
    const heading = (Math.atan2(tx, -ty) * 180) / Math.PI;
    const angle = a0 + (heading - a0) * Math.min(1, p * 4);
    outer.style.transform = `translate(${x}px, ${y}px)`;
    inner.style.transform = `rotate(${angle}deg) scale(${1 - 0.38 * e})`;
    if (kind !== "basic" && !o.reduced && now - lastTrail > 28) {
      lastTrail = now;
      spawnTrail(o.layer, x, y, kind);
    }
    if (p < 1) {
      raf = requestAnimationFrame(tick);
    } else {
      outer.style.display = "none";
      o.onLand(angle);
    }
  };
  raf = requestAnimationFrame(tick);
  return () => {
    cancelled = true;
    cancelAnimationFrame(raf);
  };
}

function readAimOffset() {
  try {
    const raw = window.localStorage.getItem(AIM_OFFSET_KEY);
    const n = Number(raw);
    if (raw !== null && Number.isFinite(n)) return clamp(n, AIM_OFFSET_MIN, AIM_OFFSET_MAX);
  } catch {
    /* localStorage를 못 써도 기본값으로 진행 */
  }
  return AIM_OFFSET_DEFAULT;
}

// ---------- 소리 / 음성 ----------
let sharedCtx: AudioContext | null = null;
function audioCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!sharedCtx) {
    const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    try {
      sharedCtx = new Ctor();
    } catch {
      return null;
    }
  }
  return sharedCtx;
}
function unlockAudio() {
  try {
    const c = audioCtx();
    if (c && c.state === "suspended") void c.resume();
  } catch {
    /* 오디오를 못 써도 게임은 진행된다 */
  }
}
function playSfx(kind: "throw" | "correct" | "wrong" | "miss", muted: boolean) {
  if (muted) return;
  try {
    const c = audioCtx();
    if (!c) return;
    const now = c.currentTime;
    const tone = (type: OscillatorType, freqs: [number, number][], dur: number, vol: number) => {
      const osc = c.createOscillator();
      const g = c.createGain();
      osc.type = type;
      osc.connect(g);
      g.connect(c.destination);
      freqs.forEach(([t, f], i) => (i === 0 ? osc.frequency.setValueAtTime(f, now + t) : osc.frequency.linearRampToValueAtTime(f, now + t)));
      g.gain.setValueAtTime(vol, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + dur);
      osc.start(now);
      osc.stop(now + dur);
    };
    if (kind === "throw") tone("sine", [[0, 420], [0.18, 880]], 0.2, 0.05);
    else if (kind === "correct") tone("triangle", [[0, 523], [0.1, 784], [0.2, 1046]], 0.38, 0.14);
    else if (kind === "wrong") tone("triangle", [[0, 360], [0.16, 240]], 0.22, 0.1); // 장난스러운 "뽀잉"
    else tone("sine", [[0, 700], [0.22, 320]], 0.24, 0.05);
  } catch {
    /* ignore */
  }
}

function speak(text: string, lang: "ko-KR" | "en-US", muted: boolean): Promise<void> {
  return new Promise((resolve) => {
    if (muted || typeof window === "undefined" || !("speechSynthesis" in window)) {
      resolve();
      return;
    }
    try {
      const synth = window.speechSynthesis;
      synth.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = lang;
      u.rate = lang === "en-US" ? 0.85 : 0.95;
      const voices = synth.getVoices();
      const v =
        voices.find((x) => x.lang.replace("_", "-").toLowerCase() === lang.toLowerCase()) ??
        voices.find((x) => x.lang.toLowerCase().startsWith(lang.slice(0, 2).toLowerCase()));
      if (v) u.voice = v;
      let done = false;
      const fin = () => {
        if (done) return;
        done = true;
        clearTimeout(to);
        resolve();
      };
      const to = setTimeout(fin, SPEECH_CAP_MS);
      u.onend = fin;
      u.onerror = fin;
      synth.speak(u);
    } catch {
      resolve();
    }
  });
}

// ---------- 하위 컴포넌트 ----------
function DartSprite({
  kind, sd, x, y, angle, k, origin, outerRef, innerRef, style,
}: {
  kind: DartKind; sd: number; x: number; y: number; angle: number; k: number; origin: "tip" | "pivot";
  outerRef?: Ref<HTMLDivElement>; innerRef?: Ref<HTMLDivElement>; style?: CSSProperties;
}) {
  const c = DART_CELLS[kind];
  const oy = origin === "tip" ? c.tipY : c.pivY;
  return (
    <div
      ref={outerRef}
      style={{ position: "absolute", left: 0, top: 0, pointerEvents: "none", transform: `translate(${x}px, ${y}px)`, ...style }}
    >
      <div ref={innerRef} style={{ transformOrigin: "0 0", transform: `rotate(${angle}deg) scale(${k})` }}>
        <div
          style={{
            position: "absolute",
            left: -c.tipX * sd,
            top: -oy * sd,
            width: c.w * sd,
            height: c.h * sd,
            backgroundImage: `url(${A}/darts.png)`,
            backgroundRepeat: "no-repeat",
            backgroundSize: `${DART_SHEET.w * sd}px ${DART_SHEET.h * sd}px`,
            backgroundPosition: `${-c.x * sd}px ${-c.y * sd}px`,
          }}
        />
      </div>
    </div>
  );
}

// 스프라이트 시트를 처음부터 끝까지 한 번만 재생하고 onEnd로 제거를 알린다.
function SpriteFx({
  src, frames, x, y, size, duration, onEnd,
}: {
  src: string; frames: Frame[]; x: number; y: number; size: number; duration: number; onEnd: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const endRef = useRef(onEnd);
  useEffect(() => {
    endRef.current = onEnd;
  });
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
      else endRef.current();
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [frames, x, y, s, duration]);
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
        backgroundImage: `url(${src})`,
        backgroundRepeat: "no-repeat",
        backgroundSize: `${FX_SHEET.w * s}px ${FX_SHEET.h * s}px`,
      }}
    />
  );
}

function DartStyles() {
  return (
    <style>{`
      @keyframes dgPop { 0% { transform: scale(0.6); opacity: 0; } 60% { transform: scale(1.12); opacity: 1; } 100% { transform: scale(1); opacity: 1; } }
      @keyframes dgRespawn { 0% { transform: translateY(60px) scale(0.7); opacity: 0; } 100% { transform: translateY(0) scale(1); opacity: 1; } }
      @keyframes dgHint { 0%, 100% { filter: brightness(1); } 50% { filter: brightness(1.35) drop-shadow(0 0 10px #ffd84a); } }
      @keyframes dgNudge { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-6px); } }
      .dg-pop { animation: dgPop 0.35s ease-out both; }
      .dg-respawn { animation: dgRespawn 0.32s ease-out both; }
      .dg-hint { animation: dgHint 1s ease-in-out infinite; }
      .dg-nudge { animation: dgNudge 1.4s ease-in-out infinite; }
      .dg-stage:focus-visible { outline: 4px solid #ffd84a; outline-offset: -4px; }
      .dg-btn:focus-visible { outline: 3px solid #ffd84a; outline-offset: 2px; }
      @media (prefers-reduced-motion: reduce) {
        .dg-pop, .dg-respawn, .dg-hint, .dg-nudge { animation: none; }
      }
    `}</style>
  );
}

// ---------- 메인 ----------
export default function DartGame({
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
  const [pet] = useState(() => loadPet("vocab"));
  const [questions] = useState<Question[] | null>(() => buildQuestions(words));
  const leave = onExit ?? onDone;

  const stageRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 1024, h: 768 });
  const layout = useMemo(() => computeLayout(size.w, size.h), [size]);
  const layoutRef = useRef(layout);

  const [loaded, setLoaded] = useState(false);
  const [stage, setStage] = useState<"intro" | "play" | "result">("intro");
  const [qIndex, setQIndex] = useState(0);
  const [phase, setPhaseState] = useState<Phase>("idle");
  const phaseRef = useRef<Phase>("idle");
  const setPhase = (p: Phase) => {
    phaseRef.current = p;
    setPhaseState(p);
  };

  const [tstates, setTstates] = useState<TState[]>(["base", "base", "base"]);
  const [hintOn, setHintOn] = useState(false);
  const [combo, setCombo] = useState(0);
  const [dartKind, setDartKind] = useState<DartKind>("basic");
  const [dartKey, setDartKey] = useState(0);
  const [trayHidden, setTrayHidden] = useState(false);
  const [stuck, setStuck] = useState<Stuck | null>(null);
  const [fx, setFx] = useState<Fx | null>(null);
  const [banner, setBanner] = useState<Banner | null>(null);
  const [reveal, setReveal] = useState<{ english: string; korean: string } | null>(null);
  const [aim, setAim] = useState<{ x: number; y: number; valid: boolean; angle: number } | null>(null);
  const [kbAim, setKbAim] = useState<{ x: number; y: number } | null>(null);
  const [muted, setMuted] = useState(false);
  const mutedRef = useRef(false);
  const [reduced, setReduced] = useState(false);
  const reducedRef = useRef(false);
  const [aimOffset, setAimOffset] = useState(readAimOffset);
  const aimOffsetRef = useRef(aimOffset);
  const [q, setQ] = useState<Question | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showHelp, setShowHelp] = useState(true); // 첫 던지기 전까지만 하단 안내를 보여준다
  const [finalStats, setFinalStats] = useState<Stats | null>(null);

  const game = useRef({
    q: null as Question | null,
    wrong: 0,
    hint: false,
    missStreak: 0,
    combo: 0,
    bestCombo: 0,
    firstTry: 0,
    wrongAttempts: 0,
    misses: 0,
    kind: "basic" as DartKind,
    finished: false,
  });
  const token = useRef(0);
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>());
  const cancelFlight = useRef<(() => void) | null>(null);
  const stuckInfo = useRef({ u: 0, v: 0, angle: 0 });
  const keySeq = useRef(0);
  const nextKey = () => ++keySeq.current;

  const aimRef = useRef({ active: false, pointerId: -1, entered: false, x: 0, y: 0 });
  const downPointers = useRef(new Set<number>());
  const kbAimRef = useRef<{ x: number; y: number } | null>(null);

  const flyOuter = useRef<HTMLDivElement>(null);
  const flyInner = useRef<HTMLDivElement>(null);
  const trailLayer = useRef<HTMLDivElement>(null);
  const stuckOuter = useRef<HTMLDivElement>(null);
  const stuckInner = useRef<HTMLDivElement>(null);
  const targetEls = useRef<(HTMLDivElement | null)[]>([null, null, null]);
  const labelEls = useRef<(HTMLDivElement | null)[]>([null, null, null]);

  // ---------- 조준 취소 (포인터 취소/화면 이탈/멀티터치/크기 변경 등에서 발사 없이 복귀) ----------
  function cancelAim() {
    const a = aimRef.current;
    const was = a.active;
    a.active = false;
    a.entered = false;
    setAim(null);
    if (was && phaseRef.current === "aiming") setPhase("idle");
  }

  useLayoutEffect(() => {
    layoutRef.current = layout;
  }, [layout]);

  // ---------- 초기 설정: 감소된 모션, 이미지 프리로드, 크기 관찰 ----------
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => {
      reducedRef.current = mq.matches;
      setReduced(mq.matches);
    };
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    let cancelled = false;
    let left = IMAGES.length;
    const finish = () => {
      if (!cancelled) setLoaded(true);
    };
    const fallback = setTimeout(finish, 8000);
    IMAGES.forEach((src) => {
      const img = new Image();
      img.onload = img.onerror = () => {
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

  // 화면 크기/방향이 바뀌면 조준 중이던 입력은 취소한다.
  useEffect(() => {
    if (aimRef.current.active) cancelAim();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size.w, size.h]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const hide = () => {
      if (document.hidden) cancelAim();
    };
    document.addEventListener("visibilitychange", hide);
    window.addEventListener("blur", cancelAim);
    const timerSet = timers.current;
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("visibilitychange", hide);
      window.removeEventListener("blur", cancelAim);
      token.current += 1;
      timerSet.forEach(clearTimeout);
      timerSet.clear();
      cancelFlight.current?.();
      try {
        window.speechSynthesis?.cancel();
      } catch {
        /* ignore */
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------- 타이머 (질문이 바뀌면 이전 타이머는 무시) ----------
  function later(ms: number, fn: () => void) {
    const tk = token.current;
    const id = setTimeout(() => {
      timers.current.delete(id);
      if (token.current === tk) fn();
    }, ms);
    timers.current.add(id);
  }
  function delay(ms: number) {
    return new Promise<void>((r) => setTimeout(r, ms));
  }

  // ---------- 좌표 변환 (이벤트 시점의 최신 레이아웃/다트 종류 사용) ----------
  const isValidAim = (x: number, y: number) => isValidAimAt(layoutRef.current, x, y);
  const angleToward = (x: number, y: number) => angleFrom(layoutRef.current, game.current.kind, x, y);

  // ---------- 문제 시작 ----------
  function startQuestion(i: number) {
    if (!questions) return;
    token.current += 1;
    timers.current.forEach(clearTimeout);
    timers.current.clear();
    cancelFlight.current?.();
    const g = game.current;
    const q = questions[i];
    g.q = q;
    setQ(q);
    g.wrong = 0;
    g.hint = false;
    g.missStreak = 0;
    g.kind = kindForCombo(g.combo);
    setQIndex(i);
    setTstates(["base", "base", "base"]);
    setHintOn(false);
    setStuck(null);
    setFx(null);
    setBanner(null);
    setReveal(null);
    setAim(null);
    setDartKind(g.kind);
    setDartKey((k) => k + 1);
    setTrayHidden(false);
    setPhase("idle");
    if (flyOuter.current) flyOuter.current.style.display = "none";
    later(350, () => void speak(q.prompt, q.dir === "toEng" ? "ko-KR" : "en-US", mutedRef.current));
  }

  function start() {
    unlockAudio();
    try {
      // iOS에서 이후 음성이 나오도록 첫 사용자 조작 안에서 무음 발화를 한 번 실행
      const w = new SpeechSynthesisUtterance("");
      w.volume = 0;
      window.speechSynthesis?.speak(w);
    } catch {
      /* ignore */
    }
    setStage("play");
    startQuestion(0);
    requestAnimationFrame(() => stageRef.current?.focus({ preventScroll: true }));
  }

  function nextQuestion() {
    const i = qIndex + 1;
    if (i >= ROUND_COUNT) {
      const g = game.current;
      g.finished = true;
      setFinalStats({
        firstTry: g.firstTry,
        bestCombo: g.bestCombo,
        retries: g.wrongAttempts,
        coins: COIN_COMPLETE + COIN_PER_FIRST_TRY * g.firstTry,
      });
      token.current += 1;
      setStage("result");
      return;
    }
    startQuestion(i);
  }

  // ---------- 조준 ----------
  function stagePoint(e: { clientX: number; clientY: number }) {
    const r = stageRef.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  function updateAim(e: { clientX: number; clientY: number }) {
    const p = stagePoint(e);
    const x = p.x;
    const y = p.y - aimOffsetRef.current; // 손가락에 가려지지 않게 위로 보정 (판정에도 동일하게 적용)
    const valid = isValidAim(x, y);
    const a = aimRef.current;
    a.x = x;
    a.y = y;
    if (valid) a.entered = true;
    setAim({ x, y, valid, angle: angleToward(x, y) });
  }

  function onDartPointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    if (phaseRef.current !== "idle" || !e.isPrimary) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;
    if (downPointers.current.size > 1) return; // 다른 손가락이 이미 눌려 있으면 시작하지 않는다
    e.preventDefault();
    unlockAudio();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    kbAimRef.current = null;
    setKbAim(null);
    aimRef.current = { active: true, pointerId: e.pointerId, entered: false, x: 0, y: 0 };
    setPhase("aiming");
    updateAim(e);
  }
  function onDartPointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    const a = aimRef.current;
    if (!a.active || e.pointerId !== a.pointerId) return;
    updateAim(e);
  }
  function onDartPointerUp(e: ReactPointerEvent<HTMLDivElement>) {
    const a = aimRef.current;
    if (!a.active || e.pointerId !== a.pointerId) return;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    const p = stagePoint(e);
    const x = p.x;
    const y = p.y - aimOffsetRef.current;
    const ok = isValidAim(x, y); // 유효한 조준 영역에서 놓았을 때만 발사 (제자리 탭은 트레이 안이라 취소)
    a.active = false;
    setAim(null);
    if (ok) launch(x, y);
    else cancelAim(); // 살짝 탭했거나 영역 밖에서 놓으면 발사하지 않고 복귀
  }
  function onDartPointerCancel(e: ReactPointerEvent<HTMLDivElement>) {
    if (aimRef.current.pointerId === e.pointerId) cancelAim();
  }
  function onDartLostCapture(e: ReactPointerEvent<HTMLDivElement>) {
    if (aimRef.current.active && aimRef.current.pointerId === e.pointerId) cancelAim();
  }

  // 멀티터치: 조준 중 두 번째 포인터가 들어오면 취소
  function onStagePointerDownCapture(e: ReactPointerEvent<HTMLDivElement>) {
    downPointers.current.add(e.pointerId);
    if (aimRef.current.active && e.pointerId !== aimRef.current.pointerId) cancelAim();
  }
  function onStagePointerEndCapture(e: ReactPointerEvent<HTMLDivElement>) {
    downPointers.current.delete(e.pointerId);
  }

  // ---------- 키보드 조준 ----------
  function onStageKeyDown(e: ReactKeyboardEvent<HTMLDivElement>) {
    if (stage !== "play" || phaseRef.current !== "idle") return;
    if (e.target !== e.currentTarget) return; // 버튼 위에서는 버튼 고유 동작 유지
    const L = layoutRef.current;
    const step = e.shiftKey ? 48 : 24;
    const dir: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step],
    };
    if (dir[e.key]) {
      e.preventDefault();
      const cur = kbAimRef.current ?? { x: L.bx, y: L.by };
      const next = {
        x: clamp(cur.x + dir[e.key][0], 0, L.w),
        y: clamp(cur.y + dir[e.key][1], L.playTop, L.trayTop),
      };
      kbAimRef.current = next;
      setKbAim(next);
    } else if ((e.key === " " || e.key === "Enter") && kbAimRef.current) {
      e.preventDefault();
      const p = kbAimRef.current;
      kbAimRef.current = null;
      setKbAim(null);
      launch(p.x, p.y);
    } else if (e.key === "Escape") {
      kbAimRef.current = null;
      setKbAim(null);
    }
  }

  // ---------- 발사 ----------
  function launch(ax: number, ay: number) {
    if (phaseRef.current !== "aiming" && phaseRef.current !== "idle") return; // 한 번의 투척이 두 번 처리되지 않게
    const g = game.current;
    if (!g.q || g.finished) return;
    setPhase("flight");
    setShowHelp(false);
    setAim(null);
    setTrayHidden(true);
    playSfx("throw", mutedRef.current);

    const L = layoutRef.current;
    const aimN = toN(L, ax, ay);
    const a0 = angleFrom(L, g.kind, ax, ay);
    const kind = g.kind;
    const outer = flyOuter.current;
    const inner = flyInner.current;
    if (!outer || !inner) {
      land(aimN, a0, kind);
      return;
    }
    cancelFlight.current = runFlight({
      outer,
      inner,
      layer: trailLayer.current,
      S: tipAt(L, kind, a0),
      a0,
      aimN,
      getLayout: () => layoutRef.current,
      kind,
      duration: reducedRef.current ? T_FLIGHT_REDUCED : T_FLIGHT,
      reduced: reducedRef.current,
      onLand: (angle) => land(aimN, angle, kind),
    });
  }

  // ---------- 도착 후 판정 ----------
  function land(aimN: { u: number; v: number }, angle: number, kind: DartKind) {
    const g = game.current;
    const q = g.q;
    if (!q) return;
    setPhase("result");
    stuckInfo.current = { u: aimN.u, v: aimN.v, angle };
    setStuck({ u: aimN.u, v: aimN.v, angle, kind, key: nextKey() });

    let hit = -1;
    let best = Infinity;
    TARGET_LAYOUT.forEach((t, i) => {
      const d = Math.hypot(aimN.u - t.u, aimN.v - t.v);
      if (d <= HIT_R && d < best) {
        best = d;
        hit = i;
      }
    });
    const insideBoard = Math.hypot(aimN.u, aimN.v) <= BOARD_R;

    if (hit < 0) onMiss(aimN, insideBoard);
    else if (q.options[hit].word.id === q.target.id) onCorrect(hit, aimN);
    else onWrong(hit, aimN);
  }

  function animateTarget(i: number, kind: "shake" | "pulse") {
    if (reducedRef.current) return;
    [targetEls.current[i], labelEls.current[i]].forEach((el) => {
    if (!el || typeof el.animate !== "function") return;
    if (kind === "shake") {
      el.animate(
        [
          { transform: "translateX(0) rotate(0)" }, { transform: "translateX(-9px) rotate(-3deg)" },
          { transform: "translateX(8px) rotate(3deg)" }, { transform: "translateX(-5px) rotate(-2deg)" },
          { transform: "translateX(0) rotate(0)" },
        ],
        { duration: 420, easing: "ease-out" },
      );
    } else {
      el.animate([{ transform: "scale(1)" }, { transform: "scale(1.14)" }, { transform: "scale(1)" }], {
        duration: 420,
        easing: "ease-out",
      });
    }
    });
  }

  function dropStuckDart() {
    const o = stuckOuter.current;
    const inn = stuckInner.current;
    if (!o || reducedRef.current || typeof o.animate !== "function") {
      setStuck(null);
      return;
    }
    const si = stuckInfo.current;
    const p = toPx(layoutRef.current, si.u, si.v);
    const s = { x: p.x, y: p.y, angle: si.angle };
    o.animate(
      [
        { transform: `translate(${s.x}px, ${s.y}px)`, opacity: 1 },
        { transform: `translate(${s.x + 14}px, ${s.y + 170}px)`, opacity: 0 },
      ],
      { duration: 520, easing: "cubic-bezier(.5,0,1,.6)", fill: "forwards" },
    );
    inn?.animate(
      [
        { transform: `rotate(${s.angle}deg) scale(0.62)` },
        { transform: `rotate(${s.angle + 40}deg) scale(0.62)` },
      ],
      { duration: 520, easing: "ease-in", fill: "forwards" },
    );
  }

  function respawnAfter(ms: number) {
    later(ms, () => {
      setStuck(null);
      setFx(null);
      setBanner(null);
      setTstates(["base", "base", "base"]);
      setDartKey((k) => k + 1);
      setTrayHidden(false);
      setPhase("idle");
      const q = game.current.q;
      if (q && game.current.missStreak >= 2) setShowHelp(true); // 반복 빗나감: 조준 안내 다시 표시
    });
  }

  function onCorrect(slot: number, aimN: { u: number; v: number }) {
    const g = game.current;
    const q = g.q!;
    const usedHint = g.hint;
    if (g.wrong === 0) g.firstTry += 1;
    if (!usedHint) {
      g.combo += 1; // 힌트로 맞힌 정답은 콤보를 올리지 않는다
      g.bestCombo = Math.max(g.bestCombo, g.combo);
    }
    g.missStreak = 0;
    setCombo(g.combo);
    setTstates((prev) => prev.map((s, i) => (i === slot ? "correct" : s)));
    setHintOn(false);
    setFx({ kind: "hit", u: TARGET_LAYOUT[slot].u, v: TARGET_LAYOUT[slot].v, key: nextKey() });
    animateTarget(slot, "pulse");
    setBanner({ text: "명중!", tone: "good", key: nextKey() });
    setReveal({ english: q.target.english, korean: q.target.korean });
    playSfx("correct", mutedRef.current);
    void aimN;

    const tk = token.current;
    const spoken = speak(q.target.english, "en-US", mutedRef.current);
    void Promise.all([delay(T_CELEBRATE + T_WORD_CONFIRM), spoken]).then(() => {
      if (token.current === tk && !game.current.finished) nextQuestion();
    });
  }

  function onWrong(slot: number, aimN: { u: number; v: number }) {
    const g = game.current;
    g.wrong += 1;
    g.wrongAttempts += 1;
    g.combo = 0; // 콤보는 끊지만 생명/점수 감소는 없다
    g.missStreak = 0;
    setCombo(0);
    setTstates((prev) => prev.map((s, i) => (i === slot ? "wrong" : s)));
    setFx({ kind: "wrong", u: aimN.u, v: aimN.v, key: nextKey() });
    animateTarget(slot, "shake");
    playSfx("wrong", mutedRef.current);
    let sub: string | undefined;
    if (g.wrong >= 2 && !g.hint) {
      g.hint = true; // 같은 문제에서 두 번 틀리면 힌트(자동 정답 처리는 없음)
      setHintOn(true);
      sub = "힌트! 반짝이는 표적을 봐!";
    } else if (g.hint) {
      sub = "힌트! 반짝이는 표적을 봐!";
    }
    setBanner({ text: "한 번 더!", sub, tone: "try", key: nextKey() });
    later(260, dropStuckDart); // 잠깐 닿았다가 툭 떨어짐
    respawnAfter(T_TRY_AGAIN);
  }

  function onMiss(aimN: { u: number; v: number }, insideBoard: boolean) {
    const g = game.current;
    g.misses += 1;
    g.missStreak += 1;
    setFx({ kind: "miss", u: aimN.u, v: aimN.v, key: nextKey() });
    playSfx("miss", mutedRef.current);
    setBanner({
      text: "조금만 옆으로!",
      sub: g.missStreak >= 2 ? "다트를 끌어서 겨냥하고, 손을 놓아 던져봐!" : undefined,
      tone: "miss",
      key: nextKey(),
    });
    // 판에 꽂힌 채 잠시 남거나, 판 밖이면 옆으로 빠진다
    later(insideBoard ? 650 : 120, dropStuckDart);
    respawnAfter(T_TRY_AGAIN);
  }

  // ---------- 다시 듣기 / 음소거 / 설정 ----------
  function replayPrompt() {
    const q = game.current.q;
    if (!q) return;
    unlockAudio();
    void speak(q.prompt, q.dir === "toEng" ? "ko-KR" : "en-US", mutedRef.current);
  }
  function toggleMute() {
    const m = !mutedRef.current;
    mutedRef.current = m;
    setMuted(m);
    if (m) {
      try {
        window.speechSynthesis?.cancel();
      } catch {
        /* ignore */
      }
    }
  }
  function changeAimOffset(delta: number) {
    const v = clamp(aimOffsetRef.current + delta, AIM_OFFSET_MIN, AIM_OFFSET_MAX);
    aimOffsetRef.current = v;
    setAimOffset(v);
    try {
      window.localStorage.setItem(AIM_OFFSET_KEY, String(v));
    } catch {
      /* ignore */
    }
  }
  function handleExit() {
    token.current += 1;
    try {
      window.speechSynthesis?.cancel();
    } catch {
      /* ignore */
    }
    leave();
  }

  // ---------- 렌더 ----------
  const L = layout;
  const ringD = 2 * TARGET_R * L.D;
  const ts = ringD / (2 * TARGET_SHEET.ring); // 표적 아틀라스 배율
  const faceD = 2 * TARGET_SHEET.faceR * ts;

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
    backgroundColor: "#2b5a2f",
    backgroundImage: `url(${A}/background.png)`,
    backgroundSize: "cover",
    backgroundPosition: "center",
    color: "#fff",
  };

  if (!questions) {
    return (
      <div ref={stageRef} style={stageBase} className="dg-stage flex items-center justify-center p-6">
        <DartStyles />
        <div className="rounded-3xl bg-white/95 text-gray-800 px-8 py-8 max-w-md text-center flex flex-col gap-4 shadow-xl">
          <p className="text-2xl font-black">단어가 조금 부족해요</p>
          <p className="text-base text-gray-600">다트 게임은 서로 다른 단어가 3개 이상 필요해요. 단어를 더 공부하고 다시 도전해요!</p>
          <button onClick={handleExit} className="dg-btn min-h-[48px] rounded-full bg-sky-600 text-white font-bold text-lg">
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
    ];
    return (
      <div ref={stageRef} style={stageBase} className="dg-stage flex items-center justify-center p-4">
        <DartStyles />
        <div className="rounded-3xl bg-white/95 text-gray-800 px-8 py-7 w-full max-w-md flex flex-col items-center gap-4 shadow-2xl">
          <p className="text-3xl font-black text-sky-700">다트 완료!</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={getPetImagePath(pet, "vocab")} alt="캐릭터" className="w-20 h-20 object-contain" />
          <div className="w-full flex flex-col gap-2 text-lg font-bold">
            {rows.map(([k, v]) => (
              <div key={k} className="flex justify-between border-b border-gray-200 pb-1.5">
                <span className="text-gray-500">{k}</span>
                <span>{v}</span>
              </div>
            ))}
            <div className="flex justify-between text-amber-600 text-xl pt-1">
              <span>획득 코인</span>
              <span>🪙 +{finalStats.coins}</span>
            </div>
          </div>
          <div className="flex gap-3 w-full">
            <button onClick={onRetry} className="dg-btn flex-1 min-h-[52px] rounded-full bg-gray-200 text-gray-800 font-bold text-lg active:scale-95 transition">
              다시하기
            </button>
            <button onClick={onDone} className="dg-btn flex-1 min-h-[52px] rounded-full bg-sky-600 text-white font-bold text-lg active:scale-95 transition">
              나가기
            </button>
          </div>
        </div>
      </div>
    );
  }

  const trayCx = L.w / 2;
  const trayPivotY = pivotOf(L, dartKind).y;
  const trayAngle = aim ? aim.angle : 0;
  const showTray = stage === "play" && !trayHidden;
  const crosshair = aim ?? (kbAim ? { x: kbAim.x, y: kbAim.y, valid: true, angle: angleFrom(L, dartKind, kbAim.x, kbAim.y) } : null);

  // 꽂힌 다트 위치(떨어뜨리기 애니메이션이 같은 값을 쓴다)
  const stuckPx = stuck ? toPx(L, stuck.u, stuck.v) : null;

  const dispState = (i: number): TState => {
    const s = tstates[i];
    if (s === "base" && hintOn && q && i === q.correctSlot) return "hint";
    return s;
  };

  const revealLen = reveal ? [...reveal.english].length + [...reveal.korean].length + 3 : 1;
  const revealFs = clamp(Math.min(L.trayH * 0.2, ((L.w * 0.9 - 60) / revealLen) * 1.05), 14, 26);
  const fxPx = fx ? toPx(L, fx.u, fx.v) : null;
  const fxSize = fx?.kind === "hit" ? ringD * 1.55 : ringD * 1.15;

  return (
    <div
      ref={stageRef}
      style={stageBase}
      className="dg-stage"
      role="group"
      aria-label="다트 게임. 다트를 끌어서 정답 표적을 겨냥하고 손을 놓으면 던져요. 키보드는 화살표로 조준하고 스페이스로 던져요."
      tabIndex={0}
      onKeyDown={onStageKeyDown}
      onPointerDownCapture={onStagePointerDownCapture}
      onPointerUpCapture={onStagePointerEndCapture}
      onPointerCancelCapture={onStagePointerEndCapture}
      onContextMenu={(e) => e.preventDefault()}
    >
      <DartStyles />

      {/* 읽어주는 결과 알림 */}
      <div role="status" aria-live="polite" className="sr-only">
        {banner ? `${banner.text} ${banner.sub ?? ""}` : ""}
      </div>

      {/* 다트판 */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`${A}/board.png`}
        alt=""
        draggable={false}
        style={{ position: "absolute", left: L.bx - L.D / 2, top: L.by - L.D / 2, width: L.D, height: L.D, objectFit: "contain", pointerEvents: "none" }}
      />

      {/* 표적 3개 */}
      {loaded &&
        q &&
        TARGET_LAYOUT.map((t, i) => {
          const st = dispState(i);
          const cell = TARGET_CELLS[TCELL[st]];
          const cx = L.bx + t.u * L.D;
          const cy = L.by + t.v * L.D;
          const label = q.options[i].label;
          const len = [...label].length;
          const fs = Math.max(13, faceD * (len <= 6 ? 0.21 : len <= 9 ? 0.17 : 0.14));
          const box: CSSProperties = { position: "absolute", left: cx - ringD / 2, top: cy - ringD / 2, width: ringD, height: ringD, pointerEvents: "none" };
          return (
            <div key={i}>
            <div
              ref={(el) => {
                targetEls.current[i] = el;
              }}
              className={st === "hint" ? "dg-hint" : undefined}
              style={{ ...box, zIndex: 1 }}
            >
              <div
                style={{
                  position: "absolute",
                  left: ringD / 2 - cell.cx * ts,
                  top: ringD / 2 - cell.cy * ts,
                  width: TARGET_SHEET.cellW * ts,
                  height: TARGET_SHEET.cellH * ts,
                  backgroundImage: `url(${A}/targets.png)`,
                  backgroundRepeat: "no-repeat",
                  backgroundSize: `${TARGET_SHEET.w * ts}px ${TARGET_SHEET.h * ts}px`,
                  backgroundPosition: `${-cell.x * ts}px ${-cell.y * ts}px`,
                }}
              />
              {st === "hint" && (
                <span
                  className="dg-nudge"
                  style={{
                    position: "absolute",
                    left: "50%",
                    top: -4,
                    transform: "translateX(-50%)",
                    background: "#ffd84a",
                    color: "#4a3200",
                    fontWeight: 900,
                    fontSize: 15,
                    padding: "2px 10px",
                    borderRadius: 999,
                    zIndex: 4,
                  }}
                >
                  힌트
                </span>
              )}
            </div>
            <div
              ref={(el) => {
                labelEls.current[i] = el;
              }}
              style={{ ...box, zIndex: 3, display: "flex", alignItems: "center", justifyContent: "center" }}
            >
              <span
                style={{
                  maxWidth: faceD * 0.88,
                  textAlign: "center",
                  fontWeight: 900,
                  fontSize: fs,
                  lineHeight: 1.1,
                  color: "#3a2410",
                  wordBreak: "keep-all",
                  overflowWrap: "anywhere",
                }}
              >
                {label}
              </span>
            </div>
            </div>
          );
        })}

      {/* 효과 프레임 (표적 라벨 뒤, 한 번만 재생) */}
      {fx && fxPx && (
        <div style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 2 }}>
          <SpriteFx
            key={fx.key}
            src={`${A}/${fx.kind === "hit" ? "hit_fx" : "retry_fx"}.png`}
            frames={
              reduced
                ? [fx.kind === "hit" ? HIT_FRAMES[2] : fx.kind === "wrong" ? WRONG_FRAMES[1] : MISS_FRAMES[1]]
                : fx.kind === "hit" ? HIT_FRAMES : fx.kind === "wrong" ? WRONG_FRAMES : MISS_FRAMES
            }
            x={fxPx.x}
            y={fxPx.y}
            size={fxSize}
            duration={fx.kind === "hit" ? (reduced ? 500 : 750) : reduced ? 350 : 420}
            onEnd={() => setFx((cur) => (cur && cur.key === fx.key ? null : cur))}
          />
        </div>
      )}

      {/* 판에 꽂힌 다트 */}
      {stuck && stuckPx && (
        <DartSprite
          key={stuck.key}
          kind={stuck.kind}
          sd={L.sd}
          x={stuckPx.x}
          y={stuckPx.y}
          angle={stuck.angle}
          k={0.62}
          origin="tip"
          outerRef={stuckOuter}
          innerRef={stuckInner}
          style={{ zIndex: 4 }}
        />
      )}

      {/* 비행 중 다트 + 특수 다트 입자 */}
      <DartSprite kind={dartKind} sd={L.sd} x={0} y={0} angle={0} k={1} origin="tip" outerRef={flyOuter} innerRef={flyInner} style={{ display: "none", zIndex: 6 }} />
      <div ref={trailLayer} style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 5 }} />

      {/* 조준점 + 짧은 점선 궤적 */}
      {crosshair && phase !== "flight" && (
        <svg width={L.w} height={L.h} style={{ position: "absolute", left: 0, top: 0, pointerEvents: "none", zIndex: 7 }} aria-hidden>
          {(() => {
            const tip = tipAt(L, dartKind, crosshair.angle);
            const dx = crosshair.x - tip.x;
            const dy = crosshair.y - tip.y;
            const dist = Math.hypot(dx, dy) || 1;
            const seg = Math.min(dist, 150);
            const sx = crosshair.x - (dx / dist) * seg;
            const sy = crosshair.y - (dy / dist) * seg;
            const col = crosshair.valid ? "#ffffff" : "rgba(255,255,255,0.45)";
            return (
              <>
                <line x1={sx} y1={sy} x2={crosshair.x} y2={crosshair.y} stroke={col} strokeWidth={4} strokeDasharray="2 10" strokeLinecap="round" />
                <circle cx={crosshair.x} cy={crosshair.y} r={20} fill="none" stroke="#111" strokeOpacity={0.35} strokeWidth={6} />
                <circle cx={crosshair.x} cy={crosshair.y} r={20} fill="none" stroke={col} strokeWidth={3} />
                <circle cx={crosshair.x} cy={crosshair.y} r={3.5} fill={crosshair.valid ? "#ff5a4a" : col} />
                <path d={`M${crosshair.x - 30} ${crosshair.y}H${crosshair.x - 10}M${crosshair.x + 10} ${crosshair.y}H${crosshair.x + 30}M${crosshair.x} ${crosshair.y - 30}V${crosshair.y - 10}M${crosshair.x} ${crosshair.y + 10}V${crosshair.y + 30}`} stroke={col} strokeWidth={3} strokeLinecap="round" />
              </>
            );
          })()}
        </svg>
      )}

      {/* 상단 HUD */}
      <div
        style={{ position: "absolute", left: 0, right: 0, top: 0, height: 48, zIndex: 20, paddingLeft: 12, paddingRight: 12 }}
        className="flex items-center justify-between gap-2"
      >
        <button onClick={handleExit} className="dg-btn min-h-[44px] min-w-[44px] px-4 rounded-full bg-black/45 text-white font-bold text-base active:scale-95 transition">
          ✕ 나가기
        </button>
        <div className="flex items-center gap-2 text-base font-black">
          <span className="rounded-full bg-black/45 px-4 py-2">
            {Math.min(qIndex + 1, ROUND_COUNT)} / {ROUND_COUNT}
          </span>
          <span className={`rounded-full px-4 py-2 ${combo >= 3 ? "bg-orange-500" : "bg-black/45"}`}>콤보 {combo}</span>
        </div>
        <div className="flex items-center gap-2 relative">
          <button
            onClick={() => setShowSettings((s) => !s)}
            aria-label="조준 설정"
            aria-expanded={showSettings}
            className="dg-btn min-h-[44px] min-w-[44px] rounded-full bg-black/45 text-xl active:scale-95 transition"
          >
            ⚙
          </button>
          <button
            onClick={toggleMute}
            aria-label={muted ? "소리 켜기" : "소리 끄기"}
            aria-pressed={muted}
            className="dg-btn min-h-[44px] min-w-[44px] rounded-full bg-black/45 text-xl active:scale-95 transition"
          >
            {muted ? "🔇" : "🔊"}
          </button>
          {showSettings && (
            <div className="absolute right-0 top-[52px] rounded-2xl bg-white text-gray-800 shadow-xl p-3 flex flex-col gap-2 w-[220px]">
              <p className="text-sm font-bold">조준점 높이</p>
              <div className="flex items-center justify-between gap-2">
                <button onClick={() => changeAimOffset(-AIM_OFFSET_STEP)} aria-label="조준점 낮추기" className="dg-btn min-h-[44px] min-w-[44px] rounded-full bg-gray-200 font-black text-xl">−</button>
                <span className="font-black text-lg">{aimOffset}px</span>
                <button onClick={() => changeAimOffset(AIM_OFFSET_STEP)} aria-label="조준점 높이기" className="dg-btn min-h-[44px] min-w-[44px] rounded-full bg-gray-200 font-black text-xl">＋</button>
              </div>
              <p className="text-xs text-gray-500">손가락보다 위에 조준점이 보여요.</p>
            </div>
          )}
        </div>
      </div>

      {/* 문제 카드 */}
      {stage === "play" && q && (
        <div
          style={{ position: "absolute", left: "50%", top: L.qTop, height: L.qH, transform: "translateX(-50%)", zIndex: 10, maxWidth: "min(92vw, 720px)", minWidth: Math.min(L.w * 0.5, 320) }}
          className="rounded-3xl bg-white/95 text-gray-900 shadow-lg flex items-center justify-center gap-3 px-6"
        >
          <p
            key={qIndex}
            className="dg-pop font-black text-center leading-tight"
            style={{ fontSize: clamp(Math.min(L.qH * 0.4, ((L.w * 0.8 - 90) / Math.max(1, [...q.prompt].length)) * 1.05), 14, 30), whiteSpace: "nowrap" }}
          >
            {q.prompt}
          </p>
          <button
            onClick={replayPrompt}
            aria-label="다시 듣기"
            className="dg-btn shrink-0 min-h-[48px] min-w-[48px] rounded-full bg-sky-100 text-2xl active:scale-95 transition"
          >
            🔈
          </button>
        </div>
      )}

      {/* 하단 다트 트레이 */}
      {showTray && (
        <div
          role="button"
          aria-label="다트. 끌어서 조준하고 손을 놓으면 던져요."
          onPointerDown={onDartPointerDown}
          onPointerMove={onDartPointerMove}
          onPointerUp={onDartPointerUp}
          onPointerCancel={onDartPointerCancel}
          onLostPointerCapture={onDartLostCapture}
          style={{
            position: "absolute",
            left: trayCx - 64,
            top: L.trayTop - 8,
            width: 128,
            height: L.trayH + 8,
            zIndex: 12,
            touchAction: "none",
            cursor: phase === "idle" ? "grab" : "grabbing",
          }}
        >
          <div key={dartKey} className="dg-respawn" style={{ position: "absolute", inset: 0 }}>
            <DartSprite
              kind={dartKind}
              sd={L.sd}
              x={64}
              y={trayPivotY - (L.trayTop - 8)}
              angle={trayAngle}
              k={aim ? 1.06 : 1}
              origin="pivot"
            />
          </div>
        </div>
      )}
      {stage === "play" && showHelp && phase !== "flight" && (
        <p
          style={{ position: "absolute", left: 0, right: 0, bottom: 10, zIndex: 11, textShadow: "0 2px 6px rgba(0,0,0,.6)" }}
          className="text-center text-base font-bold pointer-events-none"
        >
          끌어서 조준 · 놓으면 발사
        </p>
      )}

      {/* 결과 문구 */}
      {banner && (
        <div
          key={banner.key}
          style={{ position: "absolute", left: "50%", top: L.trayTop - 62, transform: "translateX(-50%)", zIndex: 14, maxWidth: "92vw" }}
          className="pointer-events-none"
        >
          <div className="dg-pop flex flex-col items-center gap-1">
          <span
            className={`rounded-full px-7 py-2 font-black text-3xl shadow-lg ${
              banner.tone === "good" ? "bg-amber-300 text-amber-900" : banner.tone === "try" ? "bg-rose-400 text-white" : "bg-sky-400 text-white"
            }`}
          >
            {banner.text}
          </span>
          {banner.sub && <span className="rounded-full bg-black/60 px-4 py-1 text-base font-bold">{banner.sub}</span>}
          </div>
        </div>
      )}

      {/* 정답 단어 확인 (영어 + 한국어 함께) */}
      {reveal && (
        <div
          key={`reveal-${qIndex}`}
          style={{ position: "absolute", left: "50%", top: L.trayTop + L.trayH / 2, transform: "translate(-50%, -50%)", zIndex: 14, maxWidth: "94vw" }}
          className="pointer-events-none"
        >
          <div className="dg-pop flex items-center justify-center gap-3 rounded-2xl bg-white/95 text-gray-900 px-5 py-1.5 shadow-xl whitespace-nowrap">
            <span className="font-black" style={{ fontSize: revealFs }}>{reveal.english}</span>
            <span className="text-gray-400 font-black" style={{ fontSize: revealFs }}>·</span>
            <span className="font-black text-sky-700" style={{ fontSize: revealFs }}>{reveal.korean}</span>
          </div>
        </div>
      )}

      {/* 로딩 / 시작 안내 */}
      {stage === "intro" && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/45 p-4">
          <div className="dg-pop rounded-3xl bg-white text-gray-800 px-8 py-8 max-w-md w-full flex flex-col items-center gap-5 text-center shadow-2xl">
            <p className="text-5xl" aria-hidden>🎯</p>
            <p className="text-2xl font-black leading-snug" style={{ wordBreak: "keep-all" }}>다트를 끌어서 정답을 겨냥하고, 손을 놓아 던져봐!</p>
            <button
              onClick={start}
              disabled={!loaded}
              className="dg-btn w-full min-h-[56px] rounded-full bg-sky-600 text-white font-black text-xl active:scale-95 transition disabled:opacity-60"
            >
              {loaded ? "시작!" : "불러오는 중…"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
