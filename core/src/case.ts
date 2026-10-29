/**
 * The Night Market case (the Nusantara's are in `case-nusantara.ts`, Ragnarok Eve's in `case-ragnarok.ts`): cosmetics only a case opening gives, never sold in a shop and never dropped
 * by a raid. They are worn through `Look` like the shop's, but their indices start at `CASE_BASE`, so
 * the shop and the loot can grow without the two ever meeting. The art is keyed by the same names.
 * Tradeable the moment they're opened: there is no trade lock.
 */
import { NUSANTARA_ITEMS } from "./case-nusantara.ts";
import { RAGNAROK_ITEMS } from "./case-ragnarok.ts";
import { FISHING_ITEMS } from "./fishing-loot.ts";
import type { Rarity } from "./rarity.ts";
import type { Item } from "./shop.ts";

/** Look indices from here up, in a case slot, are case items. Above the merchant's editions (100) and the holiday costumes (200). */
export const CASE_BASE = 300;

export type CaseSlot = "outfit" | "glasses" | "hat" | "held" | "back" | "pet" | "aura";

export interface CaseItem extends Item {
  slot: CaseSlot;
  rarity: Rarity;
  blurb: string;
  case: true;
}

const entry = (slot: CaseSlot, n: number, name: string, rarity: Rarity, blurb: string): CaseItem => ({
  id: `${slot}.${CASE_BASE + n}`,
  slot,
  index: CASE_BASE + n,
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
export const CASE_ITEMS: readonly CaseItem[] = [
  // Common
  entry("hat", 0, "Straw kasa", "common", "Keeps the rain off the noodles."),
  entry("hat", 1, "Hachimaki", "common", "A twisted headband for the late shift."),
  entry("hat", 2, "Paper fan visor", "common", "Folds flat. Mostly unfolds."),
  entry("held", 0, "Ramen bowl", "common", "Steam rising, chopsticks ready."),
  entry("held", 1, "Paper umbrella", "common", "Oiled paper, bamboo ribs, one good spin."),
  entry("held", 2, "Boombox", "common", "Plays whatever the night market is playing."),
  entry("held", 3, "Skateboard", "common", "For the long way round the stalls."),
  entry("glasses", 0, "LED mask", "common", "A tiny scrolling grin."),
  entry("glasses", 1, "Steam goggles", "common", "Brass rims, fogged up by the noodle cart."),
  entry("outfit", 0, "Noodle apron", "common", "Splashed at the dawn rush."),
  entry("outfit", 1, "Happi coat", "common", "The stall crew's festival coat."),
  // Uncommon
  entry("hat", 3, "Fox half-mask", "uncommon", "Half the face, all of the mystery."),
  entry("back", 0, "Neon drone", "uncommon", "Hovers over your shoulder, lights up the street."),
  entry("back", 1, "Paper lantern pack", "uncommon", "A glowing lantern on your back, swaying as you walk."),
  entry("glasses", 2, "Holo shades", "uncommon", "The night market, reflected in a hologram."),
  entry("outfit", 2, "Cargo bomber", "uncommon", "Pockets for everything you'll buy."),
  entry("outfit", 3, "Techwear coat", "uncommon", "Waterproof, zip-heavy, very black."),
  // Rare
  entry("pet", 0, "Koi", "rare", "Swims through the air a step behind you."),
  entry("pet", 1, "Paper crane", "rare", "Folded from a lucky receipt, flaps when you walk."),
  entry("pet", 2, "Tanuki pup", "rare", "A leaf on its head, a snack in its paws."),
  entry("pet", 3, "Maneki cat", "rare", "One paw up, waving in the customers."),
  entry("outfit", 4, "Dragon satin jacket", "rare", "A dragon coiled up the back, stitched in gold."),
  // Epic
  entry("back", 2, "Neon rain", "epic", "A cloud of neon drizzle follows you down the street."),
  entry("pet", 4, "Kitsune", "epic", "Nine tails, each lit by its own paper lantern."),
  // Legendary
  entry("outfit", 5, "Festival parade", "epic", "The whole parade, on one person, with the lanterns lit."),
  entry("pet", 5, "Tengu", "epic", "A mountain spirit that rides your shoulder and judges the noodles."),
  entry("aura", 0, "Lantern Sky", "legendary", "Paper lanterns drift round you in a slow, glowing ring."),
  entry("aura", 1, "Sakura Storm", "legendary", "Pink petals swirl up around you, then settle."),
  entry("aura", 2, "Firefly Swarm", "legendary", "A summer night's worth of fireflies, blinking along with you."),
  entry("aura", 3, "Koi Current", "legendary", "A ribbon of tiny koi circles you, tails flicking."),
];

/**
 * Every case's cosmetics: the Night Market's (`CASE_ITEMS`, 300 to 399), the Nusantara's (400 to 499), Ragnarok
 * Eve's (500 to 599), then the pond's treasures (`fishing-loot.ts`, 600 to 699), which no case sells but which
 * are worn and drawn the same way.
 */
export const ALL_CASE_ITEMS: readonly CaseItem[] = [
  ...CASE_ITEMS,
  ...NUSANTARA_ITEMS,
  ...RAGNAROK_ITEMS,
  ...FISHING_ITEMS,
];

/** The case item a look index stands for in a slot, if it is one, from any case. */
export const caseAt = (slot: string, index: number): CaseItem | undefined =>
  index >= CASE_BASE ? ALL_CASE_ITEMS.find((c) => c.slot === slot && c.index === index) : undefined;
