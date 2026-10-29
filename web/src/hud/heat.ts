/** The player card's small texts: pure, so they're tested without a browser. */

/** "today", "yesterday", "3 days ago": how long since the world day `day`, on the day `today`. */
export function daysAgoText(day: string, today: string): string {
  const n = Math.round((Date.parse(`${today}T12:00:00Z`) - Date.parse(`${day}T12:00:00Z`)) / 86_400_000);
  if (n <= 0) return "today";
  if (n === 1) return "yesterday";
  if (n < 60) return `${n} days ago`;
  return `${Math.round(n / 30)} months ago`;
}

const SOURCE_NAMES: Record<string, string> = {
  claude_code: "Claude Code",
  claude_cowork: "Cowork",
  codex: "Codex",
  cursor_local: "Cursor",
  grok_bot: "Grok Bot",
  github: "GitHub",
};

export const sourceName = (source: string): string => SOURCE_NAMES[source] ?? source;
