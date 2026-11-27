import assert from "node:assert/strict";
import { BUILTIN_BOOK_B1, b1Roles, b1SeedBody, b1SeedWriting, b1Ready, isB1Lesson } from "../lib/chunkbookB1.ts";
import { a3SeedBody, a3SeedWriting, a3Roles, isA3Lesson, lessonNo } from "../lib/chunkbookA3.ts";
import { builtinRoles, builtinSeedBody, builtinSeedWriting } from "../lib/chunkbookBuiltin.ts";

const letters = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

assert.equal(BUILTIN_BOOK_B1.pageCount, 24);
assert.deepEqual(BUILTIN_BOOK_B1.lessons.map((l) => l.lesson), [201, 202, 203, 204, 205, 206, 207, 208]);
assert.deepEqual(BUILTIN_BOOK_B1.lessons.flatMap((l) => l.pages), Array.from({ length: 24 }, (_, i) => i + 1));
// B1은 A3 방식(같은 화면·활동)으로 다뤄지고, 화면 번호는 1~8
assert.ok(BUILTIN_BOOK_B1.lessons.every((l) => isB1Lesson(l.lesson) && isA3Lesson(l.lesson)));
assert.deepEqual(BUILTIN_BOOK_B1.lessons.map((l) => lessonNo(l.lesson)), [1, 2, 3, 4, 5, 6, 7, 8]);
assert.equal(lessonNo(105), 5); // A3 그대로
assert.equal(isB1Lesson(108), false);
for (const l of BUILTIN_BOOK_B1.lessons) assert.deepEqual(b1Roles(l.lesson), { body: [l.pages[0]], writing: l.pages[2] });
// A3 도우미·내장 교재 도우미도 B1 데이터를 돌려준다(A3 데이터와 섞이지 않는다)
assert.deepEqual(a3Roles(203), b1Roles(203));
assert.deepEqual(builtinRoles(201), b1Roles(201));
assert.deepEqual(a3SeedBody(201), b1SeedBody(201));
assert.deepEqual(builtinSeedBody(202), b1SeedBody(202));
assert.deepEqual(builtinSeedWriting(201), b1SeedWriting(201));
assert.notDeepEqual(a3SeedBody(101), b1SeedBody(201));
assert.deepEqual(a3SeedWriting(202), b1SeedWriting(202));
// 채운 Lesson: 본문·대화 줄 수, 문장쓰기 4개는 모두 본문 문장
const COUNTS = { 1: [13, 4], 2: [12, 4], 3: [14, 4], 4: [10, 4], 5: [10, 4], 6: [11, 4], 7: [12, 4], 8: [11, 4] };
for (const [n, [passage, dialogue]] of Object.entries(COUNTS)) {
  const id = 200 + Number(n);
  assert.ok(b1Ready(id), `Lesson ${n} ready`);
  const body = b1SeedBody(id);
  assert.equal(body.filter((b) => b.section === "passage").length, passage, `Lesson ${n} passage`);
  assert.equal(body.filter((b) => b.section === "dialogue").length, dialogue, `Lesson ${n} dialogue`);
  assert.ok(body.every((b) => b.en.trim() && b.ko.trim()), `Lesson ${n} empty text`);
  const w = b1SeedWriting(id);
  assert.equal(w.length, 4, `Lesson ${n} writing`);
  for (const x of w) {
    assert.ok(x.ko.trim());
    assert.ok(body.some((b) => letters(b.en).includes(letters(x.en))), x.en);
  }
}
// 8개 Lesson이 모두 채워졌다
assert.ok(BUILTIN_BOOK_B1.lessons.every((l) => b1Ready(l.lesson)));
console.log("chunkbookB1 ok");
