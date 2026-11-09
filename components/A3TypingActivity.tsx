"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import {
  BACKSPACE,
  TOTAL_ROUNDS,
  advanceTyping,
  buildTarget,
  hasTypo,
  keyFromEvent,
  loadTyping,
  pressFree,
  pressGuided,
  resumeTyping,
  saveTyping,
  type TypingProgress,
  type TypingTarget,
} from "@/lib/a3Typing";
import { loadActivity, shuffleOrder, type LessonText } from "@/lib/chunkLesson";
import { lessonNo } from "@/lib/chunkbookA3";
import { COINS_SENTENCE, completeLesson, earnCoins, isLessonWritten, markLessonRead } from "@/lib/pet";
import { autoPush } from "@/lib/sync";
import PetCompanion from "./PetCompanion";

const GUIDE_COLOR = "#38BDF8";
const SPEAK_RATE = 0.85 * 0.7;
const ROWS = ["qwertyuiop", "asdfghjkl", "zxcvbnm"];
const ROUND_NAMES = ["가이드 타이핑", "스스로 타이핑", "반복 타이핑"];

type View = { prog: TypingProgress; buf: string };

function Key({
  k,
  label,
  guide,
  wrong,
  disabled,
  grow = 1,
  onPress,
}: {
  k: string;
  label: string;
  guide: boolean;
  wrong: boolean;
  disabled?: boolean;
  grow?: number;
  onPress: (k: string) => void;
}) {
  const style: CSSProperties = {
    flexGrow: grow,
    flexBasis: 0,
    height: "clamp(40px, 7.4vh, 60px)",
    touchAction: "manipulation",
    ...(guide ? { borderColor: GUIDE_COLOR, boxShadow: `0 0 0 2px ${GUIDE_COLOR}` } : null),
  };
  return (
    <button
      type="button"
      data-testid={`key-${k === " " ? "space" : k}`}
      data-guide={guide ? "true" : undefined}
      aria-label={k === " " ? "띄어쓰기" : k === BACKSPACE ? "지우기" : k.toUpperCase()}
      disabled={disabled}
      style={style}
      // 터치에서 빠르게 눌러도 놓치지 않도록 누르는 순간 입력한다. 포커스를 가져가지 않는다.
      onPointerDown={(e) => {
        e.preventDefault();
        if (!disabled) onPress(k);
      }}
      // 눌렀던 키에 포커스 테두리가 남으면 하늘색 안내와 헷갈린다
      onMouseDown={(e) => e.preventDefault()}
      // 보조 기기·키보드로 버튼을 활성화한 경우(마우스/터치는 위에서 처리)
      onClick={(e) => {
        if (e.detail === 0 && !disabled) onPress(k);
      }}
      className={`min-w-0 rounded-xl border-2 text-base sm:text-lg font-bold select-none transition-colors disabled:opacity-40 ${
        wrong ? "border-red-400 bg-red-50 text-red-600" : "border-gray-200 bg-white text-gray-800 active:bg-gray-100"
      }`}
    >
      {label}
    </button>
  );
}

function Keyboard({
  showDigits,
  guideKey,
  wrongKey,
  backspaceOn,
  onPress,
}: {
  showDigits: boolean;
  guideKey: string | null;
  wrongKey: string | null;
  backspaceOn: boolean;
  onPress: (k: string) => void;
}) {
  const row = (chars: string) =>
    [...chars].map((c) => <Key key={c} k={c} label={c.toUpperCase()} guide={guideKey === c} wrong={wrongKey === c} onPress={onPress} />);
  return (
    <div className="w-full bg-gray-100 border-t border-gray-200 px-1.5 sm:px-3 py-2" data-testid="typing-keyboard">
      <div className="mx-auto max-w-4xl flex flex-col gap-1 sm:gap-1.5">
        {showDigits && <div className="flex gap-1 sm:gap-1.5">{row("1234567890")}</div>}
        <div className="flex gap-1 sm:gap-1.5">{row(ROWS[0])}</div>
        <div className="flex gap-1 sm:gap-1.5 px-[5%]">{row(ROWS[1])}</div>
        <div className="flex gap-1 sm:gap-1.5">
          <span className="min-w-0" style={{ flexGrow: 1.1, flexBasis: 0 }} aria-hidden />
          {row(ROWS[2])}
          <Key k={BACKSPACE} label="⌫" grow={1.6} guide={false} wrong={false} disabled={!backspaceOn} onPress={onPress} />
        </div>
        <div className="flex justify-center">
          <div className="flex w-3/5">
            <Key k=" " label="SPACE" guide={guideKey === " "} wrong={wrongKey === " "} onPress={onPress} />
          </div>
        </div>
      </div>
    </div>
  );
}

// 입력한 내용을 정답 칸에 맞춰 보여 준다. 문장부호는 앞 글자를 다 치면 자동으로 나타난다.
function TypedLine({ target, buf }: { target: TypingTarget; buf: string }) {
  const out: React.ReactNode[] = [];
  let caretDone = false;
  const caret = (
    <span key="caret" aria-hidden className="inline-block align-middle rounded-full" style={{ width: 3, height: "1.1em", background: GUIDE_COLOR }} />
  );
  target.cells.forEach((c, i) => {
    if (c.slot === -1) {
      const before = target.cells.slice(0, i).filter((x) => x.slot >= 0).length;
      if (before <= buf.length) out.push(<span key={i}>{c.ch}</span>);
      return;
    }
    if (c.slot < buf.length) {
      const ok = buf[c.slot] === target.keys[c.slot];
      out.push(
        ok ? (
          <span key={i}>{c.ch}</span>
        ) : (
          <span key={i} data-typo="true" className="text-red-600 bg-red-100 rounded">
            {buf[c.slot] === " " ? " " : buf[c.slot]}
          </span>
        ),
      );
    } else if (!caretDone) {
      caretDone = true;
      out.push(caret);
    }
  });
  if (!caretDone) out.push(caret);
  return (
    <p className="text-2xl sm:text-3xl font-black text-gray-900 text-center leading-snug whitespace-pre-wrap break-words" data-testid="typing-input">
      {out}
    </p>
  );
}

export default function A3TypingActivity({ lesson, text, onBack }: { lesson: number; text: LessonText; onBack: () => void }) {
  const items = useMemo(
    () => text.writing.map((w) => ({ ...w, target: buildTarget(w.en) })).filter((w) => w.target.keys.length > 0),
    [text],
  );
  const n = items.length;

  const [view, setView] = useState<View>(() => ({ prog: resumeTyping(loadTyping(lesson), n), buf: "" }));
  // 빠른 연속 입력에서도 최신 상태로 판정하도록 입력 처리는 ref를 기준으로 한다.
  const viewRef = useRef(view);
  const [notice, setNotice] = useState<string | null>(null);
  const [wrongKey, setWrongKey] = useState<string | null>(null);
  const [petTick, setPetTick] = useState(0);
  const [cheer, setCheer] = useState<string | null>(null);
  const wrongTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const commit = useCallback((v: View) => {
    viewRef.current = v;
    setView(v);
  }, []);

  useEffect(() => {
    saveTyping(lesson, view.prog);
  }, [lesson, view.prog]);

  const stopSpeech = () => {
    try {
      window.speechSynthesis?.cancel();
    } catch {
      /* ignore */
    }
  };

  const finishRound = useCallback(
    (prog: TypingProgress, en: string) => {
      const step = advanceTyping(prog, n);
      if (!step.sentenceDone) {
        commit({ prog: step.next, buf: "" });
        setNotice(step.next.round === 1 ? `✓ 1/${TOTAL_ROUNDS} 완료! 이제 안내 없이 직접 입력해요.` : `✓ 2/${TOTAL_ROUNDS} 완료! 한 번 더 입력해요.`);
        return;
      }
      // 보상 여부를 먼저 저장해서, 어떤 경우에도 같은 문장으로 두 번 받지 않게 한다.
      const firstTime = !isLessonWritten(lesson) && !prog.rewarded.includes(en);
      const next = firstTime ? { ...step.next, rewarded: [...prog.rewarded, en] } : step.next;
      saveTyping(lesson, next);
      commit({ prog: next, buf: "" });

      let msg = "잘했어, 호야!";
      if (firstTime) {
        const r = earnCoins(COINS_SENTENCE, "chapter");
        if (r.granted) msg = `🪙 +${r.granted} 잘했어, 호야!`;
        else if (r.capped) msg = "오늘 코인을 다 모았어! 내일 또 만나자!";
      }
      if (step.lessonDone) {
        const readDone = (loadActivity(lesson)?.listens ?? 0) > 0;
        if (isLessonWritten(lesson)) {
          // 이미 쓰기 완료한 Lesson: 성장·코인은 다시 주지 않고, 읽기까지 끝났다면 완료 표시만 맞춘다.
          if (readDone) markLessonRead(lesson);
        } else {
          const done = completeLesson(lesson, readDone);
          if (done.graduated) msg = "다 컸어! 새 친구를 만나러 가자! 도감을 확인해 봐!";
          else if (done.grew) msg = `와! Lesson ${lessonNo(lesson)} 끝! 나 쑥 자랐어! ${done.firstStamp ? "완료 ✓ " : ""}🪙 +${done.coins}`;
          else if (done.firstStamp) msg = `Lesson ${lessonNo(lesson)} 완료 ✓ 잘했어, 호야!`;
        }
      }
      setCheer(msg);
      setPetTick((t) => t + 1);
      setNotice(step.lessonDone ? null : `✓ 문장 완료! ${msg}`);
      autoPush();
    },
    [commit, lesson, n],
  );

  const press = useCallback(
    (k: string) => {
      const cur = viewRef.current;
      if (cur.prog.completed || n === 0) return;
      const item = items[cur.prog.order[cur.prog.pos]];
      const keys = item.target.keys;
      let buf = cur.buf;
      if (cur.prog.round === 0) {
        const r = pressGuided(keys, buf, k);
        if (!r.ok) {
          setNotice("다시 한번! 하늘색 키를 찾아 보세요.");
          setWrongKey(k);
          if (wrongTimer.current) clearTimeout(wrongTimer.current);
          wrongTimer.current = setTimeout(() => setWrongKey(null), 300);
          return;
        }
        buf = r.buf;
      } else {
        buf = pressFree(keys, buf, k);
      }
      if (buf === keys) {
        finishRound(cur.prog, item.en);
        return;
      }
      setNotice(null);
      commit({ ...cur, buf });
    },
    [commit, finishRound, items, n],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable)) return;
      const k = keyFromEvent(e);
      if (k === null) return;
      e.preventDefault(); // 스페이스로 화면이 내려가거나 포커스된 버튼이 눌리지 않게 한다
      if (e.repeat && k !== BACKSPACE) return;
      press(k);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [press]);

  useEffect(
    () => () => {
      stopSpeech();
      if (wrongTimer.current) clearTimeout(wrongTimer.current);
    },
    [],
  );

  function speak(s: string) {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    stopSpeech();
    const u = new SpeechSynthesisUtterance(s);
    u.lang = "en-US";
    u.rate = SPEAK_RATE;
    window.speechSynthesis.speak(u);
  }

  function restart() {
    setNotice(null);
    setCheer(null);
    commit({ prog: { ...viewRef.current.prog, order: shuffleOrder(n, viewRef.current.prog.order), pos: 0, round: 0, completed: false }, buf: "" });
  }

  if (n === 0) {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-sm text-amber-700">이 Lesson에는 쓸 문장이 아직 없어요.</p>
        <button onClick={onBack} className="self-start min-h-[44px] px-4 rounded-full bg-gray-100 text-gray-700 text-sm font-bold">
          돌아가기
        </button>
      </div>
    );
  }

  if (view.prog.completed) {
    return (
      <div className="flex flex-col items-center gap-4 py-6 text-center" data-testid="typing-done">
        <div className="w-full text-left">
          <PetCompanion tick={petTick} message={cheer} popping />
        </div>
        <p className="text-2xl font-bold text-sky-600">다 썼어요! 🎉</p>
        <p className="text-sm text-gray-500">Lesson {lessonNo(lesson)}의 문장 {n}개를 3번씩 모두 입력했어요.</p>
        <div className="flex flex-wrap justify-center gap-2">
          <button onClick={restart} className="min-h-[48px] px-5 rounded-full bg-sky-600 text-white text-sm font-bold">
            다시 연습하기
          </button>
          <button onClick={onBack} className="min-h-[48px] px-5 rounded-full bg-gray-100 text-gray-700 text-sm font-bold">
            Lesson으로
          </button>
        </div>
      </div>
    );
  }

  const { prog, buf } = view;
  const item = items[prog.order[prog.pos]];
  const keys = item.target.keys;
  const guided = prog.round === 0;
  const typo = !guided && hasTypo(keys, buf);
  const next = keys[buf.length] ?? null;
  const status = typo
    ? "빨간 글자를 ⌫로 지우고 고쳐 보세요."
    : notice ?? (guided ? (next === " " ? "띄어쓰기예요. SPACE를 눌러요." : "하늘색 키를 눌러 보세요.") : "영어 문장을 직접 입력해 보세요.");

  return (
    <div className="fixed inset-0 z-40 bg-white flex flex-col" data-testid="typing-activity">
      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="mx-auto w-full max-w-3xl px-4 py-3 flex flex-col items-center gap-3">
          <div className="w-full flex items-center justify-between">
            <button onClick={onBack} className="min-h-[44px] text-sm text-gray-500 underline">
              ← Lesson {lessonNo(lesson)}
            </button>
            <span className="text-sm font-bold text-gray-700" data-testid="typing-sentence-progress">
              문장 {prog.pos + 1} / {n}
            </span>
            <button
              onClick={() => speak(item.en)}
              className="min-h-[44px] px-4 rounded-full bg-gray-100 text-gray-700 text-sm font-bold"
            >
              🔈 듣기
            </button>
          </div>

          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-full bg-sky-600 text-white text-sm font-black" data-testid="typing-round">
              {prog.round + 1}/{TOTAL_ROUNDS}
            </span>
            <span className="text-sm font-bold text-gray-700">{ROUND_NAMES[prog.round]}</span>
          </div>

          <div className="w-full rounded-2xl bg-gray-50 px-5 py-4 flex flex-col items-center gap-1 text-center">
            <p className="text-lg font-bold text-sky-700" data-testid="typing-ko">{item.ko}</p>
            <p className="text-2xl sm:text-3xl font-black text-gray-900 leading-snug" data-testid="typing-en">{item.en}</p>
          </div>

          <div className="w-full min-h-[76px] rounded-2xl border-2 border-gray-200 px-5 py-3 flex items-center justify-center">
            <TypedLine target={item.target} buf={buf} />
          </div>

          <p role="status" className={`text-sm font-bold ${typo ? "text-red-600" : "text-gray-600"}`} data-testid="typing-status">
            {status}
          </p>
        </div>
      </div>
      <Keyboard
        showDigits={/[0-9]/.test(keys)}
        guideKey={guided ? next : null}
        wrongKey={wrongKey}
        backspaceOn={!guided && buf.length > 0}
        onPress={press}
      />
    </div>
  );
}
