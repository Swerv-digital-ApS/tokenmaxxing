import {
  type Bet,
  checkBets,
  type RouletteOutcome,
  settle,
  spinPocket,
} from "@tokenmaxxing/core/roulette.ts";
import { UserError } from "rivetkit";
import { all, one, type Sql, type TxSql } from "../actors/shared.ts";
import { secureRandom } from "./cases.ts";
import { type Kept, ledgerAdd, wallet } from "./coins.ts";

/**
 * The stakes of a round, taken from the wallet when placed. One row per player per round; the world
 * resolves the round (`rouletteResolve`) or the stakes go back (`rouletteRefund`).
 */
export async function migrateRoulette(sql: Sql): Promise<void> {
  await sql.execute(`CREATE TABLE IF NOT EXISTS roulette_bets (
    round INTEGER NOT NULL, user_id INTEGER NOT NULL, bets TEXT NOT NULL, total INTEGER NOT NULL,
    PRIMARY KEY (round, user_id)) WITHOUT ROWID`);
}

const sum = (bets: readonly Bet[]) => bets.reduce((a, b) => a + b.stake, 0);

/**
 * Sets `userId`'s bets for `round` to `rawBets` (an empty list clears them): the difference to what they
 * had down moves in the ledger, in one transaction. Run it serialized with every other coin write.
 */
export async function rouletteBet(
  sql: TxSql,
  userId: number,
  round: number,
  rawBets: unknown,
  now: number,
  kept?: Kept,
): Promise<{ bets: Bet[]; total: number }> {
  let bets: Bet[] = [];
  if (!(Array.isArray(rawBets) && rawBets.length === 0)) {
    const checked = checkBets(rawBets);
    if ("refused" in checked) throw new UserError(checked.refused, { code: "bad_bet" });
    bets = checked.bets;
  }
  const total = sum(bets);
  await sql.transaction(async (tx) => {
    const had =
      (
        await one<{ total: number }>(
          tx,
          "SELECT total FROM roulette_bets WHERE round = ? AND user_id = ?",
          round,
          userId,
        )
      )?.total ?? 0;
    const more = total - had;
    if (more > 0 && (await wallet(tx, userId, now, kept)).balance < more)
      throw new UserError("Not enough coins for that bet.", { code: "too_poor" });
    if (more !== 0) await ledgerAdd(tx, userId, -more, "roulette", "roulette:bet", now);
    if (total === 0)
      await tx.execute("DELETE FROM roulette_bets WHERE round = ? AND user_id = ?", round, userId);
    else
      await tx.execute(
        `INSERT INTO roulette_bets (round, user_id, bets, total) VALUES (?, ?, ?, ?)
         ON CONFLICT (round, user_id) DO UPDATE SET bets = excluded.bets, total = excluded.total`,
        round,
        userId,
        JSON.stringify(bets),
        total,
      );
  });
  return { bets, total };
}

interface Row {
  userId: number;
  bets: string;
  total: number;
}

/**
 * Rolls `round`'s pocket and settles every player's bets against it, in one transaction: the winnings
 * go in the ledger and the round's rows go. `rand` is the server's own; tests pass a seeded one.
 */
export async function rouletteResolve(
  sql: TxSql,
  round: number,
  now: number,
  rand: () => number = secureRandom,
): Promise<{ pocket: number; results: RouletteOutcome[] }> {
  return sql.transaction(async (tx) => {
    const rows = await all<Row>(
      tx,
      "SELECT user_id AS userId, bets, total FROM roulette_bets WHERE round = ? ORDER BY user_id",
      round,
    );
    const pocket = spinPocket(rand);
    const results: RouletteOutcome[] = [];
    for (const r of rows) {
      const s = settle(JSON.parse(r.bets) as Bet[], pocket);
      if (s.payout > 0) await ledgerAdd(tx, r.userId, s.payout, "roulette", "roulette:win", now);
      const name = (await one<{ name: string }>(tx, "SELECT name FROM users WHERE id = ?", r.userId))?.name;
      results.push({ userId: r.userId, name: name ?? "Someone", staked: s.staked, payout: s.payout });
    }
    await tx.execute("DELETE FROM roulette_bets WHERE round = ?", round);
    return { pocket, results };
  });
}

/** Gives `userId` their stakes for `round` back (the whole table's, if `userId` is omitted: any round). Returns the coins. */
export async function rouletteRefund(
  sql: TxSql,
  now: number,
  userId?: number,
  round?: number,
): Promise<number> {
  return sql.transaction(async (tx) => {
    const rows = await all<{ round: number; userId: number; total: number }>(
      tx,
      `SELECT round, user_id AS userId, total FROM roulette_bets
       WHERE (? IS NULL OR user_id = ?) AND (? IS NULL OR round = ?)`,
      userId ?? null,
      userId ?? null,
      round ?? null,
      round ?? null,
    );
    for (const r of rows) {
      await ledgerAdd(tx, r.userId, r.total, "roulette", "roulette:refund", now);
      await tx.execute("DELETE FROM roulette_bets WHERE round = ? AND user_id = ?", r.round, r.userId);
    }
    return rows.reduce((a, r) => a + r.total, 0);
  });
}
