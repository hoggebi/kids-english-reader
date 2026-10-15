"use client";

import { useEffect, useState } from "react";
import { CoinText } from "./Coin";
import DecoratedPet from "./DecoratedPet";
import { MAX_STAGE, getStageInfo, loadPet, type PetState, type PetTrack } from "@/lib/pet";
import { friendKey, getEquipped, type Equipped } from "@/lib/shop";

// 청크북/챕터/단어장 어디서나 같은 모습으로 보이는 캐릭터. 현재 단계(진화)와 상점에서 장착한 아이템을
// 첫 화면 캐릭터 카드(PetDisplay)와 똑같이 그린다. tick이 바뀔 때마다 최신 상태를 다시 읽고,
// message가 있으면 말풍선으로 반응한다. 배경이 없으면 배경은 투명하다.
export default function PetCompanion({
  tick,
  message,
  popping = false,
  track = "chapter",
}: {
  tick: number;
  message?: string | null;
  popping?: boolean;
  track?: PetTrack;
}) {
  const [pet, setPet] = useState<PetState | null>(null);
  const [equipped, setEquipped] = useState<Equipped>({});
  const [talkIdx, setTalkIdx] = useState(0);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 저장소(localStorage)는 마운트 후에만 읽을 수 있다
    setPet(loadPet(track));
  }, [tick, track]);

  // 상점에서 장착을 바꾸면 바로 반영한다.
  const generation = pet?.generation;
  useEffect(() => {
    if (generation === undefined) return;
    const read = () => setEquipped(getEquipped(friendKey(track, generation)));
    read();
    window.addEventListener("shop-changed", read);
    return () => window.removeEventListener("shop-changed", read);
  }, [track, generation, tick]);

  useEffect(() => {
    const t = setInterval(() => setTalkIdx((i) => i + 1), 5000);
    return () => clearInterval(t);
  }, []);

  if (!pet) return null;
  const info = getStageInfo(pet, track);
  const line = message ?? info.talk[talkIdx % info.talk.length];
  const hint = track === "vocab" ? "게임 3종을 마치면 자라요 🌱" : "이 Lesson을 끝까지 마치면 자라요 🌱";

  return (
    <div className="flex items-center gap-3 rounded-2xl p-1" data-testid="pet-companion">
      <div className={`shrink-0 w-28 ${popping ? "animate-bounce" : ""}`}>
        <DecoratedPet pet={pet} track={track} equipped={equipped} alt={info.name} className="w-full" still />
      </div>
      <div className="flex-1 min-w-0 flex flex-col gap-1">
        <p className="text-sm font-bold text-gray-700 leading-snug" aria-live="polite">
          <CoinText text={line} />
        </p>
        <p className="text-xs text-gray-400 font-bold">
          {pet.stage}/{MAX_STAGE}단계 · {hint}
        </p>
      </div>
    </div>
  );
}
