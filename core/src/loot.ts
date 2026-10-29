/**
 * The raid's loot: each boss has its own table of drops, from a 40% common to a 2% legendary. Every
 * raider a kill pays (`Kill.raiders`) rolls each item in that boss's table on its own, so one kill can
 * give one person several. A roll is a hash of the week, the rung, the raider and the item, so it's the
 * same every time it's worked out: nobody can reroll, a restart changes nothing, and anyone can check
 * it. Loot is worn and placed like shop items (same slots, `shop.ts`), never sold, and tradeable.
 * Pure functions, shared by server and client.
 */
import { sha256 } from "./games/sha256.ts";
import { FACE_COUNT, HAT_COUNT } from "./headwear.ts";
import type { Piece } from "./office.ts";
import { bossAt, type RaidWeek } from "./raid.ts";
import { WARDROBE_OPTIONS } from "./wardrobe.ts";

export type Rarity = "common" | "rare" | "epic" | "legendary";

/** Each rarity's odds on the first lap of the ladder, and how it's shown. */
export const RARITIES: Record<Rarity, { odds: number; label: string; color: string }> = {
  common: { odds: 0.4, label: "Common", color: "#7fcf6a" },
  rare: { odds: 0.2, label: "Rare", color: "#5aa8ff" },
  epic: { odds: 0.1, label: "Epic", color: "#b57cff" },
  legendary: { odds: 0.02, label: "Legendary", color: "#ffc93c" },
};

/** What the odds were before `LOOT_ODDS_FROM`: weeks before it keep them, so no past kill drops anything new. */
export const OLD_ODDS: Record<Rarity, number> = { common: 0.1, rare: 0.025, epic: 0.005, legendary: 0.001 };

/**
 * The first raid week (its Monday) on `RARITIES`' odds. Drops are fixed rolls, worked out again from the
 * kills every time, so raising the odds for every week would hand out an item for every old roll that now
 * comes in under them.
 * ponytail: set to the deploy week when shipping, like `STREAK_FROM`.
 */
export const LOOT_ODDS_FROM = "2026-10-26";

/** Every lap round the ladder ("II", "III"…) multiplies the odds by this, up to `LAP_CAP`. */
export const LAP_BONUS = 1.05;
/** The most the odds ever grow: a 2% legendary is never above 20%, and a 40% common is certain from lap 20 (which is also where `lootOdds` stops them). */
export const LAP_CAP = 10;

type LootSlot = "outfit" | "glasses" | "hat" | "pet" | "furniture";

interface Loot {
  /** The shop's id: `<slot>.<index>`, or `furn.<ch>` for a trophy. */
  id: string;
  slot: LootSlot;
  /** `look[slot]` when worn; a trophy's place in `PIECES` (office.ts). */
  index: number;
  name: string;
  /** The boss that drops it (`Boss.id`). */
  boss: string;
  rarity: Rarity;
  /** A line for its tooltip. */
  blurb: string;
}

/** Trophies are furniture: these are their map tiles (`LEGEND`), after the shop's pieces in `PIECES`. */
export const TROPHIES: readonly Piece[] = [
  { ch: "Y", name: "Golden Hourglass", price: 0 },
  { ch: "V", name: "Golden Rebase", price: 0 },
];

/** Where trophies start in `PIECES`: after the shop's 12 pieces (touched grass included). */
const PIECE_BASE = 12;

/**
 * Where loot starts in each slot: after the shop's, the head pack's and the wardrobe's, so loot never
 * shares an index with something sold. `LOOK_OPTIONS` ends each slot at `LOOT_FIRST + LOOT_COUNT`.
 */
export const LOOT_FIRST = { outfit: WARDROBE_OPTIONS.outfit, glasses: FACE_COUNT, hat: HAT_COUNT, pet: 7 };

const loot = (
  boss: string,
  rarity: Rarity,
  slot: Exclude<LootSlot, "furniture">,
  /** Its place among the slot's loot, from 0. */
  nth: number,
  name: string,
  blurb: string,
): Loot => {
  const index = LOOT_FIRST[slot] + nth;
  return { id: `${slot}.${index}`, slot, index, name, boss, rarity, blurb };
};
const trophy = (boss: string, ch: string, blurb: string): Loot => {
  const i = TROPHIES.findIndex((t) => t.ch === ch);
  return {
    id: `furn.${ch}`,
    slot: "furniture",
    index: PIECE_BASE + i,
    name: TROPHIES[i]!.name,
    boss,
    rarity: "legendary",
    blurb,
  };
};

/** Every boss's table, commonest first. */
export const LOOT: readonly Loot[] = [
  loot("rate-limit", "common", "hat", 0, "Hourglass hat", "Wear it and time slows down. Retry-After: 5h."),
  loot("rate-limit", "rare", "glasses", 0, "429 shades", "Too many requests to look at."),
  loot("rate-limit", "epic", "pet", 0, "Sand golem", "Made of every second you waited."),
  trophy("rate-limit", "Y", "The Rate Limit's own timer, cast in gold. Put it in your office."),
  loot(
    "context-window",
    "common",
    "glasses",
    1,
    "Pane glasses",
    "Four little windows. Still can't see it all.",
  ),
  loot("context-window", "rare", "outfit", 0, "Compacting… scarf", "Summarises itself as you walk."),
  loot("context-window", "epic", "pet", 1, "Goldfish", "Forgot already."),
  loot(
    "context-window",
    "legendary",
    "hat",
    1,
    "Infinite Context Crown",
    "Remembers everything. Everything.",
  ),
  loot("merge-conflict", "common", "outfit", 1, "Two-tone suit", "Ours on the left, theirs on the right."),
  loot("merge-conflict", "rare", "hat", 2, "<<<<<<< HEAD band", "Resolve it yourself."),
  loot("merge-conflict", "epic", "pet", 2, "Forked cat", "Two tails, one history."),
  trophy("merge-conflict", "V", "A clean history, in gold. Put it in your office."),
  loot("hallucination", "common", "glasses", 2, "Third eye", "Sees functions that aren't there."),
  loot("hallucination", "rare", "outfit", 2, "Shimmering cape", "Probably real."),
  loot("hallucination", "epic", "pet", 3, "Ghost", "It says it exists. Trust it."),
  loot(
    "hallucination",
    "legendary",
    "hat",
    3,
    "Mirage Crown",
    "The Hallucination's impossible light, captured in a crown.",
  ),
  loot("invoice", "common", "glasses", 3, "Fine-print specs", "Read the terms. Every one."),
  loot("invoice", "rare", "outfit", 3, "Pinstripe suit", "Itemised, notarised, a little tight."),
  loot("invoice", "epic", "pet", 4, "Piggy bank", "Every coin you owe, rattling."),
  loot("invoice", "legendary", "hat", 4, "Paid in Full crown", "Balance: 0. Forever."),
];

/** How many loot items each slot has (`LOOK_OPTIONS`). */
export const LOOT_COUNT = {
  outfit: LOOT.filter((l) => l.slot === "outfit").length,
  glasses: LOOT.filter((l) => l.slot === "glasses").length,
  hat: LOOT.filter((l) => l.slot === "hat").length,
  pet: LOOT.filter((l) => l.slot === "pet").length,
};

export const lootById = (id: unknown): Loot | undefined => LOOT.find((l) => l.id === id);

/** A boss's table (`Boss.id`), commonest first. */
export const lootOf = (boss: string): Loot[] => LOOT.filter((l) => l.boss === boss);

/** The odds multiplier on lap `level` of the ladder: ×1.05 a lap, at most ×10. */
export const lapBonus = (level: number): number => Math.min(LAP_CAP, LAP_BONUS ** Math.max(0, level - 1));

/**
 * The chance of one roll for `rarity` on lap `level`; `boost` is the dev-only `RAID_LOOT_BOOST`. `week` is
 * the raid week it's rolled in: before `LOOT_ODDS_FROM` the old odds. Without one, today's.
 */
export const lootOdds = (rarity: Rarity, level: number, boost = 1, week?: string): number =>
  Math.min(
    1,
    (week !== undefined && week < LOOT_ODDS_FROM ? OLD_ODDS[rarity] : RARITIES[rarity].odds) *
      lapBonus(level) *
      boost,
  );

/**
 * One roll, in [0, 1): the first 52 bits of sha256("loot:<week>:<rung>:<userId>:<item>"). It drops when
 * it's under the odds. The same inputs always give the same roll, so it can be checked, never rerolled.
 */
export function lootRoll(week: string, rung: number, userId: number, item: string): number {
  const hex = sha256(`loot:${week}:${rung}:${userId}:${item}`);
  return Number.parseInt(hex.slice(0, 13), 16) / 2 ** 52;
}

/** One item that dropped for one raider. */
export interface LootDrop {
  week: string;
  rung: number;
  /** The ladder's level that week (`RungBoss.level`), for the boss's name and its odds. */
  level: number;
  /** The world day the boss fell. */
  day: string;
  userId: number;
  item: string;
  /** Its odds when it dropped, rung and boost included. */
  odds: number;
}

/**
 * Kills already rolled. A past kill never changes, but the town works the raid out every 15 s, and
 * rolling every raider of every kill since the launch is a hash each.
 */
const rolled = new Map<string, readonly LootDrop[]>();
/** About a year of kills, with room for their raiders changing as late syncs land. */
const ROLLED_MAX = 10_000;

/** What one kill dropped: every one of its raiders rolls every item in its boss's table. */
export function killDrops(
  week: string,
  kill: { rung: number; level: number; day: string; raiders: readonly number[] },
  boost = 1,
): readonly LootDrop[] {
  const key = `${week}|${kill.rung}|${kill.level}|${kill.day}|${boost}|${kill.raiders.join()}`;
  const hit = rolled.get(key);
  if (hit) return hit;
  const boss = bossAt(kill.rung, kill.level);
  const table = lootOf(boss.id);
  const out: LootDrop[] = [];
  for (const userId of kill.raiders)
    for (const l of table) {
      const odds = lootOdds(l.rarity, boss.level, boost, week);
      if (lootRoll(week, kill.rung, userId, l.id) < odds)
        out.push({ week, rung: kill.rung, level: kill.level, day: kill.day, userId, item: l.id, odds });
    }
  if (rolled.size >= ROLLED_MAX) rolled.clear();
  rolled.set(key, out);
  return out;
}

/** Everything every kill in `weeks` dropped, in order. */
export const raidDrops = (weeks: readonly RaidWeek[], boost = 1): LootDrop[] =>
  weeks.flatMap((w) => w.kills.flatMap((k) => killDrops(w.week, { ...k, level: w.level }, boost)));

/** "10%", "2.5%", "0.1%", "1%". */
export const oddsText = (odds: number): string => `${Number((odds * 100).toPrecision(3))}%`;

/** What a world-wide announcement of a drop carries (`world.announceLoot`). */
export interface LootNews {
  userId: number;
  name: string;
  item: string;
  rung: number;
  odds: number;
}
