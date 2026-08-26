"use client";

import { useEffect, useState } from "react";
import type { VocabSet, VocabWord, VocabDailySession } from "@/lib/types";
import {
  loadTodaySession,
  buildDailySession,
  saveTodaySession,
  recordAnswer,
  selectDailyWords,
} from "@/lib/vocabStorage";
import VocabGame from "./VocabGame";

type Mode = "hub" | "study" | "gameOnly";

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

  function handleGameOnly() {
    setGameWords(selectDailyWords(set));
    setMode("gameOnly");
  }

  function handleReplay() {
    const wordIds = Array.from(new Set(session!.cards.map((c) => c.wordId)));
    const words = set.words.filter((w) => wordIds.includes(w.id));
    setGameWords(words.length > 0 ? words : selectDailyWords(set));
    setMode("gameOnly");
  }

  // ---------- 허브 화면: 큰 탭 3개 ----------
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
          onClick={() => setMode("study")}
          className="w-full py-7 rounded-3xl bg-sky-600 text-white font-bold text-lg active:scale-[0.98] transition flex flex-col items-center gap-1"
        >
          <span className="text-2xl">📖</span>
          {studyDone ? "오늘의 학습 완료! (다시 보기)" : "오늘의 학습 시작하기"}
        </button>

        <button
          onClick={handleGameOnly}
          disabled={!studyDone}
          className={`w-full py-7 rounded-3xl font-bold text-lg transition flex flex-col items-center gap-1 ${
            studyDone
              ? "bg-emerald-500 text-white active:scale-[0.98]"
              : "bg-gray-100 text-gray-400 cursor-not-allowed"
          }`}
        >
          <span className="text-2xl">🎮</span>
          게임만 하기
          {!studyDone && <span className="text-xs font-normal">오늘의 학습을 먼저 끝내야 열려요</span>}
        </button>

        {studyDone && (
          <button
            onClick={handleReplay}
            className="w-full py-7 rounded-3xl bg-amber-500 text-white font-bold text-lg active:scale-[0.98] transition flex flex-col items-center gap-1"
          >
            <span className="text-2xl">🔁</span>
            한 번 더 복습하기
          </button>
        )}
      </div>
    );
  }

  // ---------- 게임만 하기 ----------
  if (mode === "gameOnly") {
    return <VocabGame words={gameWords} onDone={() => setMode("hub")} />;
  }

  // ---------- 오늘의 학습 (기존 스터디 흐름) ----------
  if (session.cards.length === 0 || session.phase === "done") {
    return (
      <div className="w-full max-w-4xl flex flex-col items-center gap-4 py-10">
        <p className="text-xl font-bold text-gray-800">오늘의 공부 완료!</p>
        <p className="text-sm text-gray-500">내일 또 만나요.</p>
        <button
          onClick={() => setMode("hub")}
          className="text-sm text-sky-600 font-bold underline"
        >
          허브로 돌아가기
        </button>
      </div>
    );
  }

  if (session.phase === "game") {
    const wordIds = Array.from(new Set(session.cards.map((c) => c.wordId)));
    const todayWords = set.words.filter((w) => wordIds.includes(w.id));
    return (
      <VocabGame
        words={todayWords}
        onDone={() => {
          const finished: VocabDailySession = { ...session, phase: "done" };
          saveTodaySession(finished);
          setSession(finished);
        }}
      />
    );
  }

  const card = session.cards[session.cursor];
  const word = set.words.find((w) => w.id === card.wordId);

  function advanceCard(wasCorrect?: boolean) {
    if (!session) return;
    if (typeof wasCorrect === "boolean" && card.mode !== "flash") {
      recordAnswer(set.id, card.wordId, wasCorrect);
    }
    const nextCursor = session.cursor + 1;
    const updated: VocabDailySession =
      nextCursor >= session.cards.length
        ? { ...session, cursor: nextCursor, phase: "game" }
        : { ...session, cursor: nextCursor };
    saveTodaySession(updated);
    setSession(updated);
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

      {card.mode === "flash" && <FlashCard word={word} onNext={() => advanceCard()} />}
      {card.mode === "meaning" && (
        <MeaningCard words={set.words} word={word} onAnswer={(ok) => advanceCard(ok)} />
      )}
      {card.mode === "listen" && (
        <ListenCard words={set.words} word={word} onAnswer={(ok) => advanceCard(ok)} />
      )}
    </div>
  );
}

function FlashCard({ word, onNext }: { word: VocabWord; onNext: () => void }) {
  const [flipped, setFlipped] = useState(false);
  return (
    <div className="flex flex-col items-center gap-4">
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

function ListenCard({
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
      <p className="text-sm text-gray-500 font-bold">잘 듣고 알맞은 뜻을 골라보세요.</p>
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
          <button
            onClick={() => onAnswer(selected === word.korean)}
            className="w-full py-3 rounded-full bg-sky-600 text-white font-bold"
          >
            다음
          </button>
        </div>
      )}
    </div>
  );
}
