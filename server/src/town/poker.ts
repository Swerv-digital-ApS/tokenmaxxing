import { BUY_IN, DAILY_LOSS_CAP, POKER_GAME } from "@tokenmaxxing/core/poker.ts";
import { dayKey } from "@tokenmaxxing/core/range.ts";
import { UserError } from "rivetkit";
import { all, one, type Sql, scalar, type TxSql } from "../actors/shared.ts";
import { type Kept, ledgerAdd, wallet } from "./coins.ts";

/**
 * The Tavern's poker table, from the wallet's side (`core/poker.ts` has the rules, `world` the table). Sitting
 * down takes the buy-in out of the wallet into a `poker_seats` row; standing up pays the stack back. The
 * hands in between move chips only among stacks, so they never touch the wallet. Every move is a ledger line
 * under one ref, `POKER_REF`, which sums to minus the chips on the table and so never to more than 0.
 *
 * The row holds the stack as of the last settled hand, so a world that goes down mid-hand gives everyone
 * back what they had when it dealt (`pokerRelease`); a seat is paid for once, never twice.
 */
// The ref keeps its old name: the pooled ledger rows from when the table stood in the inn live under it.
export const POKER_REF = "poker:inn";
const DAY_MS = 86_400_000;

export async function migratePoker(sql: Sql): Promise<void> {
  await sql.execute(`CREATE TABLE IF NOT EXISTS poker_seats (
    user_id INTEGER PRIMARY KEY, stack INTEGER NOT NULL, at INTEGER NOT NULL)`);
}

/** What `world` tells the town after a hand ends or someone stands up: every seat's stack, and the seats that left. */
export interface PokerSettle {
  stacks: { userId: number; stack: number }[];
  out: { userId: number; stack: number }[];
}

/** How much `userId` is down at poker since midnight UTC (their buy-ins less what they stood up with); 0 if they are up. */
export async function pokerLoss(sql: Sql, userId: number, now: number): Promise<number> {
  const since = Math.floor(now / DAY_MS) * DAY_MS;
  const net = await scalar(
    sql,
    "SELECT SUM(amount) AS n FROM ledger WHERE user_id = ? AND ref = ? AND at >= ?",
    userId,
    POKER_REF,
    since,
  );
  return Math.max(0, -net);
}

/**
 * Takes the buy-in from `userId`'s wallet for a seat. Throws a `UserError` if they are already at the table, have
 * hit the day's loss limit or can't cover it. Run it serialized with every other coin write.
 */
export async function pokerSit(sql: TxSql, userId: number, now: number, kept?: Kept): Promise<void> {
  await sql.transaction(async (tx) => {
    if (await one(tx, "SELECT 1 FROM poker_seats WHERE user_id = ?", userId))
      throw new UserError("You're at the poker table already.", { code: "seated" });
    const loss = await pokerLoss(tx, userId, now);
    if (loss + BUY_IN > DAILY_LOSS_CAP)
      throw new UserError(
        `The Tavern calls it a night: you're down 🪙 ${loss} at poker today, and 🪙 ${DAILY_LOSS_CAP} is the limit. Back tomorrow.`,
        { code: "loss_limit" },
      );
    const { balance } = await wallet(tx, userId, now, kept);
    if (balance < BUY_IN)
      throw new UserError(`A seat costs 🪙 ${BUY_IN}, and you have 🪙 ${balance}.`, { code: "too_poor" });
    await ledgerAdd(tx, userId, -BUY_IN, "poker", POKER_REF, now);
    await tx.execute("INSERT INTO poker_seats (user_id, stack, at) VALUES (?, ?, ?)", userId, BUY_IN, now);
  });
}

const sumOf = (rows: { stack: number }[]): number => rows.reduce((n, r) => n + r.stack, 0);

/**
 * Writes down the table's stacks and pays the seats that left. All or nothing, and the same call twice is
 * fine (a seat already paid is skipped). Throws if the stacks don't add up to what the rows held: coins
 * the table made or lost are a bug, not something to write down.
 */
export async function pokerSettle(sql: TxSql, s: PokerSettle, now: number): Promise<void> {
  await sql.transaction(async (tx) => {
    const ids = [...s.stacks, ...s.out].map((e) => e.userId);
    const rows = await all<{ userId: number; stack: number }>(
      tx,
      "SELECT user_id AS userId, stack FROM poker_seats WHERE user_id IN (SELECT value FROM json_each(?))",
      JSON.stringify(ids),
    );
    const has = new Set(rows.map((r) => r.userId));
    const out = s.out.filter((e) => has.has(e.userId));
    for (const e of s.stacks)
      if (!has.has(e.userId)) throw new Error(`poker: ${e.userId} is not seated, but has a stack`);
    if (sumOf(rows) !== sumOf(s.stacks) + sumOf(out))
      throw new Error(
        `poker: stacks add up to ${sumOf(s.stacks) + sumOf(out)}, the rows held ${sumOf(rows)}`,
      );
    for (const e of s.stacks)
      await tx.execute("UPDATE poker_seats SET stack = ? WHERE user_id = ?", e.stack, e.userId);
    for (const e of out) {
      if (e.stack > 0) await ledgerAdd(tx, e.userId, e.stack, "poker", POKER_REF, now);
      await tx.execute("DELETE FROM poker_seats WHERE user_id = ?", e.userId);
      // A seat is a game played: one where nothing changed hands (sat down, stood up) doesn't count.
      if (e.stack !== BUY_IN) await recordSession(tx, e.userId, e.stack, now);
    }
  });
}

/** One seat as a game in `match_players`: the buy-in is the stake, the stack stood up with is what was won. */
async function recordSession(tx: Sql, userId: number, stack: number, now: number): Promise<void> {
  // Arcade matches count up from 1; a seat counts down from -1, so the two never share an id.
  const id = Math.min(0, await scalar(tx, "SELECT MIN(match_id) AS n FROM match_players")) - 1;
  await tx.execute(
    `INSERT INTO match_players (match_id, user_id, game, place, stake, won, pot, day, at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    userId,
    POKER_GAME,
    stack > BUY_IN ? 1 : 2,
    BUY_IN,
    stack,
    stack,
    dayKey(now),
    now,
  );
}

/** The world forgot its table (it woke up fresh): everyone still down as seated gets their stack back. */
export async function pokerRelease(sql: TxSql, now: number): Promise<number> {
  const rows = await all<{ userId: number; stack: number }>(
    sql,
    "SELECT user_id AS userId, stack FROM poker_seats",
  );
  if (rows.length > 0) await pokerSettle(sql, { stacks: [], out: rows }, now);
  return rows.length;
}
