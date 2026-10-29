import { type Edition, editionById } from "@tokenmaxxing/core/editions.ts";
import { cartOpen, lineup, weekOf } from "@tokenmaxxing/core/merchant.ts";
import { UserError } from "rivetkit";
import { all, type Sql, scalar } from "../actors/shared.ts";
import { addPurchase, giveItem, type Kept, type Wallet, wallet } from "./coins.ts";

/**
 * The traveling merchant's one table: a row per copy sold, stamped with its week and number. The
 * copy itself is an ordinary `items` row (`copy` is its id), so it trades, drops and is worn like
 * anything else, and its number goes with it. How many are left is a count of these rows.
 */
export async function migrateMerchant(sql: Sql): Promise<void> {
  await sql.execute(`CREATE TABLE IF NOT EXISTS editions (
    copy INTEGER PRIMARY KEY, week TEXT NOT NULL, item TEXT NOT NULL, n INTEGER NOT NULL,
    UNIQUE (week, item, n))`);
}

/** One edition on the cart and how many of its run are gone. */
export interface CartStock {
  id: string;
  sold: number;
  supply: number;
  price: number;
}

export interface Cart {
  open: boolean;
  /** The Monday of this week, which names the print runs. */
  week: string;
  /** Empty while the cart is away. */
  stock: CartStock[];
}

const soldOf = (sql: Sql, week: string, item: string): Promise<number> =>
  scalar(sql, "SELECT COUNT(*) AS n FROM editions WHERE week = ? AND item = ?", week, item);

export async function cart(sql: Sql, now: number): Promise<Cart> {
  const week = weekOf(now);
  if (!cartOpen(now)) return { open: false, week, stock: [] };
  const sold = new Map(
    (
      await all<{ item: string; n: number }>(
        sql,
        "SELECT item, COUNT(*) AS n FROM editions WHERE week = ? GROUP BY item",
        week,
      )
    ).map((r) => [r.item, r.n]),
  );
  const stock = lineup(week).map((e) => ({
    id: e.id,
    sold: sold.get(e.id) ?? 0,
    supply: e.supply,
    price: e.price,
  }));
  return { open: true, week, stock };
}

/**
 * Buys the next copy of `itemId` off the cart: it goes in the bag as the next number in this week's
 * run. Run it serialized with every other coin write, like `buy`, so two buyers can't take one number.
 */
export async function buyEdition(
  sql: Sql,
  userId: number,
  itemId: unknown,
  now: number,
  kept?: Kept,
): Promise<{ wallet: Wallet; n: number }> {
  if (!cartOpen(now))
    throw new UserError("The cart has moved on. It's back on Thursday.", { code: "closed" });
  const week = weekOf(now);
  const e: Edition | undefined = lineup(week).find((l) => l.id === itemId);
  if (!e) throw new UserError("The merchant isn't selling that this week.", { code: "not_found" });
  const sold = await soldOf(sql, week, e.id);
  if (sold >= e.supply) throw new UserError(`Sold out: all ${e.supply} are gone.`, { code: "sold_out" });
  if ((await wallet(sql, userId, now, kept)).balance < e.price)
    throw new UserError("Not enough coins yet.", { code: "too_poor" });
  // As `buy`: the copy first, then its number, then the price.
  const copy = await giveItem(sql, userId, e.id, now);
  await sql.execute(
    "INSERT INTO editions (copy, week, item, n) VALUES (?, ?, ?, ?)",
    copy,
    week,
    e.id,
    sold + 1,
  );
  await addPurchase(sql, userId, e.id, e.price, now);
  return { wallet: await wallet(sql, userId, now, kept), n: sold + 1 };
}

/** A numbered copy someone holds. */
export interface Copy {
  /** The copy's row in `items`: what `market.list` takes to put this very number on display. */
  id: number;
  item: string;
  week: string;
  n: number;
  supply: number;
}

/** The numbered copies in `userId`'s bag, lowest number first. */
export async function copiesOf(sql: Sql, userId: number): Promise<Copy[]> {
  const rows = await all<{ id: number; item: string; week: string; n: number }>(
    sql,
    `SELECT e.copy AS id, e.item, e.week, e.n FROM editions e JOIN items i ON i.id = e.copy
     WHERE i.owner_id = ? ORDER BY e.n, e.week`,
    userId,
  );
  return rows.map((r) => ({ ...r, supply: editionById(r.item)?.supply ?? 0 }));
}
