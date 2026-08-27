"use client";

import { useMemo, useEffect, useState } from "react";
import type { VocabSet, VocabWord, VocabDailySession } from "@/lib/types";
import {
  loadTodaySession,
  buildDailySession,
  saveTodaySession,
  recordAnswer,
  selectDailyWords,
} from "@/lib/vocabStorage";
import VocabGame from "./VocabGame";

type Mode = "hub" | "study" | "game";

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

export default function VocabStudy({ set, onBack }: { set: VocabSet; onBack: () => void }) {
  const [session, setSession] = useState<VocabDailySession | null>(null);
  const [mode, setMode] = useState<Mode>("hub");
  const [gameWords, setGameWords] = useState<VocabWord[]>([]);

  useEffect(() => {
    const existing = loadTodaySession(set.id);
    setSession(existing ?? buildDailySession(set));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [set.id]);

  if (!session) {
    return <p className="text-center text-gray-400 py-10">불러오는 중...</p>;
  }

  const studyDone = session.cards.length === 0 || session.phase === "done";

  // 학습하기: 오늘 처음이면 이어서, 이미 끝났으면(재학습) 카드를 처음부터 다시 보여줌
  function handleStudyEnter() {
    if (session!.phase === "done") {
      const restarted: VocabDailySession = { ...session!, cursor: 0, phase: "study" };
      saveTodaySession(restarted);
      setSession(restarted);
    }
    setMode("study");
  }

  // 게임하기: 오늘 학습에 나온 단어들로 게임 (오늘의 학습을 한 번은 마쳐야 눌림)
  function handleGameEnter() {
    const wordIds = Array.from(new Set(session!.cards.map((c) => c.wordId)));
    const words = set.words.filter((w) => wordIds.includes(w.id));
    setGameWords(words.length > 0 ? words : selectDailyWords(set));
    setMode("game");
  }

  // ---------- 허브 화면: 큰 탭 2개 ----------
  if (mode === "hub") {
    return (
      <div className="w-full max-w-4xl flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <button onClick={onBack} className="text-sm text-gray-400 underline">
            단어장 목록
          </button>
          <h2 className="text-lg font-bold text-gray-800">{set.title}</h2>
          <span className="w-10" />
        </div>

        <button
          onClick={handleStudyEnter}
          className="w-full py-7 rounded-3xl bg-sky-600 text-white font-bold text-lg active:scale-[0.98] transition flex flex-col items-center gap-1"
        >
          <span className="text-2xl">📖</span>
          {studyDone ? "학습 다시 하기" : "학습하기"}
        </button>

        <button
          onClick={handleGameEnter}
          disabled={!studyDone}
          className={`w-full py-7 rounded-3xl font-bold text-lg transition flex flex-col items-center gap-1 ${
            studyDone
              ? "bg-emerald-500 text-white active:scale-[0.98]"
              : "bg-gray-100 text-gray-400 cursor-not-allowed"
          }`}
        >
          <span className="text-2xl">🎮</span>
          게임하기
          {!studyDone && <span className="text-xs font-normal">오늘의 학습을 먼저 끝내야 열려요</span>}
        </button>

        <button
          onClick={() => {
            const fresh = buildDailySession(set);
            setSession(fresh);
            setMode("hub");
          }}
          className="text-sm text-gray-400 underline self-center mt-1"
        >
          오늘 학습 처음부터 다시
        </button>
      </div>
    );
  }

  // ---------- 게임하기 ----------
  if (mode === "game") {
    return <VocabGame words={gameWords} onDone={() => setMode("hub")} />;
  }

  // ---------- 학습하기 (카드 흐름) ----------
  if (session.cards.length === 0) {
    return (
      <div className="w-full max-w-4xl flex flex-col items-center gap-4 py-10">
        <p className="text-xl font-bold text-gray-800">오늘 복습할 단어가 없어요.</p>
        <button onClick={() => setMode("hub")} className="text-sm text-sky-600 font-bold underline">
          허브로 돌아가기
        </button>
      </div>
    );
  }

  if (session.cursor >= session.cards.length) {
    // 안전장치: 커서가 범위를 벗어나면 허브로
    setMode("hub");
    return null;
  }

  const card = session.cards[session.cursor];
  const word = set.words.find((w) => w.id === card.wordId);

  function advanceCard(wasCorrect?: boolean) {
    if (!session) return;
    if (typeof wasCorrect === "boolean" && card.mode !== "expose") {
      recordAnswer(set.id, card.wordId, wasCorrect);
    }
    const nextCursor = session.cursor + 1;
    const finished = nextCursor >= session.cards.length;
    const updated: VocabDailySession = {
      ...session,
      cursor: nextCursor,
      phase: finished ? "done" : "study",
    };
    saveTodaySession(updated);
    setSession(updated);
    if (finished) setMode("hub");
  }

  if (!word) {
    advanceCard();
    return null;
  }

  return (
    <div className="w-full max-w-4xl flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <button onClick={() => setMode("hub")} className="text-sm text-gray-400 underline">
          허브로
        </button>
        <h2 className="text-lg font-bold text-gray-800">{set.title}</h2>
        <span className="text-xs text-gray-400">
          {session.cursor + 1} / {session.cards.length}
        </span>
      </div>

      {card.mode === "expose" && <ExposureCard word={word} onNext={() => advanceCard()} />}
      {card.mode === "meaning" && (
        <MeaningCard words={set.words} word={word} onAnswer={(ok) => advanceCard(ok)} />
      )}
      {card.mode === "toEnglish" && (
        <ToEnglishCard words={set.words} word={word} onAnswer={(ok) => advanceCard(ok)} />
      )}
      {card.mode === "spell" && <SpellCard word={word} onAnswer={(ok) => advanceCard(ok)} />}
    </div>
  );
}

// ---------- 1) 노출: 영어+한글 뜻 동시에 보여주기 ----------
function ExposureCard({ word, onNext }: { word: VocabWord; onNext: () => void }) {
  return (
    <div className="flex flex-col items-center gap-4">
      <div className="w-full max-w-sm aspect-[4/3] rounded-3xl bg-gray-50 border-2 border-gray-200 flex flex-col items-center justify-center gap-3 px-6">
        <p className="text-3xl font-bold text-gray-800 text-center">{word.english}</p>
        <p className="text-2xl font-bold text-sky-700 text-center">{word.korean}</p>
        {word.pos && <p className="text-sm text-gray-400">({word.pos})</p>}
      </div>
      <button
        onClick={() => speak(word.english)}
        className="w-full max-w-sm py-3 rounded-full bg-gray-700 text-white font-bold"
      >
        듣기
      </button>
      <button onClick={onNext} className="w-full max-w-sm py-3 rounded-full bg-sky-600 text-white font-bold">
        다음
      </button>
    </div>
  );
}

function buildMeaningOptions(words: VocabWord[], target: VocabWord) {
  const distractors = shuffle(words.filter((w) => w.korean !== target.korean))
    .slice(0, 3)
    .map((w) => w.korean);
  return shuffle([target.korean, ...distractors]);
}

function buildEnglishOptions(words: VocabWord[], target: VocabWord) {
  const distractors = shuffle(words.filter((w) => w.english !== target.english))
    .slice(0, 3)
    .map((w) => w.english);
  return shuffle([target.english, ...distractors]);
}

// ---------- 2) 뜻고르기: 영어 보고 한글 뜻 선택 ----------
function MeaningCard({
  words,
  word,
  onAnswer,
}: {
  words: VocabWord[];
  word: VocabWord;
  onAnswer: (correct: boolean) => void;
}) {
  const [options] = useState(() => buildMeaningOptions(words, word));
  const [selected, setSelected] = useState<string | null>(null);

  function choose(opt: string) {
    if (selected) return;
    setSelected(opt);
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <p className="text-sm text-gray-500">뜻 고르기</p>
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
        <button
          onClick={() => onAnswer(selected === word.korean)}
          className="w-full max-w-sm py-3 rounded-full bg-sky-600 text-white font-bold"
        >
          다음
        </button>
      )}
    </div>
  );
}

// ---------- 3) 영어고르기: 한글 뜻 보고 영어 단어 선택 ----------
function ToEnglishCard({
  words,
  word,
  onAnswer,
}: {
  words: VocabWord[];
  word: VocabWord;
  onAnswer: (correct: boolean) => void;
}) {
  const [options] = useState(() => buildEnglishOptions(words, word));
  const [selected, setSelected] = useState<string | null>(null);

  function choose(opt: string) {
    if (selected) return;
    setSelected(opt);
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <p className="text-sm text-gray-500">영어 고르기</p>
      <p className="text-3xl font-bold text-sky-700">{word.korean}</p>
      {word.pos && <p className="text-sm text-gray-400 -mt-3">({word.pos})</p>}
      <div className="flex flex-col gap-2 w-full max-w-sm">
        {options.map((opt) => {
          const isAnswer = opt === word.english;
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
        <button
          onClick={() => onAnswer(selected === word.english)}
          className="w-full max-w-sm py-3 rounded-full bg-sky-600 text-white font-bold"
        >
          다음
        </button>
      )}
    </div>
  );
}

// ---------- 4) 스펠링: 배열형 / 빈칸채우기형 랜덤 ----------
function SpellCard({ word, onAnswer }: { word: VocabWord; onAnswer: (correct: boolean) => void }) {
  const [variant] = useState(() => (Math.random() < 0.5 ? "arrange" : "fill"));
  return variant === "arrange" ? (
    <SpellArrange word={word} onAnswer={onAnswer} />
  ) : (
    <SpellFill word={word} onAnswer={onAnswer} />
  );
}

// 4-a) 알파벳을 순서대로 배열하기
function SpellArrange({ word, onAnswer }: { word: VocabWord; onAnswer: (correct: boolean) => void }) {
  const target = word.english;
  const [pool, setPool] = useState(() =>
    shuffle(target.split("").map((ch, i) => ({ ch, id: i })))
  );
  const [placed, setPlaced] = useState<{ ch: string; id: number }[]>([]);
  const [feedback, setFeedback] = useState<"correct" | "wrong" | null>(null);

  function tapPool(item: { ch: string; id: number }) {
    if (feedback) return;
    const nextPlaced = [...placed, item];
    setPool((p) => p.filter((x) => x.id !== item.id));
    setPlaced(nextPlaced);
    if (nextPlaced.length === target.length) {
      const built = nextPlaced.map((x) => x.ch).join("");
      setFeedback(built.toLowerCase() === target.toLowerCase() ? "correct" : "wrong");
    }
  }

  function tapPlaced(item: { ch: string; id: number }) {
    if (feedback) return;
    setPlaced((p) => p.filter((x) => x.id !== item.id));
    setPool((p) => [...p, item]);
  }

  function reset() {
    setPool(shuffle(target.split("").map((ch, i) => ({ ch, id: i }))));
    setPlaced([]);
    setFeedback(null);
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <p className="text-sm text-gray-500">알파벳을 순서대로 눌러 단어를 완성하세요</p>
      <p className="text-2xl font-bold text-sky-700">{word.korean}</p>
      {word.pos && <p className="text-sm text-gray-400 -mt-3">({word.pos})</p>}

      <div className="flex flex-wrap justify-center gap-2 min-h-[3.5rem] w-full max-w-sm border-b-2 border-dashed border-gray-300 pb-2">
        {placed.map((item) => (
          <button
            key={item.id}
            onClick={() => tapPlaced(item)}
            disabled={!!feedback}
            className="w-10 h-10 rounded-lg bg-sky-100 border-2 border-sky-300 font-bold text-lg text-sky-700 uppercase"
          >
            {item.ch}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap justify-center gap-2 w-full max-w-sm">
        {pool.map((item) => (
          <button
            key={item.id}
            onClick={() => tapPool(item)}
            disabled={!!feedback}
            className="w-10 h-10 rounded-lg bg-gray-50 border-2 border-gray-200 font-bold text-lg text-gray-700 uppercase"
          >
            {item.ch}
          </button>
        ))}
      </div>

      {feedback === "wrong" && (
        <div className="flex flex-col items-center gap-2 w-full max-w-sm">
          <p className="text-red-500 font-bold">아쉬워요! 정답: {target}</p>
          <button onClick={() => onAnswer(false)} className="w-full py-3 rounded-full bg-sky-600 text-white font-bold">
            다음
          </button>
        </div>
      )}
      {feedback === "correct" && (
        <div className="flex flex-col items-center gap-2 w-full max-w-sm">
          <p className="text-sky-600 font-bold">정답이에요!</p>
          <button onClick={() => onAnswer(true)} className="w-full py-3 rounded-full bg-sky-600 text-white font-bold">
            다음
          </button>
        </div>
      )}
      {!feedback && placed.length > 0 && (
        <button onClick={reset} className="text-xs text-gray-400 underline">
          다시 배열하기
        </button>
      )}
    </div>
  );
}

// 4-b) 빈칸에 알맞은 글자 선택해서 채우기
function SpellFill({ word, onAnswer }: { word: VocabWord; onAnswer: (correct: boolean) => void }) {
  const target = word.english;

  const positions = useMemo(() => {
    const idxs: number[] = [];
    for (let i = 0; i < target.length; i++) {
      if (i % 2 === 1) idxs.push(i);
    }
    return idxs.length > 0 ? idxs : [target.length - 1];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);

  const optionSets = useMemo(() => {
    const alphabet = "abcdefghijklmnopqrstuvwxyz";
    return positions.map((pos) => {
      const correct = target[pos].toLowerCase();
      const distractors = shuffle(alphabet.split("").filter((c) => c !== correct)).slice(0, 2);
      return shuffle([correct, ...distractors]);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [positions, target]);

  const [step, setStep] = useState(0);
  const [filled, setFilled] = useState<Record<number, string>>({});
  const [feedback, setFeedback] = useState<"correct" | "wrong" | null>(null);

  function choose(letter: string) {
    if (feedback) return;
    const pos = positions[step];
    const nextFilled = { ...filled, [pos]: letter };
    setFilled(nextFilled);
    if (step + 1 < positions.length) {
      setStep(step + 1);
    } else {
      const allCorrect = positions.every(
        (p) => nextFilled[p]?.toLowerCase() === target[p].toLowerCase()
      );
      setFeedback(allCorrect ? "correct" : "wrong");
    }
  }

  const displayWord = target
    .split("")
    .map((ch, i) => (positions.includes(i) ? (filled[i] ?? "_") : ch))
    .join("")
    .toUpperCase();

  return (
    <div className="flex flex-col items-center gap-4">
      <p className="text-sm text-gray-500">빈칸에 알맞은 글자를 골라 채우세요</p>
      <p className="text-2xl font-bold text-sky-700">{word.korean}</p>
      {word.pos && <p className="text-sm text-gray-400 -mt-3">({word.pos})</p>}
      <p className="text-3xl font-mono tracking-widest text-gray-800">{displayWord}</p>

      {!feedback && (
        <div className="flex gap-3">
          {optionSets[step].map((opt) => (
            <button
              key={opt}
              onClick={() => choose(opt)}
              className="w-12 h-12 rounded-xl bg-gray-50 border-2 border-gray-200 font-bold text-lg text-gray-700 uppercase"
            >
              {opt}
            </button>
          ))}
        </div>
      )}

      {feedback && (
        <div className="flex flex-col items-center gap-2 w-full max-w-sm">
          <p className={feedback === "correct" ? "text-sky-600 font-bold" : "text-red-500 font-bold"}>
            {feedback === "correct" ? "정답이에요!" : `아쉬워요! 정답: ${target}`}
          </p>
          <button
            onClick={() => onAnswer(feedback === "correct")}
            className="w-full py-3 rounded-full bg-sky-600 text-white font-bold"
          >
            다음
          </button>
        </div>
      )}
    </div>
  );
}
