"use client";

import { loadChapters, saveChapters } from "./storage";
import {
  getAllDoneChapterIds,
  mergeDoneChapterIds,
  loadPet,
  mergePetState,
  type PetState,
} from "./pet";
import { loadVocabSets, saveVocabSets } from "./vocabStorage";
import type { Chapter, VocabSet } from "./types";

const SYNC_CODE_KEY = "little-reader-sync-code";

export function getSyncCode(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(SYNC_CODE_KEY);
}

export function setSyncCode(code: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(SYNC_CODE_KEY, code.trim().toUpperCase());
}

export function clearSyncCode() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(SYNC_CODE_KEY);
}

export function makeRandomCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // 헷갈리는 글자(0,O,1,I) 제외
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

function currentPayload() {
  return {
    chapters: loadChapters(),
    doneChapterIds: getAllDoneChapterIds(),
    pet: loadPet(),
    vocabSets: loadVocabSets(),
  };
}

// 지금 내 기기 상태를 서버에 올림 — 성공 여부와 실패 이유를 반환
export async function pushSync(code: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch("/api/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, data: currentPayload() }),
    });
    if (!res.ok) {
      let detail = "";
      try {
        const json = await res.json();
        detail = json?.error ?? "";
      } catch {
        // 응답이 JSON이 아닐 수도 있음
      }
      return { ok: false, error: `저장 실패 (HTTP ${res.status}) ${detail}`.trim() };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "네트워크 오류" };
  }
}

// 서버에서 최신 상태를 받아와 내 기기와 합침
export async function pullSync(code: string): Promise<{
  chapters: Chapter[];
  pet: PetState;
  vocabSets: VocabSet[];
}> {
  try {
    const res = await fetch(`/api/sync?code=${encodeURIComponent(code)}`);
    const json = await res.json();
    const data = json.data as
      | {
          chapters: Chapter[];
          doneChapterIds?: string[];
          pet?: PetState;
          vocabSets?: VocabSet[];
        }
      | null;

    if (data) {
      const existing = loadChapters();
      const existingIds = new Set(existing.map((c) => c.id));
      const merged = [...existing, ...data.chapters.filter((c) => !existingIds.has(c.id))];
      saveChapters(merged);
      if (data.doneChapterIds) mergeDoneChapterIds(data.doneChapterIds);
      if (data.pet) mergePetState(data.pet);

      // 단어장도 챕터와 같은 방식으로: 내 기기에 없는 세트만 추가로 합침
      if (data.vocabSets) {
        const existingVocab = loadVocabSets();
        const existingVocabIds = new Set(existingVocab.map((s) => s.id));
        const mergedVocab = [
          ...existingVocab,
          ...data.vocabSets.filter((s) => !existingVocabIds.has(s.id)),
        ];
        saveVocabSets(mergedVocab);
      }
    }
  } catch {
    // 네트워크 오류 등은 조용히 무시
  }

  return { chapters: loadChapters(), pet: loadPet(), vocabSets: loadVocabSets() };
}

// 받아오고(pull) 나서 합쳐진 최신 상태를 다시 서버에 올림(push) — 양쪽 기기를 완전히 맞춤
export async function syncNow(code: string) {
  const pulled = await pullSync(code);
  const pushResult = await pushSync(code);
  return { ...pulled, pushOk: pushResult.ok, pushError: pushResult.error };
}

// 동기화 코드가 설정돼 있으면, 지금 상태를 서버에 올림 (변경이 생길 때마다 호출)
export async function autoPush() {
  const code = getSyncCode();
  if (code) await pushSync(code);
}
