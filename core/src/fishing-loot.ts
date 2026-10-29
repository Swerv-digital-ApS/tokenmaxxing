/**
 * Pond treasures: cosmetics only fishing turns up, never sold, never in a case or a raid. A catch has a 1%
 * chance of one (`TREASURE_ODDS`), but only the day's first `LUCKY_CASTS` catches roll, so a bot on the bank
 * can't empty the pond. Like the cases' (`case.ts`) they are worn through `Look` and tradeable, at their own
 * indices from `FISHING_BASE`, so no range ever meets another. The art is keyed by the same indices.
 */
import type { CaseItem, CaseSlot } from "./case.ts";
import type { Rarity } from "./rarity.ts";

/** Look indices from here up to `FISHING_BASE + 99`, in a case slot, are pond treasures. */
export const FISHING_BASE = 600;

/** A catch's chance of a treasure. */
export const TREASURE_ODDS = 0.01;
/** Catches a world day that can turn one up. */
export const LUCKY_CASTS = 25;
/** Which treasure, once there is one: rare ones most, the legendary one a tenth of the time. */
export const TREASURE_TIERS: Partial<Record<Rarity, number>> = { rare: 0.6, epic: 0.3, legendary: 0.1 };

const entry = (slot: CaseSlot, n: number, name: string, rarity: Rarity, blurb: string): CaseItem => ({
  id: `${slot}.${FISHING_BASE + n}`,
  slot,
  index: FISHING_BASE + n,
  name,
  price: 0,
  tradeable: true,
  rarity,
  blurb,
  case: true,
});

/** Never reorder or reuse: the ids are in bags. Add new ones at the end of their slot. */
// A catalog reads best one item a line.
// prettier-ignore
export const FISHING_ITEMS: readonly CaseItem[] = [
  entry("hat", 0, "Lucky lure hat", "rare", "Seven lures in the band. Not one has ever caught a thing."),
  entry("held", 0, "Golden rod", "rare", "Never needs bait. Mostly needs polishing."),
  entry("back", 0, "Tackle box pack", "rare", "Every hook, lure and sinker you own, rattling with each step."),
  entry("pet", 0, "Axolotl", "epic", "Smiles at everything, and grows back whatever you break."),
  entry("pet", 1, "Pocket kraken", "epic", "Small, for now. The tech debt it's made of is not."),
  entry("aura", 0, "Bubble stream", "legendary", "Bubbles drift up round you and pop in the sun."),
];

export const isTreasure = (id: string): boolean => FISHING_ITEMS.some((i) => i.id === id);

/**
 * A catch's treasure, if it has one: `lucky` is whether the day still has lucky casts left. `owned`: a draw that
 * lands on something already held is drawn again once within its tier, like a case's dupe reroll.
 */
export function rollTreasure(
  lucky: boolean,
  rand: () => number,
  owned: ReadonlySet<string> = new Set(),
): CaseItem | null {
  if (!lucky || rand() >= TREASURE_ODDS) return null;
  const tiers = Object.entries(TREASURE_TIERS) as [Rarity, number][];
  let x = rand();
  let tier = tiers.at(-1)![0];
  for (const [r, p] of tiers) {
    if (x < p) {
      tier = r;
      break;
    }
    x -= p;
  }
  const pool = FISHING_ITEMS.filter((i) => i.rarity === tier);
  const draw = () => pool[Math.min(pool.length - 1, Math.floor(rand() * pool.length))]!;
  const first = draw();
  return owned.has(first.id) ? draw() : first;
}
