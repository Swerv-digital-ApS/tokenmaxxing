import { announced, awardLine, type BadgeFacts, badgeStates } from "@tokenmaxxing/core/badges.ts";
import { awardRemark } from "@tokenmaxxing/core/barkeep.ts";
import { type CollectionState, titlesAt } from "@tokenmaxxing/core/collection.ts";
import { MILESTONES } from "@tokenmaxxing/core/milestones.ts";
import { all, one, type Sql } from "../actors/shared.ts";
import { badgeFactsOf } from "./boards.ts";
import type { Kept } from "./coins.ts";
import { userById } from "./users.ts";

/**
 * Badge tiers and milestone levels reached, with the real time (`at`). Badges themselves are worked
 * out on read (`badgeFactsOf`); this keeps only when each tier was first seen, for the Hall of Fame and
 * the log. `backfill`: found when the table was new (or on someone's first look), so it has no true
 * date and was never announced. `badge = 'level'` rows are milestone levels (`tier` is the level).
 */
export async function migrateAwards(sql: Sql): Promise<void> {
  await sql.execute(`CREATE TABLE IF NOT EXISTS badge_awards (
    user_id INTEGER NOT NULL, badge TEXT NOT NULL, tier INTEGER NOT NULL,
    at INTEGER NOT NULL, backfill INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (user_id, badge, tier)) WITHOUT ROWID`);
  await sql.execute("CREATE INDEX IF NOT EXISTS badge_awards_badge ON badge_awards (badge, tier)");
  await sql.execute("CREATE INDEX IF NOT EXISTS badge_awards_at ON badge_awards (at)");
}

/** A fresh award. `announce`: the line for the whole town (gold, diamond, level 30 and up), else null. */
export interface Award {
  userId: number;
  badge: string;
  tier: number;
  announce: string | null;
  /** What the barkeep says of it, when announced. */
  remark?: string;
}

/** The town hears of a milestone from here. */
export const ANNOUNCE_LEVEL = 30;
/** A sweep tells the town of at most this many awards for one person. */
const ANNOUNCE_MAX = 3;

/**
 * Writes every tier and milestone `userId` has reached that isn't recorded yet, and returns the new
 * ones. Silent (nothing to announce) when `backfill`, and for someone's very first rows: a new account
 * that syncs years of history would otherwise announce all of it.
 */
export async function awardSweep(
  sql: Sql,
  userId: number,
  now: number,
  kept: Pick<Kept, "top" | "raids">,
  opts: { backfill?: boolean; extra?: Partial<BadgeFacts> } = {},
): Promise<Award[]> {
  const { facts, level } = await badgeFactsOf(sql, userId, now, kept, undefined, opts.extra);
  const have = await all<{ badge: string; tier: number }>(
    sql,
    "SELECT badge, tier FROM badge_awards WHERE user_id = ?",
    userId,
  );
  const known = new Set(have.map((r) => `${r.badge} ${r.tier}`));
  const silent = opts.backfill || have.length === 0;
  const due: { badge: string; tier: number }[] = [];
  for (const b of badgeStates(facts))
    for (let tier = 1; tier <= b.tier; tier++)
      if (!known.has(`${b.id} ${tier}`)) due.push({ badge: b.id, tier });
  for (const m of MILESTONES)
    if (m.level <= level && !known.has(`level ${m.level}`)) due.push({ badge: "level", tier: m.level });
  const fresh: Award[] = [];
  for (const d of due) {
    const row = await one(
      sql,
      `INSERT INTO badge_awards (user_id, badge, tier, at, backfill) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT DO NOTHING RETURNING tier`,
      userId,
      d.badge,
      d.tier,
      now,
      +silent,
    );
    if (row) fresh.push({ userId, ...d, announce: null });
  }
  if (silent || fresh.length === 0) return fresh;
  const name = (await userById(sql, userId)).name;
  const lines = fresh.filter((a) =>
    a.badge === "level" ? a.tier >= ANNOUNCE_LEVEL : announced(a.badge, a.tier),
  );
  for (const a of lines.slice(0, ANNOUNCE_MAX)) {
    a.remark = awardRemark(name, a.badge, a.tier) ?? undefined;
    a.announce =
      a.badge === "level"
        ? `🏅 ${name} reached level ${a.tier}: ${MILESTONES.find((m) => m.level === a.tier)!.title}`
        : awardLine(name, a.badge, a.tier);
  }
  return fresh;
}

// MARK: Backfill

const MARKER = "badge_backfill";
/**
 * A second pass over everyone for tiers added since the first (longer ladders, new badges): the same silent
 * recording, kept apart so the Hall of Fame (`backfillDone`) isn't empty while it runs. Records are only
 * ever added, so running it again is safe; bump the key to run it for tiers added later.
 */
export const RECHECK = "badge_recheck_2";
/** Players one sweep backfills. */
export const BACKFILL_CHUNK = 100;

/** Whether every player's earned tiers are recorded (the Hall of Fame shows nothing before). */
export const backfillDone = async (sql: Sql, marker = MARKER): Promise<boolean> =>
  (await one<{ value: string }>(sql, "SELECT value FROM raid_meta WHERE key = ?", marker))?.value === "done";

/**
 * One chunk of the one-time silent backfill, in id order: the marker holds the last id done, then
 * "done". True once there's nothing left. A player it can't read is skipped, not retried: their next
 * sync records them (and, as a first look, silently).
 */
export async function backfillStep(
  sql: Sql,
  now: number,
  kept: Pick<Kept, "top" | "raids">,
  chunk = BACKFILL_CHUNK,
  marker = MARKER,
): Promise<boolean> {
  const cursor = Number(
    (await one<{ value: string }>(sql, "SELECT value FROM raid_meta WHERE key = ?", marker))?.value ?? 0,
  );
  if (Number.isNaN(cursor)) return true;
  const ids = await all<{ id: number }>(
    sql,
    "SELECT id FROM users WHERE id > ? ORDER BY id LIMIT ?",
    cursor,
    chunk,
  );
  for (const { id } of ids) {
    await awardSweep(sql, id, now, kept, { backfill: true }).catch((err) =>
      console.warn(`[awards] backfill ${id}: ${String(err)}`),
    );
  }
  const done = ids.length < chunk;
  await sql.execute(
    "INSERT INTO raid_meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    marker,
    done ? "done" : String(ids.at(-1)!.id),
  );
  return done;
}

// MARK: The sweep

/** The most people one sweep looks at (the sweep runs every 10 minutes). */
export const AWARD_BATCH = 10;
/** Nobody is looked at more often than this. */
export const AWARD_EVERY = 5 * 60_000;

/**
 * The town sweep's award step. Before the backfill is done it runs a chunk of it (and leaves the
 * dirty set alone: backfill would call a new tier old); after, it works through those who synced, each
 * at most every `AWARD_EVERY`, `AWARD_BATCH` at a time. Returns the fresh awards.
 */
export async function awardStep(
  sql: Sql,
  dirty: Set<number>,
  swept: Map<number, number>,
  now: number,
  kept: Pick<Kept, "top" | "raids">,
): Promise<{ awards: Award[]; backfilled: boolean }> {
  if (!(await backfillDone(sql))) {
    await backfillStep(sql, now, kept);
    return { awards: [], backfilled: true };
  }
  // Then the second pass for tiers added since: silent too, and the dirty set waits for it the same way.
  if (!(await backfillDone(sql, RECHECK))) {
    await backfillStep(sql, now, kept, BACKFILL_CHUNK, RECHECK);
    return { awards: [], backfilled: true };
  }
  const awards: Award[] = [];
  let n = 0;
  for (const id of [...dirty]) {
    if (n >= AWARD_BATCH) break;
    if (now - (swept.get(id) ?? 0) < AWARD_EVERY) continue;
    dirty.delete(id);
    swept.set(id, now);
    n++;
    try {
      awards.push(...(await awardSweep(sql, id, now, kept)));
    } catch (err) {
      console.warn(`[awards] ${id}: ${String(err)}`);
    }
  }
  // The map only needs the recent.
  if (swept.size > 1000) for (const [id, at] of swept) if (now - at >= AWARD_EVERY) swept.delete(id);
  return { awards, backfilled: false };
}

// MARK: The log

/** What `userId` has, compact: every badge's standing (with when its tier came), trophies and titles. */
export async function collectionOf(
  sql: Sql,
  userId: number,
  now: number,
  kept: Pick<Kept, "top" | "raids">,
  trophies: CollectionState["trophies"],
): Promise<CollectionState> {
  const { facts, level } = await badgeFactsOf(sql, userId, now, kept);
  const awards = await all<{ badge: string; tier: number; at: number; backfill: number }>(
    sql,
    "SELECT badge, tier, at, backfill FROM badge_awards WHERE user_id = ? AND badge != 'level'",
    userId,
  );
  return {
    userId,
    badges: badgeStates(facts).map((b) => ({
      id: b.id,
      tier: b.tier,
      value: b.value,
      at: awards.find((a) => a.badge === b.id && a.tier === b.tier && !a.backfill)?.at ?? null,
    })),
    trophies,
    titles: titlesAt(level),
  };
}
