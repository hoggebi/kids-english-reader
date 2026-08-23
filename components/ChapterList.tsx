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
  onRename,
}: {
  chapters: Chapter[];
  onSelect: (chapter: Chapter) => void;
  onAdd: () => void;
  onDelete: (id: string) => void;
  onReorder: (newOrder: Chapter[]) => void;
  onRename: (id: string, newTitle: string) => void;
}) {
  const [editingOrder, setEditingOrder] = useState(false);
  const [editingTitleId, setEditingTitleId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState("");

  function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= chapters.length) return;
    const next = [...chapters];
    [next[index], next[target]] = [next[target], next[index]];
    onReorder(next);
  }

  function startEditTitle(c: Chapter) {
    setEditingTitleId(c.id);
    setDraftTitle(c.title);
  }

  function saveTitle(id: string) {
    const trimmed = draftTitle.trim();
    if (trimmed) onRename(id, trimmed);
    setEditingTitleId(null);
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
            const isEditingTitle = editingTitleId === c.id;

            return (
              <div
                key={c.id}
                className={`rounded-2xl p-4 flex items-center justify-between transition ${
                  editingOrder || isEditingTitle ? "" : "cursor-pointer active:scale-[0.98]"
                } ${
                  done
                    ? "bg-sky-50 border-2 border-sky-200"
                    : "bg-gray-50 border-2 border-transparent"
                }`}
                onClick={() => !editingOrder && !isEditingTitle && onSelect(c)}
              >
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  {done && (
                    <span className="text-xs font-bold text-sky-600 bg-white border border-sky-200 rounded-full px-2 py-0.5 shrink-0">
                      완료
                    </span>
                  )}

                  {isEditingTitle ? (
                    <input
                      autoFocus
                      value={draftTitle}
                      onChange={(e) => setDraftTitle(e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") saveTitle(c.id);
                        if (e.key === "Escape") setEditingTitleId(null);
                      }}
                      className="flex-1 min-w-0 rounded-lg border-2 border-sky-300 px-2 py-1 font-bold text-gray-800"
                    />
                  ) : (
                    <div className="min-w-0">
                      <div className={`font-bold truncate ${done ? "text-sky-700" : "text-gray-800"}`}>
                        {c.title}
                      </div>
                      <div className="text-xs text-gray-400">{c.pages.length}쪽</div>
                    </div>
                  )}
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
                ) : isEditingTitle ? (
                  <div className="flex gap-1 shrink-0">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        saveTitle(c.id);
                      }}
                      className="px-3 py-1.5 rounded-full bg-sky-600 text-white text-sm font-bold"
                    >
                      저장
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingTitleId(null);
                      }}
                      className="px-3 py-1.5 rounded-full bg-gray-100 text-gray-500 text-sm font-bold"
                    >
                      취소
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        startEditTitle(c);
                      }}
                      className="text-sky-500 text-sm px-1"
                    >
                      수정
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm(`"${c.title}" 챕터를 삭제할까요?`)) onDelete(c.id);
                      }}
                      className="text-gray-300 text-sm px-1"
                    >
                      삭제
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
