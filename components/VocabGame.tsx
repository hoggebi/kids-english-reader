"use client";

import { useEffect, useRef, useState } from "react";
import type { VocabWord } from "@/lib/types";
import { loadPet, getPetImagePath } from "@/lib/pet";

type GameKind = "hunt" | "feed" | "mole" | "runner";
type Feedback = "correct" | "wrong" | null;

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const GAME_INFO: { kind: GameKind; title: string; desc: string; emoji: string }[] = [
  { kind: "hunt", title: "단어 사냥", desc: "떨어지는 단어를 탭해서 잡아요", emoji: "🎯" },
  { kind: "feed", title: "바구니 담기", desc: "맞는 단어를 끌어서 바구니에 담아요", emoji: "🧺" },
  { kind: "mole", title: "두더지 잡기", desc: "튀어나온 정답을 빠르게 탭해요", emoji: "🐹" },
  { kind: "runner", title: "함께 달리기", desc: "갈림길에서 정답 쪽을 골라요", emoji: "🏃" },
];

const THEME_BG: Record<GameKind, string> = {
  hunt: "bg-gradient-to-b from-sky-200 via-sky-50 to-white",
  feed: "bg-gradient-to-b from-lime-100 via-emerald-50 to-white",
  mole: "bg-gradient-to-b from-amber-100 via-yellow-50 to-white",
  runner: "bg-gradient-to-b from-orange-100 via-sky-100 to-white",
};

// 공통 애니메이션 정의 (게임 화면에서 한 번만 렌더)
function GameStyles() {
  return (
    <style>{`
      @keyframes particlePop {
        0% { transform: translate(-50%, -50%) scale(0.6); opacity: 1; }
        100% { transform: translate(calc(-50% + var(--dx)), calc(-50% + var(--dy))) scale(1.2); opacity: 0; }
      }
      @keyframes comboPop {
        0% { transform: translate(-50%, -50%) scale(0.5); opacity: 0; }
        30% { transform: translate(-50%, -50%) scale(1.3); opacity: 1; }
        100% { transform: translate(-50%, -60%) scale(1); opacity: 0; }
      }
      @keyframes starPop {
        0% { transform: scale(0) rotate(-20deg); opacity: 0; }
        60% { transform: scale(1.3) rotate(10deg); }
        100% { transform: scale(1) rotate(0deg); opacity: 1; }
      }
      @keyframes bounceCorrect {
        0%, 100% { transform: translateY(0) scale(1); }
        50% { transform: translateY(-10px) scale(1.15); }
      }
      @keyframes wobbleWrong {
        0%, 100% { transform: rotate(0deg); }
        25% { transform: rotate(-10deg); }
        75% { transform: rotate(10deg); }
      }
      @keyframes runBob {
        0%, 100% { transform: translateY(0); }
        50% { transform: translateY(-6px); }
      }
      @keyframes malletHit {
        0% { transform: translate(30%, -90%) rotate(-45deg); opacity: 0; }
        35% { transform: translate(0%, -10%) rotate(5deg); opacity: 1; }
        55% { transform: translate(0%, 5%) rotate(15deg); }
        100% { transform: translate(30%, -90%) rotate(-45deg); opacity: 0; }
      }
      .particle { position: absolute; left: 50%; top: 50%; animation: particlePop 0.7s ease-out forwards; }
      .combo-badge { position: absolute; left: 50%; top: 12%; animation: comboPop 0.7s ease-out forwards; }
      .star-pop { animation: starPop 0.5s ease-out forwards; }
      .char-correct { animation: bounceCorrect 0.5s ease-out; }
      .char-wrong { animation: wobbleWrong 0.4s ease-out; }
      .run-bob { animation: runBob 0.4s ease-in-out infinite; }
      .mallet-hit { animation: malletHit 0.45s ease-out; transform-origin: 70% 30%; }
      @media (prefers-reduced-motion: reduce) {
        .particle, .combo-badge, .star-pop, .char-correct, .char-wrong, .run-bob, .mallet-hit { animation: none; }
      }
    `}</style>
  );
}

// ---------- 사운드 (Web Audio, 파일 없이 즉석 생성) ----------
let sharedCtx: AudioContext | null = null;
function getAudioCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!sharedCtx) {
    const Ctor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    sharedCtx = new Ctor();
  }
  return sharedCtx;
}

function playTone(kind: "correct" | "wrong") {
  const ctx = getAudioCtx();
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);
  const now = ctx.currentTime;
  gain.gain.setValueAtTime(0.16, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
  if (kind === "correct") {
    osc.frequency.setValueAtTime(523.25, now);
    osc.frequency.setValueAtTime(783.99, now + 0.1);
  } else {
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.exponentialRampToValueAtTime(110, now + 0.25);
  }
  osc.start(now);
  osc.stop(now + 0.3);
}

// ---------- 정답/오답 파티클 ----------
function Particles({ trigger }: { trigger: number }) {
  const [items, setItems] = useState<{ id: number; dx: number; dy: number; emoji: string }[]>([]);
  useEffect(() => {
    if (trigger === 0) return;
    const emojis = ["⭐", "✨", "🎉"];
    const next = Array.from({ length: 8 }, (_, i) => ({
      id: Date.now() + i,
      dx: (Math.random() - 0.5) * 160,
      dy: -Math.random() * 110 - 30,
      emoji: emojis[Math.floor(Math.random() * emojis.length)],
    }));
    setItems(next);
    const t = setTimeout(() => setItems([]), 750);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trigger]);

  return (
    <div className="pointer-events-none absolute inset-0 overflow-visible z-20">
      {items.map((p) => (
        <span
          key={p.id}
          className="particle text-2xl"
          style={{ ["--dx" as string]: `${p.dx}px`, ["--dy" as string]: `${p.dy}px` }}
        >
          {p.emoji}
        </span>
      ))}
    </div>
  );
}

function ComboBadge({ combo }: { combo: number }) {
  if (combo < 2) return null;
  return (
    <div key={combo} className="combo-badge text-sky-500 font-black text-xl z-20 -translate-x-1/2">
      {combo} 콤보!
    </div>
  );
}

// ---------- 결과 화면 (별점) ----------
function ResultScreen({
  correct,
  total,
  onDone,
}: {
  correct: number;
  total: number;
  onDone: () => void;
}) {
  const [pet] = useState(() => loadPet());
  const ratio = total > 0 ? correct / total : 0;
  const stars = ratio >= 0.9 ? 3 : ratio >= 0.6 ? 2 : ratio > 0 ? 1 : 0;

  useEffect(() => {
    const t = setTimeout(onDone, 2000);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <div className="flex flex-col items-center gap-3 py-10">
      <div className="flex gap-1 text-5xl">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className={i < stars ? "star-pop" : "opacity-20"}
            style={{ animationDelay: `${i * 0.15}s` }}
          >
            ⭐
          </span>
        ))}
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={getPetImagePath(pet)} alt="캐릭터" className="w-20 h-20 object-contain" />
      <p className="text-lg font-bold text-gray-800">
        {total}개 중 {correct}개 맞혔어요!
      </p>
    </div>
  );
}

function buildOptions(words: VocabWord[], target: VocabWord, count = 3) {
  const distractors = shuffle(words.filter((w) => w.id !== target.id)).slice(0, count - 1);
  return shuffle([target, ...distractors]);
}

export default function VocabGame({ words, onDone }: { words: VocabWord[]; onDone: () => void }) {
  const [kind, setKind] = useState<GameKind | null>(null);

  if (words.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 py-10">
        <p className="text-gray-400">오늘 복습할 단어가 없어요.</p>
        <button onClick={onDone} className="px-6 py-2 rounded-full bg-sky-600 text-white font-bold">
          확인
        </button>
      </div>
    );
  }

  if (!kind) {
    return (
      <div className="w-full max-w-4xl flex flex-col gap-4">
        <p className="text-center text-sm text-gray-400 font-bold">어떤 게임으로 복습할까요?</p>
        <div className="grid grid-cols-2 gap-3">
          {GAME_INFO.map((g) => (
            <button
              key={g.kind}
              onClick={() => setKind(g.kind)}
              className="flex flex-col items-center gap-1 py-6 rounded-2xl bg-gray-50 border-2 border-transparent hover:border-sky-300 active:scale-95 transition"
            >
              <span className="text-4xl">{g.emoji}</span>
              <span className="font-bold text-gray-800">{g.title}</span>
              <span className="text-xs text-gray-400 text-center px-2">{g.desc}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-4xl flex flex-col gap-4">
      <GameStyles />
      <button onClick={() => setKind(null)} className="self-start text-sm text-gray-400 underline">
        게임 다시 고르기
      </button>
      {kind === "hunt" && <HuntGame words={words} onDone={onDone} />}
      {kind === "feed" && <FeedGame words={words} onDone={onDone} />}
      {kind === "mole" && <MoleGame words={words} onDone={onDone} />}
      {kind === "runner" && <RunnerGame words={words} onDone={onDone} />}
    </div>
  );
}

// ---------- 1) 단어 사냥: 낙하산 타고 떨어지는 정답 탭 ----------
function HuntGame({ words, onDone }: { words: VocabWord[]; onDone: () => void }) {
  const [pet] = useState(() => loadPet());
  const [queue] = useState(() => shuffle(words));
  const [index, setIndex] = useState(0);
  const [options, setOptions] = useState(() => buildOptions(words, queue[0], 3));
  const [positions, setPositions] = useState<number[]>([10, 45, 80]);
  const [fallY, setFallY] = useState(0);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [combo, setCombo] = useState(0);
  const [particleTrigger, setParticleTrigger] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);

  const current = queue[index];
  const done = index >= queue.length;

  useEffect(() => {
    if (done || feedback) return;
    const t = setInterval(() => setFallY((y) => Math.min(100, y + 2)), 80);
    return () => clearInterval(t);
  }, [done, feedback]);

  useEffect(() => {
    if (fallY >= 100 && !feedback) goNext();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fallY]);

  function goNext() {
    const next = index + 1;
    setIndex(next);
    setFallY(0);
    setFeedback(null);
    if (queue[next]) {
      setOptions(buildOptions(words, queue[next], 3));
      setPositions(shuffle([10, 45, 80]));
    }
  }

  function tap(w: VocabWord) {
    if (feedback) return;
    const ok = w.id === current.id;
    playTone(ok ? "correct" : "wrong");
    setFeedback(ok ? "correct" : "wrong");
    if (ok) {
      setCombo((c) => c + 1);
      setCorrectCount((c) => c + 1);
      setParticleTrigger((t) => t + 1);
    } else {
      setCombo(0);
    }
    setTimeout(goNext, 500);
  }

  if (done) return <ResultScreen correct={correctCount} total={queue.length} onDone={onDone} />;

  return (
    <div className={`relative rounded-3xl overflow-hidden p-3 flex flex-col items-center gap-3 ${THEME_BG.hunt}`}>
      <p className="text-sm text-gray-500">
        {index + 1} / {queue.length}
      </p>
      <p className="text-lg font-bold text-sky-700">🎯 &quot;{current.korean}&quot; 을(를) 찾아 탭!</p>
      <div className="relative w-full max-w-sm h-72 rounded-2xl bg-white/60 border-2 border-gray-200 overflow-hidden">
        <Particles trigger={particleTrigger} />
        <ComboBadge combo={combo} />
        {options.map((w, i) => {
          const isCaught = feedback === "correct" && w.id === current.id;
          return (
            <button
              key={w.id}
              onClick={() => tap(w)}
              style={
                isCaught
                  ? { left: "50%", bottom: "8%", top: "auto" }
                  : { left: `${positions[i]}%`, top: `${fallY}%` }
              }
              className={`absolute -translate-x-1/2 flex flex-col items-center transition-all duration-500 ${
                isCaught ? "scale-75 opacity-0" : ""
              }`}
            >
              <span className="text-lg -mb-1">🪂</span>
              <span
                className={`px-4 py-3 rounded-xl font-extrabold text-lg border-2 ${
                  feedback && w.id === current.id
                    ? "bg-sky-100 border-sky-500 text-sky-700"
                    : feedback === "wrong" && w.id !== current.id
                    ? "bg-gray-50 border-gray-200 text-gray-300"
                    : "bg-white border-sky-200 text-gray-700 shadow"
                }`}
              >
                {w.english}
              </span>
            </button>
          );
        })}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={getPetImagePath(pet)}
          alt="캐릭터"
          className={`absolute bottom-1 left-1/2 -translate-x-1/2 w-12 h-12 object-contain ${
            feedback === "correct" ? "char-correct" : feedback === "wrong" ? "char-wrong" : ""
          }`}
        />
      </div>
    </div>
  );
}

// ---------- 2) 바구니 담기: 드래그해서 바구니에 넣기 ----------
function FeedGame({ words, onDone }: { words: VocabWord[]; onDone: () => void }) {
  const [pet] = useState(() => loadPet());
  const [queue] = useState(() => shuffle(words));
  const [index, setIndex] = useState(0);
  const [options, setOptions] = useState(() => buildOptions(words, queue[0], 3));
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragPos, setDragPos] = useState<{ x: number; y: number } | null>(null);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [combo, setCombo] = useState(0);
  const [particleTrigger, setParticleTrigger] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const basketRef = useRef<HTMLDivElement>(null);

  const current = queue[index];
  const done = index >= queue.length;

  function goNext() {
    const next = index + 1;
    setIndex(next);
    setFeedback(null);
    if (queue[next]) setOptions(buildOptions(words, queue[next], 3));
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!dragId) return;
    setDragPos({ x: e.clientX, y: e.clientY });
  }

  function onPointerUp() {
    if (!dragId || !dragPos || !basketRef.current) {
      setDragId(null);
      return;
    }
    const rect = basketRef.current.getBoundingClientRect();
    const inside =
      dragPos.x >= rect.left && dragPos.x <= rect.right && dragPos.y >= rect.top && dragPos.y <= rect.bottom;
    if (inside) {
      const ok = dragId === current.id;
      playTone(ok ? "correct" : "wrong");
      setFeedback(ok ? "correct" : "wrong");
      if (ok) {
        setCombo((c) => c + 1);
        setCorrectCount((c) => c + 1);
        setParticleTrigger((t) => t + 1);
      } else {
        setCombo(0);
      }
      setTimeout(goNext, 500);
    }
    setDragId(null);
    setDragPos(null);
  }

  if (done) return <ResultScreen correct={correctCount} total={queue.length} onDone={onDone} />;

  return (
    <div
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      className={`relative rounded-3xl overflow-hidden p-3 flex flex-col items-center gap-5 select-none touch-none ${THEME_BG.feed}`}
    >
      <Particles trigger={particleTrigger} />
      <ComboBadge combo={combo} />
      <p className="text-sm text-gray-500">
        {index + 1} / {queue.length}
      </p>

      <div
        ref={basketRef}
        className={`relative flex flex-col items-center transition-transform duration-300 ${
          feedback === "correct" ? "scale-110" : ""
        } ${feedback === "correct" ? "char-correct" : feedback === "wrong" ? "char-wrong" : ""}`}
      >
        {/* 캐릭터 머리 위 바구니 (실제 이미지) */}
        <div className="relative z-10 -mb-8 w-20 h-16">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/basket.png" alt="바구니" className="w-20 h-16 object-contain" />
          {correctCount > 0 && (
            <div className="absolute top-1 left-1/2 -translate-x-1/2 flex -space-x-2">
              {Array.from({ length: Math.min(correctCount, 6) }).map((_, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={i} src="/bread.png" alt="빵" className="w-6 h-3.5 object-contain" />
              ))}
            </div>
          )}
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={getPetImagePath(pet)} alt="캐릭터" className="w-24 h-24 object-contain" />
      </div>
      <p className="text-lg font-bold text-sky-700">{current.korean}</p>
      <div className="flex gap-0.5 flex-wrap justify-center">
        {options.map((w) => (
          <div
            key={w.id}
            onPointerDown={(e) => {
              setDragId(w.id);
              setDragPos({ x: e.clientX, y: e.clientY });
            }}
            style={
              dragId === w.id && dragPos
                ? { position: "fixed", left: dragPos.x - 88, top: dragPos.y - 44, zIndex: 50 }
                : undefined
            }
            className={`relative w-44 h-24 flex items-center justify-center cursor-grab active:cursor-grabbing ${
              dragId === w.id ? "scale-110" : ""
            }`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/bread.png" alt="빵" className="absolute inset-0 w-full h-full object-contain select-none" />
            <span className="relative text-lg font-extrabold text-amber-900 text-center leading-tight px-2">
              {w.english}
            </span>
          </div>
        ))}
      </div>
      <p className="text-xs text-gray-400">빵을 바구니에 끌어다 놓으세요</p>
    </div>
  );
}

// ---------- 3) 두더지 잡기 ----------
function MoleGame({ words, onDone }: { words: VocabWord[]; onDone: () => void }) {
  const [queue] = useState(() => shuffle(words));
  const [index, setIndex] = useState(0);
  const holes = 3;
  const [visible, setVisible] = useState<Record<number, VocabWord>>({});
  const [selected, setSelected] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [combo, setCombo] = useState(0);
  const [particleTrigger, setParticleTrigger] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [shake, setShake] = useState(false);
  const [hitSlot, setHitSlot] = useState<number | null>(null);

  const current = queue[index];
  const done = index >= queue.length;

  useEffect(() => {
    if (done || !current) return;
    const decoys = shuffle(words.filter((w) => w.id !== current.id)).slice(0, holes - 1);
    const pool = shuffle([current, ...decoys]);
    const slots = shuffle(Array.from({ length: holes }, (_, i) => i)).slice(0, pool.length);
    const map: Record<number, VocabWord> = {};
    slots.forEach((slot, i) => (map[slot] = pool[i]));
    setVisible(map);
    setSelected(null);
    setFeedback(null);
    setHitSlot(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, done]);

  function tap(slot: number) {
    if (selected !== null || !visible[slot]) return;
    setSelected(slot);
    setHitSlot(slot);
    const ok = visible[slot].id === current.id;
    playTone(ok ? "correct" : "wrong");
    setFeedback(ok ? "correct" : "wrong");
    if (ok) {
      setCombo((c) => c + 1);
      setCorrectCount((c) => c + 1);
      setParticleTrigger((t) => t + 1);
    } else {
      setCombo(0);
      setShake(true);
      setTimeout(() => setShake(false), 300);
    }
    setTimeout(() => setIndex((i) => i + 1), 500);
  }

  if (done) return <ResultScreen correct={correctCount} total={queue.length} onDone={onDone} />;

  return (
    <div
      className={`relative rounded-3xl overflow-hidden p-3 flex flex-col items-center gap-4 ${THEME_BG.mole} ${
        shake ? "animate-pulse" : ""
      }`}
    >
      <Particles trigger={particleTrigger} />
      <ComboBadge combo={combo} />
      <p className="text-sm text-gray-500">
        {index + 1} / {queue.length}
      </p>
      <p className="text-lg font-bold text-sky-700">&quot;{current.korean}&quot; 이(가) 나온 구멍을 탭!</p>
      <div className="grid grid-cols-3 gap-8 w-full max-w-lg">
        {Array.from({ length: holes }, (_, slot) => {
          const w = visible[slot];
          const isPicked = selected === slot;
          const isAnswerSlot = w?.id === current.id;
          let ringStyle = "";
          if (isPicked && isAnswerSlot) ringStyle = "ring-4 ring-sky-400 rounded-2xl";
          if (isPicked && !isAnswerSlot) ringStyle = "ring-4 ring-red-400 rounded-2xl";
          return (
            <button
              key={slot}
              onClick={() => tap(slot)}
              className={`relative aspect-square flex items-end justify-center ${ringStyle}`}
            >
              {/* 구멍 (두더지 아래쪽) */}
              <div
                className="absolute bottom-2 w-[68%] h-[28%] rounded-[50%]"
                style={{
                  background:
                    "radial-gradient(ellipse at 50% 40%, #5c3a1e 0%, #3f2712 70%, #2c1a0b 100%)",
                  boxShadow: "inset 0 3px 6px rgba(0,0,0,0.5)",
                }}
              />
              {w && (
                <div className="relative w-[96%] mb-[6%] animate-bounce">
                  <div className="relative w-full flex justify-center">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/mole.png" alt="두더지" className="w-full object-contain" />
                    <span className="absolute top-[11%] w-[58%] text-center text-base font-extrabold text-amber-900 leading-tight break-words">
                      {w.english}
                    </span>
                  </div>
                </div>
              )}
              {/* 뿅망치: 탭한 두더지 머리 위로 실제로 내려침 */}
              {hitSlot === slot && (
                <div className="absolute -top-4 right-2 w-16 h-16 pointer-events-none mallet-hit">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/mollet.png" alt="뿅망치" className="w-full h-full object-contain" />
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ---------- 4) 함께 달리기: 갈림길 선택 ----------
function RunnerGame({ words, onDone }: { words: VocabWord[]; onDone: () => void }) {
  const [pet] = useState(() => loadPet());
  const [queue] = useState(() => shuffle(words));
  const [index, setIndex] = useState(0);
  const [options, setOptions] = useState(() => buildOptions(words, queue[0], 2));
  const [progress, setProgress] = useState(0);
  const [choice, setChoice] = useState<"left" | "right" | null>(null);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [combo, setCombo] = useState(0);
  const [particleTrigger, setParticleTrigger] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);

  const current = queue[index];
  const done = index >= queue.length;

  useEffect(() => {
    if (done || choice) return;
    const t = setInterval(() => setProgress((p) => Math.min(100, p + 2.5)), 80);
    return () => clearInterval(t);
  }, [done, choice]);

  useEffect(() => {
    if (progress >= 100 && !choice) goNext();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [progress]);

  function goNext() {
    const next = index + 1;
    setIndex(next);
    setProgress(0);
    setChoice(null);
    setFeedback(null);
    if (queue[next]) setOptions(buildOptions(words, queue[next], 2));
  }

  function pick(side: "left" | "right", w: VocabWord) {
    if (choice) return;
    setChoice(side);
    const ok = w.id === current.id;
    playTone(ok ? "correct" : "wrong");
    setFeedback(ok ? "correct" : "wrong");
    if (ok) {
      setCombo((c) => c + 1);
      setCorrectCount((c) => c + 1);
      setParticleTrigger((t) => t + 1);
    } else {
      setCombo(0);
    }
    setTimeout(goNext, 500);
  }

  if (done) return <ResultScreen correct={correctCount} total={queue.length} onDone={onDone} />;

  const [left, right] = options;

  return (
    <div className={`relative rounded-3xl overflow-hidden p-3 flex flex-col items-center gap-4 ${THEME_BG.runner}`}>
      <Particles trigger={particleTrigger} />
      <ComboBadge combo={combo} />
      <p className="text-sm text-gray-500">
        {index + 1} / {queue.length}
      </p>
      <div className="relative w-full max-w-sm h-28">
        <div className="absolute bottom-2 left-0 right-0 h-2 rounded-full bg-white/60 overflow-hidden">
          <div className="h-full bg-sky-400 transition-all" style={{ width: `${progress}%` }} />
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={getPetImagePath(pet)}
          alt="캐릭터"
          className={`absolute bottom-3 w-24 h-24 object-contain transition-all duration-100 ${
            choice ? (feedback === "correct" ? "char-correct" : "char-wrong") : "run-bob"
          }`}
          style={{ left: `calc(${progress}% - 48px)` }}
        />
        <span className="absolute bottom-2 right-0 text-2xl">🏁</span>
      </div>
      <p className="text-lg font-bold text-sky-700">{current.korean}</p>
      <div className="flex gap-4 w-full max-w-sm">
        <button
          onClick={() => pick("left", left)}
          disabled={!!choice}
          className={`flex-1 py-6 rounded-2xl font-bold border-2 transition ${
            choice === "left"
              ? left.id === current.id
                ? "bg-sky-100 border-sky-500 text-sky-700"
                : "bg-red-50 border-red-400 text-red-500"
              : "bg-white border-gray-200 text-gray-700"
          }`}
        >
          {left.english}
        </button>
        <button
          onClick={() => pick("right", right)}
          disabled={!!choice}
          className={`flex-1 py-6 rounded-2xl font-bold border-2 transition ${
            choice === "right"
              ? right.id === current.id
                ? "bg-sky-100 border-sky-500 text-sky-700"
                : "bg-red-50 border-red-400 text-red-500"
              : "bg-white border-gray-200 text-gray-700"
          }`}
        >
          {right.english}
        </button>
      </div>
    </div>
  );
}
