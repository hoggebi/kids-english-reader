"use client";

import { useEffect, useState } from "react";
import { CoinText } from "./Coin";
import { MAX_STAGE, getPetImagePath, getStageInfo, loadPet, type PetState } from "@/lib/pet";

// 청크북 Lesson 화면 위쪽에서 같이 공부하는 캐릭터. tick이 바뀔 때마다 최신 상태를 다시 읽고,
// message가 있으면 말풍선으로 반응한다. Lesson을 한 번 끝까지 마치면 바로 자란다.
export default function PetCompanion({ tick, message, popping = false }: { tick: number; message?: string | null; popping?: boolean }) {
  const [pet, setPet] = useState<PetState | null>(null);
  const [talkIdx, setTalkIdx] = useState(0);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 저장소(localStorage)는 마운트 후에만 읽을 수 있다
    setPet(loadPet("chapter"));
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
      <div className="flex-1 min-w-0 flex flex-col gap-1">
        <p className="text-sm font-bold text-gray-700 leading-snug" aria-live="polite">
          <CoinText text={line} />
        </p>
        <p className="text-xs text-gray-400 font-bold">
          {pet.stage}/{MAX_STAGE}단계 · 이 Lesson을 끝까지 마치면 자라요 🌱
        </p>
      </div>
    </div>
  );
}
