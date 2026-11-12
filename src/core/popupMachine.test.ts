import { describe, expect, it } from "vitest";
import { initialPopupState, popupReducer, type PopupEvent, type PopupState } from "./popupMachine";
import type { Question } from "./question";

const Q: Question = {
  deckName: "程序员英语",
  quizType: "zh2en",
  kind: "word",
  term: "deploy",
  meaning: "部署；展开",
};

function run(events: readonly PopupEvent[], from: PopupState = initialPopupState): PopupState {
  return events.reduce(popupReducer, from);
}

describe("popupReducer", () => {
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
    expect(s.focusToken).toBe(1);
  });

  it("summon while answering keeps input and re-requests focus", () => {
    const s = run([
      { type: "summon", question: Q },
      { type: "input", value: "dep" },
      { type: "summon", question: Q },
    ]);
    expect(s.phase).toBe("answer");
    expect(s.input).toBe("dep");
    expect(s.focusToken).toBe(2);
  });

  it("summon during feedback is ignored", () => {
    const fb = run([
      { type: "summon", question: Q },
      { type: "input", value: "deploy" },
      { type: "submit" },
    ]);
    expect(popupReducer(fb, { type: "summon", question: Q })).toBe(fb);
  });

  it("peek is ignored when not hidden", () => {
    const answering = run([{ type: "summon", question: Q }]);
    expect(popupReducer(answering, { type: "peek", question: Q })).toBe(answering);
  });

  it("peek times out to hidden", () => {
    const s = run([{ type: "peek", question: Q }, { type: "timeout" }]);
    expect(s.phase).toBe("hidden");
  });

  it("timeout does not close an answer in progress", () => {
    const s = run([{ type: "summon", question: Q }, { type: "timeout" }]);
    expect(s.phase).toBe("answer");
  });

  it("submits a correct answer ignoring case and spaces", () => {
    const s = run([
      { type: "summon", question: Q },
      { type: "input", value: "  DePloy " },
      { type: "submit" },
    ]);
    expect(s.phase).toBe("feedback");
    expect(s.outcome).toEqual({ correct: true, answer: "  DePloy ", usedHint: false });
  });

  it("marks a wrong answer and hint usage", () => {
    const s = run([
      { type: "summon", question: Q },
      { type: "hint" },
      { type: "input", value: "deplyo" },
      { type: "submit" },
    ]);
    expect(s.outcome).toEqual({ correct: false, answer: "deplyo", usedHint: true });
  });

  it("ignores empty submit", () => {
    const s = run([{ type: "summon", question: Q }, { type: "input", value: "  " }, { type: "submit" }]);
    expect(s.phase).toBe("answer");
  });

  it("caps hint level below term length", () => {
    const hints: PopupEvent[] = Array.from({ length: 10 }, () => ({ type: "hint" }));
    const s = run([{ type: "summon", question: Q }, ...hints]);
    expect(s.hintLevel).toBe(5);
  });

  it("skip hides immediately", () => {
    const s = run([{ type: "summon", question: Q }, { type: "skip" }]);
    expect(s.phase).toBe("hidden");
  });

  it("feedback closes on continue or timeout", () => {
    const fb = run([{ type: "summon", question: Q }, { type: "input", value: "x" }, { type: "submit" }]);
    expect(popupReducer(fb, { type: "continue" }).phase).toBe("hidden");
    expect(popupReducer(fb, { type: "timeout" }).phase).toBe("hidden");
  });

  it("a new question resets input and hints", () => {
    const done = run([
      { type: "summon", question: Q },
      { type: "hint" },
      { type: "input", value: "x" },
      { type: "skip" },
      { type: "peek", question: Q },
    ]);
    expect(done.input).toBe("");
    expect(done.hintLevel).toBe(0);
    expect(done.outcome).toBeNull();
  });
});
