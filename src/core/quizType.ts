import { splitByTerm } from "./highlight";
import type { QuizItem, QuizType } from "./question";

export type Rng = () => number;

/** Whether the item's example contains the term, so it can be blanked out. */
export function canCloze(item: QuizItem): boolean {
  if (item.kind !== "word" || !item.example) return false;
  return splitByTerm(item.example, item.term).some((s) => s.match);
}

/** Quiz types that apply to an item (SPEC section 4). */
export function applicableTypes(item: QuizItem): readonly QuizType[] {
  if (item.kind === "sentence") return ["zh2en", "sentence_dictation"];
  return canCloze(item) ? ["zh2en", "dictation", "cloze"] : ["zh2en", "dictation"];
}

/**
 * Pick one enabled quiz type that applies to the item.
 * Falls back to `zh2en`, which applies to everything.
 */
export function chooseQuizType(item: QuizItem, enabled: readonly QuizType[], rng: Rng): QuizType {
  const options = applicableTypes(item).filter((t) => enabled.includes(t));
  if (options.length === 0) return "zh2en";
  return options[Math.min(options.length - 1, Math.floor(rng() * options.length))];
}

/** Example with the term replaced by a blank, e.g. "We ____ to production." */
export function clozeText(item: QuizItem, blank = "____"): string {
  if (!item.example) return "";
  return splitByTerm(item.example, item.term)
    .map((s) => (s.match ? blank : s.text))
    .join("");
}
