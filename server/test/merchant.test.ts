import { beforeEach, describe, expect, test } from "bun:test";
import { lineup, weekOf } from "@tokenmaxxing/core/merchant.ts";
import type { TxSql } from "../src/actors/shared.ts";
import { bag, settleTrade, type Trade, takeOut, wallet } from "../src/town/coins.ts";
import { buyEdition, cart, copiesOf } from "../src/town/merchant.ts";
import { migrate } from "../src/town/schema.ts";
import { memorySql } from "./memory-sql.ts";

let sql: TxSql;
/** Saturday 24 October 2026, noon in Copenhagen: the cart is in. */
const SAT = Date.UTC(2026, 9, 24, 10);
/** The Wednesday before: it isn't. */
const WED = Date.UTC(2026, 9, 21, 10);
const first = lineup(weekOf(SAT))[0]!;

beforeEach(async () => {
  sql = memorySql().sql;
  await migrate(sql);
  for (const id of [1, 2]) {
    await sql.execute(
      "INSERT INTO users (id, name, look, created_at) VALUES (?, ?, '{}', ?)",
      id,
      `u${id}`,
      Date.UTC(2026, 0, 1),
    );
    // 100M tokens a day for 400 days: plenty of coins.
    for (let d = 0; d < 400; d++)
      await sql.execute(
        "INSERT INTO usage_daily (user_id, day, model, input, output, cache_creation, cache_read, turns) VALUES (?, date('2026-01-02', ?), 'm', ?, 0, 0, 0, 1)",
        id,
        `+${d} days`,
        1e10,
      );
  }
});

describe("the traveling merchant", () => {
  test("numbers each copy in turn, town-wide, and charges for it", async () => {
    const before = (await wallet(sql, 1, SAT)).balance;
    expect((await buyEdition(sql, 1, first.id, SAT)).n).toBe(1);
    expect((await buyEdition(sql, 2, first.id, SAT)).n).toBe(2);
    const { wallet: w, n } = await buyEdition(sql, 1, first.id, SAT);
    expect(n).toBe(3);
    expect(w.balance).toBe(before - 2 * first.price);
    expect(w.owned).toContain(first.id);
    expect((await cart(sql, SAT)).stock[0]).toEqual({
      id: first.id,
      sold: 3,
      supply: first.supply,
      price: first.price,
    });
    expect((await copiesOf(sql, 1)).map((c) => c.n)).toEqual([1, 3]);
    expect(await bag(sql, 1)).toEqual([{ item: first.id, count: 2 }]);
  });

  test("sells out, and says so", async () => {
    for (let i = 0; i < first.supply; i++) await buyEdition(sql, 1 + (i % 2), first.id, SAT);
    await expect(buyEdition(sql, 1, first.id, SAT)).rejects.toMatchObject({ code: "sold_out" });
    expect((await cart(sql, SAT)).stock[0]!.sold).toBe(first.supply);
  });

  test("only sells this week's editions, and only while the cart is in", async () => {
    expect((await cart(sql, WED)).open).toBe(false);
    await expect(buyEdition(sql, 1, first.id, WED)).rejects.toMatchObject({ code: "closed" });
    const elsewhere = lineup("2026-10-12").find((e) => !lineup(weekOf(SAT)).includes(e))!;
    await expect(buyEdition(sql, 1, elsewhere.id, SAT)).rejects.toMatchObject({ code: "not_found" });
    await expect(buyEdition(sql, 1, "hat.1", SAT)).rejects.toMatchObject({ code: "not_found" });
  });

  test("a copy's number goes with it in a trade", async () => {
    await buyEdition(sql, 1, first.id, SAT);
    const t: Trade = {
      fromId: 1,
      from: "u1",
      toId: 2,
      to: "u2",
      give: { coins: 0, items: [first.id] },
      want: { coins: 10, items: [] },
      at: SAT,
    };
    await sql.execute(
      "INSERT INTO trades (from_id, to_id, give, want, at) VALUES (1, 2, ?, ?, ?)",
      JSON.stringify(t.give),
      JSON.stringify(t.want),
      SAT,
    );
    await settleTrade(sql, t, SAT);
    expect(await copiesOf(sql, 1)).toEqual([]);
    expect(await copiesOf(sql, 2)).toEqual([
      { id: expect.any(Number), item: first.id, week: "2026-10-19", n: 1, supply: first.supply },
    ]);
  });

  test("a trade, or a drop, moves the newest copy of a kind and the first one stays", async () => {
    for (let i = 0; i < 3; i++) await buyEdition(sql, 1, first.id, SAT);
    const t: Trade = {
      fromId: 1,
      from: "u1",
      toId: 2,
      to: "u2",
      give: { coins: 0, items: [first.id] },
      want: { coins: 0, items: [] },
      at: SAT,
    };
    await sql.execute(
      "INSERT INTO trades (from_id, to_id, give, want, at) VALUES (1, 2, ?, ?, ?)",
      JSON.stringify(t.give),
      JSON.stringify(t.want),
      SAT,
    );
    await settleTrade(sql, t, SAT);
    expect((await copiesOf(sql, 2)).map((c) => c.n)).toEqual([3]);
    expect((await copiesOf(sql, 1)).map((c) => c.n)).toEqual([1, 2]);
    await takeOut(sql, 1, first.id, SAT);
    expect((await copiesOf(sql, 1)).map((c) => c.n)).toEqual([1]);
  });
});
