/**
 * Dances: started from the dance bar over the chat and kept up until you stop, walk off or sit down.
 * Two are free; the rest are sold at Thread & Token as `dance.<index>` items. One copy is all you
 * need, and they never change hands. The aura dances come from 2025's aura-farming trend (the boat
 * kid on the bow of a Pacu Jalur race boat, anime power-ups and hand signs): they light an aura that
 * grows the longer you keep it up, and two dancers close together are in an aura battle.
 * Indices go out to everyone in `PlayerInfo.dance`: add to the end, never reorder.
 */

import type { Rarity } from "./rarity.ts";
import type { Item } from "./shop.ts";

/** How a dance moves; the client animates each one (`web/src/render3d/people/dances.ts`, `web/src/game/dance.ts`). */
export type DanceMove =
  | "groove"
  | "roof"
  | "floss"
  | "dab"
  | "robot"
  | "sprinkler"
  | "chicken"
  | "disco"
  | "running"
  | "headbang"
  | "griddy"
  | "moonwalk"
  | "horse"
  | "headspin"
  | "boat"
  | "unbothered"
  | "powerup"
  | "domain"
  | "levitate";

export interface Dance {
  /** Its place in a player's `dance` (0 is none) and in its item id, `dance.<index>`. */
  index: number;
  move: DanceMove;
  name: string;
  /** On its button in the dance bar. */
  emoji: string;
  /** Coins; 0 is free for everyone, never in a bag. */
  price: number;
  rarity: Rarity;
  blurb: string;
  /** An aura dance: it lights an aura in this colour that grows as you farm it. */
  aura?: string;
}

// A heavy day earns ~30 coins: a common dance is a few days, a legendary one a couple of months.
// A catalog reads best one to a line.
// prettier-ignore
export const DANCES: readonly Dance[] = [
  { index: 1, move: "groove", name: "Two-step", emoji: "🕺", price: 0, rarity: "common", blurb: "Side to side, on the beat. Everyone knows this one." },
  { index: 2, move: "roof", name: "Raise the roof", emoji: "🙌", price: 0, rarity: "common", blurb: "For a green CI run." },
  { index: 3, move: "floss", name: "The floss", emoji: "🧵", price: 180, rarity: "common", blurb: "Arms one way, hips the other. Harder than it looks." },
  { index: 4, move: "dab", name: "Dab", emoji: "😤", price: 135, rarity: "common", blurb: "Every deploy deserves one. Every single one." },
  { index: 5, move: "robot", name: "The robot", emoji: "🤖", price: 270, rarity: "uncommon", blurb: "Stiff joints, tight loops. Very on brand." },
  { index: 6, move: "sprinkler", name: "Sprinkler", emoji: "💦", price: 165, rarity: "common", blurb: "Rate-limited arm. Waters the whole lawn anyway." },
  { index: 7, move: "chicken", name: "Chicken dance", emoji: "🐔", price: 120, rarity: "common", blurb: "Flap, flap, wiggle. Wedding-certified." },
  { index: 8, move: "disco", name: "Disco point", emoji: "🪩", price: 300, rarity: "uncommon", blurb: "Up to the ceiling, down to the floor. 1977 called." },
  { index: 9, move: "running", name: "Running man", emoji: "🏃", price: 220, rarity: "uncommon", blurb: "All cardio, zero distance. Like sprint planning." },
  { index: 10, move: "headbang", name: "Headbang", emoji: "🤘", price: 195, rarity: "common", blurb: "For when the build finally passes." },
  { index: 11, move: "griddy", name: "The griddy", emoji: "👓", price: 380, rarity: "rare", blurb: "Heel, toe, glasses hands. Touchdown on every merged PR." },
  { index: 12, move: "moonwalk", name: "Moonwalk", emoji: "🌙", price: 500, rarity: "rare", blurb: "Going backwards, smoothly. Like a good rollback." },
  { index: 13, move: "horse", name: "Invisible horse", emoji: "🐎", price: 420, rarity: "rare", blurb: "Ride the hype cycle. Lasso optional." },
  { index: 14, move: "headspin", name: "Headspin", emoji: "🌀", price: 900, rarity: "epic", blurb: "Upside down and spinning, like prod on a Friday." },
  { index: 15, move: "boat", name: "Boat kid", emoji: "🛶", price: 950, rarity: "epic", blurb: "Front of the race boat. Calm hands, cool face, infinite aura.", aura: "#ffd75e" },
  { index: 16, move: "unbothered", name: "Unbothered", emoji: "😎", price: 450, rarity: "rare", blurb: "Arms crossed, slow nod. Farming aura by doing nothing.", aura: "#9ad7ff" },
  { index: 17, move: "powerup", name: "Power-up", emoji: "⚡", price: 1100, rarity: "epic", blurb: "Fists clenched, knees bent. Your token count is over 9,000.", aura: "#fff27a" },
  { index: 18, move: "domain", name: "Domain expansion", emoji: "🤞", price: 1800, rarity: "legendary", blurb: "One hand sign and the whole room is yours.", aura: "#b36bff" },
  { index: 19, move: "levitate", name: "Levitation", emoji: "🧘", price: 2000, rarity: "legendary", blurb: "Cross-legged, eyes shut, a foot off the floor. Peak aura.", aura: "#5ef2d6" },
];

/** Beats a second each dance goes at, in 2D and 3D alike: about 120 bpm, slower for the calm ones. */
const TEMPO: Partial<Record<DanceMove, number>> = {
  floss: 2.4,
  boat: 1.4,
  powerup: 1.5,
  domain: 1,
  unbothered: 0.9,
  levitate: 0.6,
};
export const tempoOf = (move: DanceMove): number => TEMPO[move] ?? 2;

const BY_INDEX = new Map(DANCES.map((d) => [d.index, d]));

export const danceAt = (index: number): Dance | undefined => BY_INDEX.get(index);

export const danceId = (index: number): string => `dance.${index}`;

/** The dance an item id is, if it is one. */
export const danceOfItem = (id: unknown): Dance | undefined =>
  typeof id === "string" && /^dance\.[1-9]\d{0,3}$/.test(id) ? danceAt(Number(id.slice(6))) : undefined;

export const isFree = (d: Dance): boolean => d.price === 0;

/** The dances someone can do: the free ones, and the ones whose item is in `owned`. */
export const knownDances = (owned: readonly string[]): Dance[] =>
  DANCES.filter((d) => isFree(d) || owned.includes(danceId(d.index)));

/** The sold ones as shop items. Never traded: a dance is learned, not handed over. */
export const DANCE_ITEMS: readonly Item[] = DANCES.filter((d) => !isFree(d)).map((d) => ({
  id: danceId(d.index),
  slot: "dance",
  index: d.index,
  name: d.name,
  price: d.price,
  tradeable: false,
  rarity: d.rarity,
  blurb: d.blurb,
}));

// MARK: Aura

/** How long an aura dance takes to farm its aura in full. */
export const AURA_FULL_MS = 30_000;

/** How much aura someone dancing since `since` has farmed by `now`: 0 to 1, eased so it builds and then holds. */
export function auraOf(since: number, now: number): number {
  const k = Math.min(1, Math.max(0, (now - since) / AURA_FULL_MS));
  return 1 - (1 - k) ** 2;
}

/** Tiles apart within which two dancers are in an aura battle. */
export const BATTLE_TILES = 3;

/** Whether two dancers at these tiles are close enough for an aura battle. */
export const inBattle = (a: { x: number; y: number }, b: { x: number; y: number }): boolean =>
  Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y)) <= BATTLE_TILES;
