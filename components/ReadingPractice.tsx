"use client";

import { useEffect, useRef, useState } from "react";

const NORMAL_RATE = 0.6;
const SLOW_RATE = 0.4;
const REQUIRED_PAGE_ROUNDS = 3;

// 무음이 이만큼 이어지면 다 읽은 것으로 보고 자동 종료
const SILENCE_MS = 900;
const MAX_MS = 15000;
const SILENCE_THRESHOLD = 0.015;

export default function ReadingPractice({
  sentences,
  onNextPage,
  hasNextPage,
  onGoToQuiz,
}: {
  sentences: string[];
  onNextPage?: () => void;
  hasNextPage?: boolean;
  onGoToQuiz?: () => void;
}) {
  const [index, setIndex] = useState(0);
  const [readSet, setReadSet] = useState<Record<number, true>>({});
  const [recording, setRecording] = useState(false);
  const [slowMode, setSlowMode] = useState(false);
  const [playingAll, setPlayingAll] = useState(false);
  const [playingIndex, setPlayingIndex] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [roundsDone, setRoundsDone] = useState(0);
  const [showRoundBanner, setShowRoundBanner] = useState(false);
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [pausedForListen, setPausedForListen] = useState(false);

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
      window.speechSynthesis?.cancel();
    };
  }, []);

  useEffect(() => {
    if (!showRoundBanner) return;
    const t = setTimeout(() => setShowRoundBanner(false), 2500);
    return () => clearTimeout(t);
  }, [showRoundBanner]);

  function minDurationFor(sentence: string) {
    const wordCount = sentence.trim().split(/\s+/).filter(Boolean).length;
    // 문장이 길수록 최소 녹음 시간을 늘려서, 중간에 숨 쉬려고 잠깐 멈춘 걸
    // "다 읽었다"고 착각하지 않게 함
    return Math.max(1500, wordCount * 380);
  }

  function pauseRecordingForListen() {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    audioCtxRef.current?.close().catch(() => {});
    audioCtxRef.current = null;
    setRecording(false);
    setPausedForListen(true);
  }

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
    const wasRecording = recording;
    if (wasRecording) pauseRecordingForListen();
    speak(sentences[index], slowMode ? SLOW_RATE : NORMAL_RATE, () => {
      if (wasRecording) {
        setPausedForListen(false);
        startListening();
      }
    });
  }

  function speakAll() {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const wasRecording = recording;
    if (wasRecording) pauseRecordingForListen();
    setPlayingAll(true);
    const rate = slowMode ? SLOW_RATE : NORMAL_RATE;

    function playFrom(i: number) {
      if (i >= sentences.length) {
        setPlayingAll(false);
        setPlayingIndex(null);
        if (wasRecording) {
          setPausedForListen(false);
          startListening();
        }
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
    const minDuration = minDurationFor(sentences[indexRef.current] ?? "");
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
        setRoundsDone((r) => {
          const next = r + 1;
          if (next >= REQUIRED_PAGE_ROUNDS) {
            setShowCompleteModal(true);
          } else {
            setShowRoundBanner(true);
          }
          return next;
        });
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

      const elapsed = now - startedAt;
      const silentEnough = heardAnySound && now - lastSoundAt > SILENCE_MS;

      if ((silentEnough && elapsed >= minDuration) || elapsed > MAX_MS) {
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
    setPausedForListen(false);
  }

  function restartRound() {
    setReadSet({});
    setIndex(0);
    setError(null);
    setShowRoundBanner(false);
    setShowCompleteModal(false);
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
            {roundsDone}번 읽기 완료!
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-500">
          문장 {index + 1} / {sentences.length}
        </span>
      </div>

      <div className="flex flex-col items-center gap-1">
        <p className="text-center text-lg text-gray-700 font-bold">
          이 페이지를 3번 읽어보세요.
        </p>
        <p className="text-sky-600 font-bold text-sm">{roundsDone}번 읽음</p>
      </div>

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
          disabled={playingAll || pausedForListen}
          className="flex-1 py-3 rounded-full bg-gray-700 text-white font-bold active:scale-95 transition disabled:opacity-50"
        >
          이 문장 듣기
        </button>
        <button
          onClick={playingAll ? stopAll : speakAll}
          disabled={pausedForListen}
          className="flex-1 py-3 rounded-full bg-gray-500 text-white font-bold active:scale-95 transition disabled:opacity-50"
        >
          {playingAll ? "멈추기" : "전체 듣기"}
        </button>
      </div>

      <button
        onClick={recording ? stopAuto : startFromCurrent}
        disabled={playingAll || pausedForListen || (pageDone && !recording)}
        className={`w-full py-4 rounded-full text-white text-xl font-bold disabled:opacity-50 active:scale-95 transition ${
          recording ? "bg-sky-700 animate-pulse" : "bg-sky-600"
        }`}
      >
        {pausedForListen
          ? "듣는 중... 곧 이어서 시작해요"
          : recording
          ? "듣고 있어요... (눌러서 멈추기)"
          : pageDone
          ? "이 페이지 다 읽었어요"
          : "따라 읽기 시작"}
      </button>

      {recording && (
        <p className="text-center text-sm text-sky-600 font-bold">
          하이라이트된 문장을 읽어주세요. 읽는 중에 듣기 버튼을 눌러도 돼요 — 다 들으면 이어서 다시 녹음해요.
        </p>
      )}

      {pageDone && !recording && !showCompleteModal && (
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

      {showCompleteModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-6">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm flex flex-col items-center gap-4 shadow-xl">
            <p className="text-xl font-bold text-gray-800 text-center">
              3번 다 읽기 완료!
            </p>
            <p className="text-gray-600 text-center">
              {hasNextPage ? "다음 페이지를 읽어볼까요?" : "이제 퀴즈를 풀어볼까요?"}
            </p>
            <div className="w-full flex flex-col gap-2">
              {hasNextPage && onNextPage && (
                <button
                  onClick={() => {
                    setShowCompleteModal(false);
                    onNextPage();
                  }}
                  className="w-full py-3 rounded-full bg-sky-600 text-white font-bold active:scale-95 transition"
                >
                  다음 페이지
                </button>
              )}
              {!hasNextPage && onGoToQuiz ? (
                <button
                  onClick={() => {
                    setShowCompleteModal(false);
                    onGoToQuiz();
                  }}
                  className="w-full py-3 rounded-full bg-sky-600 text-white font-bold active:scale-95 transition"
                >
                  퀴즈 풀러가기
                </button>
              ) : (
                <button
                  onClick={() => {
                    setShowCompleteModal(false);
                    restartRound();
                  }}
                  className="w-full py-3 rounded-full bg-gray-100 text-gray-700 font-bold active:scale-95 transition"
                >
                  이 페이지 다시 읽기
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
