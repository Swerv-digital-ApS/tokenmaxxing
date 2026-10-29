/**
 * Daily quests: three a day, one per tier (5, 10 and 15 coins), drawn from a pool and seeded by the world
 * day, with targets scaled to the player's own 30-day median (floors and caps keep light players
 * on easy ones and whales from farming). Plus one weekly quest. Nothing but the picks and the in-town
 * counters is stored: a quest is done when the day's rollups pass its target, so a late sync still pays.
 */
import { sumBy } from "hanzio";
import { compact, plural } from "./format.ts";
import { random } from "./games/random.ts";
import { addDays } from "./range.ts";

/**
 * The first world day paid by these rules. Every day before it keeps the old rule (`legacyQuestCoins`), so
 * wallets don't move at deploy. ponytail: set to the deploy day (a Monday, for the weekly) when shipping.
 */
export const LEGACY_FROM = "2026-10-26";

/** The coffee quest needs the Tavern: coffee drunk in the `inn` room counts (`drink` in the world actor). */
export const COFFEE_LIVE = true;

/** One day's rollups: tokens from `usage_daily`, the rest from `activity_daily`, models and games from their own tables. */
export interface DayFacts {
  tokens: number;
  peakAgents: number;
  /** 5-minute buckets with at least one agent running. */
  activeBuckets: number;
  prs: number;
  prompts: number;
  /** Distinct models used. */
  models: number;
  /** Arcade games finished. */
  gamesPlayed: number;
}

export const EMPTY_DAY: DayFacts = {
  tokens: 0,
  peakAgents: 0,
  activeBuckets: 0,
  prs: 0,
  prompts: 0,
  models: 0,
  gamesPlayed: 0,
};

/** In-town things done today, each counted by the server. */
export interface Counts {
  coffee: number;
  bench: number;
  paper: number;
  fountain: number;
}

export const EMPTY_COUNTS: Counts = { coffee: 0, bench: 0, paper: 0, fountain: 0 };
export const COUNT_KINDS = Object.keys(EMPTY_COUNTS) as (keyof Counts)[];
export const isCountKind = (k: unknown): k is keyof Counts => COUNT_KINDS.includes(k as keyof Counts);
/** A counter never goes past this. */
export const COUNT_CAP = 3;

/** What a player usually does on a day they're active: medians over their last 30 days. */
export interface Baseline {
  /** Active days it's from. */
  days: number;
  peakAgents: number;
  activeBuckets: number;
  prs: number;
  prompts: number;
  tokens: number;
  /** The most models they used on any one day. */
  models: number;
}

/** Fewer active days than this and the targets are the floors. */
export const MIN_BASELINE_DAYS = 3;

const median = (xs: number[]): number => {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
};

/** A day counts as active when anything ran or was said. */
const isActive = (f: DayFacts): boolean => f.tokens > 0 || f.activeBuckets > 0 || f.prompts > 0;

/** The baseline over the active days among `rows` (the 30 days before today). */
export function baselineOf(rows: DayFacts[]): Baseline {
  const active = rows.filter(isActive);
  const models = Math.max(0, ...active.map((r) => r.models));
  if (active.length < MIN_BASELINE_DAYS)
    return { days: active.length, peakAgents: 0, activeBuckets: 0, prs: 0, prompts: 0, tokens: 0, models };
  const of = (k: keyof DayFacts) => median(active.map((r) => r[k]));
  return {
    days: active.length,
    peakAgents: of("peakAgents"),
    activeBuckets: of("activeBuckets"),
    prs: of("prs"),
    prompts: of("prompts"),
    tokens: of("tokens"),
    models,
  };
}

type Tier = 1 | 2 | 3;

interface QuestDef {
  id: string;
  tier: Tier;
  /** In-town: done by going somewhere. */
  town?: true;
  text: (target: number) => string;
  /** The target for this player, floors and caps applied. */
  target: (b: Baseline) => number;
  value: (f: DayFacts, c: Counts) => number;
  /** Left out of a player's draw when false, so there are always three to pick. */
  eligible?: (b: Baseline) => boolean;
}

const clamp = (n: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, Math.round(n)));

/** 5-minute buckets as a length of time. */
const span = (buckets: number): string => {
  const min = buckets * 5;
  return min < 60
    ? `${min} minutes`
    : min % 60 === 0
      ? plural(min / 60, "hour")
      : `${(min / 60).toFixed(1)} hours`;
};

const one = (): number => 1;

export const POOL: readonly QuestDef[] = [
  // Tier 1: 1 coin.
  {
    id: "warm",
    tier: 1,
    text: (n) => `Warm up: use ${compact(n)} tokens`,
    // Capped low: a whale's warm-up costs what a median player's does.
    target: (b) => clamp(b.tokens / 2, 2e6, 25e6),
    value: (f) => f.tokens,
  },
  {
    id: "chatter",
    tier: 1,
    text: (n) => `Send ${n} prompts`,
    target: (b) => clamp(b.prompts * 0.8, 10, 150),
    value: (f) => f.prompts,
  },
  {
    id: "steady",
    tier: 1,
    text: (n) => `Keep agents running for ${span(n)}`,
    target: (b) => clamp(b.activeBuckets, 6, 24),
    value: (f) => f.activeBuckets,
  },
  {
    id: "coffee",
    tier: 1,
    town: true,
    text: () => "Have a coffee at the Tavern",
    target: one,
    value: (_f, c) => c.coffee,
    eligible: () => COFFEE_LIVE,
  },
  {
    id: "bench",
    tier: 1,
    town: true,
    text: () => "Sit on a bench in the square",
    target: one,
    value: (_f, c) => c.bench,
  },
  {
    id: "paper",
    tier: 1,
    town: true,
    text: () => "Read the morning paper",
    target: one,
    value: (_f, c) => c.paper,
  },
  {
    id: "fountain",
    tier: 1,
    town: true,
    text: () => "Toss a coin in the fountain",
    target: one,
    value: (_f, c) => c.fountain,
  },
  // Tier 2: 2 coins.
  {
    id: "parallel",
    tier: 2,
    text: (n) => `Run ${n} agents at once`,
    target: (b) => clamp(b.peakAgents * 1.25, 2, 6),
    value: (f) => f.peakAgents,
  },
  {
    id: "ship",
    tier: 2,
    text: (n) => `Ship ${plural(n, "PR")}`,
    target: (b) => clamp(b.prs, 1, 3),
    value: (f) => f.prs,
    eligible: (b) => b.prs > 0,
  },
  {
    id: "minds",
    tier: 2,
    text: () => "Use two different models",
    target: () => 2,
    value: (f) => f.models,
    eligible: (b) => b.models >= 2,
  },
  {
    id: "game",
    tier: 2,
    text: () => "Finish a game in the arcade",
    target: one,
    value: (f) => f.gamesPlayed,
  },
  // Tier 3: 3 coins.
  {
    id: "haul",
    tier: 3,
    text: (n) => `Long haul: agents running for ${span(n)}`,
    target: (b) => clamp(b.activeBuckets * 1.5, 12, 72),
    value: (f) => f.activeBuckets,
  },
  {
    id: "swarm",
    tier: 3,
    text: (n) => `Swarm: ${n} agents at once`,
    target: (b) => clamp(b.peakAgents * 1.5, 4, 8),
    value: (f) => f.peakAgents,
  },
];

const byId = new Map(POOL.map((q) => [q.id, q]));

/** The first world day a daily quest pays `QUEST_MULT` times its tier; the days before keep paying the tier. */
export const QUEST_MULT_FROM = "2026-10-29";
/** The first week (its Monday) whose weekly quest pays `QUEST_MULT` times `WEEKLY_BASE_COINS`. */
export const WEEKLY_MULT_FROM = "2026-11-02";
/** Quests pay five times what they did, to keep up with the coins everything else now earns and costs. */
export const QUEST_MULT = 5;

/** Coins a quest pays: its tier, times `QUEST_MULT` from `QUEST_MULT_FROM`; no `day` is today's rate. */
export const coinsOf = (tier: Tier, day?: string): number =>
  day !== undefined && day < QUEST_MULT_FROM ? tier : tier * QUEST_MULT;

/** A quest as it's stored for a day: which, and the target it was given. */
export interface DayQuest {
  id: string;
  target: number;
}

/** A small stable hash of a key, for seeding. */
const seedOf = (s: string): number => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
};

/** The share of days whose tier-1 quest is an in-town one. */
const TOWN_SHARE = 0.3;

/**
 * `day`'s three quests, one per tier, the same for the same day and baseline. At most one is in-town
 * (only tier 1 has any), and none that `yesterday` (its ids) had, unless nothing else is left.
 */
export function dailyQuests(day: string, b: Baseline, yesterday: readonly string[] = []): DayQuest[] {
  const rng = random(seedOf(`quests:${day}`));
  const out: DayQuest[] = [];
  let town = 0;
  for (const tier of [1, 2, 3] as const) {
    let pool = POOL.filter((q) => q.tier === tier && (q.eligible?.(b) ?? true));
    const fresh = pool.filter((q) => !yesterday.includes(q.id));
    if (fresh.length > 0) pool = fresh;
    const wantsTown = rng() < TOWN_SHARE && town === 0;
    const kinds = pool.filter((q) => !!q.town === wantsTown);
    const from = kinds.length > 0 ? kinds : pool.filter((q) => !q.town || town === 0);
    const pick = from[Math.floor(rng() * from.length)]!;
    if (pick.town) town++;
    out.push({ id: pick.id, target: pick.target(b) });
  }
  return out;
}

export interface Progress {
  id: string;
  text: string;
  coins: number;
  value: number;
  target: number;
  done: boolean;
  /** In-town. */
  town: boolean;
}

/** How far a stored quest is, with its text and pay. An id the pool no longer has reads as undone. */
export function questProgress(q: DayQuest, f: DayFacts, c: Counts, day?: string): Progress {
  const def = byId.get(q.id);
  if (!def) return { id: q.id, text: q.id, coins: 0, value: 0, target: q.target, done: false, town: false };
  const value = def.value(f, c);
  return {
    id: q.id,
    text: def.text(q.target),
    coins: coinsOf(def.tier, day),
    value: Math.min(value, q.target),
    target: q.target,
    done: value >= q.target,
    town: !!def.town,
  };
}

/** Coins a day paid: the sum over the quests that are done. */
export const questCoins = (qs: readonly DayQuest[], f: DayFacts, c: Counts, day?: string): number =>
  sumBy(qs, (q) => {
    const p = questProgress(q, f, c, day);
    return p.done ? p.coins : 0;
  });

/** Days before `LEGACY_FROM`: the two old quests, as they paid. A full day pays 7. */
export const legacyQuestCoins = (f: Pick<DayFacts, "peakAgents" | "activeBuckets">): number =>
  (f.peakAgents >= 5 ? 5 : 0) + (f.activeBuckets >= 24 ? 2 : 0);

// MARK: Weekly

/** What the weekly quest paid before `WEEKLY_MULT_FROM`. */
const WEEKLY_BASE_COINS = 15;
/** What the weekly quest pays: coins only. */
export const WEEKLY_COINS = WEEKLY_BASE_COINS * QUEST_MULT;
/** What the week starting `week` pays; no `week` is the current rate. */
export const weeklyCoins = (week?: string): number =>
  week !== undefined && week < WEEKLY_MULT_FROM ? WEEKLY_BASE_COINS : WEEKLY_COINS;

/** One world day, as the weekly counts it. */
export interface DayTally {
  /** Used any tokens. */
  active: boolean;
  /** Daily quests done. */
  cleared: number;
}

const WEEKLY = [
  {
    id: "active",
    text: (n: number) => `Be active ${n} days this week`,
    target: 5,
    value: (d: DayTally[]) => d.filter((x) => x.active).length,
  },
  {
    id: "cleared",
    text: (n: number) => `Clear ${n} daily quests this week`,
    target: 8,
    value: (d: DayTally[]) => d.reduce((s, x) => s + x.cleared, 0),
  },
] as const;

/** The Monday of the week `day` is in (`YYYY-MM-DD`). */
export function weekStart(day: string): string {
  const dow = new Date(`${day}T12:00:00Z`).getUTCDay(); // 0 = Sunday
  return addDays(day, -((dow + 6) % 7));
}

export interface WeeklyProgress {
  week: string;
  id: string;
  text: string;
  coins: number;
  value: number;
  target: number;
  done: boolean;
}

/** The week's quest (seeded by its Monday) and how far `days` (its days so far) got. */
export function weeklyProgress(week: string, days: DayTally[]): WeeklyProgress {
  const w = WEEKLY[seedOf(`weekly:${week}`) % WEEKLY.length]!;
  const value = w.value(days);
  return {
    week,
    id: w.id,
    text: w.text(w.target),
    coins: weeklyCoins(week),
    value: Math.min(value, w.target),
    target: w.target,
    done: value >= w.target,
  };
}

/** What the quests panel shows: today's three, the week's, and what today's quests have paid so far. */
export interface QuestBoard {
  day: string;
  daily: Progress[];
  weekly: WeeklyProgress;
  /** Coins today's quests have paid so far. */
  paid: number;
}
