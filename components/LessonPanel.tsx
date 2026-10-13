"use client";

import { useMemo, useState } from "react";
import type { VocabSet } from "@/lib/types";
import { LESSON_DEFS, LESSON_NUMBERS, lessonSetId } from "@/lib/lessonData";
import { confirmLessons, draftKey, restartLessonPlan, type LessonPlan, type MeaningDraft } from "@/lib/lessonPlan";
import { canSelect, lessonStatus } from "@/lib/lessonPlanCore";

// 저장 전에 부모가 새 단어(교재 뜻)를 확인·수정하는 화면
function LessonReview({
  sets,
  onSave,
  onCancel,
}: {
  sets: VocabSet[];
  onSave: (draft: MeaningDraft) => void;
  onCancel: () => void;
}) {
  const initial = useMemo(() => {
    const d: MeaningDraft = {};
    for (const l of LESSON_NUMBERS) {
      const existing = sets.find((s) => s.id === lessonSetId(l));
      for (const w of LESSON_DEFS[l]) {
        d[draftKey(l, w.english)] = existing?.words.find((x) => x.english === w.english)?.korean ?? w.korean;
      }
    }
    return d;
  }, [sets]);
  const [draft, setDraft] = useState<MeaningDraft>(initial);
  const [open, setOpen] = useState<number>(LESSON_NUMBERS[0]);
  const emptyCount = Object.values(draft).filter((v) => !v.trim()).length;

  return (
    <div className="w-full max-w-4xl flex flex-col gap-3 rounded-2xl border-2 border-amber-300 bg-amber-50 p-4" data-testid="lesson-review">
      <div>
        <p className="font-bold text-amber-900">Lesson 단어 확인</p>
        <p className="text-sm text-amber-800">
          Lesson마다 교재 핵심 단어 10개를 학습 묶음으로 만들어요. 기존 단어장(Seed 1_2610)과 겹치는 단어는 기존 뜻을 쓰고,
          새 단어는 교재의 뜻이에요. 저장하기 전에 맞는지 확인하고 고쳐 주세요.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        {LESSON_NUMBERS.map((l) => {
          const defs = LESSON_DEFS[l];
          const isOpen = open === l;
          const newCount = defs.filter((w) => w.origin === "book").length;
          return (
            <div key={l} className="rounded-xl bg-white border border-amber-200">
              <button
                onClick={() => setOpen(isOpen ? -1 : l)}
                aria-expanded={isOpen}
                className="w-full min-h-[48px] px-3 flex items-center justify-between text-left"
              >
                <span className="font-bold text-gray-800">
                  Lesson {l} <span className="text-xs font-normal text-gray-500">단어 {defs.length}개 · 새 단어 {newCount}개</span>
                </span>
                <span className="text-gray-400">{isOpen ? "▲" : "▼"}</span>
              </button>
              {isOpen && (
                <ul className="px-3 pb-3 flex flex-col gap-2">
                  {defs.map((w) => {
                    const k = draftKey(l, w.english);
                    const editable = w.origin === "book";
                    return (
                      <li key={k} className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                          <span className="w-28 shrink-0 font-bold text-gray-800">{w.english}</span>
                          {editable ? (
                            <input
                              value={draft[k] ?? ""}
                              onChange={(e) => setDraft((d) => ({ ...d, [k]: e.target.value }))}
                              aria-label={`${w.english} 뜻`}
                              className="flex-1 min-h-[44px] rounded-lg border-2 border-sky-200 px-2"
                            />
                          ) : (
                            <span className="flex-1 min-h-[44px] flex items-center rounded-lg bg-gray-50 px-2 text-gray-700">
                              {w.korean}
                            </span>
                          )}
                          <span
                            className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold ${
                              w.origin === "book"
                                ? "bg-sky-100 text-sky-700"
                                : w.origin === "seed"
                                  ? "bg-gray-200 text-gray-600"
                                  : "bg-purple-100 text-purple-700"
                            }`}
                          >
                            {w.origin === "book" ? "교재 뜻" : w.origin === "seed" ? "기존 단어장 뜻" : "Seed 추가 단어"}
                          </span>
                        </div>
                        {w.note && <p className="text-xs text-amber-700 pl-1">⚠️ {w.note}</p>}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          );
        })}
      </div>

      {emptyCount > 0 && <p className="text-sm font-bold text-red-600">뜻이 비어 있는 단어가 있어요.</p>}
      <div className="flex gap-2">
        <button
          onClick={() => onSave(draft)}
          disabled={emptyCount > 0}
          className="min-h-[48px] px-5 rounded-full bg-sky-600 text-white font-bold disabled:opacity-50"
        >
          확인하고 저장
        </button>
        <button onClick={onCancel} className="min-h-[48px] px-5 rounded-full bg-white text-gray-700 font-bold">
          취소
        </button>
      </div>
    </div>
  );
}

export default function LessonPanel({
  sets,
  plan,
  onSetsChange,
  onPlanChange,
  onStart,
}: {
  sets: VocabSet[];
  plan: LessonPlan | null;
  onSetsChange: (sets: VocabSet[]) => void;
  onPlanChange: (plan: LessonPlan | null) => void;
  onStart: (set: VocabSet) => void;
}) {
  const [reviewing, setReviewing] = useState(false);
  const lessonSets = sets.filter((s) => LESSON_NUMBERS.some((l) => s.id === lessonSetId(l)));
  const confirmed = plan !== null && plan.confirmedAt !== null && lessonSets.length === LESSON_NUMBERS.length;

  function handleSave(draft: MeaningDraft) {
    const { sets: next, plan: p } = confirmLessons(sets, draft);
    onSetsChange(next);
    onPlanChange(p);
    setReviewing(false);
  }

  if (reviewing) {
    return <LessonReview sets={sets} onSave={handleSave} onCancel={() => setReviewing(false)} />;
  }

  // ---------- 시작 전 ----------
  if (!confirmed || !plan) {
    return (
      <div className="w-full max-w-4xl rounded-2xl bg-sky-50 border-2 border-sky-200 p-4 flex flex-col gap-2" data-testid="lesson-intro">
        <p className="font-bold text-sky-900">청크북 Lesson 학습</p>
        <p className="text-sm text-sky-800">
          Lesson 2부터 8까지, 하루에 한 Lesson씩 핵심 단어를 학습하고 게임해요. 시작하기 전에 단어 뜻을 한 번 확인해 주세요.
        </p>
        <button onClick={() => setReviewing(true)} className="self-start min-h-[48px] px-5 rounded-full bg-sky-600 text-white font-bold">
          Lesson 단어 확인하고 시작
        </button>
      </div>
    );
  }

  // ---------- 진행 중 ----------
  const current = plan.currentLesson;
  const currentSet = lessonSets.find((s) => s.id === lessonSetId(current)) ?? null;
  const doneToday = plan.completedOn !== null;
  const progress = plan.progress && plan.progress.lesson === current ? plan.progress : null;

  return (
    <div className="w-full max-w-4xl flex flex-col gap-3" data-testid="lesson-panel">
      <div className="rounded-2xl bg-sky-50 border-2 border-sky-200 p-4 flex flex-col gap-3">
        {plan.finished ? (
          <>
            <p className="font-bold text-sky-900">🎉 Lesson 8까지 모두 완료했어요! ({plan.cycle}회차)</p>
            <p className="text-sm text-sky-800">
              자동으로 다시 시작하지 않아요. 아래에서 다시 볼 Lesson을 고르거나, 처음(Lesson 2)부터 새로 시작할 수 있어요.
              (단어별 학습 기록은 그대로 남아요)
            </p>
            <button
              onClick={() => {
                if (!confirm("Lesson 2부터 다시 시작할까요? Lesson 완료 기록만 새로 시작하고, 단어별 학습 기록은 그대로 남아요.")) return;
                onPlanChange(restartLessonPlan());
              }}
              className="self-start min-h-[48px] px-5 rounded-full bg-sky-600 text-white font-bold"
            >
              Lesson 2부터 다시 시작
            </button>
          </>
        ) : (
          <>
            <div className="flex items-center justify-between gap-2">
              <p className="font-bold text-sky-900">
                오늘의 Lesson: Lesson {current}
                {currentSet && <span className="text-sm font-normal text-sky-700"> · 단어 {currentSet.words.length}개</span>}
              </p>
              <span className="text-xs text-sky-700">{plan.cycle}회차</span>
            </div>
            <div className="flex gap-2 text-xs font-bold">
              <span className={`rounded-full px-3 py-1 ${progress?.studyDone || doneToday ? "bg-sky-600 text-white" : "bg-white text-gray-500"}`}>
                학습 {progress?.studyDone || doneToday ? "✓" : "전"}
              </span>
              <span className={`rounded-full px-3 py-1 ${progress?.gameDone || doneToday ? "bg-sky-600 text-white" : "bg-white text-gray-500"}`}>
                게임 {progress?.gameDone || doneToday ? "✓" : "전"}
              </span>
            </div>
            {doneToday && (
              <p className="text-sm text-sky-800">
                오늘 Lesson {current}을 마쳤어요! 다음 학습일에 Lesson {Math.min(8, current + 1)}로 넘어가요. 같은 Lesson을 더 해도 괜찮아요.
              </p>
            )}
            {currentSet && (
              <button
                onClick={() => onStart(currentSet)}
                className="self-start min-h-[52px] px-6 rounded-full bg-sky-600 text-white font-bold text-lg"
              >
                {doneToday ? "Lesson 다시 하기" : progress?.studyDone ? "이어서 하기" : "학습 시작"}
              </button>
            )}
          </>
        )}
      </div>

      <div className="grid grid-cols-4 sm:grid-cols-7 gap-2" data-testid="lesson-chips">
        {LESSON_NUMBERS.map((l) => {
          const st = lessonStatus(plan, l);
          const selectable = canSelect(plan, l);
          const set = lessonSets.find((s) => s.id === lessonSetId(l));
          return (
            <button
              key={l}
              disabled={!selectable || !set}
              onClick={() => set && onStart(set)}
              className={`min-h-[56px] rounded-xl border-2 px-2 py-1 text-center transition ${
                st === "current"
                  ? "border-sky-500 bg-sky-50"
                  : st === "completed"
                    ? "border-emerald-300 bg-emerald-50"
                    : "border-gray-200 bg-gray-50 text-gray-400"
              }`}
              aria-label={`Lesson ${l} ${st === "completed" ? "완료, 다시 보기" : st === "current" ? "오늘의 Lesson" : "아직 잠김"}`}
            >
              <span className="block font-title text-base">Lesson {l}</span>
              <span className="block text-[11px]">{st === "completed" ? "완료 ✓" : st === "current" ? "오늘" : "잠김"}</span>
            </button>
          );
        })}
      </div>

      <button onClick={() => setReviewing(true)} className="self-start text-xs text-gray-500 underline">
        Lesson 단어 뜻 확인·수정
      </button>
    </div>
  );
}
