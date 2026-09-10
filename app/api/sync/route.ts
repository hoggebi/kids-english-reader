import { NextRequest, NextResponse } from "next/server";
import { Redis } from "@upstash/redis";

// Vercel에 등록된 환경변수 이름(KV_REST_API_URL / KV_REST_API_TOKEN)을 직접 사용한다.
const redis = new Redis({
  url: process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL ?? "",
  token: process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN ?? "",
});

function keyFor(code: string) {
  return `sync:${code}`;
}

export const dynamic = "force-dynamic";
export const revalidate = 0;

// 저장 형식: { payload, rev }. rev가 없는 예전 형식(마이그레이션 이전 데이터)도 읽을 수 있어야 한다.
type StoredRecord = { payload: unknown; rev: number };

function readStored(raw: unknown): StoredRecord {
  if (raw && typeof raw === "object" && "rev" in raw && "payload" in raw) {
    const rec = raw as { payload: unknown; rev: unknown };
    return { payload: rec.payload, rev: typeof rec.rev === "number" ? rec.rev : 0 };
  }
  // 예전 형식: rev 없이 payload가 통째로 저장돼 있었음
  return { payload: raw ?? null, rev: 0 };
}

export async function GET(req: NextRequest) {
  try {
    const code = req.nextUrl.searchParams.get("code");
    if (!code) {
      return NextResponse.json(
        { error: "code가 필요합니다." },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }
    const raw = await redis.get(keyFor(code));
    const { payload, rev } = readStored(raw);
    return NextResponse.json(
      { data: payload, rev },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    console.error(err);
    const message = err instanceof Error ? err.message : "알 수 없는 오류";
    return NextResponse.json(
      { error: `불러오기에 실패했습니다: ${message}` },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}

// 서버가 유일한 정답이지만, "내가 마지막으로 받아본 버전(baseRev)보다 서버가 이미 더 앞서 있으면"
// 덮어쓰지 않는다 — 다른 기기가 이미 더 최신 정보를 올려둔 상태에서, 오래된(예: 받아오기 실패 후
// 그대로 있던) 내 기기 값으로 그걸 지워버리는 사고를 막기 위한 최소한의 안전장치.
export async function POST(req: NextRequest) {
  try {
    const { code, data, baseRev } = (await req.json()) as {
      code: string;
      data: unknown;
      baseRev?: number;
    };
    if (!code || typeof code !== "string") {
      return NextResponse.json({ error: "code가 필요합니다." }, { status: 400 });
    }

    const raw = await redis.get(keyFor(code));
    const current = readStored(raw);

    if (typeof baseRev === "number" && baseRev < current.rev) {
      return NextResponse.json(
        { ok: false, conflict: true, data: current.payload, rev: current.rev },
        { status: 409 }
      );
    }

    const nextRev = current.rev + 1;
    await redis.set(keyFor(code), { payload: data, rev: nextRev });
    return NextResponse.json({ ok: true, rev: nextRev });
  } catch (err) {
    console.error(err);
    const message = err instanceof Error ? err.message : "알 수 없는 오류";
    return NextResponse.json(
      { error: `저장에 실패했습니다: ${message}` },
      { status: 500 }
    );
  }
}
