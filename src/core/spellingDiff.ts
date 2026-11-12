import { diffChars } from "diff";

export interface DiffSegment {
  readonly text: string;
  readonly changed: boolean;
}

export interface SpellingDiff {
  /** The user's spelling; `changed` marks letters that should not be there. */
  readonly given: readonly DiffSegment[];
  /** The correct spelling; `changed` marks letters the user missed or got wrong. */
  readonly expected: readonly DiffSegment[];
}

function merge(segments: readonly DiffSegment[]): readonly DiffSegment[] {
  return segments.reduce<DiffSegment[]>((acc, seg) => {
    if (seg.text === "") return acc;
    const last = acc[acc.length - 1];
    if (last && last.changed === seg.changed) {
      return [...acc.slice(0, -1), { text: last.text + seg.text, changed: seg.changed }];
    }
    return [...acc, seg];
  }, []);
}

/**
 * Character-level diff between the user's answer and the term, ignoring case.
 * Text is sliced from each original string so both keep their own casing.
 */
export function spellingDiff(answer: string, term: string): SpellingDiff {
  const given = answer.trim();
  const expected = term.trim();
  const parts = diffChars(given, expected, { ignoreCase: true });

  let gi = 0;
  let ei = 0;
  const givenSegs: DiffSegment[] = [];
  const expectedSegs: DiffSegment[] = [];
  for (const part of parts) {
    const len = part.value.length;
    if (part.added) {
      expectedSegs.push({ text: expected.slice(ei, ei + len), changed: true });
      ei += len;
    } else if (part.removed) {
      givenSegs.push({ text: given.slice(gi, gi + len), changed: true });
      gi += len;
    } else {
      givenSegs.push({ text: given.slice(gi, gi + len), changed: false });
      expectedSegs.push({ text: expected.slice(ei, ei + len), changed: false });
      gi += len;
      ei += len;
    }
  }
  return { given: merge(givenSegs), expected: merge(expectedSegs) };
}
