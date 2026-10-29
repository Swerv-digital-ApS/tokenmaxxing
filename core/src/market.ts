/**
 * Torvehallen, the market hall: a player puts one of their own items on a display slot in the hall and
 * names a price; anyone standing in the hall buys it at that price. The rules here are pure; the money and
 * the items are `server/src/town/market.ts`. Coins move zero-sum, with no tax: the seller gets the price.
 */
import { type Rarity, rarityOf } from "./rarity.ts";
import { isTradeable, itemById } from "./shop.ts";
import { SHOPS } from "./shoprooms.ts";

/** The hall's display tiles, in slot order: a slot is its tile's place in the plan, row by row (`shoprooms.ts`). */
const SLOT_TILES: readonly (readonly [number, number])[] = SHOPS.market.displays.map(([x, y]) => [x, y]);

/**
 * Display slots in the hall: one per case or shelf tile, first come first served. A slot is free again the
 * moment its item sells, is taken back or runs out (`MARKET_TTL`).
 * ponytail: more shelves are more tiles in `MARKET_ROWS`; nothing else changes.
 */
export const MARKET_SLOTS = SLOT_TILES.length;

/** The tile of a slot in the hall's map. */
export const slotTile = (slot: number): readonly [number, number] | undefined => SLOT_TILES[slot];

/** The slot at a tile of the hall's map, or null if the tile isn't a display. */
export const slotAt = (x: number, y: number): number | null => {
  const i = SLOT_TILES.findIndex(([sx, sy]) => sx === x && sy === y);
  return i < 0 ? null : i;
};

/**
 * How many things you may have on display at once, by level. Levels come from lifetime tokens, so this is
 * a cost to an account made yesterday; below the first level you can buy but not sell.
 */
export const MARKET_ALLOWANCE: readonly { level: number; listings: number }[] = [
  { level: 10, listings: 3 },
  { level: 25, listings: 6 },
  { level: 40, listings: 10 },
];

/** The level you list from. */
export const MARKET_LEVEL = MARKET_ALLOWANCE[0]!.level;

/** What a level lets you have on display at once: none below `MARKET_LEVEL`. */
export const listingAllowance = (level: number): number =>
  MARKET_ALLOWANCE.reduce((n, a) => (level >= a.level ? a.listings : n), 0);

/** Unsold, a listing comes down after this long and the item goes back in its owner's bag (a trade offer's 7 days). */
export const MARKET_TTL = 7 * 24 * 3_600_000;

/** An account has to be this old to buy: a fresh alt can't spend at once. */
export const MARKET_BUYER_AGE = 3 * 24 * 3_600_000;

/** The most one buyer spends in the hall in any 24 hours. */
export const MARKET_DAY_BUY = 6000;

/** The most one buyer spends on one seller in any 7 days. */
export const MARKET_PAIR_BUY = 6000;

/**
 * The dearest a thing may be listed at, by rarity. A price is free to the seller below this and not above:
 * it keeps a made-up price from being a way to send coins to another account. The numbers follow what the
 * coins buy (a legendary pet is 1,500 in the shop) and what a heavy day pays (about 200).
 */
export const MARKET_PRICE_CAP: Record<Rarity, number> = {
  common: 150,
  uncommon: 400,
  rare: 1200,
  epic: 3000,
  legendary: 6000,
};

/** The most `itemId` may be listed at, or 0 if it can't be listed. */
export const priceCap = (itemId: unknown): number => {
  const item = itemById(itemId);
  return item && listable(itemId) ? MARKET_PRICE_CAP[rarityOf(item)] : 0;
};

/** Whether `itemId` can go on display: whatever can change hands (not rewards, merch, dances, earned pieces). */
export const listable = (itemId: unknown): boolean => isTradeable(itemId);

/** A whole number of coins from 1 up to the cap of `itemId`, or null. */
export function parsePrice(raw: unknown, itemId: unknown): number | null {
  if (!Number.isInteger(raw)) return null;
  const price = raw as number;
  return price >= 1 && price <= priceCap(itemId) ? price : null;
}

/** A slot number in the hall, or null. */
export const parseSlot = (raw: unknown): number | null =>
  Number.isInteger(raw) && (raw as number) >= 0 && (raw as number) < MARKET_SLOTS ? (raw as number) : null;

/** One thing on display, as everyone in the hall sees it. */
export interface Listing {
  id: number;
  slot: number;
  /** The item's id (`hat.5`). */
  item: string;
  price: number;
  sellerId: number;
  seller: string;
  /** When it comes down if nobody buys it. */
  expiresAt: number;
  /** A numbered merchant edition's copy number and the size of its run; null for anything else. */
  edition: { n: number; supply: number } | null;
}

/** What a seller sees of the hall: their own listings, their room left, and sales they haven't heard of. */
export interface MyMarket {
  listings: Listing[];
  /** More listings they may put up now. */
  room: number;
  /** The most they may have up at their level. */
  allowance: number;
  /** Sold since they last looked, oldest first. */
  sold: Sale[];
}

/** A completed sale. */
export interface Sale {
  id: number;
  item: string;
  price: number;
  buyer: string;
  at: number;
}
