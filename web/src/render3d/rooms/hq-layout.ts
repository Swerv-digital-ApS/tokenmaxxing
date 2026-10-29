import type { GameMap } from "@tokenmaxxing/core/maps.ts";
import { PASSAGE_W } from "@tokenmaxxing/core/office.ts";

/**
 * Where the company house's picture sits on its map, and what its hallways are made of. The house's 3D room is
 * the floor plan (`HQ_ROWS`) as a `Room` whose tile (0, 0) is map tile (1, 2); the hallways of office doors grow
 * above it at negative y (`hqMap`), so every tile keeps its coordinates and the map's origin moves. Pure, so a test
 * can hold the geometry to the map: what is walkable here is what the server lets you walk on.
 */

/** Map tile (x, y) as a room tile: the floor's walls are the room's own. */
export const houseTile = (x: number, y: number): [number, number] => [x - 1, y - 2];

/** Where room tile (0, 0) is on the map's grid, in tiles from its top-left (the skin's `offset`). */
export const houseOffset = (map: GameMap): [number, number] => [1 - map.x0, 2 - map.y0];

export { PASSAGE_W };

export type HallTile = { kind: "wall" | "floor" | "door"; x: number; y: number; rx: number; rz: number };

/**
 * The tiles above the floor's top wall row (y < 2): walls, corridor floor (and the passage down through the floor's
 * top walls), and the office doors. Each with its map tile and its room tile.
 */
export function hallwayTiles(map: GameMap): HallTile[] {
  const out: HallTile[] = [];
  for (let y = map.y0; y < 2; y++)
    for (let x = map.x0; x < map.x0 + map.width; x++) {
      const ch = map.at(x, y);
      const [rx, rz] = houseTile(x, y);
      if (ch === "W") out.push({ kind: "wall", x, y, rx, rz });
      else if (ch === "R") out.push({ kind: "door", x, y, rx, rz });
      else if (map.walkable(x, y)) out.push({ kind: "floor", x, y, rx, rz });
    }
  return out;
}

/** The passage's lower left tile (in the floor's top wall rows), where its doorway stands, `PASSAGE_W` wide; null without hallways. */
export function housePassage(map: GameMap): [number, number] | null {
  const t = hallwayTiles(map).find((h) => h.kind === "floor" && h.y === 1);
  return t ? [t.rx, t.rz] : null;
}
