import { invoke } from "@tauri-apps/api/core";
import { fetch } from "@tauri-apps/plugin-http";
import { completionsUrl, type ChatMessage } from "../core/aiPrompts";
import type { AiSettings } from "../settings/types";

export const AI_TIMEOUT_MS = 10_000;

export interface AiConfig {
  readonly baseUrl: string;
  readonly model: string;
  readonly apiKey: string;
}

interface CompletionResponse {
  readonly choices?: readonly { readonly message?: { readonly content?: string } }[];
  readonly error?: { readonly message?: string };
}

/** Full config when Base URL, model and a keychain key are all present. */
export async function loadAiConfig(ai: AiSettings): Promise<AiConfig | null> {
  if (ai.baseUrl.trim() === "" || ai.model.trim() === "") return null;
  const apiKey = await invoke<string | null>("ai_key_get").catch(() => null);
  if (!apiKey) return null;
  return { baseUrl: ai.baseUrl.trim(), model: ai.model.trim(), apiKey };
}

/** Write a failure to the local log. Never include the key or headers. */
export function logAiError(context: string, error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  void invoke("log_write", { level: "warn", message: `[ai] ${context}: ${message}` }).catch(() => undefined);
}

/** POST {baseUrl}/chat/completions with a 10 s timeout. Throws on any failure. */
export async function chat(
  config: AiConfig,
  messages: readonly ChatMessage[],
  maxTokens = 120,
): Promise<string> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), AI_TIMEOUT_MS);
  try {
    const res = await fetch(completionsUrl(config.baseUrl), {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${config.apiKey}` },
      body: JSON.stringify({ model: config.model, messages, max_tokens: maxTokens, temperature: 0.7 }),
      signal: controller.signal,
    });
    const data = (await res.json().catch(() => ({}))) as CompletionResponse;
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}${data.error?.message ? `: ${data.error.message}` : ""}`);
    }
    const content = data.choices?.[0]?.message?.content;
    if (typeof content !== "string") throw new Error("回复里没有内容");
    return content;
  } catch (error) {
    if (controller.signal.aborted) throw new Error("请求超时（10 秒）");
    throw error;
  } finally {
    window.clearTimeout(timer);
  }
}

export interface ConnectionResult {
  readonly ok: boolean;
  readonly ms: number;
  readonly error?: string;
}

/** Send a very short request and time it (settings "测试连接"). */
export async function testConnection(config: AiConfig): Promise<ConnectionResult> {
  const started = performance.now();
  try {
    await chat(config, [{ role: "user", content: "Reply with: ok" }], 5);
    return { ok: true, ms: Math.round(performance.now() - started) };
  } catch (error) {
    return {
      ok: false,
      ms: Math.round(performance.now() - started),
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
