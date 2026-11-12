import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { emit } from "@tauri-apps/api/event";
import { testConnection, type ConnectionResult } from "../ai/client";
import { EVENT_AI_KEY_CHANGED } from "../ai/useAiConfig";
import type { AiSettings, Settings } from "../settings/types";
import { Button, Check, Section } from "./controls";
import styles from "./Settings.module.css";

interface Props {
  readonly settings: Settings;
  readonly update: (next: Settings) => unknown;
}

/** Commit a text field on blur / Enter instead of on every keystroke. */
function TextField({
  label,
  value,
  placeholder,
  type = "text",
  onCommit,
}: {
  label: string;
  value: string;
  placeholder?: string;
  type?: "text" | "password";
  onCommit: (value: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  const commit = () => draft !== value && onCommit(draft.trim());
  return (
    <label className={styles.aiField}>
      <span className={styles.aiFieldLabel}>{label}</span>
      <input
        className={styles.text}
        type={type}
        value={draft}
        placeholder={placeholder}
        spellCheck={false}
        autoComplete="off"
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === "Enter" && commit()}
      />
    </label>
  );
}

export function AiSection({ settings, update }: Props) {
  const { ai } = settings;
  const [hasKey, setHasKey] = useState(false);
  const [result, setResult] = useState<ConnectionResult | null>(null);
  const [testing, setTesting] = useState(false);
  const [keyError, setKeyError] = useState<string | null>(null);

  useEffect(() => {
    invoke<boolean>("ai_key_has").then(setHasKey).catch(() => setHasKey(false));
  }, []);

  const setAi = (patch: Partial<AiSettings>) => update({ ...settings, ai: { ...ai, ...patch } });

  const saveKey = async (key: string) => {
    try {
      setKeyError(null);
      await invoke("ai_key_set", { key });
      setHasKey(key !== "");
      await emit(EVENT_AI_KEY_CHANGED);
    } catch (e) {
      setKeyError(`保存到钥匙串失败：${String(e)}`);
    }
  };

  const configured = hasKey && ai.baseUrl !== "" && ai.model !== "";

  const runTest = async () => {
    setTesting(true);
    setResult(null);
    const apiKey = await invoke<string | null>("ai_key_get").catch(() => null);
    setResult(
      apiKey
        ? await testConnection({ baseUrl: ai.baseUrl, model: ai.model, apiKey })
        : { ok: false, ms: 0, error: "没有 API Key" },
    );
    setTesting(false);
  };

  return (
    <>
      <div className={styles.divider} />
      <Section title="AI" note="OpenAI 兼容接口，留空就隐藏所有 AI 功能">
        <TextField
          label="Base URL"
          value={ai.baseUrl}
          placeholder="https://api.deepseek.com/v1"
          onCommit={(baseUrl) => setAi({ baseUrl })}
        />
        <TextField
          label="API Key"
          type="password"
          value=""
          placeholder={hasKey ? "已保存在系统钥匙串（输入新值可替换）" : "sk-…"}
          onCommit={(key) => void saveKey(key)}
        />
        {hasKey && (
          <div className={styles.inline}>
            <Button onClick={() => void saveKey("")}>清除 Key</Button>
          </div>
        )}
        {keyError && <div className={styles.error}>{keyError}</div>}
        <TextField label="模型" value={ai.model} placeholder="deepseek-chat" onCommit={(model) => setAi({ model })} />
        <div className={styles.inline}>
          <Button disabled={!configured || testing} onClick={() => void runTest()}>
            {testing ? "测试中…" : "测试连接"}
          </Button>
          {result &&
            (result.ok ? (
              <span className={styles.ok}>✓ 成功 · {result.ms}ms</span>
            ) : (
              <span className={styles.error}>✗ {result.error}</span>
            ))}
        </div>
        {configured && (
          <div className={styles.inlineWide}>
            <Check
              label="生成例句"
              checked={ai.generateExamples}
              onChange={(generateExamples) => setAi({ generateExamples })}
            />
            <Check
              label="答错讲解"
              checked={ai.explainMistakes}
              onChange={(explainMistakes) => setAi({ explainMistakes })}
            />
            <Check
              label="错词出新题"
              checked={ai.newClozeFromMistakes}
              onChange={(newClozeFromMistakes) => setAi({ newClozeFromMistakes })}
            />
          </div>
        )}
      </Section>
    </>
  );
}
