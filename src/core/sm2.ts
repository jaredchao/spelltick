export type AnswerResult = "right" | "hinted" | "wrong" | "skipped";

export interface ReviewRecord {
  readonly ease: number;
  readonly intervalDays: number;
  readonly reps: number;
  readonly dueAt: number;
  readonly lastResult: AnswerResult | null;
  readonly lapses: number;
}

export const MINUTE_MS = 60_000;
export const DAY_MS = 24 * 60 * MINUTE_MS;
export const RELEARN_DELAY_MS = 10 * MINUTE_MS;
export const DEFAULT_EASE = 2.5;
export const MIN_EASE = 1.3;

/** SPEC section 6: result -> quality score. Timeouts are never graded. */
export function grade(result: AnswerResult): number {
  switch (result) {
    case "right":
      return 5;
    case "hinted":
      return 3;
    case "wrong":
    case "skipped":
      return 1;
  }
}

export function newReview(now: number): ReviewRecord {
  return {
    ease: DEFAULT_EASE,
    intervalDays: 0,
    reps: 0,
    dueAt: now,
    lastResult: null,
    lapses: 0,
  };
}

function nextEase(ease: number, q: number): number {
  const miss = 5 - q;
  return Math.max(MIN_EASE, ease + 0.1 - miss * (0.08 + miss * 0.02));
}

/**
 * Simplified SM-2 (SPEC section 6). `record` is null for an item never answered.
 * The interval uses the ease from before this answer.
 */
export function nextReview(
  record: ReviewRecord | null,
  result: AnswerResult,
  now: number,
): ReviewRecord {
  const base = record ?? newReview(now);
  const q = grade(result);
  const ease = nextEase(base.ease, q);

  if (q < 3) {
    return {
      ease,
      intervalDays: 0,
      reps: 0,
      dueAt: now + RELEARN_DELAY_MS,
      lastResult: result,
      lapses: base.lapses + 1,
    };
  }

  const intervalDays =
    base.reps === 0 ? 1 : base.reps === 1 ? 3 : Math.round(base.intervalDays * base.ease);
  return {
    ease,
    intervalDays,
    reps: base.reps + 1,
    dueAt: now + intervalDays * DAY_MS,
    lastResult: result,
    lapses: base.lapses,
  };
}
