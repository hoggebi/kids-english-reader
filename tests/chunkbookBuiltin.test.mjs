// 실행: node --experimental-strip-types tests/chunkbookBuiltin.test.mjs
import assert from "node:assert/strict";
import fs from "node:fs";
import { BUILTIN_BOOK, BUILTIN_LESSONS, builtinPageUrl, builtinRoles, builtinSeedBody, builtinSeedWriting } from "../lib/chunkbookBuiltin.ts";

let n = 0;
const t = async (name, fn) => {
  await fn();
  n += 1;
  console.log("ok -", name);
};
const letters = (s) => s.replace(/[^A-Za-z0-9가-힣]/g, "").toLowerCase();

await t("Lesson 2~8 이 순서대로, 레슨당 2쪽(본문+문장쓰기), 전체 14쪽", () => {
  assert.deepEqual(BUILTIN_BOOK.lessons.map((l) => l.lesson), [2, 3, 4, 5, 6, 7, 8]);
  assert.equal(BUILTIN_BOOK.pageCount, 14);
  const all = BUILTIN_BOOK.lessons.flatMap((l) => l.pages);
  assert.deepEqual(all, Array.from({ length: 14 }, (_, i) => i + 1));
  assert.deepEqual(BUILTIN_BOOK.lessons.map((l) => l.labels[0]), BUILTIN_LESSONS.map((l) => `Lesson${l}-1`));
  for (const l of BUILTIN_LESSONS) {
    const r = builtinRoles(l);
    assert.equal(r.body.length, 1);
    assert.equal(r.writing, r.body[0] + 1);
  }
});

await t("페이지 이미지 14장이 모두 정적 파일로 존재한다", () => {
  for (let p = 1; p <= 14; p++) {
    const file = new URL(`../public${builtinPageUrl(p)}`, import.meta.url);
    assert.ok(fs.statSync(file).size > 20_000, `p${p}`);
  }
});

await t("문장쓰기는 레슨마다 정확히 4문장, 영어·한국어 비어 있지 않고 중복 없음", () => {
  for (const l of BUILTIN_LESSONS) {
    const w = builtinSeedWriting(l);
    assert.equal(w.length, 4, `Lesson ${l}`);
    assert.ok(w.every((x) => x.en.trim() && x.ko.trim()));
    assert.equal(new Set(w.map((x) => letters(x.en))).size, 4);
    assert.equal(new Set(w.map((x) => x.ko)).size, 4);
  }
});

await t("문장쓰기 영어 정답은 같은 Lesson 본문에 있는 문장이다 (교재와 대조)", () => {
  for (const l of BUILTIN_LESSONS) {
    const body = builtinSeedBody(l).map((b) => letters(b.en));
    for (const w of builtinSeedWriting(l)) {
      const e = letters(w.en);
      assert.ok(body.some((b) => b.includes(e)), `Lesson ${l}: ${w.en}`);
    }
  }
});

await t("본문은 영어·한국어 뜻이 모두 있고, 대화 연습 구분이 있다", () => {
  for (const l of BUILTIN_LESSONS) {
    const b = builtinSeedBody(l);
    assert.ok(b.length >= 8, `Lesson ${l}`);
    assert.ok(b.every((x) => x.en.trim() && x.ko.trim()));
    assert.ok(b.some((x) => x.section === "passage") && b.some((x) => x.section === "dialogue"));
  }
});

// 기존 학습지(public/worksheets/ho_sentence_writing_lesson2_to_8.pdf)의 한국어 문항과 순서까지 같은지 대조
await t("기존 학습지의 한국어 문항 28개와 일치한다", async () => {
  const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const data = new Uint8Array(fs.readFileSync(new URL("../public/worksheets/ho_sentence_writing_lesson2_to_8.pdf", import.meta.url)));
  const d = await getDocument({ data, verbosity: 0 }).promise;
  assert.equal(d.numPages, 14);
  const found = [];
  for (let i = 1; i <= d.numPages; i++) {
    const tc = await (await d.getPage(i)).getTextContent();
    const line = tc.items.map((x) => x.str).join(" ");
    for (const m of line.matchAll(/(?:^|\s)0([1-4])\s+(.+?)\s+1\s+2\s+3/g)) found.push(letters(m[2]));
  }
  const expected = BUILTIN_LESSONS.flatMap((l) => builtinSeedWriting(l).map((w) => letters(w.ko)));
  assert.equal(found.length, 28);
  assert.deepEqual(found, expected);
});

console.log(`\n${n} tests passed`);
