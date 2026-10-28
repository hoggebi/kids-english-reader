import assert from "node:assert/strict";
import { BUILTIN_BOOK_A3, a3Roles, a3SeedBody, a3SeedWriting, a3Ready, lessonNo, isA3Lesson } from "../lib/chunkbookA3.ts";
import { builtinRoles, builtinSeedBody } from "../lib/chunkbookBuiltin.ts";

const letters = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

assert.equal(BUILTIN_BOOK_A3.pageCount, 24);
assert.deepEqual(BUILTIN_BOOK_A3.lessons.map((l) => lessonNo(l.lesson)), [1, 2, 3, 4, 5, 6, 7, 8]);
assert.ok(BUILTIN_BOOK_A3.lessons.every((l) => isA3Lesson(l.lesson) && l.pages.length === 3));
const all = BUILTIN_BOOK_A3.lessons.flatMap((l) => l.pages);
assert.deepEqual(all, Array.from({ length: 24 }, (_, i) => i + 1));
// A2(2~8)와 번호가 겹치지 않는다
assert.ok(BUILTIN_BOOK_A3.lessons.every((l) => l.lesson > 100));
// 본문 쪽 = Lesson 첫 쪽, 문장쓰기 쪽 = 셋째 쪽
for (const l of BUILTIN_BOOK_A3.lessons) assert.deepEqual(a3Roles(l.lesson), { body: [l.pages[0]], writing: l.pages[2] });
assert.deepEqual(builtinRoles(101), a3Roles(101));
// A2 데이터는 그대로
assert.ok(builtinSeedBody(2).length > 0);
// 내용이 채워진 Lesson: 본문·대화 줄 수, 문장쓰기 4개는 모두 본문 문장이다
const COUNTS = { 1: [11, 4], 2: [10, 4], 3: [12, 4], 4: [10, 4], 5: [11, 4], 6: [13, 4], 7: [13, 4], 8: [13, 4] };
// 교재의 문장쓰기 정답이 본문 문장 그대로가 아니라 본문 표현으로 만든 문장인 경우(빈칸 "hide in trees")
const COMPOSED = new Set(["The spots help leopards hide in trees."]);
for (const [n, [passage, dialogue]] of Object.entries(COUNTS)) {
  const id = 100 + Number(n);
  assert.ok(a3Ready(id), `Lesson ${n} ready`);
  const body = a3SeedBody(id);
  assert.equal(body.filter((b) => b.section === "passage").length, passage, `Lesson ${n} passage`);
  assert.equal(body.filter((b) => b.section === "dialogue").length, dialogue, `Lesson ${n} dialogue`);
  assert.ok(body.every((b) => b.en.trim() && b.ko.trim()), `Lesson ${n} empty text`);
  const w = a3SeedWriting(id);
  assert.equal(w.length, 4, `Lesson ${n} writing`);
  for (const x of w) {
    assert.ok(x.ko.trim());
    if (!COMPOSED.has(x.en)) assert.ok(body.some((b) => letters(b.en).includes(letters(x.en))), x.en);
  }
}
console.log("chunkbookA3 ok");
