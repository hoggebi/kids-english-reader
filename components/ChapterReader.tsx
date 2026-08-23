"use client";

import { useState } from "react";
import type { Chapter } from "@/lib/types";
import { completeChapter, MAX_STAGE, type PetState } from "@/lib/pet";
import ReadingPractice from "./ReadingPractice";
import QuizSection from "./QuizSection";
import PetDisplay from "./PetDisplay";

export default function ChapterReader({
  chapter,
  onBack,
}: {
  chapter: Chapter;
  onBack: () => void;
}) {
  const [pageIndex, setPageIndex] = useState(0);
  const [mode, setMode] = useState<"read" | "quiz">("read");
  const [celebration, setCelebration] = useState<{
    pet: PetState;
    grew: boolean;
    graduated: boolean;
    score: number;
    total: number;
  } | null>(null);

  const page = chapter.pages[pageIndex];
  const fullPassage = chapter.pages.flatMap((p) => p.sentences).join(" ");

  function handleQuizDone(result: { score: number; total: number }) {
    const grow = completeChapter(chapter.id);
    setCelebration({
      pet: grow.pet,
      grew: grow.grew,
      graduated: grow.graduated,
      score: result.score,
      total: result.total,
    });
  }

  // 챕터 완료 축하 화면 (여우 성장 표시)
  if (celebration) {
    return (
      <div className="w-full max-w-md flex flex-col items-center gap-5 py-8">
        <p className="text-2xl font-bold text-sky-600 text-center">
          오늘의 공부 완료!
        </p>
        <p className="text-gray-600 text-center">
          {celebration.total}문제 중 {celebration.score}문제를 맞혔어요
        </p>

        {celebration.graduated && (
          <div className="w-full rounded-2xl bg-sky-50 border-2 border-sky-200 p-4 text-center">
            <p className="font-bold text-sky-700">
              {MAX_STAGE}단계를 모두 키웠어요!
            </p>
            <p className="text-sm text-gray-600 mt-1">
              새로운 친구가 찾아왔어요.
            </p>
          </div>
        )}

        {!celebration.graduated && celebration.grew && (
          <p className="text-sm text-sky-600 font-bold">
            친구가 한 단계 자랐어요!
          </p>
        )}

        <PetDisplay pet={celebration.pet} size="lg" justGrew={celebration.grew} />

        <button
          onClick={onBack}
          className="w-full py-3 rounded-full bg-sky-600 text-white font-bold active:scale-95 transition"
        >
          챕터 목록으로
        </button>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <button onClick={onBack} className="text-sm text-gray-400 underline">
          챕터 목록
        </button>
        <h2 className="text-lg font-bold text-gray-800">{chapter.title}</h2>
        <span className="text-xs text-gray-400">
          {pageIndex + 1}/{chapter.pages.length}쪽
        </span>
      </div>

      <div className="w-full flex rounded-full bg-gray-100 p-1">
        <button
          onClick={() => setMode("read")}
          className={`flex-1 py-2 rounded-full font-bold transition ${
            mode === "read" ? "bg-sky-600 text-white" : "text-gray-500"
          }`}
        >
          따라 읽기
        </button>
        <button
          onClick={() => setMode("quiz")}
          className={`flex-1 py-2 rounded-full font-bold transition ${
            mode === "quiz" ? "bg-gray-800 text-white" : "text-gray-500"
          }`}
        >
          챕터 전체 퀴즈
        </button>
      </div>

      {mode === "read" && (
        <>
          <ReadingPractice
            key={pageIndex}
            sentences={page.sentences}
            hasNextPage={pageIndex < chapter.pages.length - 1}
            onNextPage={() => setPageIndex((i) => Math.min(chapter.pages.length - 1, i + 1))}
            onGoToQuiz={() => setMode("quiz")}
          />
          <div className="flex justify-between pt-2">
            <button
              onClick={() => setPageIndex((i) => Math.max(0, i - 1))}
              disabled={pageIndex === 0}
              className="px-4 py-2 rounded-full bg-gray-100 disabled:opacity-40"
            >
              이전 쪽
            </button>
            <button
              onClick={() => setPageIndex((i) => Math.min(chapter.pages.length - 1, i + 1))}
              disabled={pageIndex === chapter.pages.length - 1}
              className="px-4 py-2 rounded-full bg-gray-100 disabled:opacity-40"
            >
              다음 쪽
            </button>
          </div>
        </>
      )}

      {mode === "quiz" && (
        <QuizSection passage={fullPassage} onAllDone={handleQuizDone} />
      )}
    </div>
  );
}
