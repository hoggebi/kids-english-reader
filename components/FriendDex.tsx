"use client";

import { useEffect, useState } from "react";
import {
  CHAPTER_SPECIES,
  MAX_STAGE,
  VOCAB_SPECIES,
  getDoneLessons,
  getPetImagePath,
  loadPet,
  type PetState,
  type PetTrack,
  type Species,
} from "@/lib/pet";
import { BUILTIN_LESSONS } from "@/lib/chunkbookBuiltin";

const SPECIES_NAME = (sp: Species) => sp.stages[MAX_STAGE - 1].name.replace("완벽한 성체 ", "");

function Shelf({ title, track, species, pet }: { title: string; track: PetTrack; species: Species[]; pet: PetState }) {
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
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={getPetImagePath(shown, track)}
                alt={state === "locked" ? "아직 만나지 못한 친구" : SPECIES_NAME(sp)}
                className={`w-24 h-24 object-contain ${state === "locked" ? "brightness-0 opacity-20" : ""}`}
              />
              <p className="text-sm font-bold text-gray-800">{state === "locked" ? "???" : SPECIES_NAME(sp)}</p>
              <p className={`text-xs font-bold ${state === "done" ? "text-sky-600" : "text-gray-400"}`}>
                {state === "done" ? "다 키웠어요 🎉" : state === "growing" ? `키우는 중 ${pet.stage}/${MAX_STAGE}단계` : "곧 만나요"}
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export default function FriendDex() {
  const [chapterPet, setChapterPet] = useState<PetState | null>(null);
  const [vocabPet, setVocabPet] = useState<PetState | null>(null);
  const [lessons, setLessons] = useState<number[]>([]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 저장소(localStorage)를 마운트 후에만 읽을 수 있다
    setChapterPet(loadPet("chapter"));
    setVocabPet(loadPet("vocab"));
    setLessons(getDoneLessons());
  }, []);

  if (!chapterPet || !vocabPet) return null;

  return (
    <div className="w-full max-w-4xl flex flex-col gap-4" data-testid="friend-dex">
      <div className="text-center">
        <p className="text-2xl font-bold text-sky-600">친구 도감</p>
        <p className="text-sm text-gray-500">공부하면서 만난 친구들이 여기에 모여요.</p>
      </div>

      <section className="rounded-2xl bg-gray-50 p-4 flex flex-col gap-3">
        <div className="flex items-baseline justify-between">
          <h3 className="text-lg font-bold text-gray-800">청크북 도장</h3>
          <span className="text-sm font-bold text-sky-600">
            {BUILTIN_LESSONS.filter((l) => lessons.includes(l)).length}/{BUILTIN_LESSONS.length}
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          {BUILTIN_LESSONS.map((l) => {
            const done = lessons.includes(l);
            return (
              <div
                key={l}
                className={`w-20 h-20 rounded-full flex flex-col items-center justify-center text-sm font-bold ${
                  done ? "bg-sky-600 text-white" : "bg-gray-200 text-gray-400"
                }`}
              >
                <span className="text-xl">{done ? "⭐" : "·"}</span>
                <span>Lesson {l}</span>
              </div>
            );
          })}
        </div>
      </section>

      <Shelf title="챕터·청크북 친구" track="chapter" species={CHAPTER_SPECIES} pet={chapterPet} />
      <Shelf title="단어장 친구" track="vocab" species={VOCAB_SPECIES} pet={vocabPet} />
    </div>
  );
}
