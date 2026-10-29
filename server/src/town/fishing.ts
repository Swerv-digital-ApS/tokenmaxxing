import type { BadgeFacts } from "@tokenmaxxing/core/badges.ts";
import {
  ANSWER_CM,
  type FishCatch,
  type FishingEntry,
  type FishingState,
  fishById,
  hasRecord,
  journalFacts,
  type Luck,
  type PondRecord,
  type Treasure,
} from "@tokenmaxxing/core/fishing.ts";
import { FISHING_ITEMS, LUCKY_CASTS, rollTreasure } from "@tokenmaxxing/core/fishing-loot.ts";
import { dayKey } from "@tokenmaxxing/core/range.ts";
import { UserError } from "rivetkit";
import { all, one, type Sql, scalar, type TxSql } from "../actors/shared.ts";
import { secureRandom } from "./cases.ts";
import { giveItem } from "./coins.ts";

/**
 * The pond, as the town keeps it: everyone's journal (a row per species, with the count and the best), how many
 * catches each has had today (the first `LUCKY_CASTS` can turn up a treasure), the record for each species, every
 * treasure found, and the one-off feats (a 42 cm catch).
 */
export async function migrateFishing(sql: Sql): Promise<void> {
  await sql.execute(`CREATE TABLE IF NOT EXISTS fishing_journal (
    user_id INTEGER NOT NULL, fish TEXT NOT NULL, count INTEGER NOT NULL, cm INTEGER NOT NULL,
    PRIMARY KEY (user_id, fish)) WITHOUT ROWID`);
  await sql.execute(`CREATE TABLE IF NOT EXISTS fishing_days (
    user_id INTEGER NOT NULL, day TEXT NOT NULL, catches INTEGER NOT NULL,
    PRIMARY KEY (user_id, day)) WITHOUT ROWID`);
  await sql.execute(`CREATE TABLE IF NOT EXISTS fishing_records (
    fish TEXT PRIMARY KEY, user_id INTEGER NOT NULL, cm INTEGER NOT NULL, at INTEGER NOT NULL) WITHOUT ROWID`);
  await sql.execute(`CREATE TABLE IF NOT EXISTS fishing_treasures (
    id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL, item TEXT NOT NULL, at INTEGER NOT NULL)`);
  await sql.execute("CREATE INDEX IF NOT EXISTS fishing_treasures_user ON fishing_treasures (user_id)");
  await sql.execute(`CREATE TABLE IF NOT EXISTS fishing_feats (
    user_id INTEGER NOT NULL, feat TEXT NOT NULL, at INTEGER NOT NULL,
    PRIMARY KEY (user_id, feat)) WITHOUT ROWID`);
}

export function fishingJournal(sql: Sql, userId: number): Promise<FishingEntry[]> {
  return all<FishingEntry>(
    sql,
    "SELECT fish, count, cm FROM fishing_journal WHERE user_id = ? ORDER BY fish",
    userId,
  );
}

/** The day's lucky casts left for `userId`. */
export async function luckOf(sql: Sql, userId: number, now: number): Promise<Luck> {
  const used =
    (
      await one<{ catches: number }>(
        sql,
        "SELECT catches FROM fishing_days WHERE user_id = ? AND day = ?",
        userId,
        dayKey(now),
      )
    )?.catches ?? 0;
  return { left: Math.max(0, LUCKY_CASTS - used), of: LUCKY_CASTS };
}

/** The pond's records, with their holders' names. */
export function pondRecords(sql: Sql): Promise<PondRecord[]> {
  return all<PondRecord>(
    sql,
    `SELECT r.fish, r.cm, r.user_id AS userId, COALESCE(u.name, 'Someone') AS name
     FROM fishing_records r LEFT JOIN users u ON u.id = r.user_id ORDER BY r.fish`,
  );
}

/** The treasures `userId` has found, one id per find, oldest first. */
export async function treasuresOf(sql: Sql, userId: number): Promise<string[]> {
  return (
    await all<{ item: string }>(
      sql,
      "SELECT item FROM fishing_treasures WHERE user_id = ? ORDER BY id",
      userId,
    )
  ).map((r) => r.item);
}

/** Everything the fishing panel opens with. */
export async function fishingState(sql: Sql, userId: number, now: number): Promise<FishingState> {
  return {
    journal: await fishingJournal(sql, userId),
    luck: await luckOf(sql, userId, now),
    records: await pondRecords(sql),
    treasures: await treasuresOf(sql, userId),
  };
}

/** What happened on a catch, past the journal: whether it set a record, and any treasure. */
export interface Landed {
  journal: FishingEntry[];
  luck: Luck;
  record: boolean;
  treasure: Treasure | null;
}

/**
 * Called only by the world after an on-time reel. The journal keeps the count and the best; the day's catch
 * count decides whether the treasure rolls (`rand` is the server's own; tests pass a seeded one); a longer catch
 * than the pond's record takes it (a tie leaves it with whoever got there first). One transaction, so a treasure
 * is never given without its catch.
 */
export async function recordFish(
  sql: TxSql,
  userId: number,
  caught: FishCatch,
  now: number,
  rand: () => number = secureRandom,
): Promise<Landed> {
  const fish = caught && fishById(caught.fish);
  if (!fish || !Number.isInteger(caught.cm) || caught.cm < fish.min || caught.cm > fish.max)
    throw new UserError("Invalid catch.", { code: "invalid_catch" });
  const day = dayKey(now);
  const landed = await sql.transaction(async (tx) => {
    await tx.execute(
      `INSERT INTO fishing_journal (user_id, fish, count, cm) VALUES (?, ?, 1, ?)
      ON CONFLICT (user_id, fish) DO UPDATE SET count = count + 1, cm = MAX(cm, excluded.cm)`,
      userId,
      fish.id,
      caught.cm,
    );
    const { catches } = (await one<{ catches: number }>(
      tx,
      `INSERT INTO fishing_days (user_id, day, catches) VALUES (?, ?, 1)
      ON CONFLICT (user_id, day) DO UPDATE SET catches = catches + 1 RETURNING catches`,
      userId,
      day,
    ))!;
    let record = false;
    if (hasRecord(fish.id)) {
      const held = await one<{ cm: number }>(tx, "SELECT cm FROM fishing_records WHERE fish = ?", fish.id);
      if (!held || caught.cm > held.cm) {
        await tx.execute(
          `INSERT INTO fishing_records (fish, user_id, cm, at) VALUES (?, ?, ?, ?)
          ON CONFLICT (fish) DO UPDATE SET user_id = excluded.user_id, cm = excluded.cm, at = excluded.at`,
          fish.id,
          userId,
          caught.cm,
          now,
        );
        record = true;
      }
    }
    if (caught.cm === ANSWER_CM)
      await tx.execute(
        "INSERT INTO fishing_feats (user_id, feat, at) VALUES (?, 'answer', ?) ON CONFLICT DO NOTHING",
        userId,
        now,
      );
    const owned = new Set(
      (await all<{ item: string }>(tx, "SELECT item FROM fishing_treasures WHERE user_id = ?", userId)).map(
        (r) => r.item,
      ),
    );
    const found = rollTreasure(catches <= LUCKY_CASTS, rand, owned);
    if (found) {
      await tx.execute(
        "INSERT INTO fishing_treasures (user_id, item, at) VALUES (?, ?, ?)",
        userId,
        found.id,
        now,
      );
      await giveItem(tx, userId, found.id, now);
    }
    return {
      record,
      treasure: found && { item: found.id },
      luck: { left: Math.max(0, LUCKY_CASTS - catches), of: LUCKY_CASTS },
    };
  });
  return { journal: await fishingJournal(sql, userId), ...landed };
}

/** The badges' fishing facts for `userId` (`badgeFactsOf`). */
export async function fishingFacts(sql: Sql, userId: number): Promise<Partial<BadgeFacts>> {
  const j = journalFacts(await fishingJournal(sql, userId));
  const treasures = new Set(await treasuresOf(sql, userId));
  return {
    fishCaught: j.caught,
    fishSpecies: j.species,
    fishSpecimens: j.specimens,
    fishGolds: j.golds,
    fishTreasures: FISHING_ITEMS.filter((i) => treasures.has(i.id)).length,
    fishRecords: await scalar(sql, "SELECT COUNT(*) AS n FROM fishing_records WHERE user_id = ?", userId),
    fishAnswer: await scalar(
      sql,
      "SELECT COUNT(*) AS n FROM fishing_feats WHERE user_id = ? AND feat = 'answer'",
      userId,
    ),
  };
}
