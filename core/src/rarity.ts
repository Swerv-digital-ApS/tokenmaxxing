/**
 * How rare a shop item is, for every catalog (the shop's own, the head pack, the wardrobe and the
 * merchant's editions): its own word if it has one, else what its price says.
 */
import type { Item } from "./shop.ts";

export type Rarity = "common" | "uncommon" | "rare" | "epic" | "legendary";
export const RARITIES: readonly Rarity[] = ["common", "uncommon", "rare", "epic", "legendary"];

/** Grey, green, blue, purple, orange: the name's colour in the shop and the stripe under a bag square. */
export const RARITY_COLOR: Record<Rarity, string> = {
  common: "#c9ced6",
  uncommon: "#3ddc84",
  rare: "#4fa8ff",
  epic: "#c38bff",
  legendary: "#ffb347",
};

/** Badge tier frames (`badges.ts`): bronze, silver, gold, diamond, then mythic and cosmic past them. */
export const TIER_COLOR = {
  bronze: "#c98a4b",
  silver: "#d5dbe4",
  gold: "#ffd75e",
  diamond: "#7fe8ff",
  mythic: "#ff62c4",
  cosmic: "#a98bff",
} as const;

/** What a price says about how rare a thing is; the head pack's prices keep to these bands. */
export const rarityForPrice = (price: number): Rarity =>
  price >= 1500
    ? "legendary"
    : price >= 750
      ? "epic"
      : price >= 350
        ? "rare"
        : price >= 160
          ? "uncommon"
          : "common";

/** How rare an item is: its own word, or what its price says; a level reward without one is epic. */
export const rarityOf = (item: Pick<Item, "rarity" | "price" | "level">): Rarity =>
  item.rarity ?? (item.level !== undefined ? "epic" : rarityForPrice(item.price));
