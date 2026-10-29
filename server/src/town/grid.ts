import { GREEN_FROM, greenByDay, greenCoins, greenTokens, HOUR_MS } from "@tokenmaxxing/core/grid.ts";
import { all, type Sql } from "../actors/shared.ts";

/**
 * Green hours pay like the rest of the wallet (`coins.ts`): nothing but facts is stored. `green_hours`
 * has each world hour `world` said was green, written once and never taken back, and `activity_daily`'s
 * `hour_tokens` each day's tokens by world hour, from `player`. The bonus is worked out from the two
 * every time, so a late sync or an hour told late (the feed was down, `world` restarted) can only add to it.
 */
export async function migrateGrid(sql: Sql): Promise<void> {
  await sql.execute(`CREATE TABLE IF NOT EXISTS green_hours (
    day TEXT NOT NULL, hour INTEGER NOT NULL CHECK (hour >= 0 AND hour < 24),
    PRIMARY KEY (day, hour)) WITHOUT ROWID`);
  const activity = (await sql.execute("PRAGMA table_info(activity_daily)")) as { name: string }[];
  // 24 comma-separated token sums by world hour, minute-capped like `usage_daily`; empty before the day was re-reported.
  if (!activity.some((c) => c.name === "hour_tokens"))
    await sql.execute("ALTER TABLE activity_daily ADD COLUMN hour_tokens TEXT NOT NULL DEFAULT ''");
}

/**
 * Hours (their starts, in ms) `world` found green: each one from `GREEN_FROM` that has begun by `now`
 * goes in once. Returns how many were new.
 */
export async function recordGreen(sql: Sql, hours: readonly number[], now: number): Promise<number> {
  const due = hours.filter((h) => Number.isInteger(h) && h % HOUR_MS === 0 && h <= now);
  let fresh = 0;
  for (const [day, hs] of greenByDay(due)) {
    if (day < GREEN_FROM) continue;
    for (const h of hs)
      fresh += (
        await all(sql, "INSERT OR IGNORE INTO green_hours (day, hour) VALUES (?, ?) RETURNING day", day, h)
      ).length;
  }
  return fresh;
}

/** Every day's green world hours, from `from` on. */
async function greenDays(sql: Sql, from: string): Promise<Map<string, number[]>> {
  const out = new Map<string, number[]>();
  for (const r of await all<{ day: string; hour: number }>(
    sql,
    "SELECT day, hour FROM green_hours WHERE day >= ?",
    from,
  ))
    out.set(r.day, [...(out.get(r.day) ?? []), r.hour]);
  return out;
}

/**
 * What green hours paid each of `from`'s players (user id to their first paying day), by day. Only
 * days with a green hour are read. Never more tokens than the day had (`usage_daily`'s, `dayTokens`).
 */
export async function greenPay(
  sql: Sql,
  from: Record<number, string>,
  dayTokens?: (userId: number, day: string) => number,
): Promise<Map<number, Map<string, number>>> {
  const out = new Map<number, Map<string, number>>();
  const green = await greenDays(sql, GREEN_FROM);
  if (green.size === 0) return out;
  const rows = await all<{ userId: number; day: string; hours: string }>(
    sql,
    `SELECT user_id AS userId, a.day, hour_tokens AS hours
     FROM activity_daily a JOIN json_each(?) s ON user_id = CAST(s.key AS INTEGER) AND a.day >= s.value
     WHERE a.day >= ? AND hour_tokens != '' AND a.day IN (SELECT day FROM green_hours)`,
    JSON.stringify(from),
    GREEN_FROM,
  );
  for (const r of rows) {
    const tokens = greenTokens(r.hours, green.get(r.day) ?? []);
    const coins = greenCoins(Math.min(tokens, dayTokens?.(r.userId, r.day) ?? tokens));
    if (coins === 0) continue;
    out.set(r.userId, (out.get(r.userId) ?? new Map()).set(r.day, coins));
  }
  return out;
}
