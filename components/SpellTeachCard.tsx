"use client";

import { useEffect, useRef, useState } from "react";
import type { VocabWord } from "@/lib/types";

// Lesson 단어 학습 흐름 (한 단어당 한 카드):
//  1) 영어·한국어 소개 → 2) 철자를 한 글자씩 나타내며 강조(시연) → 3) 영어를 숨기고 섞인 글자를 순서대로 눌러 완성
//  - 공백/기호는 자동으로 표시하고, 반복 글자는 글자마다 별개의 타일이라 각각 고를 수 있다.
//  - 막히면 "철자 다시 보기"로 시연을 다시 보고 돌아온다. 올바르게 완성해야 다음 단어로 넘어간다.

type Phase = "intro" | "demo" | "build" | "done";
type Tile = { id: number; ch: string };

const DEMO_STEP_MS = 650;
const isLetter = (c: string) => /[A-Za-z]/.test(c);

function shuffleTiles(tiles: Tile[]): Tile[] {
  const a = [...tiles];
  for (let attempt = 0; attempt < 6; attempt++) {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    // 가능하면 정답 순서와 다르게 섞는다
    if (a.length < 2 || a.some((t, i) => t.ch !== tiles[i].ch)) break;
  }
  return a;
}

function speak(text: string) {
  try {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "en-US";
    u.rate = 0.85;
    window.speechSynthesis.speak(u);
  } catch {
    /* 음성이 안 되어도 학습은 진행된다 */
  }
}

export default function SpellTeachCard({
  word,
  isLast,
  onFinish,
}: {
  word: VocabWord;
  isLast: boolean;
  onFinish: (clean: boolean) => void;
}) {
  const chars = [...word.english];
  const letterPositions = chars.map((c, i) => (isLetter(c) ? i : -1)).filter((i) => i >= 0);
  const total = letterPositions.length;

  const [phase, setPhase] = useState<Phase>("intro");
  const [shown, setShown] = useState(0); // 시연에서 나타난 글자 수
  const [tiles] = useState<Tile[]>(() => shuffleTiles(letterPositions.map((p) => ({ id: p, ch: chars[p] }))));
  const [placed, setPlaced] = useState(0); // 맞게 놓은 글자 수
  const [usedIds, setUsedIds] = useState<number[]>([]);
  const [wrongTaps, setWrongTaps] = useState(0);
  const [wrongRun, setWrongRun] = useState(0); // 연속으로 막힌 횟수
  const [shakeId, setShakeId] = useState<number | null>(null);
  const [replays, setReplays] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 시연: 글자를 하나씩 나타낸다. 끝나면 잠시 보여준 뒤 만들기 단계로 간다.
  useEffect(() => {
    if (phase !== "demo") return;
    if (shown < total) {
      timer.current = setTimeout(() => setShown((n) => n + 1), shown === 0 ? 350 : DEMO_STEP_MS);
    } else {
      timer.current = setTimeout(() => setPhase("build"), 1400);
    }
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [phase, shown, total]);

  useEffect(() => {
    return () => {
      try {
        window.speechSynthesis?.cancel();
      } catch {
        /* ignore */
      }
    };
  }, []);

  function startDemo() {
    setShown(0);
    setPhase("demo");
  }

  function replayDemo() {
    setReplays((n) => n + 1);
    setWrongRun(0);
    startDemo();
  }

  function tapTile(t: Tile) {
    if (phase !== "build" || usedIds.includes(t.id)) return;
    const needed = chars[letterPositions[placed]];
    if (t.ch === needed) {
      const nextPlaced = placed + 1;
      setPlaced(nextPlaced);
      setUsedIds((u) => [...u, t.id]);
      setWrongRun(0);
      if (nextPlaced >= total) {
        setPhase("done");
        speak(word.english);
      }
    } else {
      setWrongTaps((n) => n + 1);
      setWrongRun((n) => n + 1);
      setShakeId(t.id);
      setTimeout(() => setShakeId((cur) => (cur === t.id ? null : cur)), 350);
    }
  }

  // 지금까지 맞춘 글자로 단어를 그린다. showAll=true면 영어 전체, 아니면 맞힌 글자만(나머지는 빈칸).
  function renderWord(opts: { visibleLetters: number; highlight?: number; fillAll?: boolean }) {
    let letterIdx = -1;
    return (
      <div className="flex flex-wrap items-end justify-center gap-x-1.5 gap-y-3" aria-label={opts.fillAll ? word.english : "철자 칸"}>
        {chars.map((c, i) => {
          if (!isLetter(c)) {
            // 공백·기호는 자동 표시
            return c === " " ? (
              <span key={i} className="w-6" aria-hidden />
            ) : (
              <span key={i} className="text-3xl font-black text-gray-500 pb-1">
                {c}
              </span>
            );
          }
          letterIdx += 1;
          const k = letterIdx;
          const visible = opts.fillAll || k < opts.visibleLetters;
          const hl = opts.highlight === k;
          return (
            <span
              key={i}
              className={`inline-flex items-center justify-center w-12 h-16 sm:w-14 sm:h-20 rounded-xl border-b-4 text-4xl sm:text-5xl font-black transition-all ${
                visible
                  ? hl
                    ? "bg-amber-300 border-amber-500 text-amber-900 scale-125"
                    : "bg-white border-sky-400 text-gray-800"
                  : "bg-gray-100 border-gray-300 text-transparent"
              }`}
            >
              {visible ? c : "_"}
            </span>
          );
        })}
      </div>
    );
  }

  const nextLabel = isLast ? "완료!" : "다음 단어";

  return (
    <div className="flex flex-col items-center gap-5" data-testid="spell-teach" data-phase={phase}>
      {phase === "intro" && (
        <>
          <p className="text-sm text-gray-500">새 단어</p>
          <div className="w-full max-w-md rounded-3xl bg-gray-50 border-2 border-gray-200 flex flex-col items-center justify-center gap-3 px-6 py-8">
            <p className="text-5xl font-black text-gray-800 text-center break-words">{word.english}</p>
            <p className="text-3xl font-bold text-sky-700 text-center">{word.korean}</p>
            {word.pos && <p className="text-sm text-gray-400">({word.pos})</p>}
          </div>
          <button onClick={() => speak(word.english)} className="w-full max-w-md min-h-[52px] rounded-full bg-gray-700 text-white font-bold text-lg">
            🔈 듣기
          </button>
          <button onClick={startDemo} className="w-full max-w-md min-h-[56px] rounded-full bg-sky-600 text-white font-bold text-lg">
            철자 보기
          </button>
        </>
      )}

      {phase === "demo" && (
        <>
          <p className="text-sm text-gray-500">철자를 잘 보세요</p>
          <p className="text-2xl font-bold text-sky-700">{word.korean}</p>
          <div className="w-full max-w-2xl rounded-3xl bg-gray-50 border-2 border-gray-200 px-4 py-8 min-h-[160px] flex items-center justify-center">
            {renderWord({ visibleLetters: shown, highlight: shown > 0 && shown <= total ? shown - 1 : undefined })}
          </div>
          <p className="text-sm text-gray-400">글자가 하나씩 나타나요</p>
        </>
      )}

      {phase === "build" && (
        <>
          <p className="text-sm text-gray-500">순서대로 눌러서 만들어 보세요</p>
          <p className="text-3xl font-bold text-sky-700 text-center">{word.korean}</p>
          {word.pos && <p className="text-sm text-gray-400 -mt-4">({word.pos})</p>}
          <div className="w-full max-w-2xl rounded-3xl bg-gray-50 border-2 border-gray-200 px-4 py-8 flex items-center justify-center">
            {renderWord({ visibleLetters: placed })}
          </div>
          <div className="flex flex-wrap justify-center gap-3 max-w-2xl" data-testid="tiles">
            {tiles.map((t) => {
              const used = usedIds.includes(t.id);
              return (
                <button
                  key={t.id}
                  onClick={() => tapTile(t)}
                  disabled={used}
                  aria-label={`글자 ${t.ch}`}
                  className={`min-w-[64px] min-h-[64px] rounded-2xl text-4xl font-black border-2 transition active:scale-95 ${
                    used
                      ? "bg-gray-100 border-gray-100 text-gray-300"
                      : shakeId === t.id
                        ? "bg-red-100 border-red-400 text-red-600 animate-pulse"
                        : "bg-white border-sky-300 text-gray-800 shadow"
                  }`}
                >
                  {t.ch}
                </button>
              );
            })}
          </div>
          {wrongTaps > 0 && <p className="text-sm font-bold text-rose-500">순서가 달라요. 다시 골라 보세요!</p>}
          <button
            onClick={replayDemo}
            className={`min-h-[52px] px-6 rounded-full font-bold text-lg ${
              wrongRun >= 2 ? "bg-amber-400 text-amber-950 animate-pulse" : "bg-gray-200 text-gray-700"
            }`}
          >
            👀 철자 다시 보기
          </button>
        </>
      )}

      {phase === "done" && (
        <>
          <p className="text-2xl font-black text-emerald-600">잘했어요! 🎉</p>
          <div className="w-full max-w-2xl rounded-3xl bg-emerald-50 border-2 border-emerald-300 px-4 py-8 flex flex-col items-center gap-3">
            {renderWord({ visibleLetters: total, fillAll: true })}
            <p className="text-2xl font-bold text-sky-700">{word.korean}</p>
          </div>
          <button onClick={() => speak(word.english)} className="w-full max-w-md min-h-[52px] rounded-full bg-gray-700 text-white font-bold text-lg">
            🔈 다시 듣기
          </button>
          <button
            onClick={() => onFinish(wrongTaps === 0)}
            data-testid="teach-next"
            className={`w-full max-w-md min-h-[56px] rounded-full text-white font-bold text-lg ${isLast ? "bg-emerald-600" : "bg-sky-600"}`}
          >
            {nextLabel}
          </button>
          {replays > 0 && <p className="text-xs text-gray-400">철자 다시 보기 {replays}번</p>}
        </>
      )}
    </div>
  );
}
