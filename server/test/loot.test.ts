import { beforeEach, expect, test } from "bun:test";
import { LOOT_FIRST, lootOf, lootRoll } from "@tokenmaxxing/core/loot.ts";
import { dayStart } from "@tokenmaxxing/core/raid.ts";
import { addDays } from "@tokenmaxxing/core/range.ts";
import type { TxSql } from "../src/actors/shared.ts";
import { loadConfig } from "../src/config.ts";
import { bag, settleTrade, takeOut, wallet } from "../src/town/coins.ts";
import { grantLoot, lootBoost, lootNotice, raidLoot } from "../src/town/loot.ts";
import { raid, raidHistory } from "../src/town/raid.ts";
import { migrate } from "../src/town/schema.ts";
import { memorySql } from "./memory-sql.ts";

/** The Rate Limit's common drop: the first loot hat. */
const HOURGLASS_HAT = `hat.${LOOT_FIRST.hat}`;

let sql: TxSql;
const RAID_START = "2026-10-19";
const day = (n: number) => addDays(RAID_START, n);
/** Thursday noon of the first raid's week. */
const NOW = dayStart(day(3)) + 12 * 3_600_000;
/** Certain odds: every raider gets every item. */
const SURE = 1000;
const RATE_LIMIT = lootOf("rate-limit").map((l) => l.id);
const CONTEXT: string[] = lootOf("context-window").map((l) => l.id);

async function use(userId: number, on: string, tokens: number) {
  await sql.execute(
    "INSERT INTO usage_daily (user_id, day, model, input, output, cache_creation, cache_read, turns) VALUES (?, ?, 'm', ?, 0, 0, 0, 1)",
    userId,
    on,
    tokens,
  );
}

const items = async (userId: number) =>
  (await bag(sql, userId)).flatMap((b) => Array<string>(b.count).fill(b.item)).sort();

beforeEach(async () => {
  sql = memorySql().sql;
  await migrate(sql);
  for (const [id, name] of [
    [1, "ada"],
    [2, "bo"],
    [3, "cy"],
  ] as const)
    await sql.execute(
      "INSERT INTO users (id, name, look, created_at) VALUES (?, ?, '{}', ?)",
      id,
      name,
      dayStart(day(-30)),
    );
  await sql.execute("INSERT INTO raid_meta (key, value) VALUES ('start', ?)", RAID_START);
  // Rung 1 (2B) falls on Tuesday with ada and bo its raiders; cy only does 5M, under the 10M a raider needs.
  await use(1, day(0), 1.5e9);
  await use(2, day(1), 500e6);
  await use(3, day(1), 5e6);
});

test("a kill's raiders get its loot once, however often the raid is worked out", async () => {
  const weeks = await raidHistory(sql, NOW);
  expect(weeks.at(-1)!.kills.map((k) => k.raiders)).toEqual([[1, 2]]);
  const fresh = await grantLoot(sql, weeks, NOW, SURE);
  expect(fresh.map((d) => [d.userId, d.item, d.rung, d.week])).toEqual(
    [1, 2].flatMap((u) => RATE_LIMIT.map((i) => [u, i, 1, RAID_START])),
  );
  expect(await items(1)).toEqual([...RATE_LIMIT].sort());
  expect(await items(3)).toEqual([]);
  // Again, and after a "restart" (the same history, worked out afresh): nothing new.
  expect(await grantLoot(sql, weeks, NOW + 1000, SURE)).toEqual([]);
  expect(await grantLoot(sql, await raidHistory(sql, NOW + 60_000), NOW + 60_000, SURE)).toEqual([]);
  expect(await items(1)).toEqual([...RATE_LIMIT].sort());
  const [{ n }] = (await sql.execute("SELECT COUNT(*) AS n FROM loot")) as [{ n: number }];
  expect(n).toBe(8);
});

test("only raiders roll: a late sync that makes someone a raider gets them that kill's loot then", async () => {
  await grantLoot(sql, await raidHistory(sql, NOW), NOW, SURE);
  expect(await items(3)).toEqual([]);
  // cy's Tuesday turns out bigger: 10M, and a raider for rung 1.
  await sql.execute("UPDATE usage_daily SET input = 10e6 WHERE user_id = 3");
  const later = await grantLoot(sql, await raidHistory(sql, NOW), NOW, SURE);
  expect(later.map((d) => d.userId)).toEqual([3, 3, 3, 3]);
  expect(await items(3)).toEqual([...RATE_LIMIT].sort());
});

test("real odds hand out exactly the rolls under them; the next rung rolls the next boss's table", async () => {
  await use(1, day(2), 3e9); // rung 2, The Context Window, falls on Wednesday
  const fresh = await grantLoot(sql, await raidHistory(sql, NOW), NOW, 1);
  for (const d of fresh) expect(lootRoll(d.week, d.rung, d.userId, d.item)).toBeLessThan(d.odds);
  const sure = await grantLoot(sql, await raidHistory(sql, NOW), NOW, SURE);
  // With certain odds the rest come too, and only the rest.
  expect(fresh.length + sure.length).toBe(2 * 4 + 2 * 4);
  expect(sure.filter((d) => d.rung === 2).every((d) => CONTEXT.includes(d.item))).toBe(true);
});

test("a deleted raider gets nothing", async () => {
  const weeks = await raidHistory(sql, NOW);
  await sql.execute("DELETE FROM users WHERE id = 2");
  const fresh = await grantLoot(sql, weeks, NOW, SURE);
  expect(new Set(fresh.map((d) => d.userId))).toEqual(new Set([1]));
});

test("the panel shows the boss's table with my ticks, and the week's drops with who got them", async () => {
  await grantLoot(sql, await raidHistory(sql, NOW), NOW, SURE);
  const r = await raid(sql, 1, await raidHistory(sql, NOW), NOW);
  const loot = await raidLoot(sql, 1, r.week, r.boss, 1);
  expect(r.boss.id).toBe("context-window");
  expect(loot.table.map((t) => [t.item, t.rarity, t.odds, t.owned])).toEqual([
    [CONTEXT[0]!, "common", 0.1, false],
    [CONTEXT[1]!, "rare", 0.025, false],
    [CONTEXT[2]!, "epic", 0.005, false],
    [CONTEXT[3]!, "legendary", 0.001, false],
  ]);
  // Rarest first: the trophy leads.
  expect(loot.drops[0]).toMatchObject({ rung: 1, item: "furn.Y", odds: 1 });
  expect(loot.drops.map((d) => d.name).sort()).toEqual([...Array(4).fill("ada"), ...Array(4).fill("bo")]);
  expect(loot.boost).toBe(1);
  const mine = await raidLoot(sql, 1, r.week, { ...r.boss, id: "rate-limit" }, 1);
  expect(mine.table.every((t) => t.owned)).toBe(true);
});

test("loot trades and drops like any shop item, and costs nobody coins", async () => {
  await grantLoot(sql, await raidHistory(sql, NOW), NOW, SURE);
  const before = (await wallet(sql, 1, NOW)).balance;
  await sql.execute(
    "INSERT INTO trades (from_id, to_id, give, want, at) VALUES (1, 2, ?, ?, ?)",
    JSON.stringify({ coins: 0, items: ["furn.Y"] }),
    JSON.stringify({ coins: 0, items: [] }),
    NOW,
  );
  await settleTrade(
    sql,
    {
      fromId: 1,
      from: "ada",
      toId: 2,
      to: "bo",
      give: { coins: 0, items: ["furn.Y"] },
      want: { coins: 0, items: [] },
      at: NOW,
    },
    NOW,
  );
  expect((await items(1)).includes("furn.Y")).toBe(false);
  expect((await items(2)).filter((i) => i === "furn.Y")).toHaveLength(2);
  expect((await wallet(sql, 1, NOW)).balance).toBe(before);
  // Onto the floor too, like any tradeable item.
  expect(await takeOut(sql, 1, HOURGLASS_HAT, NOW)).toBeGreaterThan(0);
});

test("the notice names the rarest first; the boost is off unless set, and checked at boot", () => {
  const d = (item: string, odds: number) => ({
    week: RAID_START,
    rung: 1,
    level: 1,
    day: day(1),
    userId: 1,
    item,
    odds,
  });
  expect(lootNotice([d("furn.Y", 0.001)])).toBe(
    "🌟 LEGENDARY! ✨ You got the Golden Hourglass (0.1%) from The Rate Limit!",
  );
  expect(lootNotice([d(HOURGLASS_HAT, 0.1), d("pet.7", 0.005)])).toBe(
    "💜 ✨ 2 raid drops for you: the Sand golem (0.5%), Hourglass hat!",
  );
  expect(lootBoost(undefined)).toBe(1);
  expect(lootBoost("100")).toBe(100);
  expect(() => loadConfig({ RAID_LOOT_BOOST: "lots" }, "0")).toThrow(/RAID_LOOT_BOOST/);
  expect(() => loadConfig({ RAID_LOOT_BOOST: "0.5" }, "0")).toThrow(/RAID_LOOT_BOOST/);
  expect(() => loadConfig({ RAID_LOOT_BOOST: "100" }, "0")).not.toThrow();
});
