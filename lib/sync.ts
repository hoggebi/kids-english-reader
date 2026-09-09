"use client";

import { loadChapters, saveChapters } from "./storage";
import { loadPet, savePet, setDoneChapterIds, getAllDoneChapterIds, type PetState } from "./pet";
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

type SyncPayload = {
  chapters: Chapter[];
  doneChapterIds: string[];
  pet: PetState;
  vocabPet: PetState;
  vocabSets: VocabSet[];
};

function currentPayload(): SyncPayload {
  return {
    chapters: loadChapters(),
    doneChapterIds: getAllDoneChapterIds(),
    pet: loadPet("chapter"),
    vocabPet: loadPet("vocab"),
    vocabSets: loadVocabSets(),
  };
}

// 지금 내 기기 상태를 서버에 그대로 덮어씀 (서버가 유일한 정답 — 병합하지 않음)
export async function pushSync(code: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch("/api/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // 챕터/게임을 끝내자마자 탭을 닫거나 앱을 배경으로 보내도, 이미 시작된 이 요청은
      // 브라우저가 끝까지 완료시켜준다 (그렇지 않으면 딱 그 순간의 진행상황이 서버에 못 감).
      keepalive: true,
      body: JSON.stringify({ code, data: currentPayload() }),
    });
    if (!res.ok) {
      const json = await res.json().catch(() => null);
      return { ok: false, error: `저장 실패 (HTTP ${res.status}) ${json?.error ?? ""}`.trim() };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "네트워크 오류" };
  }
}

// 서버에서 최신 상태를 받아와 내 기기 값을 그대로 덮어씀 (서버가 유일한 정답).
// 서버에 아직 아무것도 없으면(새로 만든 코드 등) 내 기기 값을 그대로 둔다.
export async function pullSync(code: string): Promise<{
  chapters: Chapter[];
  pet: PetState;
  vocabPet: PetState;
  vocabSets: VocabSet[];
}> {
  try {
    const res = await fetch(`/api/sync?code=${encodeURIComponent(code)}`, {
      cache: "no-store",
    });
    const json = await res.json();
    const data = json.data as Partial<SyncPayload> | null;

    // 필드별로 서버에 실제로 값이 있을 때만 덮어쓴다 — 예전 저장 형식엔 없던 필드(예: vocabPet)라고
    // 해서 기본값으로 리셋해버리면 안 되기 때문 (스키마가 늘어나도 항상 안전하게 마이그레이션되도록).
    if (data) {
      if (data.chapters) saveChapters(data.chapters);
      if (data.doneChapterIds) setDoneChapterIds(data.doneChapterIds);
      if (data.pet) savePet(data.pet, "chapter");
      if (data.vocabPet) savePet(data.vocabPet, "vocab");
      if (data.vocabSets) saveVocabSets(data.vocabSets);
    }
  } catch {
    // 네트워크 오류 등은 조용히 무시하고 지금 내 기기 값을 그대로 반환
  }

  return {
    chapters: loadChapters(),
    pet: loadPet("chapter"),
    vocabPet: loadPet("vocab"),
    vocabSets: loadVocabSets(),
  };
}

// 받아오고(pull) 나서, 화면에 반영된 최신 상태를 다시 서버에 올림(push) — 양쪽 기기를 완전히 맞춤
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
