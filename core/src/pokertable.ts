import { type GameMap, MAPS } from "./maps.ts";
import { SEATS } from "./poker.ts";
import type { Facing } from "./world.ts";

/** The poker table in the Tavern's basement net cafe, and its chairs on the map (`maps.ts`): the table is one run of `♠`, the chairs are `♣`. */
export const TABLE_CHAR = "♠";
export const CHAIR_CHAR = "♣";

export interface TableSpot {
  /** The table's top-left tile and its size in tiles. */
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface ChairSpot {
  x: number;
  y: number;
  /** The way a sitter faces: towards the table. */
  facing: Facing;
}

/** The table's tiles as a rectangle, or null if the map has none. */
export function pokerTable(map: GameMap = MAPS.basement): TableSpot | null {
  const tiles = map.find(TABLE_CHAR);
  if (tiles.length === 0) return null;
  const xs = tiles.map(([x]) => x);
  const ys = tiles.map(([, y]) => y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x + 1, h: Math.max(...ys) - y + 1 };
}

/**
 * The chairs round the table, clockwise from the top left: seat `i` of the engine (`poker.ts`) is `[i]`. Read
 * off the map, so the server, the 2D room and the 3D one agree on where everyone sits.
 */
export function pokerChairs(map: GameMap = MAPS.basement): ChairSpot[] {
  const table = pokerTable(map);
  if (!table) return [];
  const cx = table.x + table.w / 2;
  const cy = table.y + table.h / 2;
  return map
    .find(CHAIR_CHAR)
    .map(([x, y]) => {
      const facing: Facing =
        y < table.y ? "down" : y >= table.y + table.h ? "up" : x < table.x ? "right" : "left";
      return { x, y, facing, angle: Math.atan2(y + 0.5 - cy, x + 0.5 - cx) };
    })
    .sort((a, b) => a.angle - b.angle)
    .slice(0, SEATS)
    .map(({ x, y, facing }) => ({ x, y, facing }));
}

/** The chair at tile (x, y): its seat number, or -1. */
export const chairAt = (x: number, y: number, map: GameMap = MAPS.basement): number =>
  pokerChairs(map).findIndex((c) => c.x === x && c.y === y);
