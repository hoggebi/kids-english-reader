// 실행: node --experimental-strip-types tests/chunkLesson.test.mjs
import assert from "node:assert/strict";
import { VERIFIED_ROLES_42, defaultRoles, isValidOrder, shuffleOrder, worksheetStartPage, worksheetUrl } from "../lib/chunkLesson.ts";

let n = 0;
const t = (name, fn) => {
  fn();
  n += 1;
  console.log("ok -", name);
};
const ranges = { 2: [1, 6], 3: [7, 11], 4: [12, 17], 5: [18, 24], 6: [25, 30], 7: [31, 36], 8: [37, 42] };
const pagesOf = (l) => Array.from({ length: ranges[l][1] - ranges[l][0] + 1 }, (_, i) => ranges[l][0] + i);

t("확인한 기본 페이지 역할(42쪽 PDF): 본문/문장쓰기가 각 Lesson 범위 안에 있다", () => {
  for (const l of [2, 3, 4, 5, 6, 7, 8]) {
    const r = defaultRoles(l, pagesOf(l), 42);
    assert.deepEqual(r, VERIFIED_ROLES_42[l]);
    assert.ok(r.body.every((p) => pagesOf(l).includes(p)));
    assert.ok(pagesOf(l).includes(r.writing));
    assert.ok(!r.body.includes(r.writing));
  }
});

t("모르는 PDF는 마지막 쪽을 문장쓰기로 단정하지 않는다", () => {
  const r = defaultRoles(4, [100, 101, 102, 103], 120);
  assert.equal(r.writing, null);
  assert.deepEqual(r.body, [100]);
  // 42쪽이어도 Lesson 범위가 확인된 값과 다르면 기본값을 쓰지 않는다
  const r2 = defaultRoles(4, [30, 31, 32], 42);
  assert.equal(r2.writing, null);
});

t("문장쓰기 순서: 중복·누락 없는 섞기, 저장 순서 검증", () => {
  for (let i = 0; i < 50; i++) {
    const o = shuffleOrder(4);
    assert.ok(isValidOrder(o, 4));
  }
  assert.ok(!isValidOrder([0, 1, 1, 3], 4));
  assert.ok(!isValidOrder([0, 1, 2], 4));
  assert.ok(!isValidOrder([0, 1, 2, 4], 4));
  // 다시 시작하면 직전 순서와 다르게
  const prev = [0, 1, 2, 3];
  for (let i = 0; i < 30; i++) assert.notDeepEqual(shuffleOrder(4, prev), prev);
});

t("학습지 연결: Lesson당 2쪽, 시작 쪽과 Lesson별 파일", () => {
  assert.deepEqual([2, 3, 4, 5, 6, 7, 8].map(worksheetStartPage), [1, 3, 5, 7, 9, 11, 13]);
  assert.equal(worksheetUrl(6), "/worksheets/lesson-6.pdf");
});

console.log(`\n${n} tests passed`);
