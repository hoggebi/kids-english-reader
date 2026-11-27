import assert from "node:assert/strict";
import { B1_WORDS, B1_NUMBERS, B1_TEST_WORDS, b1SetId, b1FromSetId, ensureB1Sets } from "../lib/lessonDataB1.ts";

// Lesson 1~8, 핵심 단어 10개씩, 뜻은 모두 채워져 있다
assert.deepEqual(B1_NUMBERS, [1, 2, 3, 4, 5, 6, 7, 8]);
for (const n of B1_NUMBERS) {
  assert.equal(B1_WORDS[n].length, 10, `Lesson ${n}`);
  assert.ok(B1_WORDS[n].every(([e, k]) => e.trim() && k.trim()), `Lesson ${n} empty`);
  assert.equal(new Set(B1_WORDS[n].map(([e]) => e)).size, 10, `Lesson ${n} duplicate`);
}
// 시험 단어 40개는 모두 핵심 단어 안에 있다
assert.equal(B1_TEST_WORDS.length, 40);
assert.equal(new Set(B1_TEST_WORDS).size, 40);
const all = new Set(B1_NUMBERS.flatMap((n) => B1_WORDS[n].map(([e]) => e)));
for (const w of B1_TEST_WORDS) assert.ok(all.has(w), `test word ${w} missing`);
// 세트 id는 A2(lesson-N)·A3(a3-lesson-N)와 겹치지 않는다
assert.equal(b1SetId(3), "b1-lesson-3");
assert.equal(b1FromSetId("b1-lesson-3"), 3);
assert.equal(b1FromSetId("a3-lesson-3"), null);
assert.equal(b1FromSetId("lesson-3"), null);
// 세트 보장: 없으면 만들고, 학습 기록은 유지, 두 번째는 changed=false
const other = { id: "x", title: "x", words: [], createdAt: 1, status: "active" };
const first = ensureB1Sets([other]);
assert.ok(first.changed);
assert.equal(first.sets.length, 9);
const s1 = first.sets.find((s) => s.id === "b1-lesson-1");
s1.words[0] = { ...s1.words[0], box: 3, nextDueAt: 123, wrongCount: 2 };
const again = ensureB1Sets(first.sets);
assert.equal(again.changed, false);
const kept = again.sets.find((s) => s.id === "b1-lesson-1").words[0];
assert.deepEqual([kept.box, kept.nextDueAt, kept.wrongCount], [3, 123, 2]);
console.log("lessonDataB1 ok");
