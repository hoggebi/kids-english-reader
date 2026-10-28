"use client";

import { useState } from "react";

// 아직 내용이 없는 Lesson 폴더(틀만). 청크북·단어장에서 같은 이름·같은 모양으로 쓴다.
export const SEED1_A3_LESSONS = [1, 2, 3, 4, 5, 6, 7, 8];

export default function EmptyLessonFolder({ name = "SEED1_A3", lessons = SEED1_A3_LESSONS }: { name?: string; lessons?: number[] }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="rounded-2xl bg-white border-2 border-amber-200 overflow-hidden" data-testid="lesson-folder-a3">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="w-full min-h-[56px] flex items-center gap-3 px-4 py-2 bg-amber-50 text-left active:bg-amber-100 transition"
      >
        <span className="text-2xl" aria-hidden>
          {open ? "📂" : "📁"}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-base font-black text-gray-800 truncate">{name}</span>
          <span className="block text-xs text-gray-500">Lesson {lessons.length}개 · 준비 중</span>
        </span>
        <span className="text-gray-500 font-bold" aria-hidden>
          {open ? "▾" : "▸"}
        </span>
      </button>
      {open && (
        <div className="p-3">
          <div className="grid grid-cols-4 sm:grid-cols-8 gap-2" data-testid="lesson-list-a3">
            {lessons.map((l) => (
              <button
                key={l}
                disabled
                aria-label={`Lesson ${l} 준비 중`}
                className="min-h-[56px] rounded-xl border border-gray-200 bg-gray-50 px-2 py-1 text-center text-gray-400"
              >
                <span className="block text-sm font-bold">Lesson {l}</span>
                <span className="block text-[11px]">준비 중</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
