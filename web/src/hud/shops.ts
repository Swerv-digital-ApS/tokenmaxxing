/** The shop directory and what each shop's page carries, as pure data (no React). */
import {
  SHOP_IDS,
  SHOP_SELLS,
  SHOP_TABS,
  SHOPS,
  type ShopId,
  type ShopTab,
  shopForSlot,
} from "@tokenmaxxing/core/shoprooms.ts";

export interface ShopEntry {
  id: ShopId;
  name: string;
  sign: string;
  keeper: string;
  sells: string;
}

/** The four shops, as the directory lists them. */
export const SHOP_DIRECTORY: readonly ShopEntry[] = SHOP_IDS.map((id) => ({
  id,
  name: SHOPS[id].name,
  sign: SHOPS[id].sign,
  keeper: SHOPS[id].keeperName,
  sells: SHOP_SELLS[id],
}));

/** The Shop page's tabs (item slots) in a shop: only its own goods. */
export const shopSlots = (shop: ShopId): readonly ShopTab[] =>
  SHOP_TABS[shop].filter((t) => !(NOT_SLOTS as readonly string[]).includes(t));

/**
 * Tabs that are not item slots: the barber's looks, Møbelhuset's wallpaper, monitors and company supplies,
 * Natmarked's cases and Torvehallen's display slots.
 */
const NOT_SLOTS = ["look", "decor", "desk", "company", "case", "market"] as const;

/** "Buy hats at Thread & Token": where an item slot is sold, or null if it isn't sold in a shop. */
export function buyHint(slot: string, noun: string): string | null {
  const shop = shopForSlot(slot);
  return shop ? `Buy ${noun} at ${SHOPS[shop].name}` : null;
}

/** Plural nouns for the Bag's empty-slot hints. */
export const SLOT_NOUN: Record<string, string> = {
  outfit: "outfits",
  glasses: "glasses",
  hat: "hats",
  held: "things to hold",
  back: "back items",
  pet: "pets",
  petwear: "pet gear",
  furniture: "furniture",
};

/** Esc's menu: a button per panel. No store in it: buying happens at the shops (see "Shops"). */
export const MENU = [
  [{ kind: "shops" }, "🧭 Shops"],
  [{ kind: "bag" }, "🎒 Bag and character"],
  [{ kind: "trades" }, "🔁 Trades"],
  [{ kind: "arcade" }, "🎮 Arcade"],
  [{ kind: "raid" }, "⚔️ Raid"],
  [{ kind: "openOffices" }, "🚪 Open offices"],
  [{ kind: "desk" }, "🖥 My desk"],
  [{ kind: "company" }, "🏢 Company"],
  [{ kind: "leaderboard" }, "🏆 Leaderboard"],
  [{ kind: "graphics" }, "🖼 Graphics"],
  [{ kind: "changelog" }, "📜 Changelog"],
] as const;
