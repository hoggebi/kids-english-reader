"use client";

const CHAPTER_PET_KEY = "little-reader-pet";
const VOCAB_PET_KEY = "little-reader-vocab-pet";
const DONE_CHAPTERS_KEY = "little-reader-done-chapters";
const DONE_VOCAB_ROUNDS_KEY = "little-reader-done-vocab-rounds";
const CHAPTER_SPECIES_RESET_FLAG = "little-reader-chapter-migration-adopted-v2";
const VOCAB_STAGE_BOOST_FLAG = "little-reader-vocab-stage-boost-v1";

export const MAX_STAGE = 8;

export type PetTrack = "chapter" | "vocab";

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

const SHARK_STAGES: StageInfo[] = [
  {
    name: "아기 상어",
    desc: "이제 막 태어난 작고 귀여운 아기예요.",
    talk: ["호야, 나는 새로운 친구 상어야!", "아직 헤엄도 서툴러!", "잘 부탁해!"],
  },
  {
    name: "막 헤엄치기 시작한 상어",
    desc: "꼬물꼬물 헤엄치며 바닷속을 궁금해해요.",
    talk: ["이제 헤엄칠 수 있게 됐어!", "바닷속이 궁금해!", "계속 같이 하자!"],
  },
  {
    name: "장난꾸러기 상어",
    desc: "이리저리 헤엄쳐 다니며 에너지가 넘쳐요!",
    talk: ["나 점점 힘이 세지고 있어!", "호야 대단해!", "다음 챕터 가보자!"],
  },
  {
    name: "활발한 상어",
    desc: "몸도 마음도 쑥쑥 자라 더 씩씩해졌어요.",
    talk: ["오늘도 씩씩하게 헤엄쳐볼까!", "호야랑 있으면 힘이 나!", "절반쯤 왔어!"],
  },
  {
    name: "튼튼한 상어",
    desc: "지느러미가 튼튼해지고 더 빠르게 헤엄쳐요.",
    talk: ["이제 제법 빠르게 헤엄칠 수 있어!", "우리 둘 다 튼튼해지고 있어!", "계속 가보자!"],
  },
  {
    name: "멋진 청소년 상어",
    desc: "지혜롭고 자신감 넘치게 넓은 바다를 누벼요!",
    talk: ["호야, 우리 진짜 멋지지 않아?", "조금만 더 하면 어른이야!", "자신감이 생겼어!"],
  },
  {
    name: "성숙한 상어",
    desc: "넓은 바다를 당당하게 누비는 멋진 상어가 되었어요.",
    talk: ["호야 덕분에 여기까지 왔어!", "이제 한 단계 남았어!", "정말 고마워!"],
  },
  {
    name: "완벽한 성체 상어",
    desc: "모든 레슨을 완료했어요! 가장 멋진 상어예요!",
    talk: ["호야, 우리 해냈어!", "최고의 짝꿍이야!", "다음엔 어떤 친구를 만날까?"],
  },
];

const PANTHER_STAGES: StageInfo[] = [
  {
    name: "아기 흑표범",
    desc: "이제 막 태어난 작고 까만 아기예요.",
    talk: ["호야, 나는 새로운 친구 흑표범이야!", "아직 눈도 잘 안 떠져!", "잘 부탁해!"],
  },
  {
    name: "막 걸음마 뗀 흑표범",
    desc: "살금살금 걸으며 세상을 탐험해요.",
    talk: ["이제 걸을 수 있게 됐어!", "세상이 궁금해!", "다음 챕터도 읽어줘!"],
  },
  {
    name: "장난꾸러기 흑표범",
    desc: "폴짝폴짝 뛰어다니며 에너지가 넘쳐요!",
    talk: ["같이 뛰어놀자!", "호야 영어 진짜 잘한다!", "나 점점 커지고 있어!"],
  },
  {
    name: "활발한 흑표범",
    desc: "몸도 마음도 쑥쑥 자라 더 씩씩해졌어요.",
    talk: ["오늘도 씩씩하게!", "호야랑 있으면 힘이 나!", "절반쯤 왔어!"],
  },
  {
    name: "튼튼한 흑표범",
    desc: "더 빠르고 날렵하게 움직일 수 있어요.",
    talk: ["이제 제법 빨라졌지?", "호야도 나도 튼튼해지고 있어!", "계속 가보자!"],
  },
  {
    name: "멋진 청소년 흑표범",
    desc: "지혜롭고 자신감이 생겨 스스로 도전해요!",
    talk: ["호야, 우리 대단하지 않아?", "조금만 더 하면 어른이야!", "자신감이 생겼어!"],
  },
  {
    name: "성숙한 흑표범",
    desc: "숲을 조용하고 당당하게 누비는 멋진 흑표범이 되었어요.",
    talk: ["호야 덕분에 여기까지 왔어!", "이제 한 단계 남았어!", "정말 고마워!"],
  },
  {
    name: "완벽한 성체 흑표범",
    desc: "모든 레슨을 완료했어요! 가장 멋진 흑표범이에요!",
    talk: ["호야, 우리 해냈어!", "최고의 짝꿍이야!", "새 친구를 만나러 갈까?"],
  },
];

const WOLF_STAGES: StageInfo[] = [
  {
    name: "아기 늑대",
    desc: "이제 막 태어난 작고 포근한 아기예요.",
    talk: ["호야, 나는 새로운 친구 늑대야!", "아직 걸음마도 서툴러!", "잘 부탁해!"],
  },
  {
    name: "막 걸음마 뗀 늑대",
    desc: "아장아장 걸으며 세상을 궁금해해요.",
    talk: ["이제 걸을 수 있게 됐어!", "세상이 궁금해!", "계속 같이 하자!"],
  },
  {
    name: "장난꾸러기 늑대",
    desc: "폴짝폴짝 뛰어다니며 에너지가 넘쳐요!",
    talk: ["나 점점 힘이 세지고 있어!", "호야 대단해!", "다음 챕터 가보자!"],
  },
  {
    name: "활발한 늑대",
    desc: "몸도 마음도 쑥쑥 자라 더 씩씩해졌어요.",
    talk: ["오늘도 씩씩하게!", "호야랑 있으면 힘이 나!", "절반쯤 왔어!"],
  },
  {
    name: "튼튼한 늑대",
    desc: "다리 힘이 세지고 더 멀리 달릴 수 있어요.",
    talk: ["이제 제법 멀리 달릴 수 있어!", "우리 둘 다 튼튼해지고 있어!", "계속 가보자!"],
  },
  {
    name: "멋진 청소년 늑대",
    desc: "지혜롭고 자신감 넘치게 무리를 이끌어요!",
    talk: ["호야, 우리 진짜 멋지지 않아?", "조금만 더 하면 어른이야!", "자신감이 생겼어!"],
  },
  {
    name: "성숙한 늑대",
    desc: "숲을 당당하게 누비는 멋진 늑대가 되었어요.",
    talk: ["호야 덕분에 여기까지 왔어!", "이제 한 단계 남았어!", "정말 고마워!"],
  },
  {
    name: "완벽한 성체 늑대",
    desc: "모든 레슨을 완료했어요! 가장 멋진 늑대예요!",
    talk: ["호야, 우리 해냈어!", "최고의 짝꿍이야!", "다음엔 어떤 친구를 만날까?"],
  },
];

// 챕터(영어책 읽기): 흑표범 → 늑대
export const CHAPTER_SPECIES: Species[] = [
  { imagePrefix: "bp", stages: PANTHER_STAGES },
  { imagePrefix: "w", stages: WOLF_STAGES },
];

// 단어장: 여우(기존 진행 유지) → 호랑이 → 독수리 → 상어
export const VOCAB_SPECIES: Species[] = [
  { imagePrefix: "", stages: FOX_STAGES },
  { imagePrefix: "t", stages: TIGER_STAGES },
  { imagePrefix: "e", stages: EAGLE_STAGES },
  { imagePrefix: "s", stages: SHARK_STAGES },
];

function petKey(track: PetTrack) {
  return track === "vocab" ? VOCAB_PET_KEY : CHAPTER_PET_KEY;
}

function speciesList(track: PetTrack): Species[] {
  return track === "vocab" ? VOCAB_SPECIES : CHAPTER_SPECIES;
}

// generation과 트랙에 맞는 동물 종류를 반환. 준비된 동물 세대를 넘어가면 마지막 동물을 계속 씀
export function getSpecies(generation: number, track: PetTrack = "chapter"): Species {
  const list = speciesList(track);
  const idx = Math.min(generation - 1, list.length - 1);
  return list[Math.max(idx, 0)];
}

export function getStageInfo(pet: PetState, track: PetTrack = "chapter"): StageInfo {
  const species = getSpecies(pet.generation, track);
  return species.stages[pet.stage - 1] ?? species.stages[0];
}

export function getPetImagePath(pet: PetState, track: PetTrack = "chapter"): string {
  const species = getSpecies(pet.generation, track);
  // 늑대 마지막 8단계만 파일이 대문자 W8.png로 올라가 있음
  if (species.imagePrefix === "w" && pet.stage === MAX_STAGE) {
    return "/W8.png";
  }
  return `/${species.imagePrefix}${pet.stage}.png`;
}

export function loadPet(track: PetTrack = "chapter"): PetState {
  if (typeof window === "undefined") return { stage: 1, generation: 1 };
  try {
    const raw = localStorage.getItem(petKey(track));
    const parsed = raw ? (JSON.parse(raw) as PetState) : { stage: 1, generation: 1 };
    return {
      stage: Math.min(Math.max(parsed.stage ?? 1, 1), MAX_STAGE),
      generation: parsed.generation ?? 1,
    };
  } catch {
    return { stage: 1, generation: 1 };
  }
}

// 챕터 캐릭터 목록을 흑표범→늑대로 새로 바꾼 마이그레이션 관련 함수들.
// "리셋했는지 여부"는 각 기기가 따로 판단하지 않고, 서버에 있는 chapterSpeciesMigrated 표시를
// 기준으로 삼는다(자세한 흐름은 lib/sync.ts의 pullSync 참고). 이 두 함수는 "내 기기가 이미
// 그 서버 기준값을 한 번 받아들였는지"만 표시하는 아주 가벼운 로컬 플래그다.
export function hasAdoptedChapterMigration(): boolean {
  if (typeof window === "undefined") return true;
  return localStorage.getItem(CHAPTER_SPECIES_RESET_FLAG) === "1";
}

export function markChapterMigrationAdopted(): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(CHAPTER_SPECIES_RESET_FLAG, "1");
}

// 단어장 여우는 처음 한 번만 3단계로 맞춰줌 (예전에 같이 쓰던 진행 단계를 단어장 쪽으로 옮김)
export function boostVocabStageOnce(): PetState | null {
  if (typeof window === "undefined") return null;
  if (localStorage.getItem(VOCAB_STAGE_BOOST_FLAG) === "1") return null;
  const fresh: PetState = { stage: 3, generation: 1 };
  savePet(fresh, "vocab");
  localStorage.setItem(VOCAB_STAGE_BOOST_FLAG, "1");
  return fresh;
}

export function savePet(pet: PetState, track: PetTrack = "chapter") {
  if (typeof window === "undefined") return;
  localStorage.setItem(petKey(track), JSON.stringify(pet));
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

// 다른 기기에서 받은 상태와 비교해서, 더 많이 자란 쪽으로 맞춤 (트랙별로 각각 비교)
export function mergePetState(incoming: PetState, track: PetTrack = "chapter"): PetState {
  const current = loadPet(track);
  const rank = (p: PetState) => p.generation * 100 + p.stage;
  if (rank(incoming) > rank(current)) {
    savePet(incoming, track);
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
  const current = loadPet("chapter");

  if (isChapterDone(chapterId)) {
    return { pet: current, grew: false, graduated: false };
  }

  markChapterDone(chapterId);

  if (current.stage >= MAX_STAGE) {
    const next = { stage: 1, generation: current.generation + 1 };
    savePet(next, "chapter");
    return { pet: next, grew: true, graduated: true };
  }

  const next = { stage: current.stage + 1, generation: current.generation };
  savePet(next, "chapter");
  return { pet: next, grew: true, graduated: false };
}

function isVocabRoundDone(roundId: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    const raw = localStorage.getItem(DONE_VOCAB_ROUNDS_KEY);
    if (!raw) return false;
    return (JSON.parse(raw) as string[]).includes(roundId);
  } catch {
    return false;
  }
}

function markVocabRoundDone(roundId: string) {
  if (typeof window === "undefined") return;
  try {
    const raw = localStorage.getItem(DONE_VOCAB_ROUNDS_KEY);
    const list = raw ? (JSON.parse(raw) as string[]) : [];
    if (!list.includes(roundId)) {
      list.push(roundId);
      localStorage.setItem(DONE_VOCAB_ROUNDS_KEY, JSON.stringify(list));
    }
  } catch {
    localStorage.setItem(DONE_VOCAB_ROUNDS_KEY, JSON.stringify([roundId]));
  }
}

// 단어장에서 "학습 + 게임 4종류"를 한 사이클 마칠 때마다 호출 — 매번 새로운 roundId를 넘기면 매번 성장함
export function completeVocabRound(roundId: string): GrowResult {
  const current = loadPet("vocab");

  if (isVocabRoundDone(roundId)) {
    return { pet: current, grew: false, graduated: false };
  }

  markVocabRoundDone(roundId);

  if (current.stage >= MAX_STAGE) {
    const next = { stage: 1, generation: current.generation + 1 };
    savePet(next, "vocab");
    return { pet: next, grew: true, graduated: true };
  }

  const next = { stage: current.stage + 1, generation: current.generation };
  savePet(next, "vocab");
  return { pet: next, grew: true, graduated: false };
}
