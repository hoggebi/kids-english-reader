import { NextRequest, NextResponse } from "next/server";
import { Redis } from "@upstash/redis";

const redis = Redis.fromEnv();

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
    return NextResponse.json({ error: "불러오기에 실패했습니다." }, { status: 500 });
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
    return NextResponse.json({ error: "저장에 실패했습니다." }, { status: 500 });
  }
}
