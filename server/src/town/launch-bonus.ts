import { isModel, LAUNCH_COINS, modelKey } from "@tokenmaxxing/core/economy.ts";
import type { Launch } from "@tokenmaxxing/core/launch.ts";
import { dayKey } from "@tokenmaxxing/core/range.ts";
import { all, type Sql } from "../actors/shared.ts";
import { signupDays } from "./users.ts";

/**
 * The launches the town has seen, one row each: the world reads OpenRouter's list, the town keeps what it
 * saw. Anyone with tokens on a launched model on its launch day (a Copenhagen day, as usage is) is paid
 * `LAUNCH_COINS` for it, once. Like the rest of the wallet that's worked out, not stored: the rows only say
 * which launches there were, so the bonus can't pay twice, and a launch seen before this shipped has no row
 * and pays nothing.
 */
export async function migrateLaunchBonus(sql: Sql): Promise<void> {
  await sql.execute(`CREATE TABLE IF NOT EXISTS launch_bonus (
    id TEXT PRIMARY KEY, day TEXT NOT NULL, models TEXT NOT NULL, at INTEGER NOT NULL) WITHOUT ROWID`);
}

/** The models a launch covers: its lead and the ones that came out with it, as `modelKey`s. */
const keysOf = (l: Launch): string[] => [
  ...new Set([l.id, ...(l.also ?? []).map((a) => a.id)].filter(Boolean).map(modelKey)),
];

/** Writes the launches that aren't recorded yet (a forced one, with no id, isn't a launch). */
export async function recordLaunches(sql: Sql, launches: readonly Launch[]): Promise<void> {
  for (const l of launches) {
    if (!l.id) continue;
    await sql.execute(
      "INSERT INTO launch_bonus (id, day, models, at) VALUES (?, ?, ?, ?) ON CONFLICT DO NOTHING",
      l.id,
      dayKey(l.at),
      JSON.stringify(keysOf(l)),
      l.at,
    );
  }
}

export interface LaunchPaid {
  id: string;
  model: string;
  day: string;
  coins: number;
}

/**
 * The launch bonus per player: who had tokens on a launched model that day, from the day they signed up.
 * `userId` limits it to one player.
 */
async function paid(sql: Sql, userId?: number): Promise<Map<number, LaunchPaid[]>> {
  const out = new Map<number, LaunchPaid[]>();
  const signups = await signupDays(sql);
  const launches = await all<{ id: string; day: string; models: string }>(
    sql,
    "SELECT id, day, models FROM launch_bonus ORDER BY at",
  );
  for (const l of launches) {
    const keys = JSON.parse(l.models) as string[];
    const used = await all<{ userId: number; model: string }>(
      sql,
      `SELECT DISTINCT user_id AS userId, model FROM usage_daily
       WHERE day = ? AND input + output + cache_creation + cache_read > 0
       ${userId === undefined ? "" : "AND user_id = ?"}`,
      ...[l.day, ...(userId === undefined ? [] : [userId])],
    );
    const users = used.filter(
      (r) => l.day >= (signups[r.userId] ?? "9999") && keys.some((k) => isModel(r.model, k)),
    );
    for (const id of new Set(users.map((r) => r.userId)))
      out.set(id, [
        ...(out.get(id) ?? []),
        { id: l.id, model: keys[0] ?? l.id, day: l.day, coins: LAUNCH_COINS },
      ]);
  }
  return out;
}

/** What `userId` is paid for launches, with each launch for the wallet. */
export async function launchBonus(sql: Sql, userId: number): Promise<LaunchPaid[]> {
  return (await paid(sql, userId)).get(userId) ?? [];
}

/** Every player's launch bonus coins, for `balances`. */
export async function launchBonusAll(sql: Sql): Promise<Map<number, number>> {
  return new Map([...(await paid(sql))].map(([id, rows]) => [id, rows.length * LAUNCH_COINS]));
}
