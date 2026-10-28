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
// Lesson 1: 내용이 있고, 문장쓰기 4개는 모두 본문 문장이다
assert.ok(a3Ready(101));
assert.ok(!a3Ready(102));
const body = a3SeedBody(101);
assert.equal(body.filter((b) => b.section === "passage").length, 11);
assert.equal(body.filter((b) => b.section === "dialogue").length, 4);
assert.ok(body.every((b) => b.en.trim() && b.ko.trim()));
const w = a3SeedWriting(101);
assert.equal(w.length, 4);
for (const x of w) assert.ok(body.some((b) => letters(b.en).includes(letters(x.en))), x.en);
console.log("chunkbookA3 ok");
