import { type AgentType, agentTypeOf } from "@tokenmaxxing/core/agentType.ts";
import { PIN_MAX, type Pin } from "@tokenmaxxing/core/collection.ts";
import { addDays, dayKey } from "@tokenmaxxing/core/range.ts";
import {
  lastWeekOf,
  mondayOf,
  REGULAR_DAY_CAP,
  REGULAR_KEEP_WEEKS,
  type Regular,
  rankRegulars,
} from "@tokenmaxxing/core/regulars.ts";
import { UserError } from "rivetkit";
import { all, one, type Sql, scalar } from "../actors/shared.ts";
import { AGENT_BUCKET_MS } from "../stats.ts";

/**
 * The player card's own tables: the bio and its reports, the showcase shelf, the Tavern's minutes
 * (`tavern_daily`), and the habit columns on `activity_daily`. All additive; nothing is backfilled here
 * (old days read as "no data" until the player re-reports them).
 */
export async function migrateCard(sql: Sql): Promise<void> {
  const users = (await sql.execute("PRAGMA table_info(users)")) as { name: string }[];
  if (!users.some((c) => c.name === "bio")) await sql.execute("ALTER TABLE users ADD COLUMN bio TEXT");
  // One report per reporter per bio: reporting twice is once.
  await sql.execute(`CREATE TABLE IF NOT EXISTS bio_reports (
    target INTEGER NOT NULL, reporter INTEGER NOT NULL, at INTEGER NOT NULL,
    PRIMARY KEY (target, reporter)) WITHOUT ROWID`);
  // Up to `PIN_MAX` things on a card's shelf: `ref` is a collection id (`badge:shipper`).
  await sql.execute(`CREATE TABLE IF NOT EXISTS showcase (
    user_id INTEGER NOT NULL, slot INTEGER NOT NULL CHECK (slot >= 0 AND slot < 3),
    kind TEXT NOT NULL, ref TEXT NOT NULL,
    PRIMARY KEY (user_id, slot)) WITHOUT ROWID`);
  // Minutes in the Tavern per world day (`visits`: times they came in), for the regulars' plaques.
  await sql.execute(`CREATE TABLE IF NOT EXISTS tavern_daily (
    user_id INTEGER NOT NULL, day TEXT NOT NULL, minutes INTEGER NOT NULL, visits INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (user_id, day)) WITHOUT ROWID`);
  const activity = (await sql.execute("PRAGMA table_info(activity_daily)")) as { name: string }[];
  const add = async (name: string, type: string) => {
    if (!activity.some((c) => c.name === name))
      await sql.execute(`ALTER TABLE activity_daily ADD COLUMN ${name} ${type}`);
  };
  await add("sessions", "INTEGER NOT NULL DEFAULT 0");
  // Σ over 5-minute buckets of the subagents running in them.
  await add("sub_buckets", "INTEGER NOT NULL DEFAULT 0");
  // 24 comma-separated counts of active buckets, by world hour; empty before the day was re-reported.
  await add("hours", "TEXT NOT NULL DEFAULT ''");
  // JSON `{source: tokens}`.
  await add("sources", "TEXT NOT NULL DEFAULT ''");
}

/** One reported day, as `player` sends it (the habit fields are optional: an older player omits them). */
export interface ActivityIn {
  day: string;
  prompts: number;
  prs: number;
  agentBuckets: number;
  activeBuckets: number;
  peakAgents: number;
  sessions?: number;
  subBuckets?: number;
  hours?: string;
  sources?: string;
  /** Tokens by world hour, for green hours (`town/grid.ts`). */
  hourTokens?: string;
}

const ACTIVITY_COLS =
  "user_id, day, prompts, prs, agent_buckets, active_buckets, peak_agents, sessions, sub_buckets, hours, sources, hour_tokens";

/**
 * Replaces `userId`'s rollups for these days. Named columns, never positional: `activity_daily` has more
 * columns than the seven it started with, and a positional insert breaks the day one is added.
 */
export async function writeActivity(
  sql: Sql,
  userId: number,
  activity: readonly ActivityIn[],
): Promise<void> {
  const row = "(?,?,?,?,?,?,?,?,?,?,?,?)";
  for (let i = 0; i < activity.length; i += 80) {
    const chunk = activity.slice(i, i + 80);
    await sql.execute(
      `INSERT OR REPLACE INTO activity_daily (${ACTIVITY_COLS}) VALUES ${chunk.map(() => row).join(",")}`,
      ...chunk.flatMap((a) => [
        userId,
        a.day,
        a.prompts,
        a.prs,
        a.agentBuckets,
        a.activeBuckets,
        a.peakAgents,
        a.sessions ?? 0,
        a.subBuckets ?? 0,
        a.hours ?? "",
        a.sources ?? "",
        a.hourTokens ?? "",
      ]),
    );
  }
}

// MARK: Bio

export const bioOf = async (sql: Sql, userId: number): Promise<string | null> =>
  (await one<{ bio: string | null }>(sql, "SELECT bio FROM users WHERE id = ?", userId))?.bio ?? null;

/** Sets (or, with null, clears) a bio; reports on the old one go with it. */
export async function setBio(sql: Sql, userId: number, bio: string | null): Promise<void> {
  await sql.execute("UPDATE users SET bio = ? WHERE id = ?", bio, userId);
  await sql.execute("DELETE FROM bio_reports WHERE target = ?", userId);
}

/** One report on `target`'s bio. Not your own, and nothing to report on an empty one. */
export async function reportBio(sql: Sql, reporter: number, target: number, now: number): Promise<void> {
  if (reporter === target) throw new UserError("That's your own bio.", { code: "invalid" });
  if (!(await bioOf(sql, target))) throw new UserError("There's no bio to report.", { code: "not_found" });
  await sql.execute(
    "INSERT OR IGNORE INTO bio_reports (target, reporter, at) VALUES (?, ?, ?)",
    target,
    reporter,
    now,
  );
}

// MARK: Showcase

/** Someone's shelf, in slot order. */
export async function pinsOf(sql: Sql, userId: number): Promise<Pin[]> {
  return (
    await all<{ ref: string }>(sql, "SELECT ref FROM showcase WHERE user_id = ? ORDER BY slot", userId)
  ).map((r) => ({ id: r.ref }));
}

/** Replaces the shelf with `ids`, in order (run it in one transaction). */
export async function setPins(sql: Sql, userId: number, ids: readonly string[]): Promise<void> {
  await sql.execute("DELETE FROM showcase WHERE user_id = ?", userId);
  for (const [slot, id] of ids.slice(0, PIN_MAX).entries())
    await sql.execute(
      "INSERT INTO showcase (user_id, slot, kind, ref) VALUES (?, ?, ?, ?)",
      userId,
      slot,
      id.slice(0, id.indexOf(":")),
      id,
    );
}

// MARK: The Tavern's minutes

/** `[userId, minutes, visits]`: what `world` counted since its last flush. */
export type TavernRow = [number, number, number];

/**
 * Adds a flush's minutes to `day`, at most `REGULAR_DAY_CAP` a player a day, for players that still
 * exist; drops rows past `REGULAR_KEEP_WEEKS`. Returns who was credited.
 */
export async function addTavernMinutes(sql: Sql, day: string, rows: readonly TavernRow[]): Promise<number[]> {
  const credited: number[] = [];
  for (const [userId, rawMinutes, rawVisits] of rows) {
    const minutes = Math.floor(rawMinutes);
    if (!Number.isInteger(userId) || userId <= 0 || !(minutes > 0)) continue;
    const visits = Math.min(Math.max(Math.floor(rawVisits) || 0, 0), minutes);
    const row = await one(
      sql,
      `INSERT INTO tavern_daily (user_id, day, minutes, visits)
       SELECT id, ?, MIN(?, ?), ? FROM users WHERE id = ?
       ON CONFLICT (user_id, day) DO UPDATE
         SET minutes = MIN(?, minutes + excluded.minutes), visits = visits + excluded.visits
       RETURNING user_id`,
      day,
      minutes,
      REGULAR_DAY_CAP,
      visits,
      userId,
      REGULAR_DAY_CAP,
    );
    if (row) credited.push(userId);
  }
  await sql.execute("DELETE FROM tavern_daily WHERE day < ?", addDays(day, -7 * REGULAR_KEEP_WEEKS));
  return credited;
}

/** Everyone's minutes between two world days, inclusive, ranked (`rankRegulars`: 30 minutes, top five). */
async function boardBetween(sql: Sql, from: string, to: string): Promise<Regular[]> {
  const rows = await all<{ userId: number; name: string; minutes: number }>(
    sql,
    `SELECT t.user_id AS userId, u.name, SUM(t.minutes) AS minutes
     FROM tavern_daily t JOIN users u ON u.id = t.user_id
     WHERE t.day >= ? AND t.day <= ? GROUP BY t.user_id`,
    from,
    to,
  );
  return rankRegulars(rows);
}

/** This week's top five by minutes (Monday to now), with at least `REGULAR_MIN`. */
export const weeklyRegulars = (sql: Sql, today: string): Promise<Regular[]> =>
  boardBetween(sql, mondayOf(today), today);

/** Who topped last week's board (they wear the chalk crown this week), or null. */
export async function lastWeekWinner(
  sql: Sql,
  today: string,
): Promise<{ userId: number; name: string } | null> {
  const { from, to } = lastWeekOf(today);
  const [w] = await boardBetween(sql, from, to);
  return w ? { userId: w.userId, name: w.name } : null;
}

/** Someone's minutes so far this week; null with none. */
export async function minutesThisWeek(sql: Sql, userId: number, today: string): Promise<number | null> {
  const n = await scalar(
    sql,
    "SELECT COALESCE(SUM(minutes), 0) AS n FROM tavern_daily WHERE user_id = ? AND day >= ? AND day <= ?",
    userId,
    mondayOf(today),
    today,
  );
  return n > 0 ? n : null;
}

/** Days someone came to the Tavern: the `tavern` badge. */
export const tavernDaysOf = (sql: Sql, userId: number): Promise<number> =>
  scalar(sql, "SELECT COUNT(*) AS n FROM tavern_daily WHERE user_id = ? AND visits > 0", userId);

/** The first day someone was in the Tavern, or null. */
export async function tavernSince(sql: Sql, userId: number): Promise<string | null> {
  const r = await one<{ day: string | null }>(
    sql,
    "SELECT MIN(day) AS day FROM tavern_daily WHERE user_id = ? AND visits > 0",
    userId,
  );
  return r?.day ?? null;
}

// MARK: Habits

/** What the card's "How you work" shows: the last 30 days, whatever range the totals show. */
export interface Habits {
  /** Active buckets by world hour (24), all zeros for days not yet re-reported. */
  hours: number[];
  sessions: number;
  activeHours: number;
  /** Agents at once on average while any ran; null with none. */
  parallelism: number | null;
  peakAgents: number;
  /** Share of agent-buckets that were subagents, 0 to 1. */
  subShare: number;
  turnsPerPrompt: number | null;
  /** Cache reads over everything read, 0 to 1; null with nothing. */
  cacheHit: number | null;
  /** Tokens by source, biggest first, as shares of the total. */
  sources: { source: string; share: number }[];
}

/** `days`: how many of the 30 had tokens. */
export async function habitsOf(
  sql: Sql,
  userId: number,
  now: number,
  days: number,
): Promise<{ habits: Habits; agentType: AgentType }> {
  const first = addDays(dayKey(now), -29);
  const a = await one<{
    prompts: number | null;
    agentBuckets: number | null;
    activeBuckets: number | null;
    peak: number | null;
    sessions: number | null;
    subs: number | null;
  }>(
    sql,
    `SELECT SUM(prompts) AS prompts, SUM(agent_buckets) AS agentBuckets, SUM(active_buckets) AS activeBuckets,
            MAX(peak_agents) AS peak, SUM(sessions) AS sessions, SUM(sub_buckets) AS subs
     FROM activity_daily WHERE user_id = ? AND day >= ?`,
    userId,
    first,
  );
  const u = await one<{
    input: number | null;
    creation: number | null;
    read: number | null;
    turns: number | null;
  }>(
    sql,
    `SELECT SUM(input) AS input, SUM(cache_creation) AS creation, SUM(cache_read) AS read, SUM(turns) AS turns
     FROM usage_daily WHERE user_id = ? AND day >= ?`,
    userId,
    first,
  );
  const rows = await all<{ hours: string; sources: string }>(
    sql,
    "SELECT hours, sources FROM activity_daily WHERE user_id = ? AND day >= ? AND (hours != '' OR sources != '')",
    userId,
    first,
  );
  const hours = Array<number>(24).fill(0);
  const bySource = new Map<string, number>();
  for (const r of rows) {
    r.hours.split(",").forEach((n, i) => {
      if (i < 24) hours[i]! += Number(n) || 0;
    });
    try {
      for (const [source, tokens] of Object.entries(JSON.parse(r.sources || "{}") as Record<string, number>))
        if (Number.isFinite(tokens)) bySource.set(source, (bySource.get(source) ?? 0) + tokens);
    } catch {
      // A malformed day is skipped, not fatal.
    }
  }
  const total = [...bySource.values()].reduce((n, v) => n + v, 0);
  const agentBuckets = a?.agentBuckets ?? 0;
  const activeBuckets = a?.activeBuckets ?? 0;
  const read = (u?.input ?? 0) + (u?.creation ?? 0) + (u?.read ?? 0);
  const habits: Habits = {
    hours,
    sessions: a?.sessions ?? 0,
    activeHours: (activeBuckets * AGENT_BUCKET_MS) / 3_600_000,
    parallelism: activeBuckets > 0 ? agentBuckets / activeBuckets : null,
    peakAgents: a?.peak ?? 0,
    subShare: agentBuckets > 0 ? Math.min(1, (a?.subs ?? 0) / agentBuckets) : 0,
    turnsPerPrompt: (a?.prompts ?? 0) > 0 ? (u?.turns ?? 0) / a!.prompts! : null,
    cacheHit: read > 0 ? (u?.read ?? 0) / read : null,
    sources: [...bySource]
      .filter(([, tokens]) => tokens > 0)
      .sort((x, y) => y[1] - x[1])
      .slice(0, 4)
      .map(([source, tokens]) => ({ source, share: tokens / total })),
  };
  const agentType = agentTypeOf({
    activeDays: days,
    activeHours: habits.activeHours,
    parallelism: habits.parallelism ?? 0,
    peakAgents: habits.peakAgents,
    subShare: habits.subShare,
    turnsPerPrompt: habits.turnsPerPrompt,
  });
  return { habits, agentType };
}

/** The latest world day with any usage, or null. */
export async function lastActiveOf(sql: Sql, userId: number): Promise<string | null> {
  return (
    (
      await one<{ day: string | null }>(
        sql,
        "SELECT MAX(day) AS day FROM usage_daily WHERE user_id = ?",
        userId,
      )
    )?.day ?? null
  );
}
