/**
 * Request fields that turn off "thinking" for providers known to support it.
 * Short spelling hints do not need reasoning, and thinking adds latency and
 * tokens. Unknown hosts get nothing, since an unknown field can cause a 400.
 *
 * Sources (checked 2026-11): DeepSeek API docs (thinking is ON when omitted),
 * Zhipu / Z.ai, Kimi, Volcengine Ark (Doubao) use `thinking.type`;
 * Alibaba DashScope (Qwen) uses `enable_thinking`.
 */
type Params = Readonly<Record<string, unknown>>;

const THINKING_DISABLED: Params = { thinking: { type: "disabled" } };
const QWEN_DISABLED: Params = { enable_thinking: false };

const RULES: readonly { readonly hosts: readonly string[]; readonly params: Params }[] = [
  { hosts: ["api.deepseek.com"], params: THINKING_DISABLED },
  { hosts: ["open.bigmodel.cn", "api.z.ai"], params: THINKING_DISABLED },
  { hosts: ["api.moonshot.cn", "api.moonshot.ai"], params: THINKING_DISABLED },
  { hosts: ["ark.cn-beijing.volces.com", "ark.ap-southeast.bytepluses.com"], params: THINKING_DISABLED },
  { hosts: ["dashscope.aliyuncs.com", "dashscope-intl.aliyuncs.com"], params: QWEN_DISABLED },
];

function hostOf(baseUrl: string): string | null {
  try {
    return new URL(baseUrl.trim()).hostname.toLowerCase();
  } catch {
    return null;
  }
}

/** Extra body fields that disable thinking for this endpoint, or null if unknown. */
export function thinkingOffParams(baseUrl: string, model: string): Params | null {
  // Models named "...-thinking" cannot turn it off; sending the field may fail.
  if (/thinking/i.test(model)) return null;
  const host = hostOf(baseUrl);
  if (!host) return null;
  const rule = RULES.find((r) => r.hosts.some((h) => host === h || host.endsWith(`.${h}`)));
  return rule?.params ?? null;
}
