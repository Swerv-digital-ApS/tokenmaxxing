import { beforeEach, describe, expect, test } from "bun:test";
import { LAUNCH_COINS, levelUpCoins, streakExtra } from "@tokenmaxxing/core/economy.ts";
import { levelFor } from "@tokenmaxxing/core/format.ts";
import type { Launch } from "@tokenmaxxing/core/launch.ts";
import { coinsForTokens, PODIUM_COINS } from "@tokenmaxxing/core/shop.ts";
import type { TxSql } from "../src/actors/shared.ts";
import { balances, wallet } from "../src/town/coins.ts";
import { recordLaunches } from "../src/town/launch-bonus.ts";
import { migrate } from "../src/town/schema.ts";
import { trophyStep } from "../src/town/trophy-awards.ts";
import { memorySql } from "./memory-sql.ts";

let sql: TxSql;
const at = (day: string) => Date.parse(`${day}T12:00:00Z`);
const NOW = at("2026-12-10");

async function usage(userId: number, day: string, tokens: number) {
  await sql.execute(
    "INSERT INTO usage_daily (user_id, day, model, input, output, cache_creation, cache_read, turns) VALUES (?, ?, 'm', ?, 0, 0, 0, 1)",
    userId,
    day,
    tokens,
  );
}

beforeEach(async () => {
  sql = memorySql().sql;
  await migrate(sql);
  await sql.execute(
    "INSERT INTO users (id, name, company_id, joined_at, look, created_at) VALUES (1, 'a', NULL, NULL, '{}', ?)",
    at("2026-01-01"),
  );
});

describe("the new ways to earn", () => {
  test("a streak pays more each day, and the wallet and the admin page agree", async () => {
    for (const day of ["2026-12-01", "2026-12-02", "2026-12-03", "2026-12-04", "2026-12-05"])
      await usage(1, day, 100e6);
    // 23 coins a day, at ×1, ×1.5, ×2, ×2.5 and ×3: the part past the plain coins is the multiplier's. Every finished day wins the podium.
    const c = coinsForTokens(100e6, "2026-12-01");
    const extra = [1, 1.5, 2, 2.5, 3].reduce((n, m) => n + streakExtra(c, m), 0);
    const expected = 5 * c + extra + 5 * PODIUM_COINS[0] + levelUpCoins(levelFor(500e6));
    expect((await wallet(sql, 1, NOW)).balance).toBe(expected);
    expect((await balances(sql, NOW)).get(1)).toBe(expected);
    expect((await wallet(sql, 1, NOW)).streak).toBe(1);
  });

  test("a day off resets the streak", async () => {
    for (const day of ["2026-12-01", "2026-12-02", "2026-12-03", "2026-12-04", "2026-12-05", "2026-12-07"])
      await usage(1, day, 100e6);
    // The day back after the gap is ×1.
    const c = coinsForTokens(100e6, "2026-12-01");
    const extra = [1, 1.5, 2, 2.5, 3, 1].reduce((n, m) => n + streakExtra(c, m), 0);
    const expected = 6 * c + extra + 6 * PODIUM_COINS[0] + levelUpCoins(levelFor(600e6));
    expect((await balances(sql, NOW)).get(1)).toBe(expected);
  });

  test("badge tiers pay once each, and milestone levels' rows pay nothing here", async () => {
    const base = (await wallet(sql, 1, NOW)).balance;
    for (const [badge, tier] of [
      ["streak", 1],
      ["streak", 2],
      ["streak", 3],
      ["shipper", 1],
      ["level", 10],
    ] as const)
      await sql.execute(
        "INSERT INTO badge_awards (user_id, badge, tier, at, backfill) VALUES (1, ?, ?, ?, 0)",
        badge,
        tier,
        NOW,
      );
    // Streak to Gold: 40 + 100 + 200. A first Shipper: 40.
    expect((await wallet(sql, 1, NOW)).balance).toBe(base + 380);
    expect((await balances(sql, NOW)).get(1)).toBe(base + 380);
  });

  test("trophies are paid once, from what a sweep recorded", async () => {
    const base = (await wallet(sql, 1, NOW)).balance;
    const trophies = [
      { id: "million", day: "2026-12-01" },
      { id: "piday", day: "2026-03-14" },
      { id: "zeros", day: "2026-12-02" },
    ];
    // The backfill reads everyone, 10 a sweep, then the ones who synced.
    const dirty = new Set<number>();
    expect([...(await trophyStep(sql, dirty, NOW, async () => trophies)).values()]).toEqual([
      ["million", "piday", "zeros"],
    ]);
    expect((await wallet(sql, 1, NOW)).balance).toBe(base + 20 + 100);
    expect((await balances(sql, NOW)).get(1)).toBe(base + 20 + 100);
    // A later look finds nothing new, and pays nothing again.
    dirty.add(1);
    expect((await trophyStep(sql, dirty, NOW, async () => trophies)).size).toBe(0);
    expect((await wallet(sql, 1, NOW)).balance).toBe(base + 20 + 100);
  });

  describe("the new-model launch bonus", () => {
    const launch = (at: number): Launch => ({
      provider: "claude",
      model: "Claude Opus 5.5",
      id: "anthropic/claude-opus-5.5",
      price: { input: null, output: null, cache: null },
      tagline: "",
      at,
    });
    const used = (userId: number, day: string, model: string) =>
      sql.execute(
        "INSERT INTO usage_daily (user_id, day, model, input, output, cache_creation, cache_read, turns) VALUES (?, ?, ?, 1000, 0, 0, 0, 1)",
        userId,
        day,
        model,
      );
    const bonus = async (userId = 1) => (await wallet(sql, userId, NOW)).launches;

    test("using the model on its launch day pays once, and the wallet and the admin page agree", async () => {
      await used(1, "2026-12-09", "claude-opus-5-5-20261209");
      const before = (await wallet(sql, 1, NOW)).balance;
      await recordLaunches(sql, [launch(at("2026-12-09"))]);
      await recordLaunches(sql, [launch(at("2026-12-09"))]);
      expect((await wallet(sql, 1, NOW)).balance).toBe(before + LAUNCH_COINS);
      expect((await balances(sql, NOW)).get(1)).toBe(before + LAUNCH_COINS);
      expect(await bonus()).toEqual([
        { id: "anthropic/claude-opus-5.5", model: "claude-opus-5-5", day: "2026-12-09", coins: LAUNCH_COINS },
      ]);
    });

    test("another day, another model, or a launch never recorded pays nothing", async () => {
      await used(1, "2026-12-08", "claude-opus-5-5");
      await used(1, "2026-12-09", "claude-opus-5");
      const before = (await wallet(sql, 1, NOW)).balance;
      await recordLaunches(sql, [launch(at("2026-12-09"))]);
      expect((await wallet(sql, 1, NOW)).balance).toBe(before);
      expect(await bonus()).toEqual([]);
      await used(1, "2026-12-09", "claude-opus-5-5");
      await sql.execute("DELETE FROM launch_bonus");
      expect(await bonus()).toEqual([]);
    });

    test("a launch from before someone signed up doesn't pay them", async () => {
      await sql.execute(
        "INSERT INTO users (id, name, company_id, joined_at, look, created_at) VALUES (2, 'b', NULL, NULL, '{}', ?)",
        at("2026-12-10"),
      );
      await used(2, "2026-12-09", "claude-opus-5-5");
      await recordLaunches(sql, [launch(at("2026-12-09"))]);
      expect(await bonus(2)).toEqual([]);
    });
  });
});
