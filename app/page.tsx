"use client";

import { useEffect, useState } from "react";
import type { Chapter } from "@/lib/types";
import {
  loadChapters,
  addChapter,
  deleteChapter,
  saveChapters,
  renameChapter,
  exportChaptersData,
  importChaptersData,
} from "@/lib/storage";
import { loadPet, type PetState } from "@/lib/pet";
import {
  getSyncCode,
  setSyncCode as saveSyncCode,
  clearSyncCode,
  makeRandomCode,
  syncNow,
  autoPush,
} from "@/lib/sync";
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
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  const [syncCode, setSyncCodeState] = useState<string | null>(null);
  const [joinInput, setJoinInput] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [showJoinBox, setShowJoinBox] = useState(false);

  useEffect(() => {
    setChapters(loadChapters());
    setPet(loadPet());

    // 다른 기기에서 받은 동기화 링크로 열었으면, 그 안의 챕터들을 가져와서 합침
    if (typeof window !== "undefined" && window.location.hash.startsWith("#sync=")) {
      const encoded = window.location.hash.slice("#sync=".length);
      const merged = importChaptersData(encoded);
      setChapters(merged);
      setPet(loadPet());
      setSyncMessage("다른 기기의 챕터를 가져왔어요!");
      window.history.replaceState(null, "", window.location.pathname);
    }

    const code = getSyncCode();
    setSyncCodeState(code);
    if (code) {
      setSyncing(true);
      syncNow(code).then((result) => {
        setChapters(result.chapters);
        setPet(result.pet);
        setSyncing(false);
      });
    }
  }, []);

  useEffect(() => {
    if (!syncMessage) return;
    const t = setTimeout(() => setSyncMessage(null), 4000);
    return () => clearTimeout(t);
  }, [syncMessage]);

  async function handleCreateSyncCode() {
    const code = makeRandomCode();
    saveSyncCode(code);
    setSyncCodeState(code);
    setSyncing(true);
    await autoPush();
    setSyncing(false);
  }

  async function handleJoinSyncCode() {
    const code = joinInput.trim();
    if (!code) return;
    saveSyncCode(code);
    setSyncCodeState(code);
    setSyncing(true);
    const result = await syncNow(code);
    setChapters(result.chapters);
    setPet(result.pet);
    setSyncing(false);
    setShowJoinBox(false);
    setJoinInput("");
    setSyncMessage("동기화됐어요!");
  }

  function handleStopSync() {
    if (!confirm("이 기기의 동기화를 끌까요? (데이터는 그대로 남아있어요)")) return;
    clearSyncCode();
    setSyncCodeState(null);
  }

  async function handleManualSync() {
    if (!syncCode) return;
    setSyncing(true);
    const result = await syncNow(syncCode);
    setChapters(result.chapters);
    setPet(result.pet);
    setSyncing(false);
    setSyncMessage("동기화됐어요!");
  }

  async function handleExport() {
    const encoded = exportChaptersData();
    const url = `${window.location.origin}${window.location.pathname}#sync=${encoded}`;

    if (navigator.share) {
      try {
        await navigator.share({ title: "오늘도 호 English 챕터", url });
        return;
      } catch {
        // 공유 취소 등은 무시하고 복사로 대체
      }
    }

    try {
      await navigator.clipboard.writeText(url);
      alert("링크가 복사됐어요! 카카오톡이나 문자로 보내서 다른 기기에서 열어보세요.");
    } catch {
      alert(url);
    }
  }

  function goToList() {
    setView("list");
    setPet(loadPet());
  }

  function handleCreated(chapter: Chapter) {
    setChapters(addChapter(chapter));
    setActiveChapter(chapter);
    setView("read");
    autoPush();
  }

  function handleDelete(id: string) {
    setChapters(deleteChapter(id));
    autoPush();
  }

  function handleReorder(newOrder: Chapter[]) {
    saveChapters(newOrder);
    setChapters(newOrder);
    autoPush();
  }

  function handleRename(id: string, newTitle: string) {
    setChapters(renameChapter(id, newTitle));
    autoPush();
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

      {syncMessage && (
        <div className="w-full max-w-4xl rounded-2xl bg-sky-50 border-2 border-sky-200 p-3 text-center">
          <p className="text-sky-700 font-bold text-sm">{syncMessage}</p>
        </div>
      )}

      {view === "list" && (
        <>
          {pet && <PetDisplay pet={pet} />}

          {/* 기기 간 자동 동기화 설정 */}
          <div className="w-full max-w-4xl rounded-2xl bg-gray-50 p-4 flex flex-col gap-3">
            {syncCode ? (
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs text-gray-400">동기화 코드</p>
                  <p className="font-title text-2xl tracking-widest text-sky-700">{syncCode}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleManualSync}
                    disabled={syncing}
                    className="px-4 py-2 rounded-full bg-sky-600 text-white text-sm font-bold disabled:opacity-50"
                  >
                    {syncing ? "동기화 중..." : "지금 동기화"}
                  </button>
                  <button
                    onClick={handleStopSync}
                    className="px-4 py-2 rounded-full bg-gray-200 text-gray-600 text-sm font-bold"
                  >
                    끄기
                  </button>
                </div>
              </div>
            ) : (
              <>
                <p className="text-sm text-gray-600">
                  다른 기기와 자동으로 동기화하려면 코드를 만들고, 다른 기기에서 같은 코드를 입력하세요.
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={handleCreateSyncCode}
                    className="flex-1 py-3 rounded-full bg-sky-600 text-white font-bold"
                  >
                    새 동기화 코드 만들기
                  </button>
                  <button
                    onClick={() => setShowJoinBox((v) => !v)}
                    className="flex-1 py-3 rounded-full bg-gray-100 text-gray-700 font-bold"
                  >
                    코드로 연결하기
                  </button>
                </div>
                {showJoinBox && (
                  <div className="flex gap-2">
                    <input
                      value={joinInput}
                      onChange={(e) => setJoinInput(e.target.value)}
                      placeholder="예: AB12CD"
                      className="flex-1 rounded-xl border-2 border-gray-200 px-3 py-2 uppercase"
                    />
                    <button
                      onClick={handleJoinSyncCode}
                      className="px-4 py-2 rounded-full bg-sky-600 text-white font-bold"
                    >
                      연결
                    </button>
                  </div>
                )}
              </>
            )}
          </div>

          <button
            onClick={handleExport}
            className="text-sm text-sky-600 font-bold underline"
          >
            링크로 한 번만 보내기
          </button>

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
