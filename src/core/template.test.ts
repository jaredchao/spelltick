import { describe, expect, it } from "vitest";
import { fillTemplate } from "./template";

describe("fillTemplate", () => {
  it("fills placeholders", () => {
    expect(fillTemplate("{time}后再考", { time: "10 分钟" })).toBe("10 分钟后再考");
  });

  it("fills several placeholders including numbers", () => {
    expect(fillTemplate("今日 {n} 题 · 正确率 {rate}", { n: 18, rate: "83%" })).toBe(
      "今日 18 题 · 正确率 83%",
    );
  });

  it("leaves unknown placeholders untouched", () => {
    expect(fillTemplate("next_review: +{time}", {})).toBe("next_review: +{time}");
  });
});
