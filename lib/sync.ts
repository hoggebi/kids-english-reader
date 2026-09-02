"use client";

import { loadChapters, saveChapters } from "./storage";
import {
  getAllDoneChapterIds,
  mergeDoneChapterIds,
  loadPet,
  savePet,
  mergePetState,
  hasAdoptedChapterMigration,
  markChapterMigrationAdopted,
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
export async function pushSync(
  code: string,
  options?: { forcePetOverwrite?: boolean }
): Promise<{
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
      body: JSON.stringify({
        code,
        data: {
          ...payload,
          forcePetOverwrite: options?.forcePetOverwrite ?? false,
          // 이 코드가 실행된다는 것 자체가 "흑표범/늑대로 바뀐 버전"이라는 뜻이라, 항상 표시해둠
          // (서버는 한 번이라도 true를 받으면 계속 true로 유지함)
          chapterSpeciesMigrated: true,
        },
      }),
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
  chapterSpeciesMigrated: boolean;
}> {
  let migratedOnServer = false;
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
          chapterSpeciesMigrated?: boolean;
        }
      | null;

    if (data) {
      const existing = loadChapters();
      const existingIds = new Set(existing.map((c) => c.id));
      const merged = [...existing, ...data.chapters.filter((c) => !existingIds.has(c.id))];
      saveChapters(merged);
      if (data.doneChapterIds) mergeDoneChapterIds(data.doneChapterIds);

      migratedOnServer = !!data.chapterSpeciesMigrated;

      // 챕터 캐릭터(흑표범/늑대) 값 결정: "리셋했는지"를 기기별로 각자 판단하지 않고,
      // 서버가 이미 마이그레이션됐다고 하는지를 기준으로 삼는다.
      if (migratedOnServer) {
        if (!hasAdoptedChapterMigration()) {
          // 서버 값을 순위 비교 없이 그대로 한 번 받아들임(내 기기 값이 뭐였든 상관없이)
          savePet(data.pet ?? { stage: 1, generation: 1 }, "chapter");
          markChapterMigrationAdopted();
        } else if (data.pet) {
          // 이미 한 번 받아들인 뒤로는 평소처럼 "더 많이 자란 쪽" 기준으로 정상 동기화
          mergePetState(data.pet, "chapter");
        }
      } else {
        // 서버가 아직 마이그레이션 전이면, 지금 이 기기가 기준값(흑표범 1단계)을 세운다
        savePet({ stage: 1, generation: 1 }, "chapter");
        markChapterMigrationAdopted();
      }

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

  return {
    chapters: loadChapters(),
    pet: loadPet("chapter"),
    vocabSets: loadVocabSets(),
    chapterSpeciesMigrated: migratedOnServer,
  };
}

// 받아오고(pull) 나서 합쳐진 최신 상태를 다시 서버에 올림(push) — 양쪽 기기를 완전히 맞춤
export async function syncNow(code: string) {
  const pulled = await pullSync(code);
  // 서버가 아직 마이그레이션 전이었으면, 방금 이 기기가 세운 기준값을 순위 비교 없이 강제로 올림
  const pushResult = await pushSync(code, { forcePetOverwrite: !pulled.chapterSpeciesMigrated });
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
export async function autoPush(options?: { forcePetOverwrite?: boolean }) {
  const code = getSyncCode();
  if (code) await pushSync(code, options);
}
