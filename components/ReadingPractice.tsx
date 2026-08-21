"use client";

import { useRef, useState, useSyncExternalStore } from "react";
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

export default function ReadingPractice({ sentences }: { sentences: string[] }) {
  const [index, setIndex] = useState(0);
  const [attempts, setAttempts] = useState<Record<number, Attempt[]>>({});
  const [listening, setListening] = useState(false);
  const [slowMode, setSlowMode] = useState(false);
  const [playingAll, setPlayingAll] = useState(false);
  const speechSupported = useSpeechSupported();
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  function getRecognition(): SpeechRecognitionLike | null {
    if (recognitionRef.current) return recognitionRef.current;
    const Ctor = getRecognitionCtor();
    if (!Ctor) return null;
    const recognition = new Ctor();
    recognition.lang = "en-US";
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognitionRef.current = recognition;
    return recognition;
  }

  const sentence = sentences[index];
  const currentAttempts = attempts[index] ?? [];
  const done = currentAttempts.length >= REQUIRED_ROUNDS;

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
    sentences.forEach((s, i) => {
      const isLast = i === sentences.length - 1;
      speak(s, rate, isLast ? () => setPlayingAll(false) : undefined);
    });
  }

  function stopAll() {
    window.speechSynthesis?.cancel();
    setPlayingAll(false);
  }

  async function listen() {
    const recognition = getRecognition();
    if (!recognition) return;
    setError(null);
    setListening(true);
    audioChunksRef.current = [];

    let stream: MediaStream | null = null;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };
      recorder.start();
    } catch {
      setError("마이크 접근 권한이 필요해요.");
    }

    function stopRecording(): string | null {
      const recorder = mediaRecorderRef.current;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      if (recorder && recorder.state !== "inactive") recorder.stop();
      if (audioChunksRef.current.length === 0) return null;
      const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
      return URL.createObjectURL(blob);
    }

    recognition.onresult = (event) => {
      const heard = event.results[0]?.[0]?.transcript ?? "";
      const score = scorePronunciation(sentence, heard);
      const audioUrl = stopRecording();
      setAttempts((prev) => ({
        ...prev,
        [index]: [...(prev[index] ?? []), { heard, score, audioUrl }],
      }));
    };
    recognition.onerror = () => {
      stopRecording();
      setError("음성을 인식하지 못했어요. 다시 시도해주세요.");
      setListening(false);
    };
    recognition.onend = () => setListening(false);

    try {
      recognition.start();
    } catch {
      setListening(false);
      stopRecording();
    }
  }

  function nextSentence() {
    if (index < sentences.length - 1) setIndex(index + 1);
  }

  function prevSentence() {
    if (index > 0) setIndex(index - 1);
  }

  return (
    <div className="w-full max-w-md flex flex-col gap-4">
      <div className="flex items-center justify-between text-sm text-gray-500">
        <span>
          문장 {index + 1} / {sentences.length}
        </span>
        <span>
          {currentAttempts.length}/{REQUIRED_ROUNDS}회 완료
        </span>
      </div>

      <div className="rounded-2xl bg-blue-50 p-5 text-center">
        <p className="text-xl font-semibold leading-relaxed">{sentence}</p>
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
          className="flex-1 py-3 rounded-full bg-blue-500 text-white font-bold active:scale-95 transition"
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
          disabled={listening || done}
          className="w-full py-3 rounded-full bg-pink-500 text-white font-bold disabled:opacity-50 active:scale-95 transition"
        >
          {listening ? "🎤 듣고 있어요..." : done ? "✅ 3번 완료!" : "🎤 따라 읽기"}
        </button>
      ) : (
        <p className="text-sm text-gray-400 text-center">
          이 브라우저는 음성인식을 지원하지 않아요 (Chrome 권장).
        </p>
      )}

      {error && <p className="text-red-500 text-sm text-center">{error}</p>}

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
            {a.audioUrl && (
              <audio controls src={a.audioUrl} className="w-full h-8">
                <track kind="captions" />
              </audio>
            )}
          </div>
        ))}
      </div>

      <div className="flex justify-between pt-2">
        <button
          onClick={prevSentence}
          disabled={index === 0}
          className="px-4 py-2 rounded-full bg-gray-100 disabled:opacity-40"
        >
          ← 이전 문장
        </button>
        <button
          onClick={nextSentence}
          disabled={index === sentences.length - 1}
          className="px-4 py-2 rounded-full bg-gray-100 disabled:opacity-40"
        >
          다음 문장 →
        </button>
      </div>
    </div>
  );
}
