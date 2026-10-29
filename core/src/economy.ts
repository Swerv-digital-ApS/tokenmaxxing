/**
 * Ways to earn beyond a day's tokens: coins for levels, badge tiers and trophies, and the streak
 * multiplier. Like the rest of the wallet nothing here is stored: each is worked out from a fact that
 * already is (the level, a badge tier reached, a trophy earned, the days with tokens), so someone who
 * already has them is paid on their next wallet. That is the backfill, and it has no cap.
 */
import { sumBy } from "hanzio";
import { MILESTONES } from "./milestones.ts";

// MARK: Levels

/** A level pays this plus its number: level 5 pays 7. */
export const LEVEL_COINS_BASE = 2;

/**
 * Every level up to `level` pays once, except the milestone levels (`MILESTONES`), which already pay
 * their own bigger coins.
 */
export const levelUpCoins = (level: number): number => {
  let coins = 0;
  for (let l = 1; l <= level; l++) if (!MILESTONES.some((m) => m.level === l)) coins += LEVEL_COINS_BASE + l;
  return coins;
};

// MARK: Badges and trophies

/**
 * What reaching tier 1 to 6 of a badge pays (Bronze, Silver, Gold, Diamond, Mythic, Cosmic): each tier once.
 * Only the longer ladders reach the last two. Tiers are paid from the rows a sweep recorded, by these
 * numbers when the wallet is read, so changing them pays everyone who holds a tier the new amount.
 */
export const BADGE_TIER_COINS: readonly number[] = [40, 100, 200, 400, 1000, 2000];

/** A badge standing at `tier` has paid every tier up to it. */
export const badgeCoins = (tier: number): number => sumBy(BADGE_TIER_COINS.slice(0, tier), (n) => n);

/** Trophies anyone gets in their first weeks. */
const COMMON = 20;
/** Coincidences you can steer a little (a day's total, an hour of the night). */
const ODD = 40;
/** Only on its day of the year. */
const CALENDAR = 100;
/** Takes a long haul or real luck. */
const RARE = 200;
/** Hardly anyone will ever see it. */
const LEGEND = 400;

/**
 * What each trophy pays, once. The PR-hash ones pay nothing: the cheapest to farm (open PRs until one
 * spells it) and a PR already counts for quests and badges. Anything not here pays nothing too.
 */
export const TROPHY_COINS: Readonly<Record<string, number>> = {
  million: COMMON,
  billion: COMMON,
  streak: COMMON,
  friday: COMMON,
  earlybird: COMMON,
  weekend: COMMON,
  switch: COMMON,
  perfectweek: COMMON,
  "3am": ODD,
  midnight: ODD,
  allday: ODD,
  palintotal: ODD,
  round: ODD,
  jackpot: ODD,
  leet: ODD,
  storm: ODD,
  newyear: CALENDAR,
  holiday: CALENDAR,
  piday: CALENDAR,
  palindate: CALENDAR,
  streak30: ODD,
  streak100: RARE,
  streak365: LEGEND,
  hundredb: LEGEND,
  tsunami: RARE,
  firehose: ODD,
  hurricane: RARE,
  setforget: ODD,
  insomniac: ODD,
  nice: ODD,
  blaze: ODD,
  beast: ODD,
  repdigit: RARE,
  countdown: RARE,
  exactmillion: RARE,
  leapday: CALENDAR,
  friday13: CALENDAR,
  halloween: CALENDAR,
  spree: ODD,
  zeros: 0,
  deadbeef: 0,
  c0ffee: 0,
};

/** Every trophy in `ids`, once each. */
export const trophyCoins = (ids: readonly string[]): number =>
  sumBy([...new Set(ids)], (id) => TROPHY_COINS[id] ?? 0);

// MARK: The streak multiplier

/** Each day in a row adds this to the next day's multiplier. */
export const STREAK_STEP = 0.5;
/** The multiplier tops out here. */
export const STREAK_MAX = 3;
/** The steps a streak can hold: the first active day is ×1, the fifth ×3. */
export const STREAK_STEPS = (STREAK_MAX - 1) / STREAK_STEP;

/**
 * The first world day the multiplier pays. Days before it keep their plain coins, so no balance moves at
 * deploy (the streak itself is counted over every day, so a player who's already at it starts there).
 * ponytail: set to the deploy day when shipping, like `LEGACY_FROM`.
 */
export const STREAK_FROM = "2026-10-28";

/** Whole days from `a` to `b` (both `YYYY-MM-DD`). */
const between = (a: string, b: string): number =>
  Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);

/**
 * Each day with tokens, with its multiplier: ×1 on the first day of a run, +0.5 for every day after it,
 * to ×3. A missed day resets the run to ×1.
 * `days` are the days with tokens, in any order.
 */
export function streakMultipliers(days: readonly string[]): Map<string, number> {
  const out = new Map<string, number>();
  let steps = 0;
  let prev: string | null = null;
  for (const day of [...new Set(days)].sort()) {
    if (prev && between(prev, day) > 1) steps = 0;
    out.set(day, 1 + STREAK_STEP * steps);
    steps = Math.min(steps + 1, STREAK_STEPS);
    prev = day;
  }
  return out;
}

/** What `coins` earned on a day are worth with `mult`: the part past the plain coins, whole coins only. */
export const streakExtra = (coins: number, mult: number): number => Math.floor(coins * mult) - coins;

/**
 * The multiplier's coins over a stretch: for each day from `STREAK_FROM`, its extra on `coinsOf(day)`
 * (that day's token coins and daily quests). Only days with tokens have a multiplier.
 */
export function streakBonus(days: readonly string[], coinsOf: (day: string) => number): number {
  let bonus = 0;
  for (const [day, mult] of streakMultipliers(days))
    if (day >= STREAK_FROM) bonus += streakExtra(coinsOf(day), mult);
  return bonus;
}

/** The multiplier the next active day would have, going on from yesterday: for the HUD. */
export function streakNow(days: readonly string[], today: string): number {
  const all = streakMultipliers(days);
  if (all.has(today)) return all.get(today)!;
  const last = [...all.keys()].sort().at(-1);
  if (!last) return 1;
  // Today isn't active yet: what today would be worth.
  const steps = Math.min((all.get(last)! - 1) / STREAK_STEP + 1, STREAK_STEPS);
  return 1 + STREAK_STEP * (between(last, today) > 1 ? 0 : steps);
}

// MARK: The new-model launch bonus

/** What using a model on the day it launches pays, once per launch. */
export const LAUNCH_COINS = 25;

/**
 * How a model is told apart across sources: lower case, no provider ("anthropic/"), dots as dashes, and
 * no variant ("...:free"). OpenRouter's "anthropic/claude-opus-5.5" and a client's "claude-opus-5-5" both
 * come out as "claude-opus-5-5".
 */
export const modelKey = (model: string): string =>
  model.toLowerCase().replace(/^.*\//, "").replace(/:.*$/, "").replace(/\./g, "-");

/**
 * Whether a model a client reported is `key` (see `modelKey`), or a dated build of it: "claude-opus-5-5"
 * counts for "claude-opus-5-5-20261027", but "claude-opus-5" doesn't count for "claude-opus-5-5".
 */
export const isModel = (reported: string, key: string): boolean => {
  const r = modelKey(reported);
  return r === key || (r.startsWith(`${key}-`) && /^\d{6,}/.test(r.slice(key.length + 1)));
};
