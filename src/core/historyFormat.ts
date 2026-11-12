import { formatDuration } from "./duration";
import type { AnswerResult } from "./sm2";
import { startOfLocalDay } from "./time";

const RESULT_LABELS: Readonly<Record<AnswerResult, string>> = {
  right: "答对",
  hinted: "提示后答对",
  wrong: "答错",
  skipped: "跳过",
};

export function resultLabel(result: string | null): string {
  return result && result in RESULT_LABELS ? RESULT_LABELS[result as AnswerResult] : "—";
}

/** "已到期" when due, "3 天后" otherwise, "—" without a review. */
export function nextReviewLabel(dueAt: number | null, now: number): string {
  if (dueAt === null) return "—";
  if (dueAt <= now) return "已到期";
  return `${formatDuration(dueAt - now)}后`;
}

const pad = (n: number) => String(n).padStart(2, "0");

/** "今天 14:05" / "昨天 09:30" / "11月3日". */
export function lastSeenLabel(at: number, now: number): string {
  const d = new Date(at);
  const time = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  const today = startOfLocalDay(now);
  if (at >= today) return `今天 ${time}`;
  if (at >= startOfLocalDay(today - 1)) return `昨天 ${time}`;
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}

/** "3 / 4" (correct / attempts), or "—" without attempts. */
export function accuracyLabel(correct: number, attempts: number): string {
  if (attempts <= 0) return "—";
  return `${correct} / ${attempts}`;
}
