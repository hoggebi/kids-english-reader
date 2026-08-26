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

type StoredItem = { id: string };

// id가 같은 항목은 새로 들어온(incoming) 쪽 내용으로 갱신하고,
// 기존에만 있던 항목은 그대로 유지해서 절대 사라지지 않게 합친다.
function mergeById<T extends StoredItem>(existing: T[] = [], incoming: T[] = []): T[] {
  const map = new Map<string, T>();
  for (const item of existing) map.set(item.id, item);
  for (const item of incoming) map.set(item.id, item);
  return Array.from(map.values());
}

function mergeStringArray(existing: string[] = [], incoming: string[] = []): string[] {
  return Array.from(new Set([...existing, ...incoming]));
}

type PetState = { stage: number; generation: number };

function mergePet(existing?: PetState, incoming?: PetState): PetState | undefined {
  if (!existing) return incoming;
  if (!incoming) return existing;
  const rank = (p: PetState) => p.generation * 100 + p.stage;
  return rank(incoming) >= rank(existing) ? incoming : existing;
}

type SyncPayload = {
  chapters?: StoredItem[];
  doneChapterIds?: string[];
  pet?: PetState;
  vocabSets?: StoredItem[];
};

function mergePayload(existing: SyncPayload | null, incoming: SyncPayload): SyncPayload {
  if (!existing) return incoming;
  return {
    chapters: mergeById(existing.chapters, incoming.chapters),
    doneChapterIds: mergeStringArray(existing.doneChapterIds, incoming.doneChapterIds),
    pet: mergePet(existing.pet, incoming.pet),
    vocabSets: mergeById(existing.vocabSets, incoming.vocabSets),
  };
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
    const { code, data } = (await req.json()) as { code: string; data: SyncPayload };
    if (!code || typeof code !== "string") {
      return NextResponse.json({ error: "code가 필요합니다." }, { status: 400 });
    }

    const key = keyFor(code);
    const existing = (await redis.get(key)) as SyncPayload | null;
    const merged = mergePayload(existing, data);

    await redis.set(key, merged);
    return NextResponse.json({
      ok: true,
      receivedVocabSets: data.vocabSets?.length ?? 0,
      existingVocabSetsBeforeMerge: existing?.vocabSets?.length ?? 0,
      finalVocabSetsAfterMerge: merged.vocabSets?.length ?? 0,
    });
  } catch (err) {
    console.error(err);
    const message = err instanceof Error ? err.message : "알 수 없는 오류";
    return NextResponse.json(
      { error: `저장에 실패했습니다: ${message}` },
      { status: 500 }
    );
  }
}
