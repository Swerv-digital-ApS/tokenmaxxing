import { offSeason, onSale } from "@tokenmaxxing/core/costumes.ts";
import {
  badgeCoins,
  levelUpCoins,
  STREAK_FROM,
  streakBonus,
  streakExtra,
  streakNow,
} from "@tokenmaxxing/core/economy.ts";
import { levelFor } from "@tokenmaxxing/core/format.ts";
import { milestoneCoins } from "@tokenmaxxing/core/milestones.ts";
import { OFFICE_LEVEL, rotOf, STARTER_OFFICE } from "@tokenmaxxing/core/office.ts";
import { TREAT_COST, TREATS_PER_DAY } from "@tokenmaxxing/core/pets.ts";
import { EMPTY_COUNTS, EMPTY_DAY, type Progress, questProgress } from "@tokenmaxxing/core/quests.ts";
import { type RaidWeek, raidCoins } from "@tokenmaxxing/core/raid.ts";
import { addDays, dayKey } from "@tokenmaxxing/core/range.ts";
import {
  coinsForTokens,
  type Item,
  isKeepsake,
  isTradeable,
  itemById,
  itemsIn,
  levelItems,
  type MerchKind,
  merchPrice,
  PODIUM_COINS,
  type Side,
} from "@tokenmaxxing/core/shop.ts";
import type { Drop } from "@tokenmaxxing/core/world.ts";
import { sumBy } from "hanzio";
import { UserError } from "rivetkit";
import { all, one, type Sql, scalar, type TxSql } from "../actors/shared.ts";
import { companyLedgerAdd } from "./companies.ts";
import { greenPay } from "./grid.ts";
import { type LaunchPaid, launchBonus, launchBonusAll } from "./launch-bonus.ts";
import { bumpCount, dayPicks, loadQuestData, noQuestData, paidFrom, questPay } from "./quests.ts";
import { raidHistory } from "./raid.ts";
import { trophyAwardCoins, trophyAwardCoinsAll } from "./trophy-awards.ts";
import { lookOf, signupDays, TOKENS, tokensIn, userById } from "./users.ts";

export interface Wallet {
  balance: number;
  /** Coins from today so far: tokens and quests. */
  today: number;
  /** The streak multiplier today's coins are paid at, 1 to 3 (what today would be worth before it has tokens). */
  streak: number;
  /** Launches from yesterday or today whose model I used on its launch day, each paid `LAUNCH_COINS` (the HUD's 🚀). */
  launches: LaunchPaid[];
  /** Coins from raids: every rung that fell with me a raider by its day. */
  raids: number;
  /** Coins today's green hours have paid so far (part of `today`). */
  green: number;
  /** Days finished in the top 3, newest first (the last 30 days). */
  wins: { day: string; place: number; coins: number }[];
  /** Item ids I hold, one of each kind: what I can wear or trade. */
  owned: string[];
  /** How many things are in my bag, rewards included. */
  items: number;
  /** Today's quests, and how far each is. */
  quests: Progress[];
  /** An offer is open to or from me: the HUD shows the trades icon. */
  trading: boolean;
}

/** One kind in a bag, and how many. */
export interface BagRow {
  item: string;
  count: number;
}

export const bag = (sql: Sql, userId: number): Promise<BagRow[]> =>
  all<BagRow>(
    sql,
    "SELECT item, COUNT(*) AS count FROM items WHERE owner_id = ? GROUP BY item ORDER BY MIN(id)",
    userId,
  );

/** Item ids `userId` holds and could wear or trade: one of each kind. */
export const ownedItems = async (sql: Sql, userId: number): Promise<string[]> =>
  (await bag(sql, userId)).map((r) => r.item);

/** Whether `userId` has at least one `item` in their bag. */
export const holds = async (sql: Sql, userId: number, item: string): Promise<boolean> =>
  (await one(sql, "SELECT 1 FROM items WHERE owner_id = ? AND item = ?", userId, item)) !== undefined;

/** One `item` into `userId`'s bag. Returns its row's id. */
export const giveItem = async (sql: Sql, userId: number, item: string, now: number): Promise<number> =>
  (await one<{ id: number }>(
    sql,
    "INSERT INTO items (owner_id, item, at) VALUES (?, ?, ?) RETURNING id",
    userId,
    item,
    now,
  ))!.id;

/** `price` more spent on `item` (one row per kind: a rebuy adds to it). */
export const addPurchase = (sql: Sql, userId: number, item: string, price: number, now: number) =>
  sql.execute(
    `INSERT INTO purchases (user_id, item, price, at) VALUES (?, ?, ?, ?)
     ON CONFLICT(user_id, item) DO UPDATE SET price = price + excluded.price`,
    userId,
    item,
    price,
    now,
  );

/** A line in the `ledger`: `amount` coins into `userId`'s wallet (negative: out of it), under `ref`. */
export const ledgerAdd = (sql: Sql, userId: number, amount: number, kind: string, ref: string, now: number) =>
  sql.execute(
    "INSERT INTO ledger (user_id, amount, kind, ref, at) VALUES (?, ?, ?, ?, ?)",
    userId,
    amount,
    kind,
    ref,
    now,
  );

/**
 * Hands out what `level` has reached, each once: the level rewards, and the office's desk and chair.
 * Returns the desk and chair the first time, for `world` to put down.
 */
export async function grantRewards(sql: Sql, userId: number, level: number, now: number): Promise<Drop[]> {
  const drops = level >= OFFICE_LEVEL ? await starterDrops(sql, userId, now) : [];
  const due = levelItems(level);
  if (due.length === 0) return drops;
  // Every sync asks: one read, and a write only for what's new.
  const had = new Set(
    (await all<{ item: string }>(sql, "SELECT item FROM rewards WHERE user_id = ?", userId)).map(
      (r) => r.item,
    ),
  );
  for (const i of due) {
    if (had.has(i.id)) continue;
    const [fresh] = await all(
      sql,
      "INSERT INTO rewards (user_id, item) VALUES (?, ?) ON CONFLICT DO NOTHING RETURNING item",
      userId,
      i.id,
    );
    if (fresh) await giveItem(sql, userId, i.id, now);
  }
  return drops;
}

/**
 * What a badge tier is worth: every tier `userId` has reached (`badge_awards`, which a sweep keeps and a
 * backfill filled in for everyone) pays once, by its number. Milestone levels are rows too, and pay elsewhere.
 */
export async function badgeAwardCoins(sql: Sql, userId: number): Promise<number> {
  const rows = await all<{ tier: number }>(
    sql,
    "SELECT tier FROM badge_awards WHERE user_id = ? AND badge != 'level'",
    userId,
  );
  return sumBy(rows, (r) => badgeCoins(r.tier) - badgeCoins(r.tier - 1));
}

/**
 * Coins are worked out from usage every time rather than stored, so a late sync
 * still pays. Podium places count once a day is over. Only days from the world day
 * someone signed up count, for pay and for places: a first sync backfills months of
 * logs, and those days would otherwise pay out (and win podiums nobody else was on).
 * Milestone coins (`milestones.ts`) go by the level, which counts every day.
 * ponytail: a late sync can also knock someone off a past podium after they spent
 * the bonus; the balance then reads short until they earn it back. Settle days into
 * a ledger if that ever matters. `top` and `raids`: what the caller keeps (`Kept`), if it does.
 */
export async function wallet(
  sql: Sql,
  userId: number,
  now: number,
  { top, raids }: Partial<Kept> = {},
): Promise<Wallet> {
  const today = dayKey(now);
  const me = await one<{ createdAt: number }>(
    sql,
    "SELECT created_at AS createdAt FROM users WHERE id = ?",
    userId,
  );
  const from = me ? dayKey(me.createdAt) : today;
  // Every day, for the level; only those from sign-up pay.
  const everyDay = await all<{ day: string; tokens: number }>(
    sql,
    `SELECT day, SUM(${TOKENS}) AS tokens FROM usage_daily WHERE user_id = ? GROUP BY day`,
    userId,
  );
  const days = everyDay.filter((d) => d.day >= from);
  // ponytail: a few more queries per call for the quests, like the rest of the wallet.
  const data = (await loadQuestData(sql, { [userId]: from })).get(userId) ?? noQuestData();
  // Pay only counts frozen days (as `balances` does); today's unfrozen picks are shown, and paid once frozen.
  const live = today >= paidFrom() ? (data.picks.get(today) ?? (await dayPicks(sql, userId, today))) : null;
  const pay = questPay(data);
  const level = levelFor(sumBy(everyDay, "tokens"));
  const byDay = new Map(days.map((d) => [d.day, d.tokens]));
  const dayCoins = (day: string) => coinsForTokens(byDay.get(day) ?? 0, day) + (pay.daily.get(day) ?? 0);
  const active = days.filter((d) => d.tokens > 0).map((d) => d.day);
  const streak = streakBonus(active, dayCoins);
  const launched = await launchBonus(sql, userId);
  const places = (top ?? (await podiums(sql, now))).filter((p) => p.userId === userId);
  const spent = await scalar(sql, "SELECT SUM(price) AS n FROM purchases WHERE user_id = ?", userId);
  const wins = places.map((p) => ({ day: p.day, place: p.place, coins: PODIUM_COINS[p.place - 1]! }));
  const raided = raidCoins(raids ?? (await raidHistory(sql, now)), userId);
  const green = (await greenPay(sql, { [userId]: from }, (_, day) => byDay.get(day) ?? 0)).get(userId);
  const earned =
    sumBy(days, (d) => coinsForTokens(d.tokens, d.day)) +
    sumBy(wins, "coins") +
    raided +
    sumBy([...(green?.values() ?? [])], (n) => n) +
    pay.total +
    pay.weekly +
    milestoneCoins(level) +
    levelUpCoins(level) +
    (await badgeAwardCoins(sql, userId)) +
    (await trophyAwardCoins(sql, userId)) +
    sumBy(launched, "coins") +
    streak;
  const since = addDays(today, -29);
  const todays = data.facts.get(today) ?? EMPTY_DAY;
  const counts = data.counts.get(today) ?? EMPTY_COUNTS;
  const todayBase = coinsForTokens(todays.tokens, today) + (pay.daily.get(today) ?? 0);
  const greenToday = green?.get(today) ?? 0;
  const held = await bag(sql, userId);
  return {
    balance: earned - spent + (await ledgerSum(sql, userId)),
    today:
      todayBase +
      greenToday +
      (today >= STREAK_FROM && todays.tokens > 0 ? streakExtra(todayBase, streakNow(active, today)) : 0),
    streak: streakNow(active, today),
    launches: launched.filter((l) => l.day >= addDays(today, -1)),
    raids: raided,
    green: greenToday,
    wins: wins.filter((w) => w.day >= since),
    owned: held.map((r) => r.item),
    items: sumBy(held, "count"),
    quests: (live ?? []).map((q) => questProgress(q, todays, counts, today)),
    trading: !!(await one(
      sql,
      "SELECT 1 FROM trades WHERE (from_id = ? OR to_id = ?) AND at >= ? LIMIT 1",
      userId,
      userId,
      now - TRADE_TTL,
    )),
  };
}

/**
 * `podiums` and `raidHistory`, as `town` keeps them (`podiumsOf`, `raidsOf`): both go over all of usage,
 * so a coin write checks wallets against these rather than working them out again under `serial`.
 */
export interface Kept {
  top: Podium[];
  raids: RaidWeek[];
}

/** Someone who finished a day in the top 3. */
export interface Podium {
  userId: number;
  day: string;
  place: number;
}

/**
 * Every finished day's top 3, newest first. Only days from each player's sign-up day count. It ranks
 * all of `usage_daily`, so `town` keeps it until the world day changes (`podiumsOf`).
 */
export async function podiums(sql: Sql, now: number): Promise<Podium[]> {
  return all(
    sql,
    `SELECT user_id AS userId, day, place FROM (
       SELECT user_id, day, ROW_NUMBER() OVER (PARTITION BY day ORDER BY SUM(${TOKENS}) DESC, user_id) AS place
       FROM usage_daily JOIN json_each(?) s ON user_id = CAST(s.key AS INTEGER) AND day >= s.value
       WHERE day < ? GROUP BY user_id, day)
     WHERE place <= ? ORDER BY day DESC`,
    JSON.stringify(await signupDays(sql)),
    dayKey(now),
    PODIUM_COINS.length,
  );
}

/**
 * Every user's balance, for the admin page: `wallet`'s sums over everyone at once.
 * ponytail: all of `usage_daily` and `activity_daily` per call, like the leaderboards.
 */
export async function balances(sql: Sql, now: number): Promise<Map<number, number>> {
  const signups = await signupDays(sql);
  const firstDay = JSON.stringify(signups);
  const out = new Map(Object.keys(signups).map((id) => [Number(id), 0]));
  const add = (userId: number, n: number) => {
    const had = out.get(userId);
    if (had !== undefined) out.set(userId, had + n);
  };
  const days = await all<{ userId: number; day: string; tokens: number }>(
    sql,
    `SELECT user_id AS userId, day, SUM(${TOKENS}) AS tokens
     FROM usage_daily JOIN json_each(?) s ON user_id = CAST(s.key AS INTEGER) AND day >= s.value
     GROUP BY user_id, day`,
    firstDay,
  );
  const tokenDays = new Map<number, Map<string, number>>();
  for (const d of days) {
    add(d.userId, coinsForTokens(d.tokens, d.day));
    if (d.tokens > 0) tokenDays.set(d.userId, (tokenDays.get(d.userId) ?? new Map()).set(d.day, d.tokens));
  }
  const dailies = new Map<number, Map<string, number>>();
  for (const [userId, d] of await loadQuestData(sql, signups)) {
    const pay = questPay(d);
    add(userId, pay.total + pay.weekly);
    dailies.set(userId, pay.daily);
  }
  for (const [userId, byDay] of await greenPay(sql, signups, (id, day) => tokenDays.get(id)?.get(day) ?? 0))
    for (const n of byDay.values()) add(userId, n);
  for (const [userId, byDay] of tokenDays)
    add(
      userId,
      streakBonus(
        [...byDay.keys()],
        (day) => coinsForTokens(byDay.get(day) ?? 0, day) + (dailies.get(userId)?.get(day) ?? 0),
      ),
    );
  for (const p of await podiums(sql, now)) add(p.userId, PODIUM_COINS[p.place - 1]!);
  for (const [userId, tokens] of await tokensIn(sql, "all")) {
    const level = levelFor(tokens);
    add(userId, milestoneCoins(level) + levelUpCoins(level));
  }
  for (const r of await all<{ userId: number; tier: number }>(
    sql,
    "SELECT user_id AS userId, tier FROM badge_awards WHERE badge != 'level'",
  ))
    add(r.userId, badgeCoins(r.tier) - badgeCoins(r.tier - 1));
  for (const [userId, n] of await trophyAwardCoinsAll(sql)) add(userId, n);
  for (const [userId, n] of await launchBonusAll(sql)) add(userId, n);
  const raids = await raidHistory(sql, now);
  for (const userId of out.keys()) add(userId, raidCoins(raids, userId));
  for (const r of await all<{ userId: number; n: number }>(
    sql,
    "SELECT user_id AS userId, -SUM(price) AS n FROM purchases GROUP BY user_id",
  ))
    add(r.userId, r.n);
  for (const r of await all<{ userId: number; n: number }>(
    sql,
    "SELECT user_id AS userId, SUM(amount) AS n FROM ledger GROUP BY user_id",
  ))
    add(r.userId, r.n);
  return out;
}

/**
 * One coin into the fountain: a ledger line (kind `fountain`, ref `fountain:<day>:<n>`, never positive), and
 * the day's fountain quest counts it. Run it serialized with every other coin write.
 */
export async function tossCoin(sql: Sql, userId: number, now: number, kept?: Kept): Promise<void> {
  if ((await wallet(sql, userId, now, kept)).balance < 1)
    throw new UserError("Not a coin to spare right now.", { code: "too_poor" });
  const day = dayKey(now);
  const n = await scalar(
    sql,
    "SELECT COUNT(*) AS n FROM ledger WHERE user_id = ? AND kind = 'fountain' AND ref LIKE ?",
    userId,
    `fountain:${day}:%`,
  );
  const ref = `fountain:${day}:${n + 1}`;
  await ledgerAdd(sql, userId, -1, "fountain", ref, now);
  await bumpCount(sql, userId, day, "fountain", ref);
}

/**
 * A treat for `userId`'s pet: `TREAT_COST` coins out of the wallet (a ledger line, kind `pet`, ref
 * `treat:<day>:<n>`, never positive), at most `TREATS_PER_DAY` a world day, counted from the ledger itself. Gives
 * nothing back: the pet's reaction is cosmetic, so the coins are a sink. Returns the treats left today. Run it
 * serialized with every other coin write, so two at once can't both pass the count or spend the same coins.
 */
export async function treatPet(sql: Sql, userId: number, now: number, kept?: Kept): Promise<number> {
  const day = dayKey(now);
  const given = await scalar(
    sql,
    "SELECT COUNT(*) AS n FROM ledger WHERE user_id = ? AND kind = 'pet' AND ref LIKE ?",
    userId,
    `treat:${day}:%`,
  );
  if (given >= TREATS_PER_DAY) throw new UserError("That's plenty of treats for today.", { code: "limit" });
  if ((await wallet(sql, userId, now, kept)).balance < TREAT_COST)
    throw new UserError(`A treat is 🪙 ${TREAT_COST}.`, { code: "too_poor" });
  await ledgerAdd(sql, userId, -TREAT_COST, "pet", `treat:${day}:${given + 1}`, now);
  return TREATS_PER_DAY - given - 1;
}

/**
 * An admin sets `userId`'s balance: the difference goes in the ledger (kind and ref `admin`),
 * since balances are worked out rather than stored. Run it serialized with every other coin write.
 */
export async function setBalance(
  sql: Sql,
  userId: number,
  balance: number,
  now: number,
  kept?: Kept,
): Promise<{ before: number; balance: number }> {
  const before = (await wallet(sql, userId, now, kept)).balance;
  if (balance !== before) await ledgerAdd(sql, userId, balance - before, "admin", "admin", now);
  return { before, balance };
}

/**
 * Pays for one more `item` from `userId`'s coins and puts it in their bag. Run it serialized, so two
 * buys can't both spend the same coins. A holiday costume is sold only round its holiday (`onSale`).
 */
export async function buy(sql: Sql, userId: number, item: Item, now: number, kept?: Kept): Promise<Wallet> {
  if (item.holiday && !onSale(item, now))
    throw new UserError(offSeason(item.holiday), { code: "not_for_sale" });
  // A dance is learned once: a second copy would do nothing, and it can't be traded on.
  if (item.slot === "dance" && (await holds(sql, userId, item.id)))
    throw new UserError("You know that dance already.", { code: "owned" });
  if ((await wallet(sql, userId, now, kept)).balance < item.price)
    throw new UserError("Not enough coins yet.", { code: "too_poor" });
  // The item first: if the purchase write fails, it was free rather than paid for and lost.
  await giveItem(sql, userId, item.id, now);
  await addPurchase(sql, userId, item.id, item.price, now);
  return wallet(sql, userId, now, kept);
}

/**
 * One of a company's merch (`item.companyId`) into `userId`'s bag. Outsiders pay the full price, into the
 * company wallet (spend in `purchases`, like the shop); its own people get `EMPLOYEE_MERCH_DISCOUNT` off,
 * and a free one only if they don't have one yet. Run it serialized, like `buy`.
 */
export async function buyMerch(
  sql: Sql,
  userId: number,
  item: Item,
  now: number,
  kept?: Kept,
): Promise<Wallet> {
  const company = await one<{ id: number }>(sql, "SELECT id FROM companies WHERE id = ?", item.companyId);
  if (!company) throw new UserError("That company is gone.", { code: "not_found" });
  const employee = (await userById(sql, userId)).companyId === company.id;
  const price = merchPrice(item.id.split(".")[2] as MerchKind, employee);
  if (price === 0 && (await holds(sql, userId, item.id)))
    throw new UserError("You have one already: the free one is one each.", { code: "owned" });
  if ((await wallet(sql, userId, now, kept)).balance < price)
    throw new UserError("Not enough coins yet.", { code: "too_poor" });
  await giveItem(sql, userId, item.id, now);
  if (price > 0) {
    await addPurchase(sql, userId, item.id, price, now);
    await companyLedgerAdd(sql, company.id, userId, price, "merch", item.id, now);
  }
  return wallet(sql, userId, now, kept);
}

/** Someone's office. Every office is open: anyone can walk in. */
export interface Office {
  /** Wallpaper and floor (`decor.ts`); none is the plain one. */
  wall?: string;
  floor?: string;
  /** The biggest size bought (`officeSizeItem`); none is the size that comes with the office. */
  size?: number;
}

/** Every office (or only `userId`'s), by owner. */
export async function offices(sql: Sql, userId: number | null = null): Promise<Record<number, Office>> {
  const rows = await all<{ userId: number; wall: string | null; floor: string | null; size: number | null }>(
    sql,
    `SELECT user_id AS userId, wall, floor,
       (SELECT MAX(CAST(SUBSTR(item, 13) AS INTEGER)) FROM purchases
         WHERE purchases.user_id = offices.user_id AND item LIKE 'office.size.%') AS size
     FROM offices WHERE ? IS NULL OR user_id = ?`,
    userId,
    userId,
  );
  return Object.fromEntries(
    rows.map((r) => [
      r.userId,
      {
        ...(r.wall && { wall: r.wall }),
        ...(r.floor && { floor: r.floor }),
        ...(r.size && { size: r.size }),
      },
    ]),
  );
}

/** Someone's office (plain, with no row yet). */
export const officeOf = async (sql: Sql, userId: number): Promise<Office> =>
  (await offices(sql, userId))[userId] ?? {};

/**
 * A new office's desk and chair, free: two rows already on its floor at the `STARTER_OFFICE` tiles,
 * dropped by its owner, or in their bag if they furnished it before it had a row. Once: the `offices`
 * row says they came. Returns the ones on the floor, for `world`.
 */
export async function starterDrops(sql: Sql, userId: number, now: number): Promise<Drop[]> {
  const [made] = await all(
    sql,
    "INSERT INTO offices (user_id) VALUES (?) ON CONFLICT DO NOTHING RETURNING user_id",
    userId,
  );
  if (!made) return [];
  const room = `office:${userId}` as const;
  const furnished = await one(sql, "SELECT 1 FROM items WHERE owner_id IS NULL AND room = ?", room);
  const drops: Drop[] = [];
  for (const { ch, x, y } of STARTER_OFFICE) {
    const item = `furn.${ch}`;
    if (furnished) {
      await giveItem(sql, userId, item, now);
      continue;
    }
    const [row] = await all<{ id: number }>(
      sql,
      `INSERT INTO items (owner_id, item, at, dropped_by, dropped_at, room, x, y)
       VALUES (NULL, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
      item,
      now,
      userId,
      now,
      room,
      x,
      y,
    );
    drops.push({ id: row!.id, item, room, x, y, by: userId, at: now });
  }
  return drops;
}

// MARK: The ledger: coins moving between players

export type HoldKind = "stake" | "bet";
export type PayKind = "payout" | "refund" | "winnings";
export interface Entry {
  userId: number;
  amount: number;
}

const ledgerSum = (sql: Sql, userId: number): Promise<number> =>
  scalar(sql, "SELECT SUM(amount) AS n FROM ledger WHERE user_id = ?", userId);

/** What each player has in `ref` right now: held coins as positive numbers. */
export async function heldIn(sql: Sql, ref: string): Promise<Map<number, number>> {
  const rows = await all<{ userId: number; n: number }>(
    sql,
    "SELECT user_id AS userId, -SUM(amount) AS n FROM ledger WHERE ref = ? GROUP BY user_id",
    ref,
  );
  // Paid out: the winners' gains cancel the losers' stakes, and nothing is left to give back.
  if (sumBy(rows, "n") <= 0) return new Map();
  return new Map(rows.filter((r) => r.n > 0).map((r) => [r.userId, r.n]));
}

/**
 * Takes each entry's coins into `ref`, from everyone or from nobody. A stake may be at
 * most half your balance, so one bad game can't wipe you out; a side bet just has to fit.
 * Run it serialized with every other coin write, or two holds could spend the same coins.
 */
export async function hold(
  sql: Sql,
  ref: string,
  kind: HoldKind,
  entries: Entry[],
  names: Record<number, string>,
  now: number,
  kept?: Kept,
): Promise<void> {
  const paying = entries.filter((e) => e.amount > 0);
  for (const e of paying) {
    const { balance } = await wallet(sql, e.userId, now, kept);
    const limit = kind === "stake" ? Math.floor(balance / 2) : balance;
    if (e.amount > limit) {
      const who = names[e.userId] ?? "Someone";
      throw new UserError(
        kind === "stake"
          ? `${who} can stake at most 🪙 ${limit} right now (half their coins).`
          : `${who} only has 🪙 ${balance}.`,
        { code: "too_poor" },
      );
    }
  }
  for (const e of paying) await ledgerAdd(sql, e.userId, -e.amount, kind, ref, now);
}

/** Pays coins out of `ref`. Never more than it holds: a pot can't pay out coins nobody put in. */
export async function pay(
  sql: Sql,
  ref: string,
  kind: PayKind,
  entries: Entry[],
  now: number,
): Promise<void> {
  const out = entries.filter((e) => e.amount > 0);
  const held = await scalar(sql, "SELECT -SUM(amount) AS n FROM ledger WHERE ref = ?", ref);
  const total = sumBy(out, "amount");
  if (total > held) throw new Error(`${ref}: paying ${total} but only ${held} held`);
  for (const e of out) await ledgerAdd(sql, e.userId, e.amount, kind, ref, now);
}

/** Gives everyone back what they still have in `ref` (or just `userIds`). */
export async function refund(sql: Sql, ref: string, now: number, userIds?: number[]): Promise<void> {
  const held = await heldIn(sql, ref);
  const back = [...held].filter(([id]) => !userIds || userIds.includes(id));
  await pay(
    sql,
    ref,
    "refund",
    back.map(([userId, amount]) => ({ userId, amount })),
    now,
  );
}

// MARK: Trades: coins and items between two players

export interface Trade {
  fromId: number;
  from: string;
  toId: number;
  to: string;
  give: Side;
  want: Side;
  at: number;
}

/** Offers older than this are gone. */
export const TRADE_TTL = 7 * 24 * 3_600_000;

/** Both ways a trade goes. */
const directions = (t: Trade) => [
  { giverId: t.fromId, giver: t.from, receiverId: t.toId, side: t.give },
  { giverId: t.toId, giver: t.to, receiverId: t.fromId, side: t.want },
];

/** Open offers matching `where` (on `trades`), newest first, with names. */
export async function tradesWhere(sql: Sql, where: string, ...args: unknown[]): Promise<Trade[]> {
  const rows = await all<Omit<Trade, "give" | "want"> & { give: string; want: string }>(
    sql,
    `SELECT from_id AS fromId, f.name AS "from", to_id AS toId, r.name AS "to", give, want, at
     FROM trades JOIN users f ON f.id = from_id JOIN users r ON r.id = to_id
     WHERE ${where} ORDER BY at DESC`,
    ...args,
  );
  return rows.map((r) => ({ ...r, give: JSON.parse(r.give), want: JSON.parse(r.want) }));
}

/** Throws unless each side holds what it gives, out of its office (`not_owned`), and has the coins (`too_poor`). */
export async function checkTrade(sql: Sql, t: Trade, now: number, kept?: Kept): Promise<void> {
  for (const d of directions(t)) {
    const has = await ownedItems(sql, d.giverId);
    for (const id of d.side.items)
      if (!has.includes(id))
        throw new UserError(`${d.giver} doesn't have ${itemById(id)?.name ?? id}.`, { code: "not_owned" });
    if (d.side.coins === 0) continue;
    // Not how many they have: that's theirs to know.
    if ((await wallet(sql, d.giverId, now, kept)).balance < d.side.coins)
      throw new UserError(`${d.giver} can't cover 🪙 ${d.side.coins} right now.`, { code: "too_poor" });
  }
}

/**
 * Moves `give` from `from` to `to` and `want` the other way, all or nothing, and drops the offer:
 * coins in one ref, items as one row of each kind: the newest, so a numbered edition's first copy stays
 * (the vendor sells the newest too). Run it serialized. Throws `too_poor` /
 * `not_owned` when something changed since the offer, and `not_found` when it's gone.
 */
export async function settleTrade(sql: TxSql, t: Trade, now: number, kept?: Kept): Promise<void> {
  await sql.transaction(async (tx) => {
    await checkTrade(tx, t, now, kept);
    // The offer goes with it, so it can't be settled twice; withdrawn or replaced meanwhile, it's gone.
    if (!(await one(tx, "DELETE FROM trades WHERE from_id = ? AND at = ? RETURNING from_id", t.fromId, t.at)))
      throw new UserError("That offer is gone.", { code: "not_found" });
    const ref = `trade:${t.fromId}:${t.at}`;
    const entry = (userId: number, amount: number) => ledgerAdd(tx, userId, amount, "trade", ref, now);
    for (const d of directions(t)) {
      if (d.side.coins > 0) {
        await entry(d.giverId, -d.side.coins);
        await entry(d.receiverId, d.side.coins);
      }
      if (d.side.items.length === 0) continue;
      for (const id of d.side.items)
        await tx.execute(
          `UPDATE items SET owner_id = ? WHERE id =
             (SELECT id FROM items WHERE owner_id = ? AND item = ? ORDER BY id DESC LIMIT 1)`,
          d.receiverId,
          d.giverId,
          id,
        );
      await unwear(tx, d.giverId, d.side.items);
    }
  });
}

/**
 * Nobody wears what they don't hold: each of `items` comes off `userId`'s look when their last one goes.
 * True if anything came off.
 */
export async function unwear(sql: Sql, userId: number, items: string[]): Promise<boolean> {
  const left = await ownedItems(sql, userId);
  const look = lookOf(await userById(sql, userId));
  const off = itemsIn(look).filter((i) => items.includes(i.id) && !left.includes(i.id));
  if (off.length === 0) return false;
  for (const i of off) look[i.slot] = 0;
  if (off.some((i) => i.slot === "pet")) look.petVariant = 0; // its look goes with it
  await sql.execute("UPDATE users SET look = ? WHERE id = ?", JSON.stringify(look), userId);
  return true;
}

// MARK: Drops: items on the floor, in `world`

/** At most this many of one person's drops on the floor at once. */
const DROPS_PER_PERSON = 5;

/**
 * Takes one `item` out of `userId`'s bag for the floor (`owner_id` NULL, with who and when): not a
 * reward (an earned piece, Touched grass, can go: `world` lands it only in their own office), and not past `DROPS_PER_PERSON` (what's in their own office is furniture, not counted).
 * Returns the row's id. Run it serialized, like `buy`.
 * ponytail: with five out elsewhere, furnishing waits too (the room isn't known yet). Count after
 * `placeDrop` answers if anyone minds.
 */
export async function takeOut(sql: Sql, userId: number, item: unknown, now: number): Promise<number> {
  if (!isTradeable(item) && !isKeepsake(item))
    throw new UserError("That one stays with you.", { code: "not_tradeable" });
  const n = await scalar(
    sql,
    "SELECT COUNT(*) AS n FROM items WHERE dropped_by = ? AND owner_id IS NULL AND room IS NOT 'office:' || ?",
    userId,
    userId,
  );
  if (n >= DROPS_PER_PERSON)
    throw new UserError(`You have ${n} things on the floor already. Unclaimed, they come back in an hour.`, {
      code: "too_many",
    });
  const [row] = await all<{ id: number }>(
    sql,
    `UPDATE items SET owner_id = NULL, dropped_by = ?, dropped_at = ? WHERE id =
       (SELECT id FROM items WHERE owner_id = ? AND item = ? ORDER BY id DESC LIMIT 1) RETURNING id`,
    userId,
    now,
    userId,
    item,
  );
  if (!row) throw new UserError("None left in your bag.", { code: "not_owned" });
  return row.id;
}

/** Where `world` put a drop down, so a restarted `world` finds it there (`seed`). Not if it's gone already. */
export async function placed(sql: Sql, d: Drop): Promise<void> {
  await sql.execute(
    "UPDATE items SET room = ?, x = ?, y = ? WHERE id = ? AND owner_id IS NULL",
    d.room,
    d.x,
    d.y,
    d.id,
  );
}

/** Off the floor, from the town's side. */
const OFF_FLOOR = "dropped_by = NULL, dropped_at = NULL, room = NULL, x = NULL, y = NULL, rot = NULL";

/**
 * A drop on `room`'s floor into `userId`'s bag. False if it isn't there any more (the sweeper sent it
 * home, or it was dropped again elsewhere), or `userId` is gone.
 */
export const pickUp = async (sql: Sql, id: number, userId: number, room: string): Promise<boolean> =>
  (
    await all(
      sql,
      `UPDATE items SET owner_id = ?, ${OFF_FLOOR} WHERE id = ? AND owner_id IS NULL AND (room IS NULL OR room = ?)
         AND company_id IS NULL AND id NOT IN (SELECT item_row FROM market_listings)
         AND ? IN (SELECT id FROM users) RETURNING id`,
      userId,
      id,
      room,
      userId,
    )
  ).length > 0 || (await store(sql, id, userId, room));

/** Company furniture taken off its building's floor goes to the storeroom, if a member took it. */
const store = async (sql: Sql, id: number, userId: number, room: string): Promise<boolean> =>
  (
    await all(
      sql,
      `UPDATE items SET room = NULL, x = NULL, y = NULL, rot = NULL WHERE id = ? AND room = ?
         AND company_id = (SELECT company_id FROM users WHERE id = ?) RETURNING id`,
      id,
      room,
      userId,
    )
  ).length > 0;

/** Drops (`ids`, those still on the floor) back in their droppers' bags; a deleted dropper's are gone. */
export async function giveBack(sql: Sql, ids: number[]): Promise<void> {
  if (ids.length === 0) return;
  const list = JSON.stringify(ids);
  // Company furniture goes to its storeroom (a closed company's is gone already).
  await sql.execute(
    "UPDATE items SET room = NULL, x = NULL, y = NULL, rot = NULL WHERE company_id IS NOT NULL AND id IN (SELECT value FROM json_each(?))",
    list,
  );
  const mine = "owner_id IS NULL AND company_id IS NULL AND id IN (SELECT value FROM json_each(?))";
  await sql.execute(`DELETE FROM items WHERE ${mine} AND dropped_by NOT IN (SELECT id FROM users)`, list);
  await sql.execute(`UPDATE items SET owner_id = dropped_by, ${OFF_FLOOR} WHERE ${mine}`, list);
}

/** Drops on the floor since before `before`, for the sweeper: not furniture in its dropper's own office, nor a company's. */
export const unclaimed = async (sql: Sql, before: number): Promise<number[]> =>
  (
    await all<{ id: number }>(
      sql,
      `SELECT id FROM items WHERE owner_id IS NULL AND company_id IS NULL AND dropped_at < ?
       AND room IS NOT 'office:' || dropped_by`,
      before,
    )
  ).map((r) => r.id);

/** Everything on a floor, for `world` starting up (`seed`). */
export const floors = async (sql: Sql): Promise<Drop[]> =>
  (
    await all<Omit<Drop, "co" | "rot"> & { co: number | null; rot: number | null }>(
      sql,
      `SELECT id, item, room, x, y, dropped_by AS "by", dropped_at AS at, company_id AS co, rot FROM items
       WHERE owner_id IS NULL AND room IS NOT NULL`,
    )
  ).map(({ co, rot, ...d }) => ({
    ...d,
    ...(co !== null && { co }),
    ...(rotOf(rot) && { rot: rotOf(rot) }),
  }));
