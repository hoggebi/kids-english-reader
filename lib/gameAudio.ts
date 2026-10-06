"use client";

// 두더지 게임 등에서 쓰는 가벼운 효과음(Web Audio 합성)과 TTS 도우미.
// 오디오/음성이 지원되지 않아도 게임은 그대로 진행되도록 모든 호출을 try/catch로 감싼다.

let sharedCtx: AudioContext | null = null;
function audioCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!sharedCtx) {
    const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    try {
      sharedCtx = new Ctor();
    } catch {
      return null;
    }
  }
  return sharedCtx;
}

export function unlockAudio() {
  try {
    const c = audioCtx();
    if (c && c.state === "suspended") void c.resume();
    const w = new SpeechSynthesisUtterance("");
    w.volume = 0;
    window.speechSynthesis?.speak(w); // iOS: 첫 사용자 조작 안에서 음성 엔진을 깨워 둔다
  } catch {
    /* ignore */
  }
}

export type Sfx = "pop" | "boing" | "plop" | "whoosh" | "evolve" | "swing";

export function playSfx(kind: Sfx, muted: boolean) {
  if (muted) return;
  try {
    const c = audioCtx();
    if (!c) return;
    const now = c.currentTime;
    const tone = (type: OscillatorType, pts: [number, number][], dur: number, vol: number, at = 0) => {
      const osc = c.createOscillator();
      const g = c.createGain();
      osc.type = type;
      osc.connect(g);
      g.connect(c.destination);
      pts.forEach(([t, f], i) => (i === 0 ? osc.frequency.setValueAtTime(f, now + at + t) : osc.frequency.exponentialRampToValueAtTime(f, now + at + t)));
      g.gain.setValueAtTime(vol, now + at);
      g.gain.exponentialRampToValueAtTime(0.001, now + at + dur);
      osc.start(now + at);
      osc.stop(now + at + dur);
    };
    if (kind === "pop") tone("triangle", [[0, 520], [0.09, 180]], 0.14, 0.2); // 뿅!
    else if (kind === "boing") tone("sine", [[0, 240], [0.2, 640]], 0.26, 0.12);
    else if (kind === "plop") tone("sawtooth", [[0, 150], [0.12, 60]], 0.16, 0.08); // 푹
    else if (kind === "whoosh") tone("sine", [[0, 900], [0.2, 300]], 0.22, 0.04);
    else if (kind === "swing") tone("sine", [[0, 300], [0.1, 700]], 0.12, 0.03);
    else {
      [523, 659, 784, 1046].forEach((f, i) => tone("triangle", [[0, f], [0.14, f * 1.02]], 0.2, 0.1, i * 0.09));
    }
  } catch {
    /* ignore */
  }
}

export function cancelSpeech() {
  try {
    window.speechSynthesis?.cancel();
  } catch {
    /* ignore */
  }
}

// 끝나면(또는 실패/미지원/음소거/시간초과 시) resolve. 새 발화는 이전 발화를 취소한다.
export function speak(text: string, lang: "ko-KR" | "en-US", muted: boolean, capMs = 4500): Promise<void> {
  return new Promise((resolve) => {
    if (muted || typeof window === "undefined" || !("speechSynthesis" in window)) {
      resolve();
      return;
    }
    try {
      const synth = window.speechSynthesis;
      synth.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = lang;
      u.rate = lang === "en-US" ? 0.85 : 0.95;
      const voices = synth.getVoices();
      const v =
        voices.find((x) => x.lang.replace("_", "-").toLowerCase() === lang.toLowerCase()) ??
        voices.find((x) => x.lang.toLowerCase().startsWith(lang.slice(0, 2).toLowerCase()));
      if (v) u.voice = v;
      let done = false;
      const fin = () => {
        if (done) return;
        done = true;
        clearTimeout(to);
        resolve();
      };
      const to = setTimeout(fin, capMs);
      u.onend = fin;
      u.onerror = fin;
      synth.speak(u);
    } catch {
      resolve();
    }
  });
}
