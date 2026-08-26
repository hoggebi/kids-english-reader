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
  nextDueAt: number;
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

// 스펠링 쓰기 제외, 3가지만 사용
export type VocabStudyMode = "flash" | "meaning" | "listen";

export type VocabDailyCard = {
  wordId: string;
  mode: VocabStudyMode;
};

export type VocabDailySession = {
  setId: string;
  dateKey: string;
  cards: VocabDailyCard[];
  cursor: number;
  phase: "study" | "game" | "done";
};
