"use client";

import { useState } from "react";
import type { VocabSet } from "@/lib/types";

export default function VocabList({
  sets,
  onSelect,
  onAdd,
  onDelete,
  onRename,
}: {
  sets: VocabSet[];
  onSelect: (set: VocabSet) => void;
  onAdd: () => void;
  onDelete: (id: string) => void;
  onRename: (id: string, newTitle: string) => void;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState("");

  function startEdit(s: VocabSet) {
    setEditingId(s.id);
    setDraftTitle(s.title);
  }

  function saveEdit(id: string) {
    const trimmed = draftTitle.trim();
    if (trimmed) onRename(id, trimmed);
    setEditingId(null);
  }

  function statusLabel(status: VocabSet["status"]) {
    if (status === "active") return { text: "진행중", style: "bg-sky-100 text-sky-600" };
    if (status === "completed") return { text: "완료", style: "bg-gray-200 text-gray-500" };
    return { text: "잠김", style: "bg-gray-100 text-gray-400" };
  }

  return (
    <div className="w-full max-w-4xl flex flex-col gap-4">
      <button
        onClick={onAdd}
        className="w-full py-3 rounded-full bg-sky-600 text-white font-bold text-lg active:scale-95 transition"
      >
        새 단어장 만들기
      </button>

      {sets.length === 0 ? (
        <p className="text-center text-gray-400 text-sm py-8">
          아직 만든 단어장이 없어요. 위 버튼으로 시작해보세요.
        </p>
      ) : (
        <div className="flex flex-col gap-3 lg:grid lg:grid-cols-2 lg:gap-4">
          {sets.map((s) => {
            const isEditing = editingId === s.id;
            const isLocked = s.status === "locked";
            const badge = statusLabel(s.status);
            return (
              <div
                key={s.id}
                className={`rounded-2xl bg-gray-50 p-4 flex items-center justify-between transition ${
                  isEditing || isLocked ? "" : "cursor-pointer active:scale-[0.98]"
                } ${isLocked ? "opacity-50" : ""}`}
                onClick={() => !isEditing && !isLocked && onSelect(s)}
              >
                {isEditing ? (
                  <input
                    autoFocus
                    value={draftTitle}
                    onChange={(e) => setDraftTitle(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") saveEdit(s.id);
                      if (e.key === "Escape") setEditingId(null);
                    }}
                    className="flex-1 min-w-0 rounded-lg border-2 border-sky-300 px-2 py-1 font-bold text-gray-800"
                  />
                ) : (
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <div className="font-bold truncate text-gray-800">{s.title}</div>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full shrink-0 ${badge.style}`}>
                        {badge.text}
                      </span>
                    </div>
                    <div className="text-xs text-gray-400 mt-0.5">
                      {s.words.length}개 단어
                      {isLocked && " · 이전 단어장을 다 끝내면 열려요"}
                    </div>
                  </div>
                )}

                {isEditing ? (
                  <div className="flex gap-1 shrink-0">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        saveEdit(s.id);
                      }}
                      className="px-3 py-1.5 rounded-full bg-sky-600 text-white text-sm font-bold"
                    >
                      저장
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingId(null);
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
                        startEdit(s);
                      }}
                      className="text-sky-500 text-sm px-1"
                    >
                      수정
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm(`"${s.title}" 단어장을 삭제할까요?`)) onDelete(s.id);
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
