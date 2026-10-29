/**
 * Where a game gathers its players in town: a free patch of the square with a table
 * in the middle and the players around it (or, for long games, an arena: a row of
 * desks facing a scoreboard). Pure functions over the map, shared by server and client.
 */
import type { GameMap } from "../maps.ts";
import type { Facing } from "../world.ts";

export interface Seat {
  x: number;
  y: number;
  facing: Facing;
}

export interface Spot {
  x: number;
  y: number;
  w: number;
  h: number;
  /** A table in the middle (short games), or a row of desks (long games). */
  kind: "table" | "arena";
}

/** Tiles players can't walk onto while the game is there: the table, or the desks. */
export function propTiles(spot: Spot): [number, number][] {
  if (spot.kind === "table") return [[spot.x + 1, spot.y + 1]];
  return Array.from({ length: spot.w }, (_, i) => [spot.x + i, spot.y] as [number, number]);
}

export const spotSize = (kind: Spot["kind"], players: number) =>
  kind === "table" ? { w: 3, h: 3 } : { w: Math.max(3, players), h: 3 };

const inside = (s: { x: number; y: number; w: number; h: number }, x: number, y: number) =>
  x >= s.x && x < s.x + s.w && y >= s.y && y < s.y + s.h;

/**
 * The nearest free `w`×`h` patch of walkable tiles to `from`, searching outwards. It never
 * overlaps another game (plus a tile of space around it) or anyone in `taken`.
 */
export function findSpot(
  map: GameMap,
  from: [number, number],
  w: number,
  h: number,
  others: Spot[],
  taken: ReadonlySet<string> = new Set(),
): { x: number; y: number } | null {
  // Other games, with their tile of space.
  const kept = others.map((o) => ({ x: o.x - 1, y: o.y - 1, w: o.w + 2, h: o.h + 2 }));
  const fits = (x: number, y: number) => {
    for (let j = 0; j < h; j++)
      for (let i = 0; i < w; i++) {
        const tx = x + i;
        const ty = y + j;
        if (!map.walkable(tx, ty) || taken.has(`${tx},${ty}`)) return false;
        if (kept.some((o) => inside(o, tx, ty))) return false;
      }
    return true;
  };
  const [fx, fy] = from;
  // Rings of growing distance around `from`, centring the patch on it: row by row, so the top and
  // bottom rows whole and only the two ends of the rows between.
  for (let r = 0; r < Math.max(map.width, map.height); r++)
    for (let dy = -r; dy <= r; dy++)
      for (let dx = -r; dx <= r; dx += dy === -r || dy === r ? 1 : 2 * r) {
        const x = fx + dx - Math.floor(w / 2);
        const y = fy + dy - Math.floor(h / 2);
        if (fits(x, y)) return { x, y };
      }
  return null;
}

/**
 * Where each player stands. At a table: a duel faces off across it, and bigger games
 * fill the ring. In an arena: one desk each, all facing the scoreboard above them.
 */
export function seatsFor(spot: Spot, players: number): Seat[] {
  const { x, y } = spot;
  if (spot.kind === "arena")
    return Array.from({ length: players }, (_, i) => ({ x: x + i, y: y + 1, facing: "up" as const }));
  const ring: Seat[] = [
    { x, y: y + 1, facing: "right" },
    { x: x + 2, y: y + 1, facing: "left" },
    { x: x + 1, y, facing: "down" },
    { x: x + 1, y: y + 2, facing: "up" },
    { x, y, facing: "down" },
    { x: x + 2, y, facing: "down" },
    { x, y: y + 2, facing: "up" },
    { x: x + 2, y: y + 2, facing: "up" },
  ];
  return ring.slice(0, players);
}
