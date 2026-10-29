import { describe, expect, test } from "bun:test";
import { PAYS } from "@tokenmaxxing/core/roulette.ts";
import { UserError } from "rivetkit";
import { wallet } from "../src/town/coins.ts";
import { rouletteBet, rouletteRefund, rouletteResolve } from "../src/town/roulette.ts";
import { migrate } from "../src/town/schema.ts";
import { memorySql } from "./memory-sql.ts";

const now = Date.now();

async function setup(coins: Record<number, number>) {
  const { sql } = memorySql();
  await migrate(sql);
  const look = JSON.stringify({
    style: 0,
    skin: 0,
    hair: 0,
    outfit: 0,
    glasses: 0,
    hat: 0,
    pet: 0,
    petVariant: 0,
  });
  for (const [id, n] of Object.entries(coins)) {
    await sql.execute(
      "INSERT INTO users (id, name, look, created_at) VALUES (?, ?, ?, ?)",
      Number(id),
      `u${id}`,
      look,
      now,
    );
    await sql.execute(
      "INSERT INTO ledger (user_id, amount, kind, ref, at) VALUES (?, ?, 'admin', 'admin', 0)",
      Number(id),
      n,
    );
  }
  return sql;
}
type Db = Awaited<ReturnType<typeof setup>>;
const balance = async (sql: Db, id = 7) => (await wallet(sql, id, now)).balance;
const rows = async (sql: Db) =>
  (await sql.execute("SELECT COUNT(*) AS n FROM roulette_bets"))[0] as { n: number };
/** A rand that lands on `pocket`. */
const landing = (pocket: number) => () => (pocket + 0.5) / 37;
const rejects = async (p: Promise<unknown>, code: string) => {
  const e = await p.then(
    () => null,
    (err) => err,
  );
  expect(e).toBeInstanceOf(UserError);
  expect((e as UserError).code).toBe(code);
};
/** mulberry32 */
const seeded = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

describe("roulette rounds", () => {
  test("two players, one pocket: each is paid by their own bets", async () => {
    const sql = await setup({ 7: 500, 8: 500 });
    await rouletteBet(sql, 7, 1, [{ on: "n:17", stake: 10 }], now);
    await rouletteBet(
      sql,
      8,
      1,
      [
        { on: "red", stake: 100 },
        { on: "n:17", stake: 1 },
      ],
      now,
    );
    expect(await balance(sql, 7)).toBe(490);
    expect(await balance(sql, 8)).toBe(399);
    const out = await rouletteResolve(sql, 1, now, landing(17));
    expect(out.pocket).toBe(17);
    expect(out.results).toEqual([
      { userId: 7, name: "u7", staked: 10, payout: 10 * (PAYS.n! + 1) },
      { userId: 8, name: "u8", staked: 101, payout: 1 * (PAYS.n! + 1) }, // 17 is black
    ]);
    expect(await balance(sql, 7)).toBe(490 + 360);
    expect(await balance(sql, 8)).toBe(399 + 36);
    expect((await rows(sql)).n).toBe(0);
  });

  test("a loss keeps the stake; other rounds are untouched", async () => {
    const sql = await setup({ 7: 500 });
    await rouletteBet(sql, 7, 1, [{ on: "red", stake: 100 }], now);
    await rouletteBet(sql, 7, 2, [{ on: "red", stake: 50 }], now);
    await rouletteResolve(sql, 1, now, landing(0));
    expect(await balance(sql)).toBe(350);
    expect((await rows(sql)).n).toBe(1);
  });

  test("lowering refunds the difference, raising takes it, clearing refunds all", async () => {
    const sql = await setup({ 7: 100 });
    await rouletteBet(sql, 7, 1, [{ on: "red", stake: 40 }], now);
    expect(await balance(sql)).toBe(60);
    await rouletteBet(sql, 7, 1, [{ on: "red", stake: 15 }], now);
    expect(await balance(sql)).toBe(85);
    await rouletteBet(sql, 7, 1, [{ on: "red", stake: 100 }], now);
    expect(await balance(sql)).toBe(0);
    await rouletteBet(sql, 7, 1, [], now);
    expect(await balance(sql)).toBe(100);
    expect((await rows(sql)).n).toBe(0);
  });

  test("too poor: refused, nothing written", async () => {
    const sql = await setup({ 7: 50 });
    await rejects(rouletteBet(sql, 7, 1, [{ on: "red", stake: 51 }], now), "too_poor");
    expect(await balance(sql)).toBe(50);
    expect((await rows(sql)).n).toBe(0);
    await rouletteBet(sql, 7, 1, [{ on: "red", stake: 50 }], now);
    await rejects(rouletteBet(sql, 7, 1, [{ on: "red", stake: 51 }], now), "too_poor");
    expect(await balance(sql)).toBe(0);
  });

  test("invalid bets: bad_bet", async () => {
    const sql = await setup({ 7: 5000 });
    for (const bad of [
      null,
      "x",
      [{ on: "n:37", stake: 1 }],
      [{ on: "red", stake: 0 }],
      [{ on: "red", stake: 1.5 }],
      [{ on: "red", stake: 1001 }],
      [
        { on: "red", stake: 600 },
        { on: "black", stake: 600 },
      ],
    ])
      await rejects(rouletteBet(sql, 7, 1, bad, now), "bad_bet");
    expect(await balance(sql)).toBe(5000);
  });

  test("startup refund returns every leftover stake", async () => {
    const sql = await setup({ 7: 100, 8: 100 });
    await rouletteBet(sql, 7, 3, [{ on: "red", stake: 30 }], now);
    await rouletteBet(sql, 8, 4, [{ on: "odd", stake: 60 }], now);
    expect(await rouletteRefund(sql, now)).toBe(90);
    expect(await balance(sql, 7)).toBe(100);
    expect(await balance(sql, 8)).toBe(100);
    expect((await rows(sql)).n).toBe(0);
  });

  test("a single player's refund leaves the others", async () => {
    const sql = await setup({ 7: 100, 8: 100 });
    await rouletteBet(sql, 7, 1, [{ on: "red", stake: 30 }], now);
    await rouletteBet(sql, 8, 1, [{ on: "odd", stake: 60 }], now);
    expect(await rouletteRefund(sql, now, 7, 1)).toBe(30);
    expect(await rouletteRefund(sql, now, 7, 1)).toBe(0);
    expect((await rows(sql)).n).toBe(1);
  });

  test("100 on red over many rounds returns about 36/37", async () => {
    const sql = await setup({ 7: 1_000_000 });
    const rand = seeded(12345);
    const n = 1500;
    for (let i = 1; i <= n; i++) {
      await rouletteBet(sql, 7, i, [{ on: "red", stake: 100 }], now);
      await rouletteResolve(sql, i, now, rand);
    }
    const rtp = ((await balance(sql)) - 1_000_000 + n * 100) / (n * 100);
    expect(rtp).toBeGreaterThan(0.88);
    expect(rtp).toBeLessThan(1.06);
  });
});
