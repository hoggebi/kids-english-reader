// 소품 위치 편집용 순수 함수. 좌표는 "미리보기 그림(가로:세로 1.2:1 캔버스)" 기준 0~1 중심 좌표이고,
// scale은 캔버스 폭에 대한 소품 폭의 비율이다. 화면 픽셀/기기 크기와 무관하다.

export type PropLayer = "front" | "back";
export type Placement = { x: number; y: number; scale: number; layer: PropLayer };

export const SCALE_MIN = 0.12;
export const SCALE_MAX = 0.95;
export const CANVAS_ASPECT = 1.2; // 가로:세로

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

// 소품 실루엣이 캔버스 밖으로 완전히 나가지 않도록 중심을 제한한다(최소한 절반 이상은 안에 남는다).
// aspect = 소품 그림의 가로/세로 비율(정사각형이면 1).
export function clampPlacement(p: Placement, aspect = 1): Placement {
  const scale = clamp(p.scale, SCALE_MIN, SCALE_MAX);
  const halfW = scale / 2;
  const halfH = (scale / aspect) * CANVAS_ASPECT / 2; // 캔버스 높이 대비
  const minX = -halfW * 0.5 + 0.02;
  const maxX = 1 + halfW * 0.5 - 0.02;
  const minY = -halfH * 0.5 + 0.02;
  const maxY = 1 + halfH * 0.5 - 0.02;
  return { x: clamp(p.x, minX, maxX), y: clamp(p.y, minY, maxY), scale, layer: p.layer === "back" ? "back" : "front" };
}

export function sanitizePlacement(raw: unknown): Placement | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.x !== "number" || typeof r.y !== "number" || typeof r.scale !== "number") return null;
  if (!Number.isFinite(r.x) || !Number.isFinite(r.y) || !Number.isFinite(r.scale)) return null;
  return clampPlacement({ x: r.x, y: r.y, scale: r.scale, layer: r.layer === "back" ? "back" : "front" });
}

export function movePlacement(p: Placement, dx: number, dy: number, aspect = 1): Placement {
  return clampPlacement({ ...p, x: p.x + dx, y: p.y + dy }, aspect);
}

export function scalePlacement(p: Placement, factor: number, aspect = 1): Placement {
  return clampPlacement({ ...p, scale: p.scale * factor }, aspect);
}

// 화면 좌표(clientX/Y) → 캔버스 0~1 좌표. rect는 캔버스(미리보기 그림)의 실제 영역.
export function pointToCanvas(clientX: number, clientY: number, rect: { left: number; top: number; width: number; height: number }): { x: number; y: number } {
  return { x: (clientX - rect.left) / Math.max(1, rect.width), y: (clientY - rect.top) / Math.max(1, rect.height) };
}

export function samePlacement(a: Placement | null | undefined, b: Placement | null | undefined): boolean {
  if (!a || !b) return a === b;
  const e = (m: number, n: number) => Math.abs(m - n) < 1e-4;
  return e(a.x, b.x) && e(a.y, b.y) && e(a.scale, b.scale) && a.layer === b.layer;
}
