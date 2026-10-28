"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ChunkLesson, ChunkbookMeta } from "@/lib/chunkbook";
import { renderPageBase64, type PdfDoc as PdfDocLike } from "@/lib/chunkbook";
import {
  bumpListens,
  isValidOrder,
  loadActivity,
  resetRoleOverride,
  resolveRoles,
  saveActivity,
  saveRoleOverride,
  shuffleOrder,
  type BodyLine,
  type LessonActivity,
  type LessonText,
  type PageRoles,
  type WritingItem,
} from "@/lib/chunkLesson";
import { builtinRoles } from "@/lib/chunkbookBuiltin";
import { isA3Lesson, lessonNo } from "@/lib/chunkbookA3";
import { clearBookText, loadBookText, saveBookText } from "@/lib/chunkBookText";
import { autoPush } from "@/lib/sync";
import { COINS_LISTEN, COINS_SENTENCE, completeLesson, earnCoins, markLessonRead } from "@/lib/pet";
import PetCompanion from "./PetCompanion";
import { loadVoicePack, playVoiceIds, stopVoice, voiceIdsFor, type VoicePack } from "@/lib/voicePack";

const CHEERS = ["잘했어, 호야!", "우와, 대단해!", "나도 신나!", "호야 최고야!", "한 번 더 해볼까?"];
// 코인은 맞출 때마다 쌓이고, 캐릭터는 한 세트(Lesson)를 마칠 때 바로 자란다.
const cheerFor = (r: { granted: number; capped: boolean }, extra = "") => {
  if (r.capped && !r.granted) return "오늘 코인을 다 모았어! 내일 또 만나자!";
  const coin = r.granted ? `🪙 +${r.granted} ` : "";
  return `${coin}${CHEERS[Math.floor(Math.random() * CHEERS.length)]} ${extra}`.trim();
};

type Mode = "home" | "read" | "write" | "review" | "roles";

// 따옴표 표기(둥근/곧은, 문장 일부를 인용한 경우의 여닫는 따옴표)는 비교에서 뺀다. 글자와 구두점이 다를 때만 경고한다.
const norm = (s: string) => s.replace(/[“”"‘’']/g, "").replace(/\s+/g, " ").trim().toLowerCase();

// 읽어 주는 속도: 예전 속도(0.9 / 0.85)의 0.7배로 천천히.
const READ_RATE = 0.9 * 0.7;
const WRITE_RATE = 0.85 * 0.7;

// 따라쓰기 뜻 힌트: 한국어 전체가 아니라 앞부분 한두 단어만 살짝 보여 준다.
function hintOf(ko: string): string {
  const words = ko.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "";
  if (words.length === 1) return words[0].slice(0, Math.max(1, Math.ceil(words[0].length / 3))) + "…";
  const shown = Math.min(2, Math.max(1, Math.floor(words.length / 3)));
  return words.slice(0, shown).join(" ") + " …";
}

function speakSupported() {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

// ================= 읽고 듣기 =================
function ReadListen({
  lesson,
  text,
  onWrite,
  onBack,
  onOpenPage,
}: {
  lesson: number;
  text: LessonText;
  onWrite: () => void;
  onBack: () => void;
  onOpenPage: (page: number) => void;
}) {
  const lines = text.body;
  const [idx, setIdx] = useState(-1);
  const [status, setStatus] = useState<"idle" | "playing" | "paused" | "ended">("idle");
  const [listens, setListens] = useState(() => loadActivity(lesson)?.listens ?? 0);
  const [endedThisVisit, setEndedThisVisit] = useState(0); // 이번 방문에서 끝까지 들은 횟수
  const token = useRef(0);
  const watchdog = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rowRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const supported = speakSupported();
  const [petTick, setPetTick] = useState(0);
  const [cheer, setCheer] = useState<string | null>(null);

  // 녹음 음성(MP3). 아직 못 불러왔거나 문장이 다르면 기기 음성으로 읽는다.
  const packRef = useRef<VoicePack | null>(null);
  useEffect(() => {
    let alive = true;
    void loadVoicePack().then((p) => {
      if (alive) packRef.current = p;
    });
    return () => {
      alive = false;
    };
  }, []);

  const stopAll = useCallback(() => {
    token.current += 1;
    if (watchdog.current) clearTimeout(watchdog.current);
    stopVoice();
    try {
      window.speechSynthesis?.cancel();
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => stopAll, [stopAll]);

  // 영어만 읽는다. 한국어는 화면으로만 보여준다. 끝나면 다음 문장으로 강조가 이동한다.
  const playFrom = useCallback(
    (start: number) => {
      if ((!speakSupported() && !packRef.current) || lines.length === 0) return;
      stopAll();
      const tk = token.current;
      setStatus("playing");
      const say = (i: number) => {
        if (tk !== token.current) return;
        if (i >= lines.length) {
          setStatus("ended");
          setEndedThisVisit((n) => n + 1);
          setListens(bumpListens(lesson));
          const nowDone = markLessonRead(lesson);
          // 끝까지 한 바퀴 들을 때마다 경험치 +2
          const r = earnCoins(COINS_LISTEN, "chapter");
          setCheer(nowDone ? `Lesson ${lessonNo(lesson)} 완료 ✓ 잘했어, 호야!` : cheerFor(r, "(듣기 한 바퀴!)"));
          setPetTick((n) => n + 1);
          autoPush();
          return;
        }
        setIdx(i);
        const speakTts = () => {
          if (!speakSupported()) {
            say(i + 1);
            return;
          }
        const u = new SpeechSynthesisUtterance(lines[i].en);
        u.lang = "en-US";
        u.rate = READ_RATE;
        let advanced = false;
        const next = () => {
          if (advanced || tk !== token.current) return;
          advanced = true;
          if (watchdog.current) clearTimeout(watchdog.current);
          say(i + 1);
        };
        u.onend = next;
        u.onerror = next;
        // 일부 기기에서 end 이벤트가 오지 않는 경우를 대비한 안전장치
        watchdog.current = setTimeout(next, 2500 + lines[i].en.length * 160); // 느리게 읽는 만큼 여유를 둔다
        window.speechSynthesis.speak(u);
        };
        const pack = packRef.current;
        const section = lines[i].section;
        const ordinal = lines.slice(0, i).filter((l) => l.section === section).length;
        const ids = pack ? voiceIdsFor(pack, lesson, section, ordinal, lines[i].en) : null;
        if (pack && ids) {
          void playVoiceIds(pack, ids).then((ok) => {
            if (tk !== token.current) return;
            if (ok) say(i + 1);
            else speakTts(); // 녹음 재생이 안 되면 기기 음성으로 이어서 읽는다
          });
          return;
        }
        speakTts();
      };
      say(start);
    },
    [lines, lesson, stopAll],
  );

  function pause() {
    stopAll();
    setStatus("paused");
  }

  // 읽는 문장이 화면 밖에 있을 때만 자연스럽게 스크롤
  useEffect(() => {
    if (idx < 0 || status !== "playing") return;
    const el = rowRefs.current[idx];
    if (!el) return;
    const r = el.getBoundingClientRect();
    const top = 72;
    const bottom = window.innerHeight - 96; // 아래 컨트롤 영역
    if (r.top < top || r.bottom > bottom) {
      const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
      el.scrollIntoView({ block: "center", behavior: reduce ? "auto" : "smooth" });
    }
  }, [idx, status]);

  const firstDone = endedThisVisit >= 1;
  const activeIdx = idx >= 0 && (status === "playing" || status === "paused") ? idx : -1;
  const hl = (i: number) =>
    `cursor-pointer rounded px-1 transition-colors duration-200 ${
      i === activeIdx
        ? "bg-sky-100 font-bold text-sky-900 underline decoration-sky-400 decoration-2 underline-offset-4"
        : "hover:bg-gray-100"
    }`;

  return (
    <div className="flex flex-col gap-3" data-testid="read-listen">
      <div className="flex items-center justify-between gap-2">
        <button onClick={() => { stopAll(); onBack(); }} className="min-h-[44px] text-sm text-gray-500 underline">
          ← Lesson {lessonNo(lesson)}
        </button>
        <p className="text-sm font-bold text-gray-700">읽고 듣기</p>
        {isA3Lesson(lesson) ? (
          <span className="w-16" aria-hidden />
        ) : (
          <button onClick={() => onOpenPage(text.bodyPages[0])} className="min-h-[44px] text-xs text-sky-700 underline">
            원본 페이지 보기
          </button>
        )}
      </div>

      <PetCompanion tick={petTick} message={cheer} popping={cheer !== null && status === "ended"} />

      {!supported && <p className="text-sm text-amber-700">이 기기에서는 음성을 쓸 수 없어요. 화면의 문장을 읽어 보세요.</p>}
      {listens > 0 && endedThisVisit === 0 && <p className="text-xs text-gray-500">이 Lesson을 {listens}번 들었어요.</p>}

      {/* 본문: 한 장의 카드 안에 문장마다 영어 + 바로 아래 작은 한국어. 지금 읽는 문장만 연한 하늘색으로 강조 */}
      <div className="rounded-2xl bg-gray-50 p-5 flex flex-col gap-3" data-testid="body-card">
        {lines.map((l, i) =>
          l.section === "passage" ? (
            <div key={i} className="flex flex-col">
              <span
                ref={(el) => {
                  rowRefs.current[i] = el;
                }}
                role="button"
                tabIndex={supported ? 0 : -1}
                aria-label={`${i + 1}번째 문장부터 듣기`}
                onClick={() => supported && playFrom(i)}
                onKeyDown={(e) => {
                  if (supported && (e.key === "Enter" || e.key === " ")) {
                    e.preventDefault();
                    playFrom(i);
                  }
                }}
                className={`${hl(i)} self-start text-xl leading-snug`}
              >
                {l.en}
              </span>
              <span className={`px-1 text-sm ${i === activeIdx ? "text-sky-700" : "text-gray-500"}`}>{l.ko}</span>
            </div>
          ) : null,
        )}
      </div>

      {lines.some((l) => l.section === "dialogue") && (
        <div className="rounded-2xl bg-gray-50 p-5 flex flex-col gap-3">
          <p className="text-xs font-bold text-gray-400">대화 연습</p>
          {lines.map((l, i) =>
            l.section === "dialogue" ? (
              <div key={i} className="flex flex-col">
                <span
                  ref={(el) => {
                    rowRefs.current[i] = el;
                  }}
                  role="button"
                  tabIndex={supported ? 0 : -1}
                  aria-label={`${i + 1}번째 문장부터 듣기`}
                  onClick={() => supported && playFrom(i)}
                  onKeyDown={(e) => {
                    if (supported && (e.key === "Enter" || e.key === " ")) {
                      e.preventDefault();
                      playFrom(i);
                    }
                  }}
                  className={`${hl(i)} self-start text-xl leading-snug`}
                >
                  {l.en}
                </span>
                <span className={`px-1 text-sm ${i === activeIdx ? "text-sky-700" : "text-gray-500"}`}>{l.ko}</span>
              </div>
            ) : null,
          )}
        </div>
      )}

      {firstDone && status === "ended" && (
        <div className="rounded-2xl bg-sky-50 border-2 border-sky-200 p-4 flex flex-col gap-3" data-testid="after-listen">
          {/* 기본은 2번 듣기: 한 번 들으면 한 번 더 듣게 안내하고, 두 번 들으면 쓰기로 넘어간다 */}
          <p className="text-lg font-bold text-sky-800">
            {endedThisVisit >= 2 ? "두 번 다 들었어요! 이제 써 볼까요?" : "한 번 들었어요! 한 번만 더 들어 봐요 (1/2)"}
          </p>
          <div className="flex flex-wrap gap-2">
            {endedThisVisit >= 2 ? (
              <>
                <button onClick={onWrite} className="min-h-[48px] px-5 rounded-full bg-sky-600 text-white text-sm font-bold active:scale-95 transition">
                  문장 보고 쓰기
                </button>
                <button onClick={() => playFrom(0)} className="min-h-[48px] px-5 rounded-full bg-white border-2 border-sky-300 text-sky-700 text-sm font-bold active:scale-95 transition">
                  다시 듣기
                </button>
              </>
            ) : (
              <>
                <button onClick={() => playFrom(0)} className="min-h-[48px] px-5 rounded-full bg-sky-600 text-white text-sm font-bold active:scale-95 transition">
                  한 번 더 듣기
                </button>
                <button onClick={onWrite} className="min-h-[48px] px-5 rounded-full bg-white border-2 border-sky-300 text-sky-700 text-sm font-bold active:scale-95 transition">
                  바로 쓰기
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* 재생 컨트롤 */}
      <div className="sticky bottom-3 z-10 flex items-center justify-center gap-2 rounded-full bg-white/95 border border-gray-200 p-2 shadow-lg self-center">
        {status === "playing" ? (
          <button onClick={pause} className="min-h-[44px] px-5 rounded-full bg-gray-700 text-white text-sm font-bold active:scale-95 transition">
            ⏸ 일시정지
          </button>
        ) : (
          <button
            onClick={() => playFrom(status === "paused" && idx >= 0 ? idx : 0)}
            disabled={!supported}
            className="min-h-[44px] px-5 rounded-full bg-sky-600 text-white text-sm font-bold disabled:opacity-50 active:scale-95 transition"
          >
            ▶ {status === "paused" ? "이어 듣기" : "재생"}
          </button>
        )}
        <button
          onClick={() => playFrom(0)}
          disabled={!supported}
          className="min-h-[44px] px-4 rounded-full bg-gray-500 text-white text-sm font-bold disabled:opacity-50 active:scale-95 transition"
        >
          ↺ 다시 듣기
        </button>
        <button
          onClick={() => { stopAll(); onWrite(); }}
          className="min-h-[44px] px-4 rounded-full bg-gray-700 text-white text-sm font-bold active:scale-95 transition"
        >
          ✍️ 문장 보고 쓰기
        </button>
      </div>
    </div>
  );
}

// ================= 따라 읽기 (A3) =================
// 한 줄 듣기 → 따라 말할 틈 → 다음 줄. 본문 전체를 두 바퀴 돈다. 두 바퀴를 모두 마치면 읽기 완료.
// 건너뛰기 버튼은 두지 않는다(그냥 넘기지 않도록). 틈의 길이는 방금 들은 문장 길이에 맞춘다.
const SHADOW_ROUNDS = 2;
const SHADOW_VOICE_RATE = 0.9; // 녹음 음성을 약간 느리게(따라 말하기 쉽게)
type ShadowPhase = "idle" | "listen" | "repeat" | "paused" | "done";

function ShadowRead({
  lesson,
  text,
  onWrite,
  onBack,
}: {
  lesson: number;
  text: LessonText;
  onWrite: () => void;
  onBack: () => void;
}) {
  const lines = text.body;
  const [idx, setIdx] = useState(-1);
  const [round, setRound] = useState(1);
  const [phase, setPhase] = useState<ShadowPhase>("idle");
  const [gapMs, setGapMs] = useState(0);
  const [petTick, setPetTick] = useState(0);
  const [cheer, setCheer] = useState<string | null>(null);
  const token = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const waitDone = useRef<(() => void) | null>(null);
  const pos = useRef({ round: 1, idx: 0 });
  const rowRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const packRef = useRef<VoicePack | null>(null);
  const supported = speakSupported();

  useEffect(() => {
    let alive = true;
    void loadVoicePack().then((p) => {
      if (alive) packRef.current = p;
    });
    return () => {
      alive = false;
    };
  }, []);

  const stopAll = useCallback(() => {
    token.current += 1;
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    waitDone.current?.();
    waitDone.current = null;
    stopVoice();
    try {
      window.speechSynthesis?.cancel();
    } catch {
      /* ignore */
    }
  }, []);
  useEffect(() => stopAll, [stopAll]);

  // 한 문장을 읽어 주고, 걸린 시간(ms)을 돌려준다. 녹음이 있으면 녹음, 없으면 기기 음성.
  const speak = useCallback(
    (i: number, tk: number) =>
      new Promise<number>((resolve) => {
        const t0 = Date.now();
        let settled = false;
        const finish = () => {
          if (settled) return;
          settled = true;
          if (timer.current) clearTimeout(timer.current);
          const took = Date.now() - t0;
          resolve(took < 400 ? lines[i].en.length * 70 : took); // 바로 끝나면 글자 수로 어림한다
        };
        const tts = () => {
          if (!speakSupported()) {
            finish();
            return;
          }
          const u = new SpeechSynthesisUtterance(lines[i].en);
          u.lang = "en-US";
          u.rate = READ_RATE;
          u.onend = finish;
          u.onerror = finish;
          timer.current = setTimeout(finish, 2500 + lines[i].en.length * 160);
          window.speechSynthesis.speak(u);
        };
        const pack = packRef.current;
        const section = lines[i].section;
        const ordinal = lines.slice(0, i).filter((l) => l.section === section).length;
        const ids = pack ? voiceIdsFor(pack, lesson, section, ordinal, lines[i].en) : null;
        if (pack && ids) {
          void playVoiceIds(pack, ids, SHADOW_VOICE_RATE).then((ok) => {
            if (tk !== token.current) return finish();
            if (ok) finish();
            else tts();
          });
          return;
        }
        tts();
      }),
    [lines, lesson],
  );

  const wait = useCallback(
    (ms: number) =>
      new Promise<void>((resolve) => {
        waitDone.current = resolve;
        timer.current = setTimeout(() => {
          waitDone.current = null;
          resolve();
        }, ms);
      }),
    [],
  );

  const play = useCallback(
    async (startRound: number, startIdx: number) => {
      if ((!speakSupported() && !packRef.current) || lines.length === 0) return;
      stopAll();
      const tk = token.current;
      for (let r = startRound; r <= SHADOW_ROUNDS; r++) {
        setRound(r);
        for (let i = r === startRound ? startIdx : 0; i < lines.length; i++) {
          if (tk !== token.current) return;
          pos.current = { round: r, idx: i };
          setIdx(i);
          setPhase("listen");
          const dur = await speak(i, tk);
          if (tk !== token.current) return;
          const gap = Math.max(2800, Math.round(dur * 1.4) + 1200);
          setGapMs(gap);
          setPhase("repeat");
          await wait(gap);
          if (tk !== token.current) return;
        }
      }
      if (tk !== token.current) return;
      setPhase("done");
      setIdx(-1);
      bumpListens(lesson);
      const nowDone = markLessonRead(lesson);
      const r = earnCoins(COINS_LISTEN, "chapter");
      setCheer(nowDone ? `Lesson ${lessonNo(lesson)} 완료 ✓ 잘했어, 호야!` : cheerFor(r, "(따라 읽기 두 바퀴!)"));
      setPetTick((n) => n + 1);
      autoPush();
    },
    [lines, lesson, stopAll, speak, wait],
  );

  function pause() {
    stopAll();
    setPhase("paused");
  }

  // 읽는 문장이 화면 밖에 있을 때만 스크롤
  useEffect(() => {
    if (idx < 0 || (phase !== "listen" && phase !== "repeat")) return;
    const el = rowRefs.current[idx];
    if (!el) return;
    const r = el.getBoundingClientRect();
    if (r.top < 72 || r.bottom > window.innerHeight - 140) {
      const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
      el.scrollIntoView({ block: "center", behavior: reduce ? "auto" : "smooth" });
    }
  }, [idx, phase]);

  const active = phase === "listen" || phase === "repeat" || phase === "paused";
  const rowClass = (i: number) =>
    `rounded px-1 transition-colors duration-200 ${
      i === idx && phase === "listen"
        ? "bg-sky-100 font-bold text-sky-900 underline decoration-sky-400 decoration-2 underline-offset-4"
        : i === idx && phase === "repeat"
          ? "bg-amber-100 font-bold text-gray-800"
          : ""
    }`;
  const renderLine = (l: BodyLine, i: number) => (
    <div key={i} className="flex flex-col">
      <span
        ref={(el) => {
          rowRefs.current[i] = el;
        }}
        className={`${rowClass(i)} self-start text-xl leading-snug`}
      >
        {l.en}
      </span>
      <span className={`px-1 text-sm ${i === idx ? "text-sky-700" : "text-gray-500"}`}>{l.ko}</span>
    </div>
  );

  return (
    <div className="flex flex-col gap-3" data-testid="shadow-read">
      <style>{"@keyframes shadowgap{from{width:0}to{width:100%}}@media (prefers-reduced-motion: reduce){.shadowgap{animation:none!important;width:100%!important}}"}</style>
      <div className="flex items-center justify-between gap-2">
        <button onClick={() => { stopAll(); onBack(); }} className="min-h-[44px] text-sm text-gray-500 underline">
          ← Lesson {lessonNo(lesson)}
        </button>
        <p className="text-sm font-bold text-gray-700">따라 읽기</p>
        <span className="w-16" aria-hidden />
      </div>

      <PetCompanion tick={petTick} message={cheer} popping={cheer !== null && phase === "done"} />

      {!supported && <p className="text-sm text-amber-700">이 기기에서는 음성을 쓸 수 없어요. 화면의 문장을 소리 내어 읽어 보세요.</p>}

      {/* 지금 할 일 */}
      <div
        className={`sticky top-2 z-10 rounded-2xl border-2 p-3 flex flex-col gap-2 ${
          phase === "repeat" ? "bg-amber-50 border-amber-300" : "bg-sky-50 border-sky-200"
        }`}
        data-testid="shadow-status"
        role="status"
      >
        <div className="flex items-center justify-between gap-2">
          <p className={`text-lg font-bold ${phase === "repeat" ? "text-gray-700" : "text-sky-800"}`}>
            {phase === "idle" && "한 줄 듣고, 따라 말해요"}
            {phase === "listen" && "👂 잘 들어요"}
            {phase === "repeat" && "🎤 내 차례! 따라 말해요"}
            {phase === "paused" && "⏸ 멈췄어요"}
            {phase === "done" && "두 바퀴 다 했어요! 🎉"}
          </p>
          {active && (
            <p className="text-xs font-bold text-gray-500">
              {round}/{SHADOW_ROUNDS}바퀴 · {Math.max(idx, 0) + 1}/{lines.length}줄
            </p>
          )}
        </div>
        {phase === "repeat" && (
          <div className="h-2 rounded-full bg-amber-100 overflow-hidden" aria-hidden>
            <div
              key={`${round}-${idx}`}
              className="shadowgap h-full rounded-full bg-amber-400"
              style={{ animation: `shadowgap ${gapMs}ms linear forwards` }}
            />
          </div>
        )}
        {phase === "idle" && <p className="text-sm text-sky-700">본문을 처음부터 끝까지 두 바퀴 따라 읽어요.</p>}
      </div>

      <div className="rounded-2xl bg-gray-50 p-5 flex flex-col gap-3" data-testid="body-card">
        {lines.map((l, i) => (l.section === "passage" ? renderLine(l, i) : null))}
      </div>
      {lines.some((l) => l.section === "dialogue") && (
        <div className="rounded-2xl bg-gray-50 p-5 flex flex-col gap-3">
          <p className="text-xs font-bold text-gray-400">대화 연습</p>
          {lines.map((l, i) => (l.section === "dialogue" ? renderLine(l, i) : null))}
        </div>
      )}

      {phase === "done" && (
        <div className="rounded-2xl bg-sky-50 border-2 border-sky-200 p-4 flex flex-col gap-3" data-testid="after-shadow">
          <p className="text-lg font-bold text-sky-800">이제 써 볼까요?</p>
          <div className="flex flex-wrap gap-2">
            <button onClick={onWrite} className="min-h-[48px] px-5 rounded-full bg-sky-600 text-white text-sm font-bold active:scale-95 transition">
              문장 보고 쓰기
            </button>
            <button
              onClick={() => void play(1, 0)}
              className="min-h-[48px] px-5 rounded-full bg-white border-2 border-sky-300 text-sky-700 text-sm font-bold active:scale-95 transition"
            >
              처음부터 다시
            </button>
          </div>
        </div>
      )}

      {phase !== "done" && (
        <div className="sticky bottom-3 z-10 flex items-center justify-center gap-2 rounded-full bg-white/95 border border-gray-200 p-2 shadow-lg self-center">
          {phase === "listen" || phase === "repeat" ? (
            <button onClick={pause} className="min-h-[44px] px-5 rounded-full bg-gray-700 text-white text-sm font-bold active:scale-95 transition">
              ⏸ 일시정지
            </button>
          ) : (
            <button
              onClick={() => void play(phase === "paused" ? pos.current.round : 1, phase === "paused" ? pos.current.idx : 0)}
              disabled={!supported}
              className="min-h-[44px] px-5 rounded-full bg-sky-600 text-white text-sm font-bold disabled:opacity-50 active:scale-95 transition"
            >
              ▶ {phase === "paused" ? "이어서" : "시작"}
            </button>
          )}
          {phase === "paused" && (
            <button onClick={() => void play(1, 0)} className="min-h-[44px] px-4 rounded-full bg-gray-500 text-white text-sm font-bold active:scale-95 transition">
              ↺ 처음부터
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ================= 문장 보고 쓰기 =================
function WritingActivity({
  lesson,
  text,
  onBack,
}: {
  lesson: number;
  text: LessonText;
  onBack: () => void;
}) {
  const items = text.writing.filter((w) => w.en.trim().length > 0);
  const n = items.length;

  // 저장된 순서가 유효하면 복원, 아니면 새로 섞는다
  const [act, setAct] = useState<LessonActivity>(() => {
    const saved = loadActivity(lesson);
    if (saved && isValidOrder(saved.order, n) && !saved.completed && saved.startedAt > 0 && Number.isInteger(saved.pos) && saved.pos >= 0 && saved.pos < n) return saved;
    const fresh: LessonActivity = {
      listens: saved?.listens ?? 0,
      order: shuffleOrder(n),
      pos: 0,
      completed: false,
      startedAt: Date.now(),
    };
    return fresh;
  });
  const [hint, setHint] = useState(false);
  const [petTick, setPetTick] = useState(0);
  const [cheer, setCheer] = useState<string | null>(null);

  useEffect(() => {
    saveActivity(lesson, act);
  }, [lesson, act]);

  const stop = () => {
    try {
      window.speechSynthesis?.cancel();
    } catch {
      /* ignore */
    }
  };
  useEffect(() => stop, []);

  function go(delta: number) {
    stop();
    setHint(false);
    if (delta > 0) {
      // 문장을 쓸 때마다 코인이 쌓이고, Lesson을 끝까지 마치면 캐릭터가 바로 자란다
      const r = earnCoins(COINS_SENTENCE, "chapter");
      let msg = cheerFor(r);
      if (act.pos + delta >= n) {
        const done = completeLesson(lesson, (loadActivity(lesson)?.listens ?? 0) > 0);
        if (done.graduated) msg = "다 컸어! 새 친구를 만나러 가자! 도감을 확인해 봐!";
        else if (done.grew) msg = `와! Lesson ${lessonNo(lesson)} 끝! 나 쑥 자랐어! ${done.firstStamp ? "완료 ✓ " : ""}🪙 +${done.coins}`;
        else if (done.firstStamp) msg = `Lesson ${lessonNo(lesson)} 완료 ✓ 잘했어, 호야!`;
      }
      setCheer(msg);
      setPetTick((t) => t + 1);
      autoPush();
    }
    setAct((a) => {
      const pos = a.pos + delta;
      if (pos >= n) return { ...a, pos: n - 1, completed: true };
      return { ...a, pos: Math.max(0, pos) };
    });
  }

  function restart() {
    stop();
    setHint(false);
    setAct((a) => ({ ...a, order: shuffleOrder(n, a.order), pos: 0, completed: false, startedAt: Date.now() }));
  }

  function speak(s: string) {
    if (!speakSupported()) return;
    stop();
    const u = new SpeechSynthesisUtterance(s);
    u.lang = "en-US";
    u.rate = WRITE_RATE;
    window.speechSynthesis.speak(u);
  }

  if (n === 0) {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-sm text-amber-700">이 Lesson에는 쓸 문장이 아직 없어요. 본문·문장쓰기 확인에서 문장쓰기 영어 문장을 채워 주세요.</p>
        <button onClick={onBack} className="self-start min-h-[44px] px-4 rounded-full bg-gray-100 text-gray-700 text-sm font-bold">
          돌아가기
        </button>
      </div>
    );
  }

  if (act.completed) {
    return (
      <div className="flex flex-col items-center gap-4 py-6 text-center" data-testid="write-done">
        <div className="w-full text-left">
          <PetCompanion tick={petTick} message={cheer} popping />
        </div>
        <p className="text-2xl font-bold text-sky-600">다 썼어요! 🎉</p>
        <p className="text-sm text-gray-500">Lesson {lessonNo(lesson)}의 문장 {n}개를 모두 마쳤어요.</p>
        <div className="flex flex-wrap justify-center gap-2">
          <button onClick={restart} className="min-h-[48px] px-5 rounded-full bg-sky-600 text-white text-sm font-bold">
            다시 시작
          </button>
          <button onClick={onBack} className="min-h-[48px] px-5 rounded-full bg-gray-100 text-gray-700 text-sm font-bold">
            Lesson으로
          </button>
        </div>
      </div>
    );
  }

  const item: WritingItem = items[act.order[act.pos]];
  const isLast = act.pos >= n - 1;

  return (
    <div className="flex flex-col items-center gap-4" data-testid="write-activity">
      <div className="w-full">
        <PetCompanion tick={petTick} message={cheer} popping={cheer !== null} />
      </div>
      <div className="w-full flex items-center justify-between">
        <button onClick={() => { stop(); onBack(); }} className="min-h-[44px] text-sm text-gray-500 underline">
          ← Lesson {lessonNo(lesson)}
        </button>
        <span className="text-sm font-bold text-gray-700" data-testid="write-progress">
          {act.pos + 1} / {n}
        </span>
        <span className="w-16" aria-hidden />
      </div>

      <p className="text-sm text-gray-600 text-center">아래 문장을 세 번 써 보세요.</p>

      <div className="w-full max-w-3xl rounded-2xl bg-gray-50 px-5 py-10 flex flex-col items-center gap-4">
        <p className="text-3xl sm:text-4xl font-black text-gray-900 text-center leading-snug" data-testid="write-sentence">
          {item.en}
        </p>
        {hint && <p className="text-lg font-bold text-sky-700 text-center" data-testid="write-hint">{hintOf(item.ko)}</p>}
      </div>

      <div className="flex flex-wrap justify-center gap-2">
        <button onClick={() => speak(item.en)} disabled={!speakSupported()} className="min-h-[48px] px-5 rounded-full bg-gray-700 text-white text-sm font-bold disabled:opacity-50">
          🔈 문장 듣기
        </button>
        <button onClick={() => setHint((h) => !h)} className="min-h-[48px] px-5 rounded-full bg-gray-100 text-gray-700 text-sm font-bold">
          💡 힌트 {hint ? "숨기기" : "살짝 보기"}
        </button>
      </div>

      <div className="flex items-center justify-center gap-3">
        <button
          onClick={() => go(-1)}
          disabled={act.pos === 0}
          className="min-h-[52px] px-6 rounded-full bg-gray-100 text-gray-700 font-bold disabled:opacity-40"
        >
          ◀ 이전
        </button>
        <button onClick={() => go(1)} className={`min-h-[52px] px-6 rounded-full text-white font-bold bg-sky-600`}>
          {isLast ? "마치기" : "다음 ▶"}
        </button>
      </div>
    </div>
  );
}

// ================= 본문·문장쓰기 확인/수정 =================
function TextReview({
  text,
  onSave,
  onCancel,
}: {
  text: LessonText;
  onSave: (t: LessonText) => void;
  onCancel: () => void;
}) {
  const [body, setBody] = useState<BodyLine[]>(text.body);
  const [writing, setWriting] = useState<WritingItem[]>(text.writing);
  const bodyNorms = useMemo(() => body.map((b) => norm(b.en)), [body]);
  const missing = writing.filter((w) => w.en.trim() && !bodyNorms.some((b) => b.includes(norm(w.en)) || norm(w.en).includes(b))).length;
  const empties = writing.filter((w) => !w.en.trim()).length;

  return (
    <div className="flex flex-col gap-4 rounded-2xl border-2 border-amber-300 bg-amber-50 p-4" data-testid="text-review">
      <div>
        <p className="font-bold text-amber-900">본문·문장쓰기 확인</p>
        <p className="text-xs text-amber-800">
          교재에서 읽어 온 초안이에요. 영어 본문, 한국어 뜻, 문장쓰기 영어 정답을 확인하고 고쳐 주세요. 확인해서 저장한 내용만 학습에 써요.
        </p>
      </div>

      <section className="flex flex-col gap-2">
        <p className="text-sm font-bold text-gray-800">영어 본문과 한국어 뜻 ({body.length}문장)</p>
        {body.map((b, i) => (
          <div key={i} className="rounded-xl bg-white border border-amber-200 p-2 flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <span className="w-6 text-xs text-gray-400">{i + 1}</span>
              <textarea
                value={b.en}
                rows={2}
                onChange={(e) => setBody((arr) => arr.map((x, j) => (j === i ? { ...x, en: e.target.value } : x)))}
                aria-label={`${i + 1}번 영어`}
                className="flex-1 rounded-lg border-2 border-sky-200 px-2 py-1 text-base"
              />
              <button
                onClick={() => setBody((arr) => arr.filter((_, j) => j !== i))}
                aria-label={`${i + 1}번 문장 지우기`}
                className="min-h-[44px] min-w-[44px] rounded-full bg-gray-100 text-gray-500"
              >
                ✕
              </button>
            </div>
            <div className="flex items-center gap-2 pl-8">
              <input
                value={b.ko}
                onChange={(e) => setBody((arr) => arr.map((x, j) => (j === i ? { ...x, ko: e.target.value } : x)))}
                aria-label={`${i + 1}번 한국어`}
                className="flex-1 rounded-lg border-2 border-gray-200 px-2 py-1 text-sm"
              />
              <select
                value={b.section}
                onChange={(e) => setBody((arr) => arr.map((x, j) => (j === i ? { ...x, section: e.target.value as BodyLine["section"] } : x)))}
                aria-label={`${i + 1}번 구분`}
                className="rounded-lg border border-gray-200 px-1 py-1 text-xs"
              >
                <option value="passage">본문</option>
                <option value="dialogue">대화 연습</option>
              </select>
            </div>
          </div>
        ))}
        <button
          onClick={() => setBody((arr) => [...arr, { en: "", ko: "", section: "passage" }])}
          className="self-start min-h-[44px] px-4 rounded-full bg-white border border-amber-300 text-amber-900 text-sm font-bold"
        >
          + 문장 추가
        </button>
      </section>

      <section className="flex flex-col gap-2">
        <p className="text-sm font-bold text-gray-800">문장쓰기 4문장 (한국어 뜻 ↔ 영어 정답)</p>
        <p className="text-xs text-gray-600">한국어는 학습지에 인쇄된 문제, 영어는 본문에서 대응하는 문장이에요. 손글씨 답안은 가져오지 않아요.</p>
        {writing.map((w, i) => {
          const found = !w.en.trim() || bodyNorms.some((b) => b.includes(norm(w.en)) || norm(w.en).includes(b));
          return (
            <div key={i} className="rounded-xl bg-white border border-amber-200 p-2 flex flex-col gap-1">
              <input
                value={w.ko}
                onChange={(e) => setWriting((arr) => arr.map((x, j) => (j === i ? { ...x, ko: e.target.value } : x)))}
                aria-label={`문장쓰기 ${i + 1} 한국어`}
                className="rounded-lg border-2 border-gray-200 px-2 py-1 text-sm"
              />
              <input
                value={w.en}
                onChange={(e) => setWriting((arr) => arr.map((x, j) => (j === i ? { ...x, en: e.target.value } : x)))}
                aria-label={`문장쓰기 ${i + 1} 영어`}
                className="rounded-lg border-2 border-sky-200 px-2 py-1 text-base"
              />
              {!found && <p className="text-xs text-amber-700">⚠️ 본문에서 같은 문장을 찾지 못했어요. 확인해 주세요.</p>}
            </div>
          );
        })}
      </section>

      {empties > 0 && <p className="text-xs font-bold text-red-600">영어 정답이 비어 있는 문장은 쓰기에서 빠져요 ({empties}개).</p>}
      {missing > 0 && <p className="text-xs font-bold text-amber-700">본문과 다른 문장이 {missing}개 있어요.</p>}

      <div className="flex gap-2">
        <button
          onClick={() =>
            onSave({
              ...text,
              body: body.filter((b) => b.en.trim()),
              writing: writing.filter((w) => w.ko.trim() || w.en.trim()),
              status: "confirmed",
              confirmedAt: Date.now(),
            })
          }
          className="min-h-[48px] px-5 rounded-full bg-sky-600 text-white font-bold"
        >
          확인하고 저장
        </button>
        <button onClick={onCancel} className="min-h-[48px] px-5 rounded-full bg-white text-gray-700 font-bold">
          취소
        </button>
      </div>
    </div>
  );
}

// ================= 페이지 역할 수정 =================
function RolesEditor({
  lesson,
  lessonDef,
  roles,
  custom,
  onSave,
  onReset,
  onCancel,
}: {
  lesson: number;
  lessonDef: ChunkLesson;
  roles: PageRoles;
  custom: boolean;
  onSave: (r: PageRoles) => void;
  onReset: () => void;
  onCancel: () => void;
}) {
  const [body, setBody] = useState<number[]>(roles.body);
  const [writing, setWriting] = useState<number | null>(roles.writing);
  return (
    <div className="flex flex-col gap-3 rounded-2xl border-2 border-amber-300 bg-amber-50 p-4" data-testid="roles-editor">
      <p className="font-bold text-amber-900">Lesson {lessonNo(lesson)} 페이지 역할</p>
      <p className="text-xs text-amber-800">PDF에서 본문(읽고 듣기)과 문장쓰기 페이지를 골라 주세요. 쪽 위치만으로 정하지 않고 실제 내용을 보고 정해요.</p>
      <ul className="flex flex-col gap-1">
        {lessonDef.pages.map((p, i) => (
          <li key={p} className="flex items-center gap-3 rounded-lg bg-white border border-amber-200 px-3 py-2 text-sm">
            <span className="w-28 font-bold text-gray-700">{lessonDef.labels[i] ?? `p.${p}`} <span className="text-xs font-normal text-gray-400">({p}쪽)</span></span>
            <label className="flex items-center gap-1 min-h-[44px]">
              <input
                type="checkbox"
                checked={body.includes(p)}
                onChange={(e) => setBody((b) => (e.target.checked ? [...b, p].sort((a, c) => a - c) : b.filter((x) => x !== p)))}
              />
              본문
            </label>
            <label className="flex items-center gap-1 min-h-[44px]">
              <input type="radio" name={`writing-${lesson}`} checked={writing === p} onChange={() => setWriting(p)} />
              문장쓰기
            </label>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => body.length > 0 && onSave({ body, writing })}
          disabled={body.length === 0}
          className="min-h-[48px] px-5 rounded-full bg-sky-600 text-white font-bold disabled:opacity-50"
        >
          저장
        </button>
        {custom && (
          <button onClick={onReset} className="min-h-[48px] px-5 rounded-full bg-white text-gray-700 font-bold">
            확인한 기본값으로
          </button>
        )}
        <button onClick={onCancel} className="min-h-[48px] px-5 rounded-full bg-white text-gray-700 font-bold">
          취소
        </button>
      </div>
    </div>
  );
}

// ================= Lesson 홈 =================
export default function ChunkLessonView({
  book,
  lessonDef,
  doc,
  fileOk,
  onOpenVocab,
  onOpenPage,
}: {
  book: ChunkbookMeta;
  lessonDef: ChunkLesson;
  doc: PdfDocLike | null;
  fileOk: boolean;
  onOpenVocab: (lesson: number) => void;
  onOpenPage: (page: number) => void;
}) {
  const lesson = lessonDef.lesson;
  const [mode, setMode] = useState<Mode>("home");
  const builtin = !!book.builtin;
  const [text, setText] = useState<LessonText | null>(() => loadBookText(book, lesson));
  const [roleState, setRoleState] = useState(() =>
    builtin ? { roles: builtinRoles(lesson), custom: false } : resolveRoles(lesson, lessonDef.pages, book.pageCount),
  );
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<LessonText | null>(null);

  const roles = roleState.roles;
  const pagesChanged = !!text && (text.bodyPages.join() !== roles.body.join() || text.writingPage !== roles.writing);

  // 교재에서 두 번에 나눠 읽는다: 1) 본문 영어+한국어 뜻 2) 문장쓰기 한국어 문제 ↔ 본문 영어.
  async function callExtract<T>(payload: unknown, timeoutMs: number): Promise<T> {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch("/api/chunkbook-extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: ctrl.signal,
      });
      const json = (await res.json().catch(() => null)) as (T & { error?: string }) | null;
      if (!res.ok || !json) {
        let reason = json?.error ?? `HTTP ${res.status}`;
        if (/503|UNAVAILABLE|high demand/i.test(reason)) reason = "읽기 서비스가 지금 많이 바빠요.";
        throw new Error(reason);
      }
      return json;
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") throw new Error("응답이 너무 오래 걸려요. 잠시 뒤에 다시 시도해 주세요.");
      throw e;
    } finally {
      clearTimeout(timer);
    }
  }

  async function extract() {
    if (!doc || !fileOk) {
      setError("이 기기에 PDF가 없어요. 청크북 위쪽에서 PDF를 먼저 가져와 주세요.");
      return;
    }
    if (roles.body.length === 0) {
      setError("본문 페이지가 정해지지 않았어요. 페이지 역할을 먼저 정해 주세요.");
      return;
    }
    setError(null);
    let writing: WritingItem[] = [];
    let writingNote: string | null = null;
    try {
      setBusy("1/2 본문 페이지를 읽는 중… (영어 글자와 한국어 뜻)");
      const images = [];
      for (const p of roles.body) images.push({ data: await renderPageBase64(doc, p), mimeType: "image/jpeg" });
      const bodyRes = await callExtract<{ body: BodyLine[] }>({ mode: "body", images }, 110000);

      if (roles.writing) {
        try {
          setBusy("2/2 문장쓰기 페이지를 읽는 중…");
          const image = { data: await renderPageBase64(doc, roles.writing), mimeType: "image/jpeg" };
          const wr = await callExtract<{ writing: WritingItem[] }>({ mode: "writing", image, body: bodyRes.body.map((b) => b.en) }, 110000);
          writing = wr.writing;
        } catch (e) {
          // 문장쓰기만 실패해도 본문은 살린다. 부모가 직접 채우거나 다시 시도할 수 있다.
          writingNote = e instanceof Error ? e.message : "문장쓰기를 읽지 못했어요.";
        }
      }
      const t: LessonText = {
        lesson,
        body: bodyRes.body,
        writing,
        status: "extracted",
        extractedAt: Date.now(),
        confirmedAt: null,
        bodyPages: roles.body,
        writingPage: roles.writing,
      };
      setDraft(t);
      if (writingNote) setError(`문장쓰기를 읽지 못했어요 (${writingNote}). 확인 화면에서 직접 채우거나 나중에 다시 가져올 수 있어요.`);
      setMode("review");
    } catch (e) {
      setError(e instanceof Error ? e.message : "가져오지 못했어요.");
    } finally {
      setBusy(null);
    }
  }

  // 가져오기가 어려울 때: 빈 초안을 만들어 부모가 직접 입력한다.
  function startManual() {
    setDraft({
      lesson,
      body: [],
      writing: [0, 1, 2, 3].map(() => ({ ko: "", en: "" })),
      status: "extracted",
      extractedAt: Date.now(),
      confirmedAt: null,
      bodyPages: roles.body,
      writingPage: roles.writing,
    });
    setError(null);
    setMode("review");
  }

  function confirmText(t: LessonText) {
    saveBookText(book, t);
    setText(builtin ? loadBookText(book, lesson) : t);
    setDraft(null);
    setMode("home");
    autoPush();
  }

  const confirmed = text?.status === "confirmed";
  // A3처럼 내용을 단계적으로 채우는 내장 Lesson: 본문이 아직 없으면 준비 중으로 보여 준다.
  const notReady = builtin && isA3Lesson(lesson) && (!text || text.body.length === 0);

  // ----- 하위 화면 -----
  if (mode === "read" && text && confirmed && isA3Lesson(lesson))
    return <ShadowRead lesson={lesson} text={text} onWrite={() => setMode("write")} onBack={() => setMode("home")} />;
  if (mode === "read" && text && confirmed)
    return <ReadListen lesson={lesson} text={text} onWrite={() => setMode("write")} onBack={() => setMode("home")} onOpenPage={onOpenPage} />;
  if (mode === "write" && text && confirmed) return <WritingActivity lesson={lesson} text={text} onBack={() => setMode("home")} />;
  if (mode === "review" && (draft || text))
    return <TextReview text={(draft ?? text) as LessonText} onSave={confirmText} onCancel={() => { setDraft(null); setMode("home"); }} />;
  if (mode === "roles")
    return (
      <RolesEditor
        lesson={lesson}
        lessonDef={lessonDef}
        roles={roles}
        custom={roleState.custom}
        onSave={(r) => {
          saveRoleOverride(lesson, r);
          setRoleState({ roles: r, custom: true });
          setMode("home");
        }}
        onReset={() => {
          resetRoleOverride(lesson);
          setRoleState(resolveRoles(lesson, lessonDef.pages, book.pageCount));
          setMode("home");
        }}
        onCancel={() => setMode("home")}
      />
    );

  const label = (p: number) => lessonDef.labels[lessonDef.pages.indexOf(p)] ?? `p.${p}`;

  return (
    <div className="flex flex-col gap-3 rounded-2xl bg-gray-50 p-4" data-testid="lesson-home">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-lg font-bold text-gray-900">Lesson {lessonNo(lesson)}</p>
        {!isA3Lesson(lesson) && (
          <p className="text-xs text-gray-500">
            본문 {roles.body.map(label).join(", ") || "미정"} · 문장쓰기 {roles.writing ? label(roles.writing) : "미정"}
            {roleState.custom && " · 직접 수정함"}
          </p>
        )}
      </div>

      {notReady ? (
        <p className="rounded-xl bg-white border border-gray-200 p-4 text-sm font-bold text-gray-500" data-testid="lesson-not-ready">
          이 Lesson 내용은 준비 중이에요.
        </p>
      ) : confirmed ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <button onClick={() => setMode("read")} className="min-h-[56px] rounded-full bg-sky-600 text-white font-bold text-base active:scale-95 transition">
            🔊 읽고 듣기
          </button>
          <button onClick={() => setMode("write")} className="min-h-[56px] rounded-full bg-gray-700 text-white font-bold text-base active:scale-95 transition">
            ✍️ 문장 보고 쓰기
          </button>
        </div>
      ) : (
        <div className="rounded-xl bg-white border border-sky-200 p-3 flex flex-col gap-2">
          <p className="text-sm text-gray-700">
            {text ? "확인이 끝나지 않은 초안이 있어요. 확인하고 저장하면 사용할 수 있어요." : "이 Lesson의 본문과 문장쓰기를 교재에서 가져와요. 필요할 때만 한 번 가져오고, 확인한 내용은 저장해서 다시 쓰지 않아요."}
          </p>
          <div className="flex flex-wrap gap-2">
            {text && (
              <button onClick={() => { setDraft(null); setMode("review"); }} className="min-h-[48px] px-5 rounded-full bg-sky-600 text-white text-sm font-bold">
                초안 확인하기
              </button>
            )}
            <button onClick={extract} disabled={busy !== null} className="min-h-[48px] px-5 rounded-full bg-white border border-sky-300 text-sky-800 text-sm font-bold disabled:opacity-50">
              {text ? "다시 가져오기" : "교재에서 가져오기"}
            </button>
            {!text && (
              <button onClick={startManual} disabled={busy !== null} className="min-h-[48px] px-4 rounded-full bg-white text-gray-600 text-sm font-bold underline disabled:opacity-50">
                직접 입력하기
              </button>
            )}
          </div>
        </div>
      )}

      {busy && <p className="text-sm font-bold text-sky-700" role="status">{busy}</p>}
      {error && (
        <div className="rounded-xl bg-red-50 border border-red-200 p-3 flex flex-col gap-2" role="alert">
          <p className="text-sm font-bold text-red-700">⚠️ {error}</p>
          <button onClick={extract} className="self-start min-h-[44px] px-4 rounded-full bg-red-600 text-white text-sm font-bold">
            다시 시도
          </button>
        </div>
      )}
      {pagesChanged && (
        <p className="text-xs text-amber-700">페이지 역할을 바꿨어요. 저장된 본문은 이전 페이지 기준이에요. 필요하면 &quot;다시 가져오기&quot;를 눌러 주세요.</p>
      )}

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
        {!isA3Lesson(lesson) && (
          <button onClick={() => onOpenVocab(lesson)} className="min-h-[44px] font-bold text-sky-700 underline">
            📖 이 Lesson 단어 학습하기
          </button>
        )}
        {text && !notReady && (
          <button onClick={() => { setDraft(null); setMode("review"); }} className="min-h-[44px] text-gray-600 underline">
            본문·문장쓰기 확인/수정
          </button>
        )}
        {!builtin && (
          <button onClick={() => setMode("roles")} className="min-h-[44px] text-gray-600 underline">
            페이지 역할 수정
          </button>
        )}
        {text && (!builtin || text.status === "confirmed" && text.confirmedAt) ? (
          <button
            onClick={() => {
              const msg = builtin
                ? "고쳐서 저장한 내용을 지우고 처음 확인해 둔 본문으로 되돌릴까요?"
                : "저장된 본문과 확인한 내용을 지울까요? (다시 가져와야 해요)";
              if (!confirm(msg)) return;
              clearBookText(book, lesson);
              setText(loadBookText(book, lesson));
              autoPush();
            }}
            className="min-h-[44px] text-gray-400 underline"
          >
            {builtin ? "처음 본문으로 되돌리기" : "저장된 본문 지우기"}
          </button>
        ) : null}
      </div>
    </div>
  );
}
