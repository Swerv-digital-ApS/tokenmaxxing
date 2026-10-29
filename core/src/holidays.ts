/**
 * The town's calendar: the days it keeps, worked out from the world's clock (Copenhagen) and nothing else,
 * like the street (`street.ts`) and the merchant (`merchant.ts`), so every client sees the same day and the
 * server keeps no state for it. Each feature asks whether today is in its own window round a day (`near`):
 * the pumpkins (`halloween.ts`) are out for the week up to Halloween, and a costume is sold for two
 * weeks before its day (`costumes.ts`).
 */
import { worldWall } from "./range.ts";

export type HolidayId = "fastelavn" | "sanktHans" | "halloween" | "jDag" | "christmas" | "newYear";

export interface Holiday {
  name: string;
  emoji: string;
  /** Its date in `year`: the month (1 to 12) and the day. */
  date: (year: number) => readonly [number, number];
}

const DAY = 86_400_000;

/** Days since 1970-01-01 of a calendar date (pure calendar math, no timezone). */
const dayNumber = (y: number, m: number, d: number): number => Math.round(Date.UTC(y, m - 1, d) / DAY);

/** The date `n` days from (`m`, `d`) in `y`. */
function shift(y: number, [m, d]: readonly [number, number], n: number): [number, number] {
  const at = new Date(Date.UTC(y, m - 1, d + n));
  return [at.getUTCMonth() + 1, at.getUTCDate()];
}

/** Easter Sunday in `year` (the Gregorian computus, the anonymous algorithm). */
export function easter(year: number): [number, number] {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const h = (19 * a + b - Math.floor(b / 4) - Math.floor((8 * b + 13) / 25) + 15) % 30;
  const l = (32 + 2 * (b % 4) + 2 * Math.floor(c / 4) - h - (c % 4)) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  return [month, ((h + l - 7 * m + 114) % 31) + 1];
}

/** The day of the month of the first `weekday` (0 is Sunday) in `month` of `year`. */
export function firstWeekday(year: number, month: number, weekday: number): number {
  const first = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  return 1 + ((weekday - first + 7) % 7);
}

// A calendar reads best one day to a line.
// prettier-ignore
export const HOLIDAYS: Record<HolidayId, Holiday> = {
  /** Seven weeks before Easter Sunday. */
  fastelavn: { name: "Fastelavn", emoji: "🎭", date: (y) => shift(y, easter(y), -49) },
  sanktHans: { name: "Sankt Hans", emoji: "🔥", date: () => [6, 23] },
  halloween: { name: "Halloween", emoji: "🎃", date: () => [10, 31] },
  /** The first Friday of November, when the Christmas beer comes out at 20:59. */
  jDag: { name: "J-dag", emoji: "🍺", date: (y) => [11, firstWeekday(y, 11, 5)] },
  christmas: { name: "Juleaften", emoji: "🎄", date: () => [12, 24] },
  newYear: { name: "Nytårsaften", emoji: "🎆", date: () => [12, 31] },
};

/** The world day `ms` is in, as days since 1970-01-01. */
export const worldDayNumber = (ms: number): number => {
  const { y, m, d } = worldWall(ms);
  return dayNumber(y, m, d);
};

/** The world date of `id` in `year`, as days since 1970-01-01. */
const holidayDay = (id: HolidayId, year: number): number => dayNumber(year, ...HOLIDAYS[id].date(year));

/**
 * Whether the world day `ms` is in is from `before` days before `id` to `after` days after it, both included:
 * `near("halloween", ms, 0, 0)` is Halloween itself. Windows may cross New Year.
 */
export function near(id: HolidayId, ms: number, before: number, after: number): boolean {
  const today = worldDayNumber(ms);
  const { y } = worldWall(ms);
  return [y - 1, y, y + 1].some((year) => {
    const k = today - holidayDay(id, year);
    return k >= -before && k <= after;
  });
}

/** Days from `id` to the world day `ms` is in (0 on it, negative before it), for its nearest occurrence. */
export function daysFrom(id: HolidayId, ms: number): number {
  const today = worldDayNumber(ms);
  const { y } = worldWall(ms);
  return [y - 1, y, y + 1]
    .map((year) => today - holidayDay(id, year))
    .reduce((a, b) => (Math.abs(b) < Math.abs(a) ? b : a));
}

/** Minutes from `id`'s midnight (Copenhagen) to `ms`, for its nearest occurrence: negative before it, past 1440 after. */
export function minutesFrom(id: HolidayId, ms: number): number {
  const { hour, minute, second } = worldWall(ms);
  return daysFrom(id, ms) * 24 * 60 + hour * 60 + minute + second / 60;
}

/** `D. month` of `id`'s day `n` days from it, the one nearest `ms` (for "until 2 November"). */
export function dateLabel(id: HolidayId, ms: number, n = 0): string {
  const today = worldDayNumber(ms);
  const { y } = worldWall(ms);
  const year = [y - 1, y, y + 1].reduce((a, b) =>
    Math.abs(holidayDay(id, b) - today) < Math.abs(holidayDay(id, a) - today) ? b : a,
  );
  const [m, d] = shift(year, HOLIDAYS[id].date(year), n);
  return `${d} ${MONTHS[m - 1]}`;
}

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
