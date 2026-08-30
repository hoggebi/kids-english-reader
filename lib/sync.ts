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

// 지금 내 기기 상태를 서버에 올림 — 성공 여부와 실패 이유, 디버그 개수를 반환
export async function pushSync(code: string): Promise<{
  ok: boolean;
  error?: string;
  sentVocabSets?: number;
  serverVocabSetsAfter?: number;
  existingBefore?: number;
  existingWasNull?: boolean;
  usedKey?: string;
}> {
  const payload = currentPayload();
  try {
    const res = await fetch("/api/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, data: payload }),
    });
    const json = await res.json().catch(() => null);
    if (!res.ok) {
      const detail = json?.error ?? "";
      return {
        ok: false,
        error: `저장 실패 (HTTP ${res.status}) ${detail}`.trim(),
        sentVocabSets: payload.vocabSets.length,
      };
    }
    return {
      ok: true,
      sentVocabSets: payload.vocabSets.length,
      serverVocabSetsAfter: json?.finalVocabSetsAfterMerge,
      existingBefore: json?.existingVocabSetsBeforeMerge,
      existingWasNull: json?.existingWasNull,
      usedKey: json?.usedKey,
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "네트워크 오류",
      sentVocabSets: payload.vocabSets.length,
    };
  }
}

// 서버에서 최신 상태를 받아와 내 기기와 합침
export async function pullSync(code: string): Promise<{
  chapters: Chapter[];
  pet: PetState;
  vocabSets: VocabSet[];
}> {
  try {
    const res = await fetch(`/api/sync?code=${encodeURIComponent(code)}`, {
      cache: "no-store",
    });
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

      // 단어장: 새로 생긴 세트는 추가하고, 이미 있는 세트는 제목만 서버 최신값으로 맞춤
      // (단어별 학습 진행상황/세트 상태는 기기마다 다를 수 있어서 로컬 걸 그대로 유지)
      if (data.vocabSets) {
        const existingVocab = loadVocabSets();
        const remoteVocabMap = new Map(data.vocabSets.map((s) => [s.id, s]));
        const updatedExisting = existingVocab.map((s) => {
          const remote = remoteVocabMap.get(s.id);
          return remote && remote.title !== s.title ? { ...s, title: remote.title } : s;
        });
        const existingVocabIds = new Set(existingVocab.map((s) => s.id));
        const onlyRemoteVocab = data.vocabSets.filter((s) => !existingVocabIds.has(s.id));
        saveVocabSets([...updatedExisting, ...onlyRemoteVocab]);
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
  return {
    ...pulled,
    pushOk: pushResult.ok,
    pushError: pushResult.error,
    sentVocabSets: pushResult.sentVocabSets,
    serverVocabSetsAfter: pushResult.serverVocabSetsAfter,
    existingBefore: pushResult.existingBefore,
    existingWasNull: pushResult.existingWasNull,
    usedKey: pushResult.usedKey,
  };
}

// 동기화 코드가 설정돼 있으면, 지금 상태를 서버에 올림 (변경이 생길 때마다 호출)
export async function autoPush() {
  const code = getSyncCode();
  if (code) await pushSync(code);
}
