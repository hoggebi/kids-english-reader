import { NextRequest, NextResponse } from "next/server";
import { Redis } from "@upstash/redis";
import { SHOP_BY_ID } from "@/lib/shopCatalog";

const redis = new Redis({
  url: process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL ?? "",
  token: process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN ?? "",
});

export const dynamic = "force-dynamic";
export const revalidate = 0;

const shopKey = (code: string) => `chunkbook-v2:shop:${code}`;
const syncKey = (code: string) => `chunkbook-v2:sync:${code}`;

// 잔액 검사 + 차감 + 소유권 지급을 한 번에(원자적으로) 처리한다. 같은 purchaseId는 다시 보내도 같은 결과만 돌려준다.
// force=1(로컬에서 이미 산 것을 합칠 때)은 잔액 검사를 건너뛰되, 같은 purchaseId·같은 상품은 한 번만 반영한다.
const PURCHASE_LUA = `
local raw = redis.call('GET', KEYS[1])
local st
if raw then st = cjson.decode(raw) else st = {owned = {}, spent = 0, purchases = {}} end
if type(st.owned) ~= 'table' then st.owned = {} end
if type(st.purchases) ~= 'table' then st.purchases = {} end
if st.spent == nil then st.spent = 0 end
local pid = ARGV[1]
local item = ARGV[2]
local price = tonumber(ARGV[3])
local earned = tonumber(ARGV[4])
local force = ARGV[5] == '1'
local prev = st.purchases[pid]
if prev then
  return cjson.encode({reason = prev, owned = st.owned, spent = st.spent, replay = true})
end
for _, v in ipairs(st.owned) do
  if v == item then
    st.purchases[pid] = 'owned'
    redis.call('SET', KEYS[1], cjson.encode(st))
    return cjson.encode({reason = 'owned', owned = st.owned, spent = st.spent})
  end
end
local balance = earned - st.spent
if (not force) and balance < price then
  return cjson.encode({reason = 'insufficient', owned = st.owned, spent = st.spent, balance = balance})
end
st.spent = st.spent + price
table.insert(st.owned, item)
st.purchases[pid] = 'ok'
redis.call('SET', KEYS[1], cjson.encode(st))
return cjson.encode({reason = 'ok', owned = st.owned, spent = st.spent})
`;

type Outcome = { reason: "ok" | "owned" | "insufficient"; owned: unknown; spent: number; balance?: number; replay?: boolean };

type Normalized = { reason: string; owned: string[]; spent: number; balance?: number; replay?: boolean };

function normalize(o: Outcome): Normalized {
  // Lua의 빈 배열은 {}로 직렬화되므로 배열로 바로잡는다.
  const owned = Array.isArray(o.owned) ? (o.owned as string[]) : Object.values((o.owned ?? {}) as Record<string, string>);
  return { reason: o.reason, owned, spent: o.spent ?? 0, balance: o.balance, replay: o.replay };
}

async function earnedFor(code: string, claimed: unknown): Promise<number> {
  let serverEarned = 0;
  try {
    const rec = (await redis.get(syncKey(code))) as { payload?: { coins?: unknown } } | null;
    const c = rec?.payload?.coins;
    if (typeof c === "number" && Number.isFinite(c)) serverEarned = c;
  } catch {
    /* 동기화 기록이 없으면 0 */
  }
  const claim = typeof claimed === "number" && Number.isFinite(claimed) ? claimed : 0;
  return Math.max(0, Math.floor(Math.max(serverEarned, claim)));
}

async function runPurchase(code: string, purchaseId: string, itemId: string, earned: number, force: boolean) {
  const item = SHOP_BY_ID[itemId];
  if (!item) throw new Error("알 수 없는 상품");
  const out = await redis.eval(PURCHASE_LUA, [shopKey(code)], [purchaseId, itemId, String(item.price), String(earned), force ? "1" : "0"]);
  return normalize(JSON.parse(String(out)) as Outcome);
}

export async function GET(req: NextRequest) {
  try {
    const code = req.nextUrl.searchParams.get("code");
    if (!code) return NextResponse.json({ error: "code가 필요합니다." }, { status: 400 });
    const raw = await redis.get(shopKey(code));
    const st = (typeof raw === "string" ? JSON.parse(raw) : raw) as { owned?: unknown; spent?: number } | null;
    const owned = Array.isArray(st?.owned) ? (st!.owned as string[]) : [];
    return NextResponse.json({ owned, spent: st?.spent ?? 0 }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "상점 정보를 불러오지 못했어요." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      code?: string;
      action?: "purchase" | "merge";
      purchaseId?: string;
      itemId?: string;
      earned?: number;
      items?: { purchaseId: string; itemId: string }[];
    };
    const code = body.code;
    if (!code || typeof code !== "string") return NextResponse.json({ error: "code가 필요합니다." }, { status: 400 });

    if (body.action === "merge") {
      // 동기화 코드를 연결하기 전에 이 기기에서 산 것들을 한 번만 반영한다(중복 방지).
      const list = Array.isArray(body.items) ? body.items.slice(0, 50) : [];
      let last: Normalized = { reason: "ok", owned: [], spent: 0 };
      const earned = await earnedFor(code, body.earned);
      for (const it of list) {
        if (!it || typeof it.purchaseId !== "string" || typeof it.itemId !== "string" || !SHOP_BY_ID[it.itemId]) continue;
        last = await runPurchase(code, it.purchaseId, it.itemId, earned, true);
      }
      if (list.length === 0) {
        const raw = await redis.get(shopKey(code));
        const st = (typeof raw === "string" ? JSON.parse(raw) : raw) as { owned?: unknown; spent?: number } | null;
        last = { reason: "ok", owned: Array.isArray(st?.owned) ? (st!.owned as string[]) : [], spent: st?.spent ?? 0 };
      }
      return NextResponse.json({ ok: true, owned: last.owned, spent: last.spent });
    }

    const { purchaseId, itemId } = body;
    if (typeof purchaseId !== "string" || purchaseId.length < 8 || typeof itemId !== "string" || !SHOP_BY_ID[itemId]) {
      return NextResponse.json({ error: "잘못된 구매 요청이에요." }, { status: 400 });
    }
    const earned = await earnedFor(code, body.earned);
    const r = await runPurchase(code, purchaseId, itemId, earned, false);
    return NextResponse.json({
      ok: r.reason === "ok",
      reason: r.reason,
      owned: r.owned,
      spent: r.spent,
      balance: Math.max(0, earned - r.spent),
      replay: !!r.replay,
    });
  } catch (err) {
    console.error(err);
    const message = err instanceof Error ? err.message : "알 수 없는 오류";
    return NextResponse.json({ error: `구매에 실패했어요: ${message}` }, { status: 500 });
  }
}
