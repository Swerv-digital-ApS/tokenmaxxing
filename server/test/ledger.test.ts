import { beforeEach, describe, expect, test } from "bun:test";
import { levelUpCoins } from "@tokenmaxxing/core/economy.ts";
import { levelFor } from "@tokenmaxxing/core/format.ts";
import { itemById } from "@tokenmaxxing/core/shop.ts";
import type { TxSql } from "../src/actors/shared.ts";
import {
  bag,
  balances,
  buy,
  giveBack,
  grantRewards,
  heldIn,
  hold,
  pay,
  pickUp,
  placed,
  refund,
  setBalance,
  settleTrade,
  starterDrops,
  type Trade,
  takeOut,
  unclaimed,
  wallet,
} from "../src/town/coins.ts";
import { migrate } from "../src/town/schema.ts";
import { memorySql } from "./memory-sql.ts";

let sql: TxSql;
const NOW = Date.UTC(2026, 8, 29, 12);
const names = { 1: "ada", 2: "bo", 3: "cy" };

/**
 * Gives `userId` a balance: √(tokens ÷ 1M) coins for one old day, plus 25 for finishing it first. The
 * level those tokens reach pays too (`levelUpCoins`), but these tests are about what's done with coins, so
 * that's taken off again to keep their numbers plain.
 */
async function earn(userId: number, day: string, tokens: number) {
  await sql.execute(
    "INSERT INTO usage_daily (user_id, day, model, input, output, cache_creation, cache_read, turns) VALUES (?, ?, 'm', ?, 0, 0, 0, 1)",
    userId,
    day,
    tokens,
  );
  const [{ total }] = (await sql.execute(
    "SELECT SUM(input) AS total FROM usage_daily WHERE user_id = ?",
    userId,
  )) as [{ total: number }];
  await sql.execute("DELETE FROM ledger WHERE user_id = ? AND ref = 'levelfix'", userId);
  await sql.execute(
    "INSERT INTO ledger (user_id, amount, kind, ref, at) VALUES (?, ?, 'admin', 'levelfix', ?)",
    userId,
    -levelUpCoins(levelFor(total)),
    NOW,
  );
}
/** An `activity_daily` row: `agents` at once on `day`, nothing else. */
async function peak(userId: number, day: string, agents: number) {
  await sql.execute(
    "INSERT INTO activity_daily (user_id, day, prompts, prs, agent_buckets, active_buckets, peak_agents) VALUES (?, ?, 0, 0, 0, 0, ?)",
    userId,
    day,
    agents,
  );
}
const balance = async (userId: number) => (await wallet(sql, userId, NOW)).balance;
const sumOf = async (ref: string) =>
  ((await sql.execute("SELECT SUM(amount) AS n FROM ledger WHERE ref = ?", ref)) as [{ n: number }])[0].n;

/** Signs `userId` up on `day` (noon UTC is the same day in Copenhagen). */
async function signUpOn(userId: number, day: string) {
  await sql.execute(
    "INSERT INTO users (id, name, look, created_at) VALUES (?, ?, '{}', ?)",
    userId,
    `u${userId}`,
    Date.parse(`${day}T12:00:00Z`),
  );
}

beforeEach(async () => {
  sql = memorySql().sql;
  await migrate(sql);
  for (const id of [1, 2, 3]) await signUpOn(id, "2025-12-31");
  await earn(1, "2026-01-01", 9_999e6); // √9999 = 99, +25 first place = 124 (just short of level 10)
  await earn(2, "2026-01-02", 2_500e6); // 50, +25 = 75
  await earn(3, "2026-01-03", 100e6); // 10, +25 = 35
});

describe("the coin ledger", () => {
  test("a stake is held, then paid out, and the ref sums to 0", async () => {
    expect(await balance(1)).toBe(124);
    await hold(
      sql,
      "table:1",
      "stake",
      [
        { userId: 1, amount: 30 },
        { userId: 2, amount: 30 },
      ],
      names,
      NOW,
    );
    expect(await balance(1)).toBe(94);
    expect(await balance(2)).toBe(45);
    expect(await heldIn(sql, "table:1")).toEqual(
      new Map([
        [1, 30],
        [2, 30],
      ]),
    );
    await pay(sql, "table:1", "payout", [{ userId: 2, amount: 60 }], NOW);
    expect(await balance(1)).toBe(94);
    expect(await balance(2)).toBe(105);
    expect(await sumOf("table:1")).toBe(0);
  });

  test("a stake is at most half your coins, and holds are all or nothing", async () => {
    await expect(
      hold(
        sql,
        "table:2",
        "stake",
        [
          { userId: 1, amount: 20 },
          { userId: 3, amount: 20 }, // cy has 35: at most 17
        ],
        names,
        NOW,
      ),
    ).rejects.toThrow("cy can stake at most 🪙 17");
    expect(await balance(1)).toBe(124); // nothing was taken from ada either
    // A side bet only has to fit the balance.
    await hold(sql, "bets:2", "bet", [{ userId: 3, amount: 35 }], names, NOW);
    expect(await balance(3)).toBe(0);
  });

  test("a pot never pays out more than it holds", async () => {
    await hold(sql, "table:3", "stake", [{ userId: 1, amount: 10 }], names, NOW);
    await expect(pay(sql, "table:3", "payout", [{ userId: 2, amount: 11 }], NOW)).rejects.toThrow(
      "only 10 held",
    );
    await pay(sql, "table:3", "payout", [{ userId: 2, amount: 10 }], NOW);
    await expect(pay(sql, "table:3", "payout", [{ userId: 2, amount: 1 }], NOW)).rejects.toThrow();
  });

  test("a refund gives back exactly what each still has in", async () => {
    await hold(
      sql,
      "table:4",
      "stake",
      [
        { userId: 1, amount: 40 },
        { userId: 2, amount: 20 },
      ],
      names,
      NOW,
    );
    await refund(sql, "table:4", NOW, [2]);
    expect(await balance(2)).toBe(75);
    expect(await heldIn(sql, "table:4")).toEqual(new Map([[1, 40]]));
    await refund(sql, "table:4", NOW);
    expect(await balance(1)).toBe(124);
    expect(await sumOf("table:4")).toBe(0);
  });

  test("a paid-out pot holds nothing: calling it off again gives nothing back", async () => {
    const stakes = [
      { userId: 1, amount: 10 },
      { userId: 2, amount: 10 },
    ];
    await hold(sql, "table:5", "stake", stakes, names, NOW);
    await pay(sql, "table:5", "payout", [{ userId: 1, amount: 20 }], NOW);
    expect(await heldIn(sql, "table:5")).toEqual(new Map());
    await refund(sql, "table:5", NOW); // the arcade lost its settling in a restart and calls it off
    expect([await balance(1), await balance(2)]).toEqual([134, 65]);
  });
});

/** What's on the floor, oldest first. */
const floor = () =>
  sql.execute("SELECT item, dropped_by AS by, room, x, y FROM items WHERE owner_id IS NULL ORDER BY id");

describe("the bag", () => {
  const sofa = itemById("furn.s")!;

  test("buying twice is two rows and one spend", async () => {
    await buy(sql, 1, itemById("glasses.1")!, NOW);
    await buy(sql, 1, itemById("glasses.1")!, NOW);
    expect(await bag(sql, 1)).toEqual([{ item: "glasses.1", count: 2 }]);
    expect(await sql.execute("SELECT item, price FROM purchases WHERE user_id = 1")).toEqual([
      { item: "glasses.1", price: 120 },
    ]);
    expect(await balance(1)).toBe(4);
    await expect(buy(sql, 1, sofa, NOW)).rejects.toMatchObject({ code: "too_poor" });
  });

  test("level rewards come once; the office's desk and chair once, on its floor", async () => {
    const drops = await grantRewards(sql, 1, 10, NOW);
    expect(await grantRewards(sql, 1, 10, NOW)).toEqual([]);
    expect(await starterDrops(sql, 1, NOW)).toEqual([]);
    expect(await bag(sql, 1)).toEqual([
      { item: "hat.4", count: 1 },
      { item: "hat.25", count: 1 },
      { item: "held.2", count: 1 },
    ]);
    const desk = { item: "furn.d", by: 1, room: "office:1", x: 5, y: 3 };
    const chair = { item: "furn.c", by: 1, room: "office:1", x: 5, y: 4 };
    expect(await floor()).toEqual([desk, chair]);
    expect(drops).toMatchObject([desk, chair]);
    await grantRewards(sql, 2, 4, NOW);
    expect(await bag(sql, 2)).toEqual([]);
  });

  test("an office furnished before it had a row gets its desk and chair in the bag, not on its floor", async () => {
    await sql.execute("INSERT INTO items (owner_id, item, at) VALUES (1, 'furn.s', 0)");
    const sofaId = await takeOut(sql, 1, "furn.s", NOW);
    await placed(sql, { id: sofaId, item: "furn.s", room: "office:1", x: 5, y: 3, by: 1, at: NOW });
    expect(await grantRewards(sql, 1, 10, NOW)).toEqual([]);
    expect(await bag(sql, 1)).toEqual([
      { item: "furn.d", count: 1 },
      { item: "furn.c", count: 1 },
      { item: "hat.4", count: 1 },
      { item: "hat.25", count: 1 },
      { item: "held.2", count: 1 },
    ]);
    expect(await floor()).toEqual([{ item: "furn.s", by: 1, room: "office:1", x: 5, y: 3 }]);
  });

  test("the backfill turns purchases into rows, once", async () => {
    // A database from before `items`.
    await sql.execute("DROP TABLE items");
    await sql.execute("INSERT INTO purchases VALUES (2, 'hat.1', 100, 5), (3, 'glasses.1', 0, 6)");
    await migrate(sql);
    await migrate(sql);
    expect(await bag(sql, 2)).toEqual([{ item: "hat.1", count: 1 }]);
    expect(await bag(sql, 3)).toEqual([{ item: "glasses.1", count: 1 }]);
    expect(await balance(2)).toBe(75 - 100);
    // Every item gone (traded to someone deleted, say): the next start doesn't hand them out again.
    await sql.execute("DELETE FROM items");
    await migrate(sql);
    expect(await bag(sql, 2)).toEqual([]);
    expect(await bag(sql, 3)).toEqual([]);
  });
});

describe("drops", () => {
  const HOUR = 3_600_000;

  test("the sweeper sends an hour-old drop home; taking it after gets nothing", async () => {
    await buy(sql, 1, itemById("glasses.1")!, NOW);
    await buy(sql, 1, itemById("glasses.1")!, NOW);
    const old = await takeOut(sql, 1, "glasses.1", NOW - 2 * HOUR);
    const fresh = await takeOut(sql, 1, "glasses.1", NOW - HOUR / 6);
    expect(await bag(sql, 1)).toEqual([]);
    expect(await unclaimed(sql, NOW - HOUR)).toEqual([old]);
    await giveBack(sql, [old]);
    expect(await pickUp(sql, old, 2, "inn")).toBe(false);
    expect(await bag(sql, 1)).toEqual([{ item: "glasses.1", count: 1 }]);
    expect(await pickUp(sql, fresh, 2, "inn")).toBe(true);
    expect(await bag(sql, 2)).toEqual([{ item: "glasses.1", count: 1 }]);
    expect(await unclaimed(sql, NOW)).toEqual([]);
  });

  /** One of `item` bought by `userId` and dropped in `room` at `at`. */
  async function dropIn(userId: number, item: string, room: `office:${number}` | "inn", at = NOW) {
    await sql.execute("INSERT INTO items (owner_id, item, at) VALUES (?, ?, ?)", userId, item, at);
    const id = await takeOut(sql, userId, item, at);
    await placed(sql, { id, item, room, x: 1, y: 1, by: userId, at });
    return id;
  }

  test("furniture in your own office isn't loot: no cap, never swept; a visitor's gift there goes home", async () => {
    for (let i = 0; i < 6; i++) await dropIn(1, "furn.=", "office:1", NOW - 2 * HOUR);
    const gift = await dropIn(2, "furn.p", "office:1", NOW - 2 * HOUR);
    expect(await unclaimed(sql, NOW - HOUR)).toEqual([gift]);
    for (let i = 0; i < 5; i++) await dropIn(1, "furn.=", "inn");
    await expect(dropIn(1, "furn.=", "inn")).rejects.toMatchObject({ code: "too_many" });
    // Only from where it lies: a world that lost track of it (a ghost elsewhere) gets nothing.
    expect(await pickUp(sql, gift, 1, "inn")).toBe(false);
    // Nor for someone deleted meanwhile.
    expect(await pickUp(sql, gift, 9, "office:1")).toBe(false);
    // Picked up, it's off the floor: back down, it's somewhere new.
    expect(await pickUp(sql, gift, 1, "office:1")).toBe(true);
    expect(await sql.execute("SELECT room, x, y FROM items WHERE id = ?", gift)).toEqual([
      { room: null, x: null, y: null },
    ]);
  });

  test("a deleted dropper's drop is gone, not given back", async () => {
    await buy(sql, 2, itemById("glasses.1")!, NOW);
    const id = await takeOut(sql, 2, "glasses.1", NOW);
    await sql.execute("DELETE FROM users WHERE id = 2");
    await giveBack(sql, [id]);
    expect(await sql.execute("SELECT id FROM items")).toEqual([]);
  });
});

describe("the wallet", () => {
  test("the top 3 of a finished day get a bonus", async () => {
    for (const id of [4, 5, 6, 7]) await signUpOn(id, "2026-03-03");
    await Promise.all([4e9, 3e9, 2e9, 1e9].map((tokens, i) => earn(4 + i, "2026-03-03", tokens)));
    const wins = await Promise.all([4, 5, 6, 7].map((id) => wallet(sql, id, NOW)));
    expect(wins.map((w) => w.balance)).toEqual([63 + 25, 54 + 15, 44 + 10, 31]);
    // Only the last 30 days are listed, but old wins still count in the balance.
    expect(wins[0]!.wins).toEqual([]);
  });

  test("days before signing up pay nothing and win nothing", async () => {
    await signUpOn(4, "2026-03-03");
    await earn(4, "2026-03-02", 4_900e6); // would be 70 + 25 for 1st
    await earn(4, "2026-03-03", 100e6); // √100 = 10, and 1st: 25
    expect(await balance(4)).toBe(10 + 25);
    // Nor do they push anyone else off a podium: signed up the day after that day.
    await signUpOn(5, "2026-03-04");
    await earn(5, "2026-03-03", 1e12);
    expect(await balance(4)).toBe(10 + 25);
  });
});

describe("milestones", () => {
  test("pay once each, by the level, so old days count and past milestones pay on the next wallet", async () => {
    await signUpOn(4, "2026-03-03");
    await earn(4, "2026-03-02", 30e9); // before signing up: no day coins, but it's level 30
    expect(await balance(4)).toBe(100 + 250 + 500);
    await earn(4, "2026-03-03", 100e9); // 130B: level 50, √100000 = 316, and 1st place
    expect(await balance(4)).toBe(100 + 250 + 500 + 1000 + 2500 + 316 + 25);
    expect((await balances(sql, NOW)).get(4)).toBe(await balance(4));
  });
});

describe("daily quests", () => {
  test("pay from the day you signed up, not before", async () => {
    await peak(1, "2026-01-01", 5); // Run 5 agents at once
    expect(await balance(1)).toBe(124 + 5);
    await signUpOn(4, "2026-03-03");
    await peak(4, "2026-03-02", 5);
    expect(await balance(4)).toBe(0);
  });

  test("before the new rules begin, today pays the old ones and lists none (see quests.test.ts)", async () => {
    await signUpOn(4, "2026-09-29");
    expect((await wallet(sql, 4, NOW)).quests).toEqual([]);
    await earn(4, "2026-09-29", 500e6);
    await peak(4, "2026-09-29", 5);
    const w = await wallet(sql, 4, NOW);
    expect(w.balance).toBe(22 + 5); // √500, and no podium for a day that isn't over
    expect(w.today).toBe(22 + 5);
  });
});

describe("the admin page's balances", () => {
  test("add up to what each wallet says", async () => {
    for (const id of [4, 5]) await signUpOn(id, "2026-03-03");
    await Promise.all([4e9, 3e9].map((tokens, i) => earn(4 + i, "2026-03-03", tokens)));
    await earn(4, "2026-03-02", 1e12); // before signing up: pays nothing
    await peak(4, "2026-03-03", 5);
    await peak(5, "2026-03-02", 5); // before signing up
    await peak(1, "2026-02-01", 5); // a day with no tokens
    await sql.execute("INSERT INTO purchases VALUES (5, 'hat.1', 20, 0)");
    await hold(sql, "table:1", "stake", [{ userId: 1, amount: 40 }], names, NOW);
    const all = await balances(sql, NOW);
    for (const id of [1, 2, 3, 4, 5]) expect(all.get(id)).toBe(await balance(id));
  });

  test("an admin sets a balance through the ledger", async () => {
    expect(await setBalance(sql, 1, 500, NOW)).toEqual({ before: 124, balance: 500 });
    expect(await balance(1)).toBe(500);
    await setBalance(sql, 1, 3, NOW);
    expect(await balance(1)).toBe(3);
    expect((await balances(sql, NOW)).get(1)).toBe(3);
  });
});

describe("trades", () => {
  const specs = itemById("glasses.1")!; // Nerd specs, 60
  /** ada (124) offers bo (75), unless told otherwise. */
  async function offer(t: Partial<Trade>): Promise<Trade> {
    const out = {
      fromId: 1,
      from: "ada",
      toId: 2,
      to: "bo",
      give: { coins: 0, items: [] },
      want: { coins: 0, items: [] },
      at: NOW,
      ...t,
    };
    await sql.execute(
      "INSERT OR REPLACE INTO trades (from_id, to_id, give, want, at) VALUES (?, ?, ?, ?, ?)",
      out.fromId,
      out.toId,
      JSON.stringify(out.give),
      JSON.stringify(out.want),
      out.at,
    );
    return out;
  }

  test("coins both ways net the difference, and the ref sums to 0", async () => {
    await settleTrade(
      sql,
      await offer({ give: { coins: 50, items: [] }, want: { coins: 20, items: [] } }),
      NOW,
    );
    expect(await balance(1)).toBe(124 - 30);
    expect(await balance(2)).toBe(75 + 30);
    expect(await sumOf(`trade:1:${NOW}`)).toBe(0);
  });

  test("an item moves one row and no coins; the receiver may hold one already", async () => {
    await buy(sql, 1, specs, NOW);
    await buy(sql, 1, specs, NOW);
    await buy(sql, 2, specs, NOW);
    await settleTrade(sql, await offer({ give: { coins: 0, items: [specs.id] } }), NOW);
    expect([await balance(1), await balance(2)]).toEqual([4, 15]);
    expect((await bag(sql, 1))[0]!.count).toBe(1);
    expect((await bag(sql, 2))[0]!.count).toBe(2);
    expect(await sumOf(`trade:1:${NOW}`)).toBeNull();
  });

  test("a piece on the floor can't be traded until it's picked up", async () => {
    await buy(sql, 1, itemById("furn.c")!, NOW);
    const id = await takeOut(sql, 1, "furn.c", NOW);
    const sofa = await offer({ give: { coins: 0, items: ["furn.c"] } });
    await expect(settleTrade(sql, sofa, NOW)).rejects.toMatchObject({ code: "not_owned" });
    await pickUp(sql, id, 1, "inn");
    await settleTrade(sql, sofa, NOW);
    expect((await wallet(sql, 2, NOW)).owned).toEqual(["furn.c"]);
  });

  test("the giver's coins dropped since the offer: too_poor, without their balance, and nothing moves", async () => {
    const hundred = await offer({ give: { coins: 100, items: [] } });
    await buy(sql, 1, specs, NOW); // 124 → 64
    await expect(settleTrade(sql, hundred, NOW)).rejects.toMatchObject({
      code: "too_poor",
      message: "ada can't cover 🪙 100 right now.",
    });
    expect([await balance(1), await balance(2)]).toEqual([64, 75]);
  });

  test("an offer withdrawn or replaced meanwhile doesn't settle", async () => {
    const fifty = await offer({ give: { coins: 50, items: [] } });
    const one = await offer({ give: { coins: 1, items: [] }, at: NOW + 1 }); // replaces it
    await expect(settleTrade(sql, fifty, NOW)).rejects.toMatchObject({ code: "not_found" });
    await sql.execute("DELETE FROM trades"); // withdrawn
    await expect(settleTrade(sql, one, NOW)).rejects.toMatchObject({ code: "not_found" });
    expect([await balance(1), await balance(2)]).toEqual([124, 75]);
  });
});
