// 실행: node --experimental-strip-types tests/lessonPlan.test.mjs
import assert from "node:assert/strict";
import { LESSON_DEFS, LESSON_NUMBERS, lessonSetsFromDefs, draftKey, lessonFromSetId, lessonWordId } from "../lib/lessonData.ts";
import { newPlan, normalizePlan, applyStudyDone, applyGameDone, canSelect, lessonStatus, restartPlan } from "../lib/lessonPlanCore.ts";

let n = 0;
const t = (name, fn) => {
  fn();
  n += 1;
  console.log("ok -", name);
};
const SEED_EXTRAS = ["baseball", "family tree", "first", "often", "great", "show"];

// 비교 기준(앞선 대조 결과): Lesson별 "Write the word twice" 핵심 단어 10개
const KEY_WORDS = {
  2: "ask|call|class|old|person|play|same|see|surprise|twice",
  3: "clean|please|point|rule|run|sigh|son|switch|tired|watch",
  4: "activity|burn|cooperation|healthy|lesson|manners|muscle|sports|teach|weekend",
  5: "angry|feel|game|house|keep|look at|only|player|stand up|turn",
  6: "exciting|excuse|feeling|forget|forgive|hang out|hurt|right|understand|yesterday",
  7: "act|confused|find out|look for|nice|notice|run away|strangely|weird|whisper",
  8: "care|check|get better|important|list|listener|nod|practice|question|talk",
};
// 기존 Seed 1_2610 40단어 중 위 70개와 겹치는 단어(34개)
const SEED_OVERLAP = "act|activity|angry|ask|burn|call|care|clean|confused|exciting|excuse|feel|feeling|get better|healthy|important|lesson|look at|look for|muscle|only|person|please|practice|question|rule|stand up|surprise|switch|tired|understand|weird|whisper|yesterday".split("|");

t("핵심 단어 70개 = 기존 뜻 34 + 교재 뜻 36, 누락·중복 없음", () => {
  for (const l of LESSON_NUMBERS) {
    const key = LESSON_DEFS[l].filter((w) => w.origin !== "seed-extra").map((w) => w.english);
    assert.deepEqual([...key].sort(), KEY_WORDS[l].split("|").sort(), `Lesson ${l}`);
    assert.equal(new Set(key).size, 10);
  }
  const all = LESSON_NUMBERS.flatMap((l) => LESSON_DEFS[l].filter((w) => w.origin !== "seed-extra"));
  assert.equal(all.length, 70);
  assert.equal(all.filter((w) => w.origin === "seed").length, 34);
  assert.equal(all.filter((w) => w.origin === "book").length, 36);
  assert.deepEqual(all.filter((w) => w.origin === "seed").map((w) => w.english).sort(), [...SEED_OVERLAP].sort());
});

t("묶음 크기 11/11/11/11/11/11/10, 추가 단어 6개 배치", () => {
  assert.deepEqual(LESSON_NUMBERS.map((l) => LESSON_DEFS[l].length), [11, 11, 11, 11, 11, 11, 10]);
  const extras = LESSON_NUMBERS.flatMap((l) => LESSON_DEFS[l].filter((w) => w.origin === "seed-extra").map((w) => [l, w.english]));
  assert.deepEqual(extras, [[2, "baseball"], [3, "family tree"], [4, "first"], [5, "often"], [6, "great"], [7, "show"]]);
  const sets = lessonSetsFromDefs([], {});
  assert.deepEqual(sets.map((s) => s.words.length), [11, 11, 11, 11, 11, 11, 10]);
});

t("모든 Lesson 단어는 서로 달라서 Lesson 사이 단어 기록 충돌이 없다 (id는 Lesson별)", () => {
  const all = LESSON_NUMBERS.flatMap((l) => LESSON_DEFS[l].map((w) => w.english));
  assert.equal(all.length, 76);
  assert.equal(new Set(all).size, 76);
  assert.notEqual(lessonWordId(2, "ask"), lessonWordId(3, "ask"));
});

t("Lesson 2~8, 핵심 단어 10개씩 + Seed 전용 단어 하루 1개", () => {
  assert.deepEqual(LESSON_NUMBERS, [2, 3, 4, 5, 6, 7, 8]);
  for (const l of LESSON_NUMBERS) {
    const key = LESSON_DEFS[l].filter((w) => w.origin !== "seed-extra");
    assert.equal(key.length, 10, `Lesson ${l} 핵심 단어`);
  }
  const extras = LESSON_NUMBERS.flatMap((l) => LESSON_DEFS[l].filter((w) => w.origin === "seed-extra").map((w) => [l, w.english]));
  assert.deepEqual(extras.map((e) => e[1]), SEED_EXTRAS);
  // 하루에 추가 단어는 최대 1개
  for (const l of LESSON_NUMBERS) assert.ok(LESSON_DEFS[l].filter((w) => w.origin === "seed-extra").length <= 1);
  // 모든 단어 영어 중복 없음(Lesson 안), 뜻이 비어있지 않음
  for (const l of LESSON_NUMBERS) {
    const set = new Set(LESSON_DEFS[l].map((w) => w.english));
    assert.equal(set.size, LESSON_DEFS[l].length);
    LESSON_DEFS[l].forEach((w) => assert.ok(w.korean.trim().length > 0));
  }
});

t("Seed와 겹치는 단어는 기존 뜻, 새 단어만 book", () => {
  const seedMeaning = { ask: "물어보다", surprise: "놀라운 일", tired: "지친, 싫증 난", "look at": "~을 보다", yesterday: "어제", "get better": "나아지다" };
  const all = LESSON_NUMBERS.flatMap((l) => LESSON_DEFS[l]);
  for (const [en, ko] of Object.entries(seedMeaning)) {
    const w = all.find((x) => x.english === en);
    assert.equal(w.origin, "seed", en);
    assert.equal(w.korean, ko, en);
  }
  const book = all.filter((w) => w.origin === "book").map((w) => w.english);
  assert.equal(book.length, 36); // Lesson 2: 6개 + Lesson 3~8: 5개씩
  assert.ok(book.includes("point"));
  assert.ok(all.find((w) => w.english === "point").note);
});

t("Lesson 세트: 전체 단어(추가 단어 포함)와 기존 단어 기록 보존", () => {
  const sets = lessonSetsFromDefs([], {});
  assert.equal(sets.length, 7);
  assert.equal(sets[0].id, "lesson-2");
  assert.equal(sets[0].words.length, 11);
  assert.ok(sets[0].words.some((w) => w.english === "baseball"));
  assert.equal(sets[4].words.length, 11); // Lesson 6 (great 포함)
  assert.equal(sets[6].words.length, 10); // Lesson 8: 추가 없음
  // 부모가 새 단어 뜻을 수정 → 반영, 기존(seed) 뜻은 고정
  const edited = lessonSetsFromDefs(sets, { [draftKey(2, "class")]: "학급", [draftKey(2, "ask")]: "바꾸면 안 됨" });
  const l2 = edited[0].words;
  assert.equal(l2.find((w) => w.english === "class").korean, "학급");
  assert.equal(l2.find((w) => w.english === "ask").korean, "물어보다");
  // 단어별 기록 보존
  sets[0].words[0].box = 3;
  sets[0].words[0].wrongCount = 2;
  const again = lessonSetsFromDefs(sets, {});
  assert.equal(again[0].words[0].box, 3);
  assert.equal(again[0].words[0].wrongCount, 2);
  assert.equal(lessonFromSetId("lesson-5"), 5);
  assert.equal(lessonFromSetId("abc"), null);
});

t("이미 저장된 Lesson 세트(추가 단어 이전 구성)는 단어별 기록을 유지한 채 새 구성으로 채워진다", () => {
  const old = lessonSetsFromDefs([], {});
  const l6 = old.find((s) => s.id === "lesson-6");
  l6.words = l6.words.filter((w) => w.english !== "great"); // 예전 10개 구성
  l6.words[0].box = 4;
  l6.words[0].wrongCount = 3;
  const refreshed = lessonSetsFromDefs(old, {});
  const nl6 = refreshed.find((s) => s.id === "lesson-6");
  assert.equal(nl6.words.length, 11);
  assert.ok(nl6.words.some((w) => w.english === "great" && w.box === 0));
  assert.equal(nl6.words[0].box, 4);
  assert.equal(nl6.words[0].wrongCount, 3);
});

t("학습만 마치면 완료 아님, 게임까지 마쳐야 완료", () => {
  let p = newPlan("2026-10-14");
  p = applyStudyDone(p, 2, "2026-10-14");
  assert.equal(p.completedOn, null);
  assert.deepEqual(p.progress, { lesson: 2, studyDone: true, gameDone: false });
  p = applyGameDone(p, 2, "2026-10-14");
  assert.equal(p.completedOn, "2026-10-14");
  assert.equal(p.completed["2"].count, 1);
  assert.equal(p.currentLesson, 2);
});

t("같은 날 게임을 반복해도 Lesson은 바뀌지 않는다", () => {
  let p = newPlan("2026-10-14");
  p = applyGameDone(applyStudyDone(p, 2, "2026-10-14"), 2, "2026-10-14");
  for (let i = 0; i < 3; i++) {
    p = applyGameDone(p, 2, "2026-10-14");
    p = normalizePlan(p, "2026-10-14");
  }
  assert.equal(p.currentLesson, 2);
  assert.equal(p.completed["2"].count, 1);
});

t("다음 학습일에 다음 Lesson으로 한 단계만 이동 (건너뛴 날만큼 건너뛰지 않음)", () => {
  let p = newPlan("2026-10-14");
  p = applyGameDone(applyStudyDone(p, 2, "2026-10-14"), 2, "2026-10-14");
  const nextDay = normalizePlan(p, "2026-10-15");
  assert.equal(nextDay.currentLesson, 3);
  const after5 = normalizePlan(p, "2026-10-19");
  assert.equal(after5.currentLesson, 3);
});

t("미완료면 날짜가 바뀌어도 같은 Lesson을 이어서 한다", () => {
  let p = newPlan("2026-10-14");
  p = applyStudyDone(p, 2, "2026-10-14"); // 학습만 하고 이탈
  const later = normalizePlan(p, "2026-10-20");
  assert.equal(later.currentLesson, 2);
  assert.equal(later.progress.studyDone, true);
});

t("복습(현재가 아닌 Lesson)은 진행·완료 기록을 바꾸지 않는다", () => {
  let p = newPlan("2026-10-14");
  p = normalizePlan(applyGameDone(applyStudyDone(p, 2, "2026-10-14"), 2, "2026-10-14"), "2026-10-15"); // 현재 3
  assert.equal(p.currentLesson, 3);
  assert.equal(canSelect(p, 2), true);
  assert.equal(canSelect(p, 3), true);
  assert.equal(canSelect(p, 5), false);
  const before = JSON.stringify(p);
  const q = applyGameDone(applyStudyDone(p, 2, "2026-10-15"), 2, "2026-10-15");
  assert.equal(JSON.stringify(q), before);
});

t("Lesson 8 완료 후 자동 초기화하지 않고, 다시 시작은 선택", () => {
  let p = newPlan("2026-10-01");
  let day = 1;
  for (let l = 2; l <= 8; l++) {
    const d = `2026-10-${String(day++).padStart(2, "0")}`;
    p = normalizePlan(p, d);
    assert.equal(p.currentLesson, l);
    p = applyGameDone(applyStudyDone(p, l, d), l, d);
  }
  assert.equal(p.finished, true);
  const later = normalizePlan(p, "2026-12-31");
  assert.equal(later.finished, true);
  assert.equal(later.currentLesson, 8);
  assert.equal(lessonStatus(later, 8), "completed");
  assert.equal(Object.keys(later.completed).length, 7);
  const r = restartPlan(later, "2027-01-01");
  assert.equal(r.finished, false);
  assert.equal(r.currentLesson, 2);
  assert.equal(r.cycle, 2);
  assert.deepEqual(r.completed, {});
});

console.log(`\n${n} tests passed`);
