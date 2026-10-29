import { expect, test } from "bun:test";
import { addDays, dayKey } from "@tokenmaxxing/core/range.ts";
import { lastWeekOf } from "@tokenmaxxing/core/regulars.ts";
import { serial } from "../src/actors/shared.ts";
import { town } from "../src/actors/town.ts";
import { migrate } from "../src/town/schema.ts";
import { memorySql } from "./memory-sql.ts";
import { eventually } from "./rivet.ts";

// The bar tab chalkboard reads `town.regulars`: this week's top five, and last week's winner for the crown.
test("the regulars board carries last week's winner next to this week's top", async () => {
  const { sql } = memorySql();
  await migrate(sql);
  for (const [id, name] of [
    [1, "ada"],
    [2, "bob"],
    [3, "cy"],
  ] as const)
    await sql.execute("INSERT INTO users (id, name, look, created_at) VALUES (?, ?, '{}', 0)", id, name);
  const today = dayKey(Date.now());
  const lastWeek = lastWeekOf(today).from;
  const actions = town.config.actions!;
  const internal = {
    conn: { state: { kind: "internal" } },
    db: sql,
    vars: { serial: serial(), dirty: new Set() },
  };
  // Last week bob beat ada; this week ada has the time and bob the crown.
  await actions.tavernMinutes!(internal as never, addDays(lastWeek, 1), [
    [1, 90, 1],
    [2, 120, 1],
    [3, 20, 1],
  ]);
  await actions.tavernMinutes!(internal as never, today, [
    [1, 60, 1],
    [2, 35, 1],
  ]);
  const asAda = {
    conn: { state: { kind: "user", userId: 1, via: "token" } },
    db: sql,
    vars: { regulars: null },
  };
  const board = await eventually(async () => {
    const b = await actions.regulars!(asAda as never);
    expect(b.last).toEqual({ userId: 2, name: "bob" });
    return b;
  });
  expect(board.top.map((r) => [r.rank, r.name, r.minutes])).toEqual([
    [1, "ada", 60],
    [2, "bob", 35],
  ]);
  expect(board.me).toEqual({ minutes: 60 });
});
