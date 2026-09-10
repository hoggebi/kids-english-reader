"use client";

import { loadChapters, saveChapters } from "./storage";
import { loadPet, savePet, setDoneChapterIds, getAllDoneChapterIds, type PetState } from "./pet";
import { loadVocabSets, saveVocabSets } from "./vocabStorage";
import type { Chapter, VocabSet } from "./types";

const SYNC_CODE_KEY = "little-reader-sync-code";
const SYNC_REV_KEY = "little-reader-sync-rev";

// 마지막으로 서버에서 받아본(또는 성공적으로 저장한) 버전 번호. 이 값보다 서버가 이미 앞서 있으면
// 서버가 push를 거부한다 — 즉, 오래 안 열어봤거나 방금 받아오기(pull)에 실패한 기기가 옛날 값으로
// 다른 기기가 이미 올려둔 최신 값을 덮어쓰는 사고를 막아준다.
function getLastRev(): number {
  if (typeof window === "undefined") return 0;
  const raw = localStorage.getItem(SYNC_REV_KEY);
  const n = raw ? Number(raw) : 0;
  return Number.isFinite(n) ? n : 0;
}

function setLastRev(rev: number) {
  if (typeof window === "undefined") return;
  localStorage.setItem(SYNC_REV_KEY, String(rev));
}

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

function applyServerPayload(data: Partial<SyncPayload> | null) {
  // 필드별로 서버에 실제로 값이 있을 때만 덮어쓴다 — 예전 저장 형식엔 없던 필드(예: vocabPet)라고
  // 해서 기본값으로 리셋해버리면 안 되기 때문 (스키마가 늘어나도 항상 안전하게 마이그레이션되도록).
  if (!data) return;
  if (data.chapters) saveChapters(data.chapters);
  if (data.doneChapterIds) setDoneChapterIds(data.doneChapterIds);
  if (data.pet) savePet(data.pet, "chapter");
  if (data.vocabPet) savePet(data.vocabPet, "vocab");
  if (data.vocabSets) saveVocabSets(data.vocabSets);
}

// 지금 내 기기 상태를 서버에 올림. 단, 내가 마지막으로 받아본 버전보다 서버가 이미 앞서 있으면
// (= 다른 기기가 그 사이 더 최신 정보를 올려둠) 덮어쓰지 않고, 그 최신 정보를 대신 받아와 반영한다.
export async function pushSync(code: string): Promise<{ ok: boolean; error?: string; conflict?: boolean }> {
  try {
    // 주의: keepalive 옵션은 일부러 안 씀 — Safari(특히 아이패드) WebKit의 fetch keepalive
    // 구현에 알려진 버그가 많아서(화면 복귀 직후 요청 실패, 이동 시 CORS로 조용히 실패 등),
    // "탭을 바로 닫아도 요청을 끝까지 보낸다"는 이점보다 애초에 요청 자체가 깨질 위험이 더 크다.
    const res = await fetch("/api/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, data: currentPayload(), baseRev: getLastRev() }),
    });
    const json = await res.json().catch(() => null);

    if (res.status === 409 && json?.conflict) {
      // 다른 기기가 이미 더 최신 정보를 저장해둠 — 내 오래된 값으로 덮어쓰지 않고, 대신 최신 정보를 반영
      applyServerPayload(json.data as Partial<SyncPayload> | null);
      if (typeof json.rev === "number") setLastRev(json.rev);
      return {
        ok: false,
        conflict: true,
        error: "다른 기기가 방금 더 최신 정보를 저장해서, 이 기기의 변경사항 대신 최신 정보로 갱신했어요.",
      };
    }

    if (!res.ok) {
      return { ok: false, error: `저장 실패 (HTTP ${res.status}) ${json?.error ?? ""}`.trim() };
    }
    if (typeof json?.rev === "number") setLastRev(json.rev);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "네트워크 오류" };
  }
}

// 서버에서 최신 상태를 받아와 내 기기 값을 그대로 덮어씀 (서버가 유일한 정답).
// 서버에 아직 아무것도 없으면(새로 만든 코드 등) 내 기기 값을 그대로 둔다.
export async function pullSync(code: string): Promise<{
  ok: boolean;
  chapters: Chapter[];
  pet: PetState;
  vocabPet: PetState;
  vocabSets: VocabSet[];
}> {
  let ok = false;
  try {
    const res = await fetch(`/api/sync?code=${encodeURIComponent(code)}`, {
      cache: "no-store",
    });
    const json = await res.json();
    applyServerPayload(json.data as Partial<SyncPayload> | null);
    if (typeof json.rev === "number") setLastRev(json.rev);
    ok = true;
  } catch {
    // 네트워크 오류 등은 조용히 무시하고 지금 내 기기 값을 그대로 반환
    // (ok=false로 알려줘서, 호출한 쪽이 이 오래된 값을 그대로 다시 push해버리지 않게 한다)
  }

  return {
    ok,
    chapters: loadChapters(),
    pet: loadPet("chapter"),
    vocabPet: loadPet("vocab"),
    vocabSets: loadVocabSets(),
  };
}

// 받아오고(pull) 나서, 화면에 반영된 최신 상태를 다시 서버에 올림(push) — 양쪽 기기를 완전히 맞춤.
// pull이 실패하면(네트워크 오류 등) 오래된 내 기기 값을 그대로 push해서 서버를 덮어쓸 위험이 있으니
// push를 건너뛴다 (그래도 서버가 baseRev로 한 번 더 막아주지만, 애초에 시도하지 않는 게 더 안전하다).
export async function syncNow(code: string) {
  const pulled = await pullSync(code);
  if (!pulled.ok) {
    return { ...pulled, pushOk: false, pushError: "네트워크 오류로 최신 정보를 받아오지 못해, 저장은 건너뛰었어요." };
  }
  const pushResult = await pushSync(code);
  return { ...pulled, pushOk: pushResult.ok, pushError: pushResult.error };
}

// 동기화 코드가 설정돼 있으면, 지금 상태를 서버에 올림 (변경이 생길 때마다 호출)
export async function autoPush() {
  const code = getSyncCode();
  if (code) await pushSync(code);
}
