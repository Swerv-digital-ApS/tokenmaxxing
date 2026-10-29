import type { GameMap } from "@tokenmaxxing/core/maps.ts";
import { SHOP_DOOR_CHAR, SHOP_IDS, type ShopId, shopNeedsWarm, warmShop } from "../shops/catalog.ts";

/** Tiles from a shop door within which its interior starts building. */
const NEAR = 16;
type Doors = [ShopId, readonly (readonly [number, number])[]][];
const doors = new WeakMap<GameMap, Doors>();

/** Nearest door first; never start a second shop's construction on the same frame. */
export function warmNearShops(map: GameMap, x: number, y: number): void {
  let list = doors.get(map);
  if (!list) {
    list = SHOP_IDS.map((id): Doors[number] => [id, map.find(SHOP_DOOR_CHAR[id])]);
    doors.set(map, list);
  }
  const nearby = list
    .map(([id, tiles]) => ({
      id,
      distance: Math.min(...tiles.map(([dx, dy]) => Math.max(Math.abs(dx - x), Math.abs(dy - y)))),
    }))
    .filter((d) => d.distance <= NEAR)
    .sort((a, b) => a.distance - b.distance);
  for (const { id } of nearby) {
    if (!shopNeedsWarm(id)) continue;
    warmShop(id);
    return;
  }
}
