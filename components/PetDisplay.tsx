"use client";

import { useEffect, useState } from "react";
import { MAX_STAGE, getStageInfo, getPetImagePath, type PetState } from "@/lib/pet";

export default function PetDisplay({
  pet,
  size = "md",
  justGrew = false,
}: {
  pet: PetState;
  size?: "sm" | "md" | "lg";
  justGrew?: boolean;
}) {
  const info = getStageInfo(pet);
  const [talkIndex, setTalkIndex] = useState(0);
  const isEagle = pet.generation >= 2;

  // 말풍선 문구를 주기적으로 바꿔줌 (항상 보이되 지루하지 않게)
  useEffect(() => {
    const t = setInterval(() => {
      setTalkIndex((i) => (i + 1) % info.talk.length);
    }, 4000);
    return () => clearInterval(t);
  }, [info.talk.length]);

  useEffect(() => {
    setTalkIndex(0);
  }, [pet.stage, pet.generation]);

  const imgSize =
    size === "lg" ? "w-40 h-40" : size === "sm" ? "w-16 h-16" : "w-28 h-28";

  const bubbleBorder = isEagle ? "border-amber-700" : "border-sky-200";
  const barColor = isEagle ? "bg-amber-700" : "bg-sky-500";

  return (
    <div className="flex flex-col items-center gap-2">
      <style>{`
        @keyframes petBob {
          0%, 100% { transform: translateY(0) rotate(0deg); }
          25% { transform: translateY(-4px) rotate(-1.5deg); }
          75% { transform: translateY(-2px) rotate(1.5deg); }
        }
        @keyframes petPop {
          0% { transform: scale(0.7); opacity: 0; }
          60% { transform: scale(1.1); }
          100% { transform: scale(1); opacity: 1; }
        }
        .pet-bob { animation: petBob 2.6s ease-in-out infinite; }
        .pet-pop { animation: petPop 0.6s ease-out; }
        @media (prefers-reduced-motion: reduce) {
          .pet-bob, .pet-pop { animation: none; }
        }
      `}</style>

      {/* 말풍선: 독수리(2세대부터)는 갈색 테두리, 그 외에는 하늘색 테두리 */}
      <div className="relative">
        <div className={`bg-white border-2 ${bubbleBorder} rounded-2xl px-4 py-2 shadow-sm max-w-[240px]`}>
          <p className="text-sm text-gray-700 font-bold text-center">
            {info.talk[talkIndex]}
          </p>
        </div>
        <div className={`absolute left-1/2 -translate-x-1/2 -bottom-2 w-3 h-3 bg-white border-r-2 border-b-2 ${bubbleBorder} rotate-45`} />
      </div>

      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={getPetImagePath(pet)}
        alt={info.name}
        className={`${imgSize} object-contain ${justGrew ? "pet-pop" : "pet-bob"}`}
      />

      <div className="text-center">
        <p className="font-bold text-gray-800">{info.name}</p>
        <p className="text-xs text-gray-500 mt-0.5">{info.desc}</p>
      </div>

      {/* 성장 진행 바 */}
      <div className="w-full max-w-[240px] flex items-center gap-2">
        <div className="flex-1 h-2 rounded-full bg-gray-100 overflow-hidden">
          <div
            className={`h-full ${barColor} transition-all duration-700`}
            style={{ width: `${((pet.stage - 1) / (MAX_STAGE - 1)) * 100}%` }}
          />
        </div>
        <span className="text-xs text-gray-400 font-bold shrink-0">
          {pet.stage}/{MAX_STAGE}
        </span>
      </div>

      {pet.generation > 1 && (
        <p className="text-xs text-gray-400">{pet.generation}번째 친구</p>
      )}
    </div>
  );
}
