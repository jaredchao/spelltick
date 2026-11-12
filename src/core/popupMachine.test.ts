import { describe, expect, it } from "vitest";
import { initialPopupState, popupReducer, type PopupEvent, type PopupState } from "./popupMachine";
import type { Question } from "./question";
import { DAY_MS, MINUTE_MS } from "./sm2";
import { makeItem } from "./testItems";

const NOW = 1_700_000_000_000;
const Q: Question = { item: makeItem({ id: 7 }), quizType: "zh2en" };

function run(events: readonly PopupEvent[], from: PopupState = initialPopupState): PopupState {
  return events.reduce(popupReducer, from);
}

const answering = (value: string): PopupEvent[] => [
  { type: "summon", question: Q },
  { type: "input", value },
];

describe("popupReducer: phases", () => {
  it("peek shows without bumping focus", () => {
    const s = run([{ type: "peek", question: Q }]);
    expect(s.phase).toBe("peek");
    expect(s.focusToken).toBe(0);
  });

  it("clicking peek enters answer and requests focus", () => {
    const s = run([{ type: "peek", question: Q }, { type: "clickPeek" }]);
    expect(s.phase).toBe("answer");
    expect(s.focusToken).toBe(1);
  });

  it("summon from hidden goes straight to answer", () => {
    const s = run([{ type: "summon", question: Q }]);
    expect(s.phase).toBe("answer");
    expect(s.question).toBe(Q);
  });

  it("summon from hidden without a question does nothing", () => {
    expect(run([{ type: "summon", question: null }])).toBe(initialPopupState);
  });

  it("summon while answering keeps input and re-requests focus", () => {
    const s = run([...answering("dep"), { type: "summon", question: null }]);
    expect(s.phase).toBe("answer");
    expect(s.input).toBe("dep");
    expect(s.focusToken).toBe(2);
  });

  it("summon during feedback is ignored", () => {
    const fb = run([...answering("deploy"), { type: "submit", now: NOW }]);
    expect(popupReducer(fb, { type: "summon", question: Q })).toBe(fb);
  });

  it("peek is ignored when not hidden", () => {
    const s = run([{ type: "summon", question: Q }]);
    expect(popupReducer(s, { type: "peek", question: Q })).toBe(s);
  });

  it("peek times out to hidden without an attempt", () => {
    const s = run([{ type: "peek", question: Q }, { type: "timeout" }]);
    expect(s.phase).toBe("hidden");
    expect(s.attempt).toBeNull();
  });

  it("timeout does not close an answer in progress", () => {
    expect(run([{ type: "summon", question: Q }, { type: "timeout" }]).phase).toBe("answer");
  });

  it("ignores empty submit", () => {
    expect(run([...answering("  "), { type: "submit", now: NOW }]).phase).toBe("answer");
  });

  it("caps hint level below term length", () => {
    const hints: PopupEvent[] = Array.from({ length: 10 }, () => ({ type: "hint" }));
    expect(run([{ type: "summon", question: Q }, ...hints]).hintLevel).toBe(5);
  });

  it("feedback closes on continue or timeout", () => {
    const fb = run([...answering("x"), { type: "submit", now: NOW }]);
    expect(popupReducer(fb, { type: "continue" }).phase).toBe("hidden");
    expect(popupReducer(fb, { type: "timeout" }).phase).toBe("hidden");
  });
});

describe("popupReducer: close reasons", () => {
  it("peek timeout closes with reason timeout and the item id", () => {
    const s = run([{ type: "peek", question: Q }, { type: "timeout" }]);
    expect(s.lastClose).toEqual({ seq: 1, reason: "timeout", itemId: 7 });
  });

  it("answering then continuing closes with reason done", () => {
    const s = run([...answering("deploy"), { type: "submit", now: NOW }, { type: "continue" }]);
    expect(s.lastClose?.reason).toBe("done");
  });

  it("skip closes with reason done", () => {
    expect(run([...answering("x"), { type: "skip", now: NOW }]).lastClose?.reason).toBe("done");
  });

  it("feedback timeout counts as done", () => {
    const s = run([...answering("x"), { type: "submit", now: NOW }, { type: "timeout" }]);
    expect(s.lastClose?.reason).toBe("done");
  });

  it("close seq increases", () => {
    const first = run([{ type: "peek", question: Q }, { type: "timeout" }]);
    const second = run([{ type: "peek", question: Q }, { type: "timeout" }], first);
    expect(second.lastClose?.seq).toBe(2);
  });
});

describe("popupReducer: grading and attempts", () => {
  it("correct answer schedules one day later and records an attempt", () => {
    const s = run([...answering(" DEPLOY "), { type: "submit", now: NOW }]);
    expect(s.outcome?.correct).toBe(true);
    expect(s.outcome?.result).toBe("right");
    expect(s.outcome?.review.dueAt).toBe(NOW + DAY_MS);
    expect(s.attempt).toMatchObject({ seq: 1, itemId: 7, correct: true, usedHint: false, at: NOW });
  });

  it("wrong answer comes back in 10 minutes", () => {
    const s = run([...answering("deplyo"), { type: "submit", now: NOW }]);
    expect(s.outcome?.result).toBe("wrong");
    expect(s.outcome?.review.dueAt).toBe(NOW + 10 * MINUTE_MS);
  });

  it("correct answer after a hint is graded as hinted", () => {
    const s = run([
      { type: "summon", question: Q },
      { type: "hint" },
      { type: "input", value: "deploy" },
      { type: "submit", now: NOW },
    ]);
    expect(s.outcome?.result).toBe("hinted");
    expect(s.attempt?.usedHint).toBe(true);
  });

  it("skip hides and records a wrong attempt", () => {
    const s = run([...answering("dep"), { type: "skip", now: NOW }]);
    expect(s.phase).toBe("hidden");
    expect(s.attempt).toMatchObject({ correct: false, answer: "dep" });
    expect(s.attempt?.review.lastResult).toBe("skipped");
  });

  it("attempt seq increases across questions", () => {
    const first = run([...answering("x"), { type: "submit", now: NOW }, { type: "continue" }]);
    const second = run([...answering("deploy"), { type: "submit", now: NOW }], first);
    expect(second.attempt?.seq).toBe(2);
  });

  it("a new question resets input, hints and outcome", () => {
    const s = run([
      { type: "summon", question: Q },
      { type: "hint" },
      { type: "input", value: "x" },
      { type: "skip", now: NOW },
      { type: "peek", question: Q },
    ]);
    expect(s.input).toBe("");
    expect(s.hintLevel).toBe(0);
    expect(s.outcome).toBeNull();
  });
});
