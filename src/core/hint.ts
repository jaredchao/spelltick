/**
 * Highest hint level for a term: reveal at most all but the last letter,
 * so a hint never gives away the full answer.
 */
export function maxHintLevel(term: string): number {
  return Math.max(0, term.trim().length - 1);
}

/** The prefix revealed at `level` (level 1 = first letter). */
export function revealedPrefix(term: string, level: number): string {
  const clamped = Math.min(Math.max(0, level), maxHintLevel(term));
  return term.trim().slice(0, clamped);
}

/** Display mask such as "de____" for term "deploy" at level 2. */
export function hintMask(term: string, level: number): string {
  const trimmed = term.trim();
  const prefix = revealedPrefix(trimmed, level);
  const rest = trimmed
    .slice(prefix.length)
    .replace(/[^\s]/g, "_");
  return prefix + rest;
}
