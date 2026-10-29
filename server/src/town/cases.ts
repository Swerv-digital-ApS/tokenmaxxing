import {
  type CaseDef,
  caseById,
  caseOfItem,
  nextDry,
  rollCase,
  VENDOR_COINS,
} from "@tokenmaxxing/core/cases.ts";
import { rarityOf } from "@tokenmaxxing/core/rarity.ts";
import { type Item, itemById } from "@tokenmaxxing/core/shop.ts";
import { UserError } from "rivetkit";
import { all, one, type Sql, type TxSql } from "../actors/shared.ts";
import { giveItem, type Kept, ledgerAdd, unwear, type Wallet, wallet } from "./coins.ts";

/** Openings in a row below rare, per player per case: what the guarantee counts (`rollCase`). */
export async function migrateCases(sql: Sql): Promise<void> {
  await sql.execute(`CREATE TABLE IF NOT EXISTS case_dry (
    user_id INTEGER NOT NULL, case_id TEXT NOT NULL, dry INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (user_id, case_id)) WITHOUT ROWID`);
}

/** A uniform number in [0, 1) with 53 random bits, from the system's secure source. */
export function secureRandom(): number {
  const [hi, lo] = crypto.getRandomValues(new Uint32Array(2)) as Uint32Array;
  return (hi! * 2 ** 21 + (lo! >>> 11)) / 2 ** 53;
}

/**
 * `userId` opens one `caseId`: the key's coins out, the roll, the item in the bag and the dry counter,
 * all in one transaction. Run it serialized, like `buy`. `rand` is the server's own; tests pass a seeded one.
 */
export async function openCase(
  sql: TxSql,
  userId: number,
  caseId: unknown,
  now: number,
  kept?: Kept,
  rand: () => number = secureRandom,
): Promise<{ item: Item; wallet: Wallet }> {
  const def = caseById(caseId);
  if (!def) throw new UserError("There's no such case.", { code: "not_found" });
  const won = await sql.transaction(async (tx) => {
    if ((await wallet(tx, userId, now, kept)).balance < def.keyPrice)
      throw new UserError(`A key is ${def.keyPrice} coins. Not enough coins yet.`, { code: "too_poor" });
    await tx.execute(
      "INSERT INTO case_dry (user_id, case_id) VALUES (?, ?) ON CONFLICT DO NOTHING",
      userId,
      def.id,
    );
    const dry = (await one<{ dry: number }>(
      tx,
      "SELECT dry FROM case_dry WHERE user_id = ? AND case_id = ?",
      userId,
      def.id,
    ))!.dry;
    const owned = new Set(
      (await all<{ item: string }>(tx, "SELECT DISTINCT item FROM items WHERE owner_id = ?", userId)).map(
        (r) => r.item,
      ),
    );
    const { item, tier } = rollCase(def, rand, owned, dry);
    await ledgerAdd(tx, userId, -def.keyPrice, "case", `case:${def.id}`, now);
    await giveItem(tx, userId, item.id, now);
    await tx.execute(
      "UPDATE case_dry SET dry = ? WHERE user_id = ? AND case_id = ?",
      nextDry(dry, tier),
      userId,
      def.id,
    );
    return item;
  });
  return { item: won, wallet: await wallet(sql, userId, now, kept) };
}

/** Takes one row of `itemId` out of `userId`'s bag; false if none. A worn one comes off with the last copy. */
async function takeOne(sql: Sql, userId: number, itemId: string): Promise<boolean> {
  const [row] = await all(
    sql,
    "DELETE FROM items WHERE id = (SELECT id FROM items WHERE owner_id = ? AND item = ? ORDER BY id DESC LIMIT 1) RETURNING id",
    userId,
    itemId,
  );
  return !!row;
}

/**
 * One case item to the vendor for `VENDOR_COINS` of its rarity. Only case items, only from the bag:
 * a piece standing in an office is on the floor, not in the bag. Returns the wallet and whether the
 * last copy was worn (so the look changed). Run it serialized, like `buy`.
 */
export async function sellItem(
  sql: TxSql,
  userId: number,
  itemId: unknown,
  now: number,
  kept?: Kept,
): Promise<{ wallet: Wallet; unworn: boolean }> {
  const item = itemById(itemId);
  if (!item?.case || !caseOfItem(item.id))
    throw new UserError("The vendor only buys case items.", { code: "not_sellable" });
  const coins = VENDOR_COINS[rarityOf(item)];
  const unworn = await sql.transaction(async (tx) => {
    if (!(await takeOne(tx, userId, item.id)))
      throw new UserError("You don't have one in your bag.", { code: "not_owned" });
    await ledgerAdd(tx, userId, coins, "vendor", `vendor:${item.id}`, now);
    return unwear(tx, userId, [item.id]);
  });
  return { wallet: await wallet(sql, userId, now, kept), unworn };
}

/** Every copy past the first of each item of `caseId`, sold. Returns the wallet and how many went. */
export async function sellDuplicates(
  sql: TxSql,
  userId: number,
  caseId: unknown,
  now: number,
  kept?: Kept,
): Promise<{ wallet: Wallet; sold: number }> {
  const def: CaseDef | undefined = caseById(caseId);
  if (!def) throw new UserError("There's no such case.", { code: "not_found" });
  const sold = await sql.transaction(async (tx) => {
    let n = 0;
    for (const item of def.items) {
      const have = (await one<{ n: number }>(
        tx,
        "SELECT COUNT(*) AS n FROM items WHERE owner_id = ? AND item = ?",
        userId,
        item.id,
      ))!.n;
      if (have < 2) continue;
      // Newest copies go; the first stays.
      await tx.execute(
        "DELETE FROM items WHERE id IN (SELECT id FROM items WHERE owner_id = ? AND item = ? ORDER BY id DESC LIMIT ?)",
        userId,
        item.id,
        have - 1,
      );
      await ledgerAdd(
        tx,
        userId,
        (have - 1) * VENDOR_COINS[rarityOf(item)],
        "vendor",
        `vendor:${item.id}`,
        now,
      );
      n += have - 1;
    }
    return n;
  });
  return { wallet: await wallet(sql, userId, now, kept), sold };
}
