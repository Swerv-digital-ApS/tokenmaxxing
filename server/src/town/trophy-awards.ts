import { trophyCoins } from "@tokenmaxxing/core/economy.ts";
import type { Trophy } from "@tokenmaxxing/core/trophies.ts";
import { all, one, type Sql } from "../actors/shared.ts";

/**
 * The trophies each player has earned, as the town saw them: they're worked out from a player's own events,
 * in their actor, so the town can't read them when it adds up a wallet. A sweep asks and writes them here
 * once each; the wallet pays from these rows (`trophyAwardCoins`), and a trophy lost to a later correction
 * of the events keeps its coins.
 */
export async function migrateTrophyAwards(sql: Sql): Promise<void> {
  await sql.execute(`CREATE TABLE IF NOT EXISTS trophy_awards (
    user_id INTEGER NOT NULL, trophy TEXT NOT NULL, day TEXT NOT NULL, at INTEGER NOT NULL,
    PRIMARY KEY (user_id, trophy)) WITHOUT ROWID`);
}

/** Writes the trophies `userId` has that aren't recorded yet, and returns their ids. */
export async function recordTrophies(
  sql: Sql,
  userId: number,
  trophies: readonly Trophy[],
  now: number,
): Promise<string[]> {
  const fresh: string[] = [];
  for (const t of trophies) {
    const row = await one(
      sql,
      `INSERT INTO trophy_awards (user_id, trophy, day, at) VALUES (?, ?, ?, ?)
       ON CONFLICT DO NOTHING RETURNING trophy`,
      userId,
      t.id,
      t.day,
      now,
    );
    if (row) fresh.push(t.id);
  }
  return fresh;
}

/** What `userId`'s recorded trophies pay. */
export async function trophyAwardCoins(sql: Sql, userId: number): Promise<number> {
  const rows = await all<{ trophy: string }>(
    sql,
    "SELECT trophy FROM trophy_awards WHERE user_id = ?",
    userId,
  );
  return trophyCoins(rows.map((r) => r.trophy));
}

/** Every player's recorded trophies' coins, for the admin page. */
export async function trophyAwardCoinsAll(sql: Sql): Promise<Map<number, number>> {
  const byUser = new Map<number, string[]>();
  for (const r of await all<{ userId: number; trophy: string }>(
    sql,
    "SELECT user_id AS userId, trophy FROM trophy_awards",
  ))
    byUser.set(r.userId, [...(byUser.get(r.userId) ?? []), r.trophy]);
  return new Map([...byUser].map(([id, ids]) => [id, trophyCoins(ids)]));
}

/** Ends in a number so the backfill runs over everyone again when trophies are added (recording is idempotent). */
const MARKER = "trophy_backfill_2";
/** Players one sweep reads trophies for in the one-time backfill (each wakes a player's actor). */
export const TROPHY_CHUNK = 10;
/** Players one sweep looks at after it, from those who synced. */
export const TROPHY_BATCH = 10;

/**
 * One step of the sweep: first the backfill, a chunk of players in id order (the marker holds the last id
 * done, then "done"), then those who synced since (`dirty`). `trophiesOf` asks a player's actor; one it
 * can't reach is skipped and tried again on their next sync. Returns the coins' worth of new trophies per player.
 */
export async function trophyStep(
  sql: Sql,
  dirty: Set<number>,
  now: number,
  trophiesOf: (userId: number) => Promise<Trophy[]>,
): Promise<Map<number, string[]>> {
  const out = new Map<number, string[]>();
  const look = async (id: number) => {
    try {
      const fresh = await recordTrophies(sql, id, await trophiesOf(id), now);
      if (fresh.length > 0) out.set(id, fresh);
    } catch (err) {
      console.warn(`[trophies] ${id}: ${String(err)}`);
    }
  };
  const marker = (await one<{ value: string }>(sql, "SELECT value FROM raid_meta WHERE key = ?", MARKER))
    ?.value;
  if (marker !== "done") {
    const ids = await all<{ id: number }>(
      sql,
      "SELECT id FROM users WHERE id > ? ORDER BY id LIMIT ?",
      Number(marker ?? 0),
      TROPHY_CHUNK,
    );
    for (const { id } of ids) await look(id);
    await sql.execute(
      "INSERT INTO raid_meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
      MARKER,
      ids.length < TROPHY_CHUNK ? "done" : String(ids.at(-1)!.id),
    );
    return out;
  }
  for (const id of [...dirty].slice(0, TROPHY_BATCH)) {
    dirty.delete(id);
    await look(id);
  }
  return out;
}
