import { invoke } from "@tauri-apps/api/core";
import { QUIZ_DEFAULTS, wordShare } from "../core/defaults";
import type { Attempt } from "../core/popupMachine";
import type { Question } from "../core/question";
import { chooseQuizType } from "../core/quizType";
import { selectNext, type Candidates } from "../core/select";
import { DAY_MS } from "../core/sm2";
import { startOfLocalDay } from "../core/time";

const SAMPLE_SIZE = 5;

/**
 * Load candidates and pick the next question, skipping the previous item
 * unless it is the only one left. Returns null when nothing can be asked.
 */
export async function loadNextQuestion(excludeItemId: number | null): Promise<Question | null> {
  const question = await loadOnce(excludeItemId);
  if (question || excludeItemId === null) return question;
  return loadOnce(null);
}

async function loadOnce(excludeItemId: number | null): Promise<Question | null> {
  const now = Date.now();
  try {
    const candidates = await invoke<Candidates>("quiz_candidates", {
      query: {
        now,
        dayStart: startOfLocalDay(now),
        recentSince: now - QUIZ_DEFAULTS.recentWrongDays * DAY_MS,
        excludeItemId,
        sampleSize: SAMPLE_SIZE,
      },
    });
    const pick = selectNext(
      candidates,
      {
        dailyNewLimit: QUIZ_DEFAULTS.dailyNewLimit,
        wordShare: wordShare(QUIZ_DEFAULTS.wordRatio, QUIZ_DEFAULTS.sentenceRatio),
      },
      Math.random,
    );
    if (!pick) return null;
    return { item: pick.item, quizType: chooseQuizType(pick.item, QUIZ_DEFAULTS.enabledTypes, Math.random) };
  } catch (error) {
    console.error("[quiz] failed to load next question", error);
    return null;
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
