import { describe, expect, it } from "vitest";
import { spellingDiff, type DiffSegment } from "./spellingDiff";

const render = (segs: readonly DiffSegment[]) =>
  segs.map((s) => (s.changed ? `[${s.text}]` : s.text)).join("");

describe("spellingDiff", () => {
  it("highlights swapped letters on both sides", () => {
    const d = spellingDiff("deplyo", "deploy");
    expect(render(d.given).replace(/[[\]]/g, "")).toBe("deplyo");
    expect(render(d.expected).replace(/[[\]]/g, "")).toBe("deploy");
    expect(d.given.some((s) => s.changed)).toBe(true);
    expect(d.expected.some((s) => s.changed)).toBe(true);
  });

  it("marks a missing letter only on the expected side", () => {
    const d = spellingDiff("deloy", "deploy");
    expect(render(d.given)).toBe("deloy");
    expect(render(d.expected)).toBe("de[p]loy");
  });

  it("marks an extra letter only on the given side", () => {
    const d = spellingDiff("deeploy", "deploy");
    expect(d.given.filter((s) => s.changed).map((s) => s.text).join("")).toBe("e");
    expect(render(d.expected)).toBe("deploy");
  });

  it("ignores case but keeps original casing in output", () => {
    const d = spellingDiff("DEPLOY", "deploy");
    expect(render(d.given)).toBe("DEPLOY");
    expect(render(d.expected)).toBe("deploy");
  });

  it("trims surrounding spaces", () => {
    expect(render(spellingDiff("  deploy ", "deploy").given)).toBe("deploy");
  });
});
