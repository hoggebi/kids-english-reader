"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ChunkLesson, ChunkbookMeta } from "@/lib/chunkbook";
import { renderPageBase64, type PdfDoc as PdfDocLike } from "@/lib/chunkbook";
import {
  WORKSHEET_FULL_URL,
  bumpListens,
  clearLessonText,
  isValidOrder,
  loadActivity,
  loadLessonText,
  resetRoleOverride,
  resolveRoles,
  saveActivity,
  saveLessonText,
  saveRoleOverride,
  shuffleOrder,
  worksheetStartPage,
  worksheetUrl,
  type BodyLine,
  type LessonActivity,
  type LessonText,
  type PageRoles,
  type WritingItem,
} from "@/lib/chunkLesson";
import { autoPush } from "@/lib/sync";

type Mode = "home" | "read" | "write" | "review" | "roles";

const norm = (s: string) => s.replace(/[“”"‘’']/g, "'").replace(/\s+/g, " ").trim().toLowerCase();

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
  const rowRefs = useRef<(HTMLLIElement | null)[]>([]);
  const supported = speakSupported();

  const stopAll = useCallback(() => {
    token.current += 1;
    if (watchdog.current) clearTimeout(watchdog.current);
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
      if (!speakSupported() || lines.length === 0) return;
      stopAll();
      const tk = token.current;
      setStatus("playing");
      const say = (i: number) => {
        if (tk !== token.current) return;
        if (i >= lines.length) {
          setStatus("ended");
          setEndedThisVisit((n) => n + 1);
          setListens(bumpListens(lesson));
          autoPush();
          return;
        }
        setIdx(i);
        const u = new SpeechSynthesisUtterance(lines[i].en);
        u.lang = "en-US";
        u.rate = 0.9;
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
        watchdog.current = setTimeout(next, 2500 + lines[i].en.length * 110);
        window.speechSynthesis.speak(u);
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
  const sections = lines.map((l) => l.section);

  return (
    <div className="flex flex-col gap-3" data-testid="read-listen">
      <div className="flex items-center justify-between gap-2">
        <button onClick={() => { stopAll(); onBack(); }} className="min-h-[44px] text-sm text-gray-500 underline">
          ← Lesson {lesson}
        </button>
        <p className="text-sm font-bold text-gray-700">읽고 듣기</p>
        <button onClick={() => onOpenPage(text.bodyPages[0])} className="min-h-[44px] text-xs text-sky-700 underline">
          원본 페이지 보기
        </button>
      </div>

      {!supported && <p className="text-sm text-amber-700">이 기기에서는 음성을 쓸 수 없어요. 화면의 문장을 읽어 보세요.</p>}
      {listens > 0 && endedThisVisit === 0 && (
        <button onClick={() => { stopAll(); onWrite(); }} className="self-start min-h-[44px] px-4 rounded-full bg-emerald-600 text-white text-sm font-bold">
          바로 문장 보고 쓰기
        </button>
      )}

      <ul className="flex flex-col gap-2">
        {lines.map((l, i) => {
          const active = i === idx && (status === "playing" || status === "paused");
          const showHeader = l.section === "dialogue" && (i === 0 || sections[i - 1] !== "dialogue");
          return (
            <li
              key={i}
              ref={(el) => {
                rowRefs.current[i] = el;
              }}
              className="flex flex-col gap-1"
            >
              {showHeader && <p className="mt-2 text-xs font-bold text-gray-400">대화 연습</p>}
              <button
                onClick={() => playFrom(i)}
                disabled={!supported}
                aria-label={`${i + 1}번째 문장부터 듣기`}
                className={`w-full text-left rounded-xl border-2 px-4 py-3 transition ${
                  active ? "border-amber-400 bg-amber-100 shadow" : "border-gray-200 bg-white"
                }`}
              >
                <span className="block text-xl font-bold text-gray-900 leading-snug">{l.en}</span>
                <span className="block mt-1 text-sm text-gray-500">{l.ko}</span>
              </button>
            </li>
          );
        })}
      </ul>

      {firstDone && status === "ended" && (
        <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-3 flex flex-col gap-2" data-testid="after-listen">
          <p className="text-sm font-bold text-emerald-800">{endedThisVisit >= 2 ? "두 번 들었어요!" : "한 번 들었어요!"}</p>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => playFrom(0)} className="min-h-[44px] px-4 rounded-full bg-white border border-emerald-300 text-emerald-800 text-sm font-bold">
              {endedThisVisit >= 2 ? "다시 듣기" : "한 번 더 듣기"}
            </button>
            <button onClick={onWrite} className="min-h-[44px] px-4 rounded-full bg-emerald-600 text-white text-sm font-bold">
              문장 보고 쓰기
            </button>
          </div>
        </div>
      )}

      {/* 재생 컨트롤 */}
      <div className="sticky bottom-3 z-10 flex items-center justify-center gap-2 rounded-full bg-gray-900/90 p-2 shadow-lg self-center">
        {status === "playing" ? (
          <button onClick={pause} className="min-h-[44px] px-5 rounded-full bg-white text-gray-900 text-sm font-bold">
            ⏸ 일시정지
          </button>
        ) : (
          <button
            onClick={() => playFrom(status === "paused" && idx >= 0 ? idx : 0)}
            disabled={!supported}
            className="min-h-[44px] px-5 rounded-full bg-sky-500 text-white text-sm font-bold disabled:opacity-50"
          >
            ▶ {status === "paused" ? "이어 듣기" : "재생"}
          </button>
        )}
        <button
          onClick={() => playFrom(0)}
          disabled={!supported}
          className="min-h-[44px] px-4 rounded-full bg-white/15 text-white text-sm font-bold disabled:opacity-50"
        >
          ↺ 다시 듣기
        </button>
      </div>
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
    if (saved && isValidOrder(saved.order, n) && !saved.completed && saved.startedAt > 0) return saved;
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
    u.rate = 0.85;
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
        <p className="text-2xl font-black text-emerald-600">다 썼어요! 🎉</p>
        <p className="text-sm text-gray-500">Lesson {lesson}의 문장 {n}개를 모두 마쳤어요.</p>
        <div className="flex flex-wrap justify-center gap-2">
          <button onClick={restart} className="min-h-[48px] px-5 rounded-full bg-sky-600 text-white text-sm font-bold">
            다시 시작
          </button>
          <a href={worksheetUrl(lesson)} target="_blank" rel="noreferrer" className="min-h-[48px] inline-flex items-center px-5 rounded-full bg-gray-100 text-gray-700 text-sm font-bold">
            학습지 열기
          </a>
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
      <div className="w-full flex items-center justify-between">
        <button onClick={() => { stop(); onBack(); }} className="min-h-[44px] text-sm text-gray-500 underline">
          ← Lesson {lesson}
        </button>
        <span className="text-sm font-bold text-gray-700" data-testid="write-progress">
          {act.pos + 1} / {n}
        </span>
        <a href={worksheetUrl(lesson)} target="_blank" rel="noreferrer" className="min-h-[44px] inline-flex items-center text-xs text-sky-700 underline">
          학습지 열기 / 인쇄
        </a>
      </div>

      <p className="text-sm text-gray-600 text-center">학습지에서 맞는 한국어 뜻을 찾아, 아래에 세 번 써 보세요.</p>

      <div className="w-full max-w-3xl rounded-3xl bg-white border-2 border-gray-200 px-5 py-10 flex flex-col items-center gap-4">
        <p className="text-3xl sm:text-4xl font-black text-gray-900 text-center leading-snug" data-testid="write-sentence">
          {item.en}
        </p>
        {hint && <p className="text-lg font-bold text-sky-700 text-center" data-testid="write-hint">{item.ko}</p>}
      </div>

      <div className="flex flex-wrap justify-center gap-2">
        <button onClick={() => speak(item.en)} disabled={!speakSupported()} className="min-h-[48px] px-5 rounded-full bg-gray-700 text-white text-sm font-bold disabled:opacity-50">
          🔈 문장 듣기
        </button>
        <button onClick={() => setHint((h) => !h)} className="min-h-[48px] px-5 rounded-full bg-amber-100 text-amber-900 text-sm font-bold">
          💡 뜻 힌트 {hint ? "숨기기" : "보기"}
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
        <button onClick={() => go(1)} className={`min-h-[52px] px-6 rounded-full text-white font-bold ${isLast ? "bg-emerald-600" : "bg-sky-600"}`}>
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
      <p className="font-bold text-amber-900">Lesson {lesson} 페이지 역할</p>
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
  const [text, setText] = useState<LessonText | null>(() => loadLessonText(lesson));
  const [roleState, setRoleState] = useState(() => resolveRoles(lesson, lessonDef.pages, book.pageCount));
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
    saveLessonText(t);
    setText(t);
    setDraft(null);
    setMode("home");
    autoPush();
  }

  const confirmed = text?.status === "confirmed";

  // ----- 하위 화면 -----
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
    <div className="flex flex-col gap-3 rounded-2xl border-2 border-sky-200 bg-sky-50 p-4" data-testid="lesson-home">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-lg font-bold text-gray-900">Lesson {lesson}</p>
        <p className="text-xs text-gray-500">
          본문 {roles.body.map(label).join(", ") || "미정"} · 문장쓰기 {roles.writing ? label(roles.writing) : "미정"}
          {roleState.custom && " · 직접 수정함"}
        </p>
      </div>

      {confirmed ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <button onClick={() => setMode("read")} className="min-h-[56px] rounded-2xl bg-sky-600 text-white font-bold text-base">
            🔊 읽고 듣기
          </button>
          <button onClick={() => setMode("write")} className="min-h-[56px] rounded-2xl bg-emerald-600 text-white font-bold text-base">
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
        <a href={worksheetUrl(lesson)} target="_blank" rel="noreferrer" className="min-h-[44px] inline-flex items-center font-bold text-sky-700 underline">
          📄 학습지 열기 / 인쇄
        </a>
        <button onClick={() => onOpenVocab(lesson)} className="min-h-[44px] font-bold text-sky-700 underline">
          📖 이 Lesson 단어 학습하기
        </button>
        {text && (
          <button onClick={() => { setDraft(null); setMode("review"); }} className="min-h-[44px] text-gray-600 underline">
            본문·문장쓰기 확인/수정
          </button>
        )}
        <button onClick={() => setMode("roles")} className="min-h-[44px] text-gray-600 underline">
          페이지 역할 수정
        </button>
        {text && (
          <button
            onClick={() => {
              if (!confirm("저장된 본문과 확인한 내용을 지울까요? (다시 가져와야 해요)")) return;
              clearLessonText(lesson);
              setText(null);
              autoPush();
            }}
            className="min-h-[44px] text-gray-400 underline"
          >
            저장된 본문 지우기
          </button>
        )}
      </div>
      <p className="text-[11px] text-gray-400">
        학습지는 이 Lesson만 2쪽으로 나눈 파일이에요. 전체 학습지는{" "}
        <a href={`${WORKSHEET_FULL_URL}#page=${worksheetStartPage(lesson)}`} target="_blank" rel="noreferrer" className="underline">
          {worksheetStartPage(lesson)}쪽부터
        </a>{" "}
        열 수 있어요.
      </p>
    </div>
  );
}
