// 친구 꾸미기 상점 카탈로그(상품 20종: 기본 12종 + 2차 확장 8종). 상품 id와 가격은 서버(app/api/shop)도 같은 값을 쓴다.
// 이미지는 public/shop/ 에 있고, 글자·가격은 이미지에 합성하지 않고 화면(UI)에서 보여준다.

export type ShopSlot = "background" | "prop" | "effect";
export type ShopAnimation = "float" | "pulse" | "none";

export type ShopItem = {
  id: string;
  name: string;
  price: number;
  slot: ShopSlot;
  asset: string;
  animation: ShopAnimation;
  rare?: boolean;
  isNew?: boolean; // 이번에 추가한 상품에만 붙는 NEW 배지(기간·할인·품절 표시 아님)
};

export const SHOP_SLOT_LABEL: Record<ShopSlot, string> = { background: "배경", prop: "소품", effect: "효과" };
export const SHOP_SLOTS: ShopSlot[] = ["background", "effect", "prop"];

export const SHOP_ITEMS: ShopItem[] = [
  { id: "star_balloon", name: "반짝별 풍선", price: 100, slot: "prop", asset: "/shop/star_balloon.png", animation: "float" },
  { id: "cheer_flag", name: "응원 깃발", price: 150, slot: "prop", asset: "/shop/cheer_flag.png", animation: "none" },
  { id: "treasure_chest", name: "보물 상자", price: 250, slot: "prop", asset: "/shop/treasure_chest.png", animation: "none" },
  { id: "mini_rocket", name: "꼬마 로켓", price: 550, slot: "prop", asset: "/shop/mini_rocket.png", animation: "float" },
  { id: "secret_jungle", name: "비밀 정글", price: 500, slot: "background", asset: "/shop/secret_jungle.jpg", animation: "none" },
  { id: "undersea", name: "바닷속 탐험", price: 600, slot: "background", asset: "/shop/undersea.jpg", animation: "none" },
  { id: "space_base", name: "우주 기지", price: 800, slot: "background", asset: "/shop/space_base.jpg", animation: "none" },
  { id: "star_sparkle", name: "별 반짝임", price: 200, slot: "effect", asset: "/shop/star_sparkle.png", animation: "pulse" },
  { id: "ice_aura", name: "얼음 기운", price: 600, slot: "effect", asset: "/shop/ice_aura.png", animation: "pulse" },
  { id: "fire_aura", name: "불꽃 기운", price: 900, slot: "effect", asset: "/shop/fire_aura.png", animation: "pulse" },
  { id: "lightning_aura", name: "번개 기운", price: 1000, slot: "effect", asset: "/shop/lightning_aura.png", animation: "pulse" },
  { id: "galaxy_aura", name: "은하 오라", price: 2000, slot: "effect", asset: "/shop/galaxy_aura.png", animation: "pulse", rare: true },
  // ---- 2차 확장(배경 3 + 효과 5). 기존 상품·가격은 그대로 두고 뒤에 붙인다.
  { id: "lava_kingdom", name: "용암 왕국", price: 900, slot: "background", asset: "/shop/lava_kingdom.jpg", animation: "none", isNew: true },
  { id: "glacier_palace", name: "빙하 궁전", price: 1100, slot: "background", asset: "/shop/glacier_palace.jpg", animation: "none", isNew: true },
  { id: "aurora_summit", name: "오로라 정상", price: 1400, slot: "background", asset: "/shop/aurora_summit.jpg", animation: "none", isNew: true },
  { id: "wind_vortex", name: "바람 회오리", price: 700, slot: "effect", asset: "/shop/wind_vortex.png", animation: "pulse", isNew: true },
  { id: "tidal_wave", name: "파도 수호막", price: 1000, slot: "effect", asset: "/shop/tidal_wave.png", animation: "pulse", isNew: true },
  { id: "meteor_trails", name: "유성 질주", price: 1500, slot: "effect", asset: "/shop/meteor_trails.png", animation: "pulse", isNew: true },
  { id: "dragon_flame", name: "용의 불꽃", price: 2200, slot: "effect", asset: "/shop/dragon_flame.png", animation: "pulse", rare: true, isNew: true },
  { id: "blackhole_halo", name: "블랙홀 오라", price: 3000, slot: "effect", asset: "/shop/blackhole_halo.png", animation: "pulse", rare: true, isNew: true },
];

export const SHOP_BY_ID: Record<string, ShopItem> = Object.fromEntries(SHOP_ITEMS.map((i) => [i.id, i]));

// 미리보기 공간(가로:세로 = 1.2:1) 기준 정규화 중심 좌표와 크기. 컨테이너 비율로만 배치한다.
export const SCENE_ASPECT = 1.2;
export const LAYOUT = {
  friend: { x: 0.48, y: 0.55, w: 0.62, h: 0.78 },
  prop: { x: 0.82, y: 0.7, w: 0.24, h: 0.36 },
  tallProp: { x: 0.82, y: 0.36, w: 0.24, h: 0.48 }, // 풍선·로켓
  effect: { x: 0.48, y: 0.55, w: 0.95, h: 0.95 },
} as const;

// 독수리 날개·상어 꼬리처럼 옆 소품과 겹치기 쉬운 친구는 소품 위치를 따로 둔다(이미지 접두사 기준).
export const PROP_OVERRIDE: Record<string, { x: number; y: number }> = {
  e: { x: 0.87, y: 0.76 },
  s: { x: 0.87, y: 0.8 },
};
