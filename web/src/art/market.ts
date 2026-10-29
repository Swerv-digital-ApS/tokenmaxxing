import { TILE } from "@tokenmaxxing/core/world.ts";
import { C } from "./palette.ts";
import { bake, cached, once, type Pen } from "./pixels.ts";

/**
 * Torvehallen's 2D art: the market hall's front for the town (5x4 tiles: a glass roof on steel ribs, a gable
 * with the name, a striped canvas awning, crates of produce in the windows and a wide glass door), and the tiles
 * inside (the weighing counter, the shelves along the back wall, the glass cases, the pillars and crates).
 * The cases and shelves are drawn empty: `game/market.ts` puts what is on sale in them and the price tag on.
 */

const BRICK = "#9c5a45";
const BRICK_D = "#7e4636";
const STEEL = "#4d6a72";
const STEEL_D = "#35505a";
const STEEL_L = "#7fa0aa";
const GLASS = "#b9e0e8";
const GLASS_D = "#7fb4c2";
const GREEN = "#2f6b4f";
const GREEN_D = "#1f4a38";
const CREAM = "#f4efe4";
const GOLD = "#e9b73d";
const FELT = "#2f5f4a";
const PLANK = "#c9a066";

const W = 5 * TILE;
const H = 4 * TILE;

/** A crate of fruit seen from the front: slatted wood with `fruit` heaped on top. */
function crate(p: Pen, x: number, y: number, w: number, fruit: string): void {
  p.rect(x, y + 2, w, 4, C.ink);
  p.rect(x + 1, y + 3, w - 2, 2, C.wood);
  p.rect(x + 1, y + 3, w - 2, 1, C.woodLight);
  for (let i = x + 2; i < x + w - 2; i += 2) p.px(i, y + 1, fruit);
  p.rect(x + 1, y + 2, w - 2, 1, fruit);
}

/** The hall from the street, from its top-left tile. The door tile is in the middle of the bottom row. */
export const marketFront = once(() =>
  bake(W, H, (p) => {
    p.rect(1, H - 2, W - 2, 2, C.shadow);
    // Brick walls on a stone plinth.
    p.rect(0, 14, W, H - 14, C.ink);
    p.rect(1, 15, W - 2, H - 16, BRICK);
    for (let y = 17; y < H - 4; y += 3) {
      p.rect(1, y, W - 2, 1, BRICK_D);
      for (let x = (y / 3) % 2 ? 3 : 6; x < W - 1; x += 6) p.rect(x, y - 2, 1, 2, BRICK_D);
    }
    p.rect(1, H - 4, W - 2, 3, C.stoneDark);
    p.rect(1, H - 4, W - 2, 1, C.stone);
    // The glass roof: a band of panes between steel ribs, with a glint on each.
    p.rect(0, 6, W, 9, C.ink);
    p.rect(1, 7, W - 2, 7, GLASS_D);
    for (let x = 1; x < W - 1; x += 8) {
      p.rect(x, 7, 1, 7, STEEL);
      p.rect(x + 2, 8, 3, 1, GLASS);
      p.px(x + 3, 10, GLASS);
    }
    p.rect(1, 13, W - 2, 1, STEEL_D);
    // The gable over the door, with the name in white on a deep green board.
    p.rect(14, 0, 52, 15, C.ink);
    p.rect(15, 1, 50, 13, STEEL);
    p.rect(15, 1, 50, 1, STEEL_L);
    p.rect(17, 3, 46, 9, C.ink);
    p.rect(18, 4, 44, 7, GREEN_D);
    p.text("TORVEHALLEN", 19, 5, CREAM);
    p.px(16, 7, GOLD);
    p.px(63, 7, GOLD);
    // The awning along the wall: green and cream stripes with a scalloped edge.
    for (let x = 2; x < W - 2; x += 4) {
      const stripe = (x / 4) % 2 === 0 ? GREEN : CREAM;
      p.rect(x, 21, 4, 4, stripe);
      p.rect(x + 1, 25, 2, 1, stripe);
    }
    p.rect(2, 20, W - 4, 1, C.ink);
    // Two shop windows with crates behind the glass.
    for (const [i, x] of [6, W - 28].entries()) {
      p.rect(x - 1, 29, 24, 21, C.ink);
      p.rect(x, 30, 22, 19, GLASS);
      p.rect(x, 30, 22, 2, C.white);
      p.rect(x + 2, 33, 1, 12, C.white);
      p.rect(x + 11, 30, 1, 19, STEEL);
      crate(p, x + 2, 38, 8, i ? C.flowerYellow : C.flowerRed);
      crate(p, x + 12, 38, 8, i ? C.flowerRed : C.leaf);
      p.rect(x + 1, 44, 20, 5, C.woodDark);
      p.rect(x + 1, 44, 20, 1, C.wood);
    }
    // The door: a steel frame round two glass leaves, a green transom over them, and a step.
    const mid = W / 2;
    p.rect(mid - 10, H - 28, 20, 28, C.ink);
    p.rect(mid - 9, H - 27, 18, 27, STEEL);
    p.rect(mid - 8, H - 24, 7, 24, GLASS_D);
    p.rect(mid + 1, H - 24, 7, 24, GLASS_D);
    p.rect(mid - 8, H - 24, 7, 1, C.white);
    p.rect(mid + 1, H - 24, 7, 1, C.white);
    p.rect(mid - 6, H - 21, 1, 6, C.white);
    p.rect(mid + 3, H - 21, 1, 6, C.white);
    p.rect(mid - 8, H - 27, 16, 3, GREEN);
    p.px(mid, H - 26, GOLD);
    p.rect(mid - 11, H - 1, 22, 1, C.stoneDark);
    // A barrel of flowers on each side of the door.
    for (const x of [mid - 17, mid + 12]) {
      p.rect(x, H - 9, 5, 6, C.ink);
      p.rect(x + 1, H - 8, 3, 4, C.woodDark);
      p.rect(x, H - 11, 5, 3, C.leaf);
      p.px(x + 1, H - 12, C.flowerRed);
      p.px(x + 3, H - 12, C.flowerYellow);
      p.px(x + 2, H - 11, C.flowerWhite);
    }
  }),
);

type Part = "l" | "m" | "r" | "s";

/** A glass case is a run of tiles; this is which piece of the run a tile is. */
export const casePart = (left: boolean, right: boolean): Part =>
  left && right ? "s" : left ? "l" : right ? "r" : "m";

/**
 * Where an item stands in each kind of display, in pixels down from the tile's top: the line it stands on, the
 * top of its price tag and the tallest it may be. A case is a run of glass-topped tables with a felt bed (a
 * tall thing pokes out of the top); a shelf is a niche in the back wall with a plank.
 */
export const SLOT_LOOK = {
  case: { floor: 8, tag: 9, fit: 12 },
  shelf: { floor: 10, tag: 10, fit: 10 },
} as const;

/** One tile of a glass case (a run of four): wooden base, felt bed, glass hood. Drawn empty. */
export const marketCase = cached(
  (part: Part) => part,
  (part: Part) =>
    bake(TILE, TILE, (p) => {
      const l = part === "l" || part === "s";
      const r = part === "r" || part === "s";
      p.rect(1, 15, 14, 1, C.shadow);
      // The wooden base with a green panel and a gold edge.
      p.rect(0, 8, TILE, 8, C.ink);
      p.rect(l ? 1 : 0, 9, TILE - (l ? 1 : 0) - (r ? 1 : 0), 6, C.wood);
      p.rect(l ? 2 : 0, 10, TILE - (l ? 2 : 0) - (r ? 2 : 0), 4, GREEN);
      p.rect(l ? 2 : 0, 10, TILE - (l ? 2 : 0) - (r ? 2 : 0), 1, GREEN_D);
      p.rect(0, 9, TILE, 1, GOLD);
      // The felt bed, and the hood over it: glass in a steel frame, open at the joins of a run.
      p.rect(0, 7, TILE, 2, FELT);
      p.rect(0, 0, TILE, 1, STEEL_L);
      p.rect(0, 1, TILE, 6, "rgba(185, 224, 232, 0.45)");
      if (l) p.rect(0, 0, 1, 8, STEEL);
      if (r) p.rect(TILE - 1, 0, 1, 8, STEEL);
    }),
);

/** The shine over what is in a case, drawn after it: a pale stripe or two across the glass. */
export const caseGlass = cached(
  (part: Part) => part,
  (part: Part) =>
    bake(TILE, 8, (p) => {
      p.rect(0, 0, TILE, 1, "rgba(255, 255, 255, 0.7)");
      const at = part === "l" ? 4 : part === "r" ? 9 : 6;
      p.rect(at, 1, 1, 5, "rgba(255, 255, 255, 0.35)");
      p.rect(at + 2, 1, 1, 3, "rgba(255, 255, 255, 0.25)");
    }),
);

/** One shelf in the back wall: a cabinet under a niche with a plank to stand things on, 4 pixels over the wall. */
export const marketShelf = cached(
  (x: number) => `${x % 2}`,
  (x: number) =>
    bake(TILE, 20, (p) => {
      p.rect(1, 18, 14, 2, C.shadow);
      p.rect(0, 0, TILE, 18, C.ink);
      p.rect(1, 1, 14, 17, C.woodDark);
      // The niche: a dark green back, lit from the top.
      p.rect(2, 3, 12, 11, GREEN_D);
      p.rect(2, 3, 12, 2, GREEN);
      p.rect(2, 13, 12, 1, C.ink);
      // The plank, and the cupboard under it.
      p.rect(1, 14, 14, 2, PLANK);
      p.rect(1, 14, 14, 1, C.woodLight);
      p.rect(2, 16, 12, 2, C.wood);
      p.px(x % 2 ? 4 : 11, 17, GOLD);
      p.rect(1, 1, 14, 1, C.woodLight);
    }),
);

/** The counter, one tile of a run: a pale scrubbed top over a green-and-cream front, with the scale on one and the till on another. */
export const marketCounter = cached(
  (kind: "plain" | "till" | "scale") => kind,
  (kind: "plain" | "till" | "scale") =>
    bake(TILE, TILE, (p) => {
      p.rect(0, 5, TILE, 11, C.ink);
      p.rect(0, 6, TILE, 4, PLANK);
      p.rect(0, 6, TILE, 1, C.woodLight);
      p.rect(1, 10, 14, 5, GREEN);
      for (let x = 1; x < 15; x += 4) p.rect(x, 10, 2, 5, CREAM);
      p.rect(1, 10, 14, 1, GREEN_D);
      p.rect(1, 14, 14, 1, GREEN_D);
      if (kind === "till") {
        p.rect(2, 1, 7, 6, C.ink);
        p.rect(3, 2, 5, 3, C.metal);
        p.rect(4, 3, 3, 1, C.screen);
        p.rect(3, 5, 5, 1, C.metalLight);
        p.rect(11, 4, 3, 2, GOLD);
      } else if (kind === "scale") {
        // A brass scale: a post, a beam and two pans.
        p.rect(7, 2, 2, 5, C.ink);
        p.rect(3, 2, 10, 1, C.ink);
        p.rect(2, 3, 3, 1, GOLD);
        p.rect(11, 3, 3, 1, GOLD);
        p.rect(5, 6, 6, 1, C.ink);
      }
    }),
);

/** What a `‡` is in the hall: a steel pillar on the back wall, else a crate of produce. */
export const marketFixture = cached(
  (pillar: boolean) => `${pillar}`,
  (pillar: boolean) => {
    if (pillar)
      return bake(TILE, 20, (p) => {
        p.rect(3, 18, 10, 2, C.shadow);
        p.rect(4, 0, 8, 18, C.ink);
        p.rect(5, 1, 6, 16, STEEL);
        p.rect(5, 1, 2, 16, STEEL_L);
        p.rect(10, 1, 1, 16, STEEL_D);
        p.rect(3, 15, 10, 3, C.ink);
        p.rect(4, 16, 8, 1, STEEL_L);
        p.rect(7, 4, 2, 2, GOLD);
      });
    return bake(TILE, 14, (p) => {
      p.rect(1, 12, 14, 2, C.shadow);
      p.rect(1, 3, 14, 10, C.ink);
      p.rect(2, 4, 12, 8, C.wood);
      p.rect(2, 8, 12, 1, C.woodDark);
      p.rect(5, 4, 1, 8, C.woodDark);
      p.rect(10, 4, 1, 8, C.woodDark);
      for (const [i, c] of [C.flowerRed, C.leaf, C.flowerYellow].entries()) p.disc(4 + i * 4, 3, 2, c);
    });
  },
);

/** "120", or "1.2K" from a thousand: the digits on a price tag, which has room for four characters. */
export function tagText(price: number): string {
  if (price < 1000) return String(price);
  const k = Math.round(price / 100) / 10;
  return `${Number.isInteger(k) ? k : k.toFixed(1)}K`;
}

/** A small price tag: the number on a cream card (gold for one of mine). */
export const priceTag = cached(
  (price: number, mine: boolean) => `${price}${mine}`,
  (price: number, mine: boolean) => {
    const text = tagText(price);
    const w = text.length * 4 - 1 + 4;
    return bake(w, 7, (p) => {
      p.rect(0, 0, w, 7, C.ink);
      p.rect(1, 1, w - 2, 5, mine ? GOLD : CREAM);
      p.text(text, 2, 1, C.ink);
    });
  },
);
