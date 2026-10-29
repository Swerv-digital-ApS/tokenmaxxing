import { beforeEach, describe, expect, test } from "bun:test";
import { writeTicket } from "@tokenmaxxing/core/cop.ts";
import type { TxSql } from "../src/actors/shared.ts";
import { grantRewards } from "../src/town/coins.ts";
import { migrate } from "../src/town/schema.ts";
import { giveTicket, ticketsOf } from "../src/town/tickets.ts";
import { memorySql } from "./memory-sql.ts";

let sql: TxSql;

beforeEach(async () => {
  sql = memorySql().sql;
  await migrate(sql);
  await sql.execute("INSERT INTO users (id, name, look, created_at) VALUES (1, 'ada', '{}', 0)");
});

describe("the 429 cop's tickets", () => {
  test("one a day, counted, newest first", async () => {
    expect(
      await giveTicket(
        sql,
        1,
        writeTicket("2026-10-20", 2.6e8, () => 0),
      ),
    ).toBe(1);
    // Same day again (a second `world`, a retry): not written.
    expect(
      await giveTicket(
        sql,
        1,
        writeTicket("2026-10-20", 2.9e8, () => 0.5),
      ),
    ).toBeNull();
    expect(
      await giveTicket(
        sql,
        1,
        writeTicket("2026-10-21", 3.2e8, () => 0.5),
      ),
    ).toBe(2);
    expect(await ticketsOf(sql, 1)).toEqual([
      { day: "2026-10-21", rate: 320_000_000, charge: 3 },
      { day: "2026-10-20", rate: 260_000_000, charge: 0 },
    ]);
  });

  test("nobody who isn't signed up gets one", async () => {
    expect(await giveTicket(sql, 9, writeTicket("2026-10-21", 2.6e8))).toBeNull();
    expect(await ticketsOf(sql, 9)).toEqual([]);
  });

  test("level rewards and tickets don't mix", async () => {
    await grantRewards(sql, 1, 30, 0);
    await giveTicket(
      sql,
      1,
      writeTicket("2026-10-21", 2.6e8, () => 0),
    );
    expect(await ticketsOf(sql, 1)).toHaveLength(1);
  });
});
