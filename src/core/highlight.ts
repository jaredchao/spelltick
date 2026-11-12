export interface Segment {
  readonly text: string;
  readonly match: boolean;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Split `text` into segments, marking case-insensitive occurrences of `term`
 * that stand as whole words. Used to bold the target word in an example.
 */
export function splitByTerm(text: string, term: string): readonly Segment[] {
  const needle = term.trim();
  if (needle === "") return [{ text, match: false }];

  const pattern = new RegExp(`(?<![\\w])(${escapeRegExp(needle)})(?![\\w])`, "gi");
  const parts = text.split(pattern);
  return parts
    .map((part, index) => ({ text: part, match: index % 2 === 1 }))
    .filter((segment) => segment.text !== "");
}
