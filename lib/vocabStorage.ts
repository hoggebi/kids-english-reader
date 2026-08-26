"use client";

import type { VocabSet } from "./types";

const VOCAB_KEY = "little-reader-vocab-sets";

export function loadVocabSets(): VocabSet[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(VOCAB_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as VocabSet[];
  } catch {
    return [];
  }
}

export function saveVocabSets(sets: VocabSet[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(VOCAB_KEY, JSON.stringify(sets));
}

export function addVocabSet(set: VocabSet) {
  const sets = [...loadVocabSets(), set];
  saveVocabSets(sets);
  return sets;
}

export function deleteVocabSet(id: string) {
  const sets = loadVocabSets().filter((s) => s.id !== id);
  saveVocabSets(sets);
  return sets;
}

export function renameVocabSet(id: string, newTitle: string) {
  const sets = loadVocabSets().map((s) =>
    s.id === id ? { ...s, title: newTitle } : s
  );
  saveVocabSets(sets);
  return sets;
}
