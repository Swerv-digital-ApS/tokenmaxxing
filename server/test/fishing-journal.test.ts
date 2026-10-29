import { expect, test } from "bun:test";
import { FISHING_ITEMS, LUCKY_CASTS } from "@tokenmaxxing/core/fishing-loot.ts";
import { fishingFacts, fishingJournal, fishingState, recordFish } from "../src/town/fishing.ts";
import { migrate } from "../src/town/schema.ts";
import { memorySql } from "./memory-sql.ts";

const now = Date.UTC(2026, 9, 29, 10);
const never = () => 0.5;
const always = () => 0;

async function setup() {
  const { sql } = memorySql();
  await migrate(sql);
  for (const [id, name] of [
    [1, "Ada"],
    [2, "Bo"],
  ] as const)
    await sql.execute("INSERT INTO users (id, name, look, created_at) VALUES (?, ?, '{}', 0)", id, name);
  return sql;
}

test("the fishing journal persists totals and personal bests separately for each player", async () => {
  const sql = await setup();
  expect(await fishingJournal(sql, 1)).toEqual([]);
  await recordFish(sql, 1, { fish: "perch", cm: 18 }, now, never);
  await recordFish(sql, 1, { fish: "perch", cm: 25 }, now, never);
  await recordFish(sql, 1, { fish: "perch", cm: 12 }, now, never);
  await recordFish(sql, 1, { fish: "duck", cm: 8 }, now, never);
  const last = await recordFish(sql, 2, { fish: "perch", cm: 30 }, now, never);
  expect(last.journal).toEqual([{ fish: "perch", count: 1, cm: 30 }]);
  expect(await fishingJournal(sql, 1)).toEqual([
    { fish: "duck", count: 1, cm: 8 },
    { fish: "perch", count: 3, cm: 25 },
  ]);
});

test("unknown catches and impossible lengths never enter a journal", async () => {
  const sql = await setup();
  for (const caught of [
    { fish: "nope", cm: 12 },
    { fish: "perch", cm: 999 },
    { fish: "perch", cm: 12.5 },
    { fish: "notfound", cm: 1 },
  ])
    await expect(recordFish(sql, 1, caught as never, now, always)).rejects.toThrow("Invalid catch");
  expect(await fishingJournal(sql, 1)).toEqual([]);
  expect((await fishingState(sql, 1, now)).treasures).toEqual([]);
});

test("the pond record goes to the longest catch; a tie stays with whoever got there first", async () => {
  const sql = await setup();
  expect((await recordFish(sql, 1, { fish: "pike", cm: 60 }, now, never)).record).toBe(true);
  expect((await recordFish(sql, 2, { fish: "pike", cm: 60 }, now, never)).record).toBe(false);
  expect((await recordFish(sql, 1, { fish: "pike", cm: 50 }, now, never)).record).toBe(false);
  expect((await recordFish(sql, 2, { fish: "pike", cm: 61 }, now, never)).record).toBe(true);
  // One-size fish keep no record.
  expect((await recordFish(sql, 1, { fish: "float", cm: 30 }, now, never)).record).toBe(false);
  expect((await fishingState(sql, 1, now)).records).toEqual([
    { fish: "pike", cm: 61, userId: 2, name: "Bo" },
  ]);
  expect((await fishingFacts(sql, 2)).fishRecords).toBe(1);
  expect((await fishingFacts(sql, 1)).fishRecords).toBe(0);
});

test("only the day's first lucky casts roll for treasure, which lands in the bag", async () => {
  const sql = await setup();
  const first = await recordFish(sql, 1, { fish: "carp", cm: 30 }, now, always);
  expect(first.treasure).not.toBeNull();
  expect(first.luck).toEqual({ left: LUCKY_CASTS - 1, of: LUCKY_CASTS });
  const bag = await sql.execute("SELECT item FROM items WHERE owner_id = 1");
  expect(bag).toEqual([{ item: first.treasure!.item }]);
  for (let i = 1; i < LUCKY_CASTS; i++) await recordFish(sql, 1, { fish: "carp", cm: 30 }, now, never);
  const spent = await recordFish(sql, 1, { fish: "carp", cm: 30 }, now, always);
  expect(spent.treasure).toBeNull();
  expect(spent.luck.left).toBe(0);
  // A new world day brings the luck back.
  const tomorrow = await recordFish(sql, 1, { fish: "carp", cm: 30 }, now + 86_400_000, always);
  expect(tomorrow.treasure).not.toBeNull();
  const state = await fishingState(sql, 1, now + 86_400_000);
  expect(state.treasures).toHaveLength(2);
  expect(state.luck).toEqual({ left: LUCKY_CASTS - 1, of: LUCKY_CASTS });
  const facts = await fishingFacts(sql, 1);
  expect(facts.fishCaught).toBe(LUCKY_CASTS + 2);
  expect(facts.fishTreasures).toBeGreaterThanOrEqual(1);
  expect(facts.fishTreasures).toBeLessThanOrEqual(FISHING_ITEMS.length);
});

test("a 42 cm catch is remembered for the badge", async () => {
  const sql = await setup();
  await recordFish(sql, 1, { fish: "carp", cm: 41 }, now, never);
  expect((await fishingFacts(sql, 1)).fishAnswer).toBe(0);
  await recordFish(sql, 1, { fish: "carp", cm: 42 }, now, never);
  await recordFish(sql, 1, { fish: "pike", cm: 42 }, now, never);
  expect((await fishingFacts(sql, 1)).fishAnswer).toBe(1);
});
