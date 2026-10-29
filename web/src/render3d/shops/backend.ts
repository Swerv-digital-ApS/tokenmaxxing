/**
 * The money and keepsakes side of the four shops, as the buy panel (`shopPanel.ts`) and the item actions
 * (`shopActions.ts`) see it. `gameBackend.ts` implements it: coins, bag, look, pet and Office live on the server and
 * are read from the HUD store, bought with the same calls the Shop page makes.
 * Every write answers with an `Outcome` (never throws), so the panel can toast a refusal and roll back.
 */
import type { Look2D } from "../people/gear3d.ts";
import type { ShopId, ShopItem } from "./catalog.ts";
import type { Outcome } from "./purchase.ts";

export type { Outcome };

export interface ShopBackend {
  /** My coins. */
  coins(): number;
  /** The company wallet, or null when there is none to spend (no company). */
  companyCoins(): number | null;
  level(): number;
  /** The look I wear now, as the saved one (never a try-on). */
  look(): Look2D;
  /** I hold it, or its parent does (a pet's variation), or it is mine to use (decor, a desk). */
  owns(id: string): boolean;
  /** How many I hold that can be put down: furniture in the bag, company pieces in the storeroom. */
  count(id: string): number;
  /** Another can be bought while I hold one (furniture). */
  stackable(id: string): boolean;
  /** It is on me, my pet, my walls or my desk right now. */
  inUse(id: string): boolean;
  /** Pays for `id` and, for what has a use, puts it to use. Coins go down at once and back if refused. */
  buy(shop: ShopId, item: ShopItem, price: number): Promise<Outcome>;
  /** The look `item` would give me (for the fitting room and the barber's mirror), or null if it changes none. */
  preview(shop: ShopId, item: ShopItem): Look2D | null;
  /** Makes use of an item I have: wear, apply, adopt, put on the walls, place in the Office. */
  equip(shop: ShopId, item: ShopItem, on?: boolean): Promise<Outcome>;
  /** Reloads what the server knows (owned decor, desks, the bag); the panel calls it when it opens. */
  refresh(): Promise<void>;
  /** `f` runs when coins, ownership or the look change; returns the unsubscribe. */
  onChange(f: () => void): () => void;
}
