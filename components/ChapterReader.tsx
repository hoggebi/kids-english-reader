"use client";

import { useState } from "react";
import type { Chapter } from "@/lib/types";
import ReadingPractice from "./ReadingPractice";
import QuizSection from "./QuizSection";

export default function ChapterReader({
  chapter,
  onBack,
}: {
  chapter: Chapter;
  onBack: () => void;
}) {
  const [pageIndex, setPageIndex] = useState(0);
  const [mode, setMode] = useState<"read" | "quiz">("read");
  const page = chapter.pages[pageIndex];
  const fullPassage = chapter.pages.flatMap((p) => p.sentences).join(" ");

  return (
    <div className="w-full max-w-md flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <button onClick={onBack} className="text-sm text-gray-400 underline">
          ← 챕터 목록
        </button>
        <h2 className="font-title text-lg font-bold text-gray-700">{chapter.title}</h2>
        <span className="text-xs text-gray-400">
          {pageIndex + 1}/{chapter.pages.length}쪽
        </span>
      </div>

      <div className="w-full flex rounded-full bg-white shadow p-1">
        <button
          onClick={() => setMode("read")}
          className={`flex-1 py-2 rounded-full font-bold transition ${
            mode === "read" ? "bg-green-600 text-white" : "text-gray-500"
          }`}
        >
          🗣️ 따라 읽기
        </button>
        <button
          onClick={() => setMode("quiz")}
          className={`flex-1 py-2 rounded-full font-bold transition ${
            mode === "quiz" ? "bg-green-800 text-white" : "text-gray-500"
          }`}
        >
          🧠 챕터 전체 퀴즈
        </button>
      </div>

      {mode === "read" && (
        <>
          <ReadingPractice key={pageIndex} sentences={page.sentences} />
          <div className="flex justify-between pt-2">
            <button
              onClick={() => setPageIndex((i) => Math.max(0, i - 1))}
              disabled={pageIndex === 0}
              className="px-4 py-2 rounded-full bg-gray-100 disabled:opacity-40"
            >
              ← 이전 쪽
            </button>
            <button
              onClick={() => setPageIndex((i) => Math.min(chapter.pages.length - 1, i + 1))}
              disabled={pageIndex === chapter.pages.length - 1}
              className="px-4 py-2 rounded-full bg-gray-100 disabled:opacity-40"
            >
              다음 쪽 →
            </button>
          </div>
        </>
      )}

      {mode === "quiz" && <QuizSection passage={fullPassage} />}
    </div>
  );
}
