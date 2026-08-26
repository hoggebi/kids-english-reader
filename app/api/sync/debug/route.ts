import { NextResponse } from "next/server";
import { Redis } from "@upstash/redis";

// 이 주소로 접속하면 Redis 연결 상태를 눈으로 바로 확인할 수 있다.
// 예: https://kids-english-reader-opal.vercel.app/api/sync/debug
export async function GET() {
  const url = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL ?? "";
  const token = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN ?? "";

  const report: Record<string, unknown> = {
    "환경변수 URL 있음": url ? "예" : "아니오",
    "환경변수 TOKEN 있음": token ? "예" : "아니오",
    "URL 앞부분": url ? url.slice(0, 30) + "..." : "(없음)",
  };

  if (!url || !token) {
    report["결과"] = "실패: 환경변수가 없습니다.";
    return NextResponse.json(report);
  }

  try {
    const redis = new Redis({ url, token });
    const testKey = "sync:__debug_test__";
    await redis.set(testKey, { hello: "world", time: Date.now() });
    const readBack = await redis.get(testKey);
    report["쓰기/읽기 테스트"] = readBack ? "성공" : "실패(읽은 값 없음)";
    report["읽어온 값"] = readBack;
    report["결과"] = "성공: Redis 연결이 정상입니다.";
  } catch (err) {
    report["결과"] = "실패: Redis 연결 오류";
    report["오류내용"] = err instanceof Error ? err.message : String(err);
  }

  return NextResponse.json(report);
}
