"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import {
  FEVER_ASSET,
  FEVER_GAUGE_MAX,
  FEVER_MS,
  complete as feverComplete,
  initialFever,
  retryWrong as feverRetryWrong,
  type FeverEvent,
  type FeverState,
} from "@/lib/fever";

// 공통 FEVER 1단계 UI + 상태 훅. 다트/두더지/몬스터가 같이 쓴다.
// 풀이 시간/판정/점수는 건드리지 않고, 정답 보상 때만 짧은 배너·별 효과를 보여준다.

type Hud = { combo: number; gauge: number; remaining: number };
type BannerKind = "correct" | "gauge" | "ready" | "start" | "end";
// gauge: n = 채워진 칸(평소) 또는 남은 보상 문제 수(FEVER 중). COMBO 표현은 쓰지 않는다.
type BannerState = { kind: BannerKind; n: number; fever: boolean; key: number };
type BurstState = { x: number; y: number; key: number; strong: boolean };

export type FeverCompletion = { event: FeverEvent; enhanced: boolean; combo: number; duplicate: boolean };

const PRELOAD = ["correct.png", "combo.png", "fever-ready.png", "fever-start.png", "fever-end.png"];
// 보상 효과 강도 (공통 설정). 400~700ms, 전체 화면 플래시/점멸 없음.
export const FEVER_FX = { stars: 7, strongStars: 11, ms: 650 };

export type FeverController = {
  hud: Hud;
  layer: ReactNode;
  reset: () => void;
  /** 같은 문제의 중간 오답(재시도). 콤보/게이지만 끊는다. */
  retryWrong: () => void;
  /** 문제의 최종 완료를 한 번만 반영. 반환값의 enhanced = 이 문제가 FEVER 강화 대상이었는지. */
  complete: (questionId: string, correct: boolean, hasNext: boolean) => FeverCompletion;
  /** 정답: 400ms 멈춤 → CORRECT → COMBO(+게이지). 끝나면 resolve. 화면 이탈 시 resolve되지 않는다. */
  playPre: (c: FeverCompletion, o?: { skipPause?: boolean }) => Promise<void>;
  /** 기존 보상이 끝난 뒤: 결과 확인 → READY/START 또는 END. HUD를 최종 상태로 갱신. */
  playPost: (c: FeverCompletion, correct: boolean) => Promise<void>;
  /** 보상 지점에 금색 링 + 별. */
  burst: (x: number, y: number, strong: boolean) => void;
};

export function useFever(): FeverController {
  const stateRef = useRef<FeverState>(initialFever());
  const [hud, setHud] = useState<Hud>({ combo: 0, gauge: 0, remaining: 0 });
  const [banner, setBanner] = useState<BannerState | null>(null);
  const [burstState, setBurstState] = useState<BurstState | null>(null);
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>());
  const keySeq = useRef(0);
  const epoch = useRef(0); // reset/이탈 시 올라가서 진행 중인 연출을 무효화한다

  useEffect(() => {
    const set = timers.current;
    PRELOAD.forEach((f) => {
      const img = new Image();
      img.src = `${FEVER_ASSET}/${f}`;
    });
    return () => {
      epoch.current += 1;
      set.forEach(clearTimeout);
      set.clear();
    };
  }, []);

  const wait = useCallback((ms: number) => {
    return new Promise<void>((resolve) => {
      const id = setTimeout(() => {
        timers.current.delete(id);
        resolve();
      }, ms);
      timers.current.add(id);
    });
  }, []);

  const show = useCallback(
    async (kind: BannerKind, ms: number, n = 0, fever = false) => {
      const ep = epoch.current;
      const key = ++keySeq.current;
      setBanner({ kind, n, fever, key });
      await wait(ms);
      if (epoch.current !== ep) return;
      setBanner((b) => (b && b.key === key ? null : b));
    },
    [wait],
  );

  const reset = useCallback(() => {
    epoch.current += 1;
    timers.current.forEach(clearTimeout);
    timers.current.clear();
    stateRef.current = initialFever();
    setHud({ combo: 0, gauge: 0, remaining: 0 });
    setBanner(null);
    setBurstState(null);
  }, []);

  const syncHud = useCallback(() => {
    const s = stateRef.current;
    setHud({ combo: s.combo, gauge: s.gauge, remaining: s.remaining });
  }, []);

  const retryWrong = useCallback(() => {
    stateRef.current = feverRetryWrong(stateRef.current);
    syncHud();
  }, [syncHud]);

  const complete = useCallback(
    (questionId: string, correct: boolean, hasNext: boolean): FeverCompletion => {
      const r = feverComplete(stateRef.current, { questionId, correct, hasNext });
      stateRef.current = r.state;
      return { event: r.event, enhanced: r.enhanced, combo: r.state.combo, duplicate: r.event === "duplicate" };
    },
    [],
  );

  const playPre = useCallback(
    async (c: FeverCompletion, o?: { skipPause?: boolean }) => {
      if (c.duplicate) return;
      const ep = epoch.current;
      // 완성 단어를 먼저 보여 준 경우(skipPause)에는 그 시간이 이미 정답 확인 구간이므로 멈춤을 또 넣지 않는다.
      if (!o?.skipPause) await wait(FEVER_MS.pause);
      if (epoch.current !== ep) return new Promise<void>(() => {});
      await show("correct", FEVER_MS.correct);
      if (epoch.current !== ep) return new Promise<void>(() => {});
      // 게이지/콤보 반영: 5번째 정답은 가득 찬 5칸을 보여준 뒤 READY로 넘어간다.
      const s = stateRef.current;
      const gauge = c.event === "start" ? FEVER_GAUGE_MAX : s.gauge;
      // 발동 문제는 아직 일반 보상이므로 START 전까지 남은 문제 배지를 띄우지 않는다.
      const remaining = c.enhanced ? s.remaining + 1 : c.event === "start" ? 0 : s.remaining;
      setHud({ combo: s.combo, gauge, remaining });
      await show("gauge", FEVER_MS.combo, c.enhanced ? remaining : gauge, c.enhanced);
      if (epoch.current !== ep) return new Promise<void>(() => {});
    },
    [show, wait],
  );

  const playPost = useCallback(
    async (c: FeverCompletion, correct: boolean) => {
      if (c.duplicate) return;
      const ep = epoch.current;
      if (correct) {
        await wait(FEVER_MS.result);
        if (epoch.current !== ep) return new Promise<void>(() => {});
      }
      if (c.event === "start") {
        await show("ready", FEVER_MS.ready);
        if (epoch.current !== ep) return new Promise<void>(() => {});
        syncHud();
        await show("start", FEVER_MS.start);
      } else if (c.event === "end") {
        syncHud();
        await show("end", FEVER_MS.end);
      } else {
        syncHud();
      }
      if (epoch.current !== ep) return new Promise<void>(() => {});
    },
    [show, syncHud, wait],
  );

  const burst = useCallback((x: number, y: number, strong: boolean) => {
    const key = ++keySeq.current;
    setBurstState({ x, y, key, strong });
    const id = setTimeout(() => {
      timers.current.delete(id);
      setBurstState((b) => (b && b.key === key ? null : b));
    }, FEVER_FX.ms + 100);
    timers.current.add(id);
  }, []);

  const layer = (
    <>
      <FeverStyles />
      {burstState && <FeverBurst key={burstState.key} x={burstState.x} y={burstState.y} strong={burstState.strong} />}
      {banner && <FeverBanner key={banner.key} kind={banner.kind} n={banner.n} fever={banner.fever} />}
    </>
  );

  return { hud, layer, reset, retryWrong, complete, playPre, playPost, burst };
}

// ---------- 화면 조각 ----------

function FeverStyles() {
  return (
    <style>{`
      @keyframes feverEnter { from { opacity: 0; transform: scale(.88); } 30% { opacity: 1; transform: scale(1.04); } to { opacity: 1; transform: scale(1); } }
      @keyframes feverRing { 0% { opacity: .95; transform: translate(-50%, -50%) scale(.3); } 100% { opacity: 0; transform: translate(-50%, -50%) scale(1.5); } }
      @keyframes feverStar { 0% { opacity: 1; transform: translate(-50%, -50%) scale(.5); } 100% { opacity: 0; transform: translate(calc(-50% + var(--fx)), calc(-50% + var(--fy))) scale(1.1) rotate(40deg); } }
      .fever-enter { animation: feverEnter 650ms ease-out both; }
      .fever-ring { animation: feverRing ${FEVER_FX.ms}ms ease-out forwards; }
      .fever-star { animation: feverStar ${FEVER_FX.ms}ms ease-out forwards; }
      @media (prefers-reduced-motion: reduce) {
        .fever-enter { animation: none; }
        .fever-ring, .fever-star { animation: none; opacity: 0; }
      }
    `}</style>
  );
}

const BANNER: Record<BannerKind, { src: string; w: number }> = {
  correct: { src: "correct.png", w: 280 },
  gauge: { src: "gauge-0.svg", w: 200 },
  ready: { src: "fever-ready.png", w: 320 },
  start: { src: "fever-start.png", w: 380 },
  end: { src: "fever-end.png", w: 260 },
};
const BANNER_ALT: Record<BannerKind, string> = {
  correct: "정답!",
  gauge: "FEVER 게이지",
  ready: "FEVER 준비!",
  start: "FEVER 시작! 다음 3문제는 보상이 강화돼요.",
  end: "FEVER 끝",
};

// 질문/입력을 가리지 않도록 보상 영역(화면 위쪽 1/4 부근)에 작게 띄운다. 포인터는 통과.
function FeverBanner({ kind, n, fever }: { kind: BannerKind; n: number; fever: boolean }) {
  const b = BANNER[kind];
  const src = kind === "gauge" ? (fever ? `fever-${Math.max(1, n)}.svg` : `gauge-${n}.svg`) : b.src;
  const alt = kind === "gauge" ? (fever ? `남은 보상 문제 ${n}개` : `FEVER 게이지 ${n}/${FEVER_GAUGE_MAX}`) : BANNER_ALT[kind];
  return (
    <div
      className="pointer-events-none absolute left-0 right-0 flex justify-center"
      style={{ top: "26%", zIndex: 40 }}
      role="status"
      aria-live="polite"
    >
      <div className="fever-enter relative" style={{ width: `min(70vw, ${b.w}px)`, maxWidth: "calc(100vw - 32px - env(safe-area-inset-left) - env(safe-area-inset-right))" }}>
        <span className="sr-only">{alt}</span>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`${FEVER_ASSET}/${src}`} alt="" aria-hidden style={{ width: "100%", height: "auto", objectFit: "contain" }} />
      </div>
    </div>
  );
}

function FeverBurst({ x, y, strong }: { x: number; y: number; strong: boolean }) {
  const n = strong ? FEVER_FX.strongStars : FEVER_FX.stars;
  const base = strong ? 60 : 48; // FEVER 정답은 기본 효과의 약 1.25배
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0" style={{ zIndex: 35 }}>
      <div
        className="fever-ring"
        style={{
          position: "absolute",
          left: x,
          top: y,
          width: base * 2,
          height: base * 2,
          borderRadius: "50%",
          border: "5px solid #ffd93b",
          boxShadow: "0 0 14px rgba(255,217,59,.8)",
        }}
      />
      {Array.from({ length: n }, (_, i) => {
        const a = (i / n) * Math.PI * 2;
        const r = base * (1.1 + (i % 3) * 0.25);
        const style = {
          position: "absolute",
          left: x,
          top: y,
          fontSize: 18 + (i % 3) * 5,
          color: "#ffd93b",
          textShadow: "0 1px 0 #14305f",
          "--fx": `${Math.cos(a) * r}px`,
          "--fy": `${Math.sin(a) * r}px`,
        } as CSSProperties;
        return (
          <span key={i} className="fever-star" style={style}>
            ★
          </span>
        );
      })}
    </div>
  );
}

// 작고 정적인 상태 표시. FEVER 중에는 '남은 보상 문제' 배지, 평소에는 5칸 게이지. 움직이지 않는다.
export function FeverHud({ hud, style, className }: { hud: Hud; style?: CSSProperties; className?: string }) {
  const fever = hud.remaining > 0;
  const n = Math.max(0, Math.min(FEVER_GAUGE_MAX, hud.gauge));
  const label = fever ? `남은 보상 문제 ${hud.remaining}개` : `FEVER 게이지 ${n}/${FEVER_GAUGE_MAX}`;
  return (
    <div
      className={`pointer-events-none flex items-center gap-1.5 ${className ?? ""}`}
      style={style}
      role="img"
      aria-label={`FEVER ${label}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`${FEVER_ASSET}/${fever ? `fever-${hud.remaining}` : `gauge-${n}`}.svg`}
        alt=""
        aria-hidden
        style={{ width: 110, height: "auto", objectFit: "contain" }}
      />
      {fever && (
        <span aria-hidden className="text-[11px] font-black text-white drop-shadow" style={{ textShadow: "0 1px 3px rgba(0,0,0,.7)" }}>
          남은 {hud.remaining}문제
        </span>
      )}
    </div>
  );
}
