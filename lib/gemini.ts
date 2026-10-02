import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import type { GenerateContentParameters } from "@google/genai";

let client: GoogleGenAI | null = null;

export function getGeminiClient() {
  if (!client) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error(
        "GEMINI_API_KEY가 설정되지 않았습니다. .env.local 파일에 GEMINI_API_KEY=... 를 추가하세요."
      );
    }
    client = new GoogleGenAI({ apiKey });
  }
  return client;
}

export const GEMINI_MODEL = "gemini-3.6-flash";

// 과부하(503) 등 일시 오류에 대비해 재시도하고, 계속 실패하면 다음 모델로 넘어간다.
const FALLBACK_MODELS = [GEMINI_MODEL, "gemini-3.5-flash", "gemini-2.5-flash"];

function isRetryable(err: unknown) {
  const msg = err instanceof Error ? err.message : String(err);
  return /\b(429|500|503|504)\b|UNAVAILABLE|overloaded|high demand/i.test(msg);
}

export async function generateWithFallback(params: Omit<GenerateContentParameters, "model">) {
  const ai = getGeminiClient();
  let lastErr: unknown;
  for (const model of FALLBACK_MODELS) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const config = model.startsWith("gemini-3")
          ? { ...params.config, thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL } }
          : params.config;
        return await ai.models.generateContent({ ...params, model, config });
      } catch (err) {
        lastErr = err;
        if (!isRetryable(err)) {
          // 모델이 없거나 지원하지 않는 경우(404 등)는 다음 모델로, 그 외 오류는 바로 던진다.
          if (/\b404\b|NOT_FOUND/i.test(err instanceof Error ? err.message : String(err))) break;
          throw err;
        }
        await new Promise((r) => setTimeout(r, 800));
      }
    }
  }
  throw lastErr;
}
