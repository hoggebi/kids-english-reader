"use client";

import { useEffect, useRef, useState } from "react";
import type { VocabWord } from "@/lib/types";
import { nextMonster, type Monster } from "@/lib/monsters";
import { shuffle, playTone } from "./VocabGame";
import {
  sfxSlash,
  sfxHitBig,
  sfxWrong,
  sfxJoin,
  sfxTeamAttack,
  sfxWarning,
  sfxKO,
  sfxVictory,
  startBgm,
  stopBgm,
  getBgmPref,
  setBgmPref,
} from "@/lib/battleAudio";

type Feedback = "correct" | "wrong" | null;
type AttackStyle = "dash" | "swoop" | "lowdash";
type EntranceKind = "normal" | "warning" | "boss";
type Phase = "intro" | "battle" | "gameover";
type IntroStage = "enter" | "hold" | "vs" | "vsOut" | "warning" | "warningOut";
type AttackStage = "windup" | "dash" | "impact" | "fadeout" | "recover" | null;
type KoStage = "hold" | "defeat" | "panel" | null;
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

// 공격별로 실제 피격 이펙트 이미지 자체가 달라야 한다 (이름표만 다르고 이펙트가 같으면 안 됨).
// dash 단계(발동 순간)와 impact 단계(맞는 순간)에 서로 다른 이미지를 써서 "때리는 느낌 -> 맞는 느낌"이
// 이어지게 한다.
type ResolvedFxKind = AttackKind | "critical";
const FX_STAGE_IMG: Record<ResolvedFxKind, { dash: string; impact: string }> = {
  slash: { dash: "slash_effect", impact: "hit_spark" },
  fire: { dash: "fire_hit", impact: "fire_burn" },
  dash: { dash: "speed_lines", impact: "dash_impact" },
  critical: { dash: "critical_burst", impact: "hit_spark" },
};
// 몬스터 피격 리액션도 공격별로 다르게: dash는 가장 크게 밀려나고, fire는 살짝 더 오래, slash는 짧고 빠르게.
const FX_MONSTER_ANIM: Record<ResolvedFxKind, string> = {
  slash: "anim-monsterHitSm",
  fire: "anim-monsterHitFire",
  dash: "anim-monsterHitDash",
  critical: "anim-monsterHitBig",
};

// 캐릭터/몬스터/연출 이미지 크기: 가로형이든 세로형이든 화면에서 짧은 쪽(vmin) 기준으로
// 정해서, 화면 비율이 바뀌어도 항상 비슷한 비중으로 보이고 중앙에서 자연스럽게 만나게 한다.
const SIZE = {
  main: "clamp(120px, 24vmin, 220px)",
  team: "clamp(80px, 16vmin, 150px)",
  monster: "clamp(140px, 28vmin, 280px)",
  boss: "clamp(170px, 34vmin, 340px)",
  aura: "clamp(150px, 30vmin, 300px)",
  fx: "clamp(64px, 13vmin, 130px)",
  clusterW: "clamp(160px, 32vmin, 300px)",
  clusterH: "clamp(150px, 30vmin, 280px)",
  teamOffsetBottom: "clamp(32px, 8vmin, 70px)",
  attackImg: "clamp(70px, 14vmin, 140px)",
  // 캐릭터가 주인공이고 VS는 보조 연출이라 캐릭터보다 확실히 작게 (이전 대비 약 30% 축소).
  vsPanel: "clamp(56px, 11vmin, 105px)",
  introBanner: "clamp(84px, 17vmin, 160px)",
  panelBanner: "clamp(64px, 13vmin, 120px)",
  panelBig: "clamp(88px, 18vmin, 160px)",
  attackCard: "clamp(56px, 11vmin, 100px)",
  dust: "clamp(64px, 13vmin, 120px)",
};

type Question = {
  word: VocabWord;
};

type LetterTile = { ch: string; id: number };

function makeQuestion(words: VocabWord[], avoidId: string | null): Question {
  const pool = words.length > 1 && avoidId ? words.filter((w) => w.id !== avoidId) : words;
  const word = shuffle(pool)[0] ?? words[0];
  return { word };
}

function shuffledLetters(english: string): LetterTile[] {
  return shuffle(english.split("").map((ch, i) => ({ ch, id: i })));
}

// 스테이지가 올라갈수록 스펠링을 완성할 시간이 줄어든다 (최소 시간은 보장).
const TIME_BASE_SEC = 18;
const TIME_MIN_SEC = 7;
const TIME_STEP_SEC = 1;
// 철자 맞추기는 객관식보다 시간이 더 필요해서 주는 고정 버퍼.
const SPELL_BUFFER_SEC = 1.5;

function timeLimitForStage(stage: number): number {
  return Math.max(TIME_MIN_SEC, TIME_BASE_SEC - stage * TIME_STEP_SEC);
}

// 단어 길이에 따라 추가 시간을 준다 (짧은 단어와 긴 단어가 비슷한 속도로 줄면 안 됨).
function lengthBonusSec(wordLength: number): number {
  if (wordLength <= 4) return 0;
  if (wordLength <= 6) return 2;
  if (wordLength <= 8) return 4;
  return 6;
}

function timeLimitForWord(stage: number, wordLength: number): number {
  return timeLimitForStage(stage) + lengthBonusSec(wordLength) + SPELL_BUFFER_SEC;
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

// ---------- 전투 연출 타이밍(state 기반 시퀀스). 각 구간이 끝나야 다음 구간으로 넘어간다. ----------
const INTRO_ENTER_MS = 600;
const INTRO_HOLD_MS = 600;
const INTRO_VS_MS = 1300;
const INTRO_VS_OUT_MS = 200;
const INTRO_WARNING_MS = 1100;
const INTRO_WARNING_OUT_MS = 200;
const INTRO_GAP_MS = 150;

const ATK_WINDUP_MS = 300;
const ATK_DASH_MS = 500;
const ATK_IMPACT_MS = 700;
const ATK_FADEOUT_MS = 500;
const ATK_RECOVER_MS = 500;

const KO_HOLD_MS = 500;
const KO_DEFEAT_MS = 700;
const KO_PANEL_MS = 900;
const KO_GAP_MS = 500;

// 공격자(플레이어/몬스터) 쪽 캐릭터가 단계별로 상대 쪽으로 얼마나 이동하는지.
// direction: 1 = 오른쪽(플레이어→몬스터), -1 = 왼쪽(몬스터→플레이어)
function attackerTransform(stage: AttackStage, direction: 1 | -1): string {
  switch (stage) {
    case "windup":
      return `translateX(${-7 * direction}vmin) scale(0.96)`;
    case "dash":
    case "impact":
      return `translateX(${16 * direction}vmin) scale(1.04)`;
    default:
      return "translateX(0) scale(1)";
  }
}

function attackerTransitionMs(stage: AttackStage): number {
  switch (stage) {
    case "windup":
      return ATK_WINDUP_MS;
    case "dash":
      return ATK_DASH_MS;
    case "fadeout":
      return ATK_FADEOUT_MS;
    default:
      return 200;
  }
}

function BattleStyles() {
  return (
    <style>{`
      @keyframes vsPop { 0% { transform: scale(0.7); opacity: 0; } 60% { transform: scale(1.1); opacity: 1; } 100% { transform: scale(1); opacity: 1; } }
      @keyframes panelPop { 0% { transform: translateY(8px) scale(0.7); opacity: 0; } 40% { transform: translateY(0) scale(1.08); opacity: 1; } 100% { transform: translateY(0) scale(1); opacity: 1; } }
      @keyframes teamJoinPop { 0% { transform: scale(0.7); opacity: 0; } 100% { transform: scale(1); opacity: 1; } }
      @keyframes warningShake { 0%, 100% { transform: translateX(0) scale(1); } 25% { transform: translateX(-3px) scale(1.02); } 50% { transform: translateX(3px) scale(1.04); } 75% { transform: translateX(-2px) scale(1.02); } }
      @keyframes screenShake { 0%, 100% { transform: translateX(0); } 25% { transform: translateX(-6px); } 50% { transform: translateX(6px); } 75% { transform: translateX(-4px); } }
      @keyframes cardLunge { 0% { transform: translateY(0) scale(1); } 40% { transform: translateY(-6px) scale(1.04); } 100% { transform: translateY(-6px) scale(1.04); } }
      @keyframes popupFade { 0% { transform: translateY(6px) scale(0.7); opacity: 0; } 20% { transform: translateY(0) scale(1.1); opacity: 1; } 80% { transform: translateY(0) scale(1); opacity: 1; } 100% { transform: translateY(-4px) scale(1); opacity: 0; } }
      @keyframes fxPopIn { 0% { transform: scale(0.4); opacity: 0; } 100% { transform: scale(1.15); opacity: 1; } }
      @keyframes monsterHitSm { 0%, 100% { transform: scaleX(-1) translateX(0) rotate(0deg); } 20% { transform: scaleX(-1) translateX(-14px) rotate(-4deg); } 45% { transform: scaleX(-1) translateX(6px) rotate(3deg); } 70% { transform: scaleX(-1) translateX(-3px) rotate(-1deg); } }
      @keyframes monsterHitBig { 0%, 100% { transform: scaleX(-1) translateX(0) rotate(0deg) scale(1); } 15% { transform: scaleX(-1) translateX(-26px) rotate(-8deg) scale(0.94); } 40% { transform: scaleX(-1) translateX(14px) rotate(7deg) scale(1.05); } 65% { transform: scaleX(-1) translateX(-8px) rotate(-4deg) scale(0.98); } 85% { transform: scaleX(-1) translateX(4px) rotate(2deg) scale(1.01); } }
      @keyframes monsterHitFire { 0%, 100% { transform: scaleX(-1) translateX(0) rotate(0deg); } 20% { transform: scaleX(-1) translateX(-16px) rotate(-5deg); } 50% { transform: scaleX(-1) translateX(8px) rotate(4deg); } 80% { transform: scaleX(-1) translateX(-4px) rotate(-2deg); } }
      @keyframes monsterHitDash { 0%, 100% { transform: scaleX(-1) translateX(0) rotate(0deg); } 20% { transform: scaleX(-1) translateX(-34px) rotate(-9deg); } 50% { transform: scaleX(-1) translateX(10px) rotate(6deg); } 80% { transform: scaleX(-1) translateX(-4px) rotate(-2deg); } }
      @keyframes monsterKO { 0% { transform: scaleX(-1) translateY(0) scale(1) rotate(0deg); opacity: 1; } 100% { transform: scaleX(-1) translateY(60px) scale(0.35) rotate(30deg); opacity: 0; } }
      @keyframes fireFlash { 0% { opacity: 0; } 30% { opacity: 1; } 100% { opacity: 0; } }
      @keyframes playerRecoil { 0%, 100% { transform: translateX(0) rotate(0deg); } 30% { transform: translateX(-14px) rotate(-6deg); } 60% { transform: translateX(4px) rotate(2deg); } }
      @keyframes auraPulse { 0%, 100% { opacity: 0.55; transform: scale(1); } 50% { opacity: 0.8; transform: scale(1.08); } }
      .anim-vsPop { animation: vsPop 0.4s ease-out; }
      .anim-panelPop { animation: panelPop 0.4s ease-out; }
      .anim-teamJoin { animation: teamJoinPop 0.4s ease-out; }
      .anim-warningShake { animation: warningShake 0.5s ease-in-out infinite; }
      .anim-screenShake { animation: screenShake 0.3s ease-out; }
      .anim-cardLunge { animation: cardLunge 0.3s ease-out forwards; }
      .anim-popupFade { animation: popupFade 1.1s ease-out forwards; }
      .anim-fxPopIn { animation: fxPopIn 0.22s ease-out forwards; }
      .anim-monsterHitSm { animation: monsterHitSm 0.4s ease-out; }
      .anim-monsterHitBig { animation: monsterHitBig 0.5s ease-out; }
      .anim-monsterHitFire { animation: monsterHitFire 0.55s ease-out; }
      .anim-monsterHitDash { animation: monsterHitDash 0.5s ease-out; }
      .anim-monsterKO { animation: monsterKO 0.7s ease-in forwards; }
      .anim-playerRecoil { animation: playerRecoil 0.4s ease-out; }
      .anim-auraPulse { animation: auraPulse 1.8s ease-in-out infinite; }
      .anim-fireFlash { animation: fireFlash 0.4s ease-out forwards; }
      @media (prefers-reduced-motion: reduce) {
        .anim-vsPop, .anim-panelPop, .anim-teamJoin, .anim-warningShake, .anim-screenShake, .anim-cardLunge, .anim-popupFade,
        .anim-fxPopIn, .anim-monsterHitSm, .anim-monsterHitBig, .anim-monsterHitFire, .anim-monsterHitDash,
        .anim-monsterKO, .anim-playerRecoil, .anim-auraPulse, .anim-fireFlash { animation: none; }
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
  const [letterPool, setLetterPool] = useState<LetterTile[]>(() =>
    question ? shuffledLetters(question.word.english) : []
  );
  const [placedLetters, setPlacedLetters] = useState<LetterTile[]>([]);
  const [timeLeftMs, setTimeLeftMs] = useState(() => timeLimitForStage(0) * 1000);
  const [timeLimitMs, setTimeLimitMs] = useState(() => timeLimitForStage(0) * 1000);
  const [combo, setCombo] = useState(0);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [monsterHitKey, setMonsterHitKey] = useState(0);
  const [playerHitKey, setPlayerHitKey] = useState(0);
  const [teamAttackActive, setTeamAttackActive] = useState(false);
  const [joinLabel, setJoinLabel] = useState<string | null>(null);
  const [wrongLabelKey, setWrongLabelKey] = useState(0);
  const [attackPopup, setAttackPopup] = useState<(typeof ATTACK_KINDS)[number] | null>(null);
  const [popupKey, setPopupKey] = useState(0);
  const [fxKind, setFxKind] = useState<ResolvedFxKind | null>(null);
  const [fxKey, setFxKey] = useState(0);
  const [entranceKind, setEntranceKind] = useState<EntranceKind>("normal");
  const [screenShakeKey, setScreenShakeKey] = useState(0);
  const [phase, setPhase] = useState<Phase>("intro");
  const [introStage, setIntroStage] = useState<IntroStage>("enter");
  const [slidIn, setSlidIn] = useState(false);
  const [introKey, setIntroKey] = useState(0);
  const [attackStage, setAttackStage] = useState<AttackStage>(null);
  const [koStage, setKoStage] = useState<KoStage>(null);
  const [bgmOn, setBgmOn] = useState(getBgmPref);

  const [fxPos, setFxPos] = useState<{ x: number; y: number } | null>(null);
  const battleAreaRef = useRef<HTMLDivElement>(null);
  const playerImgRef = useRef<HTMLImageElement>(null);
  const monsterImgRef = useRef<HTMLImageElement>(null);

  const seqRef = useRef(0);
  function startSeq() {
    seqRef.current += 1;
    return seqRef.current;
  }
  function isCurrentSeq(id: number) {
    return seqRef.current === id;
  }

  // 공격 이펙트가 실제로 "맞는 캐릭터" 몸 위에 뜨도록, 고정 좌표가 아니라 battle-area
  // 기준 상대 좌표를 매 타격마다 직접 계산한다. attackerIsPlayer가 true면 몬스터가 맞는
  // 쪽(타겟)이라 임팩트를 타겟 중심보다 살짝 왼쪽(공격자가 오는 쪽)에, 반대면 오른쪽에 둔다.
  function computeImpactPos(target: HTMLElement, attackerIsPlayer: boolean): { x: number; y: number } | null {
    const battle = battleAreaRef.current;
    if (!battle) return null;
    const battleRect = battle.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();
    const centerX = targetRect.left - battleRect.left + targetRect.width / 2;
    const centerY = targetRect.top - battleRect.top + targetRect.height / 2;
    const offsetX = targetRect.width * 0.1 * (attackerIsPlayer ? -1 : 1);
    return { x: centerX + offsetX, y: centerY };
  }

  function setUpQuestion(q: Question, stage: number) {
    setQuestion(q);
    setLetterPool(shuffledLetters(q.word.english));
    setPlacedLetters([]);
    const limitSec = timeLimitForWord(stage, q.word.english.length);
    setTimeLimitMs(limitSec * 1000);
    setTimeLeftMs(limitSec * 1000);
  }

  // [intro] 배경/캐릭터 등장 → 대치 → VS → (WARNING/BOSS BATTLE) → 전투 시작.
  // 각 구간이 끝나야 다음 구간으로 넘어가도록 하나의 시퀀스로 예약한다.
  function runIntro(kind: EntranceKind) {
    const id = startSeq();
    const at = (ms: number, fn: () => void) =>
      setTimeout(() => {
        if (isCurrentSeq(id)) fn();
      }, ms);

    at(INTRO_ENTER_MS, () => setIntroStage("hold"));
    at(INTRO_ENTER_MS + INTRO_HOLD_MS, () => setIntroStage("vs"));
    const vsEnd = INTRO_ENTER_MS + INTRO_HOLD_MS + INTRO_VS_MS;
    at(vsEnd, () => setIntroStage("vsOut"));
    let afterVsOut = vsEnd + INTRO_VS_OUT_MS;
    if (kind !== "normal") {
      at(afterVsOut, () => {
        setIntroStage("warning");
        sfxWarning();
      });
      const warnEnd = afterVsOut + INTRO_WARNING_MS;
      at(warnEnd, () => setIntroStage("warningOut"));
      afterVsOut = warnEnd + INTRO_WARNING_OUT_MS;
    }
    at(afterVsOut + INTRO_GAP_MS, () => setPhase("battle"));
  }

  function beginEncounter(count: number) {
    const m = nextMonster(count);
    const hits = rollHitsNeeded(m);
    const kind = rollEntrance(!!m.isBoss);
    setMonster(m);
    setMonsterMaxHp(hits);
    setMonsterHp(hits);
    setEntranceKind(kind);
    setUpQuestion(makeQuestion(words, question?.word.id ?? null), count);
    setFeedback(null);
    setAttackStage(null);
    setKoStage(null);
    setTeamAttackActive(false);
    setFxKind(null);
    setSlidIn(false);
    setIntroKey((k) => k + 1);
    setIntroStage("enter");
    setPhase("intro");
    runIntro(kind);
  }

  function handleRetryRun() {
    setDefeatedCount(0);
    setTeam(["tiger"]);
    setPlayerHp(PLAYER_MAX_HP);
    setCombo(0);
    setDefeatedTotal(0);
    beginEncounter(0);
  }

  // 글자 타일을 눌러 스펠링을 완성하면(다 채워지면) 자동으로 정답 여부를 판정한다.
  function tapPoolLetter(item: LetterTile) {
    if (!question || feedback) return;
    const nextPlaced = [...placedLetters, item];
    setLetterPool((p) => p.filter((x) => x.id !== item.id));
    setPlacedLetters(nextPlaced);
    if (nextPlaced.length === question.word.english.length) {
      const built = nextPlaced.map((x) => x.ch).join("");
      resolveAnswer(built.toLowerCase() === question.word.english.toLowerCase());
    }
  }

  function tapPlacedLetter(item: LetterTile) {
    if (!question || feedback) return;
    setPlacedLetters((p) => p.filter((x) => x.id !== item.id));
    setLetterPool((p) => [...p, item]);
  }

  function handleTimeout() {
    if (!question || feedback) return;
    resolveAnswer(false);
  }

  // [정답 → 플레이어 공격] / [오답 → 몬스터 공격] 연출 시퀀스.
  // windup → dash(+이펙트 등장) → impact(+피격) → fadeout(+원위치 복귀) → recover(정지) → 완료
  function runAttackSequence(opts: {
    onDash: () => void;
    onImpact: () => void;
    onFadeout?: () => void;
    onComplete: () => void;
  }) {
    const id = startSeq();
    const at = (ms: number, fn: () => void) =>
      setTimeout(() => {
        if (isCurrentSeq(id)) fn();
      }, ms);

    setAttackStage("windup");
    at(ATK_WINDUP_MS, () => {
      setAttackStage("dash");
      opts.onDash();
    });
    const impactAt = ATK_WINDUP_MS + ATK_DASH_MS;
    at(impactAt, () => {
      setAttackStage("impact");
      opts.onImpact();
    });
    const fadeAt = impactAt + ATK_IMPACT_MS;
    at(fadeAt, () => {
      setAttackStage("fadeout");
      opts.onFadeout?.();
    });
    const recoverAt = fadeAt + ATK_FADEOUT_MS;
    at(recoverAt, () => setAttackStage("recover"));
    const doneAt = recoverAt + ATK_RECOVER_MS;
    at(doneAt, () => {
      setAttackStage(null);
      setFxKind(null);
      setFxPos(null);
      opts.onComplete();
    });
  }

  // [몬스터 처치] 공격 연출이 끝난 뒤: 잠깐 정지 → 쓰러짐 애니메이션 → 페이드아웃 → 다음 스테이지.
  function runKoSequence(stage: number) {
    const id = startSeq();
    const at = (ms: number, fn: () => void) =>
      setTimeout(() => {
        if (isCurrentSeq(id)) fn();
      }, ms);

    setKoStage("hold");
    at(KO_HOLD_MS, () => {
      setKoStage("defeat");
      sfxKO();
    });
    at(KO_HOLD_MS + KO_DEFEAT_MS, () => {
      setKoStage("panel");
      sfxVictory();
    });
    at(KO_HOLD_MS + KO_DEFEAT_MS + KO_PANEL_MS + KO_GAP_MS, () => {
      setKoStage(null);
      const nextCount = stage + 1;
      setDefeatedCount(nextCount);
      setDefeatedTotal(nextCount);
      beginEncounter(nextCount);
    });
  }

  function resolveAnswer(ok: boolean) {
    if (!question || feedback) return;
    const capturedWordId = question.word.id;
    const capturedStage = defeatedCount;
    setFeedback(ok ? "correct" : "wrong");
    playTone(ok ? "correct" : "wrong");

    if (ok) {
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
      setCombo(teamAttack ? 0 : nextCombo);

      const damage = teamAttack ? 2 : 1;
      const newMonsterHp = Math.max(0, monsterHp - damage);
      setMonsterHp(newMonsterHp);
      const lethal = newMonsterHp <= 0;

      if (joinedId) {
        const label = `NEW FRIEND! ${TEAM_INFO[joinedId].name}`;
        setJoinLabel(label);
        setTimeout(() => setJoinLabel((cur) => (cur === label ? null : cur)), 1400);
        sfxJoin();
      }
      if (teamAttack) setTeamAttackActive(true);

      // 공격 종류를 한 번만 굴려서 이름표(팝업)와 실제 피격 이펙트가 항상 일치하게 한다.
      // 팀 공격/보스는 항상 CRITICAL 취급(가장 큰 이펙트+화면 흔들림).
      const isCriticalHit = teamAttack || monster.isBoss;
      const rolled = isCriticalHit ? null : rollAttackKind();
      const resolvedKind: ResolvedFxKind = isCriticalHit ? "critical" : rolled!.kind;

      runAttackSequence({
        onDash: () => {
          setFxKind(resolvedKind);
          setFxKey((k) => k + 1);
          if (monsterImgRef.current) setFxPos(computeImpactPos(monsterImgRef.current, true));
          if (rolled) {
            setAttackPopup(rolled);
            setPopupKey((k) => k + 1);
          }
          if (teamAttack) sfxTeamAttack();
          else if (monster.isBoss) sfxHitBig();
          else if (resolvedKind === "fire") sfxHitBig();
          else sfxSlash();
        },
        onImpact: () => {
          setMonsterHitKey((k) => k + 1);
          if (resolvedKind === "critical") setScreenShakeKey((k) => k + 1);
        },
        onFadeout: () => {
          setAttackPopup(null);
        },
        onComplete: () => {
          setTeamAttackActive(false);
          if (lethal) {
            runKoSequence(capturedStage);
          } else {
            setUpQuestion(makeQuestion(words, capturedWordId), capturedStage);
            setFeedback(null);
          }
        },
      });
    } else {
      setCombo(0);
      const newPlayerHp = Math.max(0, playerHp - 1);
      setPlayerHp(newPlayerHp);
      const gameOver = newPlayerHp <= 0;

      runAttackSequence({
        onDash: () => {
          setFxKind("slash");
          setFxKey((k) => k + 1);
          if (playerImgRef.current) setFxPos(computeImpactPos(playerImgRef.current, false));
          sfxWrong();
        },
        onImpact: () => {
          setPlayerHitKey((k) => k + 1);
          setScreenShakeKey((k) => k + 1);
          setWrongLabelKey((k) => k + 1);
        },
        onComplete: () => {
          if (gameOver) {
            setPhase("gameover");
          } else {
            setUpQuestion(makeQuestion(words, capturedWordId), capturedStage);
            setFeedback(null);
          }
        },
      });
    }
  }

  // 첫 몬스터도 HP 랜덤 타수/등장 연출이 제대로 적용되도록 마운트 시 한 번 다시 굴린다.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 최초 스테이지 진입 자체가 이 컴포넌트의 목적이라 마운트 시 곧바로 시작한다.
    beginEncounter(0);
    return () => {
      stopBgm();
      seqRef.current += 1; // 남아있는 예약된 타이머를 전부 무효화
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 캐릭터 슬라이드 인: off-screen 상태(slidIn=false)가 화면에 한 번 그려진 뒤에
  // (useEffect는 브라우저가 페인트한 다음에 실행된다) on-screen으로 바꿔야
  // CSS transition이 "이동하는 모습"으로 보인다. 곧바로 바꾸면 두 상태가 한 프레임에
  // 합쳐져서 트랜지션 없이 순간이동해 버린다.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 위 설명대로, 페인트 이후 슬라이드 인을 트리거하는 것이 목적.
    setSlidIn(true);
  }, [introKey]);

  // 전투 화면에 들어와 있는 동안에는 배경음을 재생 (사용자가 끄면 끄고, 다시 켜면 재생).
  useEffect(() => {
    if (phase === "battle" && bgmOn) startBgm();
    else stopBgm();
  }, [phase, bgmOn]);

  // 스펠링 제한시간 카운트다운: 전투 중, 정답/오답 판정이 나지 않은 동안에만 흐른다.
  useEffect(() => {
    if (phase !== "battle" || feedback) return;
    const interval = setInterval(() => {
      setTimeLeftMs((ms) => {
        if (ms <= 100) {
          clearInterval(interval);
          handleTimeout();
          return 0;
        }
        return ms - 100;
      });
    }, 100);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, feedback, question?.word.id]);

  function toggleBgm() {
    const next = !bgmOn;
    setBgmOn(next);
    setBgmPref(next);
  }

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

  if (phase === "gameover") {
    return (
      <div className="relative rounded-3xl bg-white flex flex-col items-center gap-5 px-6 py-10">
        <BattleStyles />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`${A}/ui/panels/game_over.png`}
          alt="TRY AGAIN"
          className="anim-panelPop object-contain"
          style={{ height: SIZE.panelBig }}
        />
        <p className="text-gray-600 text-sm text-center leading-relaxed">
          이번 판에서 몬스터 {defeatedTotal}마리를 물리쳤어요!
        </p>
        <div className="flex gap-2 w-full max-w-xs">
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

  if (!question) return null;

  const promptText = question.word.korean;
  const isFlying = monster.id === "bat" && !monster.isBoss;
  const timePct = Math.max(0, Math.min(100, (timeLeftMs / timeLimitMs) * 100));
  const timeBarColor = timePct > 50 ? "bg-emerald-400" : timePct > 20 ? "bg-yellow-400" : "bg-red-500";

  const playerAttacking = feedback === "correct" && attackStage !== null;
  const monsterAttacking = feedback === "wrong" && attackStage !== null;
  const playerSpriteAttacking =
    feedback === "correct" && (attackStage === "windup" || attackStage === "dash" || attackStage === "impact");

  const playerWrapTransform = phase === "intro" ? (slidIn ? "translateX(0)" : "translateX(-32vmin)") : playerAttacking ? attackerTransform(attackStage, 1) : "translateX(0)";
  const playerWrapDuration = phase === "intro" ? INTRO_ENTER_MS : attackerTransitionMs(attackStage);
  const monsterWrapTransform = phase === "intro" ? (slidIn ? "translateX(0)" : "translateX(32vmin)") : monsterAttacking ? attackerTransform(attackStage, -1) : "translateX(0)";
  const monsterWrapDuration = phase === "intro" ? INTRO_ENTER_MS : attackerTransitionMs(attackStage);

  const showIntroVs = phase === "intro" && (introStage === "vs" || introStage === "vsOut");
  const showIntroWarning = phase === "intro" && (introStage === "warning" || introStage === "warningOut");
  const introBannerImg = entranceKind === "boss" ? `${A}/ui/panels/boss_panel.png` : `${A}/ui/panels/warning_panel.png`;
  const introBannerAlt = entranceKind === "boss" ? "BOSS BATTLE" : "WARNING";

  const showBottomUI = phase === "battle" && koStage === null;
  const showQuestionInputs = showBottomUI;

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
        <div className="absolute inset-x-0 top-1 z-30 flex justify-center pointer-events-none px-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`${A}/ui/panels/team_attack.png`} alt="TEAM ATTACK" className="anim-panelPop object-contain max-w-[85%]" style={{ height: SIZE.panelBanner }} />
        </div>
      ) : (
        joinLabel && (
          <div className="absolute inset-x-0 top-1 z-30 flex justify-center pointer-events-none px-4">
            <p className="anim-panelPop bg-white/90 rounded-full px-3 py-1.5 text-xs font-black text-sky-600 tracking-wide shadow leading-normal text-center">
              {joinLabel}
            </p>
          </div>
        )
      )}

      {/* 상단: 아주 작은 스테이지 표시 + 몬스터 이름/HP바 한 줄, 플레이어 하트 */}
      <div className="relative z-10 flex flex-col gap-1 px-3 pt-2">
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-white/80 font-bold tracking-widest drop-shadow leading-normal">
            STAGE {defeatedCount + 1}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={toggleBgm}
              aria-label={bgmOn ? "배경음 끄기" : "배경음 켜기"}
              className="text-[13px] leading-none drop-shadow"
            >
              {bgmOn ? "🔊" : "🔇"}
            </button>
            <HeartRow key={playerHitKey} hp={playerHp} />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-xs font-bold drop-shadow leading-normal ${monster.isBoss ? "text-red-300" : "text-white"}`}>
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

      {/* 중앙: 전투 무대. 캐릭터와 몬스터가 화면 비율(가로/세로)에 관계없이 항상 중앙 부근에서
          만나도록 justify-center + 반응형 간격을 쓰고, 크기도 vmin 기준이라 화면이 회전해도
          비율이 유지된다. intro 단계의 VS/WARNING도 이 영역 안에 절대 위치로 겹쳐서 보여준다. */}
      <div
        ref={battleAreaRef}
        className="relative z-10 flex items-end justify-center gap-[4vmin] px-4 py-4 flex-1"
        style={{ minHeight: "clamp(220px, 44vmin, 400px)" }}
      >
        {/* 공격 이펙트 레이어: battle-area 기준 절대 좌표로, 실제 맞는 캐릭터 위치에 정확히 겹치게 */}
        <div className="absolute inset-0 pointer-events-none z-20">
          {fxKind && fxPos && attackStage && attackStage !== "windup" && (
            <div
              className="absolute"
              style={{ left: fxPos.x, top: fxPos.y, width: SIZE.fx, height: SIZE.fx, transform: "translate(-50%, -50%)" }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                key={`${fxKey}-${attackStage === "dash" ? "dash" : "impact"}`}
                src={`${A}/effects/${
                  attackStage === "dash" ? FX_STAGE_IMG[fxKind].dash : FX_STAGE_IMG[fxKind].impact
                }.png`}
                alt=""
                className="anim-fxPopIn object-contain w-full h-full"
                style={{
                  opacity: attackStage === "fadeout" || attackStage === "recover" ? 0 : 1,
                  transition: `opacity ${ATK_FADEOUT_MS}ms ease-in`,
                }}
              />
            </div>
          )}
        </div>

        {/* intro: VS. 캐릭터보다 확실히 작게(보조 연출), 둘 사이 간격 한가운데에 배치 */}
        {showIntroVs && (
          <div className="absolute inset-0 z-30 flex items-center justify-center pointer-events-none px-6">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`${A}/ui/panels/vs_panel.png`}
              alt="VS"
              className="anim-vsPop object-contain max-w-[40%]"
              style={{
                width: SIZE.vsPanel,
                height: "auto",
                opacity: introStage === "vs" ? 1 : 0,
                transition: `opacity ${INTRO_VS_OUT_MS}ms ease-in`,
              }}
            />
          </div>
        )}
        {/* intro: WARNING / BOSS BATTLE */}
        {showIntroWarning && (
          <div className="absolute inset-0 z-30 flex items-center justify-center pointer-events-none px-6">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={introBannerImg}
              alt={introBannerAlt}
              className="anim-warningShake object-contain max-w-[75%]"
              style={{
                height: SIZE.introBanner,
                opacity: introStage === "warning" ? 1 : 0,
                transition: `opacity ${INTRO_WARNING_OUT_MS}ms ease-in`,
              }}
            />
          </div>
        )}

        {showBottomUI && feedback === "wrong" && (
          <p key={wrongLabelKey} className="anim-popupFade absolute left-6 top-2 text-lg font-black text-red-300 drop-shadow z-20 leading-normal">
            OOPS!
          </p>
        )}
        {showBottomUI && attackPopup && !teamAttackActive && (
          <div key={popupKey} className="anim-popupFade absolute left-[15%] top-0 z-20 flex flex-col items-center pointer-events-none">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={attackPopup.img} alt="" className="object-contain" style={{ width: SIZE.attackCard, height: SIZE.attackCard }} />
            <span className="text-sm font-black text-white drop-shadow leading-normal">{attackPopup.label}</span>
          </div>
        )}

        {/* 플레이어 팀: 메인 캐릭터를 중심으로 나머지가 뒤에 겹쳐서 "하나의 팀"처럼 보이게 배치 */}
        {teamAttackActive ? (
          <div
            className="flex items-end gap-1"
            style={{ transform: playerWrapTransform, transition: `transform ${playerWrapDuration}ms ease-out` }}
          >
            {team.map((id) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={id}
                src={TEAM_INFO[id].attack}
                alt=""
                className="object-contain drop-shadow"
                style={{ width: SIZE.attackImg, height: SIZE.attackImg }}
              />
            ))}
          </div>
        ) : (
          <div
            className="relative"
            style={{
              width: SIZE.clusterW,
              height: SIZE.clusterH,
              transform: playerWrapTransform,
              transition: `transform ${playerWrapDuration}ms ease-out`,
            }}
          >
            {/* 세 번째 합류(흑표범): 메인과 같은 바닥선, 뒤쪽 오른편에 겹치게 */}
            {team[2] && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={team[2]}
                src={TEAM_INFO[team[2]].idle}
                alt=""
                className="anim-teamJoin absolute object-contain opacity-95"
                style={{ width: SIZE.team, height: SIZE.team, right: 0, bottom: 0, zIndex: 5 }}
              />
            )}
            {/* 두 번째 합류(독수리): 비행 캐릭터라 바닥선보다 살짝 위, 뒤쪽 왼편에 겹치게 */}
            {team[1] && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={team[1]}
                src={TEAM_INFO[team[1]].idle}
                alt=""
                className="anim-teamJoin absolute object-contain opacity-95"
                style={{ width: SIZE.team, height: SIZE.team, left: 0, bottom: SIZE.teamOffsetBottom, zIndex: 5 }}
              />
            )}
            {/* DASH 공격: 돌진하는 동안 플레이어 뒤쪽에 속도선 표시 */}
            {feedback === "correct" && fxKind === "dash" && attackStage === "dash" && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={`${A}/effects/speed_lines.png`}
                alt=""
                className="anim-fxPopIn absolute object-contain pointer-events-none"
                style={{ width: SIZE.fx, height: SIZE.fx, left: "-4%", bottom: "8%", zIndex: 9 }}
              />
            )}
            {/* 메인 캐릭터: 가장 크게, 맨 앞. 이미 오른쪽(몬스터 방향)을 보고 있는 원본 그대로 사용 */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              ref={playerImgRef}
              key={`player-${playerHitKey}`}
              src={playerSpriteAttacking ? TEAM_INFO[team[0]].attack : TEAM_INFO[team[0]].idle}
              alt=""
              className={`absolute object-contain drop-shadow ${
                feedback === "wrong" && (attackStage === "impact" || attackStage === "fadeout") ? "anim-playerRecoil" : ""
              }`}
              style={{ width: SIZE.main, height: SIZE.main, left: "12%", bottom: 0, zIndex: 10 }}
            />
          </div>
        )}

        {/* 몬스터 */}
        <div
          className="relative flex items-end"
          style={{ transform: monsterWrapTransform, transition: `transform ${monsterWrapDuration}ms ease-out` }}
        >
          {monster.isBoss && koStage !== "panel" && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={`${A}/effects/dark_aura.png`}
              alt=""
              className="absolute inset-0 m-auto object-contain anim-auraPulse pointer-events-none"
              style={{ width: SIZE.aura, height: SIZE.aura }}
            />
          )}
          {/* FIRE 피격 시 몸에 붉은/주황 플래시를 짧게 */}
          {feedback === "correct" && fxKind === "fire" && (attackStage === "impact" || attackStage === "fadeout") && (
            <div
              className="absolute inset-0 m-auto object-contain pointer-events-none anim-fireFlash"
              style={{
                width: monster.isBoss ? SIZE.boss : SIZE.monster,
                height: monster.isBoss ? SIZE.boss : SIZE.monster,
                borderRadius: "9999px",
                background: "radial-gradient(circle, rgba(255,120,0,0.55) 0%, rgba(255,60,0,0) 70%)",
              }}
            />
          )}
          {/* 처치(마무리) 연기 */}
          {koStage === "defeat" && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={`${A}/effects/smoke_hit.png`}
              alt=""
              className="absolute inset-0 m-auto object-contain pointer-events-none anim-fxPopIn"
              style={{ width: monster.isBoss ? SIZE.boss : SIZE.monster, height: monster.isBoss ? SIZE.boss : SIZE.monster }}
            />
          )}
          {koStage === "panel" ? null : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              ref={monsterImgRef}
              key={`monster-${monsterHitKey}`}
              src={monster.img}
              alt={monster.name}
              className={`relative object-contain ${
                koStage === "defeat"
                  ? "anim-monsterKO"
                  : feedback === "correct" && fxKind && (attackStage === "impact" || attackStage === "fadeout")
                  ? FX_MONSTER_ANIM[fxKind]
                  : ""
              }`}
              style={{
                width: monster.isBoss ? SIZE.boss : SIZE.monster,
                height: monster.isBoss ? SIZE.boss : SIZE.monster,
                // 원본이 정면/오른쪽을 보고 있어 scaleX(-1)로 뒤집어 플레이어(왼쪽)를 바라보게 한다.
                transform: `scaleX(-1)${isFlying ? " translateY(-1.5rem)" : ""}`,
              }}
            />
          )}
        </div>
      </div>

      {koStage === "panel" && (
        <div className="relative z-10 flex flex-col items-center gap-1 pb-3 anim-panelPop">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`${A}/ui/panels/${monster.isBoss ? "victory" : "ko"}.png`}
            alt={monster.isBoss ? "VICTORY" : "KO"}
            className="object-contain"
            style={{ height: monster.isBoss ? SIZE.panelBig : SIZE.panelBanner }}
          />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`${A}/effects/dust.png`} alt="" className="object-contain -mt-2 opacity-80" style={{ width: SIZE.dust, height: `calc(${SIZE.dust} * 0.6)` }} />
        </div>
      )}

      {/* 하단: 남은 시간 바 + 질문(한국어 뜻) + 알파벳 타일을 눌러 스펠링 조합 */}
      {showBottomUI && (
        <div className="relative z-10 flex flex-col gap-2 px-3 pb-3">
          <div className="h-1.5 rounded-full bg-white/25 overflow-hidden mx-2">
            <div
              className={`h-full ${timeBarColor} transition-[width] duration-100 ease-linear`}
              style={{ width: `${timePct}%` }}
            />
          </div>
          <p className="text-center text-sm font-bold text-white bg-black/35 rounded-full py-1 mx-8 leading-normal">
            &quot;{promptText}&quot;
          </p>

          {/* 완성 중인 스펠링 (탭하면 다시 뺄 수 있음) */}
          <div className="flex flex-wrap justify-center gap-1.5 min-h-[2.6rem] mx-4 border-b-2 border-dashed border-white/40 pb-1.5">
            {placedLetters.map((item) => (
              <button
                key={item.id}
                onClick={() => tapPlacedLetter(item)}
                disabled={!showQuestionInputs || !!feedback}
                className="w-9 h-9 rounded-lg bg-white/90 border-2 border-sky-300 font-black text-base text-sky-700 uppercase leading-normal"
              >
                {item.ch}
              </button>
            ))}
            {feedback === "wrong" && (
              <span className="w-full text-center text-xs font-bold text-red-200 leading-relaxed py-0.5">
                정답: {question.word.english.toUpperCase()}
              </span>
            )}
          </div>

          {/* 고를 수 있는 알파벳 타일 */}
          <div className="flex flex-wrap justify-center gap-1.5 mx-2">
            {letterPool.map((item) => (
              <button
                key={item.id}
                onClick={() => tapPoolLetter(item)}
                disabled={!showQuestionInputs || !!feedback}
                className="w-9 h-9 rounded-lg bg-white border-2 border-white/70 font-black text-base text-gray-700 uppercase active:scale-95 transition leading-normal"
              >
                {item.ch}
              </button>
            ))}
          </div>
        </div>
      )}

      <button
        onClick={onDone}
        className="relative z-10 self-center mb-2 text-[11px] text-white/80 bg-black/25 rounded-full px-3 py-0.5 leading-normal"
      >
        그만하기
      </button>
    </div>
  );
}
