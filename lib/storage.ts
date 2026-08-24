"use client";

import type { Chapter } from "./types";
import { getAllDoneChapterIds, mergeDoneChapterIds, loadPet, mergePetState, type PetState } from "./pet";

const STORAGE_KEY = "little-reader-chapters";

export function loadChapters(): Chapter[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as Chapter[];
  } catch {
    return [];
  }
}

export function saveChapters(chapters: Chapter[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(chapters));
}

// 새 챕터는 맨 아래에 쌓이도록 추가 (오래된 챕터가 위에 보임)
export function addChapter(chapter: Chapter) {
  const chapters = [...loadChapters(), chapter];
  saveChapters(chapters);
  return chapters;
}

export function deleteChapter(id: string) {
  const chapters = loadChapters().filter((c) => c.id !== id);
  saveChapters(chapters);
  return chapters;
}

export function renameChapter(id: string, newTitle: string) {
  const chapters = loadChapters().map((c) =>
    c.id === id ? { ...c, title: newTitle } : c
  );
  saveChapters(chapters);
  return chapters;
}

// 챕터 목록을 링크로 내보내기 (서버 없이, 링크 안에 데이터를 직접 담음)
// 완료 표시와 여우 성장 상태도 함께 담아서 다른 기기에서도 똑같이 보이게 함
export function exportChaptersData(): string {
  if (typeof window === "undefined") return "";
  const payload = {
    chapters: loadChapters(),
    doneChapterIds: getAllDoneChapterIds(),
    pet: loadPet(),
  };
  return btoa(encodeURIComponent(JSON.stringify(payload)));
}

// 다른 기기에서 받은 데이터를 가져와 챕터·완료 표시·여우 상태를 합침
export function importChaptersData(encoded: string): Chapter[] {
  try {
    const json = decodeURIComponent(atob(encoded));
    const payload = JSON.parse(json) as {
      chapters: Chapter[];
      doneChapterIds?: string[];
      pet?: PetState;
    };

    const existing = loadChapters();
    const existingIds = new Set(existing.map((c) => c.id));
    const merged = [...existing, ...payload.chapters.filter((c) => !existingIds.has(c.id))];
    saveChapters(merged);

    if (payload.doneChapterIds) mergeDoneChapterIds(payload.doneChapterIds);
    if (payload.pet) mergePetState(payload.pet);

    return merged;
  } catch {
    return loadChapters();
  }
}
