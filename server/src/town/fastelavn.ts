import {
  type Barrel,
  barrelUp,
  CROWN,
  fastelavnYear,
  HITS,
  KING_COINS,
  lootFor,
} from "@tokenmaxxing/core/fastelavn.ts";
import { UserError } from "rivetkit";
import { all, one, type Sql, scalar, type TxSql } from "../actors/shared.ts";
import { giveItem, ledgerAdd } from "./coins.ts";

/**
 * Fastelavn's barrel (`core/src/fastelavn.ts`): every player's whacks a year (`fastelavn_hits`), and who broke
 * it (`fastelavn_king`, one row a year). The whack that breaks it writes the king and pays everyone's loot in
 * the same transaction as the whack, and the king's row is the year's key: no restart or race pays twice.
 * Coins go in the `ledger` (kind `fastelavn`, ref the year), items into the bag.
 */
export async function migrateFastelavn(sql: Sql): Promise<void> {
  await sql.execute(`CREATE TABLE IF NOT EXISTS fastelavn_hits (
    year INTEGER NOT NULL, user_id INTEGER NOT NULL, hits INTEGER NOT NULL,
    PRIMARY KEY (year, user_id)) WITHOUT ROWID`);
  await sql.execute(`CREATE TABLE IF NOT EXISTS fastelavn_king (
    year INTEGER PRIMARY KEY, user_id INTEGER NOT NULL, at INTEGER NOT NULL)`);
}

/** The barrel this year: its whacks so far and its king, if it's broken. */
export async function barrel(sql: Sql, now: number): Promise<Barrel> {
  const year = fastelavnYear(now);
  const hits = await scalar(sql, "SELECT SUM(hits) AS n FROM fastelavn_hits WHERE year = ?", year);
  const king = await one<{ id: number; name: string }>(
    sql,
    // A king whose account has gone still broke it.
    `SELECT k.user_id AS id, COALESCE(u.name, 'someone') AS name
     FROM fastelavn_king k LEFT JOIN users u ON u.id = k.user_id WHERE k.year = ?`,
    year,
  );
  return { year, hits: Math.min(HITS, hits), king: king ?? null };
}

/** What a whack did: the barrel after it, and, when it broke the barrel, what everyone found in it. */
export interface Whack {
  barrel: Barrel;
  /** Only on the whack that broke it: every whacker's loot (the king's crown and coins included). */
  loot?: { userId: number; coins: number; items: string[] }[];
}

/** One whack by `userId`. Run it serialized, like the other coin writes. */
export async function whack(sql: TxSql, userId: number, now: number): Promise<Whack> {
  if (!barrelUp(now)) throw new UserError("The barrel hangs on Fastelavn Sunday.", { code: "closed" });
  const year = fastelavnYear(now);
  if ((await barrel(sql, now)).king) return { barrel: await barrel(sql, now) };
  const loot = await sql.transaction(async (tx) => {
    await tx.execute(
      `INSERT INTO fastelavn_hits (year, user_id, hits) VALUES (?, ?, 1)
       ON CONFLICT (year, user_id) DO UPDATE SET hits = hits + 1`,
      year,
      userId,
    );
    const hits = await scalar(tx, "SELECT SUM(hits) AS n FROM fastelavn_hits WHERE year = ?", year);
    if (hits < HITS) return undefined;
    const [fresh] = await all(
      tx,
      "INSERT INTO fastelavn_king (year, user_id, at) VALUES (?, ?, ?) ON CONFLICT DO NOTHING RETURNING year",
      year,
      userId,
      now,
    );
    if (!fresh) return undefined;
    const whackers = await all<{ userId: number }>(
      tx,
      "SELECT user_id AS userId FROM fastelavn_hits WHERE year = ? ORDER BY user_id",
      year,
    );
    const out: NonNullable<Whack["loot"]> = [];
    for (const w of whackers) {
      const found = lootFor(year, w.userId);
      const king = w.userId === userId;
      const coins = found.coins + (king ? KING_COINS : 0);
      const items = [...(found.item ? [found.item] : []), ...(king ? [CROWN] : [])];
      await ledgerAdd(tx, w.userId, coins, "fastelavn", String(year), now);
      for (const item of items) await giveItem(tx, w.userId, item, now);
      out.push({ userId: w.userId, coins, items });
    }
    return out;
  });
  return { barrel: await barrel(sql, now), ...(loot && { loot }) };
}
