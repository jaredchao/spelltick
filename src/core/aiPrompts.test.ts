import { describe, expect, it } from "vitest";
import {
  cleanExample,
  cleanExplanation,
  cleanMeaning,
  completionsUrl,
  exampleMessages,
  EXPLANATION_MAX_CHARS,
  explanationMessages,
} from "./aiPrompts";

describe("prompts", () => {
  it("mention the term and the limits", () => {
    expect(exampleMessages("deploy", "部署")[1].content).toContain("deploy");
    expect(explanationMessages("deploy", "deplyo", "部署")[1].content).toContain("60");
  });
});

describe("cleanExample", () => {
  it("accepts a sentence containing the term", () => {
    expect(cleanExample('"We deploy every Friday."', "deploy")).toBe("We deploy every Friday.");
  });

  it("strips a label prefix and keeps the first line", () => {
    expect(cleanExample("例句：Please deploy it.\n(翻译)", "deploy")).toBe("Please deploy it.");
  });

  it("rejects a sentence without the exact term", () => {
    expect(cleanExample("We deployed it yesterday.", "deploy")).toBeNull();
  });

  it("rejects empty or very long replies", () => {
    expect(cleanExample("", "deploy")).toBeNull();
    expect(cleanExample(`deploy ${"x".repeat(200)}`, "deploy")).toBeNull();
  });
});

describe("cleanExplanation", () => {
  it("keeps short text", () => {
    expect(cleanExplanation("-oy 结尾同 employ、destroy。")).toBe("-oy 结尾同 employ、destroy。");
  });

  it("caps at 60 characters", () => {
    const long = "记".repeat(80);
    const out = cleanExplanation(long) ?? "";
    expect(Array.from(out)).toHaveLength(EXPLANATION_MAX_CHARS);
    expect(out.endsWith("…")).toBe(true);
  });

  it("returns null for empty replies", () => {
    expect(cleanExplanation("   ")).toBeNull();
  });
});

describe("cleanMeaning", () => {
  it("takes the first line without quotes", () => {
    expect(cleanMeaning("「部署；展开」\n更多")).toBe("部署；展开");
  });
});

describe("completionsUrl", () => {
  it("joins without double slashes", () => {
    expect(completionsUrl("https://api.deepseek.com/v1/")).toBe("https://api.deepseek.com/v1/chat/completions");
    expect(completionsUrl(" https://api.openai.com/v1 ")).toBe("https://api.openai.com/v1/chat/completions");
  });
});
