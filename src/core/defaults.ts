import type { QuizType } from "./question";

/** SPEC section 11 defaults. Editable in the settings window from M4. */
export const QUIZ_DEFAULTS = {
  dailyNewLimit: 20,
  wordRatio: 7,
  sentenceRatio: 3,
  enabledTypes: ["zh2en", "dictation", "cloze"] as readonly QuizType[],
  recentWrongDays: 7,
} as const;

export function wordShare(wordRatio: number, sentenceRatio: number): number {
  const total = wordRatio + sentenceRatio;
  return total <= 0 ? 1 : wordRatio / total;
}
