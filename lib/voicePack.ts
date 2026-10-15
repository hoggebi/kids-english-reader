// Lesson 2~8 본문·대화의 녹음 음성(MP3) 재생. 문장 ID(L{레슨}_{body|dialogue}_{번호})로 연결한다.
// 음성 파일이 없거나 확인·수정한 본문과 문장이 다르면 null을 돌려주고, 호출한 쪽이 기기 음성으로 대신 읽는다.

type Item = { id: string; text: string; audioUrl: string };
export type VoicePack = { items: Map<string, Item>; sentences: Record<string, string[]> };

let packPromise: Promise<VoicePack | null> | null = null;

export function loadVoicePack(): Promise<VoicePack | null> {
  if (!packPromise) {
    packPromise = (async () => {
      try {
        const [m, a] = await Promise.all([
          fetch("/voice-pack/manifest.json").then((r) => (r.ok ? r.json() : Promise.reject(new Error("manifest")))),
          fetch("/voice-pack/audio-map.json").then((r) => (r.ok ? r.json() : Promise.reject(new Error("map")))),
        ]);
        const items = new Map<string, Item>((m.items as Item[]).map((it) => [it.id, it]));
        return { items, sentences: a.sentences as Record<string, string[]> };
      } catch {
        packPromise = null; // 다음에 다시 시도
        return null;
      }
    })();
  }
  return packPromise;
}

const norm = (s: string) => s.replace(/[“”"‘’']/g, "").replace(/\s+/g, " ").trim().toLowerCase();

// ordinal = 같은 구역(본문/대화) 안에서의 0부터 센 순서. 문장 내용이 다르면 null.
export function voiceIdsFor(pack: VoicePack, lesson: number, section: "passage" | "dialogue", ordinal: number, en: string): string[] | null {
  const key = `L${lesson}_${section === "dialogue" ? "dialogue" : "body"}_${String(ordinal + 1).padStart(2, "0")}`;
  const ids = pack.sentences[key];
  if (!ids || ids.length === 0) return null;
  const joined = ids.map((id) => pack.items.get(id)?.text ?? "").join(" ");
  return norm(joined) === norm(en) ? ids : null;
}

let audio: HTMLAudioElement | null = null;
let generation = 0;
let cancelPending: (() => void) | null = null;

export function stopVoice() {
  generation += 1;
  if (cancelPending) cancelPending();
  cancelPending = null;
  if (audio) {
    audio.pause();
    audio.removeAttribute("src");
    audio.load();
  }
}

// 조각을 순서대로 재생한다. 끝까지 들었으면 true, 오류면 false, 중간에 멈추거나 다른 재생이 시작되면 취소되어 resolve하지 않는다.
// 첫 조각의 play()는 사용자 조작 안에서 바로 호출되어야 iPad/Safari에서 재생된다(첫 await 전에 호출).
export function playVoiceIds(pack: VoicePack, ids: string[]): Promise<boolean> {
  stopVoice();
  if (!audio) {
    audio = new Audio();
    audio.preload = "auto";
  }
  const el = audio;
  const token = generation;
  return new Promise<boolean>((resolve) => {
    let i = 0;
    const cleanup = () => {
      el.onended = null;
      el.onerror = null;
    };
    cancelPending = () => cleanup();
    const next = () => {
      if (token !== generation) return;
      if (i >= ids.length) {
        cleanup();
        resolve(true);
        return;
      }
      const it = pack.items.get(ids[i++]);
      if (!it) {
        cleanup();
        resolve(false);
        return;
      }
      el.onended = next;
      el.onerror = () => {
        if (token !== generation) return;
        cleanup();
        resolve(false);
      };
      el.src = it.audioUrl;
      el.playbackRate = 1; // 목소리와 속도가 이미 녹음에 들어 있다
      el.play().catch(() => {
        if (token !== generation) return;
        cleanup();
        resolve(false);
      });
    };
    next();
  });
}
