const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** Human-readable span: "10 分钟", "2 小时", "3 天". Never below 1 minute. */
export function formatDuration(ms: number): string {
  const minutes = Math.round(ms / MINUTE);
  if (minutes < 60) return `${Math.max(1, minutes)} 分钟`;
  const hours = Math.max(1, Math.round(ms / HOUR));
  if (hours < 24) return `${hours} 小时`;
  return `${Math.max(1, Math.round(ms / DAY))} 天`;
}
