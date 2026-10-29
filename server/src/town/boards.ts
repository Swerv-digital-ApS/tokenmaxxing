import type { AgentType } from "@tokenmaxxing/core/agentType.ts";
import {
  type Badge,
  type BadgeFacts,
  badgesFor,
  longestRun,
  POLYGLOT_MIN,
  streakOf,
} from "@tokenmaxxing/core/badges.ts";
import type { PinView } from "@tokenmaxxing/core/collection.ts";
import type { Ticket } from "@tokenmaxxing/core/cop.ts";
import { levelFor, levelTitle } from "@tokenmaxxing/core/format.ts";
import { OFFICE_LEVEL } from "@tokenmaxxing/core/office.ts";
import { addDays, dayKey, type RangeKey, rangeDays } from "@tokenmaxxing/core/range.ts";
import { type Brand, houseTier, type Look } from "@tokenmaxxing/core/world.ts";
import { sortBy, sumBy } from "hanzio";
import { all, one, pricing, type Sql, scalar } from "../actors/shared.ts";
import {
  type ActivityRow,
  companyTotals,
  rank,
  rowCost,
  rowTokens,
  type SortKey,
  type Totals,
  totals,
  type UsageRow,
} from "../stats.ts";
import { bioOf, type Habits, habitsOf, lastActiveOf, tavernDaysOf, tavernSince } from "./card.ts";
import type { Kept } from "./coins.ts";
import {
  COMPANY_COLS,
  type CompanyRow,
  companyById,
  companyInfos,
  companyOrGone,
  companyWallet,
} from "./companies.ts";
import { fishingFacts } from "./fishing.ts";
import { type GameStats, gameStats } from "./games.ts";
import { keynotesOf } from "./keynotes.ts";
import { picnicsOf } from "./picnic.ts";
import { questsCleared } from "./quests.ts";
import { ticketsOf } from "./tickets.ts";
import { levelOf, lookOf, TOKENS, tokensIn, USER_COLS, type UserRow, userById } from "./users.ts";

export interface BoardPlayer extends Totals {
  rank: number;
  userId: number;
  name: string;
  look: Look;
  level: number;
  companyId: number | null;
  company: string | null;
}

export interface BoardCompany extends Totals {
  rank: number;
  companyId: number;
  name: string;
  members: number;
  tier: number;
}

export interface Leaderboard {
  range: RangeKey;
  sort: SortKey;
  players: BoardPlayer[];
  companies: BoardCompany[];
}

export interface Daily {
  day: string;
  tokens: number;
  costUsd: number;
}

export interface CompanyProfile {
  id: number;
  name: string;
  /** Bare host, e.g. `acme.com`. */
  website: string | null;
  /** Same-origin path to its logo, when its website had one. */
  logo: string | null;
  brand: Brand | null;
  tier: number;
  range: RangeKey;
  /** Among companies by tokens in the range; null with none. */
  rank: number | null;
  /** Coins in its wallet (`companyWallet`). */
  wallet: number;
  totals: Totals;
  members: { userId: number; name: string; look: Look; level: number; tokens: number; isOwner: boolean }[];
  /** The last 30 world days, oldest first. */
  daily: Daily[];
}

export interface Profile {
  userId: number;
  name: string;
  look: Look;
  level: number;
  levelTitle: string;
  lifetimeTokens: number;
  company: { id: number; name: string } | null;
  range: RangeKey;
  totals: Totals;
  models: { model: string; tokens: number; costUsd: number; turns: number }[];
  /** The last 30 world days, oldest first, zeros included. */
  daily: Daily[];
  /** All time; null for someone who never finished a game. */
  games: GameStats | null;
  badges: Badge[];
  /** Whether they have an office (from `OFFICE_LEVEL`, in a company): anyone can visit it. */
  office: boolean;
  /** The 429 Cop's tickets, newest first. */
  tickets: Ticket[];
  // Added with card v2: optional, so an older client ignores them.
  /** One line, public. */
  bio?: string | null;
  /** The first world day in the Tavern; null before they came. */
  since?: string | null;
  /** The latest world day with usage; null if none. */
  lastActive?: string | null;
  /** The shelf, as shown (`town.profile` fills it in: it needs the collection). */
  showcase?: PinView[];
  /** The last 30 days of how they work, whatever the range. */
  habits?: Habits;
  agentType?: AgentType;
}

/** The HUD's corner: my numbers today, and today's top 5 (with me pinned below when I'm not in it). */
export interface Today {
  me: { rank: number | null; tokensToday: number; level: number };
  top: { rank: number; userId: number; name: string; tokens: number; isMe: boolean }[];
}

const TODAY_TOP = 5;

const BOARD_TOP = 100;

const ACTIVITY_SUMS = `SUM(prompts) AS prompts, SUM(prs) AS prs, SUM(agent_buckets) AS agentBuckets,
              SUM(active_buckets) AS activeBuckets, MAX(peak_agents) AS peakAgents`;

const SUMS = `SUM(input) AS input, SUM(output) AS output, SUM(cache_creation) AS cacheCreation,
              SUM(cache_read) AS cacheRead, SUM(turns) AS turns, SUM(reported_cost_cents) AS reportedCostCents`;

/** `[from, to]` as SQL bounds; all time starts at the beginning. */
const bounds = (range: RangeKey, now: number): [string, string] => {
  const { from, to } = rangeDays(range, now);
  return [from ?? "0000-00-00", to];
};

type PlayerTotals = Omit<BoardPlayer, "rank">;
type CompanyTotals = Omit<BoardCompany, "rank">;

/** Every player's and company's totals in `[from, to]`, unranked. */
async function buildBoard(
  sql: Sql,
  from: string,
  to: string,
): Promise<{ players: PlayerTotals[]; companies: CompanyTotals[] }> {
  const users = await all<UserRow>(sql, `SELECT ${USER_COLS} FROM users`);
  const usage = await all<UsageRow & { userId: number }>(
    sql,
    `SELECT user_id AS userId, model, ${SUMS} FROM usage_daily WHERE day >= ? AND day <= ? GROUP BY user_id, model`,
    from,
    to,
  );
  const activity = await all<ActivityRow & { userId: number }>(
    sql,
    `SELECT user_id AS userId, ${ACTIVITY_SUMS} FROM activity_daily WHERE day >= ? AND day <= ? GROUP BY user_id`,
    from,
    to,
  );
  const companies = await all<CompanyRow>(sql, `SELECT ${COMPANY_COLS} FROM companies`);
  const lifetime = await tokensIn(sql, "all");
  const companyName = new Map(companies.map((co) => [co.id, co.name]));

  const usageByUser = Map.groupBy(usage, (r) => r.userId);
  const activityByUser = new Map(activity.map((a) => [a.userId, a]));
  const players = users.map((u) => ({
    ...totals(pricing, usageByUser.get(u.id) ?? [], activityByUser.get(u.id) ?? null),
    userId: u.id,
    name: u.name,
    look: lookOf(u),
    level: levelFor(lifetime.get(u.id) ?? 0),
    companyId: u.companyId,
    company: u.companyId === null ? null : (companyName.get(u.companyId) ?? null),
  }));
  const tokens30d = new Map((await companyInfos(sql, "all")).map((i) => [i.id, i.tokens30d]));
  const byCompany = Map.groupBy(players, (p) => p.companyId);
  return {
    players,
    companies: companies.map((co) => {
      const members = byCompany.get(co.id) ?? [];
      return {
        ...companyTotals(members),
        companyId: co.id,
        name: co.name,
        members: members.length,
        tier: houseTier(tokens30d.get(co.id) ?? 0, members.length),
      };
    }),
  };
}

/**
 * Boards per range, kept until anything on them changes: the leaderboard is polled every 30 s per open
 * panel, and each one went over every player's usage. Every such change is pushed to `world`
 * (`town/sync.ts`), which drops them (`boardsChanged`). Keyed by the range's days, so a new day starts
 * afresh. Shared by every caller: never change what's in them.
 */
const byRange = new Map<string, ReturnType<typeof buildBoard>>();

/** Something on the boards changed: a sync, a sign-up, a new name or look, someone joining or leaving. */
export function boardsChanged(): void {
  byRange.clear();
}

function boardOf(sql: Sql, range: RangeKey, now: number): ReturnType<typeof buildBoard> {
  const [from, to] = bounds(range, now);
  const key = `${from} ${to}`;
  const hit = byRange.get(key);
  if (hit) return hit;
  // A few ranges a day: yesterday's go with the next change.
  if (byRange.size > 16) byRange.clear();
  const board = buildBoard(sql, from, to);
  byRange.set(key, board);
  // A failed one isn't kept.
  board.catch(() => {
    if (byRange.get(key) === board) byRange.delete(key);
  });
  return board;
}

/** Every player and company in the range, ranked by `sort`. */
async function boards(sql: Sql, range: RangeKey, sort: SortKey, now: number) {
  const board = await boardOf(sql, range, now);
  return { players: rank(board.players, sort), companies: rank(board.companies, sort) };
}

/**
 * What the badges read: all of a player's days, activity, models, games, loot and raids. The card, the
 * collection log and the award sweep share it, so they always agree. `kept`: the finished days' top 3s
 * and the raids, which `town` keeps. `extra`: facts someone else counts (the Tavern's days, quests helped).
 */
export async function badgeFactsOf(
  sql: Sql,
  userId: number,
  now: number,
  kept: Pick<Kept, "top" | "raids">,
  games?: GameStats | null,
  extra: Partial<BadgeFacts> = {},
): Promise<{ facts: BadgeFacts; lifetime: number; level: number }> {
  // Every day's tokens: for the level, and the badges.
  const days = await all<{ day: string; tokens: number }>(
    sql,
    `SELECT day, SUM(${TOKENS}) AS tokens FROM usage_daily WHERE user_id = ? GROUP BY day`,
    userId,
  );
  const lifetime = days.reduce((n, d) => n + d.tokens, 0);
  const g = games === undefined ? await gameStats(sql, userId) : games;
  const best = await one<{ peakAgents: number | null; prs: number | null; shipDays: number | null }>(
    sql,
    `SELECT MAX(peak_agents) AS peakAgents, SUM(prs) AS prs, SUM(prs > 0) AS shipDays
     FROM activity_daily WHERE user_id = ?`,
    userId,
  );
  // One pass over the models: how many are real, and how much came from the cache.
  const models = await all<{ tokens: number; cacheRead: number; fresh: number }>(
    sql,
    `SELECT SUM(${TOKENS}) AS tokens, SUM(cache_read) AS cacheRead,
            SUM(input + cache_creation + cache_read) AS fresh
     FROM usage_daily WHERE user_id = ? GROUP BY model`,
    userId,
  );
  const fresh = models.reduce((n, m) => n + m.fresh, 0);
  const withTokens = new Set(days.filter((d) => d.tokens > 0).map((d) => d.day));
  const facts: BadgeFacts = {
    streak: streakOf(withTokens, dayKey(now)),
    bestDay: Math.max(0, ...days.map((d) => d.tokens)),
    podiums: kept.top.filter((p) => p.userId === userId).length,
    peakAgents: best?.peakAgents ?? 0,
    prs: best?.prs ?? 0,
    wins: g?.wins ?? 0,
    biggestPot: g?.biggestPot ?? 0,
    // An owner is always a member (`leave` hands over), so owning a company says it.
    founder: (await scalar(sql, "SELECT COUNT(*) AS n FROM companies WHERE owner_id = ?", userId)) > 0,
    picnics: await picnicsOf(sql, userId),
    keynotes: await keynotesOf(sql, userId),
    shipDays: best?.shipDays ?? 0,
    models: models.filter((m) => m.tokens >= POLYGLOT_MIN).length,
    cacheShare: fresh > 0 ? models.reduce((n, m) => n + m.cacheRead, 0) / fresh : 0,
    lifetime,
    longestRun: longestRun(withTokens),
    raidKills: kept.raids.reduce((n, w) => n + w.kills.filter((k) => k.raiders.includes(userId)).length, 0),
    lootOwned: await scalar(sql, "SELECT COUNT(DISTINCT item) AS n FROM loot WHERE user_id = ?", userId),
    gamesPlayed: g?.played ?? 0,
    gameTypes: await scalar(
      sql,
      "SELECT COUNT(DISTINCT game) AS n FROM match_players WHERE user_id = ?",
      userId,
    ),
    // The Tavern's days and the quests cleared: counted here so the card, the log and the sweep agree.
    tavernDays: await tavernDaysOf(sql, userId),
    helped: await questsCleared(sql, userId),
    ...(await fishingFacts(sql, userId)),
    ...extra,
  };
  return { facts, lifetime, level: levelFor(lifetime) };
}

/** `kept`: every finished day's top 3 (`podiums`) and the raids. */
export async function profile(
  sql: Sql,
  userId: number,
  range: RangeKey,
  now: number,
  kept: Pick<Kept, "top" | "raids">,
): Promise<Profile> {
  const u = await userById(sql, userId);
  const [from, to] = bounds(range, now);
  const usage = await all<UsageRow>(
    sql,
    `SELECT model, ${SUMS} FROM usage_daily WHERE user_id = ? AND day >= ? AND day <= ? GROUP BY model`,
    userId,
    from,
    to,
  );
  const activity = await one<ActivityRow>(
    sql,
    `SELECT ${ACTIVITY_SUMS} FROM activity_daily WHERE user_id = ? AND day >= ? AND day <= ?`,
    userId,
    from,
    to,
  );
  const daily = await last30Days(sql, "user_id = ?", userId, now);
  const co = u.companyId === null ? undefined : await companyById(sql, u.companyId);
  const company = co ? { id: co.id, name: co.name } : null;
  const games = await gameStats(sql, userId);
  const { facts, lifetime, level } = await badgeFactsOf(sql, userId, now, kept, games);
  const badges = badgesFor(facts);
  const { habits, agentType } = await habitsOf(sql, userId, now, daily.filter((d) => d.tokens > 0).length);
  return {
    userId,
    name: u.name,
    look: lookOf(u),
    level,
    levelTitle: levelTitle(level),
    lifetimeTokens: lifetime,
    company,
    range,
    totals: totals(pricing, usage, activity?.activeBuckets == null ? null : activity),
    models: sortBy(
      usage.map((r) => ({
        model: r.model,
        tokens: rowTokens(r),
        costUsd: rowCost(pricing, r),
        turns: r.turns,
      })),
      { by: "tokens", order: "desc" },
    ),
    daily,
    games,
    badges,
    office: level >= OFFICE_LEVEL && !!company,
    tickets: await ticketsOf(sql, userId),
    bio: await bioOf(sql, userId),
    since: await tavernSince(sql, userId),
    lastActive: await lastActiveOf(sql, userId),
    habits,
    agentType,
  };
}

/** The last 30 world days of `usage_daily` rows matching `where`, oldest first, zeros included. */
async function last30Days(sql: Sql, where: string, arg: unknown, now: number): Promise<Daily[]> {
  const first = addDays(dayKey(now), -29);
  const days = await all<UsageRow & { day: string }>(
    sql,
    `SELECT day, model, ${SUMS} FROM usage_daily WHERE ${where} AND day >= ? GROUP BY day, model`,
    arg,
    first,
  );
  return Array.from({ length: 30 }, (_, i) => {
    const day = addDays(first, i);
    const rows = days.filter((r) => r.day === day);
    return {
      day,
      tokens: sumBy(rows, rowTokens),
      costUsd: Math.round(sumBy(rows, (r) => rowCost(pricing, r)) * 100) / 100,
    };
  });
}

/**
 * A company's card: its numbers for the range (and where that ranks it by tokens), the last 30 days,
 * its website and logo, and its people, busiest first.
 */
export async function companyProfile(
  sql: Sql,
  companyId: number,
  range: RangeKey,
  now: number,
): Promise<CompanyProfile> {
  const company = await companyOrGone(sql, companyId);
  const board = await boardOf(sql, range, now);
  // Only the companies are ranked, and only its own people.
  const row = rank(board.companies, "tokens").find((c) => c.companyId === companyId);
  const people = rank(
    board.players.filter((p) => p.companyId === companyId),
    "tokens",
  );
  const [info] = await companyInfos(sql, [companyId]);
  return {
    id: companyId,
    name: company.name,
    website: company.website,
    logo: info?.brand?.logo ?? null,
    brand: info?.brand ?? null,
    // Not on the board yet: it opened a moment ago, before the board heard (`boardsChanged`).
    tier: row?.tier ?? houseTier(info?.tokens30d ?? 0, people.length),
    range,
    rank: row && row.tokens > 0 ? row.rank : null,
    wallet: await companyWallet(sql, companyId),
    totals: row ?? companyTotals(people),
    members: people.map((p) => ({
      userId: p.userId,
      name: p.name,
      look: p.look,
      level: p.level,
      tokens: p.tokens,
      isOwner: p.userId === company.ownerId,
    })),
    daily: await last30Days(sql, "user_id IN (SELECT id FROM users WHERE company_id = ?)", companyId, now),
  };
}

/** The leaderboard as shown: players with anything to show (and me), the top 100 of each. */
export async function leaderboard(
  sql: Sql,
  userId: number,
  range: RangeKey,
  sort: SortKey,
  now: number,
): Promise<Leaderboard> {
  const board = await boards(sql, range, sort, now);
  const players = board.players.filter((p) => p.tokens > 0 || p.prs > 0 || p.userId === userId);
  return {
    range,
    sort,
    players: players.filter((p, i) => i < BOARD_TOP || p.userId === userId),
    companies: board.companies.slice(0, BOARD_TOP),
  };
}

/**
 * The corner is polled by every open tab and after every sync, so it reads only today's usage (the
 * `usage_day` index) rather than the whole board: anyone with no tokens today ranks below everyone here.
 */
export async function today(sql: Sql, userId: number, now: number): Promise<Today> {
  const u = await userById(sql, userId);
  const busy = await all<{ userId: number; name: string; tokens: number }>(
    sql,
    `SELECT u.id AS userId, u.name, SUM(${TOKENS}) AS tokens
     FROM usage_daily d JOIN users u ON u.id = d.user_id WHERE d.day = ? GROUP BY u.id`,
    dayKey(now),
  );
  // As `rank` sorts by tokens: the most first, ties by name.
  const ranked = busy
    .filter((p) => p.tokens > 0)
    .sort((a, b) => b.tokens - a.tokens || a.name.localeCompare(b.name))
    .map((p, i) => ({ ...p, rank: i + 1, isMe: p.userId === userId }));
  const mine = ranked.find((p) => p.isMe);
  const top = ranked.slice(0, TODAY_TOP);
  return {
    me: { rank: mine?.rank ?? null, tokensToday: mine?.tokens ?? 0, level: await levelOf(sql, userId) },
    top:
      mine && mine.rank <= TODAY_TOP
        ? top
        : [...top, mine ?? { rank: ranked.length + 1, userId, name: u.name, tokens: 0, isMe: true }],
  };
}
