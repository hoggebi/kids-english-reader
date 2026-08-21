"use client";

import { useState } from "react";
import type { QuizQuestion } from "@/lib/types";

export default function QuizSection({ passage }: { passage: string }) {
  const [questions, setQuestions] = useState<QuizQuestion[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [submitted, setSubmitted] = useState(false);

  async function generateQuiz() {
    setLoading(true);
    setError(null);
    setSubmitted(false);
    setAnswers({});
    try {
      const res = await fetch("/api/quiz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passage }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "퀴즈 생성에 실패했습니다.");
      setQuestions(data.questions);
    } catch (e) {
      setError(e instanceof Error ? e.message : "알 수 없는 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }

  const score =
    questions && submitted
      ? questions.filter((q, i) => answers[i] === q.correctIndex).length
      : 0;

  return (
    <div className="w-full max-w-md flex flex-col gap-4">
      {!questions && (
        <button
          onClick={generateQuiz}
          disabled={loading}
          className="w-full py-3 rounded-full bg-green-500 text-white font-bold disabled:opacity-50 active:scale-95 transition"
        >
          {loading ? "퀴즈 만드는 중... 🤖" : "🧠 AI 퀴즈 만들기"}
        </button>
      )}

      {error && <p className="text-red-500 text-sm text-center">{error}</p>}

      {questions && (
        <>
          {questions.map((q, qi) => (
            <div key={qi} className="rounded-2xl bg-green-50 p-4 flex flex-col gap-3">
              <p className="font-semibold">
                Q{qi + 1}. {q.question}
              </p>
              <div className="flex flex-col gap-2">
                {q.options.map((opt, oi) => {
                  const isSelected = answers[qi] === oi;
                  const isCorrect = submitted && oi === q.correctIndex;
                  const isWrongSelected = submitted && isSelected && oi !== q.correctIndex;
                  return (
                    <button
                      key={oi}
                      disabled={submitted}
                      onClick={() => setAnswers((prev) => ({ ...prev, [qi]: oi }))}
                      className={`text-left px-4 py-2 rounded-xl border transition ${
                        isCorrect
                          ? "bg-green-100 border-green-400"
                          : isWrongSelected
                          ? "bg-red-100 border-red-400"
                          : isSelected
                          ? "bg-green-200 border-green-400"
                          : "bg-white border-gray-200"
                      }`}
                    >
                      {opt}
                    </button>
                  );
                })}
              </div>
              {submitted && (
                <p className="text-sm text-gray-600 bg-white rounded-lg p-2">
                  💡 {q.explanation}
                </p>
              )}
            </div>
          ))}

          {!submitted ? (
            <button
              onClick={() => setSubmitted(true)}
              disabled={Object.keys(answers).length < questions.length}
              className="w-full py-3 rounded-full bg-green-600 text-white font-bold disabled:opacity-40 active:scale-95 transition"
            >
              채점하기
            </button>
          ) : (
            <div className="flex flex-col gap-3">
              <p className="text-center text-lg font-bold">
                {score} / {questions.length} 정답! {score === questions.length ? "🎉" : "💪"}
              </p>
              <button
                onClick={generateQuiz}
                className="w-full py-3 rounded-full bg-gray-100 font-bold active:scale-95 transition"
              >
                새 퀴즈 만들기
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
