"use client";

import { useRef, useState } from "react";
import { createWorker } from "tesseract.js";
import type { ExtractedPage } from "@/lib/types";

function splitIntoSentences(rawText: string): string[] {
  const cleaned = rawText.replace(/\s*\n\s*/g, " ").replace(/\s+/g, " ").trim();
  const matches = cleaned.match(/[^.!?]+[.!?]+(\s|$)|[^.!?]+$/g);
  return (matches ?? [])
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function buildTitle(sentences: string[]): string {
  const first = sentences[0] ?? "";
  const words = first.split(" ").slice(0, 6).join(" ");
  return words || "오늘의 지문";
}

export default function PhotoUpload({
  onExtracted,
}: {
  onExtracted: (page: ExtractedPage, imageUrl: string) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    setError(null);
    setLoading(true);
    setProgress(0);
    setStatus("이미지 불러오는 중...");

    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = reader.result as string;
      setPreview(dataUrl);

      try {
        const worker = await createWorker("eng", 1, {
          logger: (msg) => {
            setStatus(msg.status);
            if (typeof msg.progress === "number") {
              setProgress(Math.round(msg.progress * 100));
            }
          },
        });

        const { data } = await worker.recognize(dataUrl);
        await worker.terminate();

        const sentences = splitIntoSentences(data.text);
        if (sentences.length === 0) {
          throw new Error("텍스트를 인식하지 못했어요. 더 선명한 사진으로 다시 시도해주세요.");
        }

        onExtracted({ title: buildTitle(sentences), sentences }, dataUrl);
      } catch (e) {
        setError(e instanceof Error ? e.message : "알 수 없는 오류가 발생했습니다.");
      } finally {
        setLoading(false);
      }
    };
    reader.readAsDataURL(file);
  }

  return (
    <div className="flex flex-col items-center gap-4 w-full max-w-md">
      <div
        className="w-full aspect-[4/3] rounded-2xl border-2 border-dashed border-orange-300 bg-orange-50 flex items-center justify-center overflow-hidden cursor-pointer hover:bg-orange-100 transition"
        onClick={() => inputRef.current?.click()}
      >
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="preview" className="w-full h-full object-contain" />
        ) : (
          <div className="text-center text-orange-400 px-6">
            <div className="text-5xl mb-2">📷</div>
            <p className="font-semibold">책 페이지 사진을 찍거나 올려주세요</p>
          </div>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
        }}
      />

      <button
        onClick={() => inputRef.current?.click()}
        disabled={loading}
        className="w-full py-3 rounded-full bg-orange-500 text-white font-bold text-lg disabled:opacity-50 active:scale-95 transition"
      >
        {loading ? "지문 읽는 중... 📖" : preview ? "다른 사진 선택" : "사진 선택하기"}
      </button>

      {loading && (
        <div className="w-full flex flex-col gap-1">
          <div className="w-full h-2 rounded-full bg-orange-100 overflow-hidden">
            <div
              className="h-full bg-orange-500 transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-xs text-gray-400 text-center">{status} ({progress}%)</p>
        </div>
      )}

      {error && (
        <p className="text-red-500 text-sm text-center bg-red-50 rounded-lg p-2 w-full">
          {error}
        </p>
      )}
    </div>
  );
}
