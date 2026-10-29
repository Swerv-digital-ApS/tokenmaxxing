/** The regulars' plaques: minutes spent in the Tavern, counted for the week's top five. */
import { addDays } from "./range.ts";

/** Most minutes that count for one player in a world day: sitting there all day earns no more. */
export const REGULAR_DAY_CAP = 180;
/** Minutes in a week to be on a plaque at all. */
export const REGULAR_MIN = 30;
/** Plaques on the wall. */
export const REGULARS_TOP = 5;
/** Rows older than this many weeks are dropped. */
export const REGULAR_KEEP_WEEKS = 8;

/** The Monday of the week containing the `YYYY-MM-DD` world day: the board starts over there. */
export function mondayOf(day: string): string {
  const [y, m, d] = day.split("-").map(Number);
  const at = new Date(Date.UTC(y!, m! - 1, d!));
  at.setUTCDate(at.getUTCDate() - ((at.getUTCDay() + 6) % 7));
  return at.toISOString().slice(0, 10);
}

/** Last week's Monday to Sunday, for the week before the one `day` is in. */
export function lastWeekOf(day: string): { from: string; to: string } {
  const from = addDays(mondayOf(day), -7);
  return { from, to: addDays(from, 6) };
}

/** The board from a week's totals: at least `REGULAR_MIN` minutes, most first, ties to the older player. */
export function rankRegulars(rows: readonly Omit<Regular, "rank">[], top = REGULARS_TOP): Regular[] {
  return rows
    .filter((r) => r.minutes >= REGULAR_MIN)
    .sort((a, b) => b.minutes - a.minutes || a.userId - b.userId)
    .slice(0, top)
    .map((r, i) => ({ ...r, rank: i + 1 }));
}

/** Letters of a name on the bar-tab chalkboard (the 3×5 font is 4 pixels a letter). */
export const TAB_NAME = 6;

/** Hours for the chalkboard in one decimal: "1.5H", "12H" from ten on. */
export const tabHours = (minutes: number): string => {
  const h = minutes / 60;
  return h >= 10 ? `${Math.round(h)}H` : `${(Math.floor(h * 10) / 10).toFixed(1)}H`;
};

/** A chalkboard row's name and hours, no cost or tokens anywhere: "ADA", "1.5H". */
export const tabLine = (r: Pick<Regular, "name" | "minutes">): [string, string] => [
  r.name.slice(0, TAB_NAME).toUpperCase(),
  tabHours(r.minutes),
];

/** Letters of a name that fit on a plaque (one tile wide; the 3×5 font is 4 pixels a letter). */
export const PLATE_NAME = 3;
/** Rows on the left plaque; the rest go on the right one. */
export const LEFT_PLATES = 3;

/** The text on one plaque row, in rank order like a high-score table: "ADA" (the font has capitals only). */
export const plateText = (r: Pick<Regular, "name">): string => r.name.slice(0, PLATE_NAME).toUpperCase();

/** Which plaque a rank hangs on: 0 is the left one, 1 the right. */
export const plaqueOf = (rank: number): 0 | 1 => (rank <= LEFT_PLATES ? 0 : 1);

/** One line of the weekly board. */
export interface Regular {
  rank: number;
  userId: number;
  name: string;
  minutes: number;
}

/** The board and what the asker has so far this week (null: nothing yet). */
export interface Regulars {
  top: Regular[];
  me: { minutes: number } | null;
  /** Last week's winner, who wears a chalk crown this week; null with no one (older servers omit it). */
  last?: { userId: number; name: string } | null;
}
