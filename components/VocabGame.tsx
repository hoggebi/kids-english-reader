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
  { kind: "feed", title: "먹이주기", desc: "맞는 단어를 끌어서 먹여줘요", emoji: "🍎" },
  { kind: "mole", title: "두더지 잡기", desc: "튀어나온 정답을 빠르게 탭해요", emoji: "🐹" },
  { kind: "runner", title: "함께 달리기", desc: "갈림길에서 정답 쪽을 골라요", emoji: "🏃" },
];

// ---------- 캐릭터 말풍선 + 이미지 (공통) ----------
const CHEER_LINES = ["잘했어!", "완전 최고야!", "역시 우리 친구!", "그렇지, 바로 그거야!"];
const MISS_LINES = ["괜찮아, 다시 해보자!", "아깝다!", "다음엔 꼭 맞히자!", "힘내, 할 수 있어!"];
const IDLE_LINE = "같이 복습해볼까?";

function useCharacterLine(feedback: Feedback) {
  const [line, setLine] = useState(IDLE_LINE);
  useEffect(() => {
    if (feedback === "correct") {
      setLine(CHEER_LINES[Math.floor(Math.random() * CHEER_LINES.length)]);
    } else if (feedback === "wrong") {
      setLine(MISS_LINES[Math.floor(Math.random() * MISS_LINES.length)]);
    }
  }, [feedback]);
  return line;
}

function GameCharacter({ feedback }: { feedback: Feedback }) {
  const [pet] = useState(() => loadPet());
  const line = useCharacterLine(feedback);

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative">
        <div className="bg-white border-2 border-sky-200 rounded-2xl px-3 py-1.5 shadow-sm">
          <p className="text-xs font-bold text-gray-700 whitespace-nowrap">{line}</p>
        </div>
        <div className="absolute left-1/2 -translate-x-1/2 -bottom-1.5 w-2.5 h-2.5 bg-white border-r-2 border-b-2 border-sky-200 rotate-45" />
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={getPetImagePath(pet)}
        alt="캐릭터"
        className={`w-16 h-16 object-contain transition-transform duration-300 ${
          feedback === "correct" ? "scale-110" : feedback === "wrong" ? "-rotate-6" : ""
        }`}
      />
    </div>
  );
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

function EndScreen({ text }: { text: string }) {
  return (
    <div className="flex flex-col items-center gap-3 py-10">
      <span className="text-5xl">🎉</span>
      <p className="text-xl font-bold text-gray-800">{text}</p>
    </div>
  );
}

function buildOptions(words: VocabWord[], target: VocabWord, count = 3) {
  const distractors = shuffle(words.filter((w) => w.id !== target.id)).slice(0, count - 1);
  return shuffle([target, ...distractors]);
}

// ---------- 1) 단어 사냥: 떨어지는 정답 탭 ----------
function HuntGame({ words, onDone }: { words: VocabWord[]; onDone: () => void }) {
  const [queue] = useState(() => shuffle(words));
  const [index, setIndex] = useState(0);
  const [options, setOptions] = useState(() => buildOptions(words, queue[0], 3));
  const [positions, setPositions] = useState<number[]>([10, 45, 80]);
  const [fallY, setFallY] = useState(0);
  const [feedback, setFeedback] = useState<Feedback>(null);

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

  useEffect(() => {
    if (done) {
      const t = setTimeout(onDone, 800);
      return () => clearTimeout(t);
    }
  }, [done, onDone]);

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
    setFeedback(ok ? "correct" : "wrong");
    setTimeout(goNext, 500);
  }

  if (done) return <EndScreen text="다 잡았어요!" />;

  return (
    <div className="flex flex-col items-center gap-3">
      <GameCharacter feedback={feedback} />
      <p className="text-sm text-gray-500">
        {index + 1} / {queue.length}
      </p>
      <p className="text-lg font-bold text-sky-700">&quot;{current.korean}&quot; 을(를) 찾아 탭!</p>
      <div className="relative w-full max-w-sm h-72 rounded-2xl bg-gradient-to-b from-sky-50 to-white border-2 border-gray-200 overflow-hidden">
        {options.map((w, i) => (
          <button
            key={w.id}
            onClick={() => tap(w)}
            style={{ left: `${positions[i]}%`, top: `${fallY}%` }}
            className={`absolute -translate-x-1/2 px-3 py-2 rounded-xl font-bold border-2 transition-colors ${
              feedback && w.id === current.id
                ? "bg-sky-100 border-sky-500 text-sky-700"
                : feedback === "wrong" && w.id !== current.id
                ? "bg-gray-50 border-gray-200 text-gray-300"
                : "bg-white border-sky-200 text-gray-700 shadow"
            }`}
          >
            {w.english}
          </button>
        ))}
      </div>
    </div>
  );
}

// ---------- 2) 먹이주기: 드래그해서 캐릭터 입에 넣기 ----------
function FeedGame({ words, onDone }: { words: VocabWord[]; onDone: () => void }) {
  const [pet] = useState(() => loadPet());
  const [queue] = useState(() => shuffle(words));
  const [index, setIndex] = useState(0);
  const [options, setOptions] = useState(() => buildOptions(words, queue[0], 3));
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragPos, setDragPos] = useState<{ x: number; y: number } | null>(null);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const mouthRef = useRef<HTMLDivElement>(null);
  const line = useCharacterLine(feedback);

  const current = queue[index];
  const done = index >= queue.length;

  useEffect(() => {
    if (done) {
      const t = setTimeout(onDone, 800);
      return () => clearTimeout(t);
    }
  }, [done, onDone]);

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
    if (!dragId || !dragPos || !mouthRef.current) {
      setDragId(null);
      return;
    }
    const rect = mouthRef.current.getBoundingClientRect();
    const inside =
      dragPos.x >= rect.left && dragPos.x <= rect.right && dragPos.y >= rect.top && dragPos.y <= rect.bottom;
    if (inside) {
      const ok = dragId === current.id;
      setFeedback(ok ? "correct" : "wrong");
      setTimeout(goNext, 500);
    }
    setDragId(null);
    setDragPos(null);
  }

  if (done) return <EndScreen text="배부르게 먹었어요!" />;

  return (
    <div
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      className="relative flex flex-col items-center gap-6 py-4 select-none touch-none"
    >
      <p className="text-sm text-gray-500">
        {index + 1} / {queue.length}
      </p>

      <div className="relative">
        <div className="bg-white border-2 border-sky-200 rounded-2xl px-3 py-1.5 shadow-sm">
          <p className="text-xs font-bold text-gray-700 whitespace-nowrap">{line}</p>
        </div>
        <div className="absolute left-1/2 -translate-x-1/2 -bottom-1.5 w-2.5 h-2.5 bg-white border-r-2 border-b-2 border-sky-200 rotate-45" />
      </div>

      <div
        ref={mouthRef}
        className={`w-28 h-28 rounded-full flex items-center justify-center border-4 overflow-hidden transition-transform duration-300 ${
          feedback === "correct"
            ? "bg-sky-100 border-sky-400 scale-110"
            : feedback === "wrong"
            ? "bg-red-100 border-red-400 -rotate-6"
            : "bg-gray-50 border-gray-300"
        }`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={getPetImagePath(pet)} alt="캐릭터" className="w-20 h-20 object-contain" />
      </div>
      <p className="text-lg font-bold text-sky-700">{current.korean}</p>
      <div className="flex gap-4 flex-wrap justify-center">
        {options.map((w) => (
          <div
            key={w.id}
            onPointerDown={(e) => {
              setDragId(w.id);
              setDragPos({ x: e.clientX, y: e.clientY });
            }}
            style={
              dragId === w.id && dragPos
                ? { position: "fixed", left: dragPos.x - 40, top: dragPos.y - 20, zIndex: 50 }
                : undefined
            }
            className={`px-4 py-3 rounded-xl bg-gray-50 border-2 border-gray-200 font-bold cursor-grab active:cursor-grabbing ${
              dragId === w.id ? "shadow-xl" : ""
            }`}
          >
            {w.english}
          </div>
        ))}
      </div>
      <p className="text-xs text-gray-300">단어를 캐릭터한테 끌어다 놓으세요</p>
    </div>
  );
}

// ---------- 3) 두더지 잡기 ----------
function MoleGame({ words, onDone }: { words: VocabWord[]; onDone: () => void }) {
  const [queue] = useState(() => shuffle(words));
  const [index, setIndex] = useState(0);
  const holes = 6;
  const [visible, setVisible] = useState<Record<number, VocabWord>>({});
  const [selected, setSelected] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<Feedback>(null);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, done]);

  useEffect(() => {
    if (done) {
      const t = setTimeout(onDone, 800);
      return () => clearTimeout(t);
    }
  }, [done, onDone]);

  function tap(slot: number) {
    if (selected !== null || !visible[slot]) return;
    setSelected(slot);
    const ok = visible[slot].id === current.id;
    setFeedback(ok ? "correct" : "wrong");
    setTimeout(() => setIndex((i) => i + 1), 500);
  }

  if (done) return <EndScreen text="다 잡았어요!" />;

  return (
    <div className="flex flex-col items-center gap-4">
      <GameCharacter feedback={feedback} />
      <p className="text-sm text-gray-500">
        {index + 1} / {queue.length}
      </p>
      <p className="text-lg font-bold text-sky-700">&quot;{current.korean}&quot; 이(가) 나온 구멍을 탭!</p>
      <div className="grid grid-cols-3 gap-3 w-full max-w-sm">
        {Array.from({ length: holes }, (_, slot) => {
          const w = visible[slot];
          const isPicked = selected === slot;
          const isAnswerSlot = w?.id === current.id;
          let style = "bg-gray-100 border-gray-200 text-gray-300";
          if (w) style = "bg-sky-50 border-sky-200 text-sky-700 font-bold animate-bounce";
          if (isPicked && isAnswerSlot) style = "bg-sky-100 border-sky-500 text-sky-700 font-bold";
          if (isPicked && !isAnswerSlot) style = "bg-red-50 border-red-400 text-red-500";
          return (
            <button
              key={slot}
              onClick={() => tap(slot)}
              className={`aspect-square rounded-full border-2 flex items-center justify-center text-sm px-1 text-center transition ${style}`}
            >
              {w ? w.english : ""}
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

  useEffect(() => {
    if (done) {
      const t = setTimeout(onDone, 800);
      return () => clearTimeout(t);
    }
  }, [done, onDone]);

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
    setFeedback(w.id === current.id ? "correct" : "wrong");
    setTimeout(goNext, 500);
  }

  if (done) return <EndScreen text="완주했어요!" />;

  const [left, right] = options;

  return (
    <div className="flex flex-col items-center gap-4">
      <p className="text-sm text-gray-500">
        {index + 1} / {queue.length}
      </p>
      <div className="w-full max-w-sm h-3 rounded-full bg-gray-100 overflow-hidden">
        <div className="h-full bg-sky-400 transition-all" style={{ width: `${progress}%` }} />
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={getPetImagePath(pet)}
        alt="캐릭터"
        className={`w-16 h-16 object-contain transition-transform duration-300 ${
          feedback === "correct" ? "scale-110" : feedback === "wrong" ? "-rotate-6" : ""
        }`}
      />
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
              : "bg-gray-50 border-gray-200 text-gray-700"
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
              : "bg-gray-50 border-gray-200 text-gray-700"
          }`}
        >
          {right.english}
        </button>
      </div>
    </div>
  );
}
