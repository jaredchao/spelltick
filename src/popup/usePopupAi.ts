import { useEffect, useRef, useState } from "react";
import type { AiConfig } from "../ai/client";
import { logAi } from "../ai/client";
import { explainMistake, fillMissingExample } from "../ai/features";
import type { PopupState } from "../core/popupMachine";
import type { AiSettings } from "../settings/types";

/** "loading" while waiting, a string when ready, null when hidden or failed. */
export type Explanation = "loading" | string | null;

/**
 * Background AI work for the popup. Does nothing when `config` is null.
 * - caches a generated example for the shown item if it has none
 * - asks for a short explanation after a wrong answer
 */
export function usePopupAi(state: PopupState, ai: AiSettings, config: AiConfig | null): Explanation {
  const [explanation, setExplanation] = useState<Explanation>(null);
  const itemId = state.question?.item.id ?? null;
  const filled = useRef(new Set<number>());

  useEffect(() => {
    const item = state.question?.item;
    if (!config || !ai.generateExamples || !item || item.example || filled.current.has(item.id)) return;
    filled.current.add(item.id);
    void fillMissingExample(config, item);
  }, [itemId, config, ai.generateExamples]);

  const seq = state.attempt?.seq ?? 0;
  useEffect(() => {
    setExplanation(null);
    const { outcome, question } = state;
    if (!question || !outcome || outcome.correct || state.phase !== "feedback") return;
    if (!config || !ai.explainMistakes) {
      logAi(`explain skipped: ${!config ? "AI not configured in popup" : "explainMistakes off"}`);
      return;
    }
    logAi(`explain requested for "${question.item.term}"`);
    let active = true;
    setExplanation("loading");
    explainMistake(config, question.item, outcome.answer).then((text) => {
      if (active) setExplanation(text);
    });
    return () => {
      active = false;
    };
  }, [seq, config, ai.explainMistakes]);

  return explanation;
}
