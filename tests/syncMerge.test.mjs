// 실행: node --experimental-strip-types tests/syncMerge.test.mjs
import assert from "node:assert/strict";
import { mergePlans, newPlan } from "../lib/lessonPlanCore.ts";
import { mergeVocabSets } from "../lib/vocabMerge.ts";
let n = 0;
const t = (name, fn) => { fn(); n += 1; console.log("ok -", name); };
const base = newPlan("2026-10-15", 1);
t("로컬에서 학습 완료한 진행이 오래된 서버 값으로 덮이지 않는다", () => {
  const local = { ...base, progress: { lesson: 2, studyDone: true, gameDone: false } };
  const m = mergePlans(local, base);
  assert.equal(m.progress.studyDone, true);
});
t("서버가 더 진행됐으면 서버를 따른다", () => {
  const server = { ...base, currentLesson: 3 };
  assert.equal(mergePlans(base, server).currentLesson, 3);
});
t("같은 Lesson에서 학습은 한 기기, 게임은 다른 기기면 합쳐서 완료", () => {
  const a = { ...base, progress: { lesson: 2, studyDone: true, gameDone: false } };
  const b = { ...base, progress: { lesson: 2, studyDone: false, gameDone: true } };
  const m = mergePlans(a, b);
  // 학습은 한 기기, 게임은 다른 기기에서 마쳤으면 합쳐서 Lesson 완료로 이어진다.
  assert.ok(m.completedOn);
  assert.equal(m.completed["2"].count, 1);
});
t("오늘 완료 기록이 있는 쪽이 이긴다", () => {
  const done = { ...base, completedOn: "2026-10-15", completed: { "2": { firstOn: "2026-10-15", lastOn: "2026-10-15", count: 1 } } };
  assert.equal(mergePlans(base, done).completedOn, "2026-10-15");
  assert.equal(mergePlans(done, base).completedOn, "2026-10-15");
});
const w = (id, box, due, wrong = 0) => ({ id, english: id, korean: id, box, nextDueAt: due, wrongCount: wrong });
t("단어별 학습 기록은 더 최근에 학습한 쪽을 쓴다", () => {
  const local = [{ id: "s", title: "s", words: [w("a", 3, 200), w("b", 1, 50)], createdAt: 0, status: "active" }];
  const server = [{ id: "s", title: "s", words: [w("a", 1, 100), w("b", 2, 80), w("c", 0, 0)], createdAt: 0, status: "active" }];
  const m = mergeVocabSets(local, server)[0].words;
  assert.equal(m.find((x) => x.id === "a").box, 3);
  assert.equal(m.find((x) => x.id === "b").box, 2);
  assert.equal(m.length, 3);
});
console.log(`${n} tests passed`);
