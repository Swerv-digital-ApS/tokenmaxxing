import { beforeEach, expect, test } from "bun:test";
import { CROWN, HITS, KING_COINS, lootFor } from "@tokenmaxxing/core/fastelavn.ts";
import type { TxSql } from "../src/actors/shared.ts";
import { bag, wallet } from "../src/town/coins.ts";
import { barrel, whack } from "../src/town/fastelavn.ts";
import { migrate } from "../src/town/schema.ts";
import { memorySql } from "./memory-sql.ts";

let sql: TxSql;
/** Fastelavn Sunday 2027, noon in Copenhagen (UTC+1), and the Monday after. */
const SUNDAY = Date.UTC(2027, 1, 7, 11);
const MONDAY = Date.UTC(2027, 1, 8, 11);

beforeEach(async () => {
  sql = memorySql().sql;
  await migrate(sql);
  for (const id of [1, 2])
    await sql.execute(
      "INSERT INTO users (id, name, look, created_at) VALUES (?, ?, '{}', ?)",
      id,
      `u${id}`,
      Date.UTC(2026, 0, 1),
    );
});

test("whacks add up town-wide; the last one makes its player kattekonge and pays everyone, once", async () => {
  const before = [(await wallet(sql, 1, SUNDAY)).balance, (await wallet(sql, 2, SUNDAY)).balance];
  for (let i = 0; i < HITS - 1; i++) {
    const r = await whack(sql, 1 + (i % 2), SUNDAY + i);
    expect(r.loot).toBeUndefined();
  }
  expect(await barrel(sql, SUNDAY)).toEqual({ year: 2027, hits: HITS - 1, king: null });
  // Player 2 lands the last whack.
  const last = await whack(sql, 2, SUNDAY + HITS);
  expect(last.barrel.king).toEqual({ id: 2, name: "u2" });
  const [one, two] = [lootFor(2027, 1), lootFor(2027, 2)];
  expect(last.loot).toEqual([
    { userId: 1, coins: one.coins, items: one.item ? [one.item] : [] },
    { userId: 2, coins: two.coins + KING_COINS, items: [...(two.item ? [two.item] : []), CROWN] },
  ]);
  expect((await wallet(sql, 1, SUNDAY)).balance).toBe(before[0]! + one.coins);
  expect((await wallet(sql, 2, SUNDAY)).balance).toBe(before[1]! + two.coins + KING_COINS);
  expect((await bag(sql, 2)).map((r) => r.item)).toContain(CROWN);

  // Whacking on, or again after a restart: it's broken, nothing more is paid.
  const after = await whack(sql, 1, SUNDAY + HITS + 1);
  expect(after).toEqual({ barrel: { year: 2027, hits: HITS, king: { id: 2, name: "u2" } } });
  expect((await wallet(sql, 1, SUNDAY)).balance).toBe(before[0]! + one.coins);
});

test("no barrel the day after, and a new one next year", async () => {
  await expect(whack(sql, 1, MONDAY)).rejects.toMatchObject({ code: "closed" });
  await whack(sql, 1, SUNDAY);
  // Fastelavn 2028 is 27 February.
  expect(await barrel(sql, Date.UTC(2028, 1, 27, 11))).toEqual({ year: 2028, hits: 0, king: null });
});
