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
