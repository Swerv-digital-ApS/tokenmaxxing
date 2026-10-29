import { beforeEach, expect, test } from "bun:test";
import { COSTUMES } from "@tokenmaxxing/core/costumes.ts";
import type { TxSql } from "../src/actors/shared.ts";
import { bag, buy, wallet } from "../src/town/coins.ts";
import { migrate } from "../src/town/schema.ts";
import { memorySql } from "./memory-sql.ts";

let sql: TxSql;
const hat = COSTUMES[0]!;
/** Tuesday 27 October 2026, noon in Copenhagen: four days to Halloween. */
const IN_SEASON = Date.UTC(2026, 9, 27, 11);
/** 1 December: long after. */
const AFTER = Date.UTC(2026, 11, 1, 11);

beforeEach(async () => {
  sql = memorySql().sql;
  await migrate(sql);
  await sql.execute(
    "INSERT INTO users (id, name, look, created_at) VALUES (1, 'u1', '{}', ?)",
    Date.UTC(2026, 0, 1),
  );
  // 10B tokens a day for 400 days: plenty of coins.
  for (let d = 0; d < 400; d++)
    await sql.execute(
      "INSERT INTO usage_daily (user_id, day, model, input, output, cache_creation, cache_read, turns) VALUES (1, date('2026-01-02', ?), 'm', ?, 0, 0, 0, 1)",
      `+${d} days`,
      1e10,
    );
});

test("a costume is sold round its holiday and refused the rest of the year, for no coins", async () => {
  const before = (await wallet(sql, 1, AFTER)).balance;
  await expect(buy(sql, 1, hat, AFTER)).rejects.toMatchObject({
    code: "not_for_sale",
    message: "That one is only sold round Halloween.",
  });
  expect((await wallet(sql, 1, AFTER)).balance).toBe(before);
  expect(await bag(sql, 1)).toEqual([]);
  const w = await buy(sql, 1, hat, IN_SEASON);
  expect(w.owned).toEqual([hat.id]);
  // Bought once, it stays bought: the balance later is the price less, whatever the season.
  expect((await wallet(sql, 1, AFTER)).balance).toBe(before - hat.price);
});
