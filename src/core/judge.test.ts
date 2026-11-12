import { describe, expect, it } from "vitest";
import { isCorrect, normalizeAnswer } from "./judge";

describe("isCorrect", () => {
  it("ignores case and surrounding spaces", () => {
    expect(isCorrect("  DePloy ", "deploy", "word")).toBe(true);
  });

  it("rejects a different spelling", () => {
    expect(isCorrect("deplyo", "deploy", "word")).toBe(false);
  });

  it("rejects an empty answer", () => {
    expect(isCorrect("   ", "deploy", "word")).toBe(false);
  });

  it("ignores trailing punctuation in sentences", () => {
    expect(isCorrect("Let's ship it", "Let's ship it.", "sentence")).toBe(true);
    expect(isCorrect("Can everyone hear me", "Can everyone hear me?", "sentence")).toBe(true);
  });

  it("collapses repeated spaces in sentences", () => {
    expect(isCorrect("ship   it", "Ship it.", "sentence")).toBe(true);
  });

  it("treats curly and straight apostrophes the same", () => {
    expect(isCorrect("Let’s ship it.", "Let's ship it.", "sentence")).toBe(true);
    expect(isCorrect("don't", "don’t", "word")).toBe(true);
  });

  it("keeps inner punctuation significant in sentences", () => {
    expect(isCorrect("LGTM feel free to merge", "LGTM, feel free to merge.", "sentence")).toBe(
      false,
    );
  });

  it("does not strip punctuation from words", () => {
    expect(normalizeAnswer("trade-off", "word")).toBe("trade-off");
  });
});
