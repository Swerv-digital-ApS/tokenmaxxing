import { beforeEach, describe, expect, test } from "bun:test";
import { levelUpCoins } from "@tokenmaxxing/core/economy.ts";
import { levelFor } from "@tokenmaxxing/core/format.ts";
import { milestoneCoins } from "@tokenmaxxing/core/milestones.ts";
import { COUNT_CAP, LEGACY_FROM, WEEKLY_COINS, weeklyProgress } from "@tokenmaxxing/core/quests.ts";
import { addDays } from "@tokenmaxxing/core/range.ts";
import { coinsForTokens } from "@tokenmaxxing/core/shop.ts";
import type { TxSql } from "../src/actors/shared.ts";
import { balances, tossCoin, wallet } from "../src/town/coins.ts";
import {
  bumpCount,
  dayPicks,
  freezeDay,
  freezeDays,
  questBoard,
  questEvent,
  questsCleared,
} from "../src/town/quests.ts";
import { migrate } from "../src/town/schema.ts";
import { memorySql } from "./memory-sql.ts";

let sql: TxSql;
const noon = (day: string) => Date.parse(`${day}T12:00:00Z`);
/** A Monday, the day these rules begin. */
const D0 = LEGACY_FROM;
const BEFORE = addDays(D0, -3);
const AFTER = addDays(D0, 1);

beforeEach(async () => {
  ({ sql } = memorySql());
  await migrate(sql);
  await sql.execute(
    "INSERT INTO users (id, name, look, created_at) VALUES (1, 'ada', '{}', ?)",
    noon("2026-09-01"),
  );
});

const balance = async (day: string, userId = 1) => (await wallet(sql, userId, noon(day))).balance;
const activity = (day: string, a: { agents?: number; buckets?: number; prompts?: number; prs?: number }) =>
  sql.execute(
    "INSERT OR REPLACE INTO activity_daily (user_id, day, prompts, prs, agent_buckets, active_buckets, peak_agents) VALUES (1, ?, ?, ?, 0, ?, ?)",
    day,
    a.prompts ?? 0,
    a.prs ?? 0,
    a.buckets ?? 0,
    a.agents ?? 0,
  );
const tokens = (day: string, n: number, model = "m") =>
  sql.execute(
    "INSERT INTO usage_daily (user_id, day, model, input, output, cache_creation, cache_read, turns) VALUES (1, ?, ?, ?, 0, 0, 0, 1)",
    day,
    model,
    n,
  );

describe("the old rule before LEGACY_FROM", () => {
  test("a day before the launch pays 7 for a full day, with nothing dealt or stored", async () => {
    await activity(BEFORE, { agents: 5, buckets: 24 });
    expect(await balance(BEFORE)).toBe(7);
    expect((await wallet(sql, 1, noon(BEFORE))).quests).toEqual([]);
  });

  test("history before the launch pays the same once the new rules run", async () => {
    await activity(addDays(D0, -5), { agents: 5, buckets: 24 });
    await activity(addDays(D0, -4), { agents: 5 });
    const old = await balance(addDays(D0, -2));
    expect(old).toBe(7 + 5);
    expect(await balance(addDays(D0, 10))).toBe(old);
    expect((await balances(sql, noon(addDays(D0, 10)))).get(1)).toBe(old);
  });
});

describe("the new rules", () => {
  /** Every fact high enough for any quest, and every counter. */
  const doEverything = async (day: string) => {
    await activity(day, { agents: 8, buckets: 72, prompts: 150, prs: 3 });
    await tokens(day, 30e6, "a");
    await tokens(day, 1, "b");
    for (const kind of ["coffee", "bench", "paper", "fountain"] as const)
      await bumpCount(sql, 1, day, kind, "k");
  };

  test("a frozen day pays the tiers of what's done, with no ledger rows", async () => {
    const picks = await freezeDay(sql, 1, AFTER);
    expect(picks).toHaveLength(3);
    const before = await balance(AFTER);
    await doEverything(AFTER);
    const grown =
      coinsForTokens(30e6 + 1, AFTER) + milestoneCoins(levelFor(30e6 + 1)) + levelUpCoins(levelFor(30e6 + 1));
    // Three quests, 1 + 2 + 3 coins.
    expect(await balance(AFTER)).toBe(before + grown + 6);
    expect((await sql.execute("SELECT COUNT(*) AS n FROM ledger")) as [{ n: number }]).toEqual([{ n: 0 }]);
    expect((await balances(sql, noon(AFTER))).get(1)).toBe(before + grown + 6);
    const w = await wallet(sql, 1, noon(AFTER));
    expect(w.quests.map((q) => q.done)).toEqual([true, true, true]);
    expect(w.today).toBe(coinsForTokens(30e6 + 1, AFTER) + 6);
    expect(await questsCleared(sql, 1)).toBe(3);
  });

  test("a day nobody dealt pays nothing, until it's frozen", async () => {
    await doEverything(AFTER);
    const unfrozen = await balance(AFTER);
    // Shown, but not counted: `balances` agrees with `wallet`.
    expect((await wallet(sql, 1, noon(AFTER))).quests).toHaveLength(3);
    expect((await balances(sql, noon(AFTER))).get(1)).toBe(unfrozen);
    await freezeDay(sql, 1, AFTER);
    expect(await balance(AFTER)).toBe(unfrozen + 6);
  });

  test("a late sync only raises quest coins, and never moves the targets", async () => {
    await freezeDay(sql, 1, AFTER);
    const frozen = await sql.execute("SELECT picks FROM quest_days WHERE day = ?", AFTER);
    let last = await balance(AFTER);
    await activity(AFTER, { agents: 2, buckets: 6, prompts: 10 });
    for (const more of [{ agents: 5 }, { agents: 8, buckets: 72, prompts: 150, prs: 3 }]) {
      await activity(AFTER, more);
      const now = await balance(AFTER);
      expect(now).toBeGreaterThanOrEqual(last);
      last = now;
    }
    // A big history landing late changes what a fresh draw would be, not the frozen one.
    for (let i = 2; i < 20; i++)
      await activity(addDays(AFTER, -i), { agents: 30, buckets: 200, prompts: 900 });
    expect(await sql.execute("SELECT picks FROM quest_days WHERE day = ?", AFTER)).toEqual(frozen);
    expect(await dayPicks(sql, 1, AFTER)).toEqual(JSON.parse((frozen as [{ picks: string }])[0].picks));
    expect(await balance(AFTER)).toBeGreaterThanOrEqual(last);
  });

  test("the first to freeze a day wins", async () => {
    const a = await freezeDay(sql, 1, AFTER);
    await activity(addDays(AFTER, -2), { agents: 30, buckets: 200, prompts: 900 });
    expect(await freezeDay(sql, 1, AFTER)).toEqual(a);
  });

  test("a synced span deals the days from the launch on, not the ones before", async () => {
    const days = [BEFORE, D0, AFTER, addDays(AFTER, 40)];
    await freezeDays(sql, 1, days, noon(AFTER));
    const rows = (await sql.execute("SELECT day FROM quest_days ORDER BY day")) as { day: string }[];
    // Not before the launch, not in the future.
    expect(rows.map((r) => r.day)).toEqual([D0, AFTER]);
  });

  test("never the same quest on two days in a row", async () => {
    let prev: string[] = [];
    for (let i = 0; i < 12; i++) {
      const picks = (await freezeDay(sql, 1, addDays(D0, i))).map((q) => q.id);
      for (const id of picks) expect(prev).not.toContain(id);
      prev = picks;
    }
  });
});

describe("in-town counters", () => {
  test("the same event twice counts once, and a day's counter stops at the cap", async () => {
    expect(await bumpCount(sql, 1, AFTER, "bench", "bench:town:1,2")).toBe(1);
    expect(await bumpCount(sql, 1, AFTER, "bench", "bench:town:1,2")).toBeNull();
    expect(await bumpCount(sql, 1, AFTER, "bench", "bench:town:3,4")).toBe(2);
    expect(await bumpCount(sql, 1, AFTER, "bench", "a")).toBe(COUNT_CAP);
    expect(await bumpCount(sql, 1, AFTER, "bench", "b")).toBe(COUNT_CAP);
    // Another day, another kind: their own.
    expect(await bumpCount(sql, 1, addDays(AFTER, 1), "bench", "a")).toBe(1);
    expect(await bumpCount(sql, 1, AFTER, "paper", "a")).toBe(1);
  });

  test("questEvent only counts real kinds", async () => {
    expect(await questEvent(sql, 1, "paper", "paper:x", noon(AFTER))).toBe(true);
    expect(await questEvent(sql, 1, "paper", "paper:x", noon(AFTER))).toBe(false);
    expect(await questEvent(sql, 1, "nonsense", "x", noon(AFTER))).toBe(false);
    expect((await sql.execute("SELECT kind, n FROM quest_counts")) as unknown[]).toEqual([
      { kind: "paper", n: 1 },
    ]);
  });

  test("a coin in the fountain is a 1-coin ledger sink, and counts for the day", async () => {
    await expect(tossCoin(sql, 1, noon(AFTER))).rejects.toThrow("coin");
    await tokens(addDays(AFTER, -1), 100e6);
    const before = await balance(AFTER);
    await tossCoin(sql, 1, noon(AFTER));
    await tossCoin(sql, 1, noon(AFTER));
    expect(await balance(AFTER)).toBe(before - 2);
    const rows = (await sql.execute("SELECT amount, kind, ref FROM ledger ORDER BY id")) as unknown[];
    expect(rows).toEqual([
      { amount: -1, kind: "fountain", ref: `fountain:${AFTER}:1` },
      { amount: -1, kind: "fountain", ref: `fountain:${AFTER}:2` },
    ]);
    expect((await sql.execute("SELECT n FROM quest_counts WHERE kind = 'fountain'")) as unknown[]).toEqual([
      { n: 2 },
    ]);
  });
});

describe("the weekly quest", () => {
  /** The first week from the launch with `id` as its quest. */
  const weekWith = (id: string) => {
    for (let i = 0; ; i++) {
      const w = addDays(D0, i * 7);
      if (weeklyProgress(w, []).id === id) return w;
    }
  };

  test("be active 5 days: pays 15 coins once, and no item", async () => {
    const week = weekWith("active");
    // Three others out-burn ada every day, so no podium coins muddy the sums.
    for (const id of [2, 3, 4])
      for (let i = 0; i < 7; i++)
        await sql.execute(
          "INSERT INTO usage_daily (user_id, day, model, input, output, cache_creation, cache_read, turns) VALUES (?, ?, 'm', 1000000000, 0, 0, 0, 1)",
          id,
          addDays(week, i),
        );
    for (const id of [2, 3, 4])
      await sql.execute(
        "INSERT INTO users (id, name, look, created_at) VALUES (?, ?, '{}', ?)",
        id,
        `u${id}`,
        noon("2026-09-01"),
      );
    const now = noon(addDays(week, 6));
    const day = (i: number) => addDays(week, i);
    for (let i = 0; i < 4; i++) await tokens(day(i), 1000);
    const four = await balance(day(6));
    await tokens(day(4), 1000);
    expect(await balance(day(6))).toBe(four + WEEKLY_COINS);
    // Once, however many more days.
    await tokens(day(5), 1000);
    expect(await balance(day(6))).toBe(four + WEEKLY_COINS);
    expect((await balances(sql, now)).get(1)).toBe(four + WEEKLY_COINS);
    expect(((await sql.execute("SELECT COUNT(*) AS n FROM items")) as [{ n: number }])[0].n).toBe(0);
    expect(((await sql.execute("SELECT COUNT(*) AS n FROM rewards")) as [{ n: number }])[0].n).toBe(0);
  });

  test("the board shows the week and what today paid", async () => {
    const board = await questBoard(sql, 1, noon(AFTER));
    expect(board.day).toBe(AFTER);
    expect(board.daily).toHaveLength(3);
    expect(board.weekly.week).toBe(D0);
    expect(board.weekly.coins).toBe(15);
    expect(board.paid).toBe(0);
  });
});
