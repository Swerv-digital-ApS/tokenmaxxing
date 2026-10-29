/**
 * The 2D game's pages for the same shops: the Shop page's tabs (Møbelhuset's wallpaper and floors, monitors and company supplies
 * among them) and a company's merch. In 2D mode (and whenever the 3D shop panel is not up) a shop counter opens these.
 */
import type { Item } from "@tokenmaxxing/core/shop.ts";
import { itemById } from "@tokenmaxxing/core/shop.ts";
import { hud, type Panel } from "../../store.ts";
import type { ShopId } from "./catalog.ts";
import { purchaseOf } from "./purchase.ts";

const TAB: Record<Exclude<ShopId, "natmarked" | "market">, Item["slot"]> = {
  clothes: "outfit",
  barber: "glasses",
  pets: "pet",
  furniture: "furniture",
};

/** The page a shop's counter opens in 2D: the Shop page on the tab that shop sells. */
export const pageForShop = (shop: ShopId): Panel =>
  shop === "natmarked"
    ? { kind: "caseShop" }
    : shop === "market"
      ? { kind: "market" }
      : { kind: "shop", tab: TAB[shop] };

/** The page that sells one item (a shelf in the 3D shop, in 2D): the same tab, or the page for what the Shop page does not carry. */
export function pageForItem(id: string): Panel {
  const p = purchaseOf(id);
  switch (p.kind) {
    case "decor":
      return { kind: "shop", tab: "decor" };
    case "desk":
      return { kind: "shop", tab: "desk" };
    case "piece":
      return { kind: "shop", tab: "company" };
    case "merch":
      return { kind: "merch", companyId: p.companyId };
    default:
      return { kind: "shop", tab: itemById(id)?.slot };
  }
}

export const openShopPage = (shop: ShopId): void => hud.set({ panel: pageForShop(shop) });
