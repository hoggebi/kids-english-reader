"use client";

import { useEffect, useRef, useState } from "react";
import type { VocabWord } from "@/lib/types";
import { loadPet, getPetImagePath } from "@/lib/pet";
import { nextMonster, type Monster } from "@/lib/monsters";
import { shuffle, buildOptions, playTone, ComboBadge } from "./VocabGame";

type Feedback = "correct" | "wrong" | null;
type Direction = "toEng" | "toKor";

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

// 전투 전용 애니메이션 (정답 맞히기 게임들과 동일한 방식으로 한 번만 렌더)
function BattleStyles() {
  return (
    <style>{`
      @keyframes battleAttack {
        0%, 100% { transform: translateX(0); }
        40% { transform: translateX(28px); }
        60% { transform: translateX(28px); }
      }
      @keyframes battleShake {
        0%, 100% { transform: translateX(0); }
        20% { transform: translateX(-8px) rotate(-4deg); }
        40% { transform: translateX(8px) rotate(4deg); }
        60% { transform: translateX(-6px) rotate(-2deg); }
        80% { transform: translateX(6px) rotate(2deg); }
      }
      @keyframes bossPop {
        0% { transform: scale(0.4); opacity: 0; }
        60% { transform: scale(1.1); opacity: 1; }
        100% { transform: scale(1); opacity: 1; }
      }
      .battle-attack { animation: battleAttack 0.45s ease-out; }
      .battle-shake { animation: battleShake 0.45s ease-out; }
      .boss-pop { animation: bossPop 0.5s ease-out; }
      @media (prefers-reduced-motion: reduce) {
        .battle-attack, .battle-shake, .boss-pop { animation: none; }
      }
    `}</style>
  );
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
  const [phase, setPhase] = useState<"intro" | "battle" | "victory">(
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
    setPhase(m.isBoss ? "intro" : "battle");
  }

  function handleRetryBattle() {
    defeatedCountRef.current = 0;
    onRetry();
  }

  function answer(word: VocabWord) {
    if (!question || feedback) return;
    const ok = word.id === question.word.id;
    setSelectedId(word.id);
    setTotalCount((c) => c + 1);
    playTone(ok ? "correct" : "wrong");

    if (ok) {
      const nextCombo = combo + 1;
      const damage = nextCombo > 0 && nextCombo % 3 === 0 ? 2 : 1;
      setCombo(nextCombo);
      setBestCombo((b) => Math.max(b, nextCombo));
      setCorrectCount((c) => c + 1);
      setFeedback("correct");
      setCharHit((k) => k + 1);
      setMonsterHit((k) => k + 1);

      const newHp = Math.max(0, hp - damage);
      setHp(newHp);

      setTimeout(() => {
        if (newHp <= 0) {
          defeatedCountRef.current += 1;
          setPhase("victory");
        } else {
          setQuestion(makeQuestion(words, question.word.id));
          setFeedback(null);
          setSelectedId(null);
        }
      }, 550);
    } else {
      setCombo(0);
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
        <span className="text-6xl">{monster.emoji}</span>
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

  return (
    <div className="relative rounded-3xl overflow-hidden p-4 flex flex-col gap-4 bg-gray-100">
      <BattleStyles />

      {phase === "intro" ? (
        <div className="flex flex-col items-center justify-center gap-2 py-10 boss-pop">
          <p className="text-4xl">👹</p>
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

          {/* 중앙: 캐릭터 VS 몬스터 */}
          <div className="relative flex items-center justify-center gap-8 py-6">
            <ComboBadge combo={combo} />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              key={charHit}
              src={getPetImagePath(pet, "vocab")}
              alt="캐릭터"
              className={`w-16 h-16 object-contain ${feedback === "correct" ? "battle-attack" : ""}`}
            />
            <span
              key={monsterHit}
              className={`select-none ${monster.isBoss ? "text-8xl" : "text-5xl"} ${
                feedback === "correct" ? "battle-shake" : ""
              }`}
            >
              {monster.emoji}
            </span>
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
