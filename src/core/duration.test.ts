import { describe, expect, it } from "vitest";
import { formatDuration } from "./duration";

describe("formatDuration", () => {
  it("formats minutes", () => {
    expect(formatDuration(10 * 60_000)).toBe("10 分钟");
    expect(formatDuration(5_000)).toBe("1 分钟");
  });

  it("rounds just under an hour up to 1 小时", () => {
    expect(formatDuration(59 * 60_000 + 40_000)).toBe("1 小时");
  });

  it("formats hours", () => {
    expect(formatDuration(2 * 3_600_000)).toBe("2 小时");
  });

  it("rounds just under a day up to 1 天", () => {
    expect(formatDuration(24 * 3_600_000 - 60_000)).toBe("1 天");
  });

  it("formats days", () => {
    expect(formatDuration(3 * 86_400_000)).toBe("3 天");
  });
});
