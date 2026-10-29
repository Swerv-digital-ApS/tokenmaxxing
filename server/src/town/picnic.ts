import { picnicReward, TOUCHED_GRASS } from "@tokenmaxxing/core/picnic.ts";
import { all, type Sql, scalar } from "../actors/shared.ts";
import { giveItem } from "./coins.ts";

/**
 * The "I was there" badge: a row in `rewards` per outage someone sat on a blanket for, so it comes
 * once per outage, and with it a patch of Touched grass in their bag. True the first time.
 */
export async function markPicnic(
  sql: Sql,
  userId: number,
  since: number,
  now = Date.now(),
): Promise<boolean> {
  const fresh = await all(
    sql,
    "INSERT INTO rewards (user_id, item) VALUES (?, ?) ON CONFLICT DO NOTHING RETURNING item",
    userId,
    picnicReward(since),
  );
  if (fresh.length === 0) return false;
  await giveItem(sql, userId, TOUCHED_GRASS, now);
  return true;
}

/** How many outage picnics someone was at, for their badge. */
export const picnicsOf = (sql: Sql, userId: number): Promise<number> =>
  scalar(sql, "SELECT COUNT(*) AS n FROM rewards WHERE user_id = ? AND item LIKE 'picnic:%'", userId);
