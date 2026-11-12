import { describe, expect, it } from "vitest";
import { resolveSkin, skins, SKIN_IDS } from "./skins";

describe("skins", () => {
  it("resolves system to native or terminal", () => {
    expect(resolveSkin("system", false)).toBe("native");
    expect(resolveSkin("system", true)).toBe("terminal");
    expect(resolveSkin("paper", true)).toBe("paper");
  });

  it("every skin defines the same token, copy and layout keys", () => {
    const keys = (id: (typeof SKIN_IDS)[number]) => ({
      tokens: Object.keys(skins[id].tokens).sort(),
      copy: Object.keys(skins[id].copy).sort(),
      layout: Object.keys(skins[id].layout).sort(),
    });
    expect(keys("terminal")).toEqual(keys("native"));
    expect(keys("paper")).toEqual(keys("native"));
  });
});
