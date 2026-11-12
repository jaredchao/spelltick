import { describe, expect, it } from "vitest";
import { hintMask, maxHintLevel, revealedPrefix } from "./hint";

describe("hint", () => {
  it("reveals one more letter per level", () => {
    expect(revealedPrefix("deploy", 1)).toBe("d");
    expect(revealedPrefix("deploy", 2)).toBe("de");
  });

  it("never reveals the whole term", () => {
    expect(maxHintLevel("deploy")).toBe(5);
    expect(revealedPrefix("deploy", 99)).toBe("deplo");
  });

  it("treats negative level as zero", () => {
    expect(revealedPrefix("deploy", -1)).toBe("");
  });

  it("masks hidden letters and keeps spaces", () => {
    expect(hintMask("deploy", 2)).toBe("de____");
    expect(hintMask("ship it", 1)).toBe("s___ __");
  });

  it("handles single-letter terms", () => {
    expect(maxHintLevel("a")).toBe(0);
    expect(hintMask("a", 1)).toBe("_");
  });
});
