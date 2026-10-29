/**
 * Hooks the 3D renderer's world up to the real shops: `installShops(world)` mounts the buy panel on a `GameBackend`
 * wired to the live connection and HUD store. The renderer calls `open(shop, item)` when a shelf is picked and
 * `dispose()` when it goes (a switch to 2D, where `openShopPage` opens the old Shop page instead).
 */

import type { ShopBackend } from "./backend.ts";
import type { ShopId, ShopItem } from "./catalog.ts";
import { createGameBackend } from "./gameBackend.ts";
import { mountShopPanel, type ShopPanel } from "./shopPanel.ts";
import { realNet, realStore } from "./wiring.ts";
import type { ShopWorld } from "./world.ts";

export { openShopPage, pageForItem, pageForShop } from "./pages.ts";
export type { ShopWorld } from "./world.ts";

export interface InstalledShops {
  backend: ShopBackend;
  panel: ShopPanel;
  open(shop: ShopId, item: ShopItem): void;
  dispose(): void;
}

export function installShops(world: ShopWorld): InstalledShops {
  const backend = createGameBackend({ net: realNet(), store: realStore(), world });
  const panel = mountShopPanel(world, backend);
  return { backend, panel, open: (shop, item) => panel.open(shop, item), dispose: () => panel.dispose() };
}
