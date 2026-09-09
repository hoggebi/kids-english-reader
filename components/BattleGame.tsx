"use client";

import { useEffect, useState } from "react";
import type { VocabWord } from "@/lib/types";
import { nextMonster, type Monster } from "@/lib/monsters";
import { shuffle, buildOptions, playTone } from "./VocabGame";

type Feedback = "correct" | "wrong" | null;
type Direction = "toEng" | "toKor";
type AttackStyle = "dash" | "swoop" | "lowdash";
type EntranceKind = "normal" | "warning" | "boss";
type Phase = "vs" | "battle" | "ko" | "gameover";
type TeamId = "tiger" | "eagle" | "panther";

const A = "/assets/monster-battle";
const PLAYER_MAX_HP = 3;
const TEAM_ORDER: TeamId[] = ["tiger", "eagle", "panther"];

const TEAM_INFO: Record<TeamId, { name: string; idle: string; attack: string; style: AttackStyle }> = {
  tiger: { name: "호랑이", idle: `${A}/characters/tiger_idle.png`, attack: `${A}/characters/tiger_attack.png`, style: "dash" },
  eagle: { name: "독수리", idle: `${A}/characters/eagle_idle.png`, attack: `${A}/characters/eagle_attack.png`, style: "swoop" },
  panther: { name: "흑표범", idle: `${A}/characters/panther_idle.png`, attack: `${A}/characters/panther_attack.png`, style: "lowdash" },
};

const CARD_ART = [`${A}/ui/cards/card_slash.png`, `${A}/ui/cards/card_fire.png`, `${A}/ui/cards/card_dash.png`];

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

function rollEntrance(isBoss: boolean): EntranceKind {
  if (isBoss) return "boss";
  return Math.random() < 0.22 ? "warning" : "normal";
}

// 일반 몬스터는 3~4번 정답을 맞혀야 쓰러지도록 살짝 랜덤하게 필요 타수를 정한다.
function rollHitsNeeded(monster: Monster): number {
  return monster.isBoss ? monster.hp : 3 + Math.floor(Math.random() * 2);
}

function BattleStyles() {
  return (
    <style>{`
      @keyframes vsPop { 0% { transform: scale(0.5); opacity: 0; } 60% { transform: scale(1.1); opacity: 1; } 100% { transform: scale(1); opacity: 1; } }
      @keyframes panelPop { 0% { transform: translateY(8px) scale(0.7); opacity: 0; } 40% { transform: translateY(0) scale(1.08); opacity: 1; } 100% { transform: translateY(0) scale(1); opacity: 1; } }
      @keyframes introDarken { 0% { opacity: 0.65; } 100% { opacity: 0; } }
      @keyframes screenShake { 0%, 100% { transform: translateX(0); } 25% { transform: translateX(-6px); } 50% { transform: translateX(6px); } 75% { transform: translateX(-4px); } }
      @keyframes cardLunge { 0% { transform: translateY(0) scale(1); } 40% { transform: translateY(-10px) scale(1.06); } 100% { transform: translateY(-10px) scale(1.06); } }
      @keyframes atkDash { 0%, 100% { transform: translateX(0); } 40%, 60% { transform: translateX(30px); } }
      @keyframes atkLowDash { 0%, 100% { transform: translateX(0) translateY(4px); } 35%, 60% { transform: translateX(34px) translateY(4px); } }
      @keyframes atkSwoop { 0% { transform: translate(0, 0); } 30% { transform: translate(-4px, -20px); } 65% { transform: translate(28px, 10px); } 100% { transform: translate(0, 0); } }
      @keyframes fxPop { 0% { transform: scale(0.4); opacity: 0; } 40% { transform: scale(1.1); opacity: 1; } 100% { transform: scale(1.3); opacity: 0; } }
      @keyframes monsterHitSm { 0%, 100% { transform: translateX(0) rotate(0deg); } 20% { transform: translateX(-14px) rotate(-4deg); } 45% { transform: translateX(6px) rotate(3deg); } 70% { transform: translateX(-3px) rotate(-1deg); } }
      @keyframes monsterHitBig { 0%, 100% { transform: translateX(0) rotate(0deg) scale(1); } 15% { transform: translateX(-26px) rotate(-8deg) scale(0.94); } 40% { transform: translateX(14px) rotate(7deg) scale(1.05); } 65% { transform: translateX(-8px) rotate(-4deg) scale(0.98); } 85% { transform: translateX(4px) rotate(2deg) scale(1.01); } }
      @keyframes monsterKO { 0% { transform: translateY(0) scale(1) rotate(0deg); opacity: 1; } 100% { transform: translateY(60px) scale(0.35) rotate(30deg); opacity: 0; } }
      @keyframes playerRecoil { 0%, 100% { transform: translateX(0); } 30% { transform: translateX(-14px) rotate(-6deg); } 60% { transform: translateX(4px) rotate(2deg); } }
      @keyframes monsterLunge { 0%, 100% { transform: translateX(0); } 50% { transform: translateX(-40px); } }
      @keyframes auraPulse { 0%, 100% { opacity: 0.55; transform: scale(1); } 50% { opacity: 0.8; transform: scale(1.08); } }
      .anim-vsPop { animation: vsPop 0.4s ease-out; }
      .anim-panelPop { animation: panelPop 0.4s ease-out; }
      .anim-introDarken { animation: introDarken 1.1s ease-out forwards; }
      .anim-screenShake { animation: screenShake 0.3s ease-out; }
      .anim-cardLunge { animation: cardLunge 0.35s ease-out forwards; }
      .anim-atk-dash { animation: atkDash 0.4s ease-out; }
      .anim-atk-lowdash { animation: atkLowDash 0.3s ease-out; }
      .anim-atk-swoop { animation: atkSwoop 0.5s ease-out; }
      .anim-fxPop { animation: fxPop 0.45s ease-out forwards; }
      .anim-monsterHitSm { animation: monsterHitSm 0.4s ease-out; }
      .anim-monsterHitBig { animation: monsterHitBig 0.5s ease-out; }
      .anim-monsterKO { animation: monsterKO 0.7s ease-in forwards; }
      .anim-playerRecoil { animation: playerRecoil 0.4s ease-out; }
      .anim-monsterLunge { animation: monsterLunge 0.4s ease-in-out; }
      .anim-auraPulse { animation: auraPulse 1.8s ease-in-out infinite; }
      @media (prefers-reduced-motion: reduce) {
        .anim-vsPop, .anim-panelPop, .anim-introDarken, .anim-screenShake, .anim-cardLunge,
        .anim-atk-dash, .anim-atk-lowdash, .anim-atk-swoop, .anim-fxPop,
        .anim-monsterHitSm, .anim-monsterHitBig, .anim-monsterKO, .anim-playerRecoil, .anim-monsterLunge, .anim-auraPulse { animation: none; }
      }
    `}</style>
  );
}

function bgFor(isBoss: boolean) {
  return isBoss ? `${A}/backgrounds/boss_bg.png` : `${A}/backgrounds/battle_bg.png`;
}

function PipBar({ value, max }: { value: number; max: number }) {
  return (
    <div className="flex gap-1">
      {Array.from({ length: max }).map((_, i) => (
        <div
          key={i}
          className={`h-3 flex-1 rounded-full transition-colors duration-300 ${i < value ? "bg-red-500" : "bg-white/70"}`}
        />
      ))}
    </div>
  );
}

function HeartRow({ hp }: { hp: number }) {
  return (
    <div className="flex gap-1">
      {Array.from({ length: PLAYER_MAX_HP }).map((_, i) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img key={i} src={`${A}/ui/icons/${i < hp ? "heart" : "heart_empty"}.png`} alt="" className="w-5 h-5" />
      ))}
    </div>
  );
}

export default function BattleGame({
  words,
  onDone,
}: {
  words: VocabWord[];
  onDone: () => void;
  onRetry: () => void;
}) {
  const [team, setTeam] = useState<TeamId[]>(["tiger"]);
  const [attackerIndex, setAttackerIndex] = useState(0);
  const [activeAttacker, setActiveAttacker] = useState<TeamId | null>(null);
  const [defeatedTotal, setDefeatedTotal] = useState(0);
  const [defeatedCount, setDefeatedCount] = useState(0);
  const [monster, setMonster] = useState<Monster>(() => nextMonster(0));
  const [monsterMaxHp, setMonsterMaxHp] = useState(3);
  const [monsterHp, setMonsterHp] = useState(3);
  const [playerHp, setPlayerHp] = useState(PLAYER_MAX_HP);
  const [question, setQuestion] = useState<Question | null>(() =>
    words.length >= 3 ? makeQuestion(words, null) : null
  );
  const [combo, setCombo] = useState(0);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [monsterHitKey, setMonsterHitKey] = useState(0);
  const [playerHitKey, setPlayerHitKey] = useState(0);
  const [teamAttackActive, setTeamAttackActive] = useState(false);
  const [joinLabel, setJoinLabel] = useState<string | null>(null);
  const [fxKind, setFxKind] = useState<"slash" | "critical" | null>(null);
  const [fxKey, setFxKey] = useState(0);
  const [entranceKind, setEntranceKind] = useState<EntranceKind>("normal");
  const [screenShakeKey, setScreenShakeKey] = useState(0);
  const [phase, setPhase] = useState<Phase>("vs");

  // 첫 몬스터도 HP 랜덤 타수/등장 연출이 제대로 적용되도록 마운트 시 한 번 다시 굴린다.
  useEffect(() => {
    beginEncounter(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (phase !== "vs") return;
    const t = setTimeout(() => setPhase("battle"), entranceKind === "normal" ? 850 : 1400);
    return () => clearTimeout(t);
  }, [phase, entranceKind]);

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

  function beginEncounter(count: number) {
    const m = nextMonster(count);
    const hits = rollHitsNeeded(m);
    setMonster(m);
    setMonsterMaxHp(hits);
    setMonsterHp(hits);
    setEntranceKind(rollEntrance(!!m.isBoss));
    setQuestion(makeQuestion(words, question?.word.id ?? null));
    setFeedback(null);
    setSelectedId(null);
    setPhase("vs");
  }

  function handleRetryRun() {
    setDefeatedCount(0);
    setTeam(["tiger"]);
    setAttackerIndex(0);
    setPlayerHp(PLAYER_MAX_HP);
    setCombo(0);
    setDefeatedTotal(0);
    beginEncounter(0);
  }

  function answer(word: VocabWord) {
    if (!question || feedback) return;
    const ok = word.id === question.word.id;
    setSelectedId(word.id);
    playTone(ok ? "correct" : "wrong");

    if (ok) {
      setFeedback("correct");
      const nextCombo = combo + 1;

      // setState 업데이터가 이 자리에서 곧바로 실행되지 않으므로, team/combo는
      // 현재 state 값을 직접 읽어 다음 값을 계산한다 (다른 값들과 동일한 방식).
      let joinedId: TeamId | null = null;
      let nextTeam = team;
      if (nextCombo === 2 && team.length < 2) {
        joinedId = TEAM_ORDER[1];
        nextTeam = [...team, joinedId];
      }
      const teamAttack = nextCombo === 3;
      if (teamAttack && team.length < 3) {
        joinedId = TEAM_ORDER[2];
        nextTeam = [...team, joinedId];
      }
      if (nextTeam !== team) setTeam(nextTeam);

      const damage = teamAttack ? 2 : 1;
      const newHp = Math.max(0, monsterHp - damage);
      setMonsterHp(newHp);

      if (joinedId) {
        setJoinLabel(`${TEAM_INFO[joinedId].name} 합류!`);
        setTimeout(() => setJoinLabel(null), 900);
      }

      setFxKind(teamAttack || monster.isBoss ? "critical" : "slash");
      setFxKey((k) => k + 1);
      setMonsterHitKey((k) => k + 1);

      if (teamAttack) {
        setTeamAttackActive(true);
        setScreenShakeKey((k) => k + 1);
        setCombo(0);
        setTimeout(() => setTeamAttackActive(false), 650);
      } else {
        const attacker = nextTeam[attackerIndex % nextTeam.length];
        setActiveAttacker(attacker);
        setAttackerIndex((i) => i + 1);
        setCombo(nextCombo);
        setTimeout(() => setActiveAttacker(null), 450);
      }

      setTimeout(
        () => {
          if (newHp <= 0) {
            setPhase("ko");
            setTimeout(() => {
              const nextCount = defeatedCount + 1;
              setDefeatedCount(nextCount);
              setDefeatedTotal(nextCount);
              beginEncounter(nextCount);
            }, 900);
          } else {
            setQuestion(makeQuestion(words, question.word.id));
            setFeedback(null);
            setSelectedId(null);
          }
        },
        teamAttack ? 700 : 550
      );
    } else {
      setCombo(0);
      setFeedback("wrong");
      setScreenShakeKey((k) => k + 1);
      setPlayerHitKey((k) => k + 1);
      const newPlayerHp = Math.max(0, playerHp - 1);
      setPlayerHp(newPlayerHp);

      setTimeout(() => {
        if (newPlayerHp <= 0) {
          setPhase("gameover");
        } else {
          setQuestion(makeQuestion(words, question.word.id));
          setFeedback(null);
          setSelectedId(null);
        }
      }, 650);
    }
  }

  if (phase === "gameover") {
    return (
      <div className="flex flex-col items-center gap-4 py-8">
        <BattleStyles />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`${A}/ui/panels/game_over.png`} alt="TRY AGAIN" className="h-16 anim-panelPop" />
        <p className="text-gray-600 text-sm">이번 판에서 몬스터 {defeatedTotal}마리를 물리쳤어요!</p>
        <div className="flex gap-2 w-full max-w-xs mt-2">
          <button
            onClick={handleRetryRun}
            className="flex-1 py-3 rounded-full bg-sky-600 text-white font-bold active:scale-95 transition"
          >
            다시 시작
          </button>
          <button
            onClick={onDone}
            className="flex-1 py-3 rounded-full bg-gray-100 text-gray-700 font-bold active:scale-95 transition"
          >
            그만하기
          </button>
        </div>
      </div>
    );
  }

  if (phase === "vs") {
    return (
      <div
        className="relative rounded-3xl overflow-hidden p-6 flex flex-col items-center justify-center gap-3 min-h-[22rem] bg-cover bg-center"
        style={{ backgroundImage: `url(${bgFor(!!monster.isBoss)})` }}
      >
        <BattleStyles />
        {entranceKind === "boss" && (
          <div className="absolute inset-0 bg-black anim-introDarken pointer-events-none" />
        )}
        <p className="absolute top-3 left-4 text-[11px] text-white font-bold tracking-widest drop-shadow">
          STAGE {defeatedCount + 1}
        </p>
        <div className="flex items-center justify-center gap-3 anim-vsPop">
          <div className="flex -space-x-3">
            {team.map((id, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={id} src={TEAM_INFO[id].idle} alt="" className="w-14 h-14 object-contain drop-shadow" style={{ zIndex: i }} />
            ))}
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`${A}/ui/panels/vs_panel.png`} alt="VS" className="h-10" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={monster.img}
            alt={monster.name}
            className={`object-contain drop-shadow ${monster.isBoss ? "w-24 h-24" : "w-16 h-16"}`}
          />
        </div>
        {entranceKind === "warning" && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={`${A}/ui/panels/warning_panel.png`} alt="WARNING" className="h-10 anim-panelPop" />
        )}
        {entranceKind === "boss" && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={`${A}/ui/panels/boss_panel.png`} alt="BOSS BATTLE" className="h-12 anim-panelPop" />
        )}
        <p className="text-sm text-white font-bold drop-shadow">{monster.name}</p>
      </div>
    );
  }

  if (!question) return null;

  const promptText = question.direction === "toEng" ? question.word.korean : question.word.english;

  return (
    <div
      key={screenShakeKey}
      className={`relative rounded-3xl overflow-hidden p-4 flex flex-col gap-3 bg-cover bg-center ${
        screenShakeKey > 0 ? "anim-screenShake" : ""
      }`}
      style={{ backgroundImage: `url(${bgFor(!!monster.isBoss)})` }}
    >
      <BattleStyles />

      {teamAttackActive ? (
        <div className="absolute inset-x-0 top-1 z-30 flex justify-center pointer-events-none">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`${A}/ui/panels/team_attack.png`} alt="TEAM ATTACK" className="h-11 anim-panelPop" />
        </div>
      ) : (
        joinLabel && (
          <div className="absolute inset-x-0 top-1 z-30 flex justify-center pointer-events-none">
            <p className="anim-panelPop bg-white/90 rounded-full px-3 py-1 text-sm font-black text-sky-600 tracking-wide shadow">
              {joinLabel}
            </p>
          </div>
        )
      )}

      {/* 상단: 스테이지, 몬스터 이름 + HP, 플레이어 HP */}
      <div className="flex flex-col gap-1 bg-white/70 rounded-2xl p-2">
        <p className="text-[11px] text-gray-500 font-bold tracking-widest">STAGE {defeatedCount + 1}</p>
        <div className="flex items-center justify-between">
          <span className={`font-bold ${monster.isBoss ? "text-red-500" : "text-gray-700"}`}>
            {monster.isBoss ? "👑 " : ""}
            {monster.name}
          </span>
          <span className="text-xs text-gray-400">
            HP {monsterHp}/{monsterMaxHp}
          </span>
        </div>
        <PipBar value={monsterHp} max={monsterMaxHp} />
        <div className="flex items-center justify-between mt-1">
          <span className="text-xs text-gray-500 font-bold">PLAYER HP</span>
          <span key={playerHitKey}>
            <HeartRow hp={playerHp} />
          </span>
        </div>
      </div>

      {/* 중앙: 팀(최대 3명) VS 몬스터 */}
      <div className="relative flex items-center justify-between py-4 px-2">
        <div className="flex items-end gap-1">
          {team.map((id) => {
            const info = TEAM_INFO[id];
            const isAttacking = teamAttackActive || activeAttacker === id;
            const recoilAnim = feedback === "wrong" ? "anim-playerRecoil" : "";
            const atkAnim = isAttacking ? `anim-atk-${info.style}` : "";
            return (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={id}
                src={isAttacking ? info.attack : info.idle}
                alt={info.name}
                className={`object-contain w-14 h-14 drop-shadow ${atkAnim} ${recoilAnim}`}
              />
            );
          })}
        </div>

        {monster.isBoss && phase !== "ko" && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`${A}/effects/dark_aura.png`}
            alt=""
            className="absolute right-2 w-28 h-28 object-contain anim-auraPulse pointer-events-none"
          />
        )}

        {phase === "ko" ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={monster.img}
            alt={monster.name}
            className={`object-contain relative anim-monsterKO ${monster.isBoss ? "w-32 h-32" : "w-20 h-20"}`}
          />
        ) : (
          <>
            {fxKind && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={fxKey}
                src={`${A}/effects/${fxKind}.png`}
                alt=""
                className="absolute right-6 w-16 h-16 object-contain anim-fxPop pointer-events-none z-10"
              />
            )}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              key={`monster-${monsterHitKey}`}
              src={monster.img}
              alt={monster.name}
              className={`object-contain relative ${monster.isBoss ? "w-32 h-32" : "w-20 h-20"} ${
                feedback === "wrong"
                  ? "anim-monsterLunge"
                  : feedback === "correct"
                  ? teamAttackActive || monster.isBoss
                    ? "anim-monsterHitBig"
                    : "anim-monsterHitSm"
                  : ""
              }`}
            />
          </>
        )}
      </div>

      {phase === "ko" && (
        <div className="flex flex-col items-center gap-1 anim-panelPop">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`${A}/ui/panels/${monster.isBoss ? "victory" : "ko"}.png`}
            alt={monster.isBoss ? "VICTORY" : "KO"}
            className={monster.isBoss ? "h-16" : "h-11"}
          />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`${A}/effects/dust.png`} alt="" className="w-16 h-10 object-contain -mt-2 opacity-80" />
        </div>
      )}

      {/* 하단: 문제 + 공격 카드 */}
      {phase !== "ko" && (
        <div className="flex flex-col gap-3">
          <p className="text-center text-lg font-bold text-black bg-white/80 rounded-xl py-1">
            &quot;{promptText}&quot;
          </p>
          <div className="grid grid-cols-3 gap-2">
            {question.options.map((opt, i) => {
              const isCorrectOpt = opt.id === question.word.id;
              const isSelected = selectedId === opt.id;
              const showCorrect = feedback && isCorrectOpt;
              const showWrong = feedback === "wrong" && isSelected && !isCorrectOpt;
              return (
                <button
                  key={opt.id}
                  disabled={!!feedback}
                  onClick={() => answer(opt)}
                  className={`relative rounded-xl overflow-hidden border-2 transition bg-cover bg-center aspect-square ${
                    isSelected ? "anim-cardLunge" : ""
                  } ${
                    showCorrect
                      ? "border-green-400 ring-2 ring-green-400"
                      : showWrong
                      ? "border-red-400 ring-2 ring-red-400"
                      : "border-gray-200 active:scale-95"
                  }`}
                  style={{ backgroundImage: `url(${CARD_ART[i]})`, backgroundColor: "white" }}
                >
                  <span className="absolute inset-x-0 bottom-0 bg-black/60 text-white text-sm font-bold py-1">
                    {question.direction === "toEng" ? opt.english : opt.korean}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <button onClick={onDone} className="self-center text-xs text-gray-500 bg-white/70 rounded-full px-3 py-1">
        그만하기
      </button>
    </div>
  );
}
