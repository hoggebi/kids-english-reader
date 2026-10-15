"use client";

import { useRef, useState } from "react";
import type { VocabWord } from "@/lib/types";
import {
  loadGameCycle,
  recordGameCycleProgress,
  type GameCycleKind,
  type GameCycleState,
  type PetState,
} from "@/lib/pet";
import { recordVocabGamePlayed } from "@/lib/vocabStorage";
import { autoPush } from "@/lib/sync";
import BattleGame from "./BattleGame";
import DartGame from "./DartGame";
import MoleGame from "./MoleGame";
import PetDisplay from "./PetDisplay";
import { CoinIcon } from "./Coin";

type GameKind = "hunt" | "mole" | "battle";

// 캐릭터 성장 사이클: 다트/두더지/몬스터를 한 번씩 마치면(3/3) 캐릭터가 바로 한 단계 자란다.
const CYCLE_KIND_BY_GAME: Partial<Record<GameKind, GameCycleKind>> = {
  hunt: "dart",
  mole: "mole",
  battle: "monster",
};
const CYCLE_LABEL: Record<GameCycleKind, string> = { dart: "다트", mole: "두더지", monster: "몬스터" };

export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// 게임은 이 3개만 있다. 코인은 각 게임 안에서(다트·두더지: 결과, 몬스터 배틀: 스테이지를 깰 때마다) 지갑에 들어간다.
const GAME_INFO: { kind: GameKind; title: string; desc: string; emoji?: string; img?: string }[] = [
  { kind: "hunt", title: "다트 게임", desc: "정답 표적을 겨냥해서 던져요", emoji: "🎯" },
  { kind: "mole", title: "두더지 잡기", desc: "정답 단어가 쓰인 두더지를 톡 잡아요", img: "/mole.png" },
  { kind: "battle", title: "몬스터 배틀", desc: "문제를 맞혀서 몬스터를 물리쳐요", emoji: "⚔️" },
];

// 공통 애니메이션 정의 (게임 화면에서 한 번만 렌더)
function GameStyles() {
  return (
    <style>{`
      @keyframes particlePop {
        0% { transform: translate(-50%, -50%) scale(0.6); opacity: 1; }
        100% { transform: translate(calc(-50% + var(--dx)), calc(-50% + var(--dy))) scale(1.2); opacity: 0; }
      }
      @keyframes comboPop {
        0% { transform: translate(-50%, -50%) scale(0.5); opacity: 0; }
        30% { transform: translate(-50%, -50%) scale(1.3); opacity: 1; }
        100% { transform: translate(-50%, -60%) scale(1); opacity: 0; }
      }
      @keyframes starPop {
        0% { transform: scale(0) rotate(-20deg); opacity: 0; }
        60% { transform: scale(1.3) rotate(10deg); }
        100% { transform: scale(1) rotate(0deg); opacity: 1; }
      }
      @keyframes bounceCorrect {
        0%, 100% { transform: translateY(0) scale(1); }
        50% { transform: translateY(-10px) scale(1.15); }
      }
      @keyframes wobbleWrong {
        0%, 100% { transform: rotate(0deg); }
        25% { transform: rotate(-10deg); }
        75% { transform: rotate(10deg); }
      }
      @keyframes runBob {
        0%, 100% { transform: translateY(0); }
        50% { transform: translateY(-6px); }
      }
      @keyframes malletHit {
        0% { transform: translate(-50%, -30%); opacity: 0; }
        30% { transform: translate(-50%, -30%); opacity: 1; }
        60% { transform: translate(-50%, 15%); opacity: 1; }
        100% { transform: translate(-50%, 15%); opacity: 0; }
      }
      @keyframes dartHit {
        0% { transform: rotate(135deg) scale(0); opacity: 0; }
        60% { transform: rotate(135deg) scale(1.3); opacity: 1; }
        100% { transform: rotate(135deg) scale(1); opacity: 1; }
      }
      .particle { position: absolute; left: 50%; top: 50%; animation: particlePop 0.7s ease-out forwards; }
      .combo-badge { position: absolute; left: 50%; top: 12%; animation: comboPop 0.7s ease-out forwards; }
      .star-pop { animation: starPop 0.5s ease-out forwards; }
      .char-correct { animation: bounceCorrect 0.5s ease-out; }
      .char-wrong { animation: wobbleWrong 0.4s ease-out; }
      .run-bob { animation: runBob 0.4s ease-in-out infinite; }
      .mallet-hit { animation: malletHit 0.6s ease-out; }
      .dart-hit { animation: dartHit 0.3s ease-out forwards; }
      @media (prefers-reduced-motion: reduce) {
        .particle, .combo-badge, .star-pop, .char-correct, .char-wrong, .run-bob, .mallet-hit, .dart-hit { animation: none; }
      }
    `}</style>
  );
}

// ---------- 사운드 (Web Audio, 파일 없이 즉석 생성) ----------
let sharedCtx: AudioContext | null = null;
function getAudioCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!sharedCtx) {
    const Ctor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    sharedCtx = new Ctor();
  }
  return sharedCtx;
}

export function playTone(kind: "correct" | "wrong") {
  const ctx = getAudioCtx();
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);
  const now = ctx.currentTime;
  gain.gain.setValueAtTime(0.16, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
  if (kind === "correct") {
    osc.frequency.setValueAtTime(523.25, now);
    osc.frequency.setValueAtTime(783.99, now + 0.1);
  } else {
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.exponentialRampToValueAtTime(110, now + 0.25);
  }
  osc.start(now);
  osc.stop(now + 0.3);
}

export function ComboBadge({ combo }: { combo: number }) {
  if (combo < 2) return null;
  return (
    <div key={combo} className="combo-badge text-sky-500 font-black text-xl z-20 -translate-x-1/2">
      {combo} 콤보!
    </div>
  );
}

export function buildOptions(words: VocabWord[], target: VocabWord, count = 3) {
  const distractors = shuffle(words.filter((w) => w.id !== target.id)).slice(0, count - 1);
  return shuffle([target, ...distractors]);
}

export default function VocabGame({
  words,
  moleWords,
  onDone,
  setId,
  onStudyMore,
}: {
  words: VocabWord[];
  moleWords?: VocabWord[]; // 두더지 게임에만 쓰는 선택한 레슨 전체 단어(없으면 words)
  onDone: () => void;
  setId: string;
  onStudyMore?: () => void;
}) {
  const [kind, setKind] = useState<GameKind | null>(null);
  const [playKey, setPlayKey] = useState(0);
  const [cycle, setCycle] = useState<GameCycleState>(() => loadGameCycle());
  const [levelUp, setLevelUp] = useState<PetState | null>(null);
  const recordedRef = useRef<string | null>(null);

  if (words.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 py-10">
        <p className="text-gray-400">오늘 복습할 단어가 없어요.</p>
        <button onClick={onDone} className="px-6 py-2 rounded-full bg-sky-600 text-white font-bold">
          확인
        </button>
      </div>
    );
  }

  // 캐릭터 성장 축하 화면 — 다트/두더지/몬스터를 모두 완료해서 3/3이 됐을 때만 보여준다.
  if (levelUp) {
    return (
      <div className="w-full max-w-4xl flex flex-col items-center gap-5 py-8">
        <p className="text-2xl font-bold text-sky-600 text-center">LEVEL UP!</p>
        <p className="text-gray-600 text-center">새로운 모습으로 성장했어요!</p>
        <PetDisplay pet={levelUp} track="vocab" size="lg" justGrew />
        <button
          onClick={() => {
            setLevelUp(null);
            onDone();
          }}
          className="w-full max-w-xs py-3 rounded-full bg-sky-600 text-white font-bold active:scale-95 transition"
        >
          확인
        </button>
      </div>
    );
  }

  if (!kind) {
    return (
      <div className="w-full max-w-4xl flex flex-col gap-4">
        <p className="text-center text-sm text-gray-400 font-bold">어떤 게임으로 복습할까요?</p>

        {/* 성장 사이클: 다트/두더지/몬스터 완료 여부 + N/3. 게임을 할 때마다 🪙 코인도 쌓여요 */}
        <div className="rounded-2xl bg-sky-50 border-2 border-sky-100 px-4 py-3 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-sky-700">캐릭터 성장 진행도</span>
            <span className="text-sm font-bold text-sky-700">
              {[cycle.dart, cycle.mole, cycle.monster].filter(Boolean).length} / 3
            </span>
          </div>
          <div className="flex gap-2">
            {(["dart", "mole", "monster"] as GameCycleKind[]).map((k) => (
              <div
                key={k}
                className={`flex-1 rounded-full py-1.5 text-center text-xs font-bold ${
                  cycle[k] ? "bg-sky-500 text-white" : "bg-white text-gray-400 border border-sky-200"
                }`}
              >
                {cycle[k] ? `${CYCLE_LABEL[k]} 완료` : `${CYCLE_LABEL[k]} 도전 중`}
              </div>
            ))}
          </div>
          <p className="text-xs text-amber-600 font-bold flex items-center gap-1"><CoinIcon size={16} /> 게임을 할 때마다 코인이 쌓여요. 상점에서 쓸 수 있어요.</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {GAME_INFO.map((g) => {
            const cycleKind = CYCLE_KIND_BY_GAME[g.kind];
            const isDone = cycleKind ? cycle[cycleKind] : false;
            return (
              <button
                key={g.kind}
                onClick={() => {
                  setKind(g.kind);
                  setPlayKey(0);
                }}
                className="relative flex flex-col items-center gap-1 py-6 rounded-2xl bg-gray-50 border-2 border-transparent hover:border-sky-300 active:scale-95 transition"
              >
                {isDone && (
                  <span className="absolute top-2 right-2 w-6 h-6 rounded-full bg-sky-500 text-white text-xs font-bold flex items-center justify-center">
                    ✓
                  </span>
                )}
                <div className="w-14 h-14 flex items-center justify-center">
                  {g.img ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={g.img} alt={g.title} className="w-14 h-14 object-contain" />
                  ) : (
                    <span className="text-4xl">{g.emoji}</span>
                  )}
                </div>
                <span className="font-bold text-gray-800">{g.title}</span>
                <span className="text-xs text-gray-400 text-center px-2">{g.desc}</span>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  const handleRetry = () => setPlayKey((k) => k + 1);

  // 게임이 끝나 결과 화면이 뜨는 순간(onComplete) 자동으로 기록한다: 오늘 이 게임 종류를 마쳤다고 남기고,
  // 코인은 게임 중에 쌓이며, 다트/두더지/몬스터 3종을 모두 마치면 캐릭터가 바로 한 단계 자란다.
  // 같은 판(playKey)은 한 번만 기록해서, 나가기를 눌러도 두 번 세지 않는다.
  function recordGameOnce(): boolean {
    const id = `${kind}-${playKey}`;
    if (recordedRef.current === id) return false;
    recordedRef.current = id;
    if (kind) recordVocabGamePlayed(setId, kind);
    const cycleKind = kind ? CYCLE_KIND_BY_GAME[kind] : undefined;
    if (cycleKind) {
      const result = recordGameCycleProgress(cycleKind);
      setCycle(result.cycle);
      // 성장/코인이 저장된 "뒤에" 서버로 올린다. (먼저 올리면 서버에는 자라기 전 값이 남고,
      // 다음 동기화 때 그 값으로 되돌아가 캐릭터가 계속 같은 단계에 머문다.)
      autoPush();
      if (result.leveledUp && result.grow) {
        setLevelUp(result.grow.pet); // 축하 화면. 확인을 누르면 onDone()이 호출된다.
        return true;
      }
    }
    autoPush();
    return false;
  }

  function handleGameComplete() {
    recordGameOnce();
  }

  // 결과 화면의 나가기/그만하기 등. 이미 기록된 판이면 다시 세지 않는다.
  function handleGameDone() {
    if (recordGameOnce()) return;
    onDone();
  }

  return (
    <div className="w-full max-w-4xl flex flex-col gap-4">
      <GameStyles />
      <button onClick={() => setKind(null)} className="self-start text-sm text-gray-400 underline">
        게임 다시 고르기
      </button>
      {kind === "hunt" && (
        <DartGame key={playKey} words={words} onDone={handleGameDone} onComplete={handleGameComplete} onRetry={handleRetry} onExit={() => setKind(null)} />
      )}
      {kind === "mole" && (
        <MoleGame key={playKey} words={moleWords && moleWords.length >= 3 ? moleWords : words} onDone={handleGameDone} onComplete={handleGameComplete} onRetry={handleRetry} onExit={() => setKind(null)} />
      )}
      {kind === "battle" && (
        <BattleGame
          key={playKey}
          words={words}
          onDone={handleGameDone}
          onComplete={handleGameComplete}
          onRetry={handleRetry}
          setId={setId}
          onStudyMore={onStudyMore}
        />
      )}
    </div>
  );
}
