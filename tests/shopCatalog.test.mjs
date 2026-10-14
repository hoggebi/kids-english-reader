// 실행: node --experimental-strip-types tests/shopCatalog.test.mjs
// 첨부 패키지(CATALOG.json)의 12개 상품·가격과 앱 카탈로그가 같고, 이미지 파일이 실제로 있는지 확인한다.
import assert from "node:assert/strict";
import fs from "node:fs";
import { SHOP_ITEMS, SHOP_BY_ID } from "../lib/shopCatalog.ts";

const PACK = {
  star_balloon: [100, "prop"],
  cheer_flag: [150, "prop"],
  treasure_chest: [250, "prop"],
  mini_rocket: [550, "prop"],
  secret_jungle: [500, "background"],
  undersea: [600, "background"],
  space_base: [800, "background"],
  star_sparkle: [200, "effect"],
  ice_aura: [600, "effect"],
  fire_aura: [900, "effect"],
  lightning_aura: [1000, "effect"],
  galaxy_aura: [2000, "effect"],
};

let n = 0;
const t = (name, fn) => {
  fn();
  n += 1;
  console.log("ok -", name);
};

t("상품 12종, id 중복 없음", () => {
  assert.equal(SHOP_ITEMS.length, 12);
  assert.equal(new Set(SHOP_ITEMS.map((i) => i.id)).size, 12);
});
t("가격과 슬롯이 패키지 카탈로그와 같다", () => {
  for (const [id, [price, slot]] of Object.entries(PACK)) {
    assert.equal(SHOP_BY_ID[id]?.price, price, id);
    assert.equal(SHOP_BY_ID[id]?.slot, slot, id);
  }
});
t("이미지 파일이 모두 public/shop에 있다", () => {
  for (const i of SHOP_ITEMS) assert.ok(fs.existsSync(`public${i.asset}`), i.asset);
});
t("배경 3, 소품 4, 효과 5, 레어는 은하 오라 하나", () => {
  const c = (s) => SHOP_ITEMS.filter((i) => i.slot === s).length;
  assert.deepEqual([c("background"), c("prop"), c("effect")], [3, 4, 5]);
  assert.deepEqual(SHOP_ITEMS.filter((i) => i.rare).map((i) => i.id), ["galaxy_aura"]);
});

console.log(`${n} tests passed`);
