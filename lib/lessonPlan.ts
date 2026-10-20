"use client";

import type { VocabSet } from "./types";
import { lessonFromSetId, lessonSetsFromDefs, type MeaningDraft } from "./lessonData";
import { applyGameDone, applyGamePlayed, applyStudyDone, localDateKey, newPlan, normalizePlan, restartPlan, type LessonPlan } from "./lessonPlanCore";

export { lessonFromSetId, lessonSetId, draftKey, type MeaningDraft } from "./lessonData";
export type { LessonPlan } from "./lessonPlanCore";

const PLAN_KEY = "chunkbook-v2-lesson-plan";

// ---------- 진행 저장 ----------
export function loadLessonPlanRaw(): LessonPlan | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(PLAN_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as LessonPlan;
    return p && p.version === 1 ? p : null;
  } catch {
    return null;
  }
}

export function saveLessonPlan(plan: LessonPlan | null) {
  if (typeof window === "undefined") return;
  if (plan === null) localStorage.removeItem(PLAN_KEY);
  else localStorage.setItem(PLAN_KEY, JSON.stringify(plan));
}

// 불러오면서 날짜 이동(완료한 다음 학습일에 다음 Lesson)을 반영하고 저장한다.
export function loadLessonPlan(): LessonPlan | null {
  const raw = loadLessonPlanRaw();
  if (!raw) return null;
  const norm = normalizePlan(raw, localDateKey());
  if (norm !== raw) saveLessonPlan(norm);
  return norm;
}

// ---------- 학습/게임 완료 기록 (단어별 기록과는 별개) ----------
export function recordLessonStudyDone(setId: string) {
  const lesson = lessonFromSetId(setId);
  const plan = loadLessonPlan();
  if (lesson === null || !plan) return;
  saveLessonPlan(applyStudyDone(plan, lesson, localDateKey()));
}

// 게임 한 종류(hunt/mole/battle)를 마쳤다고 기록한다. 3종이 모이면 게임 완료.
export function recordLessonGamePlayed(setId: string, kind: string) {
  const lesson = lessonFromSetId(setId);
  const plan = loadLessonPlan();
  if (lesson === null || !plan) return;
  saveLessonPlan(applyGamePlayed(plan, lesson, kind, localDateKey()));
}

export function recordLessonGameDone(setId: string) {
  const lesson = lessonFromSetId(setId);
  const plan = loadLessonPlan();
  if (lesson === null || !plan) return;
  saveLessonPlan(applyGameDone(plan, lesson, localDateKey()));
}

// 오늘 이 Lesson의 학습을 이미 마쳤는지(진행 계획 기준). 계획은 동기화되지만 오늘의 학습 카드 기록은 기기마다
// 따로라서, 다른 기기이거나 카드 기록이 지워진 경우에도 "학습 완료"와 게임하기 잠금이 어긋나지 않게 맞출 때 쓴다.
export function lessonStudyDoneByPlan(setId: string): boolean {
  const lesson = lessonFromSetId(setId);
  const plan = loadLessonPlan();
  if (lesson === null || !plan) return false;
  if (plan.progress && plan.progress.lesson === lesson && plan.progress.studyDone) return true;
  return plan.currentLesson === lesson && plan.completedOn === localDateKey();
}

// 3종 게임을 모두 마쳤다는 기록(기기에 남은 하루 단위 기록들의 합)이 있는데 진행 계획에는 "게임 완료"가 빠져 있으면 맞춘다.
// 바뀐 계획을 돌려주고(저장함), 바꿀 게 없으면 null.
export function reconcileLessonGameDone(setId: string, localKinds: string[] = []): LessonPlan | null {
  const lesson = lessonFromSetId(setId);
  let plan = loadLessonPlan();
  if (lesson === null || !plan) return null;
  const before = JSON.stringify(plan);
  // 이 기기에 남은 게임 기록을 진행 계획(동기화되는 값)에 합쳐 넣는다.
  for (const k of localKinds) plan = applyGamePlayed(plan, lesson, k, localDateKey());
  if (JSON.stringify(plan) === before) return null;
  saveLessonPlan(plan);
  return plan;
}

export function restartLessonPlan(): LessonPlan | null {
  const plan = loadLessonPlanRaw();
  if (!plan) return null;
  const next = restartPlan(plan, localDateKey());
  saveLessonPlan(next);
  return next;
}

// ---------- Lesson 묶음 → 단어장 세트 ----------
// 이미 만든 세트는 단어별 학습 기록(box, nextDueAt, wrongCount)을 그대로 두고 뜻만 갱신한다.
export function isLessonSet(set: Pick<VocabSet, "id">): boolean {
  return lessonFromSetId(set.id) !== null;
}

// 코드의 Lesson 단어 정의가 늘어난 경우(예: 추가 단어 배치 변경), 이미 저장된 Lesson 세트에 빠진 단어를 채워 넣는다.
// 단어별 기록(box 등)과 부모가 고친 뜻은 그대로 두고, 아직 확인·저장 전(세트가 없음)이면 아무것도 하지 않는다.
export function refreshLessonSets(existing: VocabSet[]): { sets: VocabSet[]; changedLessons: number[] } {
  const have = existing.filter(isLessonSet);
  if (have.length === 0) return { sets: existing, changedLessons: [] };
  const refreshed = lessonSetsFromDefs(existing, {});
  const changedLessons: number[] = [];
  for (const rs of refreshed) {
    const old = existing.find((s) => s.id === rs.id);
    const sameWords = old && old.words.length === rs.words.length && old.words.every((w, i) => w.id === rs.words[i].id);
    if (!sameWords) changedLessons.push(lessonFromSetId(rs.id) as number);
  }
  if (changedLessons.length === 0) return { sets: existing, changedLessons };
  const others = existing.filter((s) => !isLessonSet(s));
  return { sets: [...others, ...refreshed], changedLessons };
}

// 부모가 확인·저장하면 7개 Lesson 세트를 만들고 진행 계획을 시작한다.
export function confirmLessons(existing: VocabSet[], draft: MeaningDraft): { sets: VocabSet[]; plan: LessonPlan } {
  const lessonSets = lessonSetsFromDefs(existing, draft);
  const others = existing.filter((s) => !isLessonSet(s));
  const prevPlan = loadLessonPlanRaw();
  const plan = prevPlan ? { ...prevPlan, confirmedAt: Date.now() } : newPlan(localDateKey(), Date.now());
  saveLessonPlan(plan);
  return { sets: [...others, ...lessonSets], plan };
}
