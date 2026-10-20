// 실행: node --experimental-strip-types tests/lessonGames.test.mjs
// Lesson "게임 완료" = 다트·두더지·몬스터 3종. 여러 날·여러 기기에 나눠 해도 완료되고, 동기화 병합에서도 합쳐진다.
import assert from "node:assert/strict";
import { applyGamePlayed, applyStudyDone, mergePlans, newPlan } from "../lib/lessonPlanCore.ts";
let n = 0;
const t = (name, fn) => { fn(); n += 1; console.log("ok -", name); };
const day1 = "2026-10-19", day2 = "2026-10-20";
const studied = (d) => applyStudyDone(newPlan(d, 1), 2, d);

t("같은 날 3종을 마치면 Lesson 완료", () => {
  let p = studied(day1);
  for (const k of ["hunt", "mole", "battle"]) p = applyGamePlayed(p, 2, k, day1);
  assert.equal(p.completedOn, day1);
  assert.equal(p.completed["2"].count, 1);
});
t("2종까지는 진행 중(게임 완료 아님)", () => {
  let p = studied(day1);
  p = applyGamePlayed(p, 2, "hunt", day1);
  p = applyGamePlayed(p, 2, "mole", day1);
  assert.equal(p.progress.gameDone, false);
  assert.deepEqual(p.progress.games.sort(), ["hunt", "mole"]);
});
t("여러 날에 나눠 해도 3종이 모이면 완료(같은 Lesson 유지)", () => {
  let p = studied(day1);
  p = applyGamePlayed(p, 2, "hunt", day1);
  p = applyGamePlayed(p, 2, "mole", day1);
  p = applyGamePlayed(p, 2, "battle", day2); // 다음 날(미완료라 같은 Lesson을 이어서)
  assert.equal(p.currentLesson, 2);
  assert.equal(p.completedOn, day2);
});
t("같은 게임을 여러 번 해도 한 종류로 센다", () => {
  let p = studied(day1);
  for (let i = 0; i < 4; i++) p = applyGamePlayed(p, 2, "mole", day1);
  assert.deepEqual(p.progress.games, ["mole"]);
});
t("기기가 달라도 동기화 병합에서 마친 게임이 합쳐져 완료된다", () => {
  let a = studied(day1);
  a = applyGamePlayed(a, 2, "hunt", day1);
  a = applyGamePlayed(a, 2, "mole", day1);
  let b = studied(day1);
  b = applyGamePlayed(b, 2, "battle", day1);
  const m = mergePlans(a, b);
  assert.ok(m.completedOn, "학습 완료 + 3종 → Lesson 완료");
  assert.equal(m.completed["2"].count, 1);
});
console.log(`${n} tests passed`);
