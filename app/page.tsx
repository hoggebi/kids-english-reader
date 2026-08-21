"use client";

import { useState } from "react";
import PhotoUpload from "@/components/PhotoUpload";
import ReadingPractice from "@/components/ReadingPractice";
import QuizSection from "@/components/QuizSection";
import type { ExtractedPage } from "@/lib/types";

type Step = "upload" | "read" | "quiz";

export default function Home() {
  const [step, setStep] = useState<Step>("upload");
  const [page, setPage] = useState<ExtractedPage | null>(null);

  const passage = page?.sentences.join(" ") ?? "";

  function reset() {
    setStep("upload");
    setPage(null);
  }

  return (
    <div className="min-h-screen bg-white flex flex-col items-center px-4 py-8 gap-6">
      <header className="w-full max-w-md flex items-center justify-between">
        <h1
          className="text-2xl font-extrabold text-orange-500 cursor-pointer"
          onClick={reset}
        >
          📚 리틀 리더
        </h1>
        {page && (
          <button onClick={reset} className="text-sm text-gray-400 underline">
            새 페이지
          </button>
        )}
      </header>

      {step === "upload" && (
        <PhotoUpload
          onExtracted={(extracted) => {
            setPage(extracted);
            setStep("read");
          }}
        />
      )}

      {step !== "upload" && page && (
        <>
          <h2 className="w-full max-w-md text-lg font-bold text-gray-700">
            {page.title}
          </h2>

          <div className="w-full max-w-md flex rounded-full bg-white shadow p-1">
            <button
              onClick={() => setStep("read")}
              className={`flex-1 py-2 rounded-full font-bold transition ${
                step === "read" ? "bg-blue-500 text-white" : "text-gray-500"
              }`}
            >
              🗣️ 따라 읽기
            </button>
            <button
              onClick={() => setStep("quiz")}
              className={`flex-1 py-2 rounded-full font-bold transition ${
                step === "quiz" ? "bg-green-500 text-white" : "text-gray-500"
              }`}
            >
              🧠 퀴즈
            </button>
          </div>

          {step === "read" && <ReadingPractice sentences={page.sentences} />}
          {step === "quiz" && <QuizSection passage={passage} />}
        </>
      )}
    </div>
  );
}
