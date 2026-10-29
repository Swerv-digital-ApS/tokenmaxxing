import { beforeEach, describe, expect, test } from "bun:test";
import {
  listingAllowance,
  MARKET_DAY_BUY,
  MARKET_PAIR_BUY,
  MARKET_PRICE_CAP,
  MARKET_SLOTS,
  MARKET_TTL,
  parsePrice,
} from "@tokenmaxxing/core/market.ts";
import { lineup, weekOf } from "@tokenmaxxing/core/merchant.ts";
import { defaultLook } from "@tokenmaxxing/core/world.ts";
import type { TxSql } from "../src/actors/shared.ts";
import { deleteUser } from "../src/town/admin.ts";
import {
  bag,
  floors,
  giveItem,
  pickUp,
  settleTrade,
  type Trade,
  takeOut,
  unclaimed,
  wallet,
} from "../src/town/coins.ts";
import { browse, buy, cancel, expire, list, mine, sawSales } from "../src/town/market.ts";
import { buyEdition, copiesOf } from "../src/town/merchant.ts";
import { migrate } from "../src/town/schema.ts";
import { memorySql } from "./memory-sql.ts";

let sql: TxSql;
/** Saturday 24 October 2026, noon in Copenhagen: the merchant's cart is in. */
const NOW = Date.UTC(2026, 9, 24, 10);
const DAY = 86_400_000;
/** Beanie: a common hat (cap 150). Dragon: a legendary pet (cap 6,000). Top hat: a level reward, never for sale. */
const BEANIE = "hat.1";
const DRAGON = "pet.4";
const TOP_HAT = "hat.4";

/** Lifetime tokens that reach a level: the level a seller needs, and how many things it lets them show. */
const LEVEL = { 9: 6e9, 10: 1e10, 25: 25e9, 40: 55e9 } as const;

async function user(id: number, name: string, tokens = 0, age = 30 * DAY) {
  await sql.execute(
    "INSERT INTO users (id, name, look, created_at) VALUES (?, ?, '{}', ?)",
    id,
    name,
    NOW - age,
  );
  if (tokens > 0)
    await sql.execute(
      "INSERT INTO usage_daily (user_id, day, model, input, output, cache_creation, cache_read, turns) VALUES (?, '2026-01-02', 'm', ?, 0, 0, 0, 1)",
      id,
      tokens,
    );
}

/** `coins` more in a wallet, from outside (the admin's kind), so what a sale does shows against it. */
const gift = (userId: number, coins: number) =>
  sql.execute(
    "INSERT INTO ledger (user_id, amount, kind, ref, at) VALUES (?, ?, 'admin', 'gift', ?)",
    userId,
    coins,
    NOW,
  );
const balance = async (userId: number, now = NOW) => (await wallet(sql, userId, now)).balance;
const refSum = async (ref: string) =>
  (
    (await sql.execute("SELECT COALESCE(SUM(amount), 0) AS n FROM ledger WHERE ref = ?", ref)) as [
      { n: number },
    ]
  )[0].n;
const held = async (userId: number, item: string) =>
  (await bag(sql, userId)).find((r) => r.item === item)?.count ?? 0;

beforeEach(async () => {
  sql = memorySql().sql;
  await migrate(sql);
  await user(1, "ada", LEVEL[10]);
  await user(2, "bo");
  await gift(2, 20_000);
});

describe("putting something on display", () => {
  test("takes it out of the bag, shows it at the slot with its price, and no other way reaches it", async () => {
    const row = await giveItem(sql, 1, BEANIE, NOW);
    const { listing } = await list(sql, 1, { item: BEANIE, slot: 7, price: 90 }, NOW);
    expect(listing).toMatchObject({ slot: 7, item: BEANIE, price: 90, seller: "ada", edition: null });
    expect(listing.expiresAt).toBe(NOW + MARKET_TTL);
    expect(await held(1, BEANIE)).toBe(0);
    expect(await browse(sql, NOW)).toEqual([listing]);
    // Escrowed, it is not in a bag, on a floor or up for the sweeper, and none of the routes out finds it.
    await expect(takeOut(sql, 1, BEANIE, NOW)).rejects.toMatchObject({ code: "not_owned" });
    const t: Trade = {
      fromId: 1,
      from: "ada",
      toId: 2,
      to: "bo",
      give: { coins: 0, items: [BEANIE] },
      want: { coins: 0, items: [] },
      at: NOW,
    };
    await sql.execute(
      "INSERT INTO trades (from_id, to_id, give, want, at) VALUES (1, 2, ?, ?, ?)",
      JSON.stringify(t.give),
      JSON.stringify(t.want),
      NOW,
    );
    await expect(settleTrade(sql, t, NOW)).rejects.toMatchObject({ code: "not_owned" });
    expect(await pickUp(sql, row, 2, "town")).toBe(false);
    expect(await unclaimed(sql, NOW + 365 * DAY)).toEqual([]);
    expect(await floors(sql)).toEqual([]);
    expect(await held(2, BEANIE)).toBe(0);
  });

  test("a numbered edition goes by its copy, and the number goes with it", async () => {
    const e = lineup(weekOf(NOW))[0]!;
    await gift(1, 5000);
    const first = (await buyEdition(sql, 1, e.id, NOW)).n;
    await buyEdition(sql, 1, e.id, NOW);
    const [low] = (await sql.execute("SELECT copy FROM editions WHERE n = ? AND item = ?", first, e.id)) as [
      { copy: number },
    ];
    const { listing } = await list(sql, 1, { item: e.id, slot: 0, price: 50, copy: low.copy }, NOW);
    expect(listing.edition).toEqual({ n: 1, supply: e.supply });
    await buy(sql, 2, listing.id, 50, NOW);
    expect((await copiesOf(sql, 2)).map((c) => c.n)).toEqual([1]);
    expect((await copiesOf(sql, 1)).map((c) => c.n)).toEqual([2]);
  });

  test("a copy that isn't yours, or isn't that kind, can't be listed", async () => {
    const theirs = await giveItem(sql, 2, BEANIE, NOW);
    await giveItem(sql, 1, DRAGON, NOW);
    await expect(list(sql, 1, { item: BEANIE, slot: 0, price: 10, copy: theirs }, NOW)).rejects.toMatchObject(
      { code: "not_owned" },
    );
    await expect(list(sql, 1, { item: BEANIE, slot: 0, price: 10, copy: 1 }, NOW)).rejects.toMatchObject({
      code: "not_owned",
    });
    expect(await held(2, BEANIE)).toBe(1);
  });

  test("is refused for what can't be sold, a bad price, a bad slot, and below the level", async () => {
    await giveItem(sql, 1, BEANIE, NOW);
    await giveItem(sql, 1, TOP_HAT, NOW);
    const bad = (over: object) => list(sql, 1, { item: BEANIE, slot: 0, price: 10, ...over }, NOW);
    await expect(bad({ item: TOP_HAT })).rejects.toMatchObject({ code: "not_tradeable" });
    await expect(bad({ item: "nonsense" })).rejects.toMatchObject({ code: "not_tradeable" });
    for (const price of [0, -5, 1.5, "10", null, MARKET_PRICE_CAP.common + 1])
      await expect(bad({ price })).rejects.toMatchObject({ code: "bad_price" });
    for (const slot of [-1, MARKET_SLOTS, 1.5, "0", null])
      await expect(bad({ slot })).rejects.toMatchObject({ code: "bad_request" });
    await user(3, "cy", LEVEL[9]);
    await giveItem(sql, 3, BEANIE, NOW);
    await expect(list(sql, 3, { item: BEANIE, slot: 0, price: 10 }, NOW)).rejects.toMatchObject({
      code: "level",
    });
    expect(await held(1, BEANIE)).toBe(1);
    expect(await held(3, BEANIE)).toBe(1);
    expect(await browse(sql, NOW)).toEqual([]);
  });

  test("prices run from 1 to the cap of the item's rarity", () => {
    expect(parsePrice(1, BEANIE)).toBe(1);
    expect(parsePrice(MARKET_PRICE_CAP.common, BEANIE)).toBe(MARKET_PRICE_CAP.common);
    expect(parsePrice(MARKET_PRICE_CAP.common + 1, BEANIE)).toBeNull();
    expect(parsePrice(MARKET_PRICE_CAP.legendary, DRAGON)).toBe(MARKET_PRICE_CAP.legendary);
    expect(parsePrice(5, TOP_HAT)).toBeNull();
  });

  test("a slot holds one thing, and your level says how many things you can show", async () => {
    for (let i = 0; i < 4; i++) await giveItem(sql, 1, BEANIE, NOW);
    expect(listingAllowance(10)).toBe(3);
    await list(sql, 1, { item: BEANIE, slot: 0, price: 10 }, NOW);
    await user(3, "cy", LEVEL[25]);
    await giveItem(sql, 3, BEANIE, NOW);
    await expect(list(sql, 3, { item: BEANIE, slot: 0, price: 10 }, NOW)).rejects.toMatchObject({
      code: "slot_taken",
    });
    await list(sql, 1, { item: BEANIE, slot: 1, price: 10 }, NOW);
    await list(sql, 1, { item: BEANIE, slot: 2, price: 10 }, NOW);
    await expect(list(sql, 1, { item: BEANIE, slot: 3, price: 10 }, NOW)).rejects.toMatchObject({
      code: "too_many",
    });
    expect(await held(1, BEANIE)).toBe(1);
    expect(await mine(sql, 1, NOW)).toMatchObject({ allowance: 3, room: 0 });
    // Level 25 shows six.
    for (let i = 0; i < 6; i++) await giveItem(sql, 3, BEANIE, NOW);
    for (let slot = 10; slot < 16; slot++) await list(sql, 3, { item: BEANIE, slot, price: 10 }, NOW);
    expect((await mine(sql, 3, NOW)).listings).toHaveLength(6);
    await expect(list(sql, 3, { item: BEANIE, slot: 16, price: 10 }, NOW)).rejects.toMatchObject({
      code: "too_many",
    });
    await user(4, "dee", LEVEL[40]);
    expect((await mine(sql, 4, NOW)).allowance).toBe(10);
  });

  test("a worn item comes off when its last copy goes on display", async () => {
    await giveItem(sql, 1, BEANIE, NOW);
    await sql.execute(
      "UPDATE users SET look = ? WHERE id = 1",
      JSON.stringify({ ...defaultLook(1), hat: 1 }),
    );
    const { unworn } = await list(sql, 1, { item: BEANIE, slot: 0, price: 10 }, NOW);
    expect(unworn).toBe(true);
    const [{ look }] = (await sql.execute("SELECT look FROM users WHERE id = 1")) as [{ look: string }];
    expect(JSON.parse(look).hat).toBe(0);
  });
});

describe("taking it back", () => {
  test("cancelling puts the item back in the bag and frees the slot", async () => {
    await giveItem(sql, 1, BEANIE, NOW);
    const { listing } = await list(sql, 1, { item: BEANIE, slot: 4, price: 10 }, NOW);
    await expect(cancel(sql, 2, listing.id)).rejects.toMatchObject({ code: "not_found" });
    expect(await browse(sql, NOW)).toHaveLength(1);
    await cancel(sql, 1, listing.id);
    expect(await held(1, BEANIE)).toBe(1);
    expect(await browse(sql, NOW)).toEqual([]);
    await expect(cancel(sql, 1, listing.id)).rejects.toMatchObject({ code: "not_found" });
    await list(sql, 1, { item: BEANIE, slot: 4, price: 10 }, NOW);
  });

  test("after a week it comes down by itself, shown or not", async () => {
    await giveItem(sql, 1, BEANIE, NOW);
    const { listing } = await list(sql, 1, { item: BEANIE, slot: 4, price: 10 }, NOW);
    const late = NOW + MARKET_TTL;
    expect(await browse(sql, late - 1)).toHaveLength(1);
    expect(await browse(sql, late)).toEqual([]);
    await expect(buy(sql, 2, listing.id, 10, late)).rejects.toMatchObject({ code: "gone" });
    expect(await held(1, BEANIE)).toBe(1);
    expect(await expire(sql, late)).toEqual([]);
    // An expired one that nobody swept doesn't hold its slot.
    await giveItem(sql, 1, BEANIE, late);
    await list(sql, 1, { item: BEANIE, slot: 4, price: 10 }, late);
    expect(await held(1, BEANIE)).toBe(1);
  });
});

describe("buying", () => {
  test("moves the coins whole and the item, once, and tells the seller", async () => {
    await giveItem(sql, 1, BEANIE, NOW);
    const { listing } = await list(sql, 1, { item: BEANIE, slot: 2, price: 120 }, NOW);
    const [seller, buyer] = [await balance(1), await balance(2)];
    const { sale, sellerId, wallet: after } = await buy(sql, 2, listing.id, 120, NOW);
    expect(sellerId).toBe(1);
    expect(sale).toMatchObject({ item: BEANIE, price: 120, buyer: "bo", at: NOW });
    expect(await balance(2)).toBe(buyer - 120);
    expect(after.balance).toBe(buyer - 120);
    expect(await balance(1)).toBe(seller + 120);
    expect(await refSum(`market:${listing.id}`)).toBe(0);
    expect(await held(2, BEANIE)).toBe(1);
    expect(await browse(sql, NOW)).toEqual([]);
    await expect(buy(sql, 2, listing.id, 120, NOW)).rejects.toMatchObject({ code: "gone" });
    // The seller is told once, and the slot is free again.
    expect((await mine(sql, 1, NOW)).sold).toEqual([sale]);
    await sawSales(sql, 1, sale.id);
    expect((await mine(sql, 1, NOW)).sold).toEqual([]);
    await giveItem(sql, 1, BEANIE, NOW);
    await list(sql, 1, { item: BEANIE, slot: 2, price: 10 }, NOW);
  });

  test("is refused for your own, a price you didn't see, a new account, and an empty purse", async () => {
    await giveItem(sql, 1, BEANIE, NOW);
    const { listing } = await list(sql, 1, { item: BEANIE, slot: 2, price: 120 }, NOW);
    await expect(buy(sql, 1, listing.id, 120, NOW)).rejects.toMatchObject({ code: "own_listing" });
    await expect(buy(sql, 2, listing.id, 119, NOW)).rejects.toMatchObject({ code: "price_changed" });
    await expect(buy(sql, 2, listing.id, "120", NOW)).rejects.toMatchObject({ code: "price_changed" });
    await expect(buy(sql, 2, 999, 120, NOW)).rejects.toMatchObject({ code: "gone" });
    await user(3, "cy", 0, DAY);
    await gift(3, 1000);
    await expect(buy(sql, 3, listing.id, 120, NOW)).rejects.toMatchObject({ code: "too_new" });
    await user(4, "dee", 0, 30 * DAY);
    await expect(buy(sql, 4, listing.id, 120, NOW)).rejects.toMatchObject({ code: "too_poor" });
    // Every refusal left it for sale.
    expect((await browse(sql, NOW)).map((l) => l.id)).toEqual([listing.id]);
    expect(await held(2, BEANIE)).toBe(0);
  });

  test("an account can buy from its third day on", async () => {
    await giveItem(sql, 1, BEANIE, NOW);
    const { listing } = await list(sql, 1, { item: BEANIE, slot: 2, price: 10 }, NOW);
    await user(3, "cy", 0, DAY);
    await gift(3, 100);
    await expect(buy(sql, 3, listing.id, 10, NOW + 2 * DAY - 1)).rejects.toMatchObject({ code: "too_new" });
    await buy(sql, 3, listing.id, 10, NOW + 2 * DAY);
    expect(await held(3, BEANIE)).toBe(1);
  });

  test("a buyer can't spend more than the day's cap, or more than the week's on one seller", async () => {
    for (let i = 0; i < 3; i++) await giveItem(sql, 1, DRAGON, NOW);
    const a = (await list(sql, 1, { item: DRAGON, slot: 0, price: MARKET_DAY_BUY }, NOW)).listing;
    const b = (await list(sql, 1, { item: DRAGON, slot: 1, price: 1 }, NOW)).listing;
    const c = (await list(sql, 1, { item: DRAGON, slot: 2, price: 1 }, NOW)).listing;
    await buy(sql, 2, a.id, MARKET_DAY_BUY, NOW);
    await expect(buy(sql, 2, b.id, 1, NOW)).rejects.toMatchObject({ code: "buy_cap" });
    // A day on, the day's cap is clear but the week's on this seller is not.
    expect(MARKET_PAIR_BUY).toBe(MARKET_DAY_BUY);
    await expect(buy(sql, 2, b.id, 1, NOW + 2 * DAY)).rejects.toMatchObject({ code: "pair_cap" });
    // Eight days on (they have come down by now), the week is clear.
    const later = NOW + 8 * DAY;
    await expect(buy(sql, 2, c.id, 1, later)).rejects.toMatchObject({ code: "gone" });
    await giveItem(sql, 1, DRAGON, later);
    const d = (await list(sql, 1, { item: DRAGON, slot: 5, price: 1 }, later)).listing;
    await buy(sql, 2, d.id, 1, later);
    expect(await held(2, DRAGON)).toBe(2);
  });
});

test("an account that goes takes its display down with it", async () => {
  await giveItem(sql, 1, BEANIE, NOW);
  const { listing } = await list(sql, 1, { item: BEANIE, slot: 3, price: 10 }, NOW);
  await deleteUser(sql, 1, NOW);
  expect(await browse(sql, NOW)).toEqual([]);
  await expect(buy(sql, 2, listing.id, 10, NOW)).rejects.toMatchObject({ code: "gone" });
  expect(await sql.execute("SELECT id FROM items WHERE item = ?", BEANIE)).toEqual([]);
  expect(await sql.execute("SELECT id FROM market_listings")).toEqual([]);
});
