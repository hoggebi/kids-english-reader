"use client";

import { useEffect, useRef, useState } from "react";
import { scorePronunciation } from "@/lib/pronunciation";

const NORMAL_RATE = 1;
const SLOW_RATE = 0.6;

// 무음이 이만큼 이어지면 다 읽은 것으로 보고 자동 종료
const SILENCE_MS = 900;
const MAX_MS = 15000;
const SILENCE_THRESHOLD = 0.015;

type Attempt = { heard: string; score: number };

export default function ReadingPractice({ sentences }: { sentences: string[] }) {
  const [index, setIndex] = useState(0);
  const [attempts, setAttempts] = useState<Record<number, Attempt>>({});
  const [recording, setRecording] = useState(false);
  const [checking, setChecking] = useState(false);
  const [slowMode, setSlowMode] = useState(false);
  const [playingAll, setPlayingAll] = useState(false);
  const [playingIndex, setPlayingIndex] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [roundsDone, setRoundsDone] = useState(0);
  const [showRoundBanner, setShowRoundBanner] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number | null>(null);
  const passageRef = useRef<HTMLDivElement | null>(null);
  const indexRef = useRef(index);
  const autoContinueRef = useRef(false);

  useEffect(() => {
    indexRef.current = index;
  }, [index]);

  const sentence = sentences[index];
  const busy = recording || checking;
  const pageDone = sentences.every((_, i) => attempts[i] !== undefined);

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
    speak(sentence, slowMode ? SLOW_RATE : NORMAL_RATE);
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

  async function startListening() {
    setError(null);
    audioChunksRef.current = [];

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setError("마이크를 사용할 수 없어요. 브라우저 마이크 권한을 켜주세요.");
      autoContinueRef.current = false;
      return;
    }

    streamRef.current = stream;
    const recorder = new MediaRecorder(stream);
    mediaRecorderRef.current = recorder;

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) audioChunksRef.current.push(e.data);
    };

    recorder.onstop = async () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      audioCtxRef.current?.close().catch(() => {});
      audioCtxRef.current = null;

      const blob = new Blob(audioChunksRef.current, {
        type: recorder.mimeType || "audio/webm",
      });

      if (blob.size === 0) {
        setError("녹음된 소리가 없어요. 마이크를 확인하고 다시 시도해주세요.");
        setChecking(false);
        autoContinueRef.current = false;
        return;
      }
      await transcribe(blob);
    };

    recorder.start();
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
        finishListening();
        return;
      }
      rafRef.current = requestAnimationFrame(tick);
    }

    rafRef.current = requestAnimationFrame(tick);
  }

  function finishListening() {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      setRecording(false);
      setChecking(true);
      recorder.stop();
    }
  }

  async function transcribe(blob: Blob) {
    const targetIndex = indexRef.current;
    const targetSentence = sentences[targetIndex];
    try {
      const base64: string = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string).split(",")[1]);
        reader.onerror = () => reject(new Error("녹음 파일을 읽지 못했어요."));
        reader.readAsDataURL(blob);
      });

      const res = await fetch("/api/stt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          audioBase64: base64,
          mimeType: blob.type || "audio/webm",
          expected: targetSentence,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "목소리를 인식하지 못했어요.");

      const heard = (data.transcript ?? "").trim();
      if (!heard) {
        setError("목소리가 들리지 않았어요. 조금 더 크게 읽어주세요.");
        setChecking(false);
        autoContinueRef.current = false;
        return;
      }

      const score = scorePronunciation(targetSentence, heard);
      setAttempts((prev) => ({ ...prev, [targetIndex]: { heard, score } }));
      setError(null);
      setChecking(false);

      // 한 문장 끝나면 바로 다음 문장으로 이어서 읽기
      const nextIndex = targetIndex + 1;
      if (nextIndex < sentences.length) {
        goToSentence(nextIndex);
        if (autoContinueRef.current) {
          setTimeout(() => {
            if (autoContinueRef.current) startListening();
          }, 500);
        }
      } else {
        autoContinueRef.current = false;
        setRoundsDone((r) => r + 1);
        setShowRoundBanner(true);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "알 수 없는 오류가 발생했어요.");
      setChecking(false);
      autoContinueRef.current = false;
    }
  }

  function startFromCurrent() {
    autoContinueRef.current = true;
    startListening();
  }

  function stopAuto() {
    autoContinueRef.current = false;
    finishListening();
  }

  function restartRound() {
    setAttempts({});
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
          <div className="bg-green-600 text-white font-title text-xl font-extrabold px-6 py-2 rounded-full shadow-lg animate-bounce">
            🎉 {roundsDone}번째 완독!
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-500">
          문장 {index + 1} / {sentences.length}
        </span>
        <div className="flex items-baseline gap-1 bg-green-50 rounded-full px-4 py-1">
          <span className="font-title text-2xl font-extrabold text-green-700">{roundsDone}</span>
          <span className="text-sm text-green-600 font-bold">번 읽음</span>
        </div>
      </div>

      {/* 읽는 중인 문장은 분홍색, 다 읽은 문장은 초록색 */}
      <div
        ref={passageRef}
        className="rounded-2xl bg-gray-50 p-5 max-h-72 overflow-y-auto leading-relaxed text-lg"
      >
        {sentences.map((s, i) => {
          const attempt = attempts[i];
          const isCurrent = i === index;
          const isPlayingNow = i === playingIndex;

          let colorClass = "text-gray-400";
          if (isPlayingNow) colorClass = "text-indigo-600 font-bold";
          else if (isCurrent && recording) colorClass = "text-pink-500 font-bold";
          else if (isCurrent && checking) colorClass = "text-yellow-600 font-bold";
          else if (isCurrent) colorClass = "text-gray-800 font-bold underline decoration-pink-300";
          else if (attempt) colorClass = "text-green-600";

          return (
            <span
              key={i}
              data-sentence-idx={i}
              onClick={() => !playingAll && !busy && goToSentence(i)}
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
        🐢 느리게 읽기
      </label>

      <div className="flex gap-2">
        <button
          onClick={speakSentence}
          disabled={playingAll || busy}
          className="flex-1 py-3 rounded-full bg-blue-500 text-white font-bold active:scale-95 transition disabled:opacity-50"
        >
          🔊 이 문장 듣기
        </button>
        <button
          onClick={playingAll ? stopAll : speakAll}
          disabled={busy}
          className="flex-1 py-3 rounded-full bg-indigo-500 text-white font-bold active:scale-95 transition disabled:opacity-50"
        >
          {playingAll ? "⏹ 멈추기" : "▶ 전체 듣기"}
        </button>
      </div>

      <button
        onClick={busy ? stopAuto : startFromCurrent}
        disabled={playingAll || (pageDone && !busy)}
        className={`w-full py-4 rounded-full text-white font-title text-xl font-extrabold disabled:opacity-50 active:scale-95 transition ${
          recording ? "bg-red-500 animate-pulse" : checking ? "bg-yellow-500" : "bg-pink-500"
        }`}
      >
        {checking
          ? "🧐 확인하는 중..."
          : recording
          ? "🎤 듣고 있어요... (눌러서 멈추기)"
          : pageDone
          ? "✅ 이 페이지 다 읽었어요!"
          : "🎤 따라 읽기 시작"}
      </button>

      {recording && (
        <p className="text-center text-sm text-pink-500 font-bold">
          분홍색 문장을 읽어주세요. 다 읽고 잠깐 멈추면 다음 문장으로 넘어가요.
        </p>
      )}

      {pageDone && !busy && (
        <div className="rounded-2xl bg-green-50 border-2 border-green-300 p-4 flex flex-col items-center gap-3">
          <p className="font-title text-lg font-bold text-green-700">
            🎉 이 페이지를 {roundsDone}번 읽었어요!
          </p>
          <button
            onClick={restartRound}
            className="w-full py-3 rounded-full bg-green-600 text-white font-bold active:scale-95 transition"
          >
            🔁 한 번 더 읽기
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

      <div className="flex flex-col gap-2">
        {sentences.map((s, i) => {
          const a = attempts[i];
          if (!a) return null;
          return (
            <div
              key={i}
              className="flex items-center justify-between rounded-xl bg-gray-50 px-4 py-2 text-sm"
            >
              <span className="truncate mr-2">
                {i + 1}. &quot;{a.heard}&quot;
              </span>
              <span
                className={
                  a.score >= 80
                    ? "text-green-600 font-bold shrink-0"
                    : a.score >= 50
                    ? "text-yellow-600 font-bold shrink-0"
                    : "text-red-500 font-bold shrink-0"
                }
              >
                {a.score}점
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
