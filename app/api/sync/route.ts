import { NextRequest, NextResponse } from "next/server";
import { Redis } from "@upstash/redis";

// Vercel에 등록된 환경변수 이름(KV_REST_API_URL / KV_REST_API_TOKEN)을 직접 사용한다.
// Redis.fromEnv()는 UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN 이름을 찾기 때문에
// 이름이 다르면 연결이 되지 않는다.
const redis = new Redis({
  url: process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL ?? "",
  token: process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN ?? "",
});

function keyFor(code: string) {
  return `sync:${code}`;
}

export async function GET(req: NextRequest) {
  try {
    const code = req.nextUrl.searchParams.get("code");
    if (!code) {
      return NextResponse.json({ error: "code가 필요합니다." }, { status: 400 });
    }
    const data = await redis.get(keyFor(code));
    return NextResponse.json({ data: data ?? null });
  } catch (err) {
    console.error(err);
    const message = err instanceof Error ? err.message : "알 수 없는 오류";
    return NextResponse.json(
      { error: `불러오기에 실패했습니다: ${message}` },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const { code, data } = await req.json();
    if (!code || typeof code !== "string") {
      return NextResponse.json({ error: "code가 필요합니다." }, { status: 400 });
    }
    await redis.set(keyFor(code), data);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(err);
    const message = err instanceof Error ? err.message : "알 수 없는 오류";
    return NextResponse.json(
      { error: `저장에 실패했습니다: ${message}` },
      { status: 500 }
    );
  }
}
