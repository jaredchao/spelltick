/** Fixed rules not exposed in settings. */
export const RECENT_WRONG_DAYS = 7;

/** Share of words when choosing between words and sentences, 0..1. */
export function wordShare(wordRatio: number, sentenceRatio: number): number {
  const total = wordRatio + sentenceRatio;
  return total <= 0 ? 1 : wordRatio / total;
}
