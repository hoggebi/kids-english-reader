"use client";

import { useEffect, useRef, useState } from "react";
import type { VocabWord } from "@/lib/types";
import { loadPet, getPetImagePath } from "@/lib/pet";
import { nextMonster, type Monster } from "@/lib/monsters";
import { shuffle, buildOptions, playTone, ComboBadge } from "./VocabGame";

type Feedback = "correct" | "wrong" | null;
type Direction = "toEng" | "toKor";
type AttackTier = "normal" | "dash" | "strong" | "special";
type BattleEvent = "crit" | "dodge" | "stun" | null;

// 이름 마지막 글자 받침 유무에 따라 "을/를" 조사를 골라준다.
function eulReul(name: string): "을" | "를" {
  const last = name.charCodeAt(name.length - 1);
  if (last < 0xac00 || last > 0xd7a3) return "를";
  return (last - 0xac00) % 28 === 0 ? "를" : "을";
}

type Question = {
  word: VocabWord;
  options: VocabWord[];
  direction: Direction;
};

function makeQuestion(words: VocabWord[], avoidId: string | null): Question {
  const pool = words.length > 1 && avoidId ? words.filter((w) => w.id !== avoidId) : words;
  const word = shuffle(pool)[0] ?? words[0];
  return {
    word,
    options: buildOptions(words, word, 3),
    direction: Math.random() < 0.5 ? "toEng" : "toKor",
  };
}

// 콤보 수에 따른 공격 세기 단계. 캐릭터는 하나뿐이고, 콤보가 오를수록 이 단계만 강해진다.
function attackTierFor(combo: number): AttackTier {
  if (combo >= 5) return "special";
  if (combo === 4) return "strong";
  if (combo === 3) return "dash";
  return "normal";
}

const TIER_DAMAGE: Record<AttackTier, number> = { normal: 1, dash: 2, strong: 3, special: 4 };
const TIER_LABEL: Record<AttackTier, string | null> = {
  normal: null,
  dash: null,
  strong: "강공격!",
  special: "필살기!",
};

// 낮은 확률의 랜덤 전투 이벤트 (너무 자주 나오지 않게 확률을 낮게 유지)
function rollBattleEvent(): BattleEvent {
  const r = Math.random();
  if (r < 0.05) return "dodge"; // 5%
  if (r < 0.05 + 0.1) return "crit"; // 10%
  if (r < 0.05 + 0.1 + 0.06) return "stun"; // 6%
  return null;
}

// 보스는 같은 세기의 공격을 받아도 한 단계 더 무겁게 흔들리게 한다.
function bumpForBoss(tier: AttackTier, isBoss: boolean): AttackTier {
  if (!isBoss) return tier;
  if (tier === "normal") return "dash";
  if (tier === "dash") return "strong";
  return "special";
}

// 전투 전용 애니메이션 (정답 맞히기 게임들과 동일한 방식으로 한 번만 렌더)
function BattleStyles() {
  return (
    <style>{`
      @keyframes battleAttackNormal {
        0%, 100% { transform: translateX(0) scale(1); }
        40%, 60% { transform: translateX(26px) scale(1); }
      }
      @keyframes battleAttackDash {
        0%, 100% { transform: translateX(0) scale(1); }
        35%, 55% { transform: translateX(42px) scale(1.05); }
      }
      @keyframes battleAttackStrong {
        0%, 100% { transform: translateX(0) scale(1); }
        30%, 55% { transform: translateX(50px) scale(1.15); }
      }
      @keyframes battleAttackSpecial {
        0% { transform: translateX(0) scale(1) rotate(0deg); }
        30% { transform: translateX(56px) scale(1.25) rotate(-6deg); }
        55% { transform: translateX(56px) scale(1.3) rotate(6deg); }
        100% { transform: translateX(0) scale(1) rotate(0deg); }
      }
      @keyframes monsterHitSm {
        0%, 100% { transform: translateX(0) rotate(0deg); }
        20% { transform: translateX(-14px) rotate(-4deg); }
        45% { transform: translateX(6px) rotate(3deg); }
        70% { transform: translateX(-3px) rotate(-1deg); }
      }
      @keyframes monsterHitMd {
        0%, 100% { transform: translateX(0) rotate(0deg); }
        18% { transform: translateX(-22px) rotate(-7deg); }
        40% { transform: translateX(10px) rotate(5deg); }
        65% { transform: translateX(-6px) rotate(-3deg); }
        85% { transform: translateX(3px) rotate(1deg); }
      }
      @keyframes monsterHitLg {
        0%, 100% { transform: translateX(0) rotate(0deg) scale(1); }
        15% { transform: translateX(-30px) rotate(-9deg) scale(0.93); }
        38% { transform: translateX(14px) rotate(7deg) scale(1.05); }
        60% { transform: translateX(-8px) rotate(-4deg) scale(0.98); }
        82% { transform: translateX(4px) rotate(2deg) scale(1.01); }
      }
      @keyframes screenShake {
        0%, 100% { transform: translateX(0); }
        25% { transform: translateX(-5px); }
        50% { transform: translateX(5px); }
        75% { transform: translateX(-3px); }
      }
      @keyframes bossPop {
        0% { transform: scale(0.4); opacity: 0; }
        60% { transform: scale(1.1); opacity: 1; }
        100% { transform: scale(1); opacity: 1; }
      }
      @keyframes monsterDie {
        0% { transform: translateY(0) scale(1) rotate(0deg); opacity: 1; }
        100% { transform: translateY(-50px) scale(0.3) rotate(25deg); opacity: 0; }
      }
      @keyframes floatLabelPop {
        0% { transform: translate(-50%, -50%) scale(0.5); opacity: 0; }
        30% { transform: translate(-50%, -60%) scale(1.15); opacity: 1; }
        100% { transform: translate(-50%, -85%) scale(1); opacity: 0; }
      }
      @keyframes hitFlash {
        0% { opacity: 0.55; }
        100% { opacity: 0; }
      }
      .battle-attack-normal { animation: battleAttackNormal 0.4s ease-out; }
      .battle-attack-dash { animation: battleAttackDash 0.42s ease-out; }
      .battle-attack-strong { animation: battleAttackStrong 0.46s ease-out; }
      .battle-attack-special { animation: battleAttackSpecial 0.55s ease-out; }
      .monster-hit-sm { animation: monsterHitSm 0.4s ease-out; }
      .monster-hit-md { animation: monsterHitMd 0.45s ease-out; }
      .monster-hit-lg { animation: monsterHitLg 0.5s ease-out; }
      .monster-die { animation: monsterDie 0.5s ease-in forwards; }
      .screen-shake { animation: screenShake 0.3s ease-out; }
      .boss-pop { animation: bossPop 0.5s ease-out; }
      .float-label { animation: floatLabelPop 0.8s ease-out forwards; }
      .hit-flash { animation: hitFlash 0.35s ease-out forwards; }
      @media (prefers-reduced-motion: reduce) {
        .battle-attack-normal, .battle-attack-dash, .battle-attack-strong, .battle-attack-special,
        .monster-hit-sm, .monster-hit-md, .monster-hit-lg, .monster-die, .screen-shake, .boss-pop,
        .float-label, .hit-flash { animation: none; }
      }
    `}</style>
  );
}

// 몬스터 얼굴: img가 있으면 이미지, 없으면 이모지로 보여준다 (캐릭터 교체가 쉽도록 분리).
function MonsterFace({
  monster,
  className,
  animationClass,
  tintClass,
}: {
  monster: Monster;
  className: string;
  animationClass?: string;
  tintClass?: string;
}) {
  const combined = `${className} ${animationClass ?? ""} ${tintClass ?? ""}`;
  if (monster.img) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={monster.img} alt={monster.name} className={`${combined} object-contain`} />
    );
  }
  return <span className={`select-none ${combined}`}>{monster.emoji}</span>;
}

// HP 비율에 따른 상태감 표현 (새 이미지 없이 CSS 필터/확대만으로)
function enrageTint(hp: number, maxHp: number): string {
  const ratio = hp / maxHp;
  if (ratio <= 0.3) return "saturate-150 brightness-90 scale-110";
  if (ratio <= 0.6) return "saturate-125 scale-105";
  return "";
}

function HpBar({ hp, maxHp }: { hp: number; maxHp: number }) {
  return (
    <div className="flex gap-1">
      {Array.from({ length: maxHp }).map((_, i) => (
        <div
          key={i}
          className={`h-3 flex-1 rounded-full transition-colors duration-300 ${
            i < hp ? "bg-red-500" : "bg-gray-200"
          }`}
        />
      ))}
    </div>
  );
}

function FloatingLabel({ label }: { label: string }) {
  const color =
    label === "CRITICAL!" ? "text-orange-500" : label === "MISS!" ? "text-gray-400" : "text-sky-500";
  return (
    <div
      className={`float-label absolute left-1/2 top-1/3 z-20 font-black text-2xl tracking-wide ${color}`}
    >
      {label}
    </div>
  );
}

export default function BattleGame({
  words,
  onDone,
  onRetry,
}: {
  words: VocabWord[];
  onDone: () => void;
  onRetry: () => void;
}) {
  const [pet] = useState(() => loadPet("vocab"));
  const defeatedCountRef = useRef(0);
  const [monster, setMonster] = useState<Monster>(() => nextMonster(0));
  const [hp, setHp] = useState(monster.hp);
  const [question, setQuestion] = useState<Question | null>(() =>
    words.length >= 3 ? makeQuestion(words, null) : null
  );
  const [combo, setCombo] = useState(0);
  const [bestCombo, setBestCombo] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [charHit, setCharHit] = useState(0);
  const [monsterHit, setMonsterHit] = useState(0);
  const [tier, setTier] = useState<AttackTier>("normal");
  const [eventLabel, setEventLabel] = useState<string | null>(null);
  const [labelKey, setLabelKey] = useState(0);
  const [screenShakeKey, setScreenShakeKey] = useState(0);
  const [phase, setPhase] = useState<"intro" | "battle" | "dying" | "victory">(
    monster.isBoss ? "intro" : "battle"
  );

  useEffect(() => {
    if (phase !== "intro") return;
    const t = setTimeout(() => setPhase("battle"), 1100);
    return () => clearTimeout(t);
  }, [phase]);

  if (words.length < 3) {
    return (
      <div className="flex flex-col items-center gap-4 py-10">
        <p className="text-gray-400">몬스터 배틀을 하려면 학습한 단어가 3개 이상 필요해요.</p>
        <button onClick={onDone} className="px-6 py-2 rounded-full bg-sky-600 text-white font-bold">
          확인
        </button>
      </div>
    );
  }

  function startNextMonster() {
    const count = defeatedCountRef.current;
    const m = nextMonster(count);
    setMonster(m);
    setHp(m.hp);
    setQuestion(makeQuestion(words, question?.word.id ?? null));
    setCombo(0);
    setBestCombo(0);
    setCorrectCount(0);
    setTotalCount(0);
    setFeedback(null);
    setSelectedId(null);
    setEventLabel(null);
    setPhase(m.isBoss ? "intro" : "battle");
  }

  function handleRetryBattle() {
    defeatedCountRef.current = 0;
    onRetry();
  }

  function showEvent(label: string) {
    setEventLabel(label);
    setLabelKey((k) => k + 1);
    setTimeout(() => setEventLabel(null), 750);
  }

  function answer(word: VocabWord) {
    if (!question || feedback) return;
    const ok = word.id === question.word.id;
    setSelectedId(word.id);
    setTotalCount((c) => c + 1);
    playTone(ok ? "correct" : "wrong");

    if (ok) {
      const nextCombo = combo + 1;
      const nextTier = attackTierFor(nextCombo);
      const event = rollBattleEvent();

      let damage = TIER_DAMAGE[nextTier];
      if (event === "crit") damage += 1;
      if (event === "dodge") damage = 0;

      setCombo(nextCombo);
      setBestCombo((b) => Math.max(b, nextCombo));
      setCorrectCount((c) => c + 1);
      setFeedback("correct");
      setTier(nextTier);
      setCharHit((k) => k + 1);
      setMonsterHit((k) => k + 1);

      if (event === "crit") showEvent("CRITICAL!");
      else if (event === "dodge") showEvent("MISS!");
      else if (event === "stun") showEvent("STUN!");
      else if (TIER_LABEL[nextTier]) showEvent(TIER_LABEL[nextTier]!);

      if (nextTier === "strong" || nextTier === "special") {
        setScreenShakeKey((k) => k + 1);
      }

      const newHp = Math.max(0, hp - damage);
      setHp(newHp);

      setTimeout(() => {
        if (newHp <= 0) {
          setPhase("dying");
          setTimeout(() => {
            defeatedCountRef.current += 1;
            setPhase("victory");
          }, 500);
        } else {
          setQuestion(makeQuestion(words, question.word.id));
          setFeedback(null);
          setSelectedId(null);
        }
      }, 550);
    } else {
      setCombo(0);
      setTier("normal");
      setFeedback("wrong");
      setTimeout(() => {
        setQuestion(makeQuestion(words, question.word.id));
        setFeedback(null);
        setSelectedId(null);
      }, 850);
    }
  }

  if (phase === "victory") {
    return (
      <div className="flex flex-col items-center gap-4 py-8">
        <p className="text-3xl font-black text-sky-600 tracking-wide">VICTORY!</p>
        <MonsterFace monster={monster} className="text-6xl w-20 h-20" />
        <p className="text-gray-600">
          {monster.name}
          {eulReul(monster.name)} 물리쳤어요!
        </p>
        <div className="flex gap-6 text-center">
          <div>
            <p className="text-xs text-gray-400">정답</p>
            <p className="text-xl font-bold text-gray-800">
              {correctCount} / {totalCount}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-400">최고 콤보</p>
            <p className="text-xl font-bold text-gray-800">{bestCombo}</p>
          </div>
        </div>
        <div className="flex flex-col gap-2 w-full max-w-xs mt-2">
          <button
            onClick={startNextMonster}
            className="py-3 rounded-full bg-sky-600 text-white font-bold active:scale-95 transition"
          >
            다음 몬스터
          </button>
          <div className="flex gap-2">
            <button
              onClick={handleRetryBattle}
              className="flex-1 py-2.5 rounded-full bg-gray-100 text-gray-700 font-bold"
            >
              다시 하기
            </button>
            <button
              onClick={onDone}
              className="flex-1 py-2.5 rounded-full bg-gray-100 text-gray-700 font-bold"
            >
              게임 종료
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!question) return null;

  const promptText = question.direction === "toEng" ? question.word.korean : question.word.english;
  const effectiveTier = bumpForBoss(tier, monster.isBoss ?? false);
  const monsterHitClass =
    feedback === "correct"
      ? effectiveTier === "special" || effectiveTier === "strong"
        ? "monster-hit-lg"
        : effectiveTier === "dash"
        ? "monster-hit-md"
        : "monster-hit-sm"
      : "";
  const charAttackClass = feedback === "correct" ? `battle-attack-${tier}` : "";

  return (
    <div
      key={screenShakeKey}
      className={`relative rounded-3xl overflow-hidden p-4 flex flex-col gap-4 bg-gray-100 ${
        screenShakeKey > 0 ? "screen-shake" : ""
      }`}
    >
      <BattleStyles />

      {phase === "intro" ? (
        <div className="flex flex-col items-center justify-center gap-2 py-10 boss-pop">
          <MonsterFace monster={monster} className="text-6xl w-24 h-24" />
          <p className="text-2xl font-black text-red-500 tracking-widest">BOSS BATTLE</p>
        </div>
      ) : (
        <>
          {/* 상단: 몬스터 이름 + HP */}
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <span className={`font-bold ${monster.isBoss ? "text-red-500" : "text-gray-700"}`}>
                {monster.isBoss ? "👑 " : ""}
                {monster.name}
              </span>
              <span className="text-xs text-gray-400">
                HP {hp}/{monster.hp}
              </span>
            </div>
            <HpBar hp={hp} maxHp={monster.hp} />
          </div>

          {/* 중앙: 캐릭터 VS 몬스터 (캐릭터는 항상 1명, 콤보에 따라 공격 세기만 달라짐) */}
          <div className="relative flex items-center justify-center gap-8 py-6">
            <ComboBadge combo={combo} />
            {eventLabel && <FloatingLabel key={`label-${labelKey}`} label={eventLabel} />}
            {feedback === "correct" && (tier === "strong" || tier === "special") && (
              <div
                key={`flash-${labelKey}`}
                className="hit-flash absolute inset-0 bg-yellow-200 pointer-events-none"
              />
            )}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              key={`char-${charHit}`}
              src={getPetImagePath(pet, "vocab")}
              alt="캐릭터"
              className={`w-16 h-16 object-contain ${charAttackClass}`}
            />
            {phase === "dying" ? (
              <MonsterFace
                monster={monster}
                className={`${monster.isBoss ? "text-8xl w-32 h-32" : "text-5xl w-20 h-20"} monster-die`}
              />
            ) : (
              <MonsterFace
                key={`monster-${monsterHit}`}
                monster={monster}
                className={monster.isBoss ? "text-8xl w-32 h-32" : "text-5xl w-20 h-20"}
                animationClass={monsterHitClass}
                tintClass={feedback === "correct" ? "" : enrageTint(hp, monster.hp)}
              />
            )}
          </div>

          {/* 하단: 문제 + 선택지 */}
          <div className="flex flex-col gap-3">
            <p className="text-center text-lg font-bold text-black">&quot;{promptText}&quot;</p>
            <div className="flex flex-col gap-2">
              {question.options.map((opt) => {
                const isCorrectOpt = opt.id === question.word.id;
                const isSelected = selectedId === opt.id;
                const showCorrect = feedback && isCorrectOpt;
                const showWrong = feedback === "wrong" && isSelected && !isCorrectOpt;
                return (
                  <button
                    key={opt.id}
                    disabled={!!feedback}
                    onClick={() => answer(opt)}
                    className={`py-3.5 rounded-xl border-2 font-bold text-lg transition ${
                      showCorrect
                        ? "bg-green-100 border-green-400 text-black"
                        : showWrong
                        ? "bg-red-100 border-red-400 text-black"
                        : "bg-white border-gray-200 text-black active:scale-95"
                    }`}
                  >
                    {question.direction === "toEng" ? opt.english : opt.korean}
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
