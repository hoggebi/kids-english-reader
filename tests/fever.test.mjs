// 실행: node --experimental-strip-types tests/fever.test.mjs
// 공통 FEVER 1단계 상태 규칙 검증 (다트/두더지/몬스터 공용 lib/fever.ts)
import assert from "node:assert/strict";
import { initialFever, complete, retryWrong } from "../lib/fever.ts";

let n = 0;
const t = (name, fn) => {
  fn();
  n += 1;
  console.log("ok -", name);
};
// 정답/오답을 연속 완료시키는 도우미
function run(state, seq, startId = 0) {
  const events = [];
  let s = state;
  seq.forEach((c, i) => {
    const r = complete(s, { questionId: `q${startId + i}`, correct: c });
    s = r.state;
    events.push({ event: r.event, enhanced: r.enhanced, remaining: s.remaining, gauge: s.gauge, combo: s.combo });
  });
  return { s, events };
}

t("4연속 정답에서는 발동하지 않는다", () => {
  const { s, events } = run(initialFever(), [true, true, true, true]);
  assert.equal(s.remaining, 0);
  assert.equal(s.gauge, 4);
  assert.ok(events.every((e) => e.event === "none"));
});

t("5번째 정답은 일반 보상이고 그 뒤 FEVER 3 시작", () => {
  const { s, events } = run(initialFever(), [true, true, true, true, true]);
  assert.equal(events[4].event, "start");
  assert.equal(events[4].enhanced, false);
  assert.equal(s.remaining, 3);
  assert.equal(s.gauge, 0);
  assert.equal(s.combo, 5);
});

t("다음 3문제가 강화 보상이고 3→2→1→종료, 마지막 문제도 강화", () => {
  const first = run(initialFever(), [true, true, true, true, true]).s;
  const { s, events } = run(first, [true, true, true], 5);
  assert.deepEqual(events.map((e) => e.enhanced), [true, true, true]);
  assert.deepEqual(events.map((e) => e.remaining), [2, 1, 0]);
  assert.equal(events[2].event, "end");
  assert.equal(s.combo, 8); // 종료 후에도 콤보 표시는 유지
  assert.equal(s.gauge, 0);
});

t("FEVER 중에는 게이지를 쌓지 않고 재발동하지 않는다", () => {
  const first = run(initialFever(), [true, true, true, true, true]).s;
  const { events } = run(first, [true, true], 5);
  assert.ok(events.every((e) => e.gauge === 0 && e.event !== "start"));
});

t("종료 후 새 5연속 정답으로 다시 발동한다", () => {
  const a = run(initialFever(), [true, true, true, true, true, true, true, true]).s;
  assert.equal(a.remaining, 0);
  const { events } = run(a, [true, true, true, true, true], 8);
  assert.equal(events[4].event, "start");
});

t("재시도(중간) 오답은 남은 문제를 소비하지 않고 콤보/게이지만 끊는다", () => {
  const first = run(initialFever(), [true, true, true, true, true]).s;
  const r = retryWrong(first);
  assert.equal(r.remaining, 3);
  assert.equal(r.combo, 0);
  const normal = retryWrong(run(initialFever(), [true, true]).s);
  assert.equal(normal.gauge, 0);
  assert.equal(normal.combo, 0);
});

t("최종 오답은 FEVER 1문제를 소비하고 콤보를 끊는다", () => {
  const first = run(initialFever(), [true, true, true, true, true]).s;
  const { s, events } = run(first, [false], 5);
  assert.equal(s.remaining, 2);
  assert.equal(s.combo, 0);
  assert.equal(events[0].enhanced, true);
});

t("일반 상태 오답은 콤보와 게이지를 0으로", () => {
  const { s } = run(initialFever(), [true, true, true, false]);
  assert.equal(s.gauge, 0);
  assert.equal(s.combo, 0);
});

t("같은 questionId 중복 완료는 한 번만 반영", () => {
  let s = initialFever();
  const r1 = complete(s, { questionId: "x", correct: true });
  const r2 = complete(r1.state, { questionId: "x", correct: true });
  assert.equal(r2.event, "duplicate");
  assert.equal(r2.state.gauge, 1);
  assert.equal(r2.state.combo, 1);
});

t("마지막 문제에서 준비돼도 다음 문제가 없으면 시작하지 않는다", () => {
  const s = run(initialFever(), [true, true, true, true]).s;
  const r = complete(s, { questionId: "last", correct: true, hasNext: false });
  assert.equal(r.event, "none");
  assert.equal(r.state.remaining, 0);
});

console.log(`${n} tests passed`);
