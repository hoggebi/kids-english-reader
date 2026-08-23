"use client";

import { useEffect, useState } from "react";
import type { Chapter } from "@/lib/types";
import { loadChapters, addChapter, deleteChapter, saveChapters, renameChapter } from "@/lib/storage";
import { loadPet, type PetState } from "@/lib/pet";
import ChapterList from "@/components/ChapterList";
import ChapterUpload from "@/components/ChapterUpload";
import ChapterReader from "@/components/ChapterReader";
import PetDisplay from "@/components/PetDisplay";

type View = "list" | "add" | "read";

export default function Home() {
  const [view, setView] = useState<View>("list");
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [activeChapter, setActiveChapter] = useState<Chapter | null>(null);
  const [pet, setPet] = useState<PetState | null>(null);

  useEffect(() => {
    setChapters(loadChapters());
    setPet(loadPet());
  }, []);

  function goToList() {
    setView("list");
    setPet(loadPet());
  }

  function handleCreated(chapter: Chapter) {
    setChapters(addChapter(chapter));
    setActiveChapter(chapter);
    setView("read");
  }

  function handleDelete(id: string) {
    setChapters(deleteChapter(id));
  }

  function handleReorder(newOrder: Chapter[]) {
    saveChapters(newOrder);
    setChapters(newOrder);
  }

  function handleRename(id: string, newTitle: string) {
    setChapters(renameChapter(id, newTitle));
  }

  function handleSelect(chapter: Chapter) {
    setActiveChapter(chapter);
    setView("read");
  }

  return (
    <div className="min-h-screen bg-white flex flex-col items-center px-4 py-8 gap-6">
      <header
        className="w-full max-w-4xl flex flex-col items-center gap-2 cursor-pointer"
        onClick={goToList}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/character.png" alt="캐릭터" className="w-24 h-24 object-contain" />
        <h1 className="font-title text-black text-4xl text-center">오늘도 호 English</h1>
      </header>

      {view === "list" && (
        <>
          {pet && <PetDisplay pet={pet} />}
          <ChapterList
            chapters={chapters}
            onSelect={handleSelect}
            onAdd={() => setView("add")}
            onDelete={handleDelete}
            onReorder={handleReorder}
            onRename={handleRename}
          />
        </>
      )}

      {view === "add" && (
        <ChapterUpload onCreated={handleCreated} onCancel={goToList} />
      )}

      {view === "read" && activeChapter && (
        <ChapterReader chapter={activeChapter} onBack={goToList} />
      )}
    </div>
  );
}
