// 실행: node --experimental-strip-types tests/chapterSpecies.test.mjs
// 챕터 성장 순서(흑표범→늑대→오랑우탄→불곰→코모도왕도마뱀→코뿔소)와 각 8단계 이미지·이름·꾸미기 경계표를 확인한다.
import assert from "node:assert/strict";
import fs from "node:fs";
import { CHAPTER_SPECIES, getSpecies, getStageInfo, getPetImagePath, MAX_STAGE } from "../lib/pet.ts";

assert.deepEqual(CHAPTER_SPECIES.map((s) => s.imagePrefix), ["bp", "w", "o", "bb", "kd", "rh"]);
const boundsSrc = fs.readFileSync(new URL("../lib/friendBounds.ts", import.meta.url), "utf8");
const names = [];
for (const [gi, sp] of CHAPTER_SPECIES.entries()) {
  assert.equal(sp.stages.length, 8, `${sp.imagePrefix} 8단계`);
  for (let stage = 1; stage <= 8; stage++) {
    const pet = { stage, generation: gi + 1 };
    const path = getPetImagePath(pet);
    const file = new URL(`../public${path}`, import.meta.url);
    assert.ok(fs.existsSync(file), `${path} 파일`);
    const info = getStageInfo(pet);
    assert.ok(info.name && info.desc && info.talk.length >= 1, `${path} 이름·설명·대사`);
    assert.ok(boundsSrc.includes(`"${path}":`), `${path} 꾸미기 경계`);
    if (sp.imagePrefix === "bb" || sp.imagePrefix === "kd" || sp.imagePrefix === "rh") {
      const b = fs.readFileSync(file);
      assert.equal(b.readUInt32BE(16), 1024);
      assert.equal(b.readUInt32BE(20), 1024);
      assert.equal(b[25], 6, `${path} RGBA`); // color type 6
    }
    names.push(info.name);
  }
}
assert.equal(getSpecies(3).imagePrefix, "o");
assert.equal(getSpecies(4).imagePrefix, "bb");
assert.equal(getSpecies(5).imagePrefix, "kd");
assert.equal(getSpecies(6).imagePrefix, "rh");
assert.equal(getSpecies(7).imagePrefix, "rh"); // 준비된 동물을 넘으면 마지막 동물을 계속 쓴다
assert.equal(getPetImagePath({ stage: 8, generation: 2 }), "/W8.png"); // 늑대 8단계 예외 유지
assert.equal(getPetImagePath({ stage: 1, generation: 4 }), "/bb1.png"); // 오랑우탄 8 → 불곰 1
assert.equal(getPetImagePath({ stage: 1, generation: 5 }), "/kd1.png"); // 불곰 8 → 코모도 1
assert.equal(getPetImagePath({ stage: 1, generation: 6 }), "/rh1.png"); // 코모도 8 → 코뿔소 1
assert.ok(names.filter((n) => n.includes("코모도왕도마뱀")).length === 8);
assert.ok(names.filter((n) => n.includes("코뿔소")).length === 8);
assert.ok(!names.some((n) => n.includes("이구아나")));
assert.equal(MAX_STAGE, 8);
console.log("chapterSpecies ok");
