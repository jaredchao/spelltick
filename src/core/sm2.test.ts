import { describe, expect, it } from "vitest";
import { DAY_MS, MINUTE_MS, grade, nextReview, type ReviewRecord } from "./sm2";

const NOW = 1_700_000_000_000;

describe("grade", () => {
  it("maps results to SPEC scores", () => {
    expect(grade("right")).toBe(5);
    expect(grade("hinted")).toBe(3);
    expect(grade("wrong")).toBe(1);
    expect(grade("skipped")).toBe(1);
  });
});

describe("nextReview", () => {
  it("first correct answer schedules one day later", () => {
    const r = nextReview(null, "right", NOW);
    expect(r.reps).toBe(1);
    expect(r.intervalDays).toBe(1);
    expect(r.dueAt).toBe(NOW + DAY_MS);
    expect(r.ease).toBeCloseTo(2.6);
  });

  it("second correct answer schedules three days later", () => {
    const first = nextReview(null, "right", NOW);
    const second = nextReview(first, "right", NOW);
    expect(second.intervalDays).toBe(3);
    expect(second.reps).toBe(2);
  });

  it("later answers multiply the interval by the previous ease", () => {
    const record: ReviewRecord = {
      ease: 2.5,
      intervalDays: 3,
      reps: 2,
      dueAt: NOW,
      lastResult: "right",
      lapses: 0,
    };
    const r = nextReview(record, "right", NOW);
    expect(r.intervalDays).toBe(8); // round(3 * 2.5) = 7.5 -> 8
    expect(r.dueAt).toBe(NOW + 8 * DAY_MS);
  });

  it("wrong answer resets reps and comes back in 10 minutes", () => {
    const record: ReviewRecord = {
      ease: 2.5,
      intervalDays: 8,
      reps: 3,
      dueAt: NOW,
      lastResult: "right",
      lapses: 0,
    };
    const r = nextReview(record, "wrong", NOW);
    expect(r.reps).toBe(0);
    expect(r.dueAt).toBe(NOW + 10 * MINUTE_MS);
    expect(r.lapses).toBe(1);
    expect(r.ease).toBeCloseTo(2.5 + 0.1 - 4 * (0.08 + 4 * 0.02)); // 1.96
  });

  it("skip is graded like a wrong answer", () => {
    const r = nextReview(null, "skipped", NOW);
    expect(r.dueAt).toBe(NOW + 10 * MINUTE_MS);
    expect(r.lastResult).toBe("skipped");
  });

  it("hinted answer counts as passing but lowers ease", () => {
    const r = nextReview(null, "hinted", NOW);
    expect(r.reps).toBe(1);
    expect(r.ease).toBeCloseTo(2.5 + 0.1 - 2 * (0.08 + 2 * 0.02)); // 2.36
  });

  it("ease never drops below 1.3", () => {
    let r = nextReview(null, "wrong", NOW);
    for (let i = 0; i < 10; i++) r = nextReview(r, "wrong", NOW);
    expect(r.ease).toBe(1.3);
  });

  it("does not mutate the input record", () => {
    const record = Object.freeze(nextReview(null, "right", NOW));
    expect(() => nextReview(record, "wrong", NOW)).not.toThrow();
    expect(record.reps).toBe(1);
  });
});
