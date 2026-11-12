import { describe, expect, it } from "vitest";
import { applicableTypes, canCloze, chooseQuizType, clozeText } from "./quizType";
import { makeItem } from "./testItems";

const ALL = ["zh2en", "dictation", "cloze", "sentence_dictation"] as const;

describe("applicableTypes", () => {
  it("words with an example get all three word types", () => {
    expect(applicableTypes(makeItem())).toEqual(["zh2en", "dictation", "cloze"]);
  });

  it("words without an example never get cloze", () => {
    expect(applicableTypes(makeItem({ example: null }))).toEqual(["zh2en", "dictation"]);
  });

  it("words whose example lacks the exact term never get cloze", () => {
    const item = makeItem({ example: "We deployed it yesterday." });
    expect(canCloze(item)).toBe(false);
  });

  it("sentences get zh2en and sentence dictation", () => {
    const item = makeItem({ kind: "sentence", term: "Ship it.", example: null });
    expect(applicableTypes(item)).toEqual(["zh2en", "sentence_dictation"]);
  });
});

describe("chooseQuizType", () => {
  it("only picks enabled types", () => {
    expect(chooseQuizType(makeItem(), ["cloze"], () => 0.5)).toBe("cloze");
  });

  it("uses the rng to choose", () => {
    expect(chooseQuizType(makeItem(), ALL, () => 0)).toBe("zh2en");
    expect(chooseQuizType(makeItem(), ALL, () => 0.99)).toBe("cloze");
  });

  it("falls back to zh2en when nothing enabled applies", () => {
    const sentence = makeItem({ kind: "sentence", term: "Ship it.", example: null });
    expect(chooseQuizType(sentence, ["dictation", "cloze"], () => 0.5)).toBe("zh2en");
  });
});

describe("clozeText", () => {
  it("blanks out the term", () => {
    expect(clozeText(makeItem())).toBe("We ____ to production every Friday.");
  });
});
