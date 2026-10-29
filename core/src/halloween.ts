/**
 * Halloween in town: for the week up to 31 October and the day after, a jack-o'-lantern sits on every
 * doorstep (the Tavern's, each shop's and each company's) and a few in a patch on the lawn by the pond. They
 * light up after dark with the street lamps. All from the clock (`holidays.ts`) and the map, so the server
 * keeps nothing. They are scenery on the grass beside the paths: nothing blocks on them. The costume hat is in
 * `costumes.ts`.
 */
import { near } from "./holidays.ts";
import type { GameMap } from "./maps.ts";
import { SHOP_DOOR_CHAR } from "./shoprooms.ts";

/** Out from this many days before Halloween to this many after. */
export const PUMPKINS = { before: 7, after: 1 } as const;

export const pumpkinsOut = (ms: number): boolean => near("halloween", ms, PUMPKINS.before, PUMPKINS.after);

/** The doors that get one: the Tavern's (`I`), each company's (`D`) and each shop's. */
const DOORS = ["I", "D", ...Object.values(SHOP_DOOR_CHAR)];

/** The patch on the lawn above the pond, in town tiles. */
const PATCH: readonly [number, number][] = [
  [3, 10],
  [5, 10],
  [4, 11],
];

export interface Pumpkin {
  x: number;
  y: number;
  /** A big one, or a small one. */
  big: boolean;
}

/**
 * Where the pumpkins sit in `map` (the town): on the grass beside the path below each door (to its left,
 * else its right: the morning paper lands on the right), then the patch. Only on grass, so never in a path.
 */
export function pumpkinSpots(map: GameMap): Pumpkin[] {
  const spots: [number, number][] = [];
  for (const ch of DOORS)
    for (const [x, y] of map.find(ch)) {
      const spot = (
        [
          [x - 1, y + 1],
          [x + 1, y + 1],
        ] as const
      ).find(([sx, sy]) => map.at(sx, sy) === ".");
      if (spot) spots.push([spot[0], spot[1]]);
    }
  for (const [x, y] of PATCH) if (map.at(x, y) === ".") spots.push([x, y]);
  return spots.map(([x, y]) => ({ x, y, big: (x * 7 + y * 3) % 3 !== 0 }));
}
