"use client";

import { useEffect, useRef, useState } from "react";

const NORMAL_RATE = 1;
const SLOW_RATE = 0.6;

// 무음이 이만큼 이어지면 다 읽은 것으로 보고 자동 종료
const SILENCE_MS = 900;
const MAX_MS = 15000;
const SILENCE_THRESHOLD = 0.015;

export default function ReadingPractice({ sentences }: { sentences: string[] }) {
  const [index, setIndex] = useState(0);
  const [readSet, setReadSet] = useState<Record<number, true>>({});
  const [recording, setRecording] = useState(false);
  const [slowMode, setSlowMode] = useState(false);
  const [playingAll, setPlayingAll] = useState(false);
  const [playingIndex, setPlayingIndex] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [roundsDone, setRoundsDone] = useState(0);
  const [showRoundBanner, setShowRoundBanner] = useState(false);

  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number | null>(null);
  const passageRef = useRef<HTMLDivElement | null>(null);
  const indexRef = useRef(index);
  const autoContinueRef = useRef(false);

  useEffect(() => {
    indexRef.current = index;
  }, [index]);

  const pageDone = sentences.every((_, i) => readSet[i]);

  useEffect(() => {
    return () => {
      autoContinueRef.current = false;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      audioCtxRef.current?.close().catch(() => {});
    };
  }, []);

  useEffect(() => {
    if (!showRoundBanner) return;
    const t = setTimeout(() => setShowRoundBanner(false), 2500);
    return () => clearTimeout(t);
  }, [showRoundBanner]);

  function speak(text: string, rate: number, onEnd?: () => void) {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = "en-US";
    utter.rate = rate;
    if (onEnd) utter.onend = onEnd;
    window.speechSynthesis.speak(utter);
  }

  function speakSentence() {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    speak(sentences[index], slowMode ? SLOW_RATE : NORMAL_RATE);
  }

  function speakAll() {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    setPlayingAll(true);
    const rate = slowMode ? SLOW_RATE : NORMAL_RATE;

    function playFrom(i: number) {
      if (i >= sentences.length) {
        setPlayingAll(false);
        setPlayingIndex(null);
        return;
      }
      setPlayingIndex(i);
      speak(sentences[i], rate, () => playFrom(i + 1));
    }

    playFrom(0);
  }

  function stopAll() {
    window.speechSynthesis?.cancel();
    setPlayingAll(false);
    setPlayingIndex(null);
  }

  // AI 호출 없이, 마이크 소리 크기만 감시해서 "읽었는지"만 확인
  async function startListening() {
    setError(null);

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setError("마이크를 사용할 수 없어요. 브라우저 마이크 권한을 켜주세요.");
      autoContinueRef.current = false;
      return;
    }

    streamRef.current = stream;
    setRecording(true);

    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const audioCtx = new AudioCtx();
    audioCtxRef.current = audioCtx;
    const source = audioCtx.createMediaStreamSource(stream);
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 2048;
    source.connect(analyser);
    const buffer = new Float32Array(analyser.fftSize);

    const startedAt = Date.now();
    let lastSoundAt = Date.now();
    let heardAnySound = false;

    function finish() {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      audioCtxRef.current?.close().catch(() => {});
      audioCtxRef.current = null;
      setRecording(false);

      const targetIndex = indexRef.current;

      if (!heardAnySound) {
        setError("목소리가 안 들렸어요. 조금 더 크게 읽어주세요.");
        autoContinueRef.current = false;
        return;
      }

      setReadSet((prev) => ({ ...prev, [targetIndex]: true }));

      const nextIndex = targetIndex + 1;
      if (nextIndex < sentences.length) {
        goToSentence(nextIndex);
        if (autoContinueRef.current) {
          setTimeout(() => {
            if (autoContinueRef.current) startListening();
          }, 400);
        }
      } else {
        autoContinueRef.current = false;
        setRoundsDone((r) => r + 1);
        setShowRoundBanner(true);
      }
    }

    function tick() {
      analyser.getFloatTimeDomainData(buffer);
      let sum = 0;
      for (let i = 0; i < buffer.length; i++) sum += buffer[i] * buffer[i];
      const rms = Math.sqrt(sum / buffer.length);

      const now = Date.now();
      if (rms > SILENCE_THRESHOLD) {
        lastSoundAt = now;
        heardAnySound = true;
      }

      if ((heardAnySound && now - lastSoundAt > SILENCE_MS) || now - startedAt > MAX_MS) {
        finish();
        return;
      }
      rafRef.current = requestAnimationFrame(tick);
    }

    rafRef.current = requestAnimationFrame(tick);
  }

  function startFromCurrent() {
    autoContinueRef.current = true;
    startListening();
  }

  function stopAuto() {
    autoContinueRef.current = false;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    audioCtxRef.current?.close().catch(() => {});
    audioCtxRef.current = null;
    setRecording(false);
  }

  function restartRound() {
    setReadSet({});
    setIndex(0);
    setError(null);
    setShowRoundBanner(false);
  }

  function goToSentence(i: number) {
    setIndex(i);
    const el = passageRef.current?.querySelector(`[data-sentence-idx="${i}"]`);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  return (
    <div className="w-full max-w-md flex flex-col gap-4 relative">
      {showRoundBanner && (
        <div className="absolute inset-x-0 -top-2 flex justify-center z-10 pointer-events-none">
          <div className="bg-sky-600 text-white text-xl font-bold px-6 py-2 rounded-full shadow-lg animate-bounce">
            {roundsDone}번째 완독!
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-500">
          문장 {index + 1} / {sentences.length}
        </span>
        <div className="flex items-baseline gap-1 bg-gray-100 rounded-full px-4 py-1">
          <span className="text-2xl font-extrabold text-sky-700">{roundsDone}</span>
          <span className="text-sm text-sky-600 font-bold">번 읽음</span>
        </div>
      </div>

      <p className="text-center text-sm text-gray-500">
        이 문장을 3번 따라 읽어보세요.
      </p>

      <p className="text-center text-sm text-gray-500 font-bold">
        한 문장을 3번씩 따라 읽어보세요.
      </p>

      <div
        ref={passageRef}
        className="rounded-2xl bg-gray-50 p-5 max-h-72 overflow-y-auto leading-relaxed text-lg"
      >
        {sentences.map((s, i) => {
          const isCurrent = i === index;
          const isPlayingNow = i === playingIndex;

          let colorClass = "text-gray-400";
          if (isPlayingNow) colorClass = "text-sky-600 font-bold";
          else if (isCurrent && recording) colorClass = "text-sky-500 font-bold";
          else if (isCurrent) colorClass = "text-gray-800 font-bold underline decoration-gray-300";
          else if (readSet[i]) colorClass = "text-gray-500";

          return (
            <span
              key={i}
              data-sentence-idx={i}
              onClick={() => !playingAll && !recording && goToSentence(i)}
              className={`cursor-pointer transition-colors duration-200 rounded px-0.5 ${colorClass}`}
            >
              {s}{" "}
            </span>
          );
        })}
      </div>

      <label className="flex items-center gap-2 text-sm text-gray-500 justify-center">
        <input
          type="checkbox"
          checked={slowMode}
          onChange={(e) => setSlowMode(e.target.checked)}
        />
        느리게 읽기
      </label>

      <div className="flex gap-2">
        <button
          onClick={speakSentence}
          disabled={playingAll || recording}
          className="flex-1 py-3 rounded-full bg-gray-700 text-white font-bold active:scale-95 transition disabled:opacity-50"
        >
          이 문장 듣기
        </button>
        <button
          onClick={playingAll ? stopAll : speakAll}
          disabled={recording}
          className="flex-1 py-3 rounded-full bg-gray-500 text-white font-bold active:scale-95 transition disabled:opacity-50"
        >
          {playingAll ? "멈추기" : "전체 듣기"}
        </button>
      </div>

      <button
        onClick={recording ? stopAuto : startFromCurrent}
        disabled={playingAll || (pageDone && !recording)}
        className={`w-full py-4 rounded-full text-white text-xl font-bold disabled:opacity-50 active:scale-95 transition ${
          recording ? "bg-sky-700 animate-pulse" : "bg-sky-600"
        }`}
      >
        {recording
          ? "듣고 있어요... (눌러서 멈추기)"
          : pageDone
          ? "이 페이지 다 읽었어요"
          : "따라 읽기 시작"}
      </button>

      {recording && (
        <p className="text-center text-sm text-sky-600 font-bold">
          하이라이트된 문장을 읽어주세요. 다 읽고 잠깐 멈추면 다음 문장으로 넘어가요.
        </p>
      )}

      {pageDone && !recording && (
        <div className="rounded-2xl bg-gray-50 border-2 border-gray-200 p-4 flex flex-col items-center gap-3">
          <p className="text-lg font-bold text-gray-800">
            이 페이지를 {roundsDone}번 읽었어요
          </p>
          <button
            onClick={restartRound}
            className="w-full py-3 rounded-full bg-sky-600 text-white font-bold active:scale-95 transition"
          >
            한 번 더 읽기
          </button>
        </div>
      )}

      {error && (
        <div className="rounded-2xl bg-red-50 border-2 border-red-300 p-4 flex items-start justify-between gap-3">
          <p className="text-red-600 font-bold text-base leading-snug">{error}</p>
          <button
            onClick={() => setError(null)}
            className="text-red-400 font-bold text-lg leading-none px-1"
            aria-label="닫기"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}
