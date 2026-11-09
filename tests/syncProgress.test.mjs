// 실행: node --experimental-strip-types tests/syncProgress.test.mjs
// 기기 간 Lesson 진도 합치기 규칙 검증
import assert from "node:assert/strict";
import { lessonsReadyToStamp, mergeProgress } from "../lib/syncProgress.ts";

const empty = { written: [], a2Study: [], a3Study: [], listens: {}, growthDay: {}, a3Typing: {} };
const typing = (pos, round, extra = {}) => ({ order: [1, 0, 3, 2], pos, round, completed: false, rewarded: [], ...extra });

// 목록은 합치고 어느 쪽도 사라지지 않는다
let m = mergeProgress({ ...empty, written: [101], a3Study: [1] }, { written: [102, 101], a3Study: [2], a2Study: [3] });
assert.deepEqual(m.written, [101, 102]);
assert.deepEqual(m.a3Study, [1, 2]);
assert.deepEqual(m.a2Study, [3]);

// 읽기 횟수는 큰 쪽, 성장일은 최근 날짜
m = mergeProgress({ ...empty, listens: { 101: 3 }, growthDay: { 101: "2026-11-09" } }, { listens: { 101: 1, 102: 2 }, growthDay: { 101: "2026-11-01", 102: "2026-11-02" } });
assert.deepEqual(m.listens, { 101: 3, 102: 2 });
assert.deepEqual(m.growthDay, { 101: "2026-11-09", 102: "2026-11-02" });

// A3 타이핑은 더 진행된 쪽을 쓰고, 코인 받은 문장은 양쪽을 합친다
m = mergeProgress({ ...empty, a3Typing: { 101: typing(1, 0, { rewarded: ["a"] }) } }, { a3Typing: { 101: typing(2, 1, { rewarded: ["b"] }) } });
assert.equal(m.a3Typing[101].pos, 2);
assert.deepEqual(m.a3Typing[101].rewarded.sort(), ["a", "b"]);
// 서버가 뒤처져 있으면 이 기기의 진행을 유지
m = mergeProgress({ ...empty, a3Typing: { 101: typing(3, 2) } }, { a3Typing: { 101: typing(0, 0) } });
assert.equal(m.a3Typing[101].pos, 3);
// 완료한 기록이 진행 중보다 앞선다
m = mergeProgress({ ...empty, a3Typing: { 101: typing(3, 2) } }, { a3Typing: { 101: typing(3, 2, { completed: true }) } });
assert.equal(m.a3Typing[101].completed, true);

// 이전 형식·손상된 서버 값이 있어도 이 기기 값은 안전
m = mergeProgress({ ...empty, written: [101], a3Typing: { 101: typing(1, 1) } }, { written: "x", listens: null, a3Typing: { 101: "bad", 102: 7 } });
assert.deepEqual(m.written, [101]);
assert.equal(m.a3Typing[101].pos, 1);
assert.equal(m.a3Typing[102], undefined);
assert.deepEqual(mergeProgress(empty, {}), empty);

// 쓰기와 읽기를 기기를 나눠서 했어도 완료(✓)
assert.deepEqual(lessonsReadyToStamp({ ...empty, written: [101, 102, 103], listens: { 101: 1, 103: 1 } }, [103]), [101]);

console.log("syncProgress ok");
