const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** Human-readable span: "10 分钟", "2 小时", "3 天". Never below 1 minute. */
export function formatDuration(ms: number): string {
  if (ms < HOUR) return `${Math.max(1, Math.round(ms / MINUTE))} 分钟`;
  if (ms < DAY) return `${Math.round(ms / HOUR)} 小时`;
  return `${Math.round(ms / DAY)} 天`;
}
