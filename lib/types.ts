export type QuizQuestion = {
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
};
export type ExtractedPage = {
  title: string;
  sentences: string[];
};
export type Chapter = {
  id: string;
  title: string;
  pages: ExtractedPage[];
  createdAt: number;
};
export type QuizItemKind = "fill_blank" | "find_sentence" | "order_words" | "listen_word";
export type QuizItem = {
  kind: QuizItemKind;
  sourceSentence: string;
  prompt?: string;
  options?: string[];
  answer?: string;
  words?: string[];
};

// ---- 단어장 ----
export type LeitnerBox = 0 | 1 | 2 | 3 | 4 | 5; // 0=미학습, 1~4=복습중, 5=마스터

export type VocabWord = {
  id: string;
  english: string;
  korean: string;
  pos?: string;
  box: LeitnerBox;
  nextDueAt: number; // timestamp(ms). 0이면 즉시 학습 대상
  wrongCount: number;
};

export type VocabSetStatus = "locked" | "active" | "completed";

export type VocabSet = {
  id: string;
  title: string;
  words: VocabWord[];
  createdAt: number;
  status: VocabSetStatus;
};

export type VocabStudyMode = "flash" | "meaning" | "listen" | "spell";

export type VocabDailyCard = {
  wordId: string;
  mode: VocabStudyMode;
};

export type VocabDailySession = {
  setId: string;
  dateKey: string; // "2026-08-26"
  cards: VocabDailyCard[];
  cursor: number;
  phase: "study" | "game" | "done";
};
