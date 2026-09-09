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

export async function GET(req: NextRequest) {
  try {
    const code = req.nextUrl.searchParams.get("code");
    if (!code) {
      return NextResponse.json(
        { error: "code가 필요합니다." },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }
    const data = await redis.get(keyFor(code));
    return NextResponse.json(
      { data: data ?? null },
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

// 서버가 유일한 정답: 들어온 값을 그대로 저장한다 (병합하지 않음, 마지막에 저장한 기기 값이 곧 정답).
export async function POST(req: NextRequest) {
  try {
    const { code, data } = (await req.json()) as { code: string; data: unknown };
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
