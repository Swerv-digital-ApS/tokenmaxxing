import { beforeEach, describe, expect, test } from "bun:test";
import type { TxSql } from "../src/actors/shared.ts";
import { deleteUser } from "../src/town/admin.ts";
import { offices, wallet } from "../src/town/coins.ts";
import {
  applyDecor,
  buyDecor,
  migrateOffices,
  ownedDecor,
  recordVisit,
  visitorCounts,
} from "../src/town/offices.ts";
import { migrate } from "../src/town/schema.ts";
import { memorySql } from "./memory-sql.ts";

let sql: TxSql;
/** Saturday 24 October 2026, noon in Copenhagen. */
const NOW = Date.UTC(2026, 9, 24, 10);
const DAY = 24 * 60 * 60 * 1000;

/** User 1 has years of tokens (a high level, plenty of coins); user 2 none. */
beforeEach(async () => {
  sql = memorySql().sql;
  await migrate(sql);
  for (const id of [1, 2, 3])
    await sql.execute(
      "INSERT INTO users (id, name, look, created_at) VALUES (?, ?, '{}', ?)",
      id,
      `u${id}`,
      Date.UTC(2026, 0, 1),
    );
  for (let d = 0; d < 250; d++)
    await sql.execute(
      "INSERT INTO usage_daily (user_id, day, model, input, output, cache_creation, cache_read, turns) VALUES (1, date('2026-01-02', ?), 'm', ?, 0, 0, 0, 1)",
      `+${d} days`,
      1e10,
    );
});

describe("offices v2: the migration", () => {
  test("is safe to run again, and adds the columns and the visits table", async () => {
    await migrateOffices(sql);
    await migrate(sql);
    const cols = (await sql.execute("PRAGMA table_info(offices)")) as { name: string }[];
    expect(cols.map((c) => c.name)).toEqual(["user_id", "open", "wall", "floor"]);
    expect(await offices(sql)).toEqual({});
  });
});

describe("wallpapers and floors", () => {
  test("buy once, for coins; plain, earned and unknown ones aren't for sale", async () => {
    const before = (await wallet(sql, 1, NOW)).balance;
    const after = await buyDecor(sql, 1, "wall", "nyhavn", NOW);
    expect(after.balance).toBe(before - 120);
    await expect(buyDecor(sql, 1, "wall", "nyhavn", NOW)).rejects.toMatchObject({ code: "owned" });
    await expect(buyDecor(sql, 1, "wall", "plain", NOW)).rejects.toMatchObject({ code: "not_for_sale" });
    await expect(buyDecor(sql, 1, "floor", "bornholm", NOW)).rejects.toMatchObject({ code: "not_for_sale" });
    await expect(buyDecor(sql, 1, "floor", "nyhavn", NOW)).rejects.toMatchObject({ code: "not_found" });
    await expect(buyDecor(sql, 1, "ceiling", "nyhavn", NOW)).rejects.toMatchObject({ code: "not_found" });
    await expect(buyDecor(sql, 2, "wall", "kanban", NOW)).rejects.toMatchObject({ code: "too_poor" });
  });

  test("what you own: the plain ones, what you bought, and what your level earned", async () => {
    await buyDecor(sql, 1, "floor", "parquet", NOW);
    const owned = await ownedDecor(sql, 1);
    expect(owned).toContain("wall.plain");
    expect(owned).toContain("floor.boards");
    expect(owned).toContain("floor.parquet");
    expect(owned).not.toContain("floor.checker");
    // Level 40 and 25 (the earned ones) for someone with this many tokens.
    expect(owned).toContain("wall.tivoli");
    expect(await ownedDecor(sql, 2)).toEqual(["wall.plain", "floor.boards"]);
  });

  test("applying is free, needs the piece, and makes the office's row; plain clears it", async () => {
    await expect(applyDecor(sql, 1, "wall", "nyhavn", NOW)).rejects.toMatchObject({ code: "not_owned" });
    await buyDecor(sql, 1, "wall", "nyhavn", NOW);
    const paid = (await wallet(sql, 1, NOW)).balance;
    const { drops } = await applyDecor(sql, 1, "wall", "nyhavn", NOW);
    expect(drops).toHaveLength(2); // the desk and chair, with the row
    expect((await wallet(sql, 1, NOW)).balance).toBe(paid);
    expect(await offices(sql)).toEqual({ 1: { wall: "nyhavn" } });
    await applyDecor(sql, 1, "floor", "boards", NOW);
    await applyDecor(sql, 1, "wall", "tivoli", NOW); // earned by level, no purchase
    expect((await offices(sql))[1]).toEqual({ wall: "tivoli" });
    await applyDecor(sql, 1, "wall", null, NOW);
    expect(await offices(sql)).toEqual({ 1: {} });
    await expect(applyDecor(sql, 1, "floor", "nope", NOW)).rejects.toMatchObject({ code: "not_found" });
  });

  test("nobody under the office level has anything to decorate", async () => {
    await expect(applyDecor(sql, 2, "wall", null, NOW)).rejects.toMatchObject({ code: "not_found" });
  });
});

describe("visits", () => {
  test("one per visitor per day, never the owner's own, over the last seven days", async () => {
    await recordVisit(sql, 1, 1, NOW);
    expect(await visitorCounts(sql, NOW)).toEqual({});
    await recordVisit(sql, 1, 2, NOW);
    await recordVisit(sql, 1, 2, NOW + 1000);
    await recordVisit(sql, 1, 3, NOW);
    await recordVisit(sql, 2, 3, NOW);
    expect(await visitorCounts(sql, NOW)).toEqual({ 1: 2, 2: 1 });
    // The same visitor on another day is still one person.
    await recordVisit(sql, 1, 2, NOW - 2 * DAY);
    expect((await visitorCounts(sql, NOW))[1]).toBe(2);
    // A week on, today's have aged out.
    expect(await visitorCounts(sql, NOW + 8 * DAY)).toEqual({});
  });

  test("deleting an account takes its visits, as owner and as visitor", async () => {
    await recordVisit(sql, 2, 3, NOW);
    await recordVisit(sql, 3, 2, NOW);
    await recordVisit(sql, 1, 3, NOW);
    await deleteUser(sql, 2, NOW);
    expect(await visitorCounts(sql, NOW)).toEqual({ 1: 1 });
  });
});
