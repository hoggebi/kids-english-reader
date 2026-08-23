"use client";

import { useEffect, useState } from "react";
import type { QuizItem } from "@/lib/types";

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function normalize(s: string) {
  return s.toLowerCase().replace(/[.,!?;:"']/g, "").replace(/\s+/g, " ").trim();
}

function speak(text: string) {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = "en-US";
  utter.rate = 0.9;
  window.speechSynthesis.speak(utter);
}

type PreparedItem = QuizItem & {
  shuffledOptions?: string[];
  shuffledWords?: string[];
};

export default function QuizSection({
  passage,
  onAllDone,
}: {
  passage: string;
  onAllDone?: (result: { score: number; total: number }) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<PreparedItem[]>([]);
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [builtWords, setBuiltWords] = useState<string[]>([]);
  const [checked, setChecked] = useState(false);
  const [correct, setCorrect] = useState(false);
  const [score, setScore] = useState(0);
  const [finished, setFinished] = useState(false);
  const [started, setStarted] = useState(false);
  const [setNumber, setSetNumber] = useState(1);
  const [totalScore, setTotalScore] = useState(0);
  const [totalQuestions, setTotalQuestions] = useState(0);
  const [allSetsDone, setAllSetsDone] = useState(false);

  const TOTAL_SETS = 2;
  const current = items[index];

  async function fetchSet() {
    setLoading(true);
    setError(null);
    setFinished(false);
    setScore(0);
    setIndex(0);
    resetQuestionState();

    try {
      const res = await fetch("/api/quiz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passage }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "퀴즈를 만들지 못했어요.");

      const prepared: PreparedItem[] = (data.items as QuizItem[]).map((item) => {
        if (item.kind === "order_words" && item.words) {
          return { ...item, shuffledWords: shuffle(item.words) };
        }
        if (item.options) {
          return { ...item, shuffledOptions: shuffle(item.options) };
        }
        return item;
      });

      setItems(prepared);
    } catch (e) {
      setError(e instanceof Error ? e.message : "알 수 없는 오류가 발생했어요.");
    } finally {
      setLoading(false);
    }
  }

  function startQuiz() {
    setStarted(true);
    setSetNumber(1);
    setTotalScore(0);
    setTotalQuestions(0);
    setAllSetsDone(false);
    fetchSet();
  }

  function startNextSet() {
    setTotalScore((s) => s + score);
    setTotalQuestions((q) => q + items.length);
    setSetNumber((n) => n + 1);
    fetchSet();
  }

  function finishAllSets() {
    const finalScore = totalScore + score;
    const finalTotal = totalQuestions + items.length;
    setTotalScore(finalScore);
    setTotalQuestions(finalTotal);
    setAllSetsDone(true);
    onAllDone?.({ score: finalScore, total: finalTotal });
  }

  function resetQuestionState() {
    setSelected(null);
    setBuiltWords([]);
    setChecked(false);
    setCorrect(false);
  }

  function checkChoice(option: string) {
    if (checked || !current) return;
    setSelected(option);
    const isCorrect = normalize(option) === normalize(current.answer ?? "");
    setCorrect(isCorrect);
    setChecked(true);
    if (isCorrect) setScore((s) => s + 1);
  }

  function tapWord(word: string, fromBuilt: boolean, wordIndex: number) {
    if (checked) return;
    if (fromBuilt) {
      setBuiltWords((prev) => prev.filter((_, i) => i !== wordIndex));
    } else {
      setBuiltWords((prev) => [...prev, word]);
    }
  }

  function checkOrder() {
    if (checked || !current) return;
    const built = builtWords.join(" ");
    const isCorrect = normalize(built) === normalize(current.answer ?? "");
    setCorrect(isCorrect);
    setChecked(true);
    if (isCorrect) setScore((s) => s + 1);
  }

  function nextQuestion() {
    if (index + 1 >= items.length) {
      setFinished(true);
      return;
    }
    setIndex((i) => i + 1);
    resetQuestionState();
  }

  if (!started) {
    return (
      <div className="w-full max-w-md flex flex-col items-center gap-4 py-10">
        <p className="text-lg text-gray-700 text-center">
          방금 읽은 문장과 단어를 다시 복습해봐요.
        </p>
        <button
          onClick={startQuiz}
          className="w-full py-3 rounded-full bg-sky-600 text-white font-bold text-lg active:scale-95 transition"
        >
          복습 퀴즈 시작하기
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="w-full max-w-md flex flex-col items-center gap-3 py-10">
        <p className="text-gray-500">퀴즈를 만드는 중이에요...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full max-w-md flex flex-col items-center gap-4 py-10">
        <div className="rounded-2xl bg-red-50 border-2 border-red-300 p-4 w-full text-center">
          <p className="text-red-600 font-bold">{error}</p>
        </div>
        <button
          onClick={startQuiz}
          className="w-full py-3 rounded-full bg-sky-600 text-white font-bold"
        >
          다시 시도하기
        </button>
      </div>
    );
  }

  if (finished) {
    const isLastSet = setNumber >= TOTAL_SETS;
    if (allSetsDone) return null;
    return (
      <div className="w-full max-w-md flex flex-col items-center gap-4 py-10">
        <p className="text-xl font-bold text-gray-800">
          {setNumber}세트 완료! {items.length}문제 중 {score}문제를 맞혔어요
        </p>
        {!isLastSet ? (
          <button
            onClick={startNextSet}
            className="w-full py-3 rounded-full bg-sky-600 text-white font-bold"
          >
            {setNumber + 1}세트 이어서 풀기
          </button>
        ) : (
          <button
            onClick={finishAllSets}
            className="w-full py-3 rounded-full bg-sky-600 text-white font-bold"
          >
            결과 확인하기
          </button>
        )}
      </div>
    );
  }

  if (!current) return null;

  return (
    <div className="w-full max-w-md flex flex-col gap-4">
      <div className="flex items-center justify-between text-sm text-gray-500">
        <span>{setNumber}세트 · 문제 {index + 1} / {items.length}</span>
        <span className="font-bold text-sky-600">맞은 개수 {score}</span>
      </div>

      <div className="rounded-2xl bg-gray-50 p-5 flex flex-col gap-4">
        {/* 유형별 안내 문구 (한국어 고정) */}
        <p className="text-center text-gray-500 text-sm font-bold">
          {current.kind === "fill_blank" && "빈칸에 들어갈 알맞은 단어를 골라보세요."}
          {current.kind === "find_sentence" && "책에서 읽은 문장을 골라보세요."}
          {current.kind === "order_words" && "단어를 순서대로 눌러 문장을 만들어보세요."}
          {current.kind === "listen_word" && "잘 듣고 들린 단어를 골라보세요."}
        </p>

        {/* fill_blank: 빈칸 문장 표시 */}
        {current.kind === "fill_blank" && (
          <p className="text-center text-2xl font-bold text-gray-800 leading-relaxed">
            {current.prompt}
          </p>
        )}

        {/* listen_word: 문장을 보여주지 않고 듣기 버튼만 제공 */}
        {current.kind === "listen_word" && (
          <div className="flex justify-center">
            <button
              onClick={() => speak(current.sourceSentence)}
              className="px-6 py-3 rounded-full bg-gray-700 text-white font-bold text-lg active:scale-95 transition"
            >
              다시 듣기
            </button>
          </div>
        )}

        {/* find_sentence / fill_blank / listen_word: 선택지 버튼 */}
        {(current.kind === "fill_blank" ||
          current.kind === "find_sentence" ||
          current.kind === "listen_word") && (
          <div className="flex flex-col gap-2">
            {(current.shuffledOptions ?? current.options ?? []).map((opt) => {
              const isSelected = selected === opt;
              const isAnswer = normalize(opt) === normalize(current.answer ?? "");
              let style = "bg-white border-2 border-gray-200 text-gray-700";
              if (checked && isAnswer) style = "bg-sky-50 border-2 border-sky-500 text-sky-700 font-bold";
              else if (checked && isSelected && !isAnswer) style = "bg-red-50 border-2 border-red-400 text-red-500";

              return (
                <button
                  key={opt}
                  onClick={() => checkChoice(opt)}
                  disabled={checked}
                  className={`rounded-xl px-4 py-3 text-lg font-semibold transition ${style}`}
                >
                  {opt}
                </button>
              );
            })}
          </div>
        )}

        {/* order_words: 단어 조립 영역 */}
        {current.kind === "order_words" && (
          <div className="flex flex-col gap-3">
            <div className="min-h-[52px] rounded-xl bg-white border-2 border-dashed border-gray-300 p-3 flex flex-wrap gap-2 items-center">
              {builtWords.length === 0 && (
                <span className="text-gray-300 text-sm">여기에 단어를 순서대로 모아주세요</span>
              )}
              {builtWords.map((w, i) => (
                <button
                  key={`${w}-${i}`}
                  onClick={() => !checked && tapWord(w, true, i)}
                  className="px-3 py-1.5 rounded-lg bg-sky-600 text-white font-bold"
                >
                  {w}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap gap-2 justify-center">
              {(current.shuffledWords ?? []).map((w, i) => {
                const usedCount = builtWords.filter((bw) => bw === w).length;
                const sameBeforeCount = (current.shuffledWords ?? [])
                  .slice(0, i)
                  .filter((x) => x === w).length;
                const isUsed = sameBeforeCount < usedCount;
                if (isUsed) return null;
                return (
                  <button
                    key={`${w}-${i}`}
                    onClick={() => tapWord(w, false, i)}
                    disabled={checked}
                    className="px-3 py-1.5 rounded-lg bg-white border-2 border-gray-300 text-gray-700 font-bold"
                  >
                    {w}
                  </button>
                );
              })}
            </div>

            {!checked && (
              <button
                onClick={checkOrder}
                disabled={builtWords.length === 0}
                className="w-full py-2 rounded-full bg-sky-600 text-white font-bold disabled:opacity-40"
              >
                정답 확인
              </button>
            )}
          </div>
        )}

        {/* 정답 확인 후: 결과 + 원문 문장 다시 보기/듣기 */}
        {checked && (
          <div className="rounded-xl bg-white p-4 flex flex-col gap-2 items-center">
            <p className={correct ? "text-sky-600 font-bold" : "text-red-500 font-bold"}>
              {correct ? "맞았어요!" : "다시 한 번 확인해봐요"}
            </p>
            <p className="text-lg font-semibold text-gray-800 text-center">
              {current.sourceSentence}
            </p>
            <button
              onClick={() => speak(current.sourceSentence)}
              className="px-4 py-2 rounded-full bg-gray-700 text-white font-bold text-sm"
            >
              문장 듣기
            </button>
            <button
              onClick={nextQuestion}
              className="w-full mt-2 py-2 rounded-full bg-sky-600 text-white font-bold"
            >
              {index + 1 >= items.length ? "결과 보기" : "다음 문제"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
