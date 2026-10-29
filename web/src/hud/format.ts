/** "🪙 1,234". */
export const coins = (n: number): string => `🪙 ${n.toLocaleString()}`;

/**
 * A world day (`2026-10-20`) in words, in British English unless `locale` says otherwise. Noon UTC read
 * in UTC, so no time zone moves it to the day before or after.
 */
export const dayText = (
  day: string,
  opts: Intl.DateTimeFormatOptions,
  locale: Intl.LocalesArgument = "en-GB",
): string => new Date(`${day}T12:00:00Z`).toLocaleDateString(locale, { timeZone: "UTC", ...opts });

/** The range pills, "Today" to `all` (the cards say "All", the leaderboard "All time"). */
export const ranges = (all: string) =>
  [
    ["today", "Today"],
    ["7d", "7 days"],
    ["30d", "30 days"],
    ["all", all],
  ] as const;
