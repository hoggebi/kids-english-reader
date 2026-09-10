"use client";

import { useEffect, useRef, useState } from "react";
import type { VocabWord } from "@/lib/types";
import { loadPet, getPetImagePath } from "@/lib/pet";
import { shuffle, buildOptions, playTone } from "./VocabGame";

const D = "/assets/dart-game";

type Direction = "toEng" | "toKor";
type SpecialKind = "basic" | "power" | "fire" | "ice" | "lightning";
type Zone = "perfect" | "good" | "normal" | "miss";
type Phase = "ready" | "go" | "question" | "throwLabel" | "power" | "flight" | "impact" | "recover" | "result";
type RoundBanner = "bonus" | "final" | null;

const DART_IMG: Record<SpecialKind, string> = {
  basic: `${D}/darts/dart_basic.svg`,
  power: `${D}/darts/dart_power.svg`,
  fire: `${D}/darts/dart_fire.svg`,
  ice: `${D}/darts/dart_ice.svg`,
  lightning: `${D}/darts/dart_lightning.svg`,
};
const FX_IMG: Record<Exclude<SpecialKind, "basic">, string> = {
  power: `${D}/effects/fx_impact.svg`,
  fire: `${D}/effects/fx_fire_hit.svg`,
  ice: `${D}/effects/fx_ice_hit.svg`,
  lightning: `${D}/effects/fx_lightning_hit.svg`,
};
const BOARD_IMG = `${D}/ui/dart_board.svg`;
const BADGE_IMG = {
  bullseye: `${D}/badges/badge_bullseye.svg`,
  perfect: `${D}/badges/badge_perfect.svg`,
  combo3: `${D}/badges/badge_combo_3.svg`,
  combo5: `${D}/badges/badge_combo_5.svg`,
  combo7: `${D}/badges/badge_combo_7.svg`,
};

const ROUND_COUNT = 10;
const BONUS_ROUND_INDEX = 5; // 1~5문제 후(6번째 문제) BONUS ROUND
const FINAL_ROUND_INDEX = 9; // 10번째 문제(0-indexed 9) FINAL THROW

// ---------- 타이밍 상수 (ms) ----------
const T_READY = 700;
const T_GO = 500;
const T_THROW_LABEL = 500;
const T_FLIGHT = 780;
const T_IMPACT = 550;
const T_SCORE_POPUP = 1000;
const T_BADGE = 850;
const T_RECOVER = 350;
const T_POWER_AUTO_LOCK = 2500;

function timeLimitSec(prompt: string): number {
  const base = 8;
  if (prompt.includes(" ")) return Math.max(10, base); // 문장형 문제는 최소 10초
  const len = prompt.length;
  if (len >= 11) return base + 4;
  if (len >= 7) return base + 2;
  return base;
}

function computeZone(pct: number): Zone {
  const dist = Math.abs(pct - 50);
  if (dist <= 10) return "perfect";
  if (dist <= 32.5) return "good";
  return "normal";
}

// 정답 여부 + 파워바 판정에 따른 점수
function scoreFor(correct: boolean, zone: Zone): number {
  if (!correct) return 0;
  if (zone === "perfect") return 50;
  if (zone === "good") return 30;
  return 20;
}

// 판정 구역(중심에서 먼 정도)에 따라 다트판 위 착탄 좌표를 계산 (0~100%, 50=정중앙)
function hitPoint(zone: Zone, correct: boolean): { x: number; y: number } {
  const angle = Math.random() * Math.PI * 2;
  let radiusPct: number;
  if (!correct) radiusPct = 34 + Math.random() * 6; // 오답: 바깥쪽이지만 판 안에는 명중
  else if (zone === "perfect") radiusPct = Math.random() * 3;
  else if (zone === "good") radiusPct = 8 + Math.random() * 10;
  else radiusPct = 20 + Math.random() * 10;
  return {
    x: 50 + Math.cos(angle) * radiusPct,
    y: 50 + Math.sin(angle) * radiusPct,
  };
}

type Question = { word: VocabWord; options: VocabWord[]; direction: Direction };

function makeQuestion(words: VocabWord[], target: VocabWord): Question {
  return {
    word: target,
    options: buildOptions(words, target, 3),
    direction: Math.random() < 0.5 ? "toEng" : "toKor",
  };
}

function DartStyles() {
  return (
    <style>{`
      @keyframes dartReadyPop { 0% { transform: scale(0.6); opacity: 0; } 60% { transform: scale(1.15); opacity: 1; } 100% { transform: scale(1); opacity: 1; } }
      @keyframes boardShake { 0% { transform: scale(1); } 35% { transform: scale(1.035); } 70% { transform: scale(0.985); } 100% { transform: scale(1); } }
      @keyframes scorePop { 0% { transform: translate(-50%, 0) scale(0.6); opacity: 0; } 25% { transform: translate(-50%, -8px) scale(1.15); opacity: 1; } 80% { transform: translate(-50%, -22px) scale(1); opacity: 1; } 100% { transform: translate(-50%, -34px) scale(1); opacity: 0; } }
      @keyframes badgePop { 0% { transform: translate(-50%, -50%) scale(0.5) rotate(-8deg); opacity: 0; } 50% { transform: translate(-50%, -50%) scale(1.1) rotate(3deg); opacity: 1; } 100% { transform: translate(-50%, -50%) scale(1) rotate(0deg); opacity: 1; } }
      @keyframes fxPop { 0% { transform: translate(-50%, -50%) scale(0.4); opacity: 0; } 45% { transform: translate(-50%, -50%) scale(1.15); opacity: 1; } 100% { transform: translate(-50%, -50%) scale(1.3); opacity: 0; } }
      @keyframes frostFade { 0% { opacity: 0.85; } 100% { opacity: 0; } }
      .anim-dartReadyPop { animation: dartReadyPop 0.35s ease-out; }
      .anim-boardShake { animation: boardShake 0.4s ease-out; }
      .anim-scorePop { animation: scorePop ${T_SCORE_POPUP}ms ease-out forwards; }
      .anim-badgePop { animation: badgePop ${T_BADGE}ms cubic-bezier(.2,1.4,.4,1) forwards; }
      .anim-fxPop { animation: fxPop ${T_IMPACT}ms ease-out forwards; }
      .anim-frostFade { animation: frostFade 300ms ease-in forwards; }
      @media (prefers-reduced-motion: reduce) {
        .anim-dartReadyPop, .anim-boardShake, .anim-scorePop, .anim-badgePop, .anim-fxPop, .anim-frostFade { animation: none; }
      }
    `}</style>
  );
}

export default function DartGame({
  words,
  onDone,
  onRetry,
}: {
  words: VocabWord[];
  onDone: () => void;
  onRetry: () => void;
}) {
  const [pet] = useState(() => loadPet("vocab"));
  const [queue] = useState<VocabWord[]>(() => {
    const base = shuffle(words);
    const q: VocabWord[] = [];
    while (q.length < ROUND_COUNT) q.push(...base);
    return q.slice(0, ROUND_COUNT);
  });

  const [round, setRound] = useState(0);
  const [question, setQuestion] = useState<Question>(() => makeQuestion(words, queue[0]));
  const [phase, setPhase] = useState<Phase>("ready");
  const [roundBanner, setRoundBanner] = useState<RoundBanner>(round === BONUS_ROUND_INDEX ? "bonus" : null);

  const [combo, setCombo] = useState(0);
  const [bestCombo, setBestCombo] = useState(0);
  const [score, setScore] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [bullseyeCount, setBullseyeCount] = useState(0);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [wasCorrect, setWasCorrect] = useState<boolean | null>(null);
  const [timeLeftMs, setTimeLeftMs] = useState(() => timeLimitSec(promptOf(question)) * 1000);
  const [timeLimitMs, setTimeLimitMs] = useState(() => timeLimitSec(promptOf(question)) * 1000);

  const [dartKind, setDartKind] = useState<SpecialKind>("basic");
  const [dartPos, setDartPos] = useState({ x: 8, y: 92 }); // 시작 위치(캐릭터 방향, 왼쪽 아래)
  const [dartVisible, setDartVisible] = useState(false);
  const [stuckDarts, setStuckDarts] = useState<{ x: number; y: number; kind: SpecialKind; id: number }[]>([]);
  const [fx, setFx] = useState<{ kind: SpecialKind; x: number; y: number; key: number } | null>(null);
  const [scorePopup, setScorePopup] = useState<{ text: string; key: number } | null>(null);
  const [badge, setBadge] = useState<{ img: string; key: number } | null>(null);
  const [boardShakeKey, setBoardShakeKey] = useState(0);
  const [frost, setFrost] = useState(false);

  const [powerPos, setPowerPos] = useState(50);
  const powerPosRef = useRef(50);
  const pendingRef = useRef<{ correct: boolean; specialForThisThrow: SpecialKind } | null>(null);

  // Date.now()는 ms 단위라 짧은 시간에 여러 번 호출되면 값이 겹칠 수 있어 key/id로 쓰기에
  // 안전하지 않다 (실제로 stuckDarts 배열에서 중복 key 경고가 발생했다). 항상 유일하도록
  // 단순 증가 카운터를 쓴다.
  const keySeqRef = useRef(0);
  function nextKey() {
    keySeqRef.current += 1;
    return keySeqRef.current;
  }

  const seqRef = useRef(0);
  function startSeq() {
    seqRef.current += 1;
    return seqRef.current;
  }
  function isCurrentSeq(id: number) {
    return seqRef.current === id;
  }

  function promptOf(q: Question) {
    return q.direction === "toEng" ? q.word.korean : q.word.english;
  }

  // ---------- 라운드 시작: READY -> GO -> (배너) -> question ----------
  function beginRound(idx: number) {
    const w = queue[idx];
    const q = makeQuestion(words, w);
    setQuestion(q);
    setSelectedId(null);
    setWasCorrect(null);
    setDartVisible(false);
    const limitSec = timeLimitSec(promptOf(q));
    setTimeLimitMs(limitSec * 1000);
    setTimeLeftMs(limitSec * 1000);
    setRoundBanner(idx === BONUS_ROUND_INDEX ? "bonus" : idx === FINAL_ROUND_INDEX ? "final" : null);
    setPhase("ready");

    const id = startSeq();
    const at = (ms: number, fn: () => void) =>
      setTimeout(() => {
        if (isCurrentSeq(id)) fn();
      }, ms);
    at(T_READY, () => setPhase("go"));
    at(T_READY + T_GO, () => setPhase("question"));
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 게임 시작 자체가 이 컴포넌트의 목적이라 마운트 시 곧바로 시작한다.
    beginRound(0);
    return () => {
      seqRef.current += 1;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------- 문제 제한시간 카운트다운 ----------
  useEffect(() => {
    if (phase !== "question") return;
    const iv = setInterval(() => {
      setTimeLeftMs((ms) => {
        if (ms <= 100) {
          clearInterval(iv);
          handleAnswer(null);
          return 0;
        }
        return ms - 100;
      });
    }, 100);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, round]);

  // ---------- 파워바: 포인터가 좌우로 왕복, 탭하면 고정 ----------
  useEffect(() => {
    if (phase !== "power") return;
    let pos = 0;
    let dir = 1;
    powerPosRef.current = 0;
    const iv = setInterval(() => {
      pos += dir * 4.2;
      if (pos >= 100) {
        pos = 100;
        dir = -1;
      }
      if (pos <= 0) {
        pos = 0;
        dir = 1;
      }
      powerPosRef.current = pos;
      setPowerPos(pos);
    }, 16);
    const autoLock = setTimeout(() => lockPower(), T_POWER_AUTO_LOCK);
    return () => {
      clearInterval(iv);
      clearTimeout(autoLock);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  function nextSpecialKind(newCombo: number): SpecialKind {
    if (round === BONUS_ROUND_INDEX) return "ice"; // 보너스 라운드는 항상 얼음 다트로 특별하게
    if (newCombo === 7) return "lightning";
    if (newCombo === 5) return "fire";
    if (newCombo === 3) return "power";
    return "basic";
  }

  // ---------- 정답 선택(또는 시간초과 = null) ----------
  function handleAnswer(word: VocabWord | null) {
    if (phase !== "question") return;
    const ok = !!word && word.id === question.word.id;
    setSelectedId(word?.id ?? null);
    setWasCorrect(ok);
    playTone(ok ? "correct" : "wrong");

    const nextCombo = ok ? combo + 1 : 0;
    setCombo(nextCombo);
    setBestCombo((b) => Math.max(b, nextCombo));
    if (ok) setCorrectCount((c) => c + 1);

    const special = ok ? nextSpecialKind(nextCombo) : "basic";
    pendingRef.current = { correct: ok, specialForThisThrow: special };
    setDartKind(special);

    setPhase("throwLabel");
    const id = startSeq();
    setTimeout(() => {
      if (isCurrentSeq(id)) setPhase("power");
    }, T_THROW_LABEL);
  }

  function lockPower() {
    if (phase !== "power") return;
    const pos = powerPosRef.current;
    const zone: Zone = pendingRef.current?.correct ? computeZone(pos) : "miss";
    throwDart(zone);
  }

  // ---------- 다트 투척: 캐릭터 방향에서 다트판까지 실제로 이동 ----------
  function throwDart(zone: Zone) {
    const pending = pendingRef.current;
    if (!pending) return;
    setPhase("flight");
    setDartVisible(true);
    setDartPos({ x: 8, y: 92 });

    const target = hitPoint(zone, pending.correct);
    const id = startSeq();
    const at = (ms: number, fn: () => void) =>
      setTimeout(() => {
        if (isCurrentSeq(id)) fn();
      }, ms);

    // 다음 프레임에 목표 좌표로 옮겨서 실제 "이동"이 보이도록 한다 (트랜지션 트리거).
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (isCurrentSeq(id)) setDartPos(target);
      });
    });

    at(T_FLIGHT, () => {
      setPhase("impact");
      setBoardShakeKey((k) => k + 1);
      setStuckDarts((prev) => [...prev, { x: target.x, y: target.y, kind: pending.specialForThisThrow, id: nextKey() }]);
      setDartVisible(false);

      const isBullseye = pending.correct && zone === "perfect";
      if (pending.specialForThisThrow !== "basic") {
        setFx({ kind: pending.specialForThisThrow, x: target.x, y: target.y, key: nextKey() });
        if (pending.specialForThisThrow === "ice") setFrost(true);
      } else if (pending.correct) {
        setFx({ kind: "power", x: target.x, y: target.y, key: nextKey() }); // fx_impact 기본 사용
      }

      const pts = scoreFor(pending.correct, zone);
      setScore((s) => s + pts);
      if (isBullseye) setBullseyeCount((c) => c + 1);
      setScorePopup({ text: pts > 0 ? `+${pts}` : "MISS", key: nextKey() });

      if (isBullseye) {
        setBadge({ img: BADGE_IMG.bullseye, key: nextKey() });
      } else if (pending.correct && zone === "perfect") {
        setBadge({ img: BADGE_IMG.perfect, key: nextKey() });
      } else if (pending.specialForThisThrow === "power") {
        setBadge({ img: BADGE_IMG.combo3, key: nextKey() });
      } else if (pending.specialForThisThrow === "fire") {
        setBadge({ img: BADGE_IMG.combo5, key: nextKey() });
      } else if (pending.specialForThisThrow === "lightning") {
        setBadge({ img: BADGE_IMG.combo7, key: nextKey() });
      }
    });

    at(T_FLIGHT + 400, () => setFrost(false));
    at(T_FLIGHT + T_IMPACT, () => {
      setFx(null);
      setPhase("recover");
    });
    at(T_FLIGHT + T_IMPACT + T_RECOVER, () => {
      setScorePopup(null);
      setBadge(null);
      const nextRound = round + 1;
      if (nextRound >= ROUND_COUNT) {
        setPhase("result");
      } else {
        setRound(nextRound);
        beginRound(nextRound);
      }
    });
  }

  // ---------- 결과 화면 ----------
  if (phase === "result") {
    const coins = Math.floor(score / 10);
    return (
      <div className="relative rounded-3xl bg-[#0D1726] flex flex-col items-center gap-4 px-6 py-10 text-white">
        <DartStyles />
        <p className="text-2xl font-black tracking-wide">DART RESULT</p>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={getPetImagePath(pet, "vocab")}
          alt="캐릭터"
          className={`w-24 h-24 object-contain ${correctCount >= ROUND_COUNT * 0.6 ? "" : "opacity-80"}`}
        />
        <div className="w-full max-w-xs rounded-2xl bg-[#152338] px-5 py-4 flex flex-col gap-2 text-sm font-bold">
          <div className="flex justify-between">
            <span className="text-[#9FB0C7]">정답</span>
            <span>{correctCount} / {ROUND_COUNT}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#9FB0C7]">BEST COMBO</span>
            <span>{bestCombo}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#9FB0C7]">BULLSEYE</span>
            <span>{bullseyeCount}</span>
          </div>
          <div className="flex justify-between text-[#F0C94E] text-base">
            <span>SCORE</span>
            <span>{score}</span>
          </div>
          <div className="flex justify-between text-[#F0C94E]">
            <span>COINS</span>
            <span>+{coins}</span>
          </div>
        </div>
        <div className="flex gap-2 w-full max-w-xs mt-1">
          <button
            onClick={onRetry}
            className="flex-1 py-3 rounded-full bg-[#273A56] text-white font-bold active:scale-95 transition"
          >
            다시하기
          </button>
          <button
            onClick={onDone}
            className="flex-1 py-3 rounded-full bg-sky-600 text-white font-bold active:scale-95 transition"
          >
            완료
          </button>
        </div>
      </div>
    );
  }

  const promptText = promptOf(question);
  const timePct = Math.max(0, Math.min(100, (timeLeftMs / timeLimitMs) * 100));
  const timeBarColor = timePct > 50 ? "bg-emerald-400" : timePct > 20 ? "bg-yellow-400" : "bg-red-500";

  return (
    <div className="relative rounded-3xl bg-[#0D1726] flex flex-col gap-3 p-4 text-white overflow-hidden">
      <DartStyles />

      {/* 상단: 타이틀 + 진행도 + 점수/콤보 */}
      <div className="flex items-center justify-between">
        <p className="text-sm font-black tracking-wide text-white/90">DART CHALLENGE</p>
        <p className="text-xs font-bold text-[#9FB0C7]">
          {round + 1} / {ROUND_COUNT}
        </p>
      </div>
      <div className="flex items-center justify-between text-xs font-bold">
        <span className="text-[#F0C94E]">SCORE {score}</span>
        <span className="text-white/70">{combo > 0 ? `${combo} COMBO` : ""}</span>
      </div>

      {/* 문제 카드 */}
      <div className="rounded-2xl bg-[#152338] p-4 flex flex-col gap-3">
        <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
          <div
            className={`h-full ${timeBarColor} transition-[width] duration-100 ease-linear`}
            style={{ width: phase === "question" ? `${timePct}%` : "100%" }}
          />
        </div>
        <p className="text-center text-2xl font-black">{promptText}</p>
        <div className="grid grid-cols-1 gap-2">
          {question.options.map((opt) => {
            const label = question.direction === "toEng" ? opt.english : opt.korean;
            const isAnswer = opt.id === question.word.id;
            const isSelected = selectedId === opt.id;
            const showState = wasCorrect !== null;
            let cls = "bg-[#273A56] text-white";
            if (showState && isAnswer) cls = "bg-emerald-500 text-white";
            else if (showState && isSelected && !isAnswer) cls = "bg-red-500/80 text-white";
            return (
              <button
                key={opt.id}
                disabled={phase !== "question"}
                onClick={() => handleAnswer(opt)}
                className={`w-full py-3 rounded-2xl font-bold text-base transition active:scale-95 ${cls} ${
                  phase !== "question" ? "opacity-90" : ""
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* 라운드 배너: BONUS ROUND / FINAL THROW */}
      {roundBanner && (phase === "ready" || phase === "go") && (
        <div className="absolute inset-x-0 top-16 z-30 flex justify-center pointer-events-none">
          <div className="anim-dartReadyPop rounded-full bg-[#F0C94E] text-[#152338] font-black text-sm px-4 py-1.5 shadow-lg">
            {roundBanner === "bonus" ? "🎁 BONUS ROUND" : "🔥 FINAL THROW"}
          </div>
        </div>
      )}

      {/* READY? / GO! 안내 */}
      {(phase === "ready" || phase === "go") && (
        <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none">
          <p className="anim-dartReadyPop text-4xl font-black text-white drop-shadow-lg">
            {phase === "ready" ? "READY?" : "GO!"}
          </p>
        </div>
      )}
      {phase === "throwLabel" && (
        <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none">
          <p className="anim-dartReadyPop text-4xl font-black text-[#F0C94E] drop-shadow-lg">THROW!</p>
        </div>
      )}

      {/* 다트판 무대 */}
      <div className="relative w-full aspect-square max-w-xs mx-auto">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          key={`board-${boardShakeKey}`}
          src={BOARD_IMG}
          alt="다트판"
          className={`absolute inset-0 w-full h-full object-contain ${boardShakeKey > 0 ? "anim-boardShake" : ""}`}
        />
        {frost && (
          <div
            className="anim-frostFade absolute inset-[8%] rounded-full pointer-events-none"
            style={{ background: "radial-gradient(circle, rgba(180,230,255,0.55) 0%, rgba(180,230,255,0) 70%)" }}
          />
        )}

        {/* 판에 꽂힌 다트들 */}
        {stuckDarts.map((d) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={d.id}
            src={DART_IMG[d.kind]}
            alt=""
            className="absolute w-8 h-8 object-contain pointer-events-none"
            style={{ left: `${d.x}%`, top: `${d.y}%`, transform: "translate(-50%, -50%) rotate(-45deg)" }}
          />
        ))}

        {/* 명중 이펙트 */}
        {fx && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={fx.key}
            src={FX_IMG[fx.kind === "basic" ? "power" : fx.kind]}
            alt=""
            className="anim-fxPop absolute pointer-events-none"
            style={{
              left: `${fx.x}%`,
              top: `${fx.y}%`,
              width: fx.kind === "power" ? "42%" : "34%",
              height: fx.kind === "power" ? "42%" : "34%",
            }}
          />
        )}

        {/* 점수 팝업 */}
        {scorePopup && (
          <p
            key={scorePopup.key}
            className={`anim-scorePop absolute left-1/2 bottom-[8%] text-2xl font-black drop-shadow ${
              scorePopup.text === "MISS" ? "text-white/70" : "text-[#F0C94E]"
            }`}
          >
            {scorePopup.text}
          </p>
        )}

        {/* 콤보/명중 배지 */}
        {badge && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={badge.key}
            src={badge.img}
            alt=""
            className="anim-badgePop absolute left-1/2 top-1/2 w-[62%] pointer-events-none"
          />
        )}

        {/* 날아가는 다트 (잔상 포함) */}
        {dartVisible && (
          <>
            {[120, 60, 0].map((delay, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={`trail-${i}`}
                src={DART_IMG[dartKind]}
                alt=""
                className="absolute w-9 h-9 object-contain pointer-events-none"
                style={{
                  left: `${dartPos.x}%`,
                  top: `${dartPos.y}%`,
                  opacity: i === 2 ? 1 : i === 1 ? 0.35 : 0.18,
                  transform: `translate(-50%, -50%) rotate(${-45 + (dartPos.x - 8) * 0.15}deg) scale(${
                    dartPos.x > 60 ? 0.9 : 1
                  })`,
                  transition: `left ${T_FLIGHT}ms ease-in ${delay}ms, top ${T_FLIGHT}ms ease-in ${delay}ms, transform ${T_FLIGHT}ms ease-in ${delay}ms`,
                }}
              />
            ))}
          </>
        )}
      </div>

      {/* 파워바 */}
      {phase === "power" && (
        <div className="relative w-full max-w-xs mx-auto">
          <div className="relative h-8 rounded-full bg-[#182335] border-2 border-[#0A1018] overflow-hidden flex">
            <div className="flex-1 bg-[#5F7590]" style={{ flexGrow: 27.5 }} />
            <div className="bg-[#F45B4A]" style={{ flexGrow: 45 }} />
            <div className="flex-1 bg-[#5F7590]" style={{ flexGrow: 27.5 }} />
          </div>
          <div
            className="absolute top-[-6px] w-1.5 h-10 bg-white rounded-full shadow"
            style={{ left: `calc(${powerPos}% - 3px)` }}
          />
          <button
            onClick={lockPower}
            className="w-full mt-2 py-3 rounded-full bg-[#F0C94E] text-[#152338] font-black active:scale-95 transition"
          >
            탭해서 던지기!
          </button>
        </div>
      )}

      <button
        onClick={onDone}
        className="self-center text-[11px] text-white/50 underline mt-1"
      >
        그만하기
      </button>
    </div>
  );
}
