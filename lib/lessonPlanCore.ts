// Lesson 진행 규칙 (저장소·브라우저에 의존하지 않는 순수 함수). 날짜는 "YYYY-MM-DD"(기기 현지 날짜).
//  - Lesson 2부터 순서대로. 현재 Lesson의 학습과 게임을 1회씩 마치면 완료.
//  - 완료한 날에는 Lesson이 바뀌지 않는다(같은 날 게임을 반복해도 그대로).
//  - 다음 "학습일"(날짜가 바뀐 뒤 처음 열 때)에 다음 Lesson으로 딱 한 단계만 이동한다. 접속하지 않은 날만큼 건너뛰지 않는다.
//  - 미완료면 날짜가 바뀌어도 같은 Lesson을 이어서 한다.
//  - Lesson 8을 마치면 자동으로 초기화하지 않고 finished 상태로 두어 "다시 시작"을 고르게 한다.
//  - 단어별 학습 기록(Leitner 상자·오답수)은 단어장 세트 안에 따로 있고, 여기에는 Lesson 완료 기록만 둔다.

export const FIRST = 2;
export const LAST = 8;

export type LessonCompletion = { firstOn: string; lastOn: string; count: number };

export type LessonPlan = {
  version: 1;
  cycle: number; // 1회차, 2회차…
  startedOn: string;
  currentLesson: number;
  finished: boolean;
  completed: Record<string, LessonCompletion>; // 이번 회차의 Lesson 완료 기록
  progress: { lesson: number; studyDone: boolean; gameDone: boolean } | null; // 현재 Lesson 진행 중 상태
  completedOn: string | null; // 현재 Lesson을 완료한 날
  confirmedAt: number | null; // 부모가 Lesson 단어 뜻을 확인·저장한 시각
};

export function localDateKey(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function newPlan(today: string, confirmedAt: number | null = null): LessonPlan {
  return {
    version: 1,
    cycle: 1,
    startedOn: today,
    currentLesson: FIRST,
    finished: false,
    completed: {},
    progress: null,
    completedOn: null,
    confirmedAt,
  };
}

// 날짜가 바뀌었으면(완료한 다음 학습일) 다음 Lesson으로 한 단계만 이동한다.
export function normalizePlan(plan: LessonPlan, today: string): LessonPlan {
  if (plan.finished || !plan.completedOn || plan.completedOn >= today) return plan;
  const next = Math.min(LAST, plan.currentLesson + 1);
  return { ...plan, currentLesson: next, completedOn: null, progress: null };
}

function tryComplete(plan: LessonPlan, today: string): LessonPlan {
  const pr = plan.progress;
  if (!pr || !pr.studyDone || !pr.gameDone) return plan;
  const lesson = pr.lesson;
  const prev = plan.completed[String(lesson)];
  const completed = {
    ...plan.completed,
    [String(lesson)]: { firstOn: prev?.firstOn ?? today, lastOn: today, count: (prev?.count ?? 0) + 1 },
  };
  return { ...plan, completed, progress: null, completedOn: today, finished: lesson >= LAST ? true : plan.finished };
}

// 현재 Lesson이 아닌 Lesson(복습)이나, 이미 오늘 완료한 뒤의 반복은 진행/완료 기록에 영향을 주지 않는다.
function isTracked(plan: LessonPlan, lesson: number): boolean {
  return !plan.finished && lesson === plan.currentLesson && plan.completedOn === null;
}

export function applyStudyDone(plan: LessonPlan, lesson: number, today: string): LessonPlan {
  const p = normalizePlan(plan, today);
  if (!isTracked(p, lesson)) return p;
  const progress = { lesson, studyDone: true, gameDone: p.progress?.gameDone ?? false };
  return tryComplete({ ...p, progress }, today);
}

export function applyGameDone(plan: LessonPlan, lesson: number, today: string): LessonPlan {
  const p = normalizePlan(plan, today);
  if (!isTracked(p, lesson)) return p;
  const progress = { lesson, studyDone: p.progress?.studyDone ?? false, gameDone: true };
  return tryComplete({ ...p, progress }, today);
}

export type LessonStatus = "completed" | "current" | "open";

export function lessonStatus(plan: LessonPlan, lesson: number): LessonStatus {
  if (plan.completed[String(lesson)]) return "completed";
  if (!plan.finished && lesson === plan.currentLesson) return "current";
  return "open";
}

// 어떤 Lesson이든 자유롭게 고를 수 있다(잠그지 않는다). 다만 "오늘의 Lesson" 진행·완료 기록은
// 현재 Lesson에만 반영되고, 다른 Lesson을 고른 학습은 연습으로만 남는다.
export function canSelect(_plan: LessonPlan, lesson: number): boolean {
  return lesson >= FIRST && lesson <= LAST;
}

// Lesson 8 완료 뒤 사용자가 고르는 "다시 시작": 새 회차. Lesson 완료 기록만 초기화하고 단어별 기록은 건드리지 않는다.
export function restartPlan(plan: LessonPlan, today: string): LessonPlan {
  return {
    ...newPlan(today, plan.confirmedAt),
    cycle: plan.cycle + 1,
  };
}
