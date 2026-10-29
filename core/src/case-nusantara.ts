/**
 * The Nusantara case: cosmetics only a case opening gives, never sold in a shop and never dropped by a raid.
 * Same shape and rules as the Night Market's (`case.ts`), so they are worn through `Look` the same way, but
 * their indices start at `NUSANTARA_BASE` (400, per slot): the Night Market owns 300 to 399, so the two
 * cases and the shop never meet. The art is keyed by the same indices. Tradeable the moment they're opened.
 * `case.ts` merges these in (`ALL_CASE_ITEMS`, `caseAt`); this file takes only types from it, so it can't loop.
 */
import type { CaseItem, CaseSlot } from "./case.ts";
import type { Rarity } from "./rarity.ts";

/** Look indices from here up to 499, in a case slot, are Nusantara items. */
export const NUSANTARA_BASE = 400;

const entry = (slot: CaseSlot, n: number, name: string, rarity: Rarity, blurb: string): CaseItem => ({
  id: `${slot}.${NUSANTARA_BASE + n}`,
  slot,
  index: NUSANTARA_BASE + n,
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
export const NUSANTARA_ITEMS: readonly CaseItem[] = [
  // Common
  entry("hat", 0, "Blangkon", "common", "A folded batik headcloth with the little knot at the back."),
  entry("hat", 1, "Peci", "common", "Black velvet, worn straight, a touch forward."),
  entry("hat", 2, "Ojek helmet", "common", "Open-face, sticker-scarred, rated for one more shortcut."),
  entry("held", 0, "Es teh", "common", "Sweet iced tea in a knotted bag, straw in. Don't swing it."),
  entry("held", 1, "Angklung", "common", "Shake it for one note. Bring friends for a song."),
  entry("held", 2, "Layang-layang", "common", "A diamond kite, its string tied twice round your wrist."),
  entry("held", 3, "Takraw ball", "common", "Woven rattan, kicked, never dropped. Mostly."),
  entry("glasses", 0, "Kawung specs", "common", "Round frames in batik's four-petal circle pattern."),
  entry("glasses", 1, "Coconut shades", "common", "Half a coconut each. Cooler than they look."),
  entry("outfit", 0, "Batik shirt", "common", "Brown and cream diamonds, ironed for Batik Day."),
  entry("outfit", 1, "Deckhand stripes", "common", "A salt-stiff striped tee off the pinisi crew."),
  // Uncommon
  entry("hat", 3, "Little Bromo", "uncommon", "A crater on your head. It smokes when you stand still."),
  entry("back", 0, "Fruit bakul", "uncommon", "A rattan basket of rambutan, mangosteen and salak, balanced just so."),
  entry("back", 1, "Wayang bundle", "uncommon", "A gunungan and a clown puppet in a bamboo case. Not for display."),
  entry("glasses", 2, "Wayang eyes", "uncommon", "Almond eyes cut from leather, gold-painted, always looking sideways."),
  entry("outfit", 2, "Kebaya", "uncommon", "Teal lace, a gold brooch, an afternoon's patience."),
  entry("outfit", 3, "Silat pangsi", "uncommon", "Loose black, a red sash, a very calm stare."),
  // Rare
  entry("pet", 0, "Komodo", "rare", "Tongue first, tail after. Walks like it has all day."),
  entry("pet", 1, "Tarsier", "rare", "Eyes bigger than its dinner. Clings to your sleeve."),
  entry("pet", 2, "Enggang", "rare", "A casque the colour of sunset, flapping a beat behind you."),
  entry("pet", 3, "Rafflesia", "rare", "A flower bigger than it should be, and it smells worse."),
  entry("outfit", 4, "Songket gala", "rare", "Gold thread through crimson silk, one thread at a time."),
  // Epic
  entry("back", 2, "Dadak merak", "epic", "A fan of peacock eyes the size of a doorway, rising behind you."),
  entry("pet", 4, "Cenderawasih", "epic", "Two long plumes trail behind it, still dancing."),
  entry("pet", 5, "Orangutan", "epic", "The person of the forest, hanging on to your shoulder."),
  entry("outfit", 5, "Ondel-ondel", "epic", "Two metres of parade, red-faced and cheerful, and you're inside it."),
  // Legendary
  entry("aura", 0, "Mega Mendung", "legendary", "A batik cloud drifts round you, stacked and indigo, and drizzles a little."),
  entry("aura", 1, "Gamelan Echo", "legendary", "Bronze ripples spread out from you with every step, as if you were struck."),
  entry("aura", 2, "Wayang Shadows", "legendary", "Little cut-out silhouettes circle you in lamplight."),
  entry("aura", 3, "Padi Gold", "legendary", "Rice stalks sway round your feet while golden grains float up."),
];
