"use client";

import { SHOP_BY_ID, type ShopSlot } from "./shopCatalog";
import { getSpecies, loadCoinsTotal, type PetTrack } from "./pet";
import { getSyncCode } from "./sync";

// 친구 꾸미기 상점의 기기 쪽 상태.
//  - owned/spent: 공유 보유 목록과 쓴 코인. 동기화 코드가 있으면 서버(app/api/shop)가 기준이고, 이 값은 사본이다.
//  - equipped/goal: 친구별 장착과 목표. 기존 6자리 동기화 payload에 실려 기기 간에 맞춰진다.
//  - pending: 구매 중 통신이 끊겼을 때 같은 purchaseId로 다시 시도하기 위한 기록(멱등).
//  - local: 동기화 코드 없이 산 기록. 코드를 연결할 때 서버에 한 번만 합친다.
const SHOP_KEY = "chunkbook-v2-shop";

export type Equipped = Partial<Record<ShopSlot, string>>;
export type ShopState = {
  owned: string[];
  spent: number;
  equipped: Record<string, Equipped>;
  goal: string | null;
  pending: Record<string, string>;
  local: { purchaseId: string; itemId: string }[];
};

const EMPTY: ShopState = { owned: [], spent: 0, equipped: {}, goal: null, pending: {}, local: [] };

export function loadShop(): ShopState {
  if (typeof window === "undefined") return { ...EMPTY };
  try {
    const raw = localStorage.getItem(SHOP_KEY);
    if (!raw) return { ...EMPTY };
    const p = JSON.parse(raw) as Partial<ShopState>;
    return {
      owned: Array.isArray(p.owned) ? p.owned.filter((id) => typeof id === "string" && SHOP_BY_ID[id]) : [],
      spent: typeof p.spent === "number" && p.spent >= 0 ? p.spent : 0,
      equipped: p.equipped && typeof p.equipped === "object" ? p.equipped : {},
      goal: typeof p.goal === "string" && SHOP_BY_ID[p.goal] ? p.goal : null,
      pending: p.pending && typeof p.pending === "object" ? p.pending : {},
      local: Array.isArray(p.local) ? p.local : [],
    };
  } catch {
    return { ...EMPTY };
  }
}

function saveShop(s: ShopState) {
  if (typeof window === "undefined") return;
  localStorage.setItem(SHOP_KEY, JSON.stringify(s));
  window.dispatchEvent(new CustomEvent("shop-changed"));
}

// 지갑 잔액 = 지금까지 모은 코인 − 상점에서 쓴 코인 (성장과는 무관)
export function shopBalance(): number {
  return Math.max(0, loadCoinsTotal() - loadShop().spent);
}

// 친구 식별자: 트랙 + 동물 종류. 성장 단계가 바뀌어도 같은 친구로 본다.
export function friendKey(track: PetTrack, generation: number): string {
  const sp = getSpecies(generation, track);
  return `${track}:${sp.imagePrefix || "fox"}`;
}

export function getEquipped(key: string): Equipped {
  return loadShop().equipped[key] ?? {};
}

export function hasAnyEquipped(key: string): boolean {
  const e = getEquipped(key);
  return !!(e.background || e.prop || e.effect);
}

export function equipItem(key: string, slot: ShopSlot, itemId: string | null) {
  const s = loadShop();
  if (itemId && !s.owned.includes(itemId)) return; // 보유하지 않은 것은 장착할 수 없다
  const cur = { ...(s.equipped[key] ?? {}) };
  if (itemId) cur[slot] = itemId;
  else delete cur[slot];
  s.equipped = { ...s.equipped, [key]: cur };
  saveShop(s);
}

export function setGoal(itemId: string | null) {
  const s = loadShop();
  s.goal = itemId && SHOP_BY_ID[itemId] ? itemId : null;
  saveShop(s);
}

// 동기화 payload용
export function exportShopForSync(): { equipped: Record<string, Equipped>; goal: string | null } {
  const s = loadShop();
  return { equipped: s.equipped, goal: s.goal };
}

export function applyShopFromSync(data: { equipped?: Record<string, Equipped>; goal?: string | null }) {
  const s = loadShop();
  if (data.equipped && typeof data.equipped === "object") {
    // 보유하지 않은 상품이 장착으로 들어오지 않도록 걸러낸다.
    const clean: Record<string, Equipped> = {};
    for (const [k, v] of Object.entries(data.equipped)) {
      const e: Equipped = {};
      for (const slot of ["background", "prop", "effect"] as ShopSlot[]) {
        const id = v?.[slot];
        if (id && SHOP_BY_ID[id]?.slot === slot) e[slot] = id;
      }
      clean[k] = e;
    }
    s.equipped = clean;
  }
  if (data.goal !== undefined) s.goal = data.goal && SHOP_BY_ID[data.goal] ? data.goal : null;
  saveShop(s);
}

function newPurchaseId(): string {
  const c = typeof crypto !== "undefined" ? crypto : undefined;
  if (c && "randomUUID" in c) return c.randomUUID();
  return `p-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export type BuyResult =
  | { ok: true }
  | { ok: false; reason: "owned" | "insufficient" | "busy" | "network" | "error"; message: string; need?: number };

const inFlight = new Set<string>();

function applyServerShop(owned: string[], spent: number) {
  const s = loadShop();
  // 서버 보유 목록과 이 기기에서 아직 합치지 못한 로컬 구매를 함께 유지한다.
  const localIds = s.local.map((l) => l.itemId);
  s.owned = Array.from(new Set([...owned, ...localIds])).filter((id) => SHOP_BY_ID[id]);
  s.spent = Math.max(spent, 0);
  saveShop(s);
}

// 로컬(코드 없음)에서 산 기록을 서버에 한 번만 합친다. 같은 purchaseId는 서버가 한 번만 반영한다.
export async function mergeLocalPurchases(): Promise<boolean> {
  const code = getSyncCode();
  if (!code) return true;
  const s = loadShop();
  if (s.local.length === 0) return true;
  try {
    const res = await fetch("/api/shop", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, action: "merge", items: s.local, earned: loadCoinsTotal() }),
    });
    if (!res.ok) return false;
    const j = (await res.json()) as { owned?: string[]; spent?: number };
    const cur = loadShop();
    cur.local = [];
    saveShop(cur);
    applyServerShop(Array.isArray(j.owned) ? j.owned : [], typeof j.spent === "number" ? j.spent : 0);
    return true;
  } catch {
    return false;
  }
}

// 서버의 보유 목록·쓴 코인을 사본으로 받아온다(동기화 재접속, 다른 기기 구매 반영).
export async function refreshShopFromServer(): Promise<boolean> {
  const code = getSyncCode();
  if (!code) return true;
  try {
    if (!(await mergeLocalPurchases())) return false;
    const res = await fetch(`/api/shop?code=${encodeURIComponent(code)}`, { cache: "no-store" });
    if (!res.ok) return false;
    const j = (await res.json()) as { owned?: string[]; spent?: number };
    applyServerShop(Array.isArray(j.owned) ? j.owned : [], typeof j.spent === "number" ? j.spent : 0);
    return true;
  } catch {
    return false;
  }
}

// 구매. 같은 상품을 연속으로 눌러도(더블탭) 한 번만 처리하고, 통신이 끊기면 구매 완료로 표시하지 않는다.
// 통신 실패 후 다시 시도하면 같은 purchaseId를 써서, 서버가 이미 처리했더라도 중복 차감하지 않는다.
export async function buyItem(itemId: string): Promise<BuyResult> {
  const item = SHOP_BY_ID[itemId];
  if (!item) return { ok: false, reason: "error", message: "알 수 없는 상품이에요." };
  if (inFlight.has(itemId)) return { ok: false, reason: "busy", message: "구매하는 중이에요." };
  inFlight.add(itemId);
  try {
    let s = loadShop();
    if (s.owned.includes(itemId)) return { ok: false, reason: "owned", message: "이미 가지고 있어요." };

    const code = getSyncCode();
    if (code) {
      if (!(await mergeLocalPurchases())) {
        return { ok: false, reason: "network", message: "연결이 불안정해요. 잠시 후 다시 눌러 주세요." };
      }
      s = loadShop();
    }

    const balance = Math.max(0, loadCoinsTotal() - s.spent);
    if (!code && balance < item.price) {
      return { ok: false, reason: "insufficient", message: `${item.price - balance}코인 더 모으면 살 수 있어요.`, need: item.price - balance };
    }

    const purchaseId = s.pending[itemId] ?? newPurchaseId();
    if (!code) {
      // 코드 없이 쓰는 로컬 모드: 한 번에 하나씩, 이 기기에서만 처리
      s.spent += item.price;
      s.owned = [...s.owned, itemId];
      s.local = [...s.local, { purchaseId, itemId }];
      delete s.pending[itemId];
      if (s.goal === itemId) s.goal = null;
      saveShop(s);
      return { ok: true };
    }

    s.pending = { ...s.pending, [itemId]: purchaseId };
    saveShop(s);
    let res: Response;
    try {
      res = await fetch("/api/shop", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, action: "purchase", purchaseId, itemId, earned: loadCoinsTotal() }),
      });
    } catch {
      return { ok: false, reason: "network", message: "연결이 끊겼어요. 다시 눌러 주세요. 코인은 아직 쓰이지 않았어요." };
    }
    if (!res.ok) {
      return { ok: false, reason: "network", message: "지금은 구매할 수 없어요. 잠시 후 다시 눌러 주세요." };
    }
    const j = (await res.json()) as { ok?: boolean; reason?: string; owned?: string[]; spent?: number; balance?: number };
    applyServerShop(Array.isArray(j.owned) ? j.owned : [], typeof j.spent === "number" ? j.spent : 0);
    const cur = loadShop();
    delete cur.pending[itemId];
    if (j.reason === "ok" || j.reason === "owned") {
      if (cur.goal === itemId) cur.goal = null;
      saveShop(cur);
      return j.reason === "ok" ? { ok: true } : { ok: false, reason: "owned", message: "이미 가지고 있어요." };
    }
    saveShop(cur);
    const need = Math.max(0, item.price - (typeof j.balance === "number" ? j.balance : 0));
    return { ok: false, reason: "insufficient", message: `${need}코인 더 모으면 살 수 있어요.`, need };
  } finally {
    inFlight.delete(itemId);
  }
}
