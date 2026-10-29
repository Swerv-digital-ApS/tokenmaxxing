/**
 * A plain snapshot of the 2D town's data, so the 3D town draws from the same tile map.
 * Sources (tokenmaxxing, branch feat/tavern): `core/src/maps.ts` (CORE, LOT, PARKS, townMap, doorOf, the hq
 * floor), `core/src/world.ts` (house tiers, Brand), `core/src/office.ts` (COMPANY_FURNITURE),
 * `core/src/posters.ts` (POSTERS) and `core/src/desks.ts` (DESKS). Keep in step by hand.
 */

import { townMap as coreTown, MAPS, shopBlocks } from "@tokenmaxxing/core/maps.ts";
import { SHOP_DOOR_CHAR } from "@tokenmaxxing/core/shoprooms.ts";

export { PLAZA, TOWN_SPAWN } from "@tokenmaxxing/core/maps.ts";

export const BLOCK_W = 10;
export const BLOCK_H = 9;
/** Each company house is 7×5 tiles, with its door in the middle of the bottom row. */
export const PLOT_W = 7;
export const PLOT_H = 5;
export const CORE_BLOCKS: [number, number][] = [
  [0, 0],
  [1, 0],
  [0, 1],
  [1, 1],
];

const DOOR: [number, number] = [5, 6];

export const plotId = (bx: number, by: number): number => (by + 500) * 1000 + (bx + 500);
export const plotBlock = (plot: number): [number, number] => [
  (plot % 1000) - 500,
  Math.floor(plot / 1000) - 500,
];
export const blockOf = (x: number, y: number): [number, number] => [
  Math.floor(x / BLOCK_W),
  Math.floor(y / BLOCK_H),
];

/** A company's front door, in town tiles. */
export function doorOf(plot: number): [number, number] {
  const [bx, by] = plotBlock(plot);
  return [bx * BLOCK_W + DOOR[0], by * BLOCK_H + DOOR[1]];
}

/** Tile kinds the 3D town cares about: walkable ground, and portals (stepping in changes room). */
const WALK = new Set([".", ",", ":", '"']);
const PORTAL = new Set(["I", "D", "G", "S", "u", "x", "R", "A", ...Object.values(SHOP_DOOR_CHAR)]);

/** The town's tiles. `rows[0][0]` is tile (x0, y0): they can be negative. */
export class TownMap {
  readonly width: number;
  readonly height: number;
  constructor(
    readonly rows: readonly string[],
    readonly x0: number,
    readonly y0: number,
    /** The blocks that are parks (no company on them). */
    readonly parks: readonly [number, number][],
  ) {
    this.width = rows[0]!.length;
    this.height = rows.length;
  }
  contains(x: number, y: number): boolean {
    return x >= this.x0 && y >= this.y0 && x < this.x0 + this.width && y < this.y0 + this.height;
  }
  /** Tile character; outside the map reads as a tree. */
  at(x: number, y: number): string {
    return this.rows[y - this.y0]?.[x - this.x0] ?? "T";
  }
  walkable(x: number, y: number): boolean {
    const c = this.at(x, y);
    return WALK.has(c) || PORTAL.has(c);
  }
  find(ch: string): [number, number][] {
    const out: [number, number][] = [];
    this.rows.forEach((row, y) => {
      for (let x = 0; x < row.length; x++) if (row[x] === ch) out.push([x + this.x0, y + this.y0]);
    });
    return out;
  }
}

const isCore = (bx: number, by: number) => CORE_BLOCKS.some(([cx, cy]) => cx === bx && cy === by);

/**
 * The town for these company plots: the game's own (`core/src/maps.ts`: the core, the four shop blocks, a lot per
 * company, small parks in the gaps, trees round it), with the blocks that are parks listed for the arcade.
 */
export function townMap(plots: readonly number[]): TownMap {
  const m = coreTown(plots);
  const taken = new Set(plots);
  const shops = new Set(Object.values(shopBlocks(plots)).map(([x, y]) => plotId(x, y)));
  const parks: [number, number][] = [];
  for (let by = Math.floor(m.y0 / BLOCK_H); by * BLOCK_H < m.y0 + m.height; by++)
    for (let bx = Math.floor(m.x0 / BLOCK_W); bx * BLOCK_W < m.x0 + m.width; bx++) {
      const id = plotId(bx, by);
      if (!m.contains(bx * BLOCK_W + 1, by * BLOCK_H + 1) || isCore(bx, by) || taken.has(id) || shops.has(id))
        continue;
      // The ring of trees and the closing road are not blocks.
      if (bx * BLOCK_W + BLOCK_W > m.x0 + m.width - 2 || by * BLOCK_H + BLOCK_H > m.y0 + m.height - 2)
        continue;
      parks.push([bx, by]);
    }
  return new TownMap(m.rows, m.x0, m.y0, parks);
}

// MARK: Companies and houses

/** A company's house colours (`#rrggbb`) and logo, picked from its website. */
export interface Brand {
  roof: string;
  wall: string;
  /** Door and window frames. */
  trim: string;
  /** Behind the logo. */
  plaque: string;
  /** Same-origin path, e.g. `/logos/3.png?v=k2x9`; null draws the initials. */
  logo: string | null;
}

/** The part of `CompanyInfo` the town draws. */
export interface Company {
  id: number;
  name: string;
  plot: number;
  members: number;
  tokens30d: number;
  brand: Brand | null;
  /** The house-wide desk tier the wallet bought (`DESKS`). */
  deskFleet?: number;
  /** The company building's dropped furniture and posters (`Placed`), if known. */
  placed?: { ch: string; x: number; y: number }[];
}

export const HOUSE_TIER_NAMES = ["Basement", "Shack", "Cottage", "House", "Villa", "Mansion"] as const;
const TIER_MIN = [0, 100e6, 1e9, 5e9, 15e9, 40e9];
export const HOUSE_TIERS = TIER_MIN.length;
/** Tokens per member over the last 30 days decide the house. */
export const houseTier = (tokens30d: number, members: number): number =>
  TIER_MIN.findLastIndex((m) => tokens30d / Math.max(1, members) >= m);

// MARK: The company building (`hq`)

/** The floor of a company building: the game's own `MAPS.hq` rows (row 1 is the wall face where posters hang). */
export const HQ_ROWS: readonly string[] = MAPS.hq.rows;
export const WALL_ROW = 1;

/** The company wallet's furniture (`COMPANY_FURNITURE`): map character, 2D art name, and width in tiles. */
export const COMPANY_FURNITURE: readonly { ch: string; art: string; name: string; w: number }[] = [
  { ch: "ε", art: "beanbag", name: "Beanbag", w: 1 },
  { ch: "ρ", art: "bonsai", name: "Bonsai", w: 1 },
  { ch: "Φ", art: "water-cooler", name: "Water cooler", w: 1 },
  { ch: "Δ", art: "rug-persian", name: "Persian rug", w: 3 },
  { ch: "ψ", art: "mini-fridge", name: "Retro mini fridge", w: 1 },
  { ch: "Ω", art: "coffee-table", name: "Walnut coffee table", w: 2 },
  { ch: "χ", art: "monstera", name: "Big monstera", w: 1 },
  { ch: "τ", art: "globe", name: "Desk globe", w: 1 },
  { ch: "σ", art: "lava-lamp", name: "Lava lamp", w: 1 },
  { ch: "ξ", art: "whiteboard", name: "Whiteboard", w: 2 },
  { ch: "Λ", art: "arc-lamp", name: "Arc floor lamp", w: 1 },
  { ch: "Ξ", art: "bookshelf-library", name: "Library bookshelf", w: 2 },
  { ch: "μ", art: "lounge-chair", name: "Danish lounge chair", w: 1 },
  { ch: "ν", art: "record-player", name: "Vinyl record player", w: 1 },
  { ch: "δ", art: "neon-sign", name: "Neon sign", w: 2 },
  { ch: "Σ", art: "sofa-chesterfield", name: "Chesterfield sofa", w: 3 },
  { ch: "Π", art: "vending-machine", name: "Vending machine", w: 1 },
  { ch: "ζ", art: "standing-desk", name: "Standing desk, two screens", w: 2 },
  { ch: "ι", art: "plant-wall", name: "Plant wall", w: 2 },
  { ch: "φ", art: "foosball", name: "Foosball table", w: 2 },
  { ch: "α", art: "espresso-bar", name: "Espresso bar", w: 2 },
  { ch: "η", art: "server-rack", name: "Server rack", w: 1 },
  { ch: "β", art: "arcade-cabinet", name: "Arcade cabinet", w: 1 },
  { ch: "κ", art: "trophy-case", name: "Trophy case", w: 2 },
  { ch: "γ", art: "aquarium", name: "Aquarium", w: 2 },
  { ch: "θ", art: "ping-pong", name: "Ping-pong table", w: 3 },
  { ch: "ω", art: "gong", name: "Ship-it gong", w: 2 },
  { ch: "λ", art: "chandelier", name: "Crystal chandelier", w: 2 },
  { ch: "Γ", art: "rubber-duck-statue", name: "Rubber-duck statue", w: 1 },
];

/** The wall posters (`POSTERS`): map character, art name, title, width in tiles, the joke E shows. */
export const POSTERS: readonly { ch: string; art: string; name: string; w: number; text: string }[] = [
  {
    ch: "7",
    art: "super-merge",
    name: "Super Merge Bros",
    w: 1,
    text: "World 1-1: resolve the conflict, grab the flag. The princess is in another repo.",
  },
  {
    ch: "6",
    art: "dark-deploys",
    name: "Dark Deploys",
    w: 1,
    text: "YOU DIED. Rolled back to the last checkpoint: Friday, 4:59 pm.",
  },
  {
    ch: "8",
    art: "slay-backlog",
    name: "Slay the Backlog",
    w: 1,
    text: "Pick a card: refactor, hotfix or quick sync. The deck has no way to remove meetings.",
  },
  {
    ch: "9",
    art: "last-dev",
    name: "Last Dev Standing",
    w: 1,
    text: "100 devs drop in. The storm is the sprint deadline. Nobody remembers where the loot was.",
  },
  {
    ch: "5",
    art: "pipeline-valley",
    name: "Pipeline Valley",
    w: 2,
    text: "Plant a commit, water it with CI, harvest a green build. The cows are on call.",
  },
  {
    ch: "1",
    art: "deploy-league",
    name: "Deploy League",
    w: 2,
    text: "A rocket-powered car, a very large ball and no rollback plan. GOAL! (To prod.)",
  },
  {
    ch: "0",
    art: "counter-ci",
    name: "Counter-CI: Global Flake",
    w: 2,
    text: "The bomb is defused, the pipeline goes red, a rerun fixes it. Nobody knows why.",
  },
  {
    ch: "2",
    art: "league-linters",
    name: "League of Linters",
    w: 2,
    text: "5v5, one lane, 40 minutes. The ancient is a 2,000-line function. Surrender at 20 (warnings).",
  },
  {
    ch: "3",
    art: "defense-deps",
    name: "Defense of the Dependencies",
    w: 2,
    text: "Three lanes, 120 heroes, and every patch breaks the meta. node_modules is the final boss.",
  },
  {
    ch: "4",
    art: "lootborn",
    name: "Lootborn",
    w: 2,
    text: "Kill the same boss 300 times for a helmet one power level higher. Season pass not included.",
  },
];

/** The company fleet's desk tiers, in order of grandeur (`DESKS`). */
export const DESKS = [
  { id: "laptop", name: "Laptop" },
  { id: "dual", name: "Dual monitors" },
  { id: "triple", name: "Triple monitors" },
  { id: "ultrawide", name: "Ultrawide" },
  { id: "battlestation", name: "Battlestation" },
] as const;
