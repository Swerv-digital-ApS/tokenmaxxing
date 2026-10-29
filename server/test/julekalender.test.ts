import { beforeEach, expect, test } from "bun:test";
import { DOORS } from "@tokenmaxxing/core/december.ts";
import type { TxSql } from "../src/actors/shared.ts";
import { bag, wallet } from "../src/town/coins.ts";
import { calendar, openDoor } from "../src/town/julekalender.ts";
import { migrate } from "../src/town/schema.ts";
import { memorySql } from "./memory-sql.ts";

let sql: TxSql;
/** Noon in Copenhagen (winter time, UTC+1) on `day` December. */
const dec = (day: number, year = 2026) => Date.UTC(year, 11, day, 11);

beforeEach(async () => {
  sql = memorySql().sql;
  await migrate(sql);
  await sql.execute(
    "INSERT INTO users (id, name, look, created_at) VALUES (1, 'u1', '{}', ?)",
    Date.UTC(2026, 0, 1),
  );
});

test("today's door opens once, with its coins or its item, and never again", async () => {
  const before = (await wallet(sql, 1, dec(7))).balance;
  const coins = DOORS[6]!;
  expect(coins).toEqual({ coins: 8 });
  const r = await openDoor(sql, 1, dec(7));
  expect(r).toMatchObject({ door: 7, gift: coins, notice: "🎄 Door 7: 🪙 8." });
  expect(r.wallet.balance).toBe(before + 8);
  // The same day again, as from a second tab or after a restart: refused, and nothing more paid.
  await expect(openDoor(sql, 1, dec(7) + 3_600_000)).rejects.toMatchObject({ code: "opened" });
  expect((await wallet(sql, 1, dec(7))).balance).toBe(before + 8);

  const item = DOORS[5]!;
  expect(item).toEqual({ item: "glasses.6", name: "Hygge moustache" });
  expect((await openDoor(sql, 1, dec(6))).notice).toBe("🎄 Door 6: Hygge moustache, in your bag.");
  expect(await bag(sql, 1)).toEqual([{ item: "glasses.6", count: 1 }]);
  expect(await calendar(sql, 1, dec(8))).toEqual({ today: 8, opened: [6, 7] });
});

test("no doors outside 1 to 24 December, and a new December starts over", async () => {
  await expect(openDoor(sql, 1, Date.UTC(2026, 10, 30, 11))).rejects.toMatchObject({ code: "closed" });
  await expect(openDoor(sql, 1, dec(25))).rejects.toMatchObject({ code: "closed" });
  await openDoor(sql, 1, dec(1));
  expect((await calendar(sql, 1, dec(2, 2027))).opened).toEqual([]);
  expect((await openDoor(sql, 1, dec(1, 2027))).door).toBe(1);
});
