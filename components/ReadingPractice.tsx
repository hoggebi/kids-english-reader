"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { scorePronunciation } from "@/lib/pronunciation";

const REQUIRED_ROUNDS = 3;
const NORMAL_RATE = 1;
const SLOW_RATE = 0.6;

type Attempt = { heard: string; score: number; audioUrl: string | null };

function noopSubscribe() {
  return () => {};
}

function getRecognitionCtor() {
  if (typeof window === "undefined") return undefined;
  return window.SpeechRecognition ?? window.webkitSpeechRecognition;
}

function useSpeechSupported() {
  return useSyncExternalStore(
    noopSubscribe,
    () => getRecognitionCtor() !== undefined,
    () => false
  );
}

// 라운드 수에 따라 문장 색을 회색 -> 초록으로 점점 진하게
function progressColorClass(count: number) {
  if (count <= 0) return "text-gray-400";
  if (count === 1) return "text-green-400";
  if (count === 2) return "text-green-600";
  return "text-green-700";
}

export default function ReadingPractice({ sentences }: { sentences: string[] }) {
  const [index, setIndex] = useState(0);
  const [attempts, setAttempts] = useState<Record<number, Attempt[]>>({});
  const [listening, setListening] = useState(false);
  const [slowMode, setSlowMode] = useState(false);
  const [playingAll, setPlayingAll] = useState(false);
  const [playingIndex, setPlayingIndex] = useState<number | null>(null);
  const [justCompletedRound, setJustCompletedRound] = useState<number | null>(null);
  const speechSupported = useSpeechSupported();
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const passageRef = useRef<HTMLDivElement | null>(null);

  function createRecognition(): SpeechRecognitionLike | null {
    const Ctor = getRecognitionCtor();
    if (!Ctor) return null;
    const recognition = new Ctor();
    recognition.lang = "en-US";
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    return recognition;
  }

  const sentence = sentences[index];
  const currentAttempts = attempts[index] ?? [];
  const done = currentAttempts.length >= REQUIRED_ROUNDS;
  const allDone = sentences.every((_, i) => (attempts[i]?.length ?? 0) >= REQUIRED_ROUNDS);

  // 완료 배지는 1.6초 후 자동으로 사라짐
  useEffect(() => {
    if (justCompletedRound === null) return;
    const t = setTimeout(() => setJustCompletedRound(null), 1600);
    return () => clearTimeout(t);
  }, [justCompletedRound]);

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

  async function listen() {
    const recognition = createRecognition();
    if (!recognition) return;
    recognitionRef.current = recognition;
    setListening(true);

    let gotResult = false;

    recognition.onresult = (event) => {
      gotResult = true;
      setError(null);
      const heard = event.results[0]?.[0]?.transcript ?? "";
      const score = scorePronunciation(sentence, heard);
      setAttempts((prev) => {
        const next = [...(prev[index] ?? []), { heard, score, audioUrl: null }];
        setJustCompletedRound(next.length);
        if (next.length >= REQUIRED_ROUNDS && index < sentences.length - 1) {
          setTimeout(() => goToSentence(index + 1), 1200);
        }
        return { ...prev, [index]: next };
      });
    };
    recognition.onerror = (event: { error?: string }) => {
      gotResult = true;
      const reason = event?.error;
      setError(
        reason === "no-speech"
          ? "목소리가 안 들렸어요. 마이크에 조금 더 가까이 대고 다시 눌러주세요."
          : reason === "not-allowed"
          ? "마이크 권한이 꺼져있어요. 브라우저 설정에서 마이크 권한을 켜주세요."
          : `음성을 인식하지 못했어요 (${reason ?? "알 수 없는 오류"}). 다시 시도해주세요.`
      );
      setListening(false);
    };
    recognition.onend = () => {
      setListening(false);
      if (!gotResult) {
        setError((prev) => prev ?? "목소리가 안 들렸어요. 다시 눌러서 시도해주세요.");
      }
    };

    try {
      recognition.start();
    } catch {
      setListening(false);
      setError("음성 인식을 시작하지 못했어요. 다시 눌러주세요.");
    }
  }

  function goToSentence(i: number) {
    setIndex(i);
    setError(null);
    const el = passageRef.current?.querySelector(`[data-sentence-idx="${i}"]`);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  return (
    <div className="w-full max-w-md flex flex-col gap-4 relative">
      {/* 방금 완료된 라운드 배지 (크게, 잠깐 떴다 사라짐) */}
      {justCompletedRound !== null && (
        <div className="absolute inset-x-0 -top-2 flex justify-center z-10 pointer-events-none">
          <div className="bg-green-600 text-white font-title text-xl font-extrabold px-6 py-2 rounded-full shadow-lg animate-bounce">
            🎉 {justCompletedRound}번 완료!
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-500">지문 전체 보기</span>
        <div className="flex items-baseline gap-1 bg-green-50 rounded-full px-4 py-1">
          <span className="font-title text-2xl font-extrabold text-green-700">
            {currentAttempts.length}
          </span>
          <span className="text-sm text-green-600 font-bold">/ {REQUIRED_ROUNDS}회</span>
        </div>
      </div>

      {/* 전체 지문을 한 화면에 다 보여주고, 지금 연습 중인 문장만 하이라이트 */}
      <div
        ref={passageRef}
        className="rounded-2xl bg-gray-50 p-5 max-h-72 overflow-y-auto leading-relaxed text-lg"
      >
        {sentences.map((s, i) => {
          const doneCount = attempts[i]?.length ?? 0;
          const isCurrent = i === index;
          const isPlayingNow = i === playingIndex;
          let colorClass = "text-gray-700";
          if (isPlayingNow) colorClass = "text-indigo-600 font-bold";
          else if (isCurrent) colorClass = progressColorClass(doneCount) + " font-bold";
          else if (doneCount >= REQUIRED_ROUNDS) colorClass = "text-green-600";

          return (
            <span
              key={i}
              data-sentence-idx={i}
              onClick={() => !playingAll && goToSentence(i)}
              className={`cursor-pointer transition-colors duration-300 rounded px-0.5 ${colorClass}`}
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
          disabled={playingAll}
          className="flex-1 py-3 rounded-full bg-blue-500 text-white font-bold active:scale-95 transition disabled:opacity-50"
        >
          🔊 이 문장 듣기
        </button>
        <button
          onClick={playingAll ? stopAll : speakAll}
          className="flex-1 py-3 rounded-full bg-indigo-500 text-white font-bold active:scale-95 transition"
        >
          {playingAll ? "⏹ 멈추기" : "▶ 전체 듣기"}
        </button>
      </div>

      {speechSupported ? (
        <button
          onClick={listen}
          disabled={listening || done || playingAll}
          className="w-full py-4 rounded-full bg-pink-500 text-white font-title text-xl font-extrabold disabled:opacity-50 active:scale-95 transition"
        >
          {listening
            ? "🎤 듣고 있어요..."
            : done
            ? "✅ 이 문장 완료!"
            : "🎤 따라 읽기"}
        </button>
      ) : (
        <p className="text-sm text-gray-400 text-center">
          이 브라우저는 음성인식을 지원하지 않아요 (Chrome 권장).
        </p>
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
        {currentAttempts.map((a, i) => (
          <div key={i} className="flex flex-col gap-1 rounded-xl bg-gray-50 px-4 py-2 text-sm">
            <div className="flex items-center justify-between">
              <span>
                {i + 1}회차: &quot;{a.heard || "(인식 안됨)"}&quot;
              </span>
              <span
                className={
                  a.score >= 80
                    ? "text-green-600 font-bold"
                    : a.score >= 50
                    ? "text-yellow-600 font-bold"
                    : "text-red-500 font-bold"
                }
              >
                {a.score}점
              </span>
            </div>
          </div>
        ))}
      </div>

      {allDone && (
        <p className="text-center text-green-600 font-title text-lg font-bold py-2">
          🎉 지문을 전부 3번씩 따라 읽었어요!
        </p>
      )}
    </div>
  );
}

