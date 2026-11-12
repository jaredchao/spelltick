import type { ReviewRecord } from "./sm2";

export type ItemKind = "word" | "sentence";

export type QuizType = "zh2en" | "dictation" | "cloze" | "sentence_dictation";

export const QUIZ_TYPES: readonly QuizType[] = ["zh2en", "dictation", "cloze", "sentence_dictation"];

export const QUIZ_TYPE_NAMES: Readonly<Record<QuizType, string>> = {
  zh2en: "看中文写英文",
  dictation: "听发音拼写",
  cloze: "例句挖空",
  sentence_dictation: "整句听写",
};

/** One row from the `items` table joined with its deck and review (mirrors Rust `QuizItem`). */
export interface QuizItem {
  readonly id: number;
  readonly deckId: number;
  readonly deckName: string;
  readonly kind: ItemKind;
  readonly term: string;
  readonly meaning: string;
  readonly phonetic: string | null;
  readonly pos: string | null;
  readonly example: string | null;
  readonly review: ReviewRecord | null;
}

/** An item plus the quiz type chosen for this showing. */
export interface Question {
  readonly item: QuizItem;
  readonly quizType: QuizType;
}
