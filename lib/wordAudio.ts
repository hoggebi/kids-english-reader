// 단어 발음 녹음(MP3). 지금은 청크북 B1 핵심 단어 79개(voice-pack/b1, ChatGPT gpt-4o-mini-tts · sage)만 있다.
// 파일: public/audio/W_B1_{단어를 소문자로, 영문자 외는 _로}.mp3  (예: "check on" → W_B1_check_on.mp3)
// 같은 철자의 단어면 어느 단어장에서 나와도 이 녹음을 쓴다. 녹음이 없는 단어는 null → 기기 음성으로 읽는다.

import { B1_WORDS } from "./lessonDataB1.ts";

export const wordAudioSlug = (english: string) => english.trim().toLowerCase().replace(/[^a-z]+/g, "_");

const B1_AUDIO = new Set(Object.values(B1_WORDS).flatMap((ws) => ws.map(([en]) => wordAudioSlug(en))));

export function wordAudioUrl(text: string): string | null {
  const slug = wordAudioSlug(text);
  return slug && B1_AUDIO.has(slug) ? `/audio/W_B1_${slug}.mp3` : null;
}
