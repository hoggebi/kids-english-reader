
"use client";

import { useState } from "react";
import type { Chapter } from "@/lib/types";
import { isChapterDone } from "@/lib/pet";

export default function ChapterList({
  chapters,
  onSelect,
  onAdd,
  onDelete,
  onReorder,
}: {
  chapters: Chapter[];
  onSelect: (chapter: Chapter) => void;
  onAdd: () => void;
  onDelete: (id: string) => void;
  onReorder: (newOrder: Chapter[]) => void;
}) {
  const [editingOrder, setEditingOrder] = useState(false);

  function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= chapters.length) return;
    const next = [...chapters];
    [next[index], next[target]] = [next[target], next[index]];
    onReorder(next);
  }

  return (
    <div className="w-full max-w-md flex flex-col gap-4">
      <button
        onClick={onAdd}
        className="w-full py-3 rounded-full bg-sky-600 text-white font-bold text-lg active:scale-95 transition"
      >
        새 챕터 만들기
      </button>

      {chapters.length > 1 && (
        <button
          onClick={() => setEditingOrder((v) => !v)}
          className="self-end text-sm text-sky-600 font-bold underline"
        >
          {editingOrder ? "순서 편집 끝내기" : "순서 편집하기"}
        </button>
      )}

      {chapters.length === 0 ? (
        <p className="text-center text-gray-400 text-sm py-8">
          아직 만든 챕터가 없어요. 위 버튼으로 시작해보세요.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {chapters.map((c, i) => {
            const done = isChapterDone(c.id);
            return (
              <div
                key={c.id}
                className={`rounded-2xl p-4 flex items-center justify-between transition ${
                  editingOrder ? "" : "cursor-pointer active:scale-[0.98]"
                } ${
                  done
                    ? "bg-sky-50 border-2 border-sky-200"
                    : "bg-gray-50 border-2 border-transparent"
                }`}
                onClick={() => !editingOrder && onSelect(c)}
              >
                <div className="flex items-center gap-2 min-w-0">
                  {done && (
                    <span className="text-xs font-bold text-sky-600 bg-white border border-sky-200 rounded-full px-2 py-0.5 shrink-0">
                      완료
                    </span>
                  )}
                  <div className="min-w-0">
                    <div className={`font-bold truncate ${done ? "text-sky-700" : "text-gray-800"}`}>
                      {c.title}
                    </div>
                    <div className="text-xs text-gray-400">{c.pages.length}쪽</div>
                  </div>
                </div>

                {editingOrder ? (
                  <div className="flex gap-1 shrink-0">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        move(i, -1);
                      }}
                      disabled={i === 0}
                      className="w-9 h-9 rounded-full bg-white border border-gray-200 text-gray-600 font-bold disabled:opacity-30"
                    >
                      ▲
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        move(i, 1);
                      }}
                      disabled={i === chapters.length - 1}
                      className="w-9 h-9 rounded-full bg-white border border-gray-200 text-gray-600 font-bold disabled:opacity-30"
                    >
                      ▼
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm(`"${c.title}" 챕터를 삭제할까요?`)) onDelete(c.id);
                    }}
                    className="text-gray-300 text-sm px-2 shrink-0"
                  >
                    삭제
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
