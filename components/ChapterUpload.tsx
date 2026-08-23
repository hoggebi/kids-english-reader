"use client";

import { useRef, useState } from "react";
import type { Chapter, ExtractedPage } from "@/lib/types";

function makeId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export default function ChapterUpload({
  onCreated,
  onCancel,
}: {
  onCreated: (chapter: Chapter) => void;
  onCancel: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pages, setPages] = useState<ExtractedPage[]>([]);
  const [chapterTitle, setChapterTitle] = useState("");
  const [step, setStep] = useState<"pick" | "confirm">("pick");
  const inputRef = useRef<HTMLInputElement>(null);

  async function extractOne(file: File): Promise<ExtractedPage> {
    const dataUrl: string = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error("이미지를 읽지 못했습니다."));
      reader.readAsDataURL(file);
    });
    const base64 = dataUrl.split(",")[1];

    const res = await fetch("/api/ocr", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageBase64: base64, mimeType: file.type || "image/jpeg" }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || "글자를 인식하지 못했습니다.");
    }
    return { title: data.title, sentences: data.sentences };
  }

  async function handleFiles(files: FileList) {
    setError(null);
    setLoading(true);
    const list = Array.from(files);
    let completed = 0;
    setStatus(`0/${list.length} 완료`);

    const settled = await Promise.all(
      list.map((file) =>
        extractOne(file)
          .then((page) => {
            completed++;
            setStatus(`${completed}/${list.length} 완료`);
            return { ok: true as const, page };
          })
          .catch((e) => {
            completed++;
            setStatus(`${completed}/${list.length} 완료`);
            return {
              ok: false as const,
              message: e instanceof Error ? e.message : "알 수 없는 오류",
            };
          })
      )
    );

    setLoading(false);

    const results: ExtractedPage[] = [];
    const failedNumbers: number[] = [];
    settled.forEach((r, i) => {
      if (r.ok) results.push(r.page);
      else failedNumbers.push(i + 1);
    });

    if (failedNumbers.length > 0) {
      setError(
        `${failedNumbers.join(", ")}번째 사진에서 글자를 읽지 못했어요. (나머지는 정상 처리됐어요)`
      );
    }

    if (results.length === 0) {
      setError("어떤 사진에서도 글자를 읽지 못했어요. 다시 시도해주세요.");
      return;
    }
    setPages(results);
    setChapterTitle(results[0].title || "새 챕터");
    setStep("confirm");
  }

  function confirmChapter() {
    const chapter: Chapter = {
      id: makeId(),
      title: chapterTitle.trim() || "제목 없는 챕터",
      pages,
      createdAt: Date.now(),
    };
    onCreated(chapter);
  }

  if (step === "confirm") {
    return (
      <div className="flex flex-col gap-4 w-full max-w-4xl">
        <h2 className="text-lg font-bold text-gray-800">챕터 확인</h2>
        <label className="text-sm text-gray-500">챕터 제목</label>
        <input
          value={chapterTitle}
          onChange={(e) => setChapterTitle(e.target.value)}
          className="border-2 border-gray-200 rounded-xl px-4 py-2 font-bold"
        />
        <p className="text-sm text-gray-500">
          총 {pages.length}장이 인식됐어요. 페이지별로 내용을 확인해보세요.
        </p>
        <div className="flex flex-col gap-3 max-h-80 lg:max-h-[32rem] overflow-y-auto lg:grid lg:grid-cols-2 lg:gap-4">
          {pages.map((p, i) => (
            <div key={i} className="rounded-xl bg-gray-50 p-3 text-sm">
              <div className="font-bold text-sky-600 mb-1">
                {i + 1}쪽 · {p.title}
              </div>
              <textarea
                value={p.sentences.join(" ")}
                onChange={(e) => {
                  const sentences = e.target.value
                    .split(/(?<=[.!?])\s+/)
                    .map((s) => s.trim())
                    .filter(Boolean);
                  setPages((prev) =>
                    prev.map((pg, idx) => (idx === i ? { ...pg, sentences } : pg))
                  );
                }}
                rows={3}
                className="w-full rounded-lg border border-gray-200 p-2 text-sm"
              />
            </div>
          ))}
        </div>
        {error && <p className="text-red-500 text-sm text-center">{error}</p>}
        <div className="flex gap-2">
          <button onClick={onCancel} className="flex-1 py-3 rounded-full bg-gray-100 font-bold">
            취소
          </button>
          <button
            onClick={confirmChapter}
            className="flex-1 py-3 rounded-full bg-sky-600 text-white font-bold"
          >
            챕터 저장하기
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4 w-full max-w-4xl">
      <div
        className="w-full aspect-[4/3] rounded-2xl border-2 border-dashed border-gray-300 bg-gray-50 flex items-center justify-center overflow-hidden cursor-pointer hover:bg-gray-100 transition"
        onClick={() => inputRef.current?.click()}
      >
        <div className="text-center text-gray-500 px-6">
          <p className="font-semibold">챕터에 넣을 페이지 사진들을 한 번에 선택하세요</p>
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) handleFiles(e.target.files);
        }}
      />

      <button
        onClick={() => inputRef.current?.click()}
        disabled={loading}
        className="w-full py-3 rounded-full bg-sky-600 text-white font-bold text-lg disabled:opacity-50 active:scale-95 transition"
      >
        {loading ? "지문 읽는 중..." : "사진 여러 장 선택하기"}
      </button>

      {loading && <p className="text-xs text-gray-400 text-center">{status}</p>}
      {error && (
        <p className="text-red-500 text-sm text-center bg-red-50 rounded-lg p-2 w-full">
          {error}
        </p>
      )}

      <button onClick={onCancel} className="text-sm text-gray-400 underline">
        취소
      </button>
    </div>
  );
}
