"use client";

// 몬스터 배틀의 "20 스테이지 학습 구간" 진행 상태. 캐릭터 성장 사이클(dart/mole/monster)과는
// 완전히 별개로 관리된다 — 여기서는 오직 "지금 단어 묶음으로 몇 스테이지까지 왔는지"만 기록한다.
const BATTLE_PROGRESS_PREFIX = "little-reader-battle-progress-";

export const BATTLE_STAGE_CAP = 20;

export type BattleProgress = {
  // 지금까지 이 단어 묶음으로 물리친 몬스터 수 (= 다음에 싸울 스테이지 - 1)
  defeatedCount: number;
  // 이 진행 상태가 어떤 단어 묶음 기준인지 (정렬된 단어 id 목록). 학습한 단어가 바뀌면
  // 새 스테이지 1부터 다시 시작한다.
  wordIds: string[];
};

function keyFor(setId: string) {
  return `${BATTLE_PROGRESS_PREFIX}${setId}`;
}

function sameWordIds(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const bSorted = [...b].sort();
  return [...a].sort().every((id, i) => id === bSorted[i]);
}

// 현재 단어 묶음(wordIds) 기준 진행 상태를 읽어온다. 저장된 진행 상태가 다른 단어 묶음
// 것이면(=새로운 단어를 학습해서 묶음이 바뀜) 새 20스테이지 사이클로 초기화해서 반환한다.
export function loadBattleProgress(setId: string, wordIds: string[]): BattleProgress {
  const sortedIds = [...wordIds].sort();
  if (typeof window === "undefined") return { defeatedCount: 0, wordIds: sortedIds };
  try {
    const raw = localStorage.getItem(keyFor(setId));
    if (raw) {
      const parsed = JSON.parse(raw) as BattleProgress;
      if (Array.isArray(parsed.wordIds) && sameWordIds(parsed.wordIds, sortedIds)) {
        return { defeatedCount: Math.max(0, parsed.defeatedCount ?? 0), wordIds: sortedIds };
      }
    }
  } catch {
    // 무시하고 새 사이클로 시작
  }
  const fresh: BattleProgress = { defeatedCount: 0, wordIds: sortedIds };
  saveBattleProgress(setId, fresh);
  return fresh;
}

export function saveBattleProgress(setId: string, progress: BattleProgress) {
  if (typeof window === "undefined") return;
  localStorage.setItem(keyFor(setId), JSON.stringify(progress));
}
