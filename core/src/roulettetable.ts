import { type GameMap, MAPS } from "./maps.ts";
import { SPOTS } from "./roulette.ts";

/** The roulette table in the Tavern's basement net cafe: a block of `♦`, and the `♥` spots below it where players stand. */
export const ROULETTE_TABLE_CHAR = "♦";
export const ROULETTE_SPOT_CHAR = "♥";

/** The table's tiles as a rectangle, or null if the map has none. */
export function rouletteTable(
  map: GameMap = MAPS.basement,
): { x: number; y: number; w: number; h: number } | null {
  const tiles = map.find(ROULETTE_TABLE_CHAR);
  if (tiles.length === 0) return null;
  const xs = tiles.map(([x]) => x);
  const ys = tiles.map(([, y]) => y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x + 1, h: Math.max(...ys) - y + 1 };
}

/** The spots, left to right, the one above the table before the one below it in each column: spot `i` of a `RouletteSeat` is `[i]`. */
export function rouletteSpots(map: GameMap = MAPS.basement): [number, number][] {
  return map
    .find(ROULETTE_SPOT_CHAR)
    .map(([x, y]): [number, number] => [x, y])
    .sort((a, b) => a[0] - b[0] || a[1] - b[1])
    .slice(0, SPOTS);
}

/** The spot at tile (x, y): its index, or -1. */
export const spotAt = (x: number, y: number, map: GameMap = MAPS.basement): number =>
  rouletteSpots(map).findIndex(([sx, sy]) => sx === x && sy === y);
