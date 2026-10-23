"use client";

import { useEffect, useRef, useState } from "react";
import type { CSSProperties, KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from "react";
import type { VocabWord } from "@/lib/types";
import { loadPet, getPetImagePath, earnCoins, COINS_DART_COMPLETE, COINS_DART_SPELL, COINS_DART_WORD } from "@/lib/pet";
import { speak, unlockAudio, cancelSpeech } from "@/lib/gameAudio";
import { CoinAmount } from "./Coin";
import { shuffle } from "./VocabGame";
import { useFever } from "./FeverKit";

// ---------------------------------------------------------------------------
// 다트 클럽 (승인 디자인) — 실사 다트보드에 다트를 끌어 조준한 뒤 놓아서 던진다.
//  - 모드 2가지: 빈칸 2글자(왼쪽부터) / 순서 완성. 시간 제한 없음
//  - 레이어: 배경 → 패널 → 보드(PNG)+숫자 오버레이+글자 라벨 → 조준점 → 다트 → 효과
//  - 판정은 보드 좌표(1254)의 반지름·각도로만 한다. 정답 위치로 보정하지 않는다
//  - 점수(FEVER)·코인은 단어를 완성했을 때 단어당 한 번만 반영한다
// ---------------------------------------------------------------------------

const A = "/assets/dart-club";
const MAX_ROUNDS = 10;
const MIN_LEN = 3;
const MAX_LEN = 8;
const BLANK_COUNT = 2;
const COIN_BLANKS = COINS_DART_WORD;
const COIN_SEQUENCE = COINS_DART_SPELL;
const COIN_COMPLETE = COINS_DART_COMPLETE;

// ---------- 보드 좌표 (spec/board-registration.json, 1254 기준) ----------
const BOARD = 1254;
const CX = 626;
const CY = 609;
const R_BULL_OUT = 50;
const R_DOUBLE_OUT = 434; // 사진 보드 실측(링 경계 406~436)에 맞춤
const R_BOARD_EDGE = 590; // 이 밖은 보드에 꽂히지 않는다
const R_LABEL = 337;
const LETTER_SEGS = [0, 2, 5, 7, 10, 12, 15, 17];
const LAUNCH = { x: 1370, y: 1150 }; // 보드 오른쪽 아래 고정 발사점
const FLIGHT_MS = 380;
const HIT_MS = 450;

function classify(px: number, py: number): { seg: number; rad: number } {
  const x = px - CX;
  const y = py - CY;
  const rad = Math.hypot(x, y);
  const angle = ((Math.atan2(x, -y) * 180) / Math.PI + 360) % 360;
  return { seg: Math.floor(((angle + 9) % 360) / 18), rad };
}
const labelPos = (seg: number) => {
  const t = (seg * 18 * Math.PI) / 180;
  return { x: CX + R_LABEL * Math.sin(t), y: CY - R_LABEL * Math.cos(t) };
};

// ---------- 다트 스프라이트 앵커 (spec/dart-anchors.json) ----------
type Anchor = { file: string; w: number; h: number; tip: [number, number]; axis: number };
type DartColor = "red" | "silver" | "blue";
const SIDE: Record<DartColor, Anchor> = {
  red: { file: "steel-tip-red-side.png", w: 2172, h: 724, tip: [73, 350], axis: 0 },
  silver: { file: "steel-tip-silver-side.png", w: 1774, h: 887, tip: [29, 443], axis: 0 },
  blue: { file: "steel-tip-blue-side.png", w: 2172, h: 724, tip: [28, 365], axis: -0.405 },
};
const EMB: Record<DartColor, Anchor> = {
  red: { file: "steel-tip-red-embedded.png", w: 1254, h: 1254, tip: [70, 154], axis: 38.159 },
  silver: { file: "steel-tip-silver-embedded.png", w: 1254, h: 1254, tip: [54, 153], axis: 37.268 },
  blue: { file: "steel-tip-blue-embedded.png", w: 1254, h: 1254, tip: [66, 113], axis: 40.887 },
};
const COLORS: DartColor[] = ["red", "silver", "blue"];
const COLOR_NAME: Record<DartColor, string> = { red: "빨강", silver: "실버", blue: "파랑" };

function Sprite({ a, x, y, angle, width, opacity = 1 }: { a: Anchor; x: number; y: number; angle: number; width: number; opacity?: number }) {
  // 팁 앵커를 (x,y)에 고정하고 팁→꼬리 축이 angle을 향하도록 회전한다.
  return (
    <g transform={`translate(${x} ${y}) rotate(${angle - a.axis}) scale(${width / a.w})`} opacity={opacity}>
      <image href={`${A}/darts/${a.file}`} x={-a.tip[0]} y={-a.tip[1]} width={a.w} height={a.h} />
    </g>
  );
}

// ---------- 문제 만들기 ----------
type Mode = "blanks" | "sequence";
type Round = {
  id: string;
  wordId: string;
  mode: Mode;
  english: string;
  korean: string;
  letters: string[];
  targets: number[];
  tiles: string[]; // LETTER_SEGS 순서의 8개 글자
};
const ALPHA = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

// 단어장의 words[].korean 을 그대로 쓴다. 뜻이 비어 있는 단어는 임의로 채우지 않고 제외한다.
function buildRounds(words: VocabWord[]): Round[] | null {
  const seen = new Set<string>();
  const ok: VocabWord[] = [];
  for (const w of words) {
    const e = (w.english ?? "").trim();
    const k = (w.korean ?? "").trim();
    if (!k || !/^[A-Za-z]+$/.test(e) || e.length < MIN_LEN || e.length > MAX_LEN) continue;
    const key = e.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    ok.push(w);
  }
  if (ok.length < 3) return null;
  return shuffle(ok)
    .slice(0, MAX_ROUNDS)
    .map((w, i) => {
      const letters = w.english.trim().toUpperCase().split("");
      const mode: Mode = i % 2 === 0 ? "blanks" : "sequence";
      const targets = mode === "sequence" ? letters.map((_, k) => k) : shuffle(letters.map((_, k) => k)).slice(0, BLANK_COUNT).sort((a, b) => a - b);
      const need = Array.from(new Set(targets.map((k) => letters[k])));
      const pool = shuffle(ALPHA.filter((c) => !need.includes(c)));
      const tiles = shuffle([...need, ...pool.slice(0, LETTER_SEGS.length - need.length)]);
      return { id: `d${i}`, wordId: w.id, mode, english: w.english.trim(), korean: w.korean.trim(), letters, targets, tiles };
    });
}

const reducedNow = () => typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

type Embedded = { key: number; x: number; y: number; theta: number; color: DartColor; tilt: number };
type Drag = { pointerId: number; clientX: number; clientY: number; color: DartColor; moved: boolean };
type Held = { x: number; y: number; theta: number; color: DartColor };
type Fly = { x: number; y: number; theta: number; u: number; color: DartColor };

function playWav(name: "throw" | "hit-metal" | "complete-metal", muted: boolean) {
  if (muted) return;
  try {
    const a = new Audio(`${A}/audio/${name}.wav`);
    a.volume = 0.45;
    void a.play().catch(() => {});
  } catch {
    /* 오디오를 못 써도 게임은 진행된다 */
  }
}

// ---------- 메인 ----------
export default function DartGame({
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
  onComplete?: () => void; // 한 판을 끝내 결과 화면이 뜰 때 한 번 호출(자동 성장 기록)
}) {
  const [pet] = useState(() => loadPet("vocab"));
  const [rounds] = useState<Round[] | null>(() => buildRounds(words));
  const leave = onExit ?? onDone;
  const fever = useFever();

  const rootRef = useRef<HTMLDivElement>(null);
  const boardRef = useRef<SVGSVGElement>(null);
  const alive = useRef(true);
  const epoch = useRef(0); // 라운드 전환/이탈 시 올려서 진행 중인 비동기 연출을 무효화
  const busyRef = useRef(false);
  const doneIds = useRef(new Set<string>());
  const wrongsRef = useRef(0);
  const progressRef = useRef(0);
  const keySeq = useRef(0);
  const aimRef = useRef({ x: CX, y: 330 });
  const dragRef = useRef<Drag | null>(null);
  const heldRef = useRef<Held | null>(null);
  const game = useRef({ firstTry: 0, wrongs: 0, coins: 0, streak: 0, bestStreak: 0, score: 0 });

  const [stage, setStage] = useState<"play" | "result">("play");
  const [qIndex, setQIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [muted, setMuted] = useState(false);
  const mutedRef = useRef(false);
  const [color, setColor] = useState<DartColor>("red");
  const [aim, setAim] = useState({ x: CX, y: 330 });
  const [held, setHeld] = useState<Held | null>(null);
  const [fly, setFly] = useState<Fly | null>(null);
  const [embedded, setEmbedded] = useState<Embedded[]>([]);
  const [ring, setRing] = useState<{ key: number; x: number; y: number } | null>(null);
  const [badge, setBadge] = useState<{ key: number; kind: "hit" | "complete"; note: string } | null>(null);
  const [shake, setShake] = useState(0);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [hud, setHud] = useState({ score: 0, best: 0 });
  const [finalStats, setFinalStats] = useState<{ firstTry: number; wrongs: number; bestStreak: number; coins: number } | null>(null);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      epoch.current += 1;
      dragRef.current = null;
      heldRef.current = null;
      cancelSpeech();
    };
  }, []);

  const total = rounds?.length ?? 0;
  const round = rounds ? rounds[qIndex] : null;

  useEffect(() => {
    if (!rounds) return;
    const t = setTimeout(() => void speak(rounds[0].english, "en-US", false), 500);
    return () => clearTimeout(t);
    // 첫 문제의 단어 발음만 처음 한 번 자동 재생
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function setLock(v: boolean) {
    busyRef.current = v;
    setBusy(v);
  }

  function moveAim(x: number, y: number) {
    const p = { x: Math.max(0, Math.min(BOARD, x)), y: Math.max(0, Math.min(BOARD, y)) };
    aimRef.current = p;
    setAim(p);
  }

  function beginRound(i: number) {
    cancelDrag();
    epoch.current += 1;
    wrongsRef.current = 0;
    progressRef.current = 0;
    setQIndex(i);
    setProgress(0);
    setEmbedded([]); // 단어 단위로 보드를 정리한다
    setFly(null);
    setBadge(null);
    setNote("");
    setLock(false);
    if (rounds) setTimeout(() => alive.current && void speak(rounds[i].english, "en-US", mutedRef.current), 350);
  }

  function nextRound() {
    const i = qIndex + 1;
    if (!rounds || i >= rounds.length) {
      const g = game.current;
      setFinalStats({ firstTry: g.firstTry, wrongs: g.wrongs, bestStreak: g.bestStreak, coins: g.coins + earnCoins(COIN_COMPLETE, "vocab").granted });
      setStage("result");
      onComplete?.();
      return;
    }
    beginRound(i);
  }

  // ---------- 던지기 ----------
  async function throwDart(release?: { point: { x: number; y: number }; launch: { x: number; y: number }; color: DartColor }) {
    if (busyRef.current || stage !== "play" || !round) return;
    setLock(true);
    unlockAudio();
    const ep = epoch.current;
    const r = round;
    const P = release?.point ?? { ...aimRef.current };
    const S = release?.launch ?? LAUNCH;
    const theta = (Math.atan2(S.y - P.y, S.x - P.x) * 180) / Math.PI;
    const reduced = reducedNow();
    const dartColor = release?.color ?? color;
    playWav("throw", mutedRef.current);

    if (reduced) {
      setFly(null);
    } else {
      await new Promise<void>((resolve) => {
        const t0 = performance.now();
        const frame = (t: number) => {
          if (!alive.current || ep !== epoch.current) return resolve();
          const u = Math.min(1, (t - t0) / FLIGHT_MS);
          const v = 1 - (1 - u) ** 1.4;
          setFly({ x: S.x + (P.x - S.x) * v, y: S.y + (P.y - S.y) * v - 18 * Math.sin(Math.PI * u), theta, u, color: dartColor });
          if (u < 1) requestAnimationFrame(frame);
          else resolve();
        };
        requestAnimationFrame(frame);
        setTimeout(resolve, FLIGHT_MS + 250); // 화면이 가려져 rAF가 멈춰도 투척이 끝나도록 보험
      });
    }
    if (!alive.current || ep !== epoch.current) return;
    setFly(null);

    const { seg, rad } = classify(P.x, P.y);
    if (rad < R_BOARD_EDGE) {
      setEmbedded((list) => [...list, { key: ++keySeq.current, x: P.x, y: P.y, theta, color: dartColor, tilt: 0 }]);
      setRing({ key: ++keySeq.current, x: P.x, y: P.y });
    }
    playWav("hit-metal", mutedRef.current);
    const idx = LETTER_SEGS.indexOf(seg);
    const letter = rad >= R_BULL_OUT && rad <= R_DOUBLE_OUT && idx >= 0 ? r.tiles[idx] : null;
    const needed = r.letters[r.targets[progressRef.current]];

    if (letter === null) {
      setNote("글자 칸을 맞혀야 해요. 다시 조준해 보세요.");
      await sleep(250);
      if (alive.current && ep === epoch.current) setLock(false);
      return;
    }
    if (letter !== needed) {
      wrongsRef.current += 1;
      game.current.wrongs += 1;
      fever.retryWrong();
      setShake((s) => s + 1);
      setNote("다른 글자예요. 다시 조준해 보세요.");
      await sleep(350);
      if (alive.current && ep === epoch.current) setLock(false);
      return;
    }

    progressRef.current += 1;
    setProgress(progressRef.current);
    setNote("");
    if (progressRef.current < r.targets.length) {
      setBadge({ key: ++keySeq.current, kind: "hit", note: "" });
      await sleep(350);
      if (alive.current && ep === epoch.current) setLock(false);
      return;
    }
    await completeWord(r, P, ep);
  }

  async function completeWord(r: Round, P: { x: number; y: number }, ep: number) {
    if (doneIds.current.has(r.id)) return; // 단어당 한 번만 보상
    doneIds.current.add(r.id);
    const g = game.current;
    const clean = wrongsRef.current === 0;
    let coins = 0;
    if (clean) {
      g.firstTry += 1;
      g.streak += 1;
      g.bestStreak = Math.max(g.bestStreak, g.streak);
      coins = earnCoins(r.mode === "sequence" ? COIN_SEQUENCE : COIN_BLANKS, "vocab").granted;
      g.coins += coins;
      g.score += coins;
    } else {
      g.streak = 0;
    }
    setHud({ score: g.score, best: g.bestStreak });
    const hasNext = qIndex + 1 < (rounds?.length ?? 0);
    const fc = fever.complete(r.id, clean, hasNext);
    await sleep(350);
    if (!alive.current || ep !== epoch.current) return;
    setBadge({ key: ++keySeq.current, kind: "complete", note: "" });
    playWav("complete-metal", mutedRef.current);
    const spoken = speak(r.english, "en-US", mutedRef.current);
    await fever.playPre(fc, { skipPause: true });
    const rect = boardRef.current?.getBoundingClientRect();
    if (rect) fever.burst(rect.left + (P.x / BOARD) * rect.width, rect.top + (P.y / BOARD) * rect.height, true);
    await spoken;
    await fever.playPost(fc, clean);
    if (!alive.current || ep !== epoch.current) return;
    nextRound();
  }

  // ---------- 조준 입력 ----------
  function boardPoint(e: { clientX: number; clientY: number }) {
    const svg = boardRef.current;
    const m = svg?.getScreenCTM();
    if (!svg || !m) return null;
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
    return { x: p.x, y: p.y };
  }

  // Pointer capture keeps one gesture alive across the rack, board and scene edges.
  // A tap selects/aims only; a deliberate drag released over the board throws once.
  function cancelDrag(pointerId?: number) {
    const d = dragRef.current;
    if (!d || (pointerId !== undefined && pointerId !== d.pointerId)) return;
    dragRef.current = null;
    heldRef.current = null;
    setHeld(null);
    try {
      if (rootRef.current?.hasPointerCapture(d.pointerId)) rootRef.current.releasePointerCapture(d.pointerId);
    } catch { /* capture may already have been released by the browser */ }
  }

  function startDrag(e: ReactPointerEvent<Element>, dartColor: DartColor) {
    if (busyRef.current || stage !== "play" || dragRef.current || !e.isPrimary || e.button !== 0) return;
    e.preventDefault();
    unlockAudio();
    setColor(dartColor);
    dragRef.current = { pointerId: e.pointerId, clientX: e.clientX, clientY: e.clientY, color: dartColor, moved: false };
    rootRef.current?.setPointerCapture(e.pointerId);
  }

  function onBoardDown(e: ReactPointerEvent<SVGSVGElement>) {
    if (busyRef.current) return;
    e.currentTarget.focus();
    const p = boardPoint(e);
    if (p) moveAim(p.x, p.y);
    startDrag(e, color);
  }

  function heldAt(p: { x: number; y: number }, dartColor: DartColor): Held {
    const x = LAUNCH.x + (p.x - LAUNCH.x) * 0.16;
    const y = LAUNCH.y + (p.y - LAUNCH.y) * 0.16;
    return { x, y, theta: (Math.atan2(y - p.y, x - p.x) * 180) / Math.PI, color: dartColor };
  }

  function onDragMove(e: ReactPointerEvent<HTMLDivElement>) {
    const d = dragRef.current;
    if (!d || d.pointerId !== e.pointerId || busyRef.current) return;
    if (!d.moved && Math.hypot(e.clientX - d.clientX, e.clientY - d.clientY) < 6) return;
    d.moved = true;
    const p = boardPoint(e);
    if (!p) return;
    moveAim(p.x, p.y);
    // Move the foreground dart a little with the gesture while the crosshair tracks
    // the board. On release it flies from this exact held position, without a jump.
    const next = heldAt(p, d.color);
    heldRef.current = next;
    setHeld(next);
  }

  function onDragEnd(e: ReactPointerEvent<HTMLDivElement>) {
    const d = dragRef.current;
    if (!d || d.pointerId !== e.pointerId) return;
    const p = boardPoint(e);
    const moved = d.moved && Math.hypot(e.clientX - d.clientX, e.clientY - d.clientY) >= 6;
    cancelDrag(e.pointerId);
    if (busyRef.current) return;
    if (!moved || !p) {
      if (d.moved) setNote("다트를 끌어서 놓으면 던져져요.");
      return;
    }
    // 빠르게 튕기듯 놓아 이동 이벤트가 없었어도 같은 규칙으로 시작 위치를 만든다
    const source = heldRef.current ?? heldAt(p, d.color);
    // 어디에 놓든 놓는 지점으로 바로 날아간다(보드 밖이면 벽에 맞아 꽂히지 않는다)
    moveAim(p.x, p.y);
    void throwDart({ point: p, launch: source, color: d.color });
  }
  function onBoardKey(e: ReactKeyboardEvent<SVGSVGElement>) {
    if (dragRef.current || e.ctrlKey || e.metaKey || e.altKey) return;
    const d = e.shiftKey ? 40 : 12;
    const a = aimRef.current;
    if (e.key.startsWith("Arrow")) {
      e.preventDefault();
      if (busyRef.current) return;
      moveAim(a.x + (e.key === "ArrowLeft" ? -d : e.key === "ArrowRight" ? d : 0), a.y + (e.key === "ArrowUp" ? -d : e.key === "ArrowDown" ? d : 0));
    } else if ((e.key === "Enter" || e.key === " ") && !e.repeat) {
      e.preventDefault();
      void throwDart();
    } else if (round && /^[a-zA-Z]$/.test(e.key) && !e.ctrlKey && !e.metaKey && !e.altKey) {
      // 글자 키: 그 글자 칸으로 조준만 이동한다(투척은 별도)
      const i = round.tiles.indexOf(e.key.toUpperCase());
      if (i >= 0 && !busyRef.current) {
        e.preventDefault();
        const p = labelPos(LETTER_SEGS[i]);
        moveAim(p.x, p.y);
      }
    }
  }

  function toggleMute() {
    const m = !mutedRef.current;
    mutedRef.current = m;
    setMuted(m);
    if (m) cancelSpeech();
  }
  function handleExit() {
    cancelDrag();
    epoch.current += 1;
    cancelSpeech();
    leave();
  }

  const rootStyle: CSSProperties = {
    position: "fixed",
    inset: 0,
    zIndex: 50,
    height: "100dvh",
    overflow: "hidden",
    userSelect: "none",
    WebkitUserSelect: "none",
    background: `#1a0f08 url(${A}/wood-wall-lights.jpg) center/cover`,
    color: "#eee6d5",
  };

  if (!rounds) {
    return (
      <div ref={rootRef} style={rootStyle} className="flex items-center justify-center p-6">
        <div className="rounded-3xl bg-[#14110d] border border-[#a28b5d] text-[#eee6d5] px-8 py-8 max-w-md text-center flex flex-col gap-4 shadow-xl">
          <p className="text-2xl font-black text-[#ffc05a]">단어가 조금 부족해요</p>
          <p className="text-base text-[#c8c1ae]">다트 게임은 한글 뜻이 있는 3~8글자 영어 단어가 서로 다르게 3개 이상 필요해요. 단어를 더 공부하고 다시 도전해요!</p>
          <button onClick={handleExit} className="min-h-[48px] rounded-full bg-[#ffc05a] text-[#241405] font-black text-lg">
            나가기
          </button>
        </div>
      </div>
    );
  }

  if (stage === "result" && finalStats) {
    const rows: [string, string][] = [
      ["완성한 단어", `${total} / ${total}`],
      ["한 번에 성공", `${finalStats.firstTry} / ${total}`],
      ["연속 성공", `${finalStats.bestStreak}`],
      ["빗나간 횟수", `${finalStats.wrongs}번`],
    ];
    return (
      <div ref={rootRef} style={rootStyle} className="flex items-center justify-center p-4">
        {fever.layer}
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
              <CoinAmount amount={finalStats.coins} prefix="+" size={26} />
            </div>
          </div>
          <div className="flex gap-3 w-full">
            <button onClick={onRetry} className="flex-1 min-h-[52px] rounded-full bg-gray-200 text-gray-800 font-bold text-lg active:scale-95 transition">
              다시하기
            </button>
            <button onClick={onDone} className="flex-1 min-h-[52px] rounded-full bg-sky-600 text-white font-bold text-lg active:scale-95 transition">
              나가기
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!round) return null;
  const fh = fever.hud;
  const feverOn = fh.remaining > 0;
  const lamps = feverOn ? 5 : Math.max(0, Math.min(5, fh.gauge));
  const barPct = feverOn ? (fh.remaining / 3) * 100 : (lamps / 5) * 100;

  return (
    <div ref={rootRef} style={rootStyle} className="dc-root flex items-center justify-center" data-testid="dart-stage"
      onPointerMove={onDragMove} onPointerUp={onDragEnd}
      onPointerCancel={(e) => cancelDrag(e.pointerId)} onLostPointerCapture={(e) => cancelDrag(e.pointerId)}>
      <style>{DART_CSS}</style>
      {fever.layer}
      <div className="dc-scene">
        {/* 왼쪽 패널 */}
        <div className="dc-panel dc-left">
          <div className="dc-round">
            ROUND <b data-testid="dart-round">{qIndex + 1} / {total}</b>
          </div>
          <div className="dc-mode">{round.mode === "blanks" ? "빈칸 2글자" : "순서대로 완성"}</div>
          <p className="dc-inst">{round.mode === "blanks" ? "빈칸을 순서대로 완성하세요." : "철자를 순서대로 맞히세요."}</p>
          <div className="dc-meaning">
            <button type="button" aria-label="단어 듣기" onClick={() => void speak(round.english, "en-US", mutedRef.current)} className="dc-audio">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`${A}/icons/audio.svg`} alt="" />
            </button>
            <span data-testid="dart-korean">{round.korean}</span>
          </div>
          <div className={`dc-slots ${shake ? "dc-shake" : ""}`} key={shake} data-testid="dart-slots">
            {round.letters.map((ch, k) => {
              const ti = round.targets.indexOf(k);
              const isTarget = ti >= 0;
              const shown = !isTarget || ti < progress;
              const current = isTarget && ti === progress;
              return (
                <span key={k} className="dc-slot" data-state={current ? "current" : shown ? "filled" : "empty"} style={{ backgroundImage: `url(${A}/ui/slot-${current ? "current" : shown ? "filled" : "default"}.svg)` }}>
                  {shown ? ch : ""}
                </span>
              );
            })}
          </div>
          <div className="dc-progress" data-testid="dart-progress">
            완성 {progress} / {round.targets.length}
          </div>
          <div className="dc-help" aria-live="polite">
            {note || "다트 선택 → 끌어 조준 → 놓아 던지기"}
            <br />
            <br />
            시간 제한 없이 나의 속도로
          </div>
        </div>

        {/* 상단 버튼 */}
        <button type="button" className="dc-icon dc-home" aria-label="나가기" onClick={handleExit}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`${A}/icons/home.svg`} alt="" />
        </button>
        <button type="button" className="dc-icon dc-mute" aria-label={muted ? "소리 켜기" : "소리 끄기"} aria-pressed={muted} onClick={toggleMute}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`${A}/icons/${muted ? "mute" : "audio"}.svg`} alt="" />
        </button>

        {/* 보드 */}
        <div className="dc-boardwrap">
          <svg
            ref={boardRef}
            viewBox={`0 0 ${BOARD} ${BOARD}`}
            className="dc-board"
            tabIndex={0}
            role="application"
            aria-label="글자 다트보드. 다트를 끌어 조준하고 놓으면 던져요. 키보드는 방향키로 조준하고 Enter로 던져요"
            data-testid="dart-board"
            onPointerDown={onBoardDown}
            onKeyDown={onBoardKey}
          >
            <image href={`${A}/board/sisal-board-no-numbers.png`} width={BOARD} height={BOARD} />
            <image href={`${A}/board/numbers-overlay.svg`} width={BOARD} height={BOARD} />
            {LETTER_SEGS.map((seg, i) => {
              const p = labelPos(seg);
              return (
                <g key={seg} data-letter={round.tiles[i]}>
                  <image href={`${A}/labels/label-default.svg`} x={p.x - 36} y={p.y - 33} width={72} height={66} />
                  <text x={p.x} y={p.y + 15} fill="#eee4d0" fontSize={46} fontFamily="Arial, sans-serif" fontWeight={700} textAnchor="middle">
                    {round.tiles[i]}
                  </text>
                </g>
              );
            })}
            <g pointerEvents="none" data-testid="dart-embedded">
              {embedded.map((d) => (
                <Sprite key={d.key} a={EMB[d.color]} x={d.x} y={d.y} angle={d.theta} width={230} />
              ))}
            </g>
            {ring && <image key={ring.key} className="dc-ring" href={`${A}/effects/impact-ring.svg`} x={ring.x - 90} y={ring.y - 90} width={180} height={180} pointerEvents="none" />}
            <g pointerEvents="none" data-testid="dart-held">
              {held && <Sprite a={SIDE[held.color]} x={held.x} y={held.y} angle={held.theta} width={530} />}
            </g>
            <g pointerEvents="none">
              {fly && (
                <>
                  {fly.u < 0.95 && <Sprite a={SIDE[fly.color]} x={fly.x} y={fly.y} angle={fly.theta} width={530 - 290 * fly.u} opacity={1 - Math.max(0, Math.min(1, (fly.u - 0.72) / 0.23))} />}
                  {fly.u > 0.72 && <Sprite a={EMB[fly.color]} x={fly.x} y={fly.y} angle={fly.theta} width={230} opacity={Math.max(0, Math.min(1, (fly.u - 0.72) / 0.23))} />}
                </>
              )}
            </g>
            {!busy && !fly && (() => {
              // 예상 궤적: 던지는 다트(끌고 있으면 그 위치, 아니면 발사점)에서 조준점까지
              const sx = held ? held.x : LAUNCH.x;
              const sy = held ? held.y : LAUNCH.y;
              const dx = aim.x - sx;
              const dy = aim.y - sy;
              const len = Math.hypot(dx, dy) || 1;
              const ex = aim.x - (dx / len) * 34;
              const ey = aim.y - (dy / len) * 34;
              return (
                <g pointerEvents="none" data-testid="dart-trajectory">
                  <line x1={sx} y1={sy} x2={ex} y2={ey} stroke="#000" strokeOpacity={0.45} strokeWidth={20} strokeLinecap="round" strokeDasharray="1 32" />
                  <line className="dc-traj" x1={sx} y1={sy} x2={ex} y2={ey} stroke="#ffc05a" strokeWidth={14} strokeLinecap="round" strokeDasharray="1 32" />
                </g>
              );
            })()}
            <image href={`${A}/icons/aim-crosshair.svg`} x={aim.x - 40} y={aim.y - 40} width={80} height={80} pointerEvents="none" data-testid="dart-aim" />
          </svg>
        </div>

        {/* 점수 */}
        <div className="dc-panel dc-score">
          <div className="dc-scorelabel">SCORE</div>
          <div className="dc-scoreval" data-testid="dart-score">{hud.score}</div>
          <div className="dc-best">BEST STREAK　{hud.best}</div>
        </div>

        {/* 다트 선택 */}
        <div className="dc-panel dc-rack">
          <div className="dc-racktitle">다트 선택</div>
          <div className="dc-rackbuttons" role="radiogroup" aria-label="다트 선택">
            {COLORS.map((c) => {
              const a = SIDE[c];
              return (
                <button key={c} type="button" role="radio" aria-checked={color === c} aria-label={`${COLOR_NAME[c]} 다트 선택`} className={`dc-rackbutton ${color === c ? "sel" : ""}`} disabled={busy} onClick={() => setColor(c)} onPointerDown={(e) => startDrag(e, c)} data-testid={`dart-select-${c}`}>
                  <svg viewBox="0 0 100 410" aria-hidden>
                    <g transform="translate(50 205) rotate(-90)">
                      <image href={`${A}/darts/${a.file}`} x={-170} y={(-170 * a.h) / a.w} width={340} height={(340 * a.h) / a.w} />
                    </g>
                  </svg>
                </button>
              );
            })}
          </div>
        </div>

        <div className={`dc-gesture ${held ? "dragging" : ""}`} data-testid="dart-gesture-hint">
          <span aria-hidden="true">↗</span>
          <div>{held ? "놓으면 던져져요" : "다트를 끌어 던지세요"}<small>키보드: 방향키로 조준 · Enter로 던지기</small></div>
        </div>

        {/* HOT STREAK = 기존 FEVER 게이지 */}
        <div className="dc-panel dc-streak" role="img" aria-label={feverOn ? `FEVER 남은 보상 문제 ${fh.remaining}개` : `FEVER 게이지 ${lamps}/5`}>
          <span>HOT STREAK</span>
          {[0, 1, 2, 3, 4].map((i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={i} src={`${A}/ui/streak-lamp-${i < lamps ? "on" : "off"}.svg`} alt="" />
          ))}
          <i className="dc-bar">
            <b style={{ width: `${barPct}%` }} />
          </i>
        </div>

        {badge && (
          <div className="dc-feedback" aria-hidden>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img key={badge.key} src={`${A}/effects/${badge.kind}.svg`} alt="" className={badge.kind === "hit" ? "ho-hit" : "ho-complete"} data-testid="dart-badge" data-kind={badge.kind} style={{ animationDuration: badge.kind === "hit" ? `${HIT_MS}ms` : undefined }} />
          </div>
        )}
      </div>
    </div>
  );
}

const DART_CSS = `
.dc-scene{container-type:inline-size;position:relative;width:min(100vw,150dvh);aspect-ratio:3/2;overflow:hidden;font-family:Arial,"Apple SD Gothic Neo","Noto Sans KR",sans-serif}
.dc-scene button{font:inherit;color:inherit;cursor:pointer}
.dc-scene button:focus-visible,.dc-board:focus-visible{outline:3px solid #fff0ca;outline-offset:3px}
.dc-panel{position:absolute;background-size:100% 100%;background-repeat:no-repeat}
.dc-left{left:1.5%;top:8.7%;width:25.2%;height:85.8%;background-image:url(${A}/ui/panel-left.svg);padding:1.7cqw}
.dc-round{font-size:2cqw;font-weight:bold;border-bottom:1px solid #786443;padding-bottom:1.2cqw}
.dc-round b{color:#ffbc54;margin-left:1cqw}
.dc-mode{margin-top:1.2cqw;padding:.7cqw;border:1px solid #a57d3d;border-radius:5px;color:#ffbc54;font-size:1.7cqw}
.dc-inst{font-size:1.5cqw;line-height:1.5;margin:1.6cqw 0}
.dc-meaning{background:url(${A}/ui/meaning-card.svg) center/100% 100%;display:flex;align-items:center;justify-content:space-evenly;height:12cqw;color:#141711;font-size:4.2cqw;font-weight:bold;padding:0 1cqw;gap:1cqw;overflow:hidden}
.dc-meaning span{min-width:0;text-align:center;line-height:1.15;word-break:keep-all}
.dc-audio{background:none;border:0;padding:0;width:4.4cqw;min-width:44px;height:4.4cqw;min-height:44px;display:flex;align-items:center;justify-content:center;flex:none}
.dc-audio img{width:3cqw}
.dc-slots{display:flex;flex-wrap:wrap;gap:.4cqw;margin-top:2cqw}
.dc-slot{width:3.8cqw;height:6.5cqw;background-size:100% 100%;display:flex;align-items:center;justify-content:center;font-size:3cqw;font-weight:bold;color:#f4ead4}
.dc-progress{text-align:center;color:#edb756;font-size:2cqw;margin:2cqw}
.dc-help{font-size:1.3cqw;padding:1.5cqw .4cqw;border-top:1px solid #796849;color:#d8cfba}
.dc-icon{position:absolute;top:1.2%;width:5%;min-width:44px;aspect-ratio:1;background:none;border:0;padding:0}
.dc-icon img{width:100%;height:100%}
.dc-home{left:1%}
.dc-mute{left:6.4%}
.dc-boardwrap{position:absolute;left:24.5%;top:4.2%;width:50.2%;aspect-ratio:1}
.dc-board{width:100%;height:100%;display:block;overflow:visible;touch-action:none;cursor:grab;outline-offset:-4px}
.dc-score{left:75.5%;top:7%;width:23%;height:21.3%;background-image:url(${A}/ui/panel-score.svg);padding:2cqw}
.dc-scorelabel{font-size:2.2cqw;font-weight:bold}
.dc-scoreval{font-size:6.5cqw;color:#ffc458;font-weight:bold;line-height:1.1}
.dc-best{font-size:1.3cqw;color:#c8c1ae;border-top:1px solid #76643f;margin-top:.3cqw;padding-top:.6cqw}
.dc-rack{left:75.3%;top:33.2%;width:19%;height:47.5%;background-image:url(${A}/ui/dart-rack.svg);padding:1cqw}
.dc-racktitle{text-align:center;font-size:1.6cqw;border:1px solid #8b6a36;padding:.6cqw}
.dc-rackbuttons{display:flex;height:80%;gap:.3cqw;margin-top:.5cqw}
.dc-rackbutton{touch-action:none;cursor:grab!important;width:33%;height:100%;padding:0;background:none;border:1px solid transparent;border-radius:6px}
.dc-board:active,.dc-rackbutton:active{cursor:grabbing!important}
.dc-rackbutton.sel{border-color:#f8b849;box-shadow:0 0 9px #d9953370}
.dc-rackbutton svg{width:100%;height:100%}
.dc-gesture{position:absolute;left:72.6%;top:82.5%;width:25%;height:10.6%;background:linear-gradient(140deg,#1f211c,#0b0c09);border:1px solid #a28b5d;border-radius:12px;display:flex;align-items:center;justify-content:center;gap:.6cqw;padding:.8cqw;color:#f4d19a;font-size:1.65cqw;font-weight:bold;pointer-events:none}
.dc-gesture>span{font-size:3cqw}.dc-gesture small{display:block;margin-top:.6cqw;font-size:.85cqw;color:#b6aa92;font-weight:normal}
.dc-gesture.dragging{border-color:#ffc05a;box-shadow:0 0 14px #b47a2d55}
.dc-streak{left:31.1%;top:81.3%;width:37.1%;height:11.2%;background-image:url(${A}/ui/panel-streak.svg);display:flex;align-items:center;justify-content:space-evenly;color:#ffc05a;font-size:2cqw;font-weight:bold;padding-bottom:1cqw}
.dc-streak img{width:3cqw}
.dc-bar{position:absolute;left:3%;right:3%;bottom:14%;height:.5cqw;background:#2a2620;border-radius:3px;overflow:hidden}
.dc-bar b{display:block;height:100%;background:linear-gradient(90deg,#d9922f,#ffc05a);transition:width 300ms ease-out}
.dc-feedback{position:absolute;left:34%;top:18%;width:33%;pointer-events:none}
.dc-feedback img{width:100%}
.dc-ring{transform-box:fill-box;transform-origin:center;animation:dcRing 160ms ease-out both}
.dc-traj{animation:dcTraj 700ms linear infinite}
@keyframes dcTraj{to{stroke-dashoffset:-33}}
.dc-shake{animation:dcShake 360ms ease-out}
.ho-hit{animation:ho-hit 450ms ease-out both}
.ho-complete{animation:ho-complete 650ms ease-out both}
@keyframes dcRing{from{opacity:1;transform:scale(.4)}to{opacity:0;transform:scale(1.25)}}
@keyframes dcShake{0%,100%{transform:translateX(0)}20%{transform:translateX(-6px)}40%{transform:translateX(6px)}60%{transform:translateX(-4px)}80%{transform:translateX(4px)}}
@keyframes ho-hit{0%{opacity:0;transform:scale(.94)}20%,80%{opacity:1;transform:scale(1)}100%{opacity:0;transform:scale(1)}}
@keyframes ho-complete{0%{opacity:0;transform:scale(.96)}20%,85%{opacity:1;transform:scale(1)}100%{opacity:0;transform:scale(1)}}
@media(prefers-reduced-motion:reduce){.dc-traj,.dc-ring,.dc-shake,.ho-hit,.ho-complete{animation:none}.ho-hit,.ho-complete{opacity:1}.dc-bar b{transition:none}}
`;
