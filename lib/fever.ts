// 공통 FEVER 1단계 상태 규칙 (다트/두더지/몬스터 공용). 프레임워크 독립 순수 함수.
// 시각 보상만 강화한다: 문제/판정/점수/데미지/풀이 시간은 건드리지 않는다.

export type FeverState = { combo: number; gauge: number; remaining: number; completed: string[] };
export type FeverEvent = "none" | "start" | "end" | "duplicate";
export type FeverResult = { state: FeverState; event: FeverEvent; enhanced: boolean };

export const FEVER_GAUGE_MAX = 5;
export const FEVER_REWARD_QUESTIONS = 3;

// 연출 시간(ms). 풀이 타이머와 무관하다.
export const FEVER_MS = {
  pause: 400,
  correct: 650,
  combo: 550,
  result: 900,
  ready: 700,
  start: 900,
  end: 650,
} as const;

export const FEVER_ASSET = "/assets/fever";

export const initialFever = (): FeverState => ({ combo: 0, gauge: 0, remaining: 0, completed: [] });

// 같은 문제를 다시 시도하는 중간 오답: 콤보/게이지만 끊고 남은 문제는 줄이지 않는다.
export function retryWrong(state: FeverState): FeverState {
  return { ...state, combo: 0, gauge: 0 };
}

// 문제의 최종 완료(정답 또는 최종 오답)를 한 번만 반영한다. questionId가 중복이면 무시.
export function complete(state: FeverState, o: { questionId: string; correct: boolean; hasNext?: boolean }): FeverResult {
  const { questionId, correct, hasNext = true } = o;
  if (state.completed.includes(questionId)) return { state, event: "duplicate", enhanced: false };
  const enhanced = state.remaining > 0;
  const next: FeverState = { ...state, completed: [...state.completed, questionId], combo: correct ? state.combo + 1 : 0 };
  let event: FeverEvent = "none";
  if (enhanced) {
    next.remaining = state.remaining - 1;
    next.gauge = 0;
    if (next.remaining === 0) event = "end";
  } else {
    next.gauge = correct ? state.gauge + 1 : 0;
    if (next.gauge >= FEVER_GAUGE_MAX) {
      next.gauge = 0;
      if (hasNext) {
        next.remaining = FEVER_REWARD_QUESTIONS;
        event = "start";
      }
    }
  }
  return { state: next, event, enhanced };
}
