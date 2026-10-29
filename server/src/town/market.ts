import { editionById } from "@tokenmaxxing/core/editions.ts";
import {
  type Listing,
  listable,
  listingAllowance,
  MARKET_BUYER_AGE,
  MARKET_DAY_BUY,
  MARKET_LEVEL,
  MARKET_PAIR_BUY,
  MARKET_TTL,
  type MyMarket,
  parsePrice,
  parseSlot,
  priceCap,
  type Sale,
} from "@tokenmaxxing/core/market.ts";
import { itemById } from "@tokenmaxxing/core/shop.ts";
import { UserError } from "rivetkit";
import { all, one, type Sql, scalar, type TxSql } from "../actors/shared.ts";
import { type Kept, ledgerAdd, unwear, type Wallet, wallet } from "./coins.ts";
import { levelOf } from "./users.ts";

/**
 * Torvehallen's two tables. A listing is one thing on one display slot; the item itself is an ordinary
 * `items` row (`item_row`) that is out of every bag while it's listed: `owner_id` NULL and nothing else set,
 * so no query by owner, floor, drop count or company sees it (`pickUp` checks for it all the same). It goes
 * to the buyer, or back to the seller when the listing is taken down, and a numbered edition's number goes
 * with the row. `id` never repeats, so a buyer who saw one listing can't buy the next one in its slot.
 * A sale is kept as the seller's log (`seen`: they've been told) and as the buyer's spending, for the caps.
 */
export async function migrateMarket(sql: Sql): Promise<void> {
  await sql.execute(`CREATE TABLE IF NOT EXISTS market_listings (
    id INTEGER PRIMARY KEY AUTOINCREMENT, slot INTEGER NOT NULL UNIQUE, seller_id INTEGER NOT NULL,
    item_row INTEGER NOT NULL UNIQUE, item TEXT NOT NULL, price INTEGER NOT NULL,
    at INTEGER NOT NULL, expires_at INTEGER NOT NULL)`);
  await sql.execute("CREATE INDEX IF NOT EXISTS market_listings_seller ON market_listings (seller_id)");
  await sql.execute(`CREATE TABLE IF NOT EXISTS market_sales (
    id INTEGER PRIMARY KEY AUTOINCREMENT, listing_id INTEGER NOT NULL, seller_id INTEGER NOT NULL,
    buyer_id INTEGER NOT NULL, item TEXT NOT NULL, item_row INTEGER NOT NULL, price INTEGER NOT NULL,
    at INTEGER NOT NULL, seen INTEGER NOT NULL DEFAULT 0)`);
  await sql.execute("CREATE INDEX IF NOT EXISTS market_sales_seller ON market_sales (seller_id, seen)");
  await sql.execute("CREATE INDEX IF NOT EXISTS market_sales_buyer ON market_sales (buyer_id, at)");
}

interface Row {
  id: number;
  sellerId: number;
  itemRow: number;
  price: number;
  expiresAt: number;
}

const ROW = `id, seller_id AS sellerId, item_row AS itemRow, price, expires_at AS expiresAt`;

/** What a listing shows: its slot, item and price, who sells it and, for a numbered edition, which copy. */
const LISTING = `SELECT l.id, l.slot, l.item, l.price, l.seller_id AS sellerId, u.name AS seller,
    l.expires_at AS expiresAt, e.n AS n
  FROM market_listings l JOIN users u ON u.id = l.seller_id LEFT JOIN editions e ON e.copy = l.item_row`;

type ListingRow = Omit<Listing, "edition"> & { n: number | null };

const shown = (r: ListingRow): Listing => {
  const { n, ...rest } = r;
  return { ...rest, edition: n === null ? null : { n, supply: editionById(r.item)?.supply ?? 0 } };
};

/** Everything on display now, by slot. Call `expire` first if a listing past its time mustn't show. */
export async function browse(sql: Sql, now: number): Promise<Listing[]> {
  return (await all<ListingRow>(sql, `${LISTING} WHERE l.expires_at > ? ORDER BY l.slot`, now)).map(shown);
}

/**
 * A listing's item back to its seller's bag and the listing gone. A seller who has been deleted since
 * (`deleteUser`) has no bag: the row goes with them.
 */
async function takeDown(sql: Sql, l: Pick<Row, "id" | "sellerId" | "itemRow">): Promise<void> {
  await sql.execute("DELETE FROM market_listings WHERE id = ?", l.id);
  const back = await all(
    sql,
    `UPDATE items SET owner_id = ? WHERE id = ? AND owner_id IS NULL AND ? IN (SELECT id FROM users)
     RETURNING id`,
    l.sellerId,
    l.itemRow,
    l.sellerId,
  );
  if (back.length === 0)
    await sql.execute(
      `DELETE FROM items WHERE id = ? AND owner_id IS NULL AND dropped_by IS NULL AND room IS NULL
         AND company_id IS NULL`,
      l.itemRow,
    );
}

/** Takes down every listing past its time. Returns the sellers who got an item back. */
export async function expire(sql: TxSql, now: number): Promise<number[]> {
  const old = await all<Row>(sql, `SELECT ${ROW} FROM market_listings WHERE expires_at <= ?`, now);
  if (old.length === 0) return [];
  await sql.transaction(async (tx) => {
    for (const l of old) await takeDown(tx, l);
  });
  return [...new Set(old.map((l) => l.sellerId))];
}

/**
 * Puts one `item` from `userId`'s bag on `slot` at `price`: its newest copy, or `copy` (an `items` id,
 * for a numbered edition). They need the level, room in their allowance and a free slot. Worn, the last
 * copy comes off (`unworn`). Run it serialized, like `buy`.
 */
export async function list(
  sql: TxSql,
  userId: number,
  want: { item: unknown; slot: unknown; price: unknown; copy?: unknown },
  now: number,
): Promise<{ listing: Listing; unworn: boolean }> {
  const item = itemById(want.item);
  if (!item || !listable(item.id))
    throw new UserError("That can't go on display.", { code: "not_tradeable" });
  const price = parsePrice(want.price, item.id);
  if (price === null)
    throw new UserError(`Price it between 🪙 1 and ${priceCap(item.id)}.`, { code: "bad_price" });
  const slot = parseSlot(want.slot);
  if (slot === null) throw new UserError("Pick a place in the hall.", { code: "bad_request" });
  if (want.copy !== undefined && !Number.isInteger(want.copy))
    throw new UserError("Pick a copy.", { code: "bad_request" });
  await expire(sql, now);
  return sql.transaction(async (tx) => {
    const level = await levelOf(tx, userId);
    if (level < MARKET_LEVEL)
      throw new UserError(`You can put things on display from level ${MARKET_LEVEL}.`, { code: "level" });
    const up = await scalar(tx, "SELECT COUNT(*) AS n FROM market_listings WHERE seller_id = ?", userId);
    if (up >= listingAllowance(level))
      throw new UserError(`You have ${up} things on display, as many as your level allows.`, {
        code: "too_many",
      });
    if (await one(tx, "SELECT 1 FROM market_listings WHERE slot = ?", slot))
      throw new UserError("Someone just took that spot.", { code: "slot_taken" });
    const row =
      want.copy === undefined
        ? await one<{ id: number }>(
            tx,
            "SELECT id FROM items WHERE owner_id = ? AND item = ? ORDER BY id DESC LIMIT 1",
            userId,
            item.id,
          )
        : await one<{ id: number }>(
            tx,
            "SELECT id FROM items WHERE id = ? AND owner_id = ? AND item = ?",
            want.copy,
            userId,
            item.id,
          );
    if (!row) throw new UserError("You don't have that in your bag.", { code: "not_owned" });
    const out = await all(
      tx,
      "UPDATE items SET owner_id = NULL WHERE id = ? AND owner_id = ? RETURNING id",
      row.id,
      userId,
    );
    if (out.length === 0) throw new UserError("You don't have that in your bag.", { code: "not_owned" });
    const made = await one<{ id: number }>(
      tx,
      `INSERT INTO market_listings (slot, seller_id, item_row, item, price, at, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id`,
      slot,
      userId,
      row.id,
      item.id,
      price,
      now,
      now + MARKET_TTL,
    );
    const listing = shown((await one<ListingRow>(tx, `${LISTING} WHERE l.id = ?`, made!.id))!);
    return { listing, unworn: await unwear(tx, userId, [item.id]) };
  });
}

/** Takes `userId`'s own listing down: the item is back in their bag. */
export async function cancel(sql: TxSql, userId: number, listingId: unknown): Promise<void> {
  await sql.transaction(async (tx) => {
    const l = await one<Row>(
      tx,
      `SELECT ${ROW} FROM market_listings WHERE id = ? AND seller_id = ?`,
      listingId,
      userId,
    );
    if (!l) throw new UserError("That isn't on display any more.", { code: "not_found" });
    await takeDown(tx, l);
  });
}

/** What a buyer has spent in the hall since `since`: on `sellerId` alone, or on anyone. */
const spent = (sql: Sql, buyerId: number, since: number, sellerId?: number): Promise<number> =>
  scalar(
    sql,
    `SELECT COALESCE(SUM(price), 0) AS n FROM market_sales
     WHERE buyer_id = ? AND at > ? AND (? IS NULL OR seller_id = ?)`,
    buyerId,
    since,
    sellerId ?? null,
    sellerId ?? null,
  );

/**
 * `buyerId` buys listing `listingId`, which they saw at `price`, in one go: the coins from their wallet
 * to the seller's whole (kind `market`, one ref that sums to zero), the item to their bag, the sale in
 * the log. Refused if it's gone, theirs, dearer than they saw, if they're a new account, would pass the
 * caps (`MARKET_DAY_BUY`, `MARKET_PAIR_BUY`) or can't cover it. Run it serialized, like `buy`.
 */
export async function buy(
  sql: TxSql,
  buyerId: number,
  listingId: unknown,
  price: unknown,
  now: number,
  kept?: Kept,
  minAge = MARKET_BUYER_AGE,
): Promise<{ wallet: Wallet; sale: Sale; sellerId: number }> {
  await expire(sql, now);
  const sale = await sql.transaction(async (tx) => {
    const l = await one<Row & { item: string }>(
      tx,
      `SELECT ${ROW}, item FROM market_listings WHERE id = ? AND expires_at > ?`,
      listingId,
      now,
    );
    if (!l) throw new UserError("Someone bought that, or it came down.", { code: "gone" });
    if (l.price !== price)
      throw new UserError("The price changed. Have another look.", { code: "price_changed" });
    if (l.sellerId === buyerId)
      throw new UserError("That's yours. Take it back instead.", { code: "own_listing" });
    const me = await one<{ name: string; createdAt: number }>(
      tx,
      "SELECT name, created_at AS createdAt FROM users WHERE id = ?",
      buyerId,
    );
    if (!me) throw new UserError("Unknown player.", { code: "not_found" });
    if (now - me.createdAt < minAge)
      throw new UserError("New accounts can buy in the hall from their third day.", { code: "too_new" });
    if ((await spent(tx, buyerId, now - 24 * 3_600_000)) + l.price > MARKET_DAY_BUY)
      throw new UserError("That's a lot for one day in the hall. Come back tomorrow.", { code: "buy_cap" });
    if ((await spent(tx, buyerId, now - 7 * 24 * 3_600_000, l.sellerId)) + l.price > MARKET_PAIR_BUY)
      throw new UserError("You've bought a lot from them this week. Give it a few days.", {
        code: "pair_cap",
      });
    if ((await wallet(tx, buyerId, now, kept)).balance < l.price)
      throw new UserError("Not enough coins yet.", { code: "too_poor" });
    // The claim: whoever deletes the row is the buyer, so a second buy, or a take-down, finds it gone.
    if ((await all(tx, "DELETE FROM market_listings WHERE id = ? RETURNING id", l.id)).length === 0)
      throw new UserError("Someone bought that, or it came down.", { code: "gone" });
    const ref = `market:${l.id}`;
    await ledgerAdd(tx, buyerId, -l.price, "market", ref, now);
    await ledgerAdd(tx, l.sellerId, l.price, "market", ref, now);
    const moved = await all(
      tx,
      "UPDATE items SET owner_id = ? WHERE id = ? AND owner_id IS NULL RETURNING id",
      buyerId,
      l.itemRow,
    );
    if (moved.length === 0) throw new UserError("Someone bought that, or it came down.", { code: "gone" });
    const made = await one<{ id: number }>(
      tx,
      `INSERT INTO market_sales (listing_id, seller_id, buyer_id, item, item_row, price, at)
       VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id`,
      l.id,
      l.sellerId,
      buyerId,
      l.item,
      l.itemRow,
      l.price,
      now,
    );
    return { id: made!.id, item: l.item, price: l.price, buyer: me.name, at: now, sellerId: l.sellerId };
  });
  const { sellerId, ...log } = sale;
  return { wallet: await wallet(sql, buyerId, now, kept), sale: log, sellerId };
}

/** What `userId` has on display, their room left, and the sales they haven't been told of. */
export async function mine(sql: Sql, userId: number, now: number): Promise<MyMarket> {
  const listings = (
    await all<ListingRow>(
      sql,
      `${LISTING} WHERE l.seller_id = ? AND l.expires_at > ? ORDER BY l.slot`,
      userId,
      now,
    )
  ).map(shown);
  const allowance = listingAllowance(await levelOf(sql, userId));
  const sold = await all<Sale>(
    sql,
    `SELECT s.id, s.item, s.price, COALESCE(u.name, 'someone') AS buyer, s.at
     FROM market_sales s LEFT JOIN users u ON u.id = s.buyer_id
     WHERE s.seller_id = ? AND s.seen = 0 ORDER BY s.id`,
    userId,
  );
  return { listings, allowance, room: Math.max(0, allowance - listings.length), sold };
}

/** The seller has been told of their sales up to `upTo` (a `Sale.id`). */
export async function sawSales(sql: Sql, userId: number, upTo: unknown): Promise<void> {
  if (!Number.isInteger(upTo)) throw new UserError("Bad request.", { code: "bad_request" });
  await sql.execute("UPDATE market_sales SET seen = 1 WHERE seller_id = ? AND id <= ?", userId, upTo);
}

/** Takes down everything `userId` has on display, for an account that's going. */
export async function forget(sql: Sql, userId: number): Promise<void> {
  for (const l of await all<Row>(sql, `SELECT ${ROW} FROM market_listings WHERE seller_id = ?`, userId))
    await takeDown(sql, l);
}
