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
  // 정답 확인 후 다시 보여주고 TTS로 들려줄 원문 문장
  sourceSentence: string;
  // fill_blank 전용: 빈칸이 있는 문장 (예: "Tom has a ___ ball.")
  prompt?: string;
  // fill_blank / find_sentence / listen_word 전용 선택지
  options?: string[];
  // 정답값 (fill_blank/find_sentence/listen_word는 options 중 하나, order_words는 완성 문장)
  answer?: string;
  // order_words 전용: 섞인 단어들
  words?: string[];
};
export type VocabWord = {
  english: string;
  korean: string;
  pos?: string; // 품사 (n., v., adj., adv., int. 등) - 없을 수도 있음
};

export type VocabSet = {
  id: string;
  title: string;
  words: VocabWord[];
  createdAt: number;
};
