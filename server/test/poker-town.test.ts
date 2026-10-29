import { beforeEach, describe, expect, test } from "bun:test";
import { BUY_IN, DAILY_LOSS_CAP } from "@tokenmaxxing/core/poker.ts";
import type { TxSql } from "../src/actors/shared.ts";
import { setBalance, wallet } from "../src/town/coins.ts";
import { POKER_REF, pokerLoss, pokerRelease, pokerSettle, pokerSit } from "../src/town/poker.ts";
import { migrate } from "../src/town/schema.ts";
import { memorySql } from "./memory-sql.ts";

let sql: TxSql;
/** Noon UTC on a day. */
const NOON = Date.UTC(2026, 8, 29, 12);
const DAY = 86_400_000;

const balance = async (userId: number, now = NOON) => (await wallet(sql, userId, now)).balance;
const rows = async () =>
  (await sql.execute("SELECT user_id AS userId, stack FROM poker_seats ORDER BY user_id")) as {
    userId: number;
    stack: number;
  }[];
const refSum = async () =>
  (
    (await sql.execute("SELECT SUM(amount) AS n FROM ledger WHERE ref = ?", POKER_REF)) as [
      { n: number | null },
    ]
  )[0].n ?? 0;

beforeEach(async () => {
  sql = memorySql().sql;
  await migrate(sql);
  await setBalance(sql, 1, 5000, NOON);
  await setBalance(sql, 2, 5000, NOON);
});

describe("poker, from the wallet's side", () => {
  test("sitting down takes the buy-in, standing up pays the stack back, the ref never sums above 0", async () => {
    await pokerSit(sql, 1, NOON);
    await pokerSit(sql, 2, NOON);
    expect(await balance(1)).toBe(5000 - BUY_IN);
    expect(await rows()).toEqual([
      { userId: 1, stack: BUY_IN },
      { userId: 2, stack: BUY_IN },
    ]);
    expect(await refSum()).toBe(-2 * BUY_IN);

    // Player 1 won 20 off player 2; 2 stands up.
    await pokerSettle(
      sql,
      { stacks: [{ userId: 1, stack: BUY_IN + 20 }], out: [{ userId: 2, stack: BUY_IN - 20 }] },
      NOON,
    );
    expect(await balance(2)).toBe(5000 - BUY_IN + (BUY_IN - 20));
    expect(await rows()).toEqual([{ userId: 1, stack: BUY_IN + 20 }]);
    await pokerSettle(sql, { stacks: [], out: [{ userId: 1, stack: BUY_IN + 20 }] }, NOON);
    expect(await balance(1)).toBe(5000 + 20);
    expect(await rows()).toEqual([]);
    // Every coin is where the table says: 1 is up 20, 2 down 20.
    expect(await refSum()).toBe(0);
  });

  test("one seat per player, and not without the coins", async () => {
    await pokerSit(sql, 1, NOON);
    await expect(pokerSit(sql, 1, NOON)).rejects.toThrow("already");
    expect(await balance(1)).toBe(5000 - BUY_IN);
    await setBalance(sql, 3, BUY_IN - 1, NOON);
    await expect(pokerSit(sql, 3, NOON)).rejects.toThrow(`🪙 ${BUY_IN - 1}`);
    expect(await balance(3)).toBe(BUY_IN - 1);
    expect(await rows()).toEqual([{ userId: 1, stack: BUY_IN }]);
  });

  /** `loser` sits and loses the whole buy-in to `winner`, who is already seated with `held` and stays. */
  const bust = async (loser: number, winner: number, held: number, now = NOON) => {
    await pokerSit(sql, loser, now);
    await pokerSettle(
      sql,
      { stacks: [{ userId: winner, stack: held + BUY_IN }], out: [{ userId: loser, stack: 0 }] },
      now,
    );
    return held + BUY_IN;
  };

  test("a player can't lose more than the daily cap, buy-ins counted; the next UTC day starts fresh", async () => {
    await pokerSit(sql, 2, NOON);
    let held = BUY_IN;
    // Three buy-ins, each lost in full: that is the cap.
    for (let n = 0; n < DAILY_LOSS_CAP / BUY_IN; n++) held = await bust(1, 2, held, NOON + n);
    expect(await pokerLoss(sql, 1, NOON)).toBe(DAILY_LOSS_CAP);
    await expect(pokerSit(sql, 1, NOON)).rejects.toThrow(`🪙 ${DAILY_LOSS_CAP} is the limit`);
    expect(await balance(1)).toBe(5000 - DAILY_LOSS_CAP);
    expect(await rows()).toEqual([{ userId: 2, stack: held }]);
    // The winner is down only the one buy-in still on the table, and tomorrow (UTC) is another day.
    expect(await pokerLoss(sql, 2, NOON)).toBe(BUY_IN);
    const tomorrow = Math.floor(NOON / DAY) * DAY + DAY + 1;
    expect(await pokerLoss(sql, 1, tomorrow)).toBe(0);
    await pokerSit(sql, 1, tomorrow);
  });

  test("winnings count against the cap: up is not down, and 100 down leaves exactly one more seat", async () => {
    // 1 wins 50 off 2.
    await pokerSit(sql, 1, NOON);
    await pokerSit(sql, 2, NOON);
    await pokerSettle(
      sql,
      {
        stacks: [],
        out: [
          { userId: 1, stack: 2 * BUY_IN },
          { userId: 2, stack: 0 },
        ],
      },
      NOON,
    );
    expect(await pokerLoss(sql, 1, NOON)).toBe(0);
    expect(await pokerLoss(sql, 2, NOON)).toBe(BUY_IN);
    // 2 loses twice more: 150 down, which is the limit.
    for (let n = 0; n < 2; n++) {
      await pokerSit(sql, 1, NOON);
      await pokerSit(sql, 2, NOON);
      await pokerSettle(
        sql,
        {
          stacks: [],
          out: [
            { userId: 1, stack: 2 * BUY_IN },
            { userId: 2, stack: 0 },
          ],
        },
        NOON,
      );
    }
    expect(await pokerLoss(sql, 2, NOON)).toBe(DAILY_LOSS_CAP);
    await expect(pokerSit(sql, 2, NOON)).rejects.toThrow("limit");
  });

  test("stacks that don't add up are refused whole, and a settle sent twice pays once", async () => {
    await pokerSit(sql, 1, NOON);
    await pokerSit(sql, 2, NOON);
    // A table that made 10 coins out of nothing.
    await expect(
      pokerSettle(
        sql,
        { stacks: [{ userId: 1, stack: BUY_IN + 10 }], out: [{ userId: 2, stack: BUY_IN }] },
        NOON,
      ),
    ).rejects.toThrow("add up");
    // Nothing changed.
    expect(await rows()).toEqual([
      { userId: 1, stack: BUY_IN },
      { userId: 2, stack: BUY_IN },
    ]);
    expect(await balance(2)).toBe(5000 - BUY_IN);
    const good = { stacks: [{ userId: 1, stack: BUY_IN + 30 }], out: [{ userId: 2, stack: BUY_IN - 30 }] };
    await pokerSettle(sql, good, NOON);
    await pokerSettle(sql, good, NOON);
    expect(await balance(2)).toBe(5000 - 30);
    expect(await rows()).toEqual([{ userId: 1, stack: BUY_IN + 30 }]);
    // A stack for someone not seated is a bug, not a payment.
    await expect(pokerSettle(sql, { stacks: [{ userId: 9, stack: 5 }], out: [] }, NOON)).rejects.toThrow(
      "not seated",
    );
  });

  test("a world that wakes without its table gives everyone their stack back", async () => {
    await pokerSit(sql, 1, NOON);
    await pokerSit(sql, 2, NOON);
    expect(await pokerRelease(sql, NOON)).toBe(2);
    expect(await balance(1)).toBe(5000);
    expect(await balance(2)).toBe(5000);
    expect(await rows()).toEqual([]);
    expect(await pokerRelease(sql, NOON)).toBe(0);
  });

  test("a seat is a game played: standing up with a different stack is one row, a seat nothing happened at is none", async () => {
    await pokerSit(sql, 1, NOON);
    await pokerSit(sql, 2, NOON);
    await pokerSettle(
      sql,
      {
        stacks: [],
        out: [
          { userId: 1, stack: BUY_IN + 20 },
          { userId: 2, stack: BUY_IN - 20 },
        ],
      },
      NOON,
    );
    // Sat down and stood up again with the same chips: not a game.
    await pokerSit(sql, 1, NOON + 1);
    await pokerSettle(sql, { stacks: [], out: [{ userId: 1, stack: BUY_IN }] }, NOON + 1);
    const played = (await sql.execute(
      "SELECT match_id AS id, user_id AS userId, game, place, stake, won FROM match_players ORDER BY match_id DESC",
    )) as { id: number; userId: number; game: string; place: number; stake: number; won: number }[];
    // Counted down from -1, so never an arcade match's id.
    expect(played).toEqual([
      { id: -1, userId: 1, game: "poker", place: 1, stake: BUY_IN, won: BUY_IN + 20 },
      { id: -2, userId: 2, game: "poker", place: 2, stake: BUY_IN, won: BUY_IN - 20 },
    ]);
  });
});
