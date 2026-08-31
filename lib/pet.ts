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

export type StageInfo = { name: string; desc: string; talk: string[] };
export type Species = { imagePrefix: string; stages: StageInfo[] };

const FOX_STAGES: StageInfo[] = [
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

const EAGLE_STAGES: StageInfo[] = [
  {
    name: "아기 독수리",
    desc: "알에서 막 태어난 작고 폭신한 아기예요.",
    talk: ["호야, 나는 새로운 친구 독수리야!", "아직 날개가 작아!", "잘 부탁해!"],
  },
  {
    name: "막 날갯짓 뗀 독수리",
    desc: "작은 날개를 파닥이며 세상을 궁금해해요.",
    talk: ["날갯짓하는 법을 배웠어!", "하늘이 궁금해!", "계속 같이 하자!"],
  },
  {
    name: "장난꾸러기 독수리",
    desc: "폴짝폴짝 뛰어다니며 에너지가 넘쳐요!",
    talk: ["나 점점 힘이 세지고 있어!", "호야 대단해!", "다음 챕터 가보자!"],
  },
  {
    name: "활발한 독수리",
    desc: "몸도 마음도 쑥쑥 자라 더 씩씩해졌어요.",
    talk: ["오늘도 씩씩하게 날아볼까!", "호야랑 있으면 힘이 나!", "절반쯤 왔어!"],
  },
  {
    name: "튼튼한 독수리",
    desc: "날개가 튼튼해지고 더 높이 날 수 있어요.",
    talk: ["이제 제법 멀리 날 수 있어!", "우리 둘 다 튼튼해지고 있어!", "계속 가보자!"],
  },
  {
    name: "멋진 청소년 독수리",
    desc: "지혜롭고 자신감 넘치게 하늘을 도전해요!",
    talk: ["호야, 우리 진짜 멋지지 않아?", "조금만 더 하면 어른이야!", "자신감이 생겼어!"],
  },
  {
    name: "성숙한 독수리",
    desc: "높은 하늘을 자유롭게 나는 멋진 독수리가 되었어요.",
    talk: ["호야 덕분에 여기까지 왔어!", "이제 한 단계 남았어!", "정말 고마워!"],
  },
  {
    name: "완벽한 성체 독수리",
    desc: "모든 레슨을 완료했어요! 가장 멋진 독수리예요!",
    talk: ["호야, 우리 해냈어!", "최고의 짝꿍이야!", "다음엔 어떤 친구를 만날까?"],
  },
];

const TIGER_STAGES: StageInfo[] = [
  {
    name: "아기 호랑이",
    desc: "이제 막 태어난 작고 포근한 아기예요.",
    talk: ["호야, 나는 새로운 친구 호랑이야!", "아직 걸음마도 서툴러!", "잘 부탁해!"],
  },
  {
    name: "막 걸음마 뗀 호랑이",
    desc: "아장아장 걸으며 세상을 궁금해해요.",
    talk: ["이제 걸을 수 있게 됐어!", "세상이 궁금해!", "계속 같이 하자!"],
  },
  {
    name: "장난꾸러기 호랑이",
    desc: "폴짝폴짝 뛰어다니며 에너지가 넘쳐요!",
    talk: ["나 점점 힘이 세지고 있어!", "호야 대단해!", "다음 챕터 가보자!"],
  },
  {
    name: "활발한 호랑이",
    desc: "몸도 마음도 쑥쑥 자라 더 씩씩해졌어요.",
    talk: ["오늘도 씩씩하게!", "호야랑 있으면 힘이 나!", "절반쯤 왔어!"],
  },
  {
    name: "튼튼한 호랑이",
    desc: "다리 힘이 세지고 더 멀리 달릴 수 있어요.",
    talk: ["이제 제법 빨리 달릴 수 있어!", "우리 둘 다 튼튼해지고 있어!", "계속 가보자!"],
  },
  {
    name: "멋진 청소년 호랑이",
    desc: "지혜롭고 자신감 넘치게 스스로 도전해요!",
    talk: ["호야, 우리 진짜 멋지지 않아?", "조금만 더 하면 어른이야!", "자신감이 생겼어!"],
  },
  {
    name: "성숙한 호랑이",
    desc: "숲을 당당하게 누비는 멋진 호랑이가 되었어요.",
    talk: ["호야 덕분에 여기까지 왔어!", "이제 한 단계 남았어!", "정말 고마워!"],
  },
  {
    name: "완벽한 성체 호랑이",
    desc: "모든 레슨을 완료했어요! 가장 멋진 호랑이예요!",
    talk: ["호야, 우리 해냈어!", "최고의 짝꿍이야!", "다음엔 어떤 친구를 만날까?"],
  },
];

// 여우 → 독수리 → 호랑이 순서로 등장. 다음 동물을 추가할 땐 이 배열 맨 뒤에 이어붙이면 됨.
export const SPECIES: Species[] = [
  { imagePrefix: "", stages: FOX_STAGES },
  { imagePrefix: "e", stages: EAGLE_STAGES },
  { imagePrefix: "t", stages: TIGER_STAGES },
];

// generation에 맞는 동물 종류를 반환. 준비된 동물 세대를 넘어가면 마지막 동물을 계속 씀
export function getSpecies(generation: number): Species {
  const idx = Math.min(generation - 1, SPECIES.length - 1);
  return SPECIES[Math.max(idx, 0)];
}

export function getStageInfo(pet: PetState): StageInfo {
  const species = getSpecies(pet.generation);
  return species.stages[pet.stage - 1] ?? species.stages[0];
}

export function getPetImagePath(pet: PetState): string {
  const species = getSpecies(pet.generation);
  return `/${species.imagePrefix}${pet.stage}.png`;
}

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

// 완료 챕터 ID 전체 목록 가져오기 (다른 기기로 내보낼 때 사용)
export function getAllDoneChapterIds(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(DONE_CHAPTERS_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

// 다른 기기에서 받은 완료 목록을 기존 목록과 합침 (겹치는 건 한 번만)
export function mergeDoneChapterIds(ids: string[]) {
  if (typeof window === "undefined") return;
  const existing = getAllDoneChapterIds();
  const merged = Array.from(new Set([...existing, ...ids]));
  localStorage.setItem(DONE_CHAPTERS_KEY, JSON.stringify(merged));
}

// 다른 기기에서 받은 여우 상태와 비교해서, 더 많이 자란 쪽으로 맞춤
export function mergePetState(incoming: PetState): PetState {
  const current = loadPet();
  const rank = (p: PetState) => p.generation * 100 + p.stage;
  if (rank(incoming) > rank(current)) {
    savePet(incoming);
    return incoming;
  }
  return current;
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
