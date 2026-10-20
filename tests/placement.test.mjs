// 실행: node --experimental-strip-types tests/placement.test.mjs
import assert from "node:assert/strict";
import { clampPlacement, movePlacement, pointToCanvas, sanitizePlacement, scalePlacement, SCALE_MAX, SCALE_MIN } from "../lib/placement.ts";
let n = 0;
const t = (name, fn) => { fn(); n += 1; console.log("ok -", name); };
const base = { x: 0.5, y: 0.5, scale: 0.3, layer: "front" };

t("크기는 허용 범위 안으로 제한된다", () => {
  assert.equal(scalePlacement(base, 100).scale, SCALE_MAX);
  assert.equal(scalePlacement(base, 0.0001).scale, SCALE_MIN);
});
t("중심은 캔버스 밖으로 완전히 나가지 않는다", () => {
  const far = movePlacement(base, 5, 5);
  assert.ok(far.x <= 1.2 && far.y <= 1.2);
  const wayBack = movePlacement(base, -5, -5);
  assert.ok(wayBack.x >= -0.2 && wayBack.y >= -0.2);
});
t("화면 좌표 → 캔버스 0~1 (여백 없이 캔버스 영역 기준)", () => {
  const rect = { left: 100, top: 50, width: 400, height: 333.3333 };
  const p = pointToCanvas(300, 216.6667, rect);
  assert.ok(Math.abs(p.x - 0.5) < 1e-3 && Math.abs(p.y - 0.5) < 1e-3);
});
t("저장값 검증: 이상한 값은 버리고 범위 밖은 보정", () => {
  assert.equal(sanitizePlacement(null), null);
  assert.equal(sanitizePlacement({ x: "a", y: 1, scale: 1 }), null);
  const c = sanitizePlacement({ x: 0.4, y: 0.3, scale: 5, layer: "back" });
  assert.equal(c.scale, SCALE_MAX);
  assert.equal(c.layer, "back");
  assert.equal(clampPlacement({ ...base, layer: "weird" }).layer, "front");
});
console.log(`${n} tests passed`);
