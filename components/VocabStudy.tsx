"use client";

import { useState } from "react";
import type { VocabSet } from "@/lib/types";

type Mode = "flash" | "meaning" | "listen" | "spell";

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function speak(text: string) {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = "en-US";
  utter.rate = 0.85;
  window.speechSynthesis.speak(utter);
}

function normalize(s: string) {
  return s.toLowerCase().replace(/[.,!?;:"']/g, "").trim();
}

export default function VocabStudy({ set, onBack }: { set: VocabSet; onBack: () => void }) {
  const [mode, setMode] = useState<Mode | null>(null);

  return (
    <div className="w-full max-w-4xl flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <button onClick={mode ? () => setMode(null) : onBack} className="text-sm text-gray-400 underline">
          {mode ? "학습 방식 선택으로" : "단어장 목록"}
        </button>
        <h2 className="text-lg font-bold text-gray-800">{set.title}</h2>
        <span className="text-xs text-gray-400">{set.words.length}개</span>
      </div>

      {!mode && (
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => setMode("flash")}
            className="py-6 rounded-2xl bg-gray-50 border-2 border-transparent hover:border-sky-200 font-bold text-gray-700"
          >
            플래시카드
          </button>
          <button
            onClick={() => setMode("meaning")}
            className="py-6 rounded-2xl bg-gray-50 border-2 border-transparent hover:border-sky-200 font-bold text-gray-700"
          >
            뜻 고르기
          </button>
          <button
            onClick={() => setMode("listen")}
            className="py-6 rounded-2xl bg-gray-50 border-2 border-transparent hover:border-sky-200 font-bold text-gray-700"
          >
            듣고 맞추기
          </button>
          <button
            onClick={() => setMode("spell")}
            className="py-6 rounded-2xl bg-gray-50 border-2 border-transparent hover:border-sky-200 font-bold text-gray-700"
          >
            스펠링 쓰기
          </button>
        </div>
      )}

      {mode === "flash" && <FlashcardMode words={set.words} />}
      {mode === "meaning" && <MeaningQuizMode words={set.words} />}
      {mode === "listen" && <ListenQuizMode words={set.words} />}
      {mode === "spell" && <SpellMode words={set.words} />}
    </div>
  );
}

// ---------- 1) 플래시카드 ----------
function FlashcardMode({ words }: { words: VocabSet["words"] }) {
  const [order] = useState(() => shuffle(words.map((_, i) => i)));
  const [pos, setPos] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const word = words[order[pos]];

  function next() {
    setFlipped(false);
    setPos((p) => Math.min(p + 1, order.length - 1));
  }
  function prev() {
    setFlipped(false);
    setPos((p) => Math.max(p - 1, 0));
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <p className="text-sm text-gray-500">{pos + 1} / {order.length}</p>
      <div
        onClick={() => setFlipped((f) => !f)}
        className="w-full max-w-sm aspect-[4/3] rounded-3xl bg-gray-50 border-2 border-gray-200 flex flex-col items-center justify-center gap-3 cursor-pointer px-6"
      >
        {!flipped ? (
          <p className="text-3xl font-bold text-gray-800 text-center">{word.english}</p>
        ) : (
          <>
            <p className="text-2xl font-bold text-sky-700 text-center">{word.korean}</p>
            {word.pos && <p className="text-sm text-gray-400">({word.pos})</p>}
          </>
        )}
        <p className="text-xs text-gray-300 mt-2">눌러서 {flipped ? "단어" : "뜻"} 보기</p>
      </div>
      <div className="flex gap-2 w-full max-w-sm">
        <button
          onClick={() => speak(word.english)}
          className="flex-1 py-3 rounded-full bg-gray-700 text-white font-bold"
        >
          듣기
        </button>
      </div>
      <div className="flex justify-between w-full max-w-sm">
        <button onClick={prev} disabled={pos === 0} className="px-4 py-2 rounded-full bg-gray-100 disabled:opacity-40">
          이전
        </button>
        <button
          onClick={next}
          disabled={pos === order.length - 1}
          className="px-4 py-2 rounded-full bg-gray-100 disabled:opacity-40"
        >
          다음
        </button>
      </div>
    </div>
  );
}

// ---------- 2) 뜻 고르기 객관식 ----------
function MeaningQuizMode({ words }: { words: VocabSet["words"] }) {
  const [order] = useState(() => shuffle(words.map((_, i) => i)));
  const [pos, setPos] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const [options, setOptions] = useState<string[]>(() => buildOptions(0));

  const word = words[order[pos]];
  const done = pos >= order.length;

  function buildOptions(p: number) {
    const w = words[order[p]];
    if (!w) return [];
    const distractors = shuffle(words.filter((x) => x.korean !== w.korean))
      .slice(0, 3)
      .map((x) => x.korean);
    return shuffle([w.korean, ...distractors]);
  }

  function choose(opt: string) {
    if (selected) return;
    setSelected(opt);
    if (opt === word.korean) setScore((s) => s + 1);
  }

  function next() {
    const nextPos = pos + 1;
    setPos(nextPos);
    setSelected(null);
    setOptions(buildOptions(nextPos));
  }

  if (done) {
    return (
      <div className="flex flex-col items-center gap-4 py-10">
        <p className="text-xl font-bold text-gray-800">{order.length}개 중 {score}개를 맞혔어요</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <p className="text-sm text-gray-500">{pos + 1} / {order.length} · 맞은 개수 {score}</p>
      <p className="text-3xl font-bold text-gray-800">{word.english}</p>
      <div className="flex flex-col gap-2 w-full max-w-sm">
        {options.map((opt) => {
          const isAnswer = opt === word.korean;
          let style = "bg-gray-50 border-2 border-gray-200 text-gray-700";
          if (selected && isAnswer) style = "bg-sky-50 border-2 border-sky-500 text-sky-700 font-bold";
          else if (selected && opt === selected && !isAnswer) style = "bg-red-50 border-2 border-red-400 text-red-500";
          return (
            <button
              key={opt}
              onClick={() => choose(opt)}
              disabled={!!selected}
              className={`rounded-xl px-4 py-3 text-lg font-semibold transition ${style}`}
            >
              {opt}
            </button>
          );
        })}
      </div>
      {selected && (
        <button onClick={next} className="w-full max-w-sm py-3 rounded-full bg-sky-600 text-white font-bold">
          다음
        </button>
      )}
    </div>
  );
}

// ---------- 3) 듣고 단어 맞추기 (TTS로 듣고 뜻 선택) ----------
function ListenQuizMode({ words }: { words: VocabSet["words"] }) {
  const [order] = useState(() => shuffle(words.map((_, i) => i)));
  const [pos, setPos] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const [options, setOptions] = useState<string[]>(() => buildOptions(0));

  const word = words[order[pos]];
  const done = pos >= order.length;

  function buildOptions(p: number) {
    const w = words[order[p]];
    if (!w) return [];
    const distractors = shuffle(words.filter((x) => x.korean !== w.korean))
      .slice(0, 3)
      .map((x) => x.korean);
    return shuffle([w.korean, ...distractors]);
  }

  function choose(opt: string) {
    if (selected) return;
    setSelected(opt);
    if (opt === word.korean) setScore((s) => s + 1);
  }

  function next() {
    const nextPos = pos + 1;
    setPos(nextPos);
    setSelected(null);
    setOptions(buildOptions(nextPos));
  }

  if (done) {
    return (
      <div className="flex flex-col items-center gap-4 py-10">
        <p className="text-xl font-bold text-gray-800">{order.length}개 중 {score}개를 맞혔어요</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <p className="text-sm text-gray-500">{pos + 1} / {order.length} · 맞은 개수 {score}</p>
      <p className="text-center text-gray-500 text-sm font-bold">잘 듣고 알맞은 뜻을 골라보세요.</p>
      <button
        onClick={() => speak(word.english)}
        className="px-6 py-3 rounded-full bg-gray-700 text-white font-bold text-lg"
      >
        다시 듣기
      </button>
      <div className="flex flex-col gap-2 w-full max-w-sm">
        {options.map((opt) => {
          const isAnswer = opt === word.korean;
          let style = "bg-gray-50 border-2 border-gray-200 text-gray-700";
          if (selected && isAnswer) style = "bg-sky-50 border-2 border-sky-500 text-sky-700 font-bold";
          else if (selected && opt === selected && !isAnswer) style = "bg-red-50 border-2 border-red-400 text-red-500";
          return (
            <button
              key={opt}
              onClick={() => choose(opt)}
              disabled={!!selected}
              className={`rounded-xl px-4 py-3 text-lg font-semibold transition ${style}`}
            >
              {opt}
            </button>
          );
        })}
      </div>
      {selected && (
        <div className="flex flex-col items-center gap-2 w-full max-w-sm">
          <p className="text-lg font-bold text-gray-800">{word.english}</p>
          <button onClick={next} className="w-full py-3 rounded-full bg-sky-600 text-white font-bold">
            다음
          </button>
        </div>
      )}
    </div>
  );
}

// ---------- 4) 스펠링 쓰기 ----------
function SpellMode({ words }: { words: VocabSet["words"] }) {
  const [order] = useState(() => shuffle(words.map((_, i) => i)));
  const [pos, setPos] = useState(0);
  const [input, setInput] = useState("");
  const [checked, setChecked] = useState(false);
  const [correct, setCorrect] = useState(false);
  const [score, setScore] = useState(0);

  const word = words[order[pos]];
  const done = pos >= order.length;

  function check() {
    const isCorrect = normalize(input) === normalize(word.english);
    setCorrect(isCorrect);
    setChecked(true);
    if (isCorrect) setScore((s) => s + 1);
  }

  function next() {
    setPos((p) => p + 1);
    setInput("");
    setChecked(false);
  }

  if (done) {
    return (
      <div className="flex flex-col items-center gap-4 py-10">
        <p className="text-xl font-bold text-gray-800">{order.length}개 중 {score}개를 맞혔어요</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <p className="text-sm text-gray-500">{pos + 1} / {order.length} · 맞은 개수 {score}</p>
      <p className="text-2xl font-bold text-sky-700">{word.korean}</p>
      {word.pos && <p className="text-sm text-gray-400 -mt-3">({word.pos})</p>}
      <input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !checked) check();
        }}
        disabled={checked}
        placeholder="영어 단어를 입력하세요"
        className="w-full max-w-sm text-center text-xl rounded-xl border-2 border-gray-200 px-4 py-3"
      />
      {!checked ? (
        <button
          onClick={check}
          disabled={!input.trim()}
          className="w-full max-w-sm py-3 rounded-full bg-sky-600 text-white font-bold disabled:opacity-40"
        >
          확인
        </button>
      ) : (
        <div className="w-full max-w-sm flex flex-col items-center gap-2">
          <p className={correct ? "text-sky-600 font-bold" : "text-red-500 font-bold"}>
            {correct ? "맞았어요!" : `정답: ${word.english}`}
          </p>
          <button onClick={next} className="w-full py-3 rounded-full bg-sky-600 text-white font-bold">
            다음
          </button>
        </div>
      )}
    </div>
  );
}
