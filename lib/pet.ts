"use client";

const CHAPTER_PET_KEY = "chunkbook-v2-pet";
const VOCAB_PET_KEY = "chunkbook-v2-vocab-pet";
const DONE_CHAPTERS_KEY = "chunkbook-v2-done-chapters";
const DONE_VOCAB_ROUNDS_KEY = "chunkbook-v2-done-vocab-rounds";
const VOCAB_STAGE_BOOST_FLAG = "chunkbook-v2-vocab-stage-boost-v2";
const VOCAB_BOOST_STAGE = 4; // 어제 한 단계 자란 것을 반영해 단어장 캐릭터를 최소 4단계로 맞춘다(한 번만).

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

const ORANGUTAN_STAGES: StageInfo[] = [
  {
    name: "아기 오랑우탄",
    desc: "이제 막 태어난 작고 복슬복슬한 아기예요.",
    talk: ["호야, 나는 새로운 친구 오랑우탄이야!", "아직 나뭇가지도 잘 못 잡아!", "잘 부탁해!"],
  },
  {
    name: "막 나무 타기 시작한 오랑우탄",
    desc: "짧은 팔로 나뭇가지를 잡으며 세상을 탐험해요.",
    talk: ["이제 나뭇가지를 잡을 수 있게 됐어!", "숲 속이 궁금해!", "다음 챕터도 읽어줘!"],
  },
  {
    name: "장난꾸러기 오랑우탄",
    desc: "나무 사이를 오가며 에너지가 넘쳐요!",
    talk: ["같이 나무 타고 놀자!", "호야 영어 진짜 잘한다!", "나 점점 커지고 있어!"],
  },
  {
    name: "활발한 오랑우탄",
    desc: "몸도 마음도 쑥쑥 자라 더 씩씩해졌어요.",
    talk: ["오늘도 씩씩하게!", "호야랑 있으면 힘이 나!", "절반쯤 왔어!"],
  },
  {
    name: "튼튼한 오랑우탄",
    desc: "팔 힘이 세지고 더 높은 나무까지 오를 수 있어요.",
    talk: ["이제 제법 높이 오를 수 있어!", "호야도 나도 튼튼해지고 있어!", "계속 가보자!"],
  },
  {
    name: "멋진 청소년 오랑우탄",
    desc: "지혜롭고 자신감이 생겨 스스로 도전해요!",
    talk: ["호야, 우리 대단하지 않아?", "조금만 더 하면 어른이야!", "자신감이 생겼어!"],
  },
  {
    name: "성숙한 오랑우탄",
    desc: "숲을 여유롭게 누비는 멋진 오랑우탄이 되었어요.",
    talk: ["호야 덕분에 여기까지 왔어!", "이제 한 단계 남았어!", "정말 고마워!"],
  },
  {
    name: "완벽한 성체 오랑우탄",
    desc: "모든 레슨을 완료했어요! 가장 멋진 오랑우탄이에요!",
    talk: ["호야, 우리 해냈어!", "최고의 짝꿍이야!", "새 친구를 만나러 갈까?"],
  },
];

// 챕터(영어책 읽기): 흑표범 → 늑대 → 오랑우탄
export const CHAPTER_SPECIES: Species[] = [
  { imagePrefix: "bp", stages: PANTHER_STAGES },
  { imagePrefix: "w", stages: WOLF_STAGES },
  { imagePrefix: "o", stages: ORANGUTAN_STAGES },
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

// 단어장 캐릭터를 처음 한 번만 4단계로 맞춰줌. 이미 그 이상이면 아무것도 하지 않는다(절대 낮추지 않음).
export function boostVocabStageOnce(): PetState | null {
  if (typeof window === "undefined") return null;
  if (localStorage.getItem(VOCAB_STAGE_BOOST_FLAG) === "1") return null;
  localStorage.setItem(VOCAB_STAGE_BOOST_FLAG, "1");
  // 이미 더 많이 자랐다면(다른 기기에서 동기화된 값 등) 절대 낮추지 않는다.
  const current = loadPet("vocab");
  if (current.generation > 1 || current.stage >= VOCAB_BOOST_STAGE) return null;
  const fresh: PetState = { stage: VOCAB_BOOST_STAGE, generation: 1 };
  savePet(fresh, "vocab");
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

// 서버 값을 그대로 받아들여 완전히 덮어씀 (동기화 코드 기반 지속 동기화용 — 병합 아님)
export function setDoneChapterIds(ids: string[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(DONE_CHAPTERS_KEY, JSON.stringify(ids));
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
  coins?: number; // 이번에 실제로 받은 코인
};

// 챕터를 완료했을 때 호출 — 한 단계 성장시키고, 8단계를 넘으면 새 동물로 시작
export function completeChapter(chapterId: string): GrowResult {
  const current = loadPet("chapter");

  if (isChapterDone(chapterId)) {
    return { pet: current, grew: false, graduated: false, coins: 0 };
  }

  markChapterDone(chapterId);
  // 챕터를 끝까지 마치면 캐릭터가 바로 한 단계 자라고, 보너스 코인도 받는다(하루 한도와 상관없이).
  const grown = growPet("chapter");
  const r = earnCoins(COINS_CHAPTER_DONE, "chapter", { milestone: true });
  return { ...grown, coins: r.granted };
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

// ---------- 게임 3종(다트/두더지/몬스터) 완료 사이클 ----------
// 날짜나 단어장에 상관없이, 서로 다른 3개 게임을 각각 1번 이상 완료하면 캐릭터가 성장한다.
// 게임 하나를 반복해서 성장시킬 수 없도록, 세 값이 모두 true가 됐을 때만 성장시키고 다시 초기화한다.
const GAME_CYCLE_KEY = "chunkbook-v2-game-cycle";

export type GameCycleKind = "dart" | "mole" | "monster";
export type GameCycleState = { dart: boolean; mole: boolean; monster: boolean };

const EMPTY_CYCLE: GameCycleState = { dart: false, mole: false, monster: false };

export function loadGameCycle(): GameCycleState {
  if (typeof window === "undefined") return { ...EMPTY_CYCLE };
  try {
    const raw = localStorage.getItem(GAME_CYCLE_KEY);
    if (!raw) return { ...EMPTY_CYCLE };
    const parsed = JSON.parse(raw) as Partial<GameCycleState>;
    return { dart: !!parsed.dart, mole: !!parsed.mole, monster: !!parsed.monster };
  } catch {
    return { ...EMPTY_CYCLE };
  }
}

function saveGameCycle(state: GameCycleState) {
  if (typeof window === "undefined") return;
  localStorage.setItem(GAME_CYCLE_KEY, JSON.stringify(state));
}

export type GameCycleResult = {
  cycle: GameCycleState;
  completedCount: number; // 0~3
  leveledUp: boolean;
  grow: GrowResult | null;
};

// 다트/두더지/몬스터 게임 중 하나를 완료했을 때 호출. 셋 다 완료되면 캐릭터를 한 단계 성장시키고
// 다시 0/3(전부 false)으로 되돌린다. 캐릭터의 현재 레벨(stage/generation)은 건드리지 않는다.
export function recordGameCycleProgress(kind: GameCycleKind): GameCycleResult {
  const current = loadGameCycle();
  const next: GameCycleState = { ...current, [kind]: true };

  if (next.dart && next.mole && next.monster) {
    const grow = completeVocabRound(`game-cycle-${Date.now()}`);
    const reset = { ...EMPTY_CYCLE };
    saveGameCycle(reset);
    return { cycle: reset, completedCount: 0, leveledUp: grow.grew, grow };
  }

  saveGameCycle(next);
  const completedCount = [next.dart, next.mole, next.monster].filter(Boolean).length;
  return { cycle: next, completedCount, leveledUp: false, grow: null };
}

// 단어장에서 "학습 + 게임 4종류"를 한 사이클 마칠 때마다 호출 — 매번 새로운 roundId를 넘기면 매번 성장함
export function completeVocabRound(roundId: string): GrowResult {
  const current = loadPet("vocab");

  if (isVocabRoundDone(roundId)) {
    return { pet: current, grew: false, graduated: false, coins: 0 };
  }

  markVocabRoundDone(roundId);
  const grown = growPet("vocab");
  const r = earnCoins(COINS_VOCAB_ROUND, "vocab", { milestone: true });
  return { ...grown, coins: r.granted };
}

// ---------- 코인과 성장은 따로 간다 ----------
// 코인(🪙): 정답을 맞히고, 문장을 쓰고, 게임을 할 때마다 바로 쌓인다. 상점에서 쓰는 돈이다.
// 성장: 챕터 한 편, 청크북 Lesson 한 번, 단어장 게임 3종을 "한 세트 마치면" 캐릭터가 바로 한 단계 자란다.
// 하루 10분 기준: 코인 약 200~250개.
const COINS_TOTAL_KEY = "chunkbook-v2-coins-total";
const COINS_DAY_KEY = "chunkbook-v2-coins-day";
const COINS_X10_FLAG = "chunkbook-v2-coins-x10";
const DONE_LESSONS_KEY = "chunkbook-v2-done-lessons";
const LESSON_DAY_KEY = "chunkbook-v2-lesson-growth-day";

export const DAILY_COIN_CAP = 600; // 하루 10분 기준의 약 2.5배. 넘으면 "오늘은 여기까지!"
export const COINS_SENTENCE = 20; // 문장 하나 쓰기
export const COINS_LISTEN = 30; // 읽고 듣기 한 바퀴
export const COINS_LESSON_DONE = 100; // Lesson 한 번 끝까지(보너스)
export const COINS_READ_ROUND = 30; // 챕터 한 페이지 2번 읽기
export const COINS_CHAPTER_DONE = 200; // 챕터 끝까지 + 퀴즈(보너스)
export const COINS_VOCAB_ROUND = 100; // 단어장 하루 게임 전부 완료(보너스)
export const COINS_BATTLE_STAGE = 10; // 몬스터 배틀: 스테이지를 깰 때마다
export const COINS_BATTLE_BOSS = 30; // 몬스터 배틀: 보스 스테이지

function numFromStorage(key: string): number {
  if (typeof window === "undefined") return 0;
  const n = Number(localStorage.getItem(key));
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
}

// 처음 10배 단위로 바뀔 때 이미 모은 코인도 같은 비율로 올려 준다(한 번만).
function migrateX10() {
  if (typeof window === "undefined") return;
  if (localStorage.getItem(COINS_X10_FLAG) === "1") return;
  localStorage.setItem(COINS_X10_FLAG, "1");
  const total = Number(localStorage.getItem(COINS_TOTAL_KEY));
  if (Number.isFinite(total) && total > 0) localStorage.setItem(COINS_TOTAL_KEY, String(Math.floor(total) * 10));
  localStorage.removeItem(COINS_DAY_KEY);
}

export function loadCoinsTotal(): number {
  migrateX10();
  return numFromStorage(COINS_TOTAL_KEY);
}

export function saveCoinsTotal(n: number) {
  if (typeof window === "undefined") return;
  localStorage.setItem(COINS_TOTAL_KEY, String(Math.max(0, Math.floor(n))));
}

// 예전 "다음 단계까지 쌓인 코인" 값. 이제 성장에는 쓰지 않는다(동기화 호환용으로만 남김).
export function loadPetXp(track: PetTrack = "chapter"): number {
  return numFromStorage(track === "vocab" ? "chunkbook-v2-vocab-xp" : "chunkbook-v2-pet-xp");
}

export function savePetXp(xp: number, track: PetTrack = "chapter") {
  if (typeof window === "undefined") return;
  localStorage.setItem(track === "vocab" ? "chunkbook-v2-vocab-xp" : "chunkbook-v2-pet-xp", String(Math.max(0, Math.floor(xp))));
}

function dayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function coinsEarnedToday(): number {
  if (typeof window === "undefined") return 0;
  migrateX10();
  try {
    const raw = localStorage.getItem(COINS_DAY_KEY);
    const v = raw ? (JSON.parse(raw) as { day?: string; earned?: number }) : null;
    return v && v.day === dayKey() && typeof v.earned === "number" ? v.earned : 0;
  } catch {
    return 0;
  }
}

export function getDoneLessons(): number[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(DONE_LESSONS_KEY);
    const list = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(list) ? list.filter((n): n is number => typeof n === "number") : [];
  } catch {
    return [];
  }
}

export function setDoneLessons(lessons: number[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(DONE_LESSONS_KEY, JSON.stringify(Array.from(new Set(lessons))));
}

// 캐릭터를 한 단계 키운다. 8단계를 넘으면 다음 친구가 1단계로 시작한다.
function growPet(track: PetTrack): GrowResult {
  const pet = loadPet(track);
  const next: PetState =
    pet.stage >= MAX_STAGE ? { stage: 1, generation: pet.generation + 1 } : { stage: pet.stage + 1, generation: pet.generation };
  savePet(next, track);
  return { pet: next, grew: true, graduated: pet.stage >= MAX_STAGE };
}

export type EarnResult = { granted: number; capped: boolean; total: number };

// 코인을 받는다. milestone(한 세트를 마친 보너스)은 하루 한도를 적용하지 않는다.
// 한도를 넘으면 받는 코인이 0이 되어 "오늘은 여기까지!" 상태가 된다. 성장에는 영향이 없다.
export function earnCoins(amount: number, _track: PetTrack = "chapter", opts: { milestone?: boolean } = {}): EarnResult {
  void _track;
  const before = coinsEarnedToday();
  let granted = Math.max(0, Math.floor(amount));
  let capped = false;
  if (!opts.milestone) {
    const room = Math.max(0, DAILY_COIN_CAP - before);
    if (granted > room) {
      granted = room;
      capped = true;
    }
  }
  const total = loadCoinsTotal() + granted;
  if (typeof window !== "undefined") {
    saveCoinsTotal(total);
    if (!opts.milestone) {
      localStorage.setItem(COINS_DAY_KEY, JSON.stringify({ day: dayKey(), earned: before + granted }));
    }
    window.dispatchEvent(new CustomEvent("coins-changed", { detail: { granted, capped } }));
  }
  return { granted, capped, total };
}

// Lesson 한 번을 끝까지 마치면 캐릭터가 바로 자란다. 같은 Lesson은 하루에 한 번만 자라고,
// 도장(⭐)은 처음 마칠 때 한 번만 찍힌다.
export function completeLesson(lesson: number): GrowResult & { firstStamp: boolean } {
  const pet = loadPet("chapter");
  let lastDays: Record<string, string> = {};
  try {
    lastDays = JSON.parse(localStorage.getItem(LESSON_DAY_KEY) ?? "{}") as Record<string, string>;
  } catch {
    lastDays = {};
  }
  const today = dayKey();
  const done = getDoneLessons();
  const firstStamp = !done.includes(lesson);
  if (firstStamp) setDoneLessons([...done, lesson]);
  if (lastDays[String(lesson)] === today) return { pet, grew: false, graduated: false, coins: 0, firstStamp };
  lastDays[String(lesson)] = today;
  localStorage.setItem(LESSON_DAY_KEY, JSON.stringify(lastDays));
  const grown = growPet("chapter");
  const r = earnCoins(COINS_LESSON_DONE, "chapter", { milestone: true });
  return { ...grown, coins: r.granted, firstStamp };
}
