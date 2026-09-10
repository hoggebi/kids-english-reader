"use client";

// 몬스터 배틀 전용 효과음 + 배경음. 외부 음원 파일 없이 Web Audio API로 직접 합성한다
// (라이선스 문제 없이, 추가 파일 다운로드 없이 바로 재생 가능).

let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const Ctor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
  }
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
}

function tone(
  c: AudioContext,
  freq: number,
  start: number,
  dur: number,
  opts: { type?: OscillatorType; gain?: number; sweepTo?: number } = {}
) {
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = opts.type ?? "square";
  osc.frequency.setValueAtTime(freq, start);
  if (opts.sweepTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, opts.sweepTo), start + dur);
  const peak = opts.gain ?? 0.16;
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(peak, start + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  osc.connect(gain);
  gain.connect(c.destination);
  osc.start(start);
  osc.stop(start + dur + 0.03);
}

function noiseHit(c: AudioContext, start: number, dur: number, gainPeak = 0.18) {
  const bufferSize = Math.floor(c.sampleRate * dur);
  const buffer = c.createBuffer(1, bufferSize, c.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
  const src = c.createBufferSource();
  src.buffer = buffer;
  const gain = c.createGain();
  gain.gain.setValueAtTime(gainPeak, start);
  gain.gain.exponentialRampToValueAtTime(0.001, start + dur);
  const filter = c.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(1800, start);
  src.connect(filter);
  filter.connect(gain);
  gain.connect(c.destination);
  src.start(start);
  src.stop(start + dur + 0.02);
}

export function sfxSlash() {
  const c = getCtx();
  if (!c) return;
  const t = c.currentTime;
  tone(c, 900, t, 0.12, { type: "sawtooth", sweepTo: 220, gain: 0.14 });
  noiseHit(c, t, 0.1, 0.12);
}

export function sfxHitBig() {
  const c = getCtx();
  if (!c) return;
  const t = c.currentTime;
  tone(c, 260, t, 0.18, { type: "square", sweepTo: 80, gain: 0.2 });
  noiseHit(c, t, 0.16, 0.18);
}

export function sfxWrong() {
  const c = getCtx();
  if (!c) return;
  const t = c.currentTime;
  tone(c, 220, t, 0.22, { type: "sawtooth", sweepTo: 90, gain: 0.15 });
}

export function sfxJoin() {
  const c = getCtx();
  if (!c) return;
  const t = c.currentTime;
  tone(c, 523.25, t, 0.12, { type: "triangle", gain: 0.16 });
  tone(c, 659.25, t + 0.1, 0.12, { type: "triangle", gain: 0.16 });
  tone(c, 783.99, t + 0.2, 0.18, { type: "triangle", gain: 0.18 });
}

export function sfxTeamAttack() {
  const c = getCtx();
  if (!c) return;
  const t = c.currentTime;
  [0, 0.06, 0.12].forEach((d, i) => {
    tone(c, 700 - i * 120, t + d, 0.18, { type: "sawtooth", sweepTo: 150, gain: 0.16 });
    noiseHit(c, t + d, 0.14, 0.14);
  });
}

export function sfxWarning() {
  const c = getCtx();
  if (!c) return;
  const t = c.currentTime;
  tone(c, 140, t, 0.5, { type: "square", gain: 0.13 });
  tone(c, 140, t + 0.55, 0.5, { type: "square", gain: 0.13 });
}

export function sfxKO() {
  const c = getCtx();
  if (!c) return;
  const t = c.currentTime;
  tone(c, 300, t, 0.35, { type: "square", sweepTo: 40, gain: 0.2 });
  noiseHit(c, t, 0.3, 0.2);
}

export function sfxVictory() {
  const c = getCtx();
  if (!c) return;
  const t = c.currentTime;
  [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
    tone(c, f, t + i * 0.13, 0.22, { type: "triangle", gain: 0.18 });
  });
}

// ---------- 배경음: 짧은 리프를 계속 반복하는 8비트 스타일 전투 BGM ----------
// 파일 없이 직접 시퀀싱 — 베이스(사각파) + 리드(삼각파) 2트랙, 마이너 조성으로 긴장감 있게.
const BGM_BPM = 150;
const STEP = 60 / BGM_BPM / 2; // 8분음표 길이(초)
const BASS_PATTERN = [110, 110, 130.81, 110, 146.83, 110, 130.81, 98];
const LEAD_PATTERN = [440, 0, 523.25, 440, 587.33, 523.25, 440, 0, 493.88, 0, 587.33, 493.88, 659.25, 587.33, 493.88, 0];

let bgmEnabled = false;
let bgmSchedulerId: ReturnType<typeof setTimeout> | null = null;
let bgmNextStepTime = 0;
let bgmStepIndex = 0;

function scheduleBgmStep(c: AudioContext) {
  const lookahead = 0.2;
  while (bgmNextStepTime < c.currentTime + lookahead) {
    const bass = BASS_PATTERN[bgmStepIndex % BASS_PATTERN.length];
    tone(c, bass, bgmNextStepTime, STEP * 0.9, { type: "square", gain: 0.05 });
    const leadIdx = bgmStepIndex % LEAD_PATTERN.length;
    const lead = LEAD_PATTERN[leadIdx];
    if (lead > 0) tone(c, lead, bgmNextStepTime, STEP * 0.45, { type: "triangle", gain: 0.05 });
    bgmNextStepTime += STEP;
    bgmStepIndex++;
  }
  bgmSchedulerId = setTimeout(() => {
    if (bgmEnabled) scheduleBgmStep(c);
  }, 60);
}

export function startBgm() {
  if (bgmEnabled) return;
  const c = getCtx();
  if (!c) return;
  bgmEnabled = true;
  bgmStepIndex = 0;
  bgmNextStepTime = c.currentTime + 0.05;
  scheduleBgmStep(c);
}

export function stopBgm() {
  bgmEnabled = false;
  if (bgmSchedulerId) clearTimeout(bgmSchedulerId);
  bgmSchedulerId = null;
}

export function isBgmEnabled() {
  return bgmEnabled;
}

const BGM_PREF_KEY = "little-reader-battle-bgm";

export function getBgmPref(): boolean {
  if (typeof window === "undefined") return true;
  const raw = localStorage.getItem(BGM_PREF_KEY);
  return raw === null ? true : raw === "on";
}

export function setBgmPref(on: boolean) {
  if (typeof window === "undefined") return;
  localStorage.setItem(BGM_PREF_KEY, on ? "on" : "off");
}
