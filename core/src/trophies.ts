/**
 * Trophies on the shelf in your office: silly coincidences in your own usage (a PR at 3 AM, a day total
 * that's a palindrome, a PR whose hash spells "dead"). Like badges, worked out on read from facts and
 * never stored or claimed; unlike badges, each says the world day it was first earned. Each pays a few
 * coins, once (`TROPHY_COINS` in `economy.ts`); the town records them as it sees them (`trophy_awards`) to
 * pay them. The cheapest to fake, the PR-hash ones, pay nothing.
 */
import { sortBy } from "hanzio";
import { addDays, dayKey, worldClock } from "./range.ts";

/** One hour of a player's events: its start (ms, on the hour) and what happened in it. */
export interface HourFacts {
  hour: number;
  tokens: number;
  prompts: number;
  /** The tools (`events.source`) that had tokens in it. */
  sources?: readonly string[];
}

/** A PR they opened: when, and its message id (the sha256 of its URL, from the GitHub source). */
export interface PrFacts {
  at: number;
  hash: string;
}

export interface TrophyFacts {
  hours: readonly HourFacts[];
  prs: readonly PrFacts[];
  /** Today's world day: a day's total only counts once the day is over. */
  today: string;
}

interface TrophyDef {
  id: string;
  name: string;
  /** How it's earned, for the shelf's list. */
  how: string;
  /** The world day it was first earned, or null. */
  earned: (f: Facts) => string | null;
}

/** An earned trophy, as the server sends it. */
export interface Trophy {
  id: string;
  day: string;
}

/** A day's tokens and the world-clock hours it had tokens in. */
interface DayFacts {
  day: string;
  tokens: number;
  hours: Set<number>;
  sources: Set<string>;
}

/** What the checks read: hours and PRs placed on the world clock, and per-day totals, oldest first. */
interface Facts {
  hours: (HourFacts & { day: string; weekday: number; clock: number })[];
  prs: (PrFacts & { day: string; weekday: number; clock: number })[];
  days: DayFacts[];
  /** Finished days only: today's total is still moving. */
  done: DayFacts[];
}

const onClock = <T extends { at: number }>(r: T) => ({ ...r, day: dayKey(r.at), ...clockOf(r.at) });
const clockOf = (ms: number) => {
  const c = worldClock(ms);
  return { weekday: c.day, clock: c.hour };
};

function factsOf(f: TrophyFacts): Facts {
  const hours = f.hours
    .filter((h) => h.tokens > 0 || h.prompts > 0)
    .map((h) => ({ ...h, day: dayKey(h.hour), ...clockOf(h.hour) }))
    .sort((a, b) => a.hour - b.hour);
  const days = new Map<string, DayFacts>();
  for (const h of hours) {
    if (h.tokens === 0) continue;
    const d = days.get(h.day) ?? { day: h.day, tokens: 0, hours: new Set(), sources: new Set() };
    d.tokens += h.tokens;
    d.hours.add(h.clock);
    for (const s of h.sources ?? []) d.sources.add(s);
    days.set(h.day, d);
  }
  const all = [...days.values()];
  return {
    hours,
    prs: sortBy(f.prs.map(onClock), "at"),
    days: all,
    done: all.filter((d) => d.day < f.today),
  };
}

const first = <T extends { day: string }>(rows: readonly T[], ok: (r: T) => boolean): string | null =>
  rows.find(ok)?.day ?? null;

const isPalindrome = (s: string) => s.length > 1 && s === [...s].reverse().join("");

/** A date that reads the same backwards in a common way of writing it: 20211202, 6/20/26, 2.6.26. */
export function palindromeDate(day: string): boolean {
  const [y, m, d] = day.split("-") as [string, string, string];
  const yy = y.slice(2);
  const [mn, dn] = [Number(m), Number(d)];
  return [y + m + d, d + m + yy, m + d + yy, `${dn}${mn}${yy}`, `${mn}${dn}${yy}`].some(isPalindrome);
}

/** The day the first run of `n` days in a row with tokens got to `n`. */
function streakDay(days: readonly DayFacts[], n: number): string | null {
  let run = 0;
  let prev = "";
  for (const { day } of days) {
    run = prev && addDays(prev, 1) === day ? run + 1 : 1;
    prev = day;
    if (run >= n) return day;
  }
  return null;
}

/** The first day with at least `n` of the given rows (PRs): the day its count got there. */
function busyDay(rows: readonly { day: string }[], n: number): string | null {
  const count = new Map<string, number>();
  for (const { day } of rows) {
    const c = (count.get(day) ?? 0) + 1;
    if (c >= n) return day;
    count.set(day, c);
  }
  return null;
}

/** Whether a world day is a Friday (noon UTC is the same date everywhere, so its weekday is the day's). */
const isFriday = (day: string): boolean => new Date(`${day}T12:00:00Z`).getUTCDay() === 5;

/** The Sunday that ended the first Monday-to-Sunday week with tokens on all seven days. */
function perfectWeek(days: readonly DayFacts[]): string | null {
  const have = new Set(days.map((d) => d.day));
  for (const { day } of days) {
    // Noon UTC is the same date everywhere, so its weekday is the day's.
    if (new Date(`${day}T12:00:00Z`).getUTCDay() !== 1) continue;
    if ([1, 2, 3, 4, 5, 6].every((i) => have.has(addDays(day, i)))) return addDays(day, 6);
  }
  return null;
}

// The shelf shows them in this order, seven to a shelf: append new ones, so nothing moves.
export const TROPHIES: readonly TrophyDef[] = [
  {
    id: "million",
    name: "Millionaire",
    how: "Burn 1M tokens in one day",
    earned: (f) => first(f.days, (d) => d.tokens >= 1e6),
  },
  {
    id: "billion",
    name: "Billionaire",
    how: "Burn 1B tokens in one day",
    earned: (f) => first(f.days, (d) => d.tokens >= 1e9),
  },
  {
    id: "streak",
    name: "Seven-Day Streak",
    how: "Tokens seven days in a row",
    earned: (f) => streakDay(f.days, 7),
  },
  {
    id: "3am",
    name: "3 AM PR",
    how: "Open a PR between 3 and 4 AM (Copenhagen)",
    earned: (f) => first(f.prs, (p) => p.clock === 3),
  },
  {
    id: "friday",
    name: "Friday Deploy",
    how: "Open a PR on a Friday after 5 PM",
    earned: (f) => first(f.prs, (p) => p.weekday === 5 && p.clock >= 17),
  },
  {
    id: "newyear",
    name: "New Year, New PR",
    how: "Open a PR on 1 January",
    earned: (f) => first(f.prs, (p) => p.day.endsWith("-01-01")),
  },
  {
    id: "holiday",
    name: "Holiday Shipper",
    how: "Open a PR on 24, 25 or 26 December",
    earned: (f) => first(f.prs, (p) => /-12-2[456]$/.test(p.day)),
  },
  {
    id: "zeros",
    name: "Leading Zeros",
    how: "A PR whose hash starts with 00",
    earned: (f) => first(f.prs, (p) => p.hash.startsWith("00")),
  },
  {
    id: "deadbeef",
    name: "Dead Beef",
    how: "A PR whose hash has dead or beef in it",
    earned: (f) => first(f.prs, (p) => /dead|beef/.test(p.hash)),
  },
  {
    id: "c0ffee",
    name: "C0FFEE",
    how: "A PR whose hash has c0ffee in it",
    earned: (f) => first(f.prs, (p) => p.hash.includes("c0ffee")),
  },
  {
    id: "earlybird",
    name: "Early Bird",
    how: "Burn tokens between 5 and 6 AM",
    earned: (f) => first(f.hours, (h) => h.tokens > 0 && h.clock === 5),
  },
  {
    id: "midnight",
    name: "Midnight Oil",
    how: "Burn tokens in every hour from midnight to 5 AM",
    earned: (f) => first(f.days, (d) => [0, 1, 2, 3, 4].every((h) => d.hours.has(h))),
  },
  {
    id: "allday",
    name: "Round the Clock",
    how: "Burn tokens in all 24 hours of one day",
    earned: (f) => first(f.days, (d) => d.hours.size >= 24),
  },
  {
    id: "weekend",
    name: "Weekend Warrior",
    how: "Burn tokens on a Saturday or Sunday",
    earned: (f) => first(f.hours, (h) => h.tokens > 0 && (h.weekday === 0 || h.weekday === 6)),
  },
  {
    id: "palindate",
    name: "Palindrome Day",
    how: "Burn tokens on a date that reads the same backwards (6/20/26)",
    earned: (f) => first(f.days, (d) => palindromeDate(d.day)),
  },
  {
    id: "palintotal",
    name: "Palindrome Total",
    how: "Finish a day on a palindrome total (12,344,321 tokens)",
    earned: (f) => first(f.done, (d) => d.tokens >= 1000 && isPalindrome(String(d.tokens))),
  },
  {
    id: "round",
    name: "Round Number",
    how: "Finish a day on a total ending in 000",
    earned: (f) => first(f.done, (d) => d.tokens >= 1000 && d.tokens % 1000 === 0),
  },
  {
    id: "jackpot",
    name: "Jackpot",
    how: "Finish a day on a total ending in 777",
    earned: (f) => first(f.done, (d) => d.tokens % 1000 === 777),
  },
  {
    id: "leet",
    name: "1337",
    how: "Finish a day on a total with 1337 in it",
    earned: (f) => first(f.done, (d) => String(d.tokens).includes("1337")),
  },
  {
    id: "piday",
    name: "Pi Day",
    how: "Burn tokens on 14 March",
    earned: (f) => first(f.days, (d) => d.day.endsWith("-03-14")),
  },
  {
    id: "storm",
    name: "Prompt Storm",
    how: "Send 60 prompts in one hour",
    earned: (f) => first(f.hours, (h) => h.prompts >= 60),
  },
  {
    id: "switch",
    name: "Switch-Hitter",
    how: "Use three different tools in one day",
    earned: (f) => first(f.days, (d) => d.sources.size >= 3),
  },
  {
    id: "perfectweek",
    name: "Perfect Week",
    how: "Tokens on all seven days, Monday to Sunday",
    earned: (f) => perfectWeek(f.days),
  },
  // The crazy ones: the shelf holds 42 (`SHELF_SLOTS`), six to a shelf of seven.
  {
    id: "streak30",
    name: "Habit Formed",
    how: "Tokens 30 days in a row",
    earned: (f) => streakDay(f.days, 30),
  },
  {
    id: "streak100",
    name: "Centurion",
    how: "Tokens 100 days in a row",
    earned: (f) => streakDay(f.days, 100),
  },
  {
    id: "streak365",
    name: "Touch Grass? Never",
    how: "Tokens 365 days in a row",
    earned: (f) => streakDay(f.days, 365),
  },
  {
    id: "hundredb",
    name: "Is This a Bug?",
    how: "Burn 100B tokens in one day",
    earned: (f) => first(f.days, (d) => d.tokens >= 100e9),
  },
  {
    id: "tsunami",
    name: "Token Tsunami",
    how: "Burn 1B tokens in one hour",
    earned: (f) => first(f.hours, (h) => h.tokens >= 1e9),
  },
  {
    id: "firehose",
    name: "Firehose",
    how: "Burn 100M tokens in one hour",
    earned: (f) => first(f.hours, (h) => h.tokens >= 100e6),
  },
  {
    id: "hurricane",
    name: "Prompt Hurricane",
    how: "Send 200 prompts in one hour",
    earned: (f) => first(f.hours, (h) => h.prompts >= 200),
  },
  {
    id: "setforget",
    name: "Set and Forget",
    how: "Burn 10M tokens in an hour on one prompt or none",
    earned: (f) => first(f.hours, (h) => h.tokens >= 10e6 && h.prompts <= 1),
  },
  {
    id: "insomniac",
    name: "Sleep Is Optional",
    how: "Burn tokens in 20 different hours of one day",
    earned: (f) => first(f.days, (d) => d.hours.size >= 20),
  },
  {
    id: "nice",
    name: "Nice",
    how: "Finish a day on a total ending in 69",
    earned: (f) => first(f.done, (d) => d.tokens >= 1000 && d.tokens % 100 === 69),
  },
  {
    id: "blaze",
    name: "Blaze It",
    how: "Finish a day on a total ending in 420",
    earned: (f) => first(f.done, (d) => d.tokens >= 1000 && d.tokens % 1000 === 420),
  },
  {
    id: "beast",
    name: "Number of the Beast",
    how: "Finish a day on a total with 666 in it",
    earned: (f) => first(f.done, (d) => String(d.tokens).includes("666")),
  },
  {
    id: "repdigit",
    name: "Stuck Key",
    how: "Finish a day on one digit repeated (77,777 tokens)",
    earned: (f) => first(f.done, (d) => d.tokens >= 1000 && /^(\d)\1+$/.test(String(d.tokens))),
  },
  {
    id: "countdown",
    name: "Liftoff",
    how: "Finish a day on a total with 54321 in it",
    earned: (f) => first(f.done, (d) => String(d.tokens).includes("54321")),
  },
  {
    id: "exactmillion",
    name: "Exactly Right",
    how: "Finish a day on a whole number of millions, to the token",
    earned: (f) => first(f.done, (d) => d.tokens >= 1e6 && d.tokens % 1e6 === 0),
  },
  {
    id: "leapday",
    name: "Leap Day",
    how: "Burn tokens on 29 February",
    earned: (f) => first(f.days, (d) => d.day.endsWith("-02-29")),
  },
  {
    id: "friday13",
    name: "Friday the 13th",
    how: "Burn tokens on a Friday the 13th",
    earned: (f) => first(f.days, (d) => d.day.endsWith("-13") && isFriday(d.day)),
  },
  {
    id: "halloween",
    name: "Spooky Season",
    how: "Burn tokens on 31 October",
    earned: (f) => first(f.days, (d) => d.day.endsWith("-10-31")),
  },
  {
    id: "spree",
    name: "PR Spree",
    how: "Open 10 PRs in one day",
    earned: (f) => busyDay(f.prs, 10),
  },
];

/** Trophies the shelf has room for: six shelves of seven. */
export const SHELF_SLOTS = 42;

/** Every trophy earned, in shelf order, with the day it was first earned. */
export function trophiesFor(f: TrophyFacts): Trophy[] {
  const facts = factsOf(f);
  return TROPHIES.flatMap((t) => {
    const day = t.earned(facts);
    return day ? [{ id: t.id, day }] : [];
  });
}
