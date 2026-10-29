import {
  type LootDrop,
  type LootNews,
  lootById,
  lootOdds,
  lootOf,
  oddsText,
  RARITIES,
  type Rarity,
  raidDrops,
} from "@tokenmaxxing/core/loot.ts";
import { bossAt, type RaidWeek, type RungBoss, raidWeekAt } from "@tokenmaxxing/core/raid.ts";
import { sortBy } from "hanzio";
import type { Client } from "rivetkit/client";
import type { registry } from "../actors/registry.ts";
import { all, main, notify, type Sql, type TxSql } from "../actors/shared.ts";
import { giveItem } from "./coins.ts";

/**
 * `RAID_LOOT_BOOST`, for dev and testing only: every drop's odds times this (checked at boot by
 * `loadConfig`), so a rare drop shows up without waiting for luck. Off (1) unless set.
 */
export const lootBoost = (env = process.env.RAID_LOOT_BOOST): number => (env ? Number(env) : 1);

const keyOf = (d: { week: string; rung: number; userId: number; item: string }) =>
  `${d.week} ${d.rung} ${d.userId} ${d.item}`;

/**
 * Hands out what the kills in `weeks` dropped (`raidDrops`) and hasn't been handed out yet: a `loot` row
 * and the item in the raider's bag, in one transaction, so each drop comes exactly once however often
 * the raid is worked out. Rolls are fixed, so working it out again finds the same drops. Returns the
 * new ones. Run it serialized with every other item write.
 * ponytail: reads every `loot` key per call; keep it to the weeks with kills if that table ever gets big.
 */
export async function grantLoot(
  sql: TxSql,
  weeks: readonly RaidWeek[],
  now: number,
  boost = lootBoost(),
): Promise<LootDrop[]> {
  const drops = raidDrops(weeks, boost);
  if (drops.length === 0) return [];
  const had = await all<{ week: string; rung: number; userId: number; item: string }>(
    sql,
    "SELECT week, rung, user_id AS userId, item FROM loot",
  );
  const given = new Set(had.map(keyOf));
  const fresh = drops.filter((d) => !given.has(keyOf(d)));
  if (fresh.length === 0) return [];
  return sql.transaction(async (tx) => {
    const out: LootDrop[] = [];
    for (const d of fresh) {
      // Deleted meanwhile: nothing for them.
      const [row] = await all(
        tx,
        `INSERT INTO loot (week, rung, user_id, item, odds, at)
         SELECT ?, ?, ?, ?, ?, ? WHERE EXISTS (SELECT 1 FROM users WHERE id = ?)
         ON CONFLICT DO NOTHING RETURNING user_id`,
        d.week,
        d.rung,
        d.userId,
        d.item,
        d.odds,
        now,
        d.userId,
      );
      if (!row) continue;
      await giveItem(tx, d.userId, d.item, now);
      out.push(d);
    }
    return out;
  });
}

const rarityOf = (item: string): Rarity => lootById(item)?.rarity ?? "common";
const baseOdds = (item: string): number => RARITIES[rarityOf(item)].odds;

/** The line for whoever got `drops` (all theirs): the rarest first. */
export function lootNotice(drops: readonly LootDrop[]): string {
  const sorted = sortBy(drops, "odds", (d) => baseOdds(d.item));
  const best = sorted[0]!;
  const boss = bossAt(best.rung, best.level);
  const name = lootById(best.item)?.name ?? best.item;
  const star =
    rarityOf(best.item) === "legendary" ? "🌟 LEGENDARY! " : rarityOf(best.item) === "epic" ? "💜 " : "";
  if (sorted.length === 1) return `${star}✨ You got the ${name} (${oddsText(best.odds)}) from ${boss.name}!`;
  const rest = sorted.slice(1).map((d) => lootById(d.item)?.name ?? d.item);
  return `${star}✨ ${sorted.length} raid drops for you: the ${name} (${oddsText(best.odds)}), ${rest.join(", ")}!`;
}

/** At most this many drops go out to the whole world at once. */
const NEWS_MAX = 40;

/**
 * Tells each winner what they got (one notice each, opening the Bag), and the world what this week's
 * kills dropped (`world.announceLoot`: the dungeon flies it to their desk, the town toasts it). A first
 * run that finds old weeks' drops only tells their winners. Best effort: the items are in the bags.
 */
export async function announceLoot(
  sql: Sql,
  client: Client<typeof registry>,
  fresh: readonly LootDrop[],
  now: number,
): Promise<void> {
  const byUser = new Map<number, LootDrop[]>();
  for (const d of fresh) byUser.set(d.userId, [...(byUser.get(d.userId) ?? []), d]);
  for (const [userId, drops] of byUser)
    await notify(client, userId, { text: lootNotice(drops), open: "bag" });
  const week = raidWeekAt(now);
  const shown = sortBy(
    fresh.filter((d) => d.week === week),
    (d) => baseOdds(d.item),
  ).slice(0, NEWS_MAX);
  if (shown.length === 0) return;
  const names = await all<{ id: number; name: string }>(
    sql,
    "SELECT id, name FROM users WHERE id IN (SELECT value FROM json_each(?))",
    JSON.stringify([...new Set(shown.map((d) => d.userId))]),
  );
  const nameOf = new Map(names.map((u) => [u.id, u.name]));
  const news: LootNews[] = shown.map((d) => ({
    userId: d.userId,
    name: nameOf.get(d.userId) ?? "Someone",
    item: d.item,
    rung: d.rung,
    odds: d.odds,
  }));
  await main(client)
    .world.announceLoot(news)
    .catch((err) => console.warn(`[loot] ${String(err)}`));
}

/** The raid panel's Loot: the boss up now's table, and what this week's kills dropped. */
export interface RaidLoot {
  /** The current boss's items with their odds on its rung, and whether I hold one. */
  table: { item: string; rarity: Rarity; odds: number; owned: boolean }[];
  /** This week's drops, latest rung first and rarest first: who got what. */
  drops: { rung: number; userId: number; name: string; item: string; odds: number }[];
  /** `RAID_LOOT_BOOST`: 1 unless a dev turned the odds up. */
  boost: number;
}

/** At most this many of the week's drops in the panel. */
const DROPS_SHOWN = 60;

export async function raidLoot(
  sql: Sql,
  userId: number | null,
  week: string,
  boss: RungBoss,
  boost = lootBoost(),
): Promise<RaidLoot> {
  const owned = new Set(
    userId === null
      ? []
      : (await all<{ item: string }>(sql, "SELECT DISTINCT item FROM items WHERE owner_id = ?", userId)).map(
          (r) => r.item,
        ),
  );
  const drops = await all<RaidLoot["drops"][number]>(
    sql,
    `SELECT l.rung, l.user_id AS userId, u.name, l.item, l.odds FROM loot l JOIN users u ON u.id = l.user_id
     WHERE l.week = ? ORDER BY l.rung DESC, l.odds, l.at, u.name LIMIT ?`,
    week,
    DROPS_SHOWN,
  );
  return {
    table: lootOf(boss.id).map((l) => ({
      item: l.id,
      rarity: l.rarity,
      odds: lootOdds(l.rarity, boss.level, boost, week),
      owned: owned.has(l.id),
    })),
    // Rarest first within a rung, by rarity: a boosted week's odds can all be 100%.
    drops: drops.sort((a, b) => b.rung - a.rung || baseOdds(a.item) - baseOdds(b.item)),
    boost,
  };
}
