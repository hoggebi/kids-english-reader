// 앱에 내장한 청크북 A3 (SEED1_A3_CHUNK.pdf, 24쪽 · Lesson 1~8).
//  - PDF는 가로 A4 한 장에 책 2쪽이 펼쳐진 스캔본이다. Lesson마다 3장: [본문·대화 | 단어표 앞] [단어표 뒤 | 핵심 단어 앞] [핵심 단어 뒤 | 문장쓰기].
//  - 앱에서는 원본 페이지 이미지를 보여 주지 않는다(본문·문장쓰기만 쓴다).
//  - A2(Lesson 2~8)와 저장소 키가 겹치지 않도록, 앱 안에서 쓰는 Lesson 번호는 100을 더한 값(101~108)이다.
//    화면에는 lessonNo()로 원래 번호(1~8)를 보여 준다.
//  - 이 모듈은 브라우저 저장소를 건드리지 않는다(순수 데이터).

import type { ChunkbookMeta } from "./chunkbook";
import type { BodyLine, PageRoles, WritingItem } from "./chunkLesson";

export const A3_OFFSET = 100;
export const BUILTIN_BOOK_ID_A3 = "builtin-a3";
export const A3_LESSONS = [1, 2, 3, 4, 5, 6, 7, 8] as const;

export const isA3Lesson = (lesson: number) => lesson > A3_OFFSET;
export const lessonNo = (lesson: number) => (isA3Lesson(lesson) ? lesson - A3_OFFSET : lesson);
export const a3Internal = (n: number) => n + A3_OFFSET;

export const A3_TITLES: Record<number, string> = {
  1: "The New Student",
  2: "What Are Muscles?",
  3: "Out of Breath!",
  4: "It’s an Expression!",
  5: "Reggie the Robot (Part 1)",
  6: "Reggie the Robot (Part 2)",
  7: "The Morning Mix-Up",
  8: "Animal Spots and Stripes",
};

const firstPage = (n: number) => (n - 1) * 3 + 1;

export const BUILTIN_BOOK_A3: ChunkbookMeta = {
  id: BUILTIN_BOOK_ID_A3,
  title: "호 청크북 A3 · Lesson 1~8",
  fileName: "SEED1_A3_CHUNK.pdf",
  size: 0,
  pageCount: 24,
  importedAt: 0,
  lessons: A3_LESSONS.map((n) => {
    const p = firstPage(n);
    return {
      lesson: a3Internal(n),
      pages: [p, p + 1, p + 2],
      labels: [`Lesson${n}-1 본문·단어`, `Lesson${n}-2 단어·핵심단어`, `Lesson${n}-3 핵심단어·문장쓰기`],
    };
  }),
  labelSource: "pdf-labels",
  confirmed: true,
  builtin: true,
};

export function a3Roles(lesson: number): PageRoles {
  const p = firstPage(lessonNo(lesson));
  return { body: [p], writing: p + 2 };
}

type Seed = { body: [string, string][]; dialogue: [string, string][]; writing: [string, string][] };

// 내용은 Lesson 단위로 채운다. 아직 없는 Lesson은 비어 있고, 화면에는 "준비 중"으로 보인다.
const SEEDS: Record<number, Seed> = {
  1: {
    body: [
      ["We are getting checkups at school.", "우리는 학교에서 건강 검진을 받고 있습니다."],
      ["We get weighed first.", "우리는 먼저 몸무게를 잽니다."],
      ["I weigh 22 kilograms.", "나는 몸무게가 22킬로그램입니다."],
      ["Robin weighs 23 kilograms.", "Robin은 몸무게가 23킬로그램입니다."],
      ["“Ray, look at the new girl,” my friend Robin says.", "“Ray, 새로 온 여자아이 좀 봐.” 내 친구 Robin이 말합니다."],
      ["“She looks really warm!”", "“정말 따뜻해 보여!”"],
      ["The new girl goes to the scale.", "새로 온 여자아이가 체중계로 갑니다."],
      ["She takes off her coat and sweater.", "그 아이는 코트와 스웨터를 벗습니다."],
      ["She takes off a vest and scarf.", "조끼와 목도리도 벗습니다."],
      ["And then another sweater.", "그러고 나서 스웨터를 또 한 벌 벗습니다."],
      ["She’s 21 kilograms!", "그 아이는 21킬로그램입니다!"],
    ],
    dialogue: [
      ["Dr. Sue, how tall am I?", "Sue 선생님, 제 키는 얼마나 되나요?"],
      ["You’re 130 centimeters tall.", "키가 130센티미터란다."],
      ["Wow! I’m five centimeters taller than last year.", "와! 작년보다 5센티미터 더 컸어요."],
      ["Great! Keep drinking milk!", "좋아! 계속 우유를 마시렴!"],
    ],
    writing: [
      ["We are getting checkups at school.", "우리는 학교에서 건강 검진을 받고 있다."],
      ["I weigh 22 kilograms.", "나는 몸무게가 22킬로그램이다."],
      ["The new girl goes to the scale.", "새로 온 여자애가 체중계로 간다."],
      ["She takes off her coat and sweater.", "그녀는 그녀의 코트와 스웨터를 벗는다."],
    ],
  },
};

export function a3SeedBody(lesson: number): BodyLine[] {
  const s = SEEDS[lessonNo(lesson)];
  if (!s) return [];
  return [
    ...s.body.map(([en, ko]) => ({ en, ko, section: "passage" as const })),
    ...s.dialogue.map(([en, ko]) => ({ en, ko, section: "dialogue" as const })),
  ];
}

export function a3SeedWriting(lesson: number): WritingItem[] {
  return (SEEDS[lessonNo(lesson)]?.writing ?? []).map(([en, ko]) => ({ en, ko }));
}

export const a3Ready = (lesson: number) => a3SeedBody(lesson).length > 0;
