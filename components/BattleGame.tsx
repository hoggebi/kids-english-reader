"use client";

import { useEffect, useRef, useState } from "react";
import type { VocabWord } from "@/lib/types";
import { loadPet, getPetImagePath, getSpecies } from "@/lib/pet";
import { nextMonster, type Monster } from "@/lib/monsters";
import { shuffle, buildOptions, playTone } from "./VocabGame";

type Feedback = "correct" | "wrong" | null;
type Direction = "toEng" | "toKor";
type AttackStyle = "dash" | "swoop" | "zigzag" | "slam" | "double";
type EntranceKind = "normal" | "warning" | "rare" | "boss";
type Phase = "vs" | "battle" | "ko" | "gameover";

const PLAYER_MAX_HP = 3;
const CARD_LABELS = ["SLASH", "POWER", "DASH"];

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

// 팀에 합류할 수 있는 "게스트" 캐릭터들. 기존 챕터/단어장 캐릭터 이미지를 그대로 재사용한다
// (진행상황과는 무관한 미니게임 전용 연출이라 4단계 이미지로 고정).
type Recruit = { id: string; img: string; style: AttackStyle };
const RECRUIT_POOL: Recruit[] = [
  { id: "fox", img: "/4.png", style: "dash" },
  { id: "tiger", img: "/t4.png", style: "dash" },
  { id: "eagle", img: "/e4.png", style: "swoop" },
  { id: "shark", img: "/s4.png", style: "dash" },
  { id: "panther", img: "/bp4.png", style: "zigzag" },
  { id: "wolf", img: "/w4.png", style: "double" },
  { id: "orangutan", img: "/o4.png", style: "slam" },
];

const RECRUIT_NAME: Record<string, string> = {
  fox: "여우",
  tiger: "호랑이",
  eagle: "독수리",
  shark: "상어",
  panther: "흑표범",
  wolf: "늑대",
  orangutan: "오랑우탄",
};

function styleForPrefix(prefix: string): AttackStyle {
  if (prefix === "e") return "swoop";
  if (prefix === "bp") return "zigzag";
  if (prefix === "w") return "double";
  if (prefix === "o") return "slam";
  return "dash";
}

function leaderSpeciesId(prefix: string): string {
  if (prefix === "t") return "tiger";
  if (prefix === "e") return "eagle";
  if (prefix === "s") return "shark";
  return "fox";
}

function BattleStyles() {
  return (
    <style>{`
      @keyframes vsPop { 0% { transform: scale(0.5); opacity: 0; } 60% { transform: scale(1.15); opacity: 1; } 100% { transform: scale(1); opacity: 1; } }
      @keyframes bannerPop { 0% { transform: translateY(10px) scale(0.7); opacity: 0; } 40% { transform: translateY(0) scale(1.1); opacity: 1; } 100% { transform: translateY(0) scale(1); opacity: 1; } }
      @keyframes monsterSlideIn { 0% { transform: translateX(120px); opacity: 0; } 100% { transform: translateX(0); opacity: 1; } }
      @keyframes rarePop { 0% { transform: scale(0.3) rotate(-15deg); opacity: 0; } 60% { transform: scale(1.2) rotate(6deg); opacity: 1; } 100% { transform: scale(1) rotate(0deg); opacity: 1; } }
      @keyframes screenShake { 0%, 100% { transform: translateX(0); } 25% { transform: translateX(-6px); } 50% { transform: translateX(6px); } 75% { transform: translateX(-4px); } }
      @keyframes cardLunge { 0% { transform: translateY(0) scale(1); } 40% { transform: translateY(-10px) scale(1.06); } 100% { transform: translateY(-10px) scale(1.06); } }
      @keyframes atkDash { 0%, 100% { transform: translateX(0); } 40%, 60% { transform: translateX(30px); } }
      @keyframes atkDouble { 0%, 100% { transform: translateX(0); } 25% { transform: translateX(22px); } 50% { transform: translateX(0); } 75% { transform: translateX(28px); } }
      @keyframes atkZigzag { 0%, 100% { transform: translateX(0) translateY(0); } 25% { transform: translateX(20px) translateY(-6px); } 50% { transform: translateX(30px) translateY(4px); } 75% { transform: translateX(14px) translateY(-2px); } }
      @keyframes atkSwoop { 0% { transform: translate(0, 0); } 35% { transform: translate(6px, -22px); } 70% { transform: translate(30px, 10px); } 100% { transform: translate(0, 0); } }
      @keyframes atkSlam { 0% { transform: translate(0, 0) rotate(0deg); } 30% { transform: translate(10px, -20px) rotate(-8deg); } 65% { transform: translate(24px, 10px) rotate(6deg); } 100% { transform: translate(0, 0) rotate(0deg); } }
      @keyframes monsterHitSm { 0%, 100% { transform: translateX(0) rotate(0deg); } 20% { transform: translateX(-14px) rotate(-4deg); } 45% { transform: translateX(6px) rotate(3deg); } 70% { transform: translateX(-3px) rotate(-1deg); } }
      @keyframes monsterHitBig { 0%, 100% { transform: translateX(0) rotate(0deg) scale(1); } 15% { transform: translateX(-26px) rotate(-8deg) scale(0.94); } 40% { transform: translateX(14px) rotate(7deg) scale(1.05); } 65% { transform: translateX(-8px) rotate(-4deg) scale(0.98); } 85% { transform: translateX(4px) rotate(2deg) scale(1.01); } }
      @keyframes monsterKO { 0% { transform: translateY(0) scale(1) rotate(0deg); opacity: 1; } 100% { transform: translateY(60px) scale(0.35) rotate(30deg); opacity: 0; } }
      @keyframes playerRecoil { 0%, 100% { transform: translateX(0); } 30% { transform: translateX(-14px) rotate(-6deg); } 60% { transform: translateX(4px) rotate(2deg); } }
      @keyframes monsterLunge { 0%, 100% { transform: translateX(0); } 50% { transform: translateX(-40px); } }
      .anim-vsPop { animation: vsPop 0.4s ease-out; }
      .anim-bannerPop { animation: bannerPop 0.4s ease-out; }
      .anim-monsterSlideIn { animation: monsterSlideIn 0.45s ease-out; }
      .anim-rarePop { animation: rarePop 0.5s ease-out; }
      .anim-screenShake { animation: screenShake 0.3s ease-out; }
      .anim-cardLunge { animation: cardLunge 0.35s ease-out forwards; }
      .anim-atk-dash { animation: atkDash 0.4s ease-out; }
      .anim-atk-double { animation: atkDouble 0.5s ease-out; }
      .anim-atk-zigzag { animation: atkZigzag 0.5s ease-out; }
      .anim-atk-swoop { animation: atkSwoop 0.5s ease-out; }
      .anim-atk-slam { animation: atkSlam 0.5s ease-out; }
      .anim-monsterHitSm { animation: monsterHitSm 0.4s ease-out; }
      .anim-monsterHitBig { animation: monsterHitBig 0.5s ease-out; }
      .anim-monsterKO { animation: monsterKO 0.7s ease-in forwards; }
      .anim-playerRecoil { animation: playerRecoil 0.4s ease-out; }
      .anim-monsterLunge { animation: monsterLunge 0.4s ease-in-out; }
      @media (prefers-reduced-motion: reduce) {
        .anim-vsPop, .anim-bannerPop, .anim-monsterSlideIn, .anim-rarePop, .anim-screenShake, .anim-cardLunge,
        .anim-atk-dash, .anim-atk-double, .anim-atk-zigzag, .anim-atk-swoop, .anim-atk-slam,
        .anim-monsterHitSm, .anim-monsterHitBig, .anim-monsterKO, .anim-playerRecoil, .anim-monsterLunge { animation: none; }
      }
    `}</style>
  );
}

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

function rollEntrance(isBoss: boolean): EntranceKind {
  if (isBoss) return "boss";
  const r = Math.random();
  if (r < 0.12) return "rare";
  if (r < 0.12 + 0.18) return "warning";
  return "normal";
}

// 일반 몬스터는 3~4번 정답을 맞혀야 쓰러지도록 살짝 랜덤하게 필요 타수를 정한다.
function rollHitsNeeded(monster: Monster): number {
  return monster.isBoss ? monster.hp : 3 + Math.floor(Math.random() * 2);
}

function enrageTint(hp: number, maxHp: number): string {
  const ratio = hp / maxHp;
  if (ratio <= 0.3) return "saturate-150 brightness-90 scale-110";
  if (ratio <= 0.6) return "saturate-125 scale-105";
  return "";
}

function PipBar({ value, max, color }: { value: number; max: number; color: string }) {
  return (
    <div className="flex gap-1">
      {Array.from({ length: max }).map((_, i) => (
        <div
          key={i}
          className={`h-3 flex-1 rounded-full transition-colors duration-300 ${i < value ? color : "bg-gray-200"}`}
        />
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
  const [pet] = useState(() => loadPet("vocab"));
  const leaderPrefix = getSpecies(pet.generation, "vocab").imagePrefix;
  const [recruits] = useState<Recruit[]>(() =>
    shuffle(RECRUIT_POOL.filter((r) => r.id !== leaderSpeciesId(leaderPrefix))).slice(0, 2)
  );
  const leader: Recruit = {
    id: leaderSpeciesId(leaderPrefix),
    img: getPetImagePath(pet, "vocab"),
    style: styleForPrefix(leaderPrefix),
  };

  const defeatedCountRef = useRef(0);
  const [team, setTeam] = useState<Recruit[]>([leader]);
  const [monster, setMonster] = useState<Monster>(() => nextMonster(0));
  const [monsterMaxHp, setMonsterMaxHp] = useState(3);
  const [monsterHp, setMonsterHp] = useState(3);
  const [playerHp, setPlayerHp] = useState(PLAYER_MAX_HP);
  const [question, setQuestion] = useState<Question | null>(() =>
    words.length >= 3 ? makeQuestion(words, null) : null
  );
  const [combo, setCombo] = useState(0);
  const [defeatedTotal, setDefeatedTotal] = useState(0);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [leaderHitKey, setLeaderHitKey] = useState(0);
  const [teamAttackKey, setTeamAttackKey] = useState(0);
  const [monsterHitKey, setMonsterHitKey] = useState(0);
  const [playerHitKey, setPlayerHitKey] = useState(0);
  const [teamAttackActive, setTeamAttackActive] = useState(false);
  const [joinLabel, setJoinLabel] = useState<string | null>(null);
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
    const t = setTimeout(() => setPhase("battle"), entranceKind === "normal" ? 900 : 1500);
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
    defeatedCountRef.current = 0;
    setTeam([leader]);
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

      // setState 업데이터 함수는 이 자리에서 곧바로 실행되지 않으므로(비동기 처리),
      // team/combo는 현재 state 값을 직접 읽어서 다음 값을 계산한다 (다른 값들과 동일한 방식).
      let joinedRecruit: Recruit | null = null;
      let nextTeam = team;
      if (nextCombo === 2 && team.length < 2) {
        joinedRecruit = recruits[0];
        nextTeam = [...team, recruits[0]];
      }
      const teamAttack = nextCombo === 3;
      if (teamAttack && team.length < 3) {
        joinedRecruit = recruits[1];
        nextTeam = [...team, recruits[1]];
      }
      if (nextTeam !== team) setTeam(nextTeam);

      const damage = teamAttack ? 2 : 1;
      const newHp = Math.max(0, monsterHp - damage);
      setMonsterHp(newHp);

      if (joinedRecruit) {
        const name = RECRUIT_NAME[joinedRecruit.id] ?? "새 친구";
        setJoinLabel(`${name} 합류!`);
        setTimeout(() => setJoinLabel(null), 900);
      }

      if (teamAttack) {
        setTeamAttackActive(true);
        setTeamAttackKey((k) => k + 1);
        setScreenShakeKey((k) => k + 1);
        setMonsterHitKey((k) => k + 1);
        setCombo(0);
        setTimeout(() => setTeamAttackActive(false), 700);
      } else {
        setLeaderHitKey((k) => k + 1);
        setMonsterHitKey((k) => k + 1);
        setCombo(nextCombo);
      }

      setTimeout(
        () => {
          if (newHp <= 0) {
            setPhase("ko");
            setTimeout(() => {
              const nextCount = defeatedCountRef.current + 1;
              defeatedCountRef.current = nextCount;
              setDefeatedTotal(nextCount);
              beginEncounter(nextCount);
            }, 900);
          } else {
            setQuestion(makeQuestion(words, question.word.id));
            setFeedback(null);
            setSelectedId(null);
          }
        },
        teamAttack ? 750 : 550
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
      }, 700);
    }
  }

  if (phase === "gameover") {
    return (
      <div className="flex flex-col items-center gap-4 py-10">
        <p className="text-3xl font-black text-red-500 tracking-widest">TRY AGAIN</p>
        <p className="text-gray-600">이번 판에서 몬스터 {defeatedTotal}마리를 물리쳤어요!</p>
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
      <div className="relative rounded-3xl overflow-hidden p-6 flex flex-col items-center justify-center gap-4 bg-gray-100 min-h-[22rem]">
        <BattleStyles />
        <div className="flex items-center justify-center gap-4 anim-vsPop">
          <div className="flex -space-x-3">
            {team.map((m, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={m.id} src={m.img} alt="" className="w-14 h-14 object-contain" style={{ zIndex: i }} />
            ))}
          </div>
          <p className="text-2xl font-black text-gray-700">VS</p>
          <MonsterFace monster={monster} className={monster.isBoss ? "text-7xl w-24 h-24" : "text-5xl w-16 h-16"} />
        </div>
        {entranceKind === "warning" && (
          <p className="anim-bannerPop text-xl font-black text-amber-500 tracking-widest">⚠️ WARNING!</p>
        )}
        {entranceKind === "rare" && (
          <p className="anim-rarePop text-xl font-black text-fuchsia-500 tracking-widest">✨ RARE MONSTER</p>
        )}
        {entranceKind === "boss" && (
          <p className="anim-bannerPop text-2xl font-black text-red-500 tracking-widest">BOSS BATTLE</p>
        )}
        <p className="text-sm text-gray-500 font-bold">{monster.name}</p>
      </div>
    );
  }

  if (!question) return null;

  const promptText = question.direction === "toEng" ? question.word.korean : question.word.english;

  return (
    <div
      key={screenShakeKey}
      className={`relative rounded-3xl overflow-hidden p-4 flex flex-col gap-4 bg-gray-100 ${
        screenShakeKey > 0 ? "anim-screenShake" : ""
      }`}
    >
      <BattleStyles />

      {teamAttackActive ? (
        <div className="absolute inset-x-0 top-2 z-30 flex justify-center pointer-events-none">
          <p className="anim-bannerPop text-2xl font-black text-orange-500 tracking-widest">⚡ TEAM ATTACK!</p>
        </div>
      ) : (
        joinLabel && (
          <div className="absolute inset-x-0 top-2 z-30 flex justify-center pointer-events-none">
            <p className="anim-bannerPop text-lg font-black text-sky-500 tracking-wide">{joinLabel}</p>
          </div>
        )
      )}

      {/* 상단: 몬스터 이름 + HP, 플레이어 HP */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <span className={`font-bold ${monster.isBoss ? "text-red-500" : "text-gray-700"}`}>
            {monster.isBoss ? "👑 " : ""}
            {monster.name}
          </span>
          <span className="text-xs text-gray-400">
            HP {monsterHp}/{monsterMaxHp}
          </span>
        </div>
        <PipBar value={monsterHp} max={monsterMaxHp} color="bg-red-500" />
        <div className="flex items-center justify-between mt-1">
          <span className="text-xs text-gray-400 font-bold">PLAYER HP</span>
          <span key={playerHitKey}>
            {Array.from({ length: PLAYER_MAX_HP }).map((_, i) => (
              <span key={i} className="text-sm">
                {i < playerHp ? "❤️" : "🤍"}
              </span>
            ))}
          </span>
        </div>
      </div>

      {/* 중앙: 팀(최대 3명) VS 몬스터 */}
      <div className="relative flex items-center justify-between py-4 px-2">
        <div className="flex items-end gap-1">
          {team.map((m, i) => {
            const isLeader = i === 0;
            const soloAnim =
              isLeader && feedback === "correct" && !teamAttackActive ? `anim-atk-${m.style}` : "";
            const teamAnim = teamAttackActive ? `anim-atk-${m.style}` : "";
            const recoilAnim = feedback === "wrong" ? "anim-playerRecoil" : "";
            return (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={`${m.id}-${isLeader ? leaderHitKey : teamAttackKey}`}
                src={m.img}
                alt="캐릭터"
                className={`object-contain ${isLeader ? "w-16 h-16" : "w-11 h-11"} ${soloAnim} ${teamAnim} ${recoilAnim}`}
              />
            );
          })}
        </div>

        {phase === "ko" ? (
          <MonsterFace
            monster={monster}
            className={`${monster.isBoss ? "text-8xl w-32 h-32" : "text-5xl w-20 h-20"} anim-monsterKO`}
          />
        ) : (
          <MonsterFace
            key={`monster-${monsterHitKey}`}
            monster={monster}
            className={monster.isBoss ? "text-8xl w-32 h-32" : "text-5xl w-20 h-20"}
            animationClass={
              feedback === "wrong"
                ? "anim-monsterLunge"
                : feedback === "correct"
                ? teamAttackActive || monster.isBoss
                  ? "anim-monsterHitBig"
                  : "anim-monsterHitSm"
                : entranceKind !== "normal"
                ? ""
                : "anim-monsterSlideIn"
            }
            tintClass={feedback === "correct" ? "" : enrageTint(monsterHp, monsterMaxHp)}
          />
        )}
      </div>

      {phase === "ko" && (
        <div className="text-center anim-bannerPop">
          <p className="text-2xl font-black text-sky-600 tracking-widest">KO!</p>
          <p className="text-xs text-gray-400">
            {monster.name}
            {eulReul(monster.name)} 쓰러뜨렸어요!
          </p>
        </div>
      )}

      {/* 하단: 문제 + 공격 카드 */}
      {phase !== "ko" && (
        <div className="flex flex-col gap-3">
          <p className="text-center text-lg font-bold text-black">&quot;{promptText}&quot;</p>
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
                  className={`flex flex-col items-center gap-1 py-3 rounded-xl border-2 font-bold transition ${
                    isSelected ? "anim-cardLunge" : ""
                  } ${
                    showCorrect
                      ? "bg-green-100 border-green-400 text-black"
                      : showWrong
                      ? "bg-red-100 border-red-400 text-black"
                      : "bg-white border-gray-200 text-black active:scale-95"
                  }`}
                >
                  <span className="text-[10px] tracking-widest text-sky-500">{CARD_LABELS[i]}</span>
                  <span className="text-sm">{question.direction === "toEng" ? opt.english : opt.korean}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <button onClick={onDone} className="self-center text-xs text-gray-400 underline">
        그만하기
      </button>
    </div>
  );
}
