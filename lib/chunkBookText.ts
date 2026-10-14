"use client";

// 교재별 본문 저장소: 앱에 내장된 청크북과 직접 가져온 교재를 구분한다. (저장소 읽기/쓰기는 chunkLesson.ts의 것을 쓴다)
import { BUILTIN_BOOK_ID, builtinRoles, builtinSeedBody, builtinSeedWriting } from "./chunkbookBuiltin";
import { loadLessonTexts, saveLessonTexts, type LessonText } from "./chunkLesson";

// ---------- 교재별 본문 (내장 교재 / 직접 가져온 교재) ----------
type BookRef = { id: string; builtin?: boolean };
const textKey = (book: BookRef, lesson: number) => (book.builtin ? `${BUILTIN_BOOK_ID}:${lesson}` : String(lesson));

export function builtinLessonText(lesson: number): LessonText {
  const r = builtinRoles(lesson);
  return {
    lesson,
    body: builtinSeedBody(lesson),
    writing: builtinSeedWriting(lesson),
    status: "confirmed",
    extractedAt: 0,
    confirmedAt: 0,
    bodyPages: r.body,
    writingPage: r.writing,
    bookId: BUILTIN_BOOK_ID,
  };
}

// 내장 교재: 부모가 이 교재에서 고쳐 저장한 본문이 있으면 그것을, 없으면 확인해 둔 내장 본문을 돌려준다(항상 값이 있다).
// 직접 가져온 교재: 그 교재에서 추출·확인해 저장한 본문만 돌려준다.
export function loadBookText(book: BookRef, lesson: number): LessonText | null {
  const saved = loadLessonTexts()[textKey(book, lesson)] ?? null;
  if (book.builtin) return saved && saved.status === "confirmed" && saved.body.length > 0 ? saved : builtinLessonText(lesson);
  return saved;
}
export function saveBookText(book: BookRef, t: LessonText) {
  const m = loadLessonTexts();
  m[textKey(book, t.lesson)] = book.builtin ? { ...t, bookId: BUILTIN_BOOK_ID } : t;
  saveLessonTexts(m);
}
export function clearBookText(book: BookRef, lesson: number) {
  const m = loadLessonTexts();
  delete m[textKey(book, lesson)];
  saveLessonTexts(m);
}

