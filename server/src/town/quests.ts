import {
  baselineOf,
  COUNT_CAP,
  type Counts,
  type DayFacts,
  type DayQuest,
  type DayTally,
  dailyQuests,
  EMPTY_COUNTS,
  EMPTY_DAY,
  isCountKind,
  LEGACY_FROM,
  legacyQuestCoins,
  type QuestBoard,
  questCoins,
  questProgress,
  weeklyCoins,
  weeklyProgress,
  weekStart,
} from "@tokenmaxxing/core/quests.ts";
import { addDays, dayKey } from "@tokenmaxxing/core/range.ts";
import { TAVERN } from "@tokenmaxxing/core/tavern.ts";
import { all, one, type Sql } from "../actors/shared.ts";
import { TOKENS } from "./users.ts";

/**
 * Daily quests are derived like the rest of the wallet (`coins.ts`): what's stored is only which quests a
 * day dealt a player, with their targets (`quest_days`, so a later sync can't move them), and the
 * in-town things they did (`quest_counts`). Whether a quest is done, and the coins, come from the
 * day's rollups every time: facts only grow, so a late sync can only raise what quests paid.
 * No ledger rows: quest coins aren't matched into a company wallet either.
 */
export async function migrateQuests(sql: Sql): Promise<void> {
  await sql.execute(`CREATE TABLE IF NOT EXISTS quest_days (
    user_id INTEGER NOT NULL, day TEXT NOT NULL, picks TEXT NOT NULL,
    PRIMARY KEY (user_id, day)) WITHOUT ROWID`);
  // `last`: the key of the event counted last, so the same one twice counts once.
  await sql.execute(`CREATE TABLE IF NOT EXISTS quest_counts (
    user_id INTEGER NOT NULL, day TEXT NOT NULL, kind TEXT NOT NULL, n INTEGER NOT NULL, last TEXT,
    PRIMARY KEY (user_id, day, kind)) WITHOUT ROWID`);
}

/** The first day these rules pay: none at all with the Tavern off. */
export const paidFrom = (): string => (TAVERN ? LEGACY_FROM : "9999-12-31");

/** Days looked back at for a baseline. */
const BASELINE_DAYS = 30;

/** A player's facts, picks and counters, by day. */
export interface QuestData {
  facts: Map<string, DayFacts>;
  picks: Map<string, DayQuest[]>;
  counts: Map<string, Counts>;
}

export const noQuestData = (): QuestData => ({ facts: new Map(), picks: new Map(), counts: new Map() });

/**
 * Everyone in `from` (user id to first day), from that day on (and before `before`, if given): the day's
 * facts, the picks and the counters. One pass over each table, like `balances`.
 */
export async function loadQuestData(
  sql: Sql,
  from: Record<number, string>,
  before = "9999-12-31",
): Promise<Map<number, QuestData>> {
  const start = JSON.stringify(from);
  const on = "ON user_id = CAST(s.key AS INTEGER) AND day >= s.value AND day < ?";
  const out = new Map<number, QuestData>();
  const of = (id: number) => {
    const had = out.get(id);
    if (had) return had;
    const d = noQuestData();
    out.set(id, d);
    return d;
  };
  const fact = (id: number, day: string) => {
    const d = of(id);
    const had = d.facts.get(day);
    if (had) return had;
    const f = { ...EMPTY_DAY };
    d.facts.set(day, f);
    return f;
  };
  for (const r of await all<{ userId: number; day: string; tokens: number; models: number }>(
    sql,
    `SELECT user_id AS userId, day, SUM(${TOKENS}) AS tokens, COUNT(DISTINCT model) AS models
     FROM usage_daily JOIN json_each(?) s ${on} GROUP BY user_id, day`,
    start,
    before,
  ))
    Object.assign(fact(r.userId, r.day), { tokens: r.tokens, models: r.models });
  for (const r of await all<{
    userId: number;
    day: string;
    peakAgents: number;
    activeBuckets: number;
    prs: number;
    prompts: number;
  }>(
    sql,
    `SELECT user_id AS userId, day, peak_agents AS peakAgents, active_buckets AS activeBuckets, prs, prompts
     FROM activity_daily JOIN json_each(?) s ${on}`,
    start,
    before,
  )) {
    const { userId, day, ...a } = r;
    Object.assign(fact(userId, day), a);
  }
  for (const r of await all<{ userId: number; day: string; n: number }>(
    sql,
    `SELECT user_id AS userId, day, COUNT(*) AS n FROM match_players JOIN json_each(?) s ${on}
     GROUP BY user_id, day`,
    start,
    before,
  ))
    fact(r.userId, r.day).gamesPlayed = r.n;
  for (const r of await all<{ userId: number; day: string; picks: string }>(
    sql,
    `SELECT user_id AS userId, day, picks FROM quest_days JOIN json_each(?) s ${on}`,
    start,
    before,
  ))
    of(r.userId).picks.set(r.day, JSON.parse(r.picks));
  for (const r of await all<{ userId: number; day: string; kind: string; n: number }>(
    sql,
    `SELECT user_id AS userId, day, kind, n FROM quest_counts JOIN json_each(?) s ${on}`,
    start,
    before,
  )) {
    if (!isCountKind(r.kind)) continue;
    const d = of(r.userId);
    d.counts.set(r.day, { ...EMPTY_COUNTS, ...d.counts.get(r.day), [r.kind]: r.n });
  }
  return out;
}

/** What a player's quests have paid: per day (`daily`), in all, and the weekly quests (`weekly`). */
export interface QuestPay {
  daily: Map<string, number>;
  /** From daily quests, legacy days included. */
  total: number;
  weekly: number;
}

/** A day's tally for the weekly: active, and how many dailies are done. */
const tallyOf = (f: DayFacts, picks: DayQuest[] | undefined, c: Counts): DayTally => ({
  active: f.tokens > 0,
  cleared: (picks ?? []).filter((q) => questProgress(q, f, c).done).length,
});

/**
 * The coins quests paid, from the days' data. Days before `LEGACY_FROM` pay the old rule; from then on a
 * day pays what its frozen picks say (a day with none pays nothing: nothing was dealt).
 */
export function questPay(d: QuestData): QuestPay {
  const v2 = paidFrom();
  const daily = new Map<string, number>();
  const tallies = new Map<string, DayTally[]>();
  for (const day of new Set([...d.facts.keys(), ...d.picks.keys()])) {
    const f = d.facts.get(day) ?? EMPTY_DAY;
    if (day < v2) {
      daily.set(day, legacyQuestCoins(f));
      continue;
    }
    const picks = d.picks.get(day);
    const c = d.counts.get(day) ?? EMPTY_COUNTS;
    daily.set(day, picks ? questCoins(picks, f, c, day) : 0);
    const week = weekStart(day);
    tallies.set(week, [...(tallies.get(week) ?? []), tallyOf(f, picks, c)]);
  }
  let weekly = 0;
  for (const [week, days] of tallies) if (weeklyProgress(week, days).done) weekly += weeklyCoins(week);
  return { daily, total: [...daily.values()].reduce((n, x) => n + x, 0), weekly };
}

/** The medians for the 30 days before `day` (not counting it). */
export async function baselineFor(sql: Sql, userId: number, day: string) {
  const from = addDays(day, -BASELINE_DAYS);
  const data = (await loadQuestData(sql, { [userId]: from }, day)).get(userId);
  return baselineOf([...(data?.facts.values() ?? [])]);
}

/** The day's picks, frozen if they were, else what they'd be now (nothing is written). */
export async function dayPicks(sql: Sql, userId: number, day: string): Promise<DayQuest[]> {
  const had = await one<{ picks: string }>(
    sql,
    "SELECT picks FROM quest_days WHERE user_id = ? AND day = ?",
    userId,
    day,
  );
  if (had) return JSON.parse(had.picks);
  const yesterday = await one<{ picks: string }>(
    sql,
    "SELECT picks FROM quest_days WHERE user_id = ? AND day = ?",
    userId,
    addDays(day, -1),
  );
  const ids = yesterday ? (JSON.parse(yesterday.picks) as DayQuest[]).map((q) => q.id) : [];
  return dailyQuests(day, await baselineFor(sql, userId, day), ids);
}

/** The day's picks, written once: the first to freeze a day wins, so targets never move. Run it under `serial`. */
export async function freezeDay(sql: Sql, userId: number, day: string): Promise<DayQuest[]> {
  const picks = await dayPicks(sql, userId, day);
  await sql.execute(
    "INSERT OR IGNORE INTO quest_days (user_id, day, picks) VALUES (?, ?, ?)",
    userId,
    day,
    JSON.stringify(picks),
  );
  return picks;
}

/** Freezes each of `days` that pays by these rules (from `max(paidFrom, signup)` to today), oldest first. */
export async function freezeDays(sql: Sql, userId: number, days: string[], now: number) {
  const me = await one<{ at: number }>(sql, "SELECT created_at AS at FROM users WHERE id = ?", userId);
  const signup = me ? dayKey(me.at) : dayKey(now);
  const first = paidFrom() > signup ? paidFrom() : signup;
  const today = dayKey(now);
  for (const day of [...days].sort()) if (day >= first && day <= today) await freezeDay(sql, userId, day);
}

/**
 * One more thing done in town, counted once per `key` in a row (so the same bench twice is one) and at most
 * `COUNT_CAP` a day. Returns the new count, or null when `key` was the last one counted.
 * Run it under `serial`.
 */
export async function bumpCount(
  sql: Sql,
  userId: number,
  day: string,
  kind: keyof Counts,
  key: string,
): Promise<number | null> {
  const row = await one<{ n: number }>(
    sql,
    `INSERT INTO quest_counts (user_id, day, kind, n, last) VALUES (?, ?, ?, 1, ?)
     ON CONFLICT (user_id, day, kind) DO UPDATE SET n = MIN(n + 1, ?), last = excluded.last
     WHERE last IS NOT excluded.last RETURNING n`,
    userId,
    day,
    kind,
    key,
    COUNT_CAP,
  );
  return row?.n ?? null;
}

/**
 * The server saw `userId` do something in town: `kind` (a `Counts` key), once per `key`.
 * ponytail: `world` calls this for the bench, the fountain, the paper, and coffee drunk in the Tavern.
 */
export async function questEvent(sql: Sql, userId: number, kind: unknown, key: string, now: number) {
  if (!TAVERN || !isCountKind(kind)) return false;
  return (await bumpCount(sql, userId, dayKey(now), kind, key)) !== null;
}

/** Today's three, the week's quest and what's paid so far. Freezes today's picks: run it under `serial`. */
export async function questBoard(sql: Sql, userId: number, now: number): Promise<QuestBoard> {
  const today = dayKey(now);
  const picks = await freezeDay(sql, userId, today);
  const week = weekStart(today);
  const data = (await loadQuestData(sql, { [userId]: week })).get(userId) ?? noQuestData();
  const f = data.facts.get(today) ?? EMPTY_DAY;
  const c = data.counts.get(today) ?? EMPTY_COUNTS;
  const days: DayTally[] = [];
  for (let d = week; d <= today; d = addDays(d, 1)) {
    const df = data.facts.get(d) ?? EMPTY_DAY;
    days.push(tallyOf(df, data.picks.get(d), data.counts.get(d) ?? EMPTY_COUNTS));
  }
  return {
    day: today,
    daily: picks.map((q) => questProgress(q, f, c, today)),
    weekly: weeklyProgress(week, days),
    paid: questCoins(picks, f, c, today),
  };
}

/** Daily quests someone has cleared since these rules began, for the `helper` badge. */
export async function questsCleared(sql: Sql, userId: number): Promise<number> {
  const data = (await loadQuestData(sql, { [userId]: paidFrom() })).get(userId);
  if (!data) return 0;
  let n = 0;
  for (const [day, picks] of data.picks)
    n += tallyOf(data.facts.get(day) ?? EMPTY_DAY, picks, data.counts.get(day) ?? EMPTY_COUNTS).cleared;
  return n;
}
