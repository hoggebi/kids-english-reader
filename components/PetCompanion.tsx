"use client";

import { useEffect, useState } from "react";
import { COINS_PER_STAGE, MAX_STAGE, getPetImagePath, getStageInfo, loadPet, loadPetXp, type PetState } from "@/lib/pet";

// 청크북 Lesson 화면 위쪽에서 같이 공부하는 캐릭터. tick이 바뀔 때마다 최신 상태를 다시 읽고,
// message가 있으면 말풍선으로 반응한다.
export default function PetCompanion({ tick, message, popping = false }: { tick: number; message?: string | null; popping?: boolean }) {
  const [pet, setPet] = useState<PetState | null>(null);
  const [xp, setXp] = useState(0);
  const [talkIdx, setTalkIdx] = useState(0);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 저장소(localStorage)를 마운트 후에만 읽을 수 있다
    setPet(loadPet("chapter"));
    setXp(loadPetXp());
  }, [tick]);

  useEffect(() => {
    const t = setInterval(() => setTalkIdx((i) => i + 1), 5000);
    return () => clearInterval(t);
  }, []);

  if (!pet) return null;
  const info = getStageInfo(pet, "chapter");
  const line = message ?? info.talk[talkIdx % info.talk.length];

  return (
    <div className="flex items-center gap-3 rounded-2xl bg-gray-50 p-3" data-testid="pet-companion">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={getPetImagePath(pet, "chapter")}
        alt={info.name}
        className={`w-16 h-16 object-contain shrink-0 ${popping ? "animate-bounce" : ""}`}
      />
      <div className="flex-1 min-w-0 flex flex-col gap-1.5">
        <p className="text-sm font-bold text-gray-700 leading-snug" aria-live="polite">
          {line}
        </p>
        <div className="flex items-center gap-2">
          <div className="flex-1 h-2 rounded-full bg-gray-200 overflow-hidden">
            <div className="h-full bg-sky-500 transition-all duration-500" style={{ width: `${(xp / COINS_PER_STAGE) * 100}%` }} />
          </div>
          <span className="text-xs text-gray-400 font-bold shrink-0">
            🪙 {xp}/{COINS_PER_STAGE} · {pet.stage}/{MAX_STAGE}단계
          </span>
        </div>
      </div>
    </div>
  );
}
