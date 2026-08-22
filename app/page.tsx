"use client";

import { useEffect, useState } from "react";
import type { Chapter } from "@/lib/types";
import { loadChapters, addChapter, deleteChapter } from "@/lib/storage";
import ChapterList from "@/components/ChapterList";
import ChapterUpload from "@/components/ChapterUpload";
import ChapterReader from "@/components/ChapterReader";

type View = "list" | "add" | "read";

export default function Home() {
  const [view, setView] = useState<View>("list");
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [activeChapter, setActiveChapter] = useState<Chapter | null>(null);

  useEffect(() => {
    setChapters(loadChapters());
  }, []);

  function handleCreated(chapter: Chapter) {
    setChapters(addChapter(chapter));
    setActiveChapter(chapter);
    setView("read");
  }

  function handleDelete(id: string) {
    setChapters(deleteChapter(id));
  }

  function handleSelect(chapter: Chapter) {
    setActiveChapter(chapter);
    setView("read");
  }

  return (
    <div className="min-h-screen bg-white flex flex-col items-center px-4 py-8 gap-6">
      <header className="w-full max-w-md flex items-center justify-between">
        <h1
          className="font-title text-2xl font-extrabold text-green-600 cursor-pointer"
          onClick={() => setView("list")}
        >
          📚 리틀 리더
        </h1>
      </header>

      {view === "list" && (
        <ChapterList
          chapters={chapters}
          onSelect={handleSelect}
          onAdd={() => setView("add")}
          onDelete={handleDelete}
        />
      )}

      {view === "add" && (
        <ChapterUpload onCreated={handleCreated} onCancel={() => setView("list")} />
      )}

      {view === "read" && activeChapter && (
        <ChapterReader chapter={activeChapter} onBack={() => setView("list")} />
      )}
    </div>
  );
}
