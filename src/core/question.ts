export type ItemKind = "word" | "sentence";

export type QuizType = "zh2en" | "dictation" | "cloze" | "sentence_dictation";

export const QUIZ_TYPE_NAMES: Readonly<Record<QuizType, string>> = {
  zh2en: "看中文写英文",
  dictation: "听发音拼写",
  cloze: "例句挖空",
  sentence_dictation: "整句听写",
};

export interface Question {
  readonly deckName: string;
  readonly quizType: QuizType;
  readonly kind: ItemKind;
  readonly term: string;
  readonly meaning: string;
  readonly phonetic?: string;
  readonly pos?: string;
  readonly example?: string;
}
