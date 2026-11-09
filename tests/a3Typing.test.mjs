// 실행: node --experimental-strip-types tests/a3Typing.test.mjs
// SEED1_A3 타이핑 학습의 입력 판정·회차 진행 규칙 검증
import assert from "node:assert/strict";
import {
  BACKSPACE,
  advanceTyping,
  buildTarget,
  hasTypo,
  keyFromEvent,
  pressFree,
  pressGuided,
  resumeTyping,
} from "../lib/a3Typing.ts";
import { a3SeedWriting } from "../lib/chunkbookA3.ts";

// 입력 대상: 문장부호는 빠지고, 대소문자는 소문자로 맞춘다
assert.equal(buildTarget("Casey’s chest feels tight.").keys, "caseys chest feels tight");
assert.equal(buildTarget("“I need math help.”").keys, "i need math help");
assert.equal(buildTarget("Then, she picks polka-dot pants.").keys, "then she picks polkadot pants");
assert.equal(buildTarget("I weigh 22 kilograms.").keys, "i weigh 22 kilograms");
assert.equal(buildTarget("  a   b . ").keys, "a b");
const t = buildTarget("Hi, you!");
assert.equal(t.cells.map((c) => c.ch).join(""), "Hi, you!");
assert.deepEqual(t.cells.filter((c) => c.slot === -1).map((c) => c.ch), [",", "!"]);

// A3 교재 문장 32개 모두 입력 대상이 있고, 키보드에 있는 글자로만 되어 있다
let count = 0;
for (let i = 101; i <= 108; i++) {
  for (const w of a3SeedWriting(i)) {
    const { keys } = buildTarget(w.en);
    assert.match(keys, /^[a-z0-9]+( [a-z0-9]+)*$/, w.en);
    count++;
  }
}
assert.equal(count, 32);

// 1회차: 오타는 진행되지 않고 그 자리에서 이어서 입력한다
let g = pressGuided("hi you", "", "h");
assert.deepEqual(g, { buf: "h", ok: true });
assert.deepEqual(pressGuided("hi you", "h", "x"), { buf: "h", ok: false });
assert.deepEqual(pressGuided("hi you", "hi", " "), { buf: "hi ", ok: true });
assert.deepEqual(pressGuided("hi you", "hi", "y"), { buf: "hi", ok: false }, "띄어쓰기를 건너뛸 수 없다");
assert.equal(pressGuided("hi you", "hi", BACKSPACE).buf, "hi");

// 2·3회차: 오타는 표시되고, 지우면 그 부분만 고칠 수 있다
let b = "";
for (const k of "hx") b = pressFree("hi you", b, k);
assert.equal(b, "hx");
assert.ok(hasTypo("hi you", b));
b = pressFree("hi you", b, BACKSPACE);
assert.equal(b, "h");
assert.ok(!hasTypo("hi you", b));
assert.equal(pressFree("ab", "ab", "c"), "ab", "문장 길이를 넘지 않는다");
assert.notEqual("you hi", "hi you", "단어 순서");
assert.ok(hasTypo("hi you", "you hi"), "단어 순서가 다르면 오타");
assert.ok(hasTypo("hi you", "hiyou"), "띄어쓰기를 빠뜨리면 오타");

// 회차 진행: 3회차까지 끝내야 문장 완료, 마지막 문장까지 끝내야 Lesson 완료
const p0 = { order: [1, 0], pos: 0, round: 0, completed: false, rewarded: [] };
let s = advanceTyping(p0, 2);
assert.deepEqual([s.next.round, s.sentenceDone, s.lessonDone], [1, false, false]);
s = advanceTyping(s.next, 2);
assert.deepEqual([s.next.round, s.sentenceDone], [2, false]);
s = advanceTyping(s.next, 2);
assert.deepEqual([s.next.pos, s.next.round, s.sentenceDone, s.lessonDone], [1, 0, true, false]);
s = advanceTyping({ ...s.next, round: 2 }, 2);
assert.deepEqual([s.next.completed, s.sentenceDone, s.lessonDone], [true, true, true]);

// 실제 키보드 변환
assert.equal(keyFromEvent({ key: "A", code: "KeyA" }), "a", "대문자도 같은 글자");
assert.equal(keyFromEvent({ key: "ㅁ", code: "KeyA" }), "a", "한글 입력 상태");
assert.equal(keyFromEvent({ key: "Process", code: "KeyQ" }), "q");
assert.equal(keyFromEvent({ key: " ", code: "Space" }), " ");
assert.equal(keyFromEvent({ key: "Backspace", code: "Backspace" }), BACKSPACE);
assert.equal(keyFromEvent({ key: ".", code: "Period" }), null, "문장부호는 오타로 치지 않는다");
assert.equal(keyFromEvent({ key: "!", code: "Digit1" }), null);
assert.equal(keyFromEvent({ key: "r", code: "KeyR", metaKey: true }), null, "브라우저 단축키");
assert.equal(keyFromEvent({ key: "Shift", code: "ShiftLeft" }), null);

// 이어 하기: 유효하면 위치 유지, 손상·문장 수 변경·완료 후에는 새로 시작하되 보상 기록은 유지
const mid = { order: [1, 0], pos: 1, round: 2, completed: false, rewarded: ["a"] };
assert.deepEqual(resumeTyping(mid, 2), mid);
for (const bad of [
  { ...mid, order: [0, 0] },
  { ...mid, pos: 2 },
  { ...mid, round: 3 },
  { ...mid, completed: true },
  { ...mid, order: [0, 1, 2] },
]) {
  const r = resumeTyping(bad, 2);
  assert.deepEqual([r.pos, r.round, r.completed, r.rewarded], [0, 0, false, ["a"]]);
}
assert.deepEqual(resumeTyping(null, 2).rewarded, []);

console.log("a3Typing ok");
