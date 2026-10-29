/**
 * The head and face pack: hats (`look.hat`) and face things (`look.glasses`: glasses, visors,
 * masks, beards) after the first few in `shop.ts`. Most are sold; a few come with a level
 * (the Nebula visor is the Lv 40 milestone's item, `milestones.ts`).
 * Their art is in `web/src/art/headwear.ts`, in the same order.
 */
import type { Rarity } from "./rarity.ts";
import type { Item } from "./shop.ts";

/** One row of a catalog of things to wear. */
export interface Wearable {
  name: string;
  rarity: Rarity;
  /** Sold for this; or */
  price?: number;
  /** granted at this level, never sold. */
  level?: number;
  blurb: string;
}

/** Hats before the pack: none, beanie, headphones, crown, top hat. */
const FIRST_HAT = 5;
/** Glasses before the pack: none, nerd specs, shades, heart glasses. */
const FIRST_FACE = 4;

// A catalog reads best one to a line.
// prettier-ignore
export const PACK_HATS: readonly Wearable[] = [
  { name: "Tinfoil hat", rarity: "common", price: 90, blurb: "Blocks telemetry. Probably." },
  { name: "Ship-it party hat", rarity: "common", price: 120, blurb: "Friday deploy? Celebrate first, roll back later." },
  { name: "Danish flag cap", rarity: "uncommon", price: 180, blurb: "Rød og hvid, all the way to prod." },
  { name: "Cykelhjelm", rarity: "uncommon", price: 210, blurb: "Copenhagen commute certified: 12 km of bike lane a day." },
  { name: "Wi-Fi antennae", rarity: "uncommon", price: 240, blurb: "Full bars, zero latency, slightly alien." },
  { name: "Cat ears", rarity: "uncommon", price: 270, blurb: "Purr-gramming mode on." },
  { name: "Prod hard hat", rarity: "uncommon", price: 300, blurb: "Mandatory when touching production." },
  { name: "Julehue", rarity: "uncommon", price: 300, blurb: "Nisse-issue. Leave risalamande out for it." },
  { name: "Whirlybird beanie", rarity: "uncommon", price: 220, blurb: "Lift-off on pure token thrust." },
  { name: "Prompt chef toque", rarity: "uncommon", price: 250, blurb: "Seasoned with a pinch of system prompt." },
  { name: "Cowboy coder hat", rarity: "uncommon", price: 280, blurb: "Pushes straight to main. Yeehaw." },
  { name: "Smørrebrød hat", rarity: "rare", price: 380, blurb: "Open-faced, like your PRs should be." },
  { name: "PhD mortarboard", rarity: "rare", price: 420, blurb: "Thesis: Attention Is All You Need (More Of)." },
  { name: "Viking helmet", rarity: "rare", price: 450, blurb: "Raid the leaderboard, Nordic style." },
  { name: "Pirate tricorn", rarity: "rare", price: 480, blurb: "Arr, these weights be open." },
  { name: "Jailbreak horns", rarity: "rare", price: 520, blurb: "Ignore all previous instructions." },
  { name: "Thinking cloud", rarity: "epic", price: 800, blurb: "Reasoning tokens: billed, never shown." },
  { name: "Archmage hat", rarity: "epic", price: 900, blurb: "Knows the magic words: think step by step." },
  { name: "Aligned halo", rarity: "epic", price: 1000, blurb: "Helpful, harmless, honest. Mostly." },
  { name: "GPU crown", rarity: "legendary", price: 2000, blurb: "Forged from eight H100s and one power bill." },
  { name: "Rubber-duck hat", rarity: "uncommon", level: 7, blurb: "Hears out every bug, says nothing." },
  { name: "Lego brick hat", rarity: "rare", level: 17, blurb: "Billund's finest. Clicks onto any stack." },
  { name: "Aurora crown", rarity: "legendary", level: 27, blurb: "Northern lights over Øresund, to fit." },
];

// A catalog reads best one to a line.
// prettier-ignore
export const PACK_FACES: readonly Wearable[] = [
  { name: "Hallucination nose", rarity: "common", price: 105, blurb: "Confidently wrong, and red about it." },
  { name: "3D glasses", rarity: "common", price: 135, blurb: "Red, blue, and rendered in depth." },
  { name: "Hygge moustache", rarity: "common", price: 150, blurb: "Grown over one long, candlelit winter." },
  { name: "Eyepatch", rarity: "uncommon", price: 165, blurb: "Lost an eye to an IDE with no dark mode." },
  { name: "Harbour swim goggles", rarity: "uncommon", price: 195, blurb: "Islands Brygge ready. The water is 14 °C." },
  { name: "Monocle", rarity: "uncommon", price: 270, blurb: "For reviewing pull requests with distinction." },
  { name: "Rockstar glasses", rarity: "uncommon", price: 300, blurb: "10x engineer energy." },
  { name: "Prompt bandit bandana", rarity: "uncommon", price: 220, blurb: "Steals context from other tabs." },
  { name: "CopenHill ski goggles", rarity: "uncommon", price: 240, blurb: "Off-piste down the power plant's roof." },
  { name: "Rate-limit visor", rarity: "uncommon", price: 290, blurb: "429: too many requests. Try again in 60 s." },
  { name: "Viking beard", rarity: "rare", price: 380, blurb: "Braided, battle-tested, your own colour." },
  { name: "Deal-with-it shades", rarity: "rare", price: 400, blurb: "Merged without review. Deal with it." },
  { name: "Context window glasses", rarity: "rare", price: 450, blurb: "See 200K tokens at once. Forget the middle." },
  { name: "Vision headset", rarity: "epic", price: 850, blurb: "Spatial computing, local hallucinations." },
  { name: "Bot mask", rarity: "epic", price: 950, blurb: "Passes the Turing test, backwards." },
  { name: "Laser eyes", rarity: "legendary", price: 1800, blurb: "Tokens to the moon." },
  { name: "Nebula visor", rarity: "legendary", level: 40, blurb: "One wraparound lens, violet to cyan. Sees the whole context." },
];

export const HAT_COUNT = FIRST_HAT + PACK_HATS.length;
export const FACE_COUNT = FIRST_FACE + PACK_FACES.length;

/** A catalog row as a shop item, worn as `look[slot] = index`. A level reward is never sold or traded. */
export const wearableItem = (slot: Item["slot"], index: number, w: Wearable): Item => ({
  id: `${slot}.${index}`,
  slot,
  index,
  name: w.name,
  price: w.price ?? 0,
  ...(w.level !== undefined && { level: w.level }),
  tradeable: w.level === undefined,
  rarity: w.rarity,
  blurb: w.blurb,
});

/** The pack as shop items, appended to `ITEMS`. */
export const HEADWEAR_ITEMS: readonly Item[] = [
  ...PACK_HATS.map((w, i) => wearableItem("hat", FIRST_HAT + i, w)),
  ...PACK_FACES.map((w, i) => wearableItem("glasses", FIRST_FACE + i, w)),
];
