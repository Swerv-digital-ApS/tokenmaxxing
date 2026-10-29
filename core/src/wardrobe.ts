/**
 * The wardrobe: a big pack of clothes, things to hold, things on your back, and gear for your pet.
 * Each one is an `Item` like the rest of the shop (same ids, same bag, same trades), with a rarity and
 * a line of flavour. Most are sold; the rarest few are level rewards, so you can only earn them.
 * Indices are stored in looks and bags: add to the end, never reorder.
 */
import { type Wearable, wearableItem } from "./headwear.ts";
import type { Item } from "./shop.ts";

/** Slots only the wardrobe fills: in a hand, on the back, on the pet. 0 is none, like glasses. */
export type WardrobeSlot = "held" | "back" | "petwear";

/** One of the wardrobe: `slot` and `index` are its place in a look. */
interface Entry extends Wearable {
  slot: "outfit" | WardrobeSlot;
  index: number;
}

// Prices: a heavy day earns ~30 coins, so a common is a few days, an epic a month.
// A catalog reads best one to a line.
// prettier-ignore
const ENTRIES: readonly Entry[] = [
  // Outfits, after the shop's 8–12.
  { slot: "outfit", index: 13, name: "Hoodie of infinite context", rarity: "epic", price: 700, blurb: "Never forgets. Never compacts. Slightly warm." },
  { slot: "outfit", index: 14, name: "Rain jacket (Copenhagen edition)", rarity: "common", price: 240, blurb: "Rated for horizontal rain and bike lanes." },
  { slot: "outfit", index: 15, name: "Lab coat", rarity: "common", price: 210, blurb: "For running experiments in prod." },
  { slot: "outfit", index: 16, name: "Flannel shirt", rarity: "common", price: 165, blurb: "Standard issue for a Rust rewrite." },
  { slot: "outfit", index: 17, name: "Founder vest", rarity: "rare", price: 260, blurb: "Pockets for a term sheet and a protein bar." },
  { slot: "outfit", index: 18, name: "Merge-conflict sweater", rarity: "rare", price: 240, blurb: "<<<<<<< HEAD knitted on the front." },
  { slot: "outfit", index: 19, name: "Tuxedo", rarity: "rare", price: 420, blurb: "For the launch party and the post-mortem." },
  { slot: "outfit", index: 20, name: "Space suit", rarity: "epic", price: 850, blurb: "Pressurised for zero-latency environments." },
  { slot: "outfit", index: 21, name: "Retro tracksuit", rarity: "common", price: 225, blurb: "Three stripes, zero sprints." },
  { slot: "outfit", index: 22, name: "Denim overalls", rarity: "common", price: 195, blurb: "Built to ship. Also to farm." },
  { slot: "outfit", index: 23, name: "Prompt wizard robe", rarity: "epic", price: 950, blurb: "Stars stitched by a temperature of 1.0." },
  { slot: "outfit", index: 24, name: "Hazard vest", rarity: "common", price: 135, blurb: "Worn when touching the billing code." },
  { slot: "outfit", index: 25, name: "Golden regalia", rarity: "legendary", level: 50, blurb: "Ermine, rubies and a sash: the top of the leaderboard, worn." },
  // In your hand.
  { slot: "held", index: 1, name: "Coffee mug", rarity: "common", price: 90, blurb: "World's okayest engineer." },
  { slot: "held", index: 2, name: "Rubber duck", rarity: "rare", level: 5, blurb: "Listens to every bug. Judges none." },
  { slot: "held", index: 3, name: "Laptop with stickers", rarity: "rare", price: 320, blurb: "Resale value: zero. Vibes: immaculate." },
  { slot: "held", index: 4, name: "Bubble tea", rarity: "common", price: 120, blurb: "Tapioca-driven development." },
  { slot: "held", index: 5, name: "Mechanical keyboard", rarity: "rare", price: 220, blurb: "Clicky. Your neighbours know." },
  { slot: "held", index: 6, name: "Pizza slice", rarity: "common", price: 105, blurb: "The fuel of every hackathon." },
  { slot: "held", index: 7, name: "Energy drink", rarity: "common", price: 90, blurb: "Tastes like a 3 a.m. deploy." },
  { slot: "held", index: 8, name: "Magnifying glass", rarity: "rare", price: 300, blurb: "For finding the missing semicolon." },
  { slot: "held", index: 9, name: "Fire extinguisher", rarity: "epic", price: 500, blurb: "Point at prod. Squeeze." },
  { slot: "held", index: 10, name: "Baguette", rarity: "common", price: 135, blurb: "Long-context bread." },
  // On your back.
  { slot: "back", index: 1, name: "Cape", rarity: "epic", level: 15, blurb: "Not all heroes write tests." },
  { slot: "back", index: 2, name: "Jetpack", rarity: "legendary", level: 25, blurb: "Ship faster. Literally." },
  { slot: "back", index: 3, name: "Backpack", rarity: "common", price: 180, blurb: "Charger, snacks, and one mystery cable." },
  { slot: "back", index: 4, name: "Pixel wings", rarity: "legendary", price: 1800, blurb: "Eight bits of pure ascension." },
  { slot: "back", index: 5, name: "Guitar", rarity: "rare", price: 350, blurb: "Knows one song, and it's Wonderwall." },
  { slot: "back", index: 6, name: "Yoga mat", rarity: "common", price: 150, blurb: "Downward-facing debugger." },
  { slot: "back", index: 7, name: "Katana", rarity: "epic", price: 650, blurb: "Cuts scope cleanly." },
  // On your pet.
  { slot: "petwear", index: 1, name: "Red bandana", rarity: "common", price: 90, blurb: "Very good dog energy, any species." },
  { slot: "petwear", index: 2, name: "Pink bow", rarity: "common", price: 90, blurb: "Adorable, and it knows it." },
  { slot: "petwear", index: 3, name: "Bow tie", rarity: "rare", price: 210, blurb: "For pets who attend standups." },
  { slot: "petwear", index: 4, name: "Party hat", rarity: "rare", price: 240, blurb: "Every merge is a birthday." },
  { slot: "petwear", index: 5, name: "Gold collar", rarity: "epic", price: 450, blurb: "The tag says: 10x pet." },
  { slot: "petwear", index: 6, name: "Propeller cap", rarity: "rare", price: 300, blurb: "Spins up when it's thinking." },
  { slot: "petwear", index: 7, name: "Winter scarf", rarity: "common", price: 135, blurb: "Hygge, for the small ones." },
];

/** How many indices each slot has, none (0) included: for `LOOK_OPTIONS`. */
const count = (slot: Entry["slot"]) =>
  Math.max(0, ...ENTRIES.filter((e) => e.slot === slot).map((e) => e.index)) + 1;
export const WARDROBE_OPTIONS = {
  outfit: count("outfit"),
  held: count("held"),
  back: count("back"),
  petwear: count("petwear"),
};

/** The wardrobe as shop items. */
export const WARDROBE: readonly Item[] = ENTRIES.map((e) => wearableItem(e.slot, e.index, e));
