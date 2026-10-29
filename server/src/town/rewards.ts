import { all, type Sql } from "../actors/shared.ts";

/**
 * Records a once-only reward in `rewards` (namespace the item: `quest:<id>:<day>`, `badge:<id>`).
 * True only when the row is fresh, so the caller knows to pay out and notify.
 */
export async function grantOnce(sql: Sql, userId: number, item: string): Promise<boolean> {
  const fresh = await all(
    sql,
    "INSERT INTO rewards (user_id, item) VALUES (?, ?) ON CONFLICT DO NOTHING RETURNING item",
    userId,
    item,
  );
  return fresh.length > 0;
}
