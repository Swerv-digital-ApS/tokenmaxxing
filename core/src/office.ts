/**
 * Offices: the furniture you can buy, what it costs, and the doors to them. The template itself is
 * `MAPS.office`, with the other rooms; what's in each office is what its owner dropped there.
 */
import { sortBy } from "hanzio";
import { ALL_CASE_PIECES } from "./case-furniture.ts";
import { HOME_PIECES } from "./home.ts";
import { TROPHIES } from "./loot.ts";
import { GameMap, MAPS, officeRows } from "./maps.ts";
import { POSTERS } from "./posters.ts";

export interface Piece {
  ch: string;
  name: string;
  price: number;
  /** Tiles wide; 1 unless set. */
  w?: number;
  /** Earned this way, never sold: it stays yours, and goes down only in your own office. */
  earned?: string;
  /** Hung on a wall tile (`canHang`), never on the floor: a poster, or a personal office's frame. */
  wall?: true;
  /** For a personal office only, never the company building (`home.ts`). */
  home?: true;
}

/** What an office can hold: furniture from the map legend, drawn as it is everywhere else. Sold as `furn.<ch>`. */
export const FURNITURE: readonly Piece[] = [
  { ch: "=", name: "Rug", price: 15 },
  { ch: "p", name: "Plant", price: 30 },
  { ch: "L", name: "Lamp", price: 40 },
  { ch: "c", name: "Chair", price: 45 },
  { ch: "k", name: "Shelf", price: 60 },
  { ch: "B", name: "Bench", price: 60 },
  { ch: "d", name: "Desk", price: 75 },
  { ch: "o", name: "Coffee machine", price: 90 },
  { ch: "b", name: "Bed", price: 120 },
  { ch: "s", name: "Sofa", price: 150 },
  { ch: "t", name: "TV", price: 180, w: 2 },
  // From sitting out an outage at the picnic (`picnic.ts`).
  { ch: "g", name: "Touched grass", price: 0, w: 2, earned: "Sat on a blanket at an outage picnic" },
];
/**
 * The company building's own furniture: fancier, bought from the company wallet (`buyPiece`), and never in
 * anyone's bag. Greek letters in the map legend, so they can't clash with the rooms' own characters;
 * `art` is its sprite in `web/src/art/furniture-fancy.ts`. Every piece takes one row of tiles: the
 * deeper ones (the rug, the ping-pong table) are drawn reaching back over the row behind.
 */
export const COMPANY_FURNITURE: readonly (Piece & { art: string })[] = [
  { ch: "ε", art: "beanbag", name: "Beanbag", price: 35 },
  { ch: "ρ", art: "bonsai", name: "Bonsai", price: 45 },
  { ch: "Φ", art: "water-cooler", name: "Water cooler", price: 55 },
  { ch: "Δ", art: "rug-persian", name: "Persian rug", price: 60, w: 3 },
  { ch: "ψ", art: "mini-fridge", name: "Retro mini fridge", price: 70 },
  { ch: "Ω", art: "coffee-table", name: "Walnut coffee table", price: 80, w: 2 },
  { ch: "χ", art: "monstera", name: "Big monstera", price: 90 },
  { ch: "τ", art: "globe", name: "Desk globe", price: 90 },
  { ch: "σ", art: "lava-lamp", name: "Lava lamp", price: 100 },
  { ch: "ξ", art: "whiteboard", name: "Whiteboard", price: 110, w: 2 },
  { ch: "Λ", art: "arc-lamp", name: "Arc floor lamp", price: 120 },
  { ch: "Ξ", art: "bookshelf-library", name: "Library bookshelf", price: 140, w: 2 },
  { ch: "μ", art: "lounge-chair", name: "Danish lounge chair", price: 180 },
  { ch: "ν", art: "record-player", name: "Vinyl record player", price: 200 },
  { ch: "δ", art: "neon-sign", name: "Neon sign", price: 220, w: 2 },
  { ch: "Σ", art: "sofa-chesterfield", name: "Chesterfield sofa", price: 240, w: 3 },
  { ch: "Π", art: "vending-machine", name: "Vending machine", price: 240 },
  { ch: "ζ", art: "standing-desk", name: "Standing desk, two screens", price: 260, w: 2 },
  { ch: "ι", art: "plant-wall", name: "Plant wall", price: 300, w: 2 },
  { ch: "φ", art: "foosball", name: "Foosball table", price: 350, w: 2 },
  { ch: "α", art: "espresso-bar", name: "Espresso bar", price: 400, w: 2 },
  { ch: "η", art: "server-rack", name: "Server rack", price: 420 },
  { ch: "β", art: "arcade-cabinet", name: "Arcade cabinet", price: 450 },
  { ch: "κ", art: "trophy-case", name: "Trophy case", price: 500, w: 2 },
  { ch: "γ", art: "aquarium", name: "Aquarium", price: 550, w: 2 },
  { ch: "θ", art: "ping-pong", name: "Ping-pong table", price: 600, w: 3 },
  { ch: "ω", art: "gong", name: "Ship-it gong", price: 750, w: 2 },
  { ch: "λ", art: "chandelier", name: "Crystal chandelier", price: 900, w: 2 },
  { ch: "Γ", art: "rubber-duck-statue", name: "Rubber-duck statue", price: 1000 },
  // Wall decor, after the floor pieces so every other piece keeps its place in the catalog.
  ...POSTERS,
];
/** At most this many drops on an office's floor, or a company building's. */
export const OFFICE_PIECES = 40;
/** Your own office opens at this level. */
export const OFFICE_LEVEL = 10;

/** Every piece an office can hold: the shop's, then the raid's trophies (`loot.ts`), never sold. */
export const PIECES: readonly Piece[] = [...FURNITURE, ...TROPHIES];

const BY_CH = new Map<string, Piece>();
for (const f of [...PIECES, ...COMPANY_FURNITURE, ...HOME_PIECES, ...ALL_CASE_PIECES])
  if (!BY_CH.has(f.ch)) BY_CH.set(f.ch, f);

export const pieceOf = (ch: unknown): Piece | undefined => BY_CH.get(ch as string);

/** How far a piece is turned, in quarter turns clockwise seen from above: 0 as it comes, 1 faces left, 2 away, 3 right. */
export type Rot = 0 | 1 | 2 | 3;

/** `n` as a `Rot` (whole quarter turns, any number, so 4 is 0 and -1 is 3); anything else is 0. */
export const rotOf = (n: unknown): Rot =>
  typeof n === "number" && Number.isInteger(n) ? ((((n % 4) + 4) % 4) as Rot) : 0;

/** Whether a piece turned `rot` lies down a column, not along a row. */
export const sideways = (rot?: number): boolean => rot === 1 || rot === 3;

/** The tiles a `w`-tile piece anchored (top-left) at (x, y) covers when turned `rot`: along its row, or down its column. */
export const tilesOf = (x: number, y: number, w: number, rot?: number): [number, number][] =>
  Array.from({ length: w }, (_, i): [number, number] => (sideways(rot) ? [x, y + i] : [x + i, y]));

/** One placed piece: its top-left tile, and how far it is turned (`rot`, left out for 0). */
export interface Placed {
  ch: string;
  x: number;
  y: number;
  rot?: Rot;
}

/** A turned piece's footprint: its top-left tile, how many tiles it covers and how far it is turned. */
export interface Turn {
  x: number;
  y: number;
  w: number;
  rot: Rot;
}

/** Each tile of a turned piece in a map `withPieces` made, to that piece's `Turn`. The letters are the same either way. */
const TURNED = new WeakMap<GameMap, ReadonlyMap<string, Turn>>();

/** The turned piece on (x, y), if there is one: the renderers draw it turned about the middle of its footprint. */
export const turnAt = (map: GameMap, x: number, y: number): Turn | null =>
  TURNED.get(map)?.get(`${x},${y}`) ?? null;

/** Wall pieces hang as they are (their writing would read backwards); everything on the floor turns. */
export const canTurn = (ch: string): boolean => pieceOf(ch) !== undefined && !pieceOf(ch)?.wall;

/**
 * Where a piece's top-left tile goes when it is turned in place from `from` to `to` on its middle tile, so four
 * turns bring it back to where it stood: a sofa three wide turns about its middle tile, not its end.
 */
export function turnedAround(x: number, y: number, w: number, from: Rot, to: Rot): { x: number; y: number } {
  const half = Math.floor((w - 1) / 2);
  const [cx, cy] = sideways(from) ? [x, y + half] : [x + half, y];
  return sideways(to) ? { x: cx, y: cy - half } : { x: cx - half, y: cy };
}

/** What a new office holds: a desk with a chair in front of it. */
export const STARTER_OFFICE: readonly Placed[] = [
  { ch: "d", x: 5, y: 3 },
  { ch: "c", x: 5, y: 4 },
];

/** The row of a company building's top wall that faces the floor: where posters hang. */
export const WALL_ROW = 1;

/** The row of a personal office's top wall: its face, with the floor right under it. */
export const OFFICE_WALL_ROW = 0;

/** The wall row pieces hang on in `map`, or null when it has none: a building's, or an office's. */
export const wallRowOf = (map: GameMap): number | null =>
  map.id === "hq" ? WALL_ROW : map.id === "office" ? OFFICE_WALL_ROW : null;

/**
 * Whether `w` tiles from (x, y) can take a wall piece: the room's wall face, every tile still bare
 * wall (not the passage up to the hallways, not an office's corners, not another piece), and at least
 * one floor tile below it free to stand on, so anyone can face it to read it or take it down (`take`).
 * The piece stays a wall tile, so hanging one never changes where anyone can walk. A `home` piece
 * (`home.ts`) hangs only in a personal office, any other (a poster) only in a company building.
 */
export const canHang = (map: GameMap, x: number, y: number, w: number, home = false): boolean => {
  if (map.id !== (home ? "office" : "hq") || y !== wallRowOf(map)) return false;
  const tiles = Array.from({ length: w }, (_, i) => x + i);
  if (home && tiles.some((tx) => tx < 1 || tx > map.width - 2)) return false;
  return tiles.every((tx) => map.at(tx, y) === "W") && tiles.some((tx) => map.walkable(tx, y + 1));
};

/**
 * The wall slot for a `w`-wide piece nearest column `x`, or null when the wall is full. One with
 * furniture in front of part of it (a shelf would hide it) only wins when nothing clear is as near.
 */
export function wallSpot(map: GameMap, x: number, w: number, home = false): { x: number; y: number } | null {
  const row = wallRowOf(map);
  if (row === null) return null;
  const cost = (sx: number) =>
    Math.abs(sx + w / 2 - x - 0.5) +
    3 * Array.from({ length: w }, (_, i) => i).filter((i) => !map.walkable(sx + i, row + 1)).length;
  let best: number | null = null;
  for (let sx = map.x0; sx + w <= map.x0 + map.width; sx++)
    if (canHang(map, sx, row, w, home) && (best === null || cost(sx) < cost(best))) best = sx;
  return best === null ? null : { x: best, y: row };
}

/**
 * A map with these pieces written over its floor: a room's dropped furniture (`mapOf`). Only over floor:
 * a wall or door the map gained under a piece stays a wall or door. A wall piece goes over bare wall.
 */
export function withPieces(pieces: readonly Placed[], base: GameMap): GameMap {
  const rows = base.rows.map((r) => [...r]);
  const turned = new Map(TURNED.get(base));
  for (const p of pieces) {
    const piece = pieceOf(p.ch);
    const w = piece?.w ?? 1;
    if (piece?.wall && !canHang(base, p.x, p.y, w, piece.home)) continue;
    if (piece?.home && base.id !== "office") continue;
    // A wall piece hangs along the wall whatever it says; the rest lie down their column when turned sideways.
    const rot = piece?.wall ? 0 : rotOf(p.rot);
    const tiles = tilesOf(p.x, p.y, w, rot);
    for (const [tx, ty] of tiles)
      if (piece?.wall || base.walkable(tx, ty)) rows[ty - base.y0]![tx - base.x0] = p.ch;
    if (rot && canTurn(p.ch))
      for (const [tx, ty] of tiles) turned.set(`${tx},${ty}`, { x: p.x, y: p.y, w, rot });
  }
  const map = new GameMap(
    base.id,
    base.name,
    rows.map((r) => r.join("")),
    base.x0,
    base.y0,
    base.decor,
  );
  if (turned.size) TURNED.set(map, turned);
  return map;
}

// MARK: Doors

/** A door in a company building: whose office, where, and whether it's open (the client draws a 🔒). */
export interface Door {
  userId: number;
  name: string;
  /** Its place along the hallways: stored per owner, so it never moves when another door goes (`assignSlots`). */
  slot: number;
  x: number;
  y: number;
}
/** Doors per hallway: three tiles apart, so each office has its own stretch of wall. */
export const DOORS_PER_HALLWAY = 6;
/** A hallway is four rows: a wall top, the wall face with the doors, and a corridor two tiles deep. */
export const HALL_H = 4;
/** The first door's column, and the spacing between doors (two wall tiles make the stub between neighbours). */
const DOOR_X0 = 3;
const DOOR_GAP = 3;
/**
 * The way up from the floor to every hallway: two tiles wide (this column and the next), between the doors at
 * 12 and 15, from the floor's top row (y = 2) through its two wall rows and up through each hallway's wall rows.
 */
export const PASSAGE_X = 13;
export const PASSAGE_W = 2;

/** One line of a building's office directory: whose office, where its door is, and whether you can walk there. */
export interface DirectoryRow {
  userId: number;
  name: string;
  /** Your own office. */
  mine: boolean;
  /** The door's tile: where "Walk there" routes to. */
  x: number;
  y: number;
}

/** The directory for `doors` (a building's, from its snapshot) as `me` reads it: yours first, then by door. */
export function directory(doors: readonly Door[], me: number | null): DirectoryRow[] {
  const rows = sortBy(doors, "slot").map((d) => ({
    userId: d.userId,
    name: d.name,
    mine: d.userId === me,
    x: d.x,
    y: d.y,
  }));
  return [...rows.filter((r) => r.mine), ...rows.filter((r) => !r.mine)];
}

/** Where slot `n` is: hallway ⌊n/6⌋, tile 3 + 3·(n mod 6). */
export const slotSpot = (n: number): { x: number; y: number } => ({
  x: DOOR_X0 + DOOR_GAP * (n % DOORS_PER_HALLWAY),
  y: -HALL_H * Math.floor(n / DOORS_PER_HALLWAY) - 3,
});

/**
 * Doors for these owners, each at its own stored slot (`assignSlots`), so a door goes only when its owner does.
 * Sorted by slot.
 */
export function doorsFor(owners: readonly Omit<Door, "x" | "y">[]): Door[] {
  return sortBy(owners, "slot").map((o) => ({ ...o, ...slotSpot(o.slot) }));
}

/** Owners with slots packed by id, as every building stood before slots were stored. */
export const withSlots = (owners: readonly Omit<Door, "x" | "y" | "slot">[]): Omit<Door, "x" | "y">[] => {
  const slots = assignSlots(
    owners.map((o) => o.userId),
    new Map(),
  );
  return owners.map((o) => ({ ...o, slot: slots.get(o.userId)! }));
};

/**
 * The slot of each of these members: one in `kept` stays (when it is a whole number, and nobody else holds
 * it), and the others, lowest id first, take the lowest slot still free. With nothing kept that packs them
 * by id, which is where every door stood before slots were stored: the migration.
 */
export function assignSlots(
  userIds: readonly number[],
  kept: ReadonlyMap<number, number>,
): Map<number, number> {
  const out = new Map<number, number>();
  const taken = new Set<number>();
  const ids = [...userIds].sort((a, b) => a - b);
  for (const id of ids) {
    const slot = kept.get(id);
    if (slot !== undefined && Number.isInteger(slot) && slot >= 0 && !taken.has(slot)) {
      out.set(id, slot);
      taken.add(slot);
    }
  }
  let next = 0;
  for (const id of ids) {
    if (out.has(id)) continue;
    while (taken.has(next)) next++;
    out.set(id, next);
    taken.add(next);
  }
  return out;
}

/**
 * The building with a hallway of doors per 6 offices, above today's floor (negative y, like the town),
 * so every tile it had keeps its coordinates. A hallway is a wall top, a wall face with the doors, and a
 * corridor two tiles deep; the two-wide passage joins them to the floor.
 */
export function hqMap(doors: readonly Door[]): GameMap {
  const floor = MAPS.hq;
  const y0 = Math.min(0, ...doors.map((d) => d.y - 1));
  const hall = [
    "W".repeat(floor.width),
    "W".repeat(floor.width),
    `W${"_".repeat(floor.width - 2)}W`,
    `W${"_".repeat(floor.width - 2)}W`,
  ];
  const rows = [...Array.from({ length: -y0 }, (_, i) => hall[i % HALL_H]!), ...floor.rows].map((r) => [
    ...r,
  ]);
  for (const d of doors) rows[d.y - y0]![d.x] = "R";
  for (let y = y0 + 2; y < 2; y++) for (let i = 0; i < PASSAGE_W; i++) rows[y - y0]![PASSAGE_X + i] = "_";
  return new GameMap(
    "hq",
    floor.name,
    rows.map((r) => r.join("")),
    0,
    y0,
  );
}

/** Each company's building. ponytail: one process holds every building it has seen, like the town. */
export const HQS = new Map<number, GameMap>();

export function setHq(companyId: number, doors: readonly Door[]): GameMap {
  const map = hqMap(doors);
  HQS.set(companyId, map);
  return map;
}

/** The door at (x, y) in a building, if any. */
export const doorAt = (doors: readonly Door[], x: number, y: number): Door | undefined =>
  doors.find((d) => d.x === x && d.y === y);

// MARK: Sizes

export type OfficeTier = 0 | 1 | 2 | 3;

/**
 * The sizes of a personal office, and what each costs. The first comes with the office (about 20% bigger
 * than the old 12 × 9); the others are bought with coins, in order, at Møbelhuset (`office.size.<tier>`).
 * Growth is only right and down, so every tile keeps its coordinates; only the pet bed and the door row move.
 */
export const OFFICE_SIZES: readonly { w: number; h: number; price: number }[] = [
  { w: 14, h: 11, price: 0 },
  { w: 16, h: 13, price: 900 },
  { w: 18, h: 15, price: 2250 },
  { w: 20, h: 17, price: 5250 },
];

/** Owners of level 40 and up have the second size without buying it: it is the size that level used to open. */
export const OFFICE_FREE_LEVEL = 40;

/** What `tier` is sold as, in `purchases`. */
export const officeSizeItem = (tier: number): string => `office.size.${tier}`;

/** The tier an `office.size.<n>` item stands for, or null for any other item. */
export const officeSizeOfItem = (item: string): OfficeTier | null => {
  const m = /^office\.size\.([1-9])$/.exec(item);
  const tier = m ? Number(m[1]) : 0;
  return tier > 0 && tier < OFFICE_SIZES.length ? (tier as OfficeTier) : null;
};

/** The size of an owner's office: the biggest they bought, or the one their level gives. */
export const officeTier = (level: number, bought = 0): OfficeTier => {
  const tier = Math.max(level >= OFFICE_FREE_LEVEL ? 1 : 0, Math.trunc(bought) || 0);
  return Math.min(tier, OFFICE_SIZES.length - 1) as OfficeTier;
};

/** An office's template for a size and its wallpaper and floor. Tier 0, plain, is `MAPS.office`. */
export const officeMap = (tier: OfficeTier, decor?: { wall?: string; floor?: string }): GameMap => {
  const { w, h } = OFFICE_SIZES[tier]!;
  return new GameMap("office", "Office", officeRows(w, h), 0, 0, decor);
};

/** Each owner's office, like `HQS`. ponytail: one process holds every office it has seen. */
export const OFFICE_MAPS = new Map<number, GameMap>();
const OFFICE_KEYS = new Map<number, string>();

/**
 * `userId`'s office for their size and decor. The same map object while nothing changed (`mapOf` keeps
 * what it built on a map's identity, and the client its baked ground), a new one when either did.
 */
export function setOffice(
  userId: number,
  tier: OfficeTier,
  decor: { wall?: string | null; floor?: string | null } = {},
): GameMap {
  const d = {
    ...(decor.wall && { wall: decor.wall }),
    ...(decor.floor && { floor: decor.floor }),
  };
  const key = `${tier}:${d.wall ?? ""}:${d.floor ?? ""}`;
  const had = OFFICE_MAPS.get(userId);
  if (had && OFFICE_KEYS.get(userId) === key) return had;
  const map = tier === 0 && !d.wall && !d.floor ? MAPS.office : officeMap(tier, d);
  OFFICE_MAPS.set(userId, map);
  OFFICE_KEYS.set(userId, key);
  return map;
}

export function clearOffice(userId: number): void {
  OFFICE_MAPS.delete(userId);
  OFFICE_KEYS.delete(userId);
}
