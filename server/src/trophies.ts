import { dayKey } from "@tokenmaxxing/core/range.ts";
import { type Trophy, trophiesFor } from "@tokenmaxxing/core/trophies.ts";
import { chunkArray } from "hanzio";
import type { Sql, TxSql } from "./actors/shared.ts";

const HOUR_MS = 3_600_000;
/** Ids per step of the one-time backfill: each is a short range scan, so syncs go on in between. */
const BACKFILL_IDS = 2_000;
/** Hours worked out again per transaction. */
const HOURS_PER_TX = 24;
/** `usage_report_migrations` version: every hour of the history is in `trophy_hours`. */
const TROPHY_BACKFILL = 6;

/**
 * A player's events boiled down for trophies, kept in their database: tokens and prompts per hour
 * (`trophy_hours`) and their PRs (`trophy_prs`). Whatever changes events marks their hours in
 * `trophy_dirty`, and a look works out just those again, from the events: a look never reads the whole
 * history. Before, the totals were kept in memory and the first look after every restart read it all,
 * which for a big history held the player's lock past the 60 s action limit and stalled their syncs.
 */
/** In `migrateEvents`, after `events` and `usage_report_migrations`. */
export async function migrateTrophies(d: Sql): Promise<void> {
  await d.execute(`CREATE TABLE IF NOT EXISTS trophy_hours (
    hour INTEGER PRIMARY KEY,
    tokens INTEGER NOT NULL,
    prompts INTEGER NOT NULL,
    sources TEXT
  )`);
  await d.execute(
    "CREATE TABLE IF NOT EXISTS trophy_prs (hour INTEGER NOT NULL, at INTEGER NOT NULL, hash TEXT NOT NULL)",
  );
  await d.execute("CREATE INDEX IF NOT EXISTS trophy_prs_hour ON trophy_prs (hour)");
  await d.execute("CREATE TABLE IF NOT EXISTS trophy_dirty (hour INTEGER PRIMARY KEY)");
  await d.execute("CREATE TABLE IF NOT EXISTS trophy_backfill (last_id INTEGER NOT NULL)");
  // A new player has no history to fill in.
  await d.execute(
    "INSERT OR IGNORE INTO usage_report_migrations SELECT ? WHERE NOT EXISTS (SELECT 1 FROM events)",
    TROPHY_BACKFILL,
  );
}

/** Marks the hours of these event timestamps to be worked out again: in the transaction that changed them. */
export async function trophyHoursChanged(sql: Sql, timestamps: readonly number[]): Promise<void> {
  const hours = [...new Set(timestamps.map((t) => Math.floor(t / HOUR_MS)))];
  for (const chunk of chunkArray(hours, 500))
    await sql.execute(
      `INSERT OR IGNORE INTO trophy_dirty VALUES ${chunk.map(() => "(?)").join(",")}`,
      ...chunk,
    );
}

/** After a wipe: no events, so no trophies. */
export async function clearTrophies(sql: Sql): Promise<void> {
  await sql.execute("DELETE FROM trophy_hours");
  await sql.execute("DELETE FROM trophy_prs");
  await sql.execute("DELETE FROM trophy_dirty");
}

/** Works out up to `HOURS_PER_TX` marked hours again from the events; false once none are marked. */
async function settleBatch(sql: TxSql): Promise<boolean> {
  return sql.transaction(
    async (tx) => {
      const rows = (await tx.execute("SELECT hour FROM trophy_dirty LIMIT ?", HOURS_PER_TX)) as {
        hour: number;
      }[];
      for (const { hour } of rows) {
        // By `timestamp`, on its index: only that hour's events are read.
        const from = hour * HOUR_MS;
        const to = from + HOUR_MS;
        await tx.execute("DELETE FROM trophy_hours WHERE hour = ?", hour);
        await tx.execute(
          `INSERT INTO trophy_hours
           SELECT ?, SUM(CASE WHEN message_type = 'assistant'
                     THEN input_tokens + output_tokens + cache_creation_tokens + cache_read_tokens ELSE 0 END),
                  SUM(message_type = 'user'),
                  GROUP_CONCAT(DISTINCT CASE WHEN message_type = 'assistant'
                     AND input_tokens + output_tokens + cache_creation_tokens + cache_read_tokens > 0
                     THEN source END)
           FROM events WHERE timestamp >= ? AND timestamp < ? GROUP BY timestamp / ${HOUR_MS}`,
          hour,
          from,
          to,
        );
        await tx.execute("DELETE FROM trophy_prs WHERE hour = ?", hour);
        await tx.execute(
          `INSERT INTO trophy_prs SELECT ?, timestamp, message_id FROM events
           WHERE timestamp >= ? AND timestamp < ? AND message_type = 'pr'`,
          hour,
          from,
          to,
        );
        await tx.execute("DELETE FROM trophy_dirty WHERE hour = ?", hour);
      }
      return rows.length > 0;
    },
    { name: "trophy-hours" },
  );
}

/**
 * Fills `trophy_hours` from a history kept before it, once, in the player's `run`: marks every hour
 * with events, a range of ids at a time, then works them out a batch at a time. `lock` is the one
 * `trophiesOf` runs under. Picks up where it stopped.
 */
export async function backfillTrophies(
  sql: TxSql,
  lock: <T>(fn: () => Promise<T>) => Promise<T>,
  signal?: AbortSignal,
): Promise<void> {
  if (await trophiesReady(sql)) return;
  const [{ last } = { last: 0 }] = (await sql.execute("SELECT last_id AS last FROM trophy_backfill")) as {
    last: number;
  }[];
  const [{ max } = { max: 0 }] = (await sql.execute("SELECT COALESCE(MAX(id), 0) AS max FROM events")) as {
    max: number;
  }[];
  for (let from = last; from < max; from += BACKFILL_IDS) {
    signal?.throwIfAborted();
    const to = from + BACKFILL_IDS;
    await sql.execute(
      `INSERT OR IGNORE INTO trophy_dirty SELECT DISTINCT timestamp / ${HOUR_MS} FROM events WHERE id > ? AND id <= ?`,
      from,
      to,
    );
    await sql.execute("DELETE FROM trophy_backfill");
    await sql.execute("INSERT INTO trophy_backfill VALUES (?)", to);
  }
  while (await lock(() => settleBatch(sql))) signal?.throwIfAborted();
  await sql.execute("INSERT OR IGNORE INTO usage_report_migrations VALUES (?)", TROPHY_BACKFILL);
}

const trophiesReady = async (sql: Sql) =>
  (await sql.execute("SELECT 1 FROM usage_report_migrations WHERE version = ?", TROPHY_BACKFILL)).length > 0;

/**
 * The trophies a player has earned, from their own events. Throws while the one-time backfill is still
 * going: no trophies is a different answer from not knowing yet (a shelf would lose its pins).
 */
export async function trophiesOf(sql: TxSql, now: number): Promise<Trophy[]> {
  if (!(await trophiesReady(sql))) throw new Error("trophies are still being counted");
  while (await settleBatch(sql));
  const hours = (await sql.execute("SELECT hour, tokens, prompts, sources FROM trophy_hours")) as {
    hour: number;
    tokens: number;
    prompts: number;
    sources: string | null;
  }[];
  const prs = (await sql.execute("SELECT at, hash FROM trophy_prs")) as { at: number; hash: string }[];
  return trophiesFor({
    hours: hours.map((r) => ({
      hour: r.hour * HOUR_MS,
      tokens: r.tokens,
      prompts: r.prompts,
      sources: r.sources?.split(",") ?? [],
    })),
    prs,
    today: dayKey(now),
  });
}
