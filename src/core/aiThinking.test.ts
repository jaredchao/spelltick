import { describe, expect, it } from "vitest";
import { thinkingOffParams } from "./aiThinking";

describe("thinkingOffParams", () => {
  it("uses thinking.type for DeepSeek, Zhipu, Kimi and Doubao", () => {
    const off = { thinking: { type: "disabled" } };
    expect(thinkingOffParams("https://api.deepseek.com", "deepseek-flash")).toEqual(off);
    expect(thinkingOffParams("https://open.bigmodel.cn/api/paas/v4/", "glm-4.5")).toEqual(off);
    expect(thinkingOffParams("https://api.moonshot.cn/v1", "kimi-k2.6")).toEqual(off);
    expect(thinkingOffParams("https://ark.cn-beijing.volces.com/api/v3", "doubao-seed-1.6")).toEqual(off);
  });

  it("uses enable_thinking for Qwen on DashScope", () => {
    expect(thinkingOffParams("https://dashscope.aliyuncs.com/compatible-mode/v1", "qwen3-8b")).toEqual({
      enable_thinking: false,
    });
  });

  it("sends nothing to unknown hosts or OpenAI", () => {
    expect(thinkingOffParams("https://api.openai.com/v1", "gpt-5")).toBeNull();
    expect(thinkingOffParams("https://my-proxy.example.com/v1", "deepseek-flash")).toBeNull();
  });

  it("sends nothing for models that are always thinking", () => {
    expect(thinkingOffParams("https://api.moonshot.cn/v1", "kimi-k2-thinking")).toBeNull();
  });

  it("does not match look-alike hosts and tolerates bad URLs", () => {
    expect(thinkingOffParams("https://api.deepseek.com.evil.io", "deepseek-flash")).toBeNull();
    expect(thinkingOffParams("not a url", "x")).toBeNull();
  });
});
