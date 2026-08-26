"use client";

import { useEffect, useMemo, useState } from "react";
import type { VocabWord } from "@/lib/types";

type GameKind = "match" | "timeattack" | "hearts";

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function VocabGame({ words, onDone }: { words: VocabWord[]; onDone: () => void }) {
  const [kind] = useState<GameKind>(() => shuffle<GameKind>(["match", "timeattack", "hearts"])[0]);

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

  return (
    <div className="w-full max-w-4xl flex flex-col gap-4">
      <p className="text-center text-sm text-gray-400 font-bold">오늘 배운 단어를 게임으로 복습해요!</p>
      {kind === "match" && <MatchGame words={words} onDone={onDone} />}
      {kind === "timeattack" && <TimeAttackGame words={words} onDone={onDone} />}
      {kind === "hearts" && <HeartsGame words={words} onDone={onDone} />}
    </div>
  );
}

// ---------- 1) 매칭 게임 ----------
function MatchGame({ words, onDone }: { words: VocabWord[]; onDone: () => void }) {
  const englishCards = useMemo(() => shuffle(words.map((w) => ({ id: w.id, text: w.english }))), [words]);
  const koreanCards = useMemo(() => shuffle(words.map((w) => ({ id: w.id, text: w.korean }))), [words]);
  const [selectedEnglish, setSelectedEnglish] = useState<string | null>(null);
  const [wrongPair, setWrongPair] = useState<string | null>(null);
  const [matched, setMatched] = useState<string[]>([]);

  useEffect(() => {
    if (matched.length === words.length && words.length > 0) {
      const t = setTimeout(onDone, 700);
      return () => clearTimeout(t);
    }
  }, [matched, words.length, onDone]);

  function pickEnglish(id: string) {
    if (matched.includes(id)) return;
    setSelectedEnglish(id);
    setWrongPair(null);
  }

  function pickKorean(id: string) {
    if (!selectedEnglish || matched.includes(id)) return;
    if (id === selectedEnglish) {
      setMatched((m) => [...m, id]);
      setSelectedEnglish(null);
    } else {
      setWrongPair(id);
      setTimeout(() => {
        setSelectedEnglish(null);
        setWrongPair(null);
      }, 500);
    }
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <p className="text-sm text-gray-500">{matched.length} / {words.length} 짝 맞춤</p>
      <div className="grid grid-cols-2 gap-4 w-full max-w-md">
        <div className="flex flex-col gap-2">
          {englishCards.map((c) => (
            <button
              key={c.id}
              onClick={() => pickEnglish(c.id)}
              disabled={matched.includes(c.id)}
              className={`rounded-xl px-3 py-3 font-bold border-2 transition ${
                matched.includes(c.id)
                  ? "bg-sky-50 border-sky-200 text-sky-300"
                  : selectedEnglish === c.id
                  ? "bg-sky-100 border-sky-500 text-sky-700"
                  : "bg-gray-50 border-gray-200 text-gray-700"
              }`}
            >
              {c.text}
            </button>
          ))}
        </div>
        <div className="flex flex-col gap-2">
          {koreanCards.map((c) => (
            <button
              key={c.id}
              onClick={() => pickKorean(c.id)}
              disabled={matched.includes(c.id)}
              className={`rounded-xl px-3 py-3 font-bold border-2 transition ${
                matched.includes(c.id)
                  ? "bg-sky-50 border-sky-200 text-sky-300"
                  : wrongPair === c.id
                  ? "bg-red-50 border-red-400 text-red-500"
                  : "bg-gray-50 border-gray-200 text-gray-700"
              }`}
            >
              {c.text}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------- 2) 타임어택 ----------
function TimeAttackGame({ words, onDone }: { words: VocabWord[]; onDone: () => void }) {
  const [timeLeft, setTimeLeft] = useState(30);
  const [score, setScore] = useState(0);
  const [queue] = useState(() => shuffle(words));
  const [qIndex, setQIndex] = useState(0);
  const [options, setOptions] = useState<string[]>(() => buildOptions(0));
  const [selected, setSelected] = useState<string | null>(null);
  const [finished, setFinished] = useState(false);

  function buildOptions(i: number) {
    const w = queue[i % queue.length];
    const distractors = shuffle(words.filter((x) => x.korean !== w.korean)).slice(0, 3).map((x) => x.korean);
    return shuffle([w.korean, ...distractors]);
  }

  useEffect(() => {
    if (finished) return;
    if (timeLeft <= 0) {
      setFinished(true);
      return;
    }
    const t = setTimeout(() => setTimeLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [timeLeft, finished]);

  useEffect(() => {
    if (finished) {
      const t = setTimeout(onDone, 900);
      return () => clearTimeout(t);
    }
  }, [finished, onDone]);

  function choose(opt: string) {
    if (selected || finished) return;
    const current = queue[qIndex % queue.length];
    setSelected(opt);
    if (opt === current.korean) setScore((s) => s + 1);
    setTimeout(() => {
      const nextIndex = qIndex + 1;
      setQIndex(nextIndex);
      setOptions(buildOptions(nextIndex));
      setSelected(null);
    }, 400);
  }

  if (finished) {
    return (
      <div className="flex flex-col items-center gap-3 py-8">
        <p className="text-xl font-bold text-gray-800">타임어택 종료!</p>
        <p className="text-gray-500">{score}개 맞혔어요</p>
      </div>
    );
  }

  const current = queue[qIndex % queue.length];

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex justify-between w-full max-w-sm text-sm font-bold">
        <span className="text-sky-600">남은 시간 {timeLeft}초</span>
        <span className="text-gray-500">점수 {score}</span>
      </div>
      <p className="text-3xl font-bold text-gray-800">{current.english}</p>
      <div className="flex flex-col gap-2 w-full max-w-sm">
        {options.map((opt) => {
          const isAnswer = opt === current.korean;
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
    </div>
  );
}

// ---------- 3) 하트 시스템 ----------
function HeartsGame({ words, onDone }: { words: VocabWord[]; onDone: () => void }) {
  const [queue] = useState(() => shuffle(words));
  const [index, setIndex] = useState(0);
  const [lives, setLives] = useState(3);
  const [selected, setSelected] = useState<string | null>(null);
  const [options, setOptions] = useState<string[]>(() => buildOptions(0));
  const [over, setOver] = useState(false);

  function buildOptions(i: number) {
    const w = queue[i];
    if (!w) return [];
    const distractors = shuffle(words.filter((x) => x.korean !== w.korean)).slice(0, 3).map((x) => x.korean);
    return shuffle([w.korean, ...distractors]);
  }

  useEffect(() => {
    if (over) {
      const t = setTimeout(onDone, 900);
      return () => clearTimeout(t);
    }
  }, [over, onDone]);

  const word = queue[index];
  const done = index >= queue.length;

  useEffect(() => {
    if (done && !over) setOver(true);
  }, [done, over]);

  if (over || done) {
    return (
      <div className="flex flex-col items-center gap-3 py-8">
        <p className="text-xl font-bold text-gray-800">
          {lives > 0 ? "게임 완료!" : "괜찮아요, 다음에 또 도전해요!"}
        </p>
        <p className="text-gray-500">남은 기회 {Math.max(lives, 0)}개</p>
      </div>
    );
  }

  function choose(opt: string) {
    if (selected) return;
    setSelected(opt);
    const isCorrect = opt === word.korean;
    const newLives = isCorrect ? lives : Math.max(0, lives - 1);
    if (!isCorrect) setLives(newLives);
    setTimeout(() => {
      if (newLives <= 0) {
        setOver(true);
        return;
      }
      const nextIndex = index + 1;
      setIndex(nextIndex);
      setOptions(buildOptions(nextIndex));
      setSelected(null);
    }, 500);
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex gap-1.5">
        {Array.from({ length: 3 }).map((_, i) => (
          <span
            key={i}
            className={`w-4 h-4 rounded-full inline-block ${i < lives ? "bg-red-400" : "bg-gray-200"}`}
          />
        ))}
      </div>
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
    </div>
  );
                  }
