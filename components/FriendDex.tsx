"use client";

import { useEffect, useState } from "react";
import {
  CHAPTER_SPECIES,
  MAX_STAGE,
  VOCAB_SPECIES,
  getPetImagePath,
  loadPet,
  type PetState,
  type PetTrack,
  type Species,
} from "@/lib/pet";
import { friendKey, loadShop } from "@/lib/shop";
import DecoratedPet from "./DecoratedPet";

const SPECIES_NAME = (sp: Species) => sp.stages[MAX_STAGE - 1].name.replace("완벽한 성체 ", "");

function Shelf({
  title,
  track,
  species,
  pet,
  onDecorate,
}: {
  title: string;
  track: PetTrack;
  species: Species[];
  pet: PetState;
  onDecorate?: (track: PetTrack, generation: number) => void;
}) {
  const equippedAll = loadShop().equipped;
  const collected = Math.max(0, Math.min(species.length, pet.generation - 1));
  return (
    <section className="rounded-2xl bg-gray-50 p-4 flex flex-col gap-3">
      <div className="flex items-baseline justify-between">
        <h3 className="text-lg font-bold text-gray-800">{title}</h3>
        <span className="text-sm font-bold text-sky-600">
          {collected}/{species.length} 만났어요
        </span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {species.map((sp, i) => {
          const gen = i + 1;
          const state = pet.generation > gen ? "done" : pet.generation === gen ? "growing" : "locked";
          const shown: PetState = state === "done" ? { stage: MAX_STAGE, generation: gen } : { stage: state === "growing" ? pet.stage : MAX_STAGE, generation: gen };
          return (
            <div key={i} className="rounded-2xl bg-white p-3 flex flex-col items-center gap-1" data-state={state}>
              {state === "locked" ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={getPetImagePath(shown, track)}
                  alt="아직 만나지 못한 친구"
                  className="w-24 h-24 object-contain brightness-0 opacity-20"
                />
              ) : (
                <DecoratedPet
                  pet={shown}
                  track={track}
                  equipped={equippedAll[friendKey(track, gen)] ?? {}}
                  alt={SPECIES_NAME(sp)}
                  className="w-full"
                  still
                  forceScene
                />
              )}
              <p className="text-sm font-bold text-gray-800">{state === "locked" ? "???" : SPECIES_NAME(sp)}</p>
              <p className={`text-xs font-bold ${state === "done" ? "text-sky-600" : "text-gray-400"}`}>
                {state === "done" ? "다 키웠어요 🎉" : state === "growing" ? `키우는 중 ${pet.stage}/${MAX_STAGE}단계` : "곧 만나요"}
              </p>
              {state !== "locked" && onDecorate && (
                <button
                  onClick={() => onDecorate(track, gen)}
                  className="mt-1 min-h-[44px] px-4 rounded-full bg-sky-50 text-sky-700 text-xs font-bold active:scale-95 transition"
                >
                  🎀 꾸미기
                </button>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

export default function FriendDex({ onDecorate }: { onDecorate?: (track: PetTrack, generation: number) => void }) {
  const [chapterPet, setChapterPet] = useState<PetState | null>(null);
  const [vocabPet, setVocabPet] = useState<PetState | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 저장소(localStorage)를 마운트 후에만 읽을 수 있다
    setChapterPet(loadPet("chapter"));
    setVocabPet(loadPet("vocab"));
  }, []);

  if (!chapterPet || !vocabPet) return null;

  return (
    <div className="w-full max-w-4xl flex flex-col gap-4" data-testid="friend-dex">
      <div className="text-center">
        <p className="text-2xl font-bold text-sky-600">친구 도감</p>
        <p className="text-sm text-gray-500">공부하면서 만난 친구들이 여기에 모여요.</p>
      </div>

      <Shelf title="챕터·청크북 친구" track="chapter" species={CHAPTER_SPECIES} pet={chapterPet} onDecorate={onDecorate} />
      <Shelf title="단어장 친구" track="vocab" species={VOCAB_SPECIES} pet={vocabPet} onDecorate={onDecorate} />
    </div>
  );
}
