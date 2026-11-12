import { describe, expect, it } from "vitest";
import { accuracyLabel, lastSeenLabel, nextReviewLabel, resultLabel } from "./historyFormat";
import { DAY_MS, MINUTE_MS } from "./sm2";

const NOW = new Date(2026, 10, 12, 15, 0).getTime();

describe("historyFormat", () => {
  it("labels results", () => {
    expect(resultLabel("right")).toBe("答对");
    expect(resultLabel("hinted")).toBe("提示后答对");
    expect(resultLabel("skipped")).toBe("跳过");
    expect(resultLabel(null)).toBe("—");
    expect(resultLabel("odd")).toBe("—");
  });

  it("labels next review", () => {
    expect(nextReviewLabel(null, NOW)).toBe("—");
    expect(nextReviewLabel(NOW - 1, NOW)).toBe("已到期");
    expect(nextReviewLabel(NOW + 10 * MINUTE_MS, NOW)).toBe("10 分钟后");
    expect(nextReviewLabel(NOW + 3 * DAY_MS, NOW)).toBe("3 天后");
  });

  it("labels last seen as today, yesterday or a date", () => {
    expect(lastSeenLabel(new Date(2026, 10, 12, 9, 5).getTime(), NOW)).toBe("今天 09:05");
    expect(lastSeenLabel(new Date(2026, 10, 11, 23, 59).getTime(), NOW)).toBe("昨天 23:59");
    expect(lastSeenLabel(new Date(2026, 10, 3, 10, 0).getTime(), NOW)).toBe("11月3日");
  });

  it("labels accuracy", () => {
    expect(accuracyLabel(3, 4)).toBe("3 / 4");
    expect(accuracyLabel(0, 0)).toBe("—");
  });
});
