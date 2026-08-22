"use client";

import type { Chapter } from "@/lib/types";

export default function ChapterList({
  chapters,
  onSelect,
  onAdd,
  onDelete,
}: {
  chapters: Chapter[];
  onSelect: (chapter: Chapter) => void;
  onAdd: () => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="w-full max-w-md flex flex-col gap-4">
      <button
        onClick={onAdd}
        className="w-full py-3 rounded-full bg-orange-500 text-white font-bold text-lg active:scale-95 transition"
      >
        📚 새 챕터 만들기
      </button>

      {chapters.length === 0 ? (
        <p className="text-center text-gray-400 text-sm py-8">
          아직 만든 챕터가 없어요. 위 버튼으로 시작해보세요!
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {chapters.map((c) => (
            <div
              key={c.id}
              className="rounded-2xl bg-orange-50 p-4 flex items-center justify-between cursor-pointer active:scale-[0.98] transition"
              onClick={() => onSelect(c)}
            >
              <div>
                <div className="font-bold text-gray-700">{c.title}</div>
                <div className="text-xs text-gray-400">{c.pages.length}쪽</div>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (confirm(`"${c.title}" 챕터를 삭제할까요?`)) onDelete(c.id);
                }}
                className="text-gray-300 text-sm px-2"
              >
                🗑
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
