"use client";

import type { Chapter } from "./types";

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

export function addChapter(chapter: Chapter) {
  const chapters = [chapter, ...loadChapters()];
  saveChapters(chapters);
  return chapters;
}

export function deleteChapter(id: string) {
  const chapters = loadChapters().filter((c) => c.id !== id);
  saveChapters(chapters);
  return chapters;
}
