import { invoke } from "@tauri-apps/api/core";
import { RECENT_WRONG_DAYS, wordShare } from "../core/defaults";
import type { Attempt, Close } from "../core/popupMachine";
import type { Question, QuizItem } from "../core/question";
import { chooseQuizType } from "../core/quizType";
import { selectNext, type Candidates } from "../core/select";
import { DAY_MS } from "../core/sm2";
import { startOfLocalDay } from "../core/time";
import type { QuizSettings } from "../settings/types";
import type { AiConfig } from "../ai/client";
import { generateExample } from "../ai/features";

/** Optional AI step: turn a recently-wrong word into a fresh cloze question. */
export interface AiQuizOptions {
  readonly config: AiConfig;
  readonly newClozeFromMistakes: boolean;
}

const SAMPLE_SIZE = 5;

/**
 * Load candidates and pick the next question, skipping the previous item
 * unless it is the only one left. Returns null when nothing can be asked.
 */
export async function loadNextQuestion(
  quiz: QuizSettings,
  excludeItemId: number | null,
  ai: AiQuizOptions | null = null,
): Promise<Question | null> {
  const question = await loadOnce(quiz, excludeItemId, ai);
  if (question || excludeItemId === null) return question;
  return loadOnce(quiz, null, ai);
}

async function loadOnce(
  quiz: QuizSettings,
  excludeItemId: number | null,
  ai: AiQuizOptions | null,
): Promise<Question | null> {
  const now = Date.now();
  try {
    const candidates = await invoke<Candidates>("quiz_candidates", {
      query: {
        now,
        dayStart: startOfLocalDay(now),
        recentSince: now - RECENT_WRONG_DAYS * DAY_MS,
        excludeItemId,
        sampleSize: SAMPLE_SIZE,
      },
    });
    const pick = selectNext(
      candidates,
      {
        dailyNewLimit: quiz.dailyNewLimit,
        wordShare: wordShare(quiz.wordRatio, quiz.sentenceRatio),
      },
      Math.random,
    );
    if (!pick) return null;
    if (pick.source === "wrong" && pick.item.kind === "word" && ai?.newClozeFromMistakes) {
      const example = await generateExample(ai.config, pick.item);
      if (example) return { item: { ...pick.item, example }, quizType: "cloze" };
    }
    return { item: pick.item, quizType: chooseQuizType(pick.item, quiz.enabledTypes, Math.random) };
  } catch (error) {
    console.error("[quiz] failed to load next question", error);
    return null;
  }
}

/** Load a specific item (a peek that timed out earlier); falls back to a new pick. */
export async function loadQuestionFor(
  quiz: QuizSettings,
  itemId: number,
  excludeItemId: number | null,
): Promise<Question | null> {
  try {
    const item = await invoke<QuizItem | null>("quiz_item", { id: itemId });
    if (item) return { item, quizType: chooseQuizType(item, quiz.enabledTypes, Math.random) };
  } catch (error) {
    console.error("[quiz] failed to load item", error);
  }
  return loadNextQuestion(quiz, excludeItemId);
}

export async function reportClosed(close: Close): Promise<void> {
  try {
    await invoke("scheduler_popup_closed", { reason: close.reason, itemId: close.itemId });
  } catch (error) {
    console.error("[quiz] failed to report close", error);
  }
}

export async function recordAttempt(attempt: Attempt): Promise<void> {
  const { seq: _seq, ...input } = attempt;
  try {
    await invoke("quiz_record_attempt", { input });
  } catch (error) {
    console.error("[quiz] failed to record attempt", error);
  }
}
