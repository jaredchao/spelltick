import { invoke } from "@tauri-apps/api/core";
import {
  cleanExample,
  cleanExplanation,
  cleanMeaning,
  exampleMessages,
  explanationMessages,
  meaningMessages,
} from "../core/aiPrompts";
import type { QuizItem } from "../core/question";
import { chat, logAiError, type AiConfig } from "./client";

/** Every helper here fails silently (returns null) and logs locally (SPEC 8). */

export async function generateExample(config: AiConfig, item: QuizItem): Promise<string | null> {
  try {
    return cleanExample(await chat(config, exampleMessages(item.term, item.meaning)), item.term);
  } catch (error) {
    logAiError("example", error);
    return null;
  }
}

/** Generate and cache an example for an item that has none. */
export async function fillMissingExample(config: AiConfig, item: QuizItem): Promise<void> {
  if (item.example || item.kind !== "word") return;
  const example = await generateExample(config, item);
  if (!example) return;
  await invoke("quiz_set_example", { itemId: item.id, example }).catch((e: unknown) =>
    logAiError("save example", e),
  );
}

export async function explainMistake(config: AiConfig, item: QuizItem, given: string): Promise<string | null> {
  try {
    return cleanExplanation(await chat(config, explanationMessages(item.term, given, item.meaning), 160));
  } catch (error) {
    logAiError("explain", error);
    return null;
  }
}

export async function suggestMeaning(config: AiConfig, term: string): Promise<string | null> {
  try {
    return cleanMeaning(await chat(config, meaningMessages(term), 60));
  } catch (error) {
    logAiError("meaning", error);
    return null;
  }
}
