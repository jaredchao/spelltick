import type { ItemKind, QuizItem } from "./question";
import type { Rng } from "./quizType";

/** Mirrors Rust `Candidates`. Lists are already in random order. */
export interface Candidates {
  readonly due: QuizItem | null;
  readonly newWords: readonly QuizItem[];
  readonly newSentences: readonly QuizItem[];
  readonly newToday: number;
  readonly recentWrongWords: readonly QuizItem[];
  readonly recentWrongSentences: readonly QuizItem[];
}

export interface SelectOptions {
  readonly dailyNewLimit: number;
  /** Share of words when choosing between words and sentences, 0..1. */
  readonly wordShare: number;
}

export type Pick = { readonly item: QuizItem; readonly source: "due" | "new" | "wrong" };

function kindOrder(wordShare: number, rng: Rng): readonly ItemKind[] {
  return rng() < wordShare ? ["word", "sentence"] : ["sentence", "word"];
}

/**
 * SPEC section 6 priority: due reviews (earliest first) -> new items (daily cap)
 * -> a recently wrong item. The word/sentence share applies to new and wrong
 * items; if the chosen kind has nothing, the other kind is used.
 */
export function selectNext(c: Candidates, options: SelectOptions, rng: Rng): Pick | null {
  if (c.due) return { item: c.due, source: "due" };

  const order = kindOrder(options.wordShare, rng);
  const pools = {
    new: { word: c.newWords, sentence: c.newSentences },
    wrong: { word: c.recentWrongWords, sentence: c.recentWrongSentences },
  };

  if (c.newToday < options.dailyNewLimit) {
    for (const kind of order) {
      const item = pools.new[kind][0];
      if (item) return { item, source: "new" };
    }
  }
  for (const kind of order) {
    const item = pools.wrong[kind][0];
    if (item) return { item, source: "wrong" };
  }
  return null;
}
