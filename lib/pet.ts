"use client";

const PET_KEY = "little-reader-pet";
const DONE_CHAPTERS_KEY = "little-reader-done-chapters";

export const MAX_STAGE = 8;

export type PetState = {
  // 현재 동물이 몇 번째 단계인지 (1~8)
  stage: number;
  // 몇 번째 동물인지 (8단계 다 키우면 다음 세대로)
  generation: number;
};

export const STAGE_INFO: { name: string; desc: string; talk: string[] }[] = [
  {
    name: "아기 북극여우",
    desc: "태어난지 얼마 안 된 작고 귀여운 아기예요.",
    talk: ["호야, 만나서 반가워!", "나 방금 태어났어!", "같이 공부하자!"],
  },
  {
    name: "막 걸음마 뗀 북극여우",
    desc: "호기심이 많아지고 세상을 탐험해요.",
    talk: ["호야 덕분에 걸을 수 있게 됐어!", "세상이 궁금해!", "다음 챕터도 읽어줘!"],
  },
  {
    name: "장난꾸러기 북극여우",
    desc: "뛰어놀기를 좋아하고 에너지가 넘쳐요!",
    talk: ["같이 뛰어놀자!", "호야 영어 진짜 잘한다!", "나 점점 커지고 있어!"],
  },
  {
    name: "활발한 북극여우",
    desc: "몸도 마음도 쑥쑥 자라 더 씩씩해졌어요.",
    talk: ["오늘도 씩씩하게!", "호야랑 있으면 힘이 나!", "절반쯤 왔어!"],
  },
  {
    name: "튼튼한 북극여우",
    desc: "더 멀리 뛰고, 더 많이 배우며 튼튼하게 자라요.",
    talk: ["이제 제법 컸지?", "호야도 나도 튼튼해지고 있어!", "계속 가보자!"],
  },
  {
    name: "멋진 청소년 북극여우",
    desc: "지혜롭고 자신감이 생겨 스스로 도전해요!",
    talk: ["호야, 우리 대단하지 않아?", "조금만 더 하면 어른이야!", "자신감이 생겼어!"],
  },
  {
    name: "성숙한 북극여우",
    desc: "모든 것을 잘 해내는 멋진 북극여우가 되었어요.",
    talk: ["호야 덕분에 여기까지 왔어!", "이제 한 단계 남았어!", "정말 고마워!"],
  },
  {
    name: "완벽한 성체 북극여우",
    desc: "모든 레슨을 완료했어요! 가장 멋진 북극여우예요!",
    talk: ["호야, 우리 해냈어!", "최고의 짝꿍이야!", "새 친구를 만나러 갈까?"],
  },
];

export function loadPet(): PetState {
  if (typeof window === "undefined") return { stage: 1, generation: 1 };
  try {
    const raw = localStorage.getItem(PET_KEY);
    if (!raw) return { stage: 1, generation: 1 };
    const parsed = JSON.parse(raw) as PetState;
    return {
      stage: Math.min(Math.max(parsed.stage ?? 1, 1), MAX_STAGE),
      generation: parsed.generation ?? 1,
    };
  } catch {
    return { stage: 1, generation: 1 };
  }
}

export function savePet(pet: PetState) {
  if (typeof window === "undefined") return;
  localStorage.setItem(PET_KEY, JSON.stringify(pet));
}

// 이미 완료 처리한 챕터인지 확인 (같은 챕터를 여러 번 해도 한 번만 성장)
export function isChapterDone(chapterId: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    const raw = localStorage.getItem(DONE_CHAPTERS_KEY);
    if (!raw) return false;
    return (JSON.parse(raw) as string[]).includes(chapterId);
  } catch {
    return false;
  }
}

function markChapterDone(chapterId: string) {
  if (typeof window === "undefined") return;
  try {
    const raw = localStorage.getItem(DONE_CHAPTERS_KEY);
    const list = raw ? (JSON.parse(raw) as string[]) : [];
    if (!list.includes(chapterId)) {
      list.push(chapterId);
      localStorage.setItem(DONE_CHAPTERS_KEY, JSON.stringify(list));
    }
  } catch {
    localStorage.setItem(DONE_CHAPTERS_KEY, JSON.stringify([chapterId]));
  }
}

export type GrowResult = {
  pet: PetState;
  grew: boolean;
  graduated: boolean; // 8단계를 다 채우고 새 동물로 넘어갔는지
};

// 챕터를 완료했을 때 호출 — 한 단계 성장시키고, 8단계를 넘으면 새 동물로 시작
export function completeChapter(chapterId: string): GrowResult {
  const current = loadPet();

  if (isChapterDone(chapterId)) {
    return { pet: current, grew: false, graduated: false };
  }

  markChapterDone(chapterId);

  if (current.stage >= MAX_STAGE) {
    const next = { stage: 1, generation: current.generation + 1 };
    savePet(next);
    return { pet: next, grew: true, graduated: true };
  }

  const next = { stage: current.stage + 1, generation: current.generation };
  savePet(next);
  return { pet: next, grew: true, graduated: false };
}

