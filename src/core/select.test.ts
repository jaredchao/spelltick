import { describe, expect, it } from "vitest";
import { selectNext, type Candidates } from "./select";
import { makeItem } from "./testItems";

const word = makeItem({ id: 1 });
const sentence = makeItem({ id: 2, kind: "sentence", term: "Ship it.", example: null });
const wrongWord = makeItem({ id: 3, term: "merge" });
const due = makeItem({ id: 4, term: "commit" });

const empty: Candidates = {
  due: null,
  newWords: [],
  newSentences: [],
  newToday: 0,
  recentWrongWords: [],
  recentWrongSentences: [],
};

const opts = { dailyNewLimit: 20, wordShare: 0.7 };
const pickWord = () => 0.1; // < 0.7 -> words first
const pickSentence = () => 0.9;

describe("selectNext", () => {
  it("returns null when there is nothing to ask", () => {
    expect(selectNext(empty, opts, pickWord)).toBeNull();
  });

  it("due reviews win over everything", () => {
    const c = { ...empty, due, newWords: [word], recentWrongWords: [wrongWord] };
    expect(selectNext(c, opts, pickSentence)).toEqual({ item: due, source: "due" });
  });

  it("uses the share to choose between words and sentences", () => {
    const c = { ...empty, newWords: [word], newSentences: [sentence] };
    expect(selectNext(c, opts, pickWord)?.item).toBe(word);
    expect(selectNext(c, opts, pickSentence)?.item).toBe(sentence);
  });

  it("falls back to the other kind when the chosen kind is empty", () => {
    const c = { ...empty, newWords: [word] };
    expect(selectNext(c, opts, pickSentence)?.item).toBe(word);
  });

  it("stops offering new items at the daily limit", () => {
    const c = { ...empty, newWords: [word], newToday: 20, recentWrongWords: [wrongWord] };
    expect(selectNext(c, opts, pickWord)).toEqual({ item: wrongWord, source: "wrong" });
  });

  it("prefers any new item over a recent wrong one", () => {
    const c = { ...empty, newSentences: [sentence], recentWrongWords: [wrongWord] };
    expect(selectNext(c, opts, pickWord)?.source).toBe("new");
  });

  it("returns null at the daily limit with no wrong items", () => {
    const c = { ...empty, newWords: [word], newToday: 25 };
    expect(selectNext(c, opts, pickWord)).toBeNull();
  });
});
