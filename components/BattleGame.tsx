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
type AttackKind = "slash" | "fire" | "dash";

const A = "/assets/monster-battle";
const PLAYER_MAX_HP = 3;
const TEAM_ORDER: TeamId[] = ["tiger", "eagle", "panther"];

const TEAM_INFO: Record<TeamId, { name: string; idle: string; attack: string; style: AttackStyle }> = {
  tiger: { name: "호랑이", idle: `${A}/characters/tiger_idle.png`, attack: `${A}/characters/tiger_attack.png`, style: "dash" },
  eagle: { name: "독수리", idle: `${A}/characters/eagle_idle.png`, attack: `${A}/characters/eagle_attack.png`, style: "swoop" },
  panther: { name: "흑표범", idle: `${A}/characters/panther_idle.png`, attack: `${A}/characters/panther_attack.png`, style: "lowdash" },
};

const ATTACK_KINDS: { kind: AttackKind; label: string; img: string }[] = [
  { kind: "slash", label: "SLASH!", img: `${A}/ui/cards/card_slash.png` },
  { kind: "fire", label: "FIRE!", img: `${A}/ui/cards/card_fire.png` },
  { kind: "dash", label: "DASH!", img: `${A}/ui/cards/card_dash.png` },
];

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

function rollAttackKind(): (typeof ATTACK_KINDS)[number] {
  return ATTACK_KINDS[Math.floor(Math.random() * ATTACK_KINDS.length)];
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
      @keyframes slideInLeft { 0% { transform: translateX(-30px); opacity: 0; } 100% { transform: translateX(0); opacity: 1; } }
      @keyframes introDarken { 0% { opacity: 0.65; } 100% { opacity: 0; } }
      @keyframes screenShake { 0%, 100% { transform: translateX(0); } 25% { transform: translateX(-6px); } 50% { transform: translateX(6px); } 75% { transform: translateX(-4px); } }
      @keyframes cardLunge { 0% { transform: translateY(0) scale(1); } 40% { transform: translateY(-6px) scale(1.04); } 100% { transform: translateY(-6px) scale(1.04); } }
      @keyframes popupFade { 0% { transform: translateY(6px) scale(0.7); opacity: 0; } 30% { transform: translateY(0) scale(1.1); opacity: 1; } 100% { transform: translateY(-4px) scale(1); opacity: 0; } }
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
      .anim-slideIn { animation: slideInLeft 0.35s ease-out; }
      .anim-introDarken { animation: introDarken 1.1s ease-out forwards; }
      .anim-screenShake { animation: screenShake 0.3s ease-out; }
      .anim-cardLunge { animation: cardLunge 0.3s ease-out forwards; }
      .anim-popupFade { animation: popupFade 0.65s ease-out forwards; }
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
        .anim-vsPop, .anim-panelPop, .anim-slideIn, .anim-introDarken, .anim-screenShake, .anim-cardLunge, .anim-popupFade,
        .anim-atk-dash, .anim-atk-lowdash, .anim-atk-swoop, .anim-fxPop,
        .anim-monsterHitSm, .anim-monsterHitBig, .anim-monsterKO, .anim-playerRecoil, .anim-monsterLunge, .anim-auraPulse { animation: none; }
      }
    `}</style>
  );
}

function bgFor(isBoss: boolean) {
  return isBoss ? `${A}/backgrounds/boss_bg.png` : `${A}/backgrounds/battle_bg.png`;
}

function HeartRow({ hp }: { hp: number }) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: PLAYER_MAX_HP }).map((_, i) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img key={i} src={`${A}/ui/icons/${i < hp ? "heart" : "heart_empty"}.png`} alt="" className="w-4 h-4" />
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
  const [mainAttacking, setMainAttacking] = useState(false);
  const [monsterHitKey, setMonsterHitKey] = useState(0);
  const [playerHitKey, setPlayerHitKey] = useState(0);
  const [teamAttackActive, setTeamAttackActive] = useState(false);
  const [joinLabel, setJoinLabel] = useState<string | null>(null);
  const [wrongLabelKey, setWrongLabelKey] = useState(0);
  const [attackPopup, setAttackPopup] = useState<(typeof ATTACK_KINDS)[number] | null>(null);
  const [popupKey, setPopupKey] = useState(0);
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
    const t = setTimeout(() => setPhase("battle"), entranceKind === "normal" ? 800 : 1300);
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
        setJoinLabel(`NEW FRIEND! ${TEAM_INFO[joinedId].name}`);
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
        setMainAttacking(true);
        setAttackPopup(rollAttackKind());
        setPopupKey((k) => k + 1);
        setCombo(nextCombo);
        setTimeout(() => setMainAttacking(false), 420);
        setTimeout(() => setAttackPopup(null), 500);
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
      setWrongLabelKey((k) => k + 1);
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
        <div className="absolute inset-0 bg-black/15 pointer-events-none" />
        {entranceKind === "boss" && (
          <div className="absolute inset-0 bg-black anim-introDarken pointer-events-none" />
        )}
        <p className="absolute top-3 left-4 text-[11px] text-white font-bold tracking-widest drop-shadow z-10">
          STAGE {defeatedCount + 1}
        </p>
        <div className="relative flex items-center justify-center gap-3 anim-vsPop">
          <div className="flex flex-col items-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={TEAM_INFO[team[0]].idle} alt="" className="w-16 h-16 object-contain drop-shadow" />
            {team.length > 1 && (
              <div className="flex gap-1 -mt-1">
                {team.slice(1).map((id) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={id} src={TEAM_INFO[id].idle} alt="" className="w-7 h-7 object-contain opacity-90" />
                ))}
              </div>
            )}
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
          <img src={`${A}/ui/panels/warning_panel.png`} alt="WARNING" className="relative h-10 anim-panelPop" />
        )}
        {entranceKind === "boss" && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={`${A}/ui/panels/boss_panel.png`} alt="BOSS BATTLE" className="relative h-12 anim-panelPop" />
        )}
        <p className="relative text-sm text-white font-bold drop-shadow">{monster.name}</p>
      </div>
    );
  }

  if (!question) return null;

  const promptText = question.direction === "toEng" ? question.word.korean : question.word.english;
  const isFlying = monster.id === "bat" && !monster.isBoss;

  return (
    <div
      key={screenShakeKey}
      className={`relative rounded-3xl overflow-hidden flex flex-col bg-cover bg-center ${
        screenShakeKey > 0 ? "anim-screenShake" : ""
      }`}
      style={{ backgroundImage: `url(${bgFor(!!monster.isBoss)})` }}
    >
      <BattleStyles />
      <div className="absolute inset-0 bg-black/15 pointer-events-none" />

      {teamAttackActive ? (
        <div className="absolute inset-x-0 top-1 z-30 flex justify-center pointer-events-none">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`${A}/ui/panels/team_attack.png`} alt="TEAM ATTACK" className="h-11 anim-panelPop" />
        </div>
      ) : (
        joinLabel && (
          <div className="absolute inset-x-0 top-1 z-30 flex justify-center pointer-events-none">
            <p className="anim-panelPop bg-white/90 rounded-full px-3 py-1 text-xs font-black text-sky-600 tracking-wide shadow">
              {joinLabel}
            </p>
          </div>
        )
      )}

      {/* 상단: 아주 작은 스테이지 표시 + 몬스터 이름/HP바 한 줄, 플레이어 하트 */}
      <div className="relative z-10 flex flex-col gap-1 px-3 pt-2">
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-white/80 font-bold tracking-widest drop-shadow">
            STAGE {defeatedCount + 1}
          </span>
          <HeartRow key={playerHitKey} hp={playerHp} />
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-xs font-bold drop-shadow ${monster.isBoss ? "text-red-300" : "text-white"}`}>
            {monster.isBoss ? "👑 " : ""}
            {monster.name}
          </span>
          <div className="flex-1 h-2 rounded-full bg-white/30 overflow-hidden">
            <div
              className="h-full bg-red-500 transition-all duration-300"
              style={{ width: `${(monsterHp / monsterMaxHp) * 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* 중앙: 전투 무대 (화면의 대부분을 차지) */}
      <div className="relative z-10 flex items-end justify-between px-4 py-2 flex-1" style={{ minHeight: 190 }}>
        {feedback === "wrong" && (
          <p key={wrongLabelKey} className="anim-popupFade absolute left-6 top-2 text-lg font-black text-red-300 drop-shadow z-20">
            OOPS!
          </p>
        )}
        {attackPopup && !teamAttackActive && (
          <div key={popupKey} className="anim-popupFade absolute left-1/3 top-0 z-20 flex flex-col items-center pointer-events-none">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={attackPopup.img} alt="" className="w-9 h-9 object-contain" />
            <span className="text-xs font-black text-white drop-shadow">{attackPopup.label}</span>
          </div>
        )}

        {/* 플레이어 팀 */}
        <div className="flex items-end">
          {teamAttackActive ? (
            <div className="flex items-end gap-1">
              {team.map((id) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={id}
                  src={TEAM_INFO[id].attack}
                  alt=""
                  className={`w-20 h-20 object-contain drop-shadow anim-atk-${TEAM_INFO[id].style}`}
                />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={mainAttacking ? TEAM_INFO[team[0]].attack : TEAM_INFO[team[0]].idle}
                alt=""
                className={`w-28 h-28 object-contain drop-shadow ${
                  mainAttacking ? `anim-atk-${TEAM_INFO[team[0]].style}` : ""
                } ${feedback === "wrong" ? "anim-playerRecoil" : ""}`}
              />
              {team.length > 1 && (
                <div className="flex gap-1 -mt-2">
                  {team.slice(1).map((id) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={id} src={TEAM_INFO[id].idle} alt="" className="anim-slideIn w-9 h-9 object-contain opacity-90" />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* 몬스터 */}
        <div className="relative flex items-end">
          {monster.isBoss && phase !== "ko" && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={`${A}/effects/dark_aura.png`}
              alt=""
              className="absolute inset-0 m-auto w-40 h-40 object-contain anim-auraPulse pointer-events-none"
            />
          )}
          {phase === "ko" ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={monster.img}
              alt={monster.name}
              className={`relative object-contain anim-monsterKO ${monster.isBoss ? "w-52 h-52" : "w-40 h-40"}`}
            />
          ) : (
            <>
              {fxKind && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={fxKey}
                  src={`${A}/effects/${fxKind}.png`}
                  alt=""
                  className="absolute -top-4 right-4 w-16 h-16 object-contain anim-fxPop pointer-events-none z-10"
                />
              )}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                key={`monster-${monsterHitKey}`}
                src={monster.img}
                alt={monster.name}
                className={`relative object-contain ${monster.isBoss ? "w-52 h-52" : "w-40 h-40"} ${
                  isFlying ? "-translate-y-6" : ""
                } ${
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
      </div>

      {phase === "ko" && (
        <div className="relative z-10 flex flex-col items-center gap-1 pb-3 anim-panelPop">
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

      {/* 하단: 질문(작게) + 단어 선택 버튼 3개 */}
      {phase !== "ko" && (
        <div className="relative z-10 flex flex-col gap-2 px-3 pb-3">
          <p className="text-center text-sm font-bold text-white bg-black/35 rounded-full py-1 mx-8">
            &quot;{promptText}&quot;
          </p>
          <div className="grid grid-cols-3 gap-2">
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
                  className={`h-16 rounded-xl border-2 font-bold text-base transition bg-white ${
                    isSelected ? "anim-cardLunge" : ""
                  } ${
                    showCorrect
                      ? "bg-green-100 border-green-400 text-black"
                      : showWrong
                      ? "bg-red-100 border-red-400 text-black"
                      : "border-white/70 text-gray-800 active:scale-95"
                  }`}
                >
                  {question.direction === "toEng" ? opt.english : opt.korean}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <button
        onClick={onDone}
        className="relative z-10 self-center mb-2 text-[11px] text-white/80 bg-black/25 rounded-full px-3 py-0.5"
      >
        그만하기
      </button>
    </div>
  );
}
