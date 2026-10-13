"use client";

// 청크북 Lesson 활동(읽고 듣기 / 문장 보고 쓰기)용 저장소.
//  - 교재에서 추출한 본문·번역·문장쓰기 정답은 부모가 확인한 뒤 이 기기에 저장한다(재방문 때 API를 다시 부르지 않는다).
//  - 페이지 역할(본문 / 문장쓰기)은 부모가 고칠 수 있다.
//  - 문장쓰기 진행(섞인 순서·현재 위치)은 새로고침 후에도 복원한다. 숙달/정답 기록은 남기지 않는다.

const TEXT_KEY = "chunkbook-v2-lesson-texts";
const ROLE_KEY = "chunkbook-v2-lesson-page-roles";
const ACT_KEY = "chunkbook-v2-lesson-activity";

export type BodyLine = { en: string; ko: string; section: "passage" | "dialogue" };
export type WritingItem = { ko: string; en: string };

export type LessonText = {
  lesson: number;
  body: BodyLine[];
  writing: WritingItem[];
  status: "extracted" | "confirmed"; // extracted = 아직 부모 확인 전
  extractedAt: number;
  confirmedAt: number | null;
  bodyPages: number[];
  writingPage: number | null;
};

export type PageRoles = { body: number[]; writing: number | null };

export type LessonActivity = {
  listens: number; // 끝까지 들은 횟수 (필수 조건이 아니다)
  order: number[]; // 문장쓰기: 섞인 순서(문장 인덱스)
  pos: number; // 문장쓰기: 현재 위치
  completed: boolean;
  startedAt: number;
};

function readMap<T>(key: string): Record<string, T> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(key);
    const v = raw ? JSON.parse(raw) : {};
    return v && typeof v === "object" ? (v as Record<string, T>) : {};
  } catch {
    return {};
  }
}
function writeMap<T>(key: string, m: Record<string, T>) {
  if (typeof window === "undefined") return;
  localStorage.setItem(key, JSON.stringify(m));
}

// ---------- 추출·확인된 본문 ----------
export const loadLessonTexts = () => readMap<LessonText>(TEXT_KEY);
export function loadLessonText(lesson: number): LessonText | null {
  return loadLessonTexts()[String(lesson)] ?? null;
}
export function saveLessonText(t: LessonText) {
  const m = loadLessonTexts();
  m[String(t.lesson)] = t;
  writeMap(TEXT_KEY, m);
}
export function clearLessonText(lesson: number) {
  const m = loadLessonTexts();
  delete m[String(lesson)];
  writeMap(TEXT_KEY, m);
}

// ---------- 페이지 역할 ----------
// 실제 PDF(호_청크북_A2.pdf, 42쪽)를 확인한 기본값. 레이블이 "Lesson N-k"일 때의 PDF 쪽 번호.
// "마지막 쪽 = 문장쓰기"로 가정하지 않고 쪽마다 내용을 확인해서 정했다. 다른 PDF이면 부모가 직접 정한다.
export const VERIFIED_ROLES_42: Record<number, PageRoles> = {
  2: { body: [1], writing: 6 },
  3: { body: [7], writing: 11 },
  4: { body: [12], writing: 17 },
  5: { body: [18], writing: 24 },
  6: { body: [25], writing: 30 },
  7: { body: [31], writing: 36 },
  8: { body: [37], writing: 42 },
};

export function loadRoleOverrides() {
  return readMap<PageRoles>(ROLE_KEY);
}
export function saveRoleOverride(lesson: number, roles: PageRoles) {
  const m = loadRoleOverrides();
  m[String(lesson)] = roles;
  writeMap(ROLE_KEY, m);
}
export function resetRoleOverride(lesson: number) {
  const m = loadRoleOverrides();
  delete m[String(lesson)];
  writeMap(ROLE_KEY, m);
}

export function defaultRoles(lesson: number, lessonPages: number[], pageCount: number): PageRoles {
  const v = VERIFIED_ROLES_42[lesson];
  if (pageCount === 42 && v && v.body.every((p) => lessonPages.includes(p)) && (v.writing === null || lessonPages.includes(v.writing))) {
    return v;
  }
  // 알 수 없는 PDF: 첫 쪽만 본문 후보로 두고 문장쓰기 쪽은 부모가 고르게 한다(마지막 쪽을 자동 지정하지 않는다).
  return { body: lessonPages.slice(0, 1), writing: null };
}

export function resolveRoles(lesson: number, lessonPages: number[], pageCount: number): { roles: PageRoles; custom: boolean } {
  const o = loadRoleOverrides()[String(lesson)];
  if (o) return { roles: o, custom: true };
  return { roles: defaultRoles(lesson, lessonPages, pageCount), custom: false };
}

// ---------- 활동 진행 ----------
export const loadActivities = () => readMap<LessonActivity>(ACT_KEY);
export function loadActivity(lesson: number): LessonActivity | null {
  return loadActivities()[String(lesson)] ?? null;
}
export function saveActivity(lesson: number, a: LessonActivity) {
  const m = loadActivities();
  m[String(lesson)] = a;
  writeMap(ACT_KEY, m);
}
export function bumpListens(lesson: number) {
  const cur = loadActivity(lesson) ?? { listens: 0, order: [], pos: 0, completed: false, startedAt: 0 };
  saveActivity(lesson, { ...cur, listens: cur.listens + 1 });
  return cur.listens + 1;
}

export function shuffleOrder(n: number, avoid?: number[]): number[] {
  const base = Array.from({ length: n }, (_, i) => i);
  let a = base;
  for (let attempt = 0; attempt < 8; attempt++) {
    a = [...base];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    const sameAsAvoid = avoid && a.every((v, i) => v === avoid[i]);
    if (n < 2 || (!sameAsAvoid && a.some((v, i) => v !== i))) break;
  }
  return a;
}

// 저장된 순서가 현재 문장 개수와 맞는지(중복·누락 없는지) 확인
export function isValidOrder(order: number[], n: number): boolean {
  return order.length === n && new Set(order).size === n && order.every((v) => Number.isInteger(v) && v >= 0 && v < n);
}

export function worksheetUrl(lesson: number) {
  return `/worksheets/lesson-${lesson}.pdf`;
}
export const WORKSHEET_FULL_URL = "/worksheets/ho_sentence_writing_lesson2_to_8.pdf";
// 학습지 전체 PDF에서 Lesson의 시작 페이지(레슨당 2쪽, Lesson 2 = 1쪽)
export const worksheetStartPage = (lesson: number) => (lesson - 2) * 2 + 1;
