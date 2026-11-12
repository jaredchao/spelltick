import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import type { AiSettings } from "../settings/types";
import { loadAiConfig, type AiConfig } from "./client";

/** Emitted by the settings window after the API key is saved or cleared. */
export const EVENT_AI_KEY_CHANGED = "ai://key-changed";

/** The AI config, or null when AI is not configured (all AI UI stays hidden). */
export function useAiConfig(ai: AiSettings): AiConfig | null {
  const [config, setConfig] = useState<AiConfig | null>(null);
  const [keyVersion, setKeyVersion] = useState(0);

  useEffect(() => {
    const unlisten = listen(EVENT_AI_KEY_CHANGED, () => setKeyVersion((v) => v + 1));
    return () => void unlisten.then((fn) => fn());
  }, []);

  useEffect(() => {
    let active = true;
    loadAiConfig(ai).then((c) => active && setConfig(c));
    return () => {
      active = false;
    };
  }, [ai.baseUrl, ai.model, keyVersion]);

  return config;
}
