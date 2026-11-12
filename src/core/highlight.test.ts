import { describe, expect, it } from "vitest";
import { splitByTerm } from "./highlight";

describe("splitByTerm", () => {
  it("marks the term inside a sentence", () => {
    expect(splitByTerm("We deploy to production every Friday.", "deploy")).toEqual([
      { text: "We ", match: false },
      { text: "deploy", match: true },
      { text: " to production every Friday.", match: false },
    ]);
  });

  it("matches case-insensitively and keeps original casing", () => {
    expect(splitByTerm("Deploy now.", "deploy")).toEqual([
      { text: "Deploy", match: true },
      { text: " now.", match: false },
    ]);
  });

  it("does not match inside a longer word", () => {
    expect(splitByTerm("Redeployment failed.", "deploy")).toEqual([
      { text: "Redeployment failed.", match: false },
    ]);
  });

  it("escapes regex characters in the term", () => {
    expect(splitByTerm("Use a.b here", "a.b")).toEqual([
      { text: "Use ", match: false },
      { text: "a.b", match: true },
      { text: " here", match: false },
    ]);
  });

  it("returns the whole text for an empty term", () => {
    expect(splitByTerm("hello", " ")).toEqual([{ text: "hello", match: false }]);
  });
});
