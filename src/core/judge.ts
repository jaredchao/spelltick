import type { ItemKind } from "./question";

const APOSTROPHES = /[‘’ʼ`´]/g;
const TRAILING_PUNCTUATION = /[\s.,!?;:。，！？；：…]+$/u;

/** Normalize an answer or term for comparison (SPEC section 3, judging rules). */
export function normalizeAnswer(text: string, kind: ItemKind): string {
  const base = text.trim().toLowerCase().replace(APOSTROPHES, "'");
  if (kind === "word") return base;
  return base.replace(/\s+/g, " ").replace(TRAILING_PUNCTUATION, "");
}

export function isCorrect(answer: string, term: string, kind: ItemKind): boolean {
  const given = normalizeAnswer(answer, kind);
  return given !== "" && given === normalizeAnswer(term, kind);
}
