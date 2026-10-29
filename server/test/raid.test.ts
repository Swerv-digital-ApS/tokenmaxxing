import { beforeEach, expect, test } from "bun:test";
import {
  dayStart,
  MIN_HP,
  opensAt,
  PR_HIT,
  RAID_REWARDS,
  rewardFor,
  WEEKLY_GROWTH,
} from "@tokenmaxxing/core/raid.ts";
import { addDays } from "@tokenmaxxing/core/range.ts";
import type { TxSql } from "../src/actors/shared.ts";
import { balances, wallet } from "../src/town/coins.ts";
import { raid, raidHistory, raidStart } from "../src/town/raid.ts";
import { migrate } from "../src/town/schema.ts";
import { memorySql } from "./memory-sql.ts";

let sql: TxSql;
/** The first raid's week in these tests. */
const RAID_START = "2026-10-19";
const day = (n: number) => addDays(RAID_START, n);
// Kills in the first week pay what weeks before `RAID_REWARDS_FROM` did; the week after pays today's.
const OLD = (rung: number) => rewardFor(rung, 1, RAID_START);
const NEW = (rung: number) => rewardFor(rung, 1, day(7));
const launch = (week: string) =>
  sql.execute(
    "INSERT INTO raid_meta (key, value) VALUES ('start', ?) ON CONFLICT DO UPDATE SET value = ?",
    week,
    week,
  );
/** Thursday noon of the first raid's week. */
const NOW = dayStart(day(3)) + 12 * 3_600_000;

async function use(userId: number, on: string, tokens: number) {
  await sql.execute(
    "INSERT INTO usage_daily (user_id, day, model, input, output, cache_creation, cache_read, turns) VALUES (?, ?, 'm', ?, 0, 0, 0, 1)",
    userId,
    on,
    tokens,
  );
}

async function prs(userId: number, on: string, n: number) {
  await sql.execute(
    "INSERT INTO activity_daily (user_id, day, prompts, prs, agent_buckets, active_buckets, peak_agents) VALUES (?, ?, 0, ?, 0, 0, 0)",
    userId,
    on,
    n,
  );
}

beforeEach(async () => {
  sql = memorySql().sql;
  await migrate(sql);
  await sql.execute(
    "INSERT INTO companies (id, name, owner_id, plot, created_at) VALUES (1, 'Acme', 1, 1, 0)",
  );
  for (const [id, name, company] of [
    [1, "ada", 1],
    [2, "bo", 1],
    [3, "cy", null],
  ] as const)
    await sql.execute(
      "INSERT INTO users (id, name, company_id, look, created_at) VALUES (?, ?, ?, '{}', ?)",
      id,
      name,
      company,
      dayStart(day(-30)),
    );
  await launch(RAID_START);
});

test("the town's hits add up against the first rung", async () => {
  await use(1, day(0), 300e6);
  await use(2, day(1), 100e6);
  await prs(2, day(1), 2);
  await use(3, day(2), 5e6);
  const r = await raid(sql, 2, await raidHistory(sql, NOW), NOW);
  expect(r.rules).not.toHaveProperty("dayCap");
  expect(r.rules.weeklyGrowth).toBe(WEEKLY_GROWTH);
  expect(r.week).toBe(RAID_START);
  expect(r.closed).toBe(false);
  expect(r.boss).toMatchObject({ name: "The Rate Limit", rung: 1, level: 1 });
  expect(r.hp).toBe(MIN_HP);
  expect(r.damage).toBe(300e6 + 100e6 + 2 * PR_HIT + 5e6);
  expect(r.totalDamage).toBe(r.damage);
  expect(r.kills).toEqual([]);
  expect(r.opensAt).toBe(opensAt(RAID_START));
  expect(r.endsAt).toBe(dayStart(day(7)) + 8 * 3_600_000);
  expect(r.top.map((t) => t.name)).toEqual(["ada", "bo", "cy"]);
  expect(r.companies).toEqual([{ companyId: 1, name: "Acme", damage: 300e6 + 100e6 + 2 * PR_HIT }]);
  expect(r.me).toEqual({ damage: 100e6 + 2 * PR_HIT, rank: 2, weekCoins: 0, coins: 0 });
  // cy did under the raider threshold.
  expect(r.raiders).toBe(2);
  expect(r.rules.rewards).toEqual([...RAID_REWARDS]);
});

test("a fallen boss brings on the next and pays its raiders, in the wallet and on the admin page", async () => {
  await use(1, day(0), 1e9);
  await use(1, day(1), 500e6);
  await use(2, day(2), 500e6);
  await use(3, day(2), 1e6);
  await use(1, day(3), 1e9);
  await use(2, day(3), 1e9);
  await use(3, day(3), 1e9);
  const r = await raid(sql, 3, await raidHistory(sql, NOW), NOW);
  // 2B falls on day 2, with cy's 1M over; 3B more (rung 2) on day 3.
  expect(r.kills.map((k) => [k.rung, k.boss.name, k.day, k.coins, k.raiders, k.paid])).toEqual([
    [1, "The Rate Limit", day(2), OLD(1), 2, false],
    [2, "The Context Window", day(3), OLD(2), 3, true],
  ]);
  expect(r.boss).toMatchObject({ name: "Merge Conflict", rung: 3 });
  expect(r.hp).toBe(MIN_HP * 1.5 * 1.5);
  expect(r.damage).toBe(1e6); // cy's overflow
  expect(r.totalDamage).toBe(5e9 + 1e6);
  expect(r.me).toMatchObject({ weekCoins: OLD(2), coins: OLD(2) });
  expect((await wallet(sql, 1, NOW)).raids).toBe(OLD(1) + OLD(2));
  expect((await wallet(sql, 2, NOW)).raids).toBe(OLD(1) + OLD(2));
  expect((await wallet(sql, 3, NOW)).raids).toBe(OLD(2));
  const all = await balances(sql, NOW);
  for (const id of [1, 2, 3]) expect(all.get(id)).toBe((await wallet(sql, id, NOW)).balance);
});

test("until 08:00 on Monday it shows last week as it ended; then the new ladder, Monday included", async () => {
  await use(1, day(0), 1e9);
  await use(2, day(0), 1e9);
  await use(3, day(1), 1e9);
  // Monday of the next week, before the gate opens.
  await use(1, day(7), 1e9);
  await use(2, day(7), 1e9);
  await use(3, day(7), 1e9);
  const gate = opensAt(day(7));
  const early = gate - 60_000;
  const before = await raid(sql, 1, await raidHistory(sql, early), early);
  expect(before.week).toBe(RAID_START);
  expect(before.closed).toBe(true);
  expect(before.endsAt).toBe(gate);
  expect(before.kills.map((k) => k.rung)).toEqual([1]);
  expect(before.boss.rung).toBe(2);
  expect(before.damage).toBe(1e9);
  expect((await wallet(sql, 1, early)).raids).toBe(OLD(1));
  expect((await balances(sql, early)).get(1)).toBe((await wallet(sql, 1, early)).balance);

  const after = await raid(sql, 1, await raidHistory(sql, gate), gate);
  expect(after.week).toBe(day(7));
  expect(after.closed).toBe(false);
  expect(after.opensAt).toBe(gate);
  // Last week only cleared one boss, so rung 1 is the same 2B; Monday's 3B already beat it, 1B into rung 2.
  expect(after.boss.rung).toBe(2);
  expect(after.hp).toBe(MIN_HP * 1.5);
  expect(after.kills.map((k) => [k.rung, k.day])).toEqual([[1, day(7)]]);
  expect(after.damage).toBe(1e9);
  expect(after.last).toMatchObject({ cleared: 1, defeated: true, raiders: 3 });
  expect(after.last!.boss.name).toBe("The Rate Limit");
  expect(after.me).toMatchObject({ weekCoins: NEW(1), coins: OLD(1) + NEW(1) });
  expect((await wallet(sql, 1, gate)).raids).toBe(OLD(1) + NEW(1));
  expect((await balances(sql, gate)).get(3)).toBe((await wallet(sql, 3, gate)).balance);
});

test("a first sync's backfill from before sign-up doesn't hit the boss", async () => {
  await sql.execute("UPDATE users SET created_at = ? WHERE id = 1", dayStart(day(2)));
  await use(1, day(0), 1e9);
  await use(1, day(2), 50e6);
  const r = await raid(sql, 1, await raidHistory(sql, NOW), NOW);
  expect(r.damage).toBe(50e6);
});

test("the launch is the Monday after the town first asks, stored once", async () => {
  await sql.execute("DELETE FROM raid_meta");
  expect(await raidStart(sql, NOW, "")).toBe(day(7));
  expect(await raidStart(sql, dayStart(day(30)), "")).toBe(day(7));
  // The env var wins, without moving what's stored.
  expect(await raidStart(sql, NOW, day(-7))).toBe(day(-7));
  expect(await raidStart(sql, NOW, "")).toBe(day(7));
});

for (const [season, start] of [
  ["summer", "2026-10-19"],
  ["winter", "2026-11-02"],
] as const)
  test(`before 08:00 on launch Monday it's waiting, then it opens (${season} time)`, async () => {
    await launch(start);
    const at = (n: number) => addDays(start, n);
    // The week before only sets rung 1: 30B is 3B. Then 8B on launch Monday, before the gate.
    for (const u of [1, 2, 3]) await use(u, at(-3), 10e9);
    for (const u of [1, 2]) await use(u, at(0), 4e9);
    const gate = opensAt(start);
    const early = gate - 60_000;
    const before = await raid(sql, 1, await raidHistory(sql, early), early);
    expect(before).toMatchObject({
      prelaunch: true,
      launchAt: gate,
      week: start,
      closed: true,
      hp: 3e9,
      damage: 0,
      kills: [],
      top: [],
      companies: [],
      last: null,
      me: { coins: 0 },
    });
    expect(before.boss).toMatchObject({ name: "The Rate Limit", rung: 1 });
    expect((await wallet(sql, 1, early)).raids).toBe(0);
    expect((await balances(sql, early)).get(1)).toBe((await wallet(sql, 1, early)).balance);

    const after = await raid(sql, 1, await raidHistory(sql, gate), gate);
    expect(after).toMatchObject({ prelaunch: false, launchAt: gate, week: start, closed: false });
    // 8B against 3B and 4.5B: two down, 0.5B into rung 3.
    expect(after.kills.map((k) => k.rung)).toEqual([1, 2]);
    expect(after.damage).toBe(0.5e9);
    expect((await wallet(sql, 1, gate)).raids).toBe(rewardFor(1, 1, start) + rewardFor(2, 1, start));
    expect((await balances(sql, gate)).get(1)).toBe((await wallet(sql, 1, gate)).balance);
  });
