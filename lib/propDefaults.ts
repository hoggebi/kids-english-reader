import { LAYOUT, PROP_OVERRIDE, SCENE_ASPECT, SHOP_BY_ID } from "./shopCatalog";
import { friendCanvasBox } from "./friendBounds";
import { clampPlacement, type Placement } from "./placement";

export const LEGACY_PROP_SCALE = 0.24; // 기존 소품(풍선·깃발·상자·로켓)의 폭 비율

// 기존 소품은 예전 고정 배치를 쓴다. 새 소품(defaultPlacement가 있는 것)만 친구별 기본 위치를 계산한다.
export function hasCustomDefault(itemId: string): boolean {
  return !!SHOP_BY_ID[itemId]?.defaultPlacement;
}

// 소품의 "기본 위치". friendPath = 친구 이미지 경로(/e5.png 등), prefix = 친구 종류 접두사('', t, e, s, bp, w, o).
export function defaultPlacement(itemId: string, friendPath: string, prefix: string): Placement {
  const item = SHOP_BY_ID[itemId];
  const tall = item?.animation === "float";
  const override = PROP_OVERRIDE[prefix];
  const legacy: Placement = (() => {
    const base = tall ? LAYOUT.tallProp : LAYOUT.prop;
    const pos = override && !tall ? override : { x: base.x, y: base.y };
    return { x: pos.x, y: pos.y, scale: LEGACY_PROP_SCALE, layer: "front" };
  })();
  const cat = item?.defaultPlacement;
  if (!cat) return legacy;
  const box = friendCanvasBox(friendPath, LAYOUT.friend, SCENE_ASPECT);
  if (!box) return clampPlacement({ ...cat });
  const bw = box.r - box.l;
  const cx = (box.l + box.r) / 2;
  const cy = (box.t + box.b) / 2;
  if (itemId === "royal_gem_crown") {
    const scale = Math.max(0.22, Math.min(0.34, bw * 0.55)); // 친구 몸 폭에 맞춰
    const h = scale * SCENE_ASPECT; // 캔버스 높이 대비 왕관 높이
    return clampPlacement({ x: box.hx, y: box.t - h * 0.1, scale, layer: "front" });
  }
  if (itemId === "golden_wings") {
    const scale = Math.max(0.6, Math.min(0.95, bw * 1.9));
    return clampPlacement({ x: cx, y: cy - 0.02, scale, layer: "back" });
  }
  if (itemId === "arcane_crystal_orb") {
    const scale = 0.26;
    const x = Math.min(0.88, box.r + 0.02);
    const y = Math.min(0.86, box.b - 0.1);
    return clampPlacement({ x, y, scale, layer: "front" });
  }
  return clampPlacement({ ...cat });
}
