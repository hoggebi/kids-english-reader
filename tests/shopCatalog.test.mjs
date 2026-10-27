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

t("상품 26종(기본 12 + 2차 8 + 화려한 소품 3 + 프리미엄 효과 3), id 중복 없음", () => {
  assert.equal(SHOP_ITEMS.length, 26);
  assert.equal(new Set(SHOP_ITEMS.map((i) => i.id)).size, 26);
});
const PACK3 = { royal_gem_crown: [1200, "prop"], golden_wings: [1800, "prop"], arcane_crystal_orb: [1500, "prop"] };
const PACK4 = { golden_guardian_sigil: [4000, "effect"], storm_king_thunder: [5000, "effect"], constellation_sovereign: [6000, "effect"] };
const PACK2 = {
  lava_kingdom: [900, "background"],
  glacier_palace: [1100, "background"],
  aurora_summit: [1400, "background"],
  wind_vortex: [700, "effect"],
  tidal_wave: [1000, "effect"],
  meteor_trails: [1500, "effect"],
  dragon_flame: [2200, "effect"],
  blackhole_halo: [3000, "effect"],
};
t("가격과 슬롯이 패키지 카탈로그와 같다(기본 12 + 2차 8)", () => {
  for (const [id, [price, slot]] of Object.entries({ ...PACK, ...PACK2, ...PACK3, ...PACK4 })) {
    assert.equal(SHOP_BY_ID[id]?.price, price, id);
    assert.equal(SHOP_BY_ID[id]?.slot, slot, id);
  }
});
t("이미지 파일이 모두 public/shop에 있다", () => {
  for (const i of SHOP_ITEMS) assert.ok(fs.existsSync(`public${i.asset}`), i.asset);
});
t("배경 6, 소품 7, 효과 13. NEW는 소품 3종과 프리미엄 효과 3종에만, 프리미엄은 레어", () => {
  const c = (s) => SHOP_ITEMS.filter((i) => i.slot === s).length;
  assert.deepEqual([c("background"), c("prop"), c("effect")], [6, 7, 13]);
  assert.deepEqual(SHOP_ITEMS.filter((i) => i.isNew).map((i) => i.id).sort(), [...Object.keys(PACK3), ...Object.keys(PACK4)].sort());
  assert.ok(Object.keys(PACK4).every((id) => SHOP_BY_ID[id].rare && SHOP_BY_ID[id].animation === "pulse"));
  assert.ok(SHOP_ITEMS.filter((i) => PACK[i.id]).every((i) => !i.isNew), "기존 상품에는 NEW가 없다");
});

console.log(`${n} tests passed`);
