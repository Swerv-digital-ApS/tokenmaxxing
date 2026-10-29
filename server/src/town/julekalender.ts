import { DOORS, doorDay, doorOn, type Gift, giftLabel } from "@tokenmaxxing/core/december.ts";
import { worldWall } from "@tokenmaxxing/core/range.ts";
import { UserError } from "rivetkit";
import { all, type Sql, type TxSql } from "../actors/shared.ts";
import { giveItem, type Kept, ledgerAdd, type Wallet, wallet } from "./coins.ts";

/**
 * The julekalender's one table: a row per door someone opened, keyed by who and the door's date, so each door
 * opens once per player per year, whatever restarts or double clicks. Its gift goes out in the same transaction
 * as the row: coins as a `ledger` line (kind `julekalender`, ref the date), an item as a bag row.
 */
export async function migrateJulekalender(sql: Sql): Promise<void> {
  await sql.execute(`CREATE TABLE IF NOT EXISTS julekalender (
    user_id INTEGER NOT NULL, day TEXT NOT NULL, at INTEGER NOT NULL,
    PRIMARY KEY (user_id, day)) WITHOUT ROWID`);
}

export interface Calendar {
  /** Today's door (1 to 24), or null outside 1 to 24 December. */
  today: number | null;
  /** The doors I've opened this December. */
  opened: number[];
}

export async function calendar(sql: Sql, userId: number, now: number): Promise<Calendar> {
  const rows = await all<{ day: string }>(
    sql,
    "SELECT day FROM julekalender WHERE user_id = ? AND day LIKE ?",
    userId,
    `${worldWall(now).y}-12-%`,
  );
  return { today: doorOn(now), opened: rows.map((r) => Number(r.day.slice(8))).sort((a, b) => a - b) };
}

/**
 * Opens today's door for `userId` and hands out its gift: once a door, only on its day. Run it serialized with
 * the other coin writes, like a buy.
 */
export async function openDoor(
  sql: TxSql,
  userId: number,
  now: number,
  kept?: Kept,
): Promise<{ door: number; gift: Gift; notice: string; wallet: Wallet }> {
  const door = doorOn(now);
  if (door === null)
    throw new UserError("The julekalender opens a door a day from 1 to 24 December.", { code: "closed" });
  const day = doorDay(door, now);
  const gift = DOORS[door - 1]!;
  const fresh = await sql.transaction(async (tx) => {
    const [row] = await all(
      tx,
      "INSERT INTO julekalender (user_id, day, at) VALUES (?, ?, ?) ON CONFLICT DO NOTHING RETURNING day",
      userId,
      day,
      now,
    );
    if (!row) return false;
    if ("coins" in gift) await ledgerAdd(tx, userId, gift.coins, "julekalender", day, now);
    else await giveItem(tx, userId, gift.item, now);
    return true;
  });
  if (!fresh)
    throw new UserError("Today's door is open already. The next one opens tomorrow.", { code: "opened" });
  return {
    door,
    gift,
    notice: `🎄 Door ${door}: ${giftLabel(gift)}${"item" in gift ? ", in your bag" : ""}.`,
    wallet: await wallet(sql, userId, now, kept),
  };
}
