"use client";

import { useRef, useState } from "react";
import type { VocabSet, VocabWord } from "@/lib/types";

function makeId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export default function VocabUpload({
  onCreated,
  onCancel,
}: {
  onCreated: (set: VocabSet) => void;
  onCancel: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [words, setWords] = useState<VocabWord[]>([]);
  const [step, setStep] = useState<"pick" | "confirm">("pick");
  const inputRef = useRef<HTMLInputElement>(null);

  async function extractOne(file: File): Promise<{ title: string; words: VocabWord[] }> {
    const dataUrl: string = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error("이미지를 읽지 못했습니다."));
      reader.readAsDataURL(file);
    });
    const base64 = dataUrl.split(",")[1];

    const res = await fetch("/api/vocab-ocr", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageBase64: base64, mimeType: file.type || "image/jpeg" }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || "단어를 인식하지 못했습니다.");
    }
    return { title: data.title, words: data.words };
  }

  async function handleFiles(files: FileList) {
    setError(null);
    setLoading(true);
    const list = Array.from(files);

    const settled = await Promise.all(
      list.map((file) =>
        extractOne(file)
          .then((r) => ({ ok: true as const, result: r }))
          .catch((e) => ({
            ok: false as const,
            message: e instanceof Error ? e.message : "알 수 없는 오류",
          }))
      )
    );

    setLoading(false);

    const allWords: VocabWord[] = [];
    let firstTitle = "";
    const failedNumbers: number[] = [];
    settled.forEach((r, i) => {
      if (r.ok) {
        allWords.push(...r.result.words);
        if (!firstTitle) firstTitle = r.result.title;
      } else {
        failedNumbers.push(i + 1);
      }
    });

    if (failedNumbers.length > 0) {
      setError(`${failedNumbers.join(", ")}번째 사진에서 단어를 못 읽었어요. (나머지는 처리됐어요)`);
    }

    if (allWords.length === 0) {
      setError("어떤 사진에서도 단어를 읽지 못했어요. 다시 시도해주세요.");
      return;
    }

    setWords(allWords);
    setTitle(firstTitle || "새 단어장");
    setStep("confirm");
  }

  function updateWord(i: number, field: keyof VocabWord, value: string) {
    setWords((prev) => prev.map((w, idx) => (idx === i ? { ...w, [field]: value } : w)));
  }

  function removeWord(i: number) {
    setWords((prev) => prev.filter((_, idx) => idx !== i));
  }

  function confirmSet() {
    // 신규 필드(id, box, nextDueAt, wrongCount)를 채워서 저장한다.
    const finalWords: VocabWord[] = words.map((w) => ({
      ...w,
      id: w.id ?? makeId(),
      box: 0,
      nextDueAt: 0,
      wrongCount: 0,
    }));

    const set: VocabSet = {
      id: makeId(),
      title: title.trim() || "제목 없는 단어장",
      words: finalWords,
      createdAt: Date.now(),
      status: "locked", // addVocabSet에서 활성 세트 유무 보고 자동으로 active/locked 결정해줌
    };
    onCreated(set);
  }

  if (step === "confirm") {
    return (
      <div className="flex flex-col gap-4 w-full max-w-4xl">
        <h2 className="text-lg font-bold text-gray-800">단어장 확인</h2>
        <label className="text-sm text-gray-500">단어장 제목</label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="border-2 border-gray-200 rounded-xl px-4 py-2 font-bold"
        />
        <p className="text-sm text-gray-500">
          총 {words.length}개 단어가 인식됐어요. 내용을 확인하고 고칠 수 있어요.
        </p>
        <div className="flex flex-col gap-2 max-h-96 overflow-y-auto">
          {words.map((w, i) => (
            <div key={i} className="rounded-xl bg-gray-50 p-2 flex items-center gap-2">
              <input
                value={w.english}
                onChange={(e) => updateWord(i, "english", e.target.value)}
                placeholder="영어"
                className="flex-1 min-w-0 rounded-lg border border-gray-200 px-2 py-1.5"
              />
              <input
                value={w.korean}
                onChange={(e) => updateWord(i, "korean", e.target.value)}
                placeholder="한글 뜻"
                className="flex-1 min-w-0 rounded-lg border border-gray-200 px-2 py-1.5"
              />
              <input
                value={w.pos ?? ""}
                onChange={(e) => updateWord(i, "pos", e.target.value)}
                placeholder="품사"
                className="w-16 shrink-0 rounded-lg border border-gray-200 px-2 py-1.5 text-sm"
              />
              <button
                onClick={() => removeWord(i)}
                className="shrink-0 text-gray-300 text-sm px-1"
              >
                삭제
              </button>
            </div>
          ))}
        </div>
        {error && <p className="text-red-500 text-sm text-center">{error}</p>}
        <div className="flex gap-2">
          <button onClick={onCancel} className="flex-1 py-3 rounded-full bg-gray-100 font-bold">
            취소
          </button>
          <button
            onClick={confirmSet}
            disabled={words.length === 0}
            className="flex-1 py-3 rounded-full bg-sky-600 text-white font-bold disabled:opacity-40"
          >
            단어장 저장하기
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
          <p className="font-semibold">단어 표가 있는 사진을 선택하세요 (여러 장도 가능)</p>
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
        {loading ? "단어 읽는 중..." : "사진 선택하기"}
      </button>

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
