import { beforeEach, describe, expect, test } from "bun:test";
import { GREEN_FROM, HOUR_MS } from "@tokenmaxxing/core/grid.ts";
import { addDays } from "@tokenmaxxing/core/range.ts";
import { coinsForTokens } from "@tokenmaxxing/core/shop.ts";
import type { TxSql } from "../src/actors/shared.ts";
import { checkGrid, initialGrid } from "../src/grid.ts";
import { writeActivity } from "../src/town/card.ts";
import { balances, wallet } from "../src/town/coins.ts";
import { recordGreen } from "../src/town/grid.ts";
import { migrate } from "../src/town/schema.ts";
import { memorySql } from "./memory-sql.ts";

const iso = (ms: number) => new Date(ms).toISOString().slice(0, 19);
/** 10:00 UTC on the first paying day (11:00 in Copenhagen). */
const NOW = Date.parse(`${GREEN_FROM}T10:00:00Z`);
const MIN5 = 5 * 60_000;

/** A fetch answering `CO2Emis` with `co2` (g/kWh from `from`, every 5 min) and `DayAheadPrices` with `prices`. */
function energinet(co2: { from: number; g: number[] } | Error, prices: number[] | Error = [1100]) {
  const calls: string[] = [];
  const fetcher = (async (url: string) => {
    const set = url.includes("/CO2Emis?") ? "co2" : url.includes("/DayAheadPrices?") ? "prices" : null;
    if (!set) throw new Error(`unexpected ${url}`);
    calls.push(set);
    const reply = set === "co2" ? co2 : prices;
    if (reply instanceof Error) throw reply;
    const records =
      set === "co2"
        ? (co2 as { from: number; g: number[] }).g.map((g, i) => ({
            Minutes5UTC: iso((co2 as { from: number }).from + i * MIN5),
            CO2Emission: g,
          }))
        : (prices as number[]).map((dkk, i) => ({
            TimeUTC: iso(NOW + i * 15 * 60_000),
            DayAheadPriceDKK: dkk,
          }));
    return { ok: true, json: async () => ({ records }) };
  }) as unknown as typeof fetch;
  return { fetcher, calls };
}

describe("reading the grid", () => {
  test("green hours from the hour before, the newest reading, the prices", async () => {
    const { fetcher } = energinet({ from: NOW - HOUR_MS, g: Array(12).fill(40) });
    const s = await checkGrid(initialGrid(), NOW + 60_000, fetcher, {});
    expect(s.grid.green).toEqual([NOW]);
    expect(s.grid.co2).toEqual({ at: NOW - MIN5, g: 40 });
    expect(s.grid.prices).toEqual([{ at: NOW, dkk: 1.1 }]);
  });

  test("an hour that hasn't begun isn't green yet", async () => {
    const { fetcher } = energinet({ from: NOW, g: Array(8).fill(10) });
    expect((await checkGrid(initialGrid(), NOW + 40 * 60_000, fetcher, {})).grid.green).toEqual([]);
  });

  test("the API down keeps what was had; prices are read once an hour", async () => {
    const good = energinet({ from: NOW - HOUR_MS, g: Array(12).fill(40) });
    const had = await checkGrid(initialGrid(), NOW + 60_000, good.fetcher, {});
    const down = energinet(new Error("down"), new Error("down"));
    const kept = await checkGrid(had, NOW + 20 * 60_000, down.fetcher, {});
    expect(kept.grid).toEqual(had.grid);
    expect(down.calls).toEqual(["co2"]); // prices read 19 minutes ago
    const later = await checkGrid(kept, NOW + HOUR_MS + 2 * 60_000, down.fetcher, {});
    expect(later.grid).toEqual(had.grid);
    expect(later.pricesAt).toBe(had.pricesAt); // a failed read is tried again next time
  });

  test("GRID_FEED=off: no grid", async () => {
    const { fetcher, calls } = energinet({ from: NOW - HOUR_MS, g: Array(12).fill(40) });
    expect((await checkGrid(initialGrid(), NOW, fetcher, { GRID_FEED: "off" })).grid.green).toEqual([]);
    expect(calls).toEqual([]);
  });
});

describe("green hours pay", () => {
  let sql: TxSql;
  const day = GREEN_FROM;
  /** `user`'s day with `byHour` tokens at those world hours, in `usage_daily` and `hour_tokens` alike. */
  const sync = async (d: string, byHour: Record<number, number>, user = 1) => {
    const hours = Array<number>(24).fill(0);
    for (const [h, n] of Object.entries(byHour)) hours[Number(h)] = n;
    await sql.execute("DELETE FROM usage_daily WHERE user_id = ? AND day = ?", user, d);
    await sql.execute(
      "INSERT INTO usage_daily (user_id, day, model, input, output, cache_creation, cache_read, turns) VALUES (?, ?, 'm', ?, 0, 0, 0, 1)",
      user,
      d,
      hours.reduce((a, b) => a + b, 0),
    );
    await writeActivity(sql, user, [
      {
        day: d,
        prompts: 0,
        prs: 0,
        agentBuckets: 0,
        activeBuckets: 0,
        peakAgents: 0,
        hourTokens: hours.join(","),
      },
    ]);
  };
  /** Hour starts (ms) of `d`'s world hours, winter time. */
  const at = (d: string, hour: number) => Date.parse(`${d}T00:00:00Z`) + (hour - 1) * HOUR_MS;
  const balance = async (user = 1) => (await wallet(sql, user, NOW + 3 * HOUR_MS)).balance;

  beforeEach(async () => {
    ({ sql } = memorySql());
    await migrate(sql);
    for (const id of [1, 2])
      await sql.execute(
        "INSERT INTO users (id, name, look, created_at) VALUES (?, ?, '{}', ?)",
        id,
        `p${id}`,
        Date.parse("2026-09-01T12:00:00Z"),
      );
  });

  test("a quarter of what the green tokens pay, on top, and today's shows", async () => {
    await sync(day, { 9: 300e6, 10: 100e6, 11: 100e6 });
    const before = await balance();
    expect(await recordGreen(sql, [at(day, 10), at(day, 11)], NOW + HOUR_MS)).toBe(2);
    // 200M green tokens: √200 = 14, a quarter is 3.
    expect((await balance()) - before).toBe(3);
    const w = await wallet(sql, 1, NOW + HOUR_MS);
    expect(w.green).toBe(3);
    expect(w.today).toBe(coinsForTokens(500e6, day) + 3); // the day's tokens on the current curve, and the green bonus (a quarter of the old square root)
  });

  test("told twice, or by a restarted world, an hour pays once; one not begun yet isn't taken", async () => {
    await sync(day, { 10: 100e6 });
    await recordGreen(sql, [at(day, 10)], NOW);
    const once = await balance();
    expect(await recordGreen(sql, [at(day, 10), at(day, 10)], NOW)).toBe(0);
    expect(await balance()).toBe(once);
    expect(await recordGreen(sql, [at(day, 12)], NOW)).toBe(0);
    expect(await recordGreen(sql, [at(day, 10) + 1], NOW)).toBe(0);
  });

  test("a late sync, and an hour told late, only add", async () => {
    const green = async () => (await wallet(sql, 1, NOW + 3 * HOUR_MS)).green;
    await recordGreen(sql, [at(day, 10)], NOW);
    await sync(day, { 10: 16e6 });
    expect(await green()).toBe(1); // ¼√16
    const early = await balance();
    // The rest of the hour's tokens land later.
    await sync(day, { 10: 100e6 });
    expect(await green()).toBe(2); // ¼√100
    const before = await balance();
    expect(before).toBeGreaterThan(early);
    // The feed was down at 09:00: the hour is told hours later.
    await sync(day, { 9: 100e6, 10: 100e6 });
    const synced = await balance();
    await recordGreen(sql, [at(day, 9)], NOW + 2 * HOUR_MS);
    expect(await green()).toBe(3); // ¼√200
    expect((await balance()) - synced).toBe(1);
  });

  test("days before GREEN_FROM never pay", async () => {
    const old = addDays(day, -1);
    await sync(old, { 10: 100e6 });
    expect(await recordGreen(sql, [at(old, 10)], NOW)).toBe(0);
    expect((await wallet(sql, 1, NOW)).green).toBe(0);
  });

  test("the admin page's balances add green hours like the wallet", async () => {
    await sync(day, { 10: 400e6 });
    await sync(day, { 10: 25e6, 11: 1e6 }, 2);
    await recordGreen(sql, [at(day, 10)], NOW);
    const all = await balances(sql, NOW + 3 * HOUR_MS);
    expect(all.get(1)).toBe(await balance(1));
    expect(all.get(2)).toBe(await balance(2));
  });
});
