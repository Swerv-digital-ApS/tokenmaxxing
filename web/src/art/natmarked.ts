import { TILE } from "@tokenmaxxing/core/world.ts";
import { C } from "./palette.ts";
import { bake, cached, hash, once, type Pen } from "./pixels.ts";

/**
 * Natmarked's 2D art: the night-market hall's front for the town (5x4 tiles: tiled roof, a neon sign, a string
 * of red lanterns, windows glowing through paper, an indigo noren across the door and a steaming stall on the
 * corner), and the tiles inside (the lacquered counter, the lit shelves, lantern posts, stall counters, tables).
 */

const TIMBER = "#4a3226";
const TIMBER_D = "#33231b";
const TIMBER_L = "#6e4b38";
const RED = "#d8402f";
const RED_D = "#a42a22";
const GOLD = "#e9b73d";
const PAPER = "#f6e6bf";
const INDIGO = "#243a73";
const LACQUER = "#1d1822";
const ROOF = "#2c2a38";
const PINK = "#ff5fa8";
const CYAN = "#58e6ff";

const W = 5 * TILE;
const H = 4 * TILE;

/** A hanging paper lantern, 3 wide and 4 high, its cap at (x, y). */
function lantern(p: Pen, x: number, y: number): void {
  p.rect(x, y, 3, 1, GOLD);
  p.rect(x - 1, y + 1, 5, 3, RED);
  p.rect(x, y + 4, 3, 1, RED_D);
  p.px(x + 1, y + 5, GOLD);
  p.px(x, y + 2, "#ff9a52");
}

/** Steam: a few pale pixels drifting up. */
function steam(p: Pen, x: number, y: number): void {
  for (const [dx, dy] of [
    [0, 0],
    [1, -2],
    [0, -4],
    [-1, -6],
    [1, -8],
  ] as const) {
    p.px(x + dx, y + dy, "#f4f0ea");
    p.px(x + dx + 1, y + dy, "rgba(244,240,234,0.55)");
  }
}

/** The hall from the street, from its top-left tile. The door tile is in the middle of the bottom row. */
export const natmarkedFront = once(() =>
  bake(W, H, (p) => {
    p.rect(1, H - 2, W - 2, 2, C.shadow);
    // Walls: dark board-and-batten timber on a stone plinth.
    p.rect(0, 14, W, H - 14, C.ink);
    p.rect(1, 15, W - 2, H - 16, TIMBER);
    for (let x = 3; x < W - 1; x += 4) p.rect(x, 15, 1, H - 16, TIMBER_D);
    p.rect(1, H - 4, W - 2, 3, C.stoneDark);
    p.rect(1, H - 4, W - 2, 1, C.stone);
    // The tiled roof: two courses of tiles, a ridge with gold ends, and a deep dark eave.
    p.rect(0, 0, W, 15, C.ink);
    p.rect(1, 1, W - 2, 12, ROOF);
    for (let y = 3; y < 12; y += 3) {
      p.rect(1, y, W - 2, 1, "#1f1d29");
      for (let x = (y / 3) % 2 ? 2 : 5; x < W - 1; x += 6) p.rect(x, y + 1, 1, 2, "#1f1d29");
    }
    p.rect(1, 1, W - 2, 1, "#3d3a4d");
    p.rect(0, 1, 3, 4, GOLD);
    p.rect(W - 3, 1, 3, 4, GOLD);
    p.rect(0, 13, W, 3, "#1a1823");
    // The neon sign across the roof's lower edge: pink text on a dark board, a cyan rule under it.
    p.rect(16, 4, 48, 10, C.ink);
    p.rect(17, 5, 46, 8, "#14101c");
    p.text("NATMARKED", 22, 6, "#ff2f8f");
    p.text("NATMARKED", 22, 6, PINK);
    for (let x = 18; x < 62; x += 2) p.px(x, 12, CYAN);
    p.px(15, 8, "#ff2f8f");
    p.px(64, 8, "#ff2f8f");
    // The lantern string along the eave: a sagging wire with lanterns.
    for (let x = 2; x < W - 2; x++)
      p.px(x, 18 + Math.round(Math.sin(((x - 2) / (W - 4)) * Math.PI * 4) * 0.8 + 0.8), C.ink);
    for (let i = 0; i < 9; i++) lantern(p, 5 + i * 8, 19 + (i % 2));
    // Two windows, warm paper behind slats; a dark silhouette of crates.
    for (const x of [6, W - 28]) {
      p.rect(x - 1, 30, 24, 15, C.ink);
      p.rect(x, 31, 22, 13, TIMBER_L);
      p.rect(x + 1, 32, 20, 11, PAPER);
      for (let sx = x + 4; sx < x + 21; sx += 4) p.rect(sx, 32, 1, 11, TIMBER_D);
      p.rect(x + 1, 37, 20, 1, TIMBER_D);
      p.rect(x + 3, 39, 5, 4, "#241719");
      p.rect(x + 10, 38, 4, 5, "#241719");
      p.disc(x + 17, 40, 2, "#241719");
      p.rect(x - 1, 44, 24, 2, TIMBER_L);
    }
    // The door: a dark opening under a lintel, with the indigo noren hung across the top.
    const mid = W / 2;
    p.rect(mid - 9, H - 28, 18, 28, C.ink);
    p.rect(mid - 8, H - 27, 16, 27, "#140d0b");
    p.rect(mid - 10, H - 30, 20, 3, TIMBER_L);
    for (const dx of [-8, -2, 4]) {
      p.rect(mid + dx, H - 26, 5, 13, INDIGO);
      p.rect(mid + dx, H - 26, 5, 1, "#3a559e");
      p.disc(mid + dx + 2, H - 20, 1, "#f3efe2");
      p.rect(mid + dx, H - 14, 5, 1, "#f3efe2");
    }
    p.rect(mid - 11, H - 1, 22, 1, C.stoneDark);
    // Standing lanterns by the door.
    for (const x of [mid - 14, mid + 12]) {
      p.rect(x, H - 9, 3, 1, GOLD);
      p.rect(x - 1, H - 8, 5, 5, RED);
      p.px(x, H - 7, "#ff9a52");
      p.rect(x, H - 3, 3, 1, GOLD);
    }
    // The corner stall (right): a striped canopy over a counter, a pot, and its steam.
    p.rect(W - 18, H - 22, 16, 2, C.ink);
    for (let x = W - 18; x < W - 2; x += 4) {
      p.rect(x, H - 21, 2, 3, RED);
      p.rect(x + 2, H - 21, 2, 3, "#f4efe4");
    }
    p.rect(W - 17, H - 18, 1, 14, TIMBER_D);
    p.rect(W - 4, H - 18, 1, 14, TIMBER_D);
    p.rect(W - 18, H - 10, 16, 6, C.ink);
    p.rect(W - 17, H - 9, 14, 4, LACQUER);
    p.rect(W - 17, H - 9, 14, 1, RED_D);
    p.rect(W - 14, H - 14, 5, 4, "#9aa3ad");
    p.rect(W - 14, H - 14, 5, 1, "#c9d0d8");
    p.rect(W - 8, H - 12, 3, 2, "#f3efe2");
    steam(p, W - 12, H - 16);
    // The ÅBEN blade sign, left of the door: a small vertical neon.
    p.rect(2, 22, 5, 24, C.ink);
    p.rect(3, 23, 3, 22, "#14101c");
    p.rect(3, 25, 3, 1, CYAN);
    p.rect(3, 27, 3, 1, CYAN);
    p.rect(3, 29, 3, 1, CYAN);
    p.rect(3, 33, 3, 1, PINK);
    p.rect(3, 35, 3, 1, PINK);
    p.rect(3, 37, 3, 1, PINK);
  }),
);

/** The lacquered counter, one tile of a run: black top over a red front with gold bands; every third has the case's stand. */
export const natCounter = cached(
  (till: boolean) => `${till}`,
  (till: boolean) =>
    bake(TILE, TILE, (p) => {
      p.rect(0, 5, TILE, 11, C.ink);
      p.rect(0, 6, TILE, 4, LACQUER);
      p.rect(0, 6, TILE, 1, "#3a3342");
      p.rect(1, 10, 14, 5, RED_D);
      p.rect(1, 10, 14, 1, GOLD);
      p.rect(1, 14, 14, 1, GOLD);
      p.rect(5, 11, 1, 3, GOLD);
      p.rect(10, 11, 1, 3, GOLD);
      if (!till) return;
      // The case on its stand: a plum box with a gold lid and a lantern emblem.
      p.rect(3, 0, 10, 7, C.ink);
      p.rect(4, 1, 8, 2, GOLD);
      p.rect(4, 3, 8, 3, "#5a2a6e");
      p.rect(4, 5, 8, 1, "#a82840");
      p.rect(7, 3, 2, 2, "#ffd36a");
      p.px(7, 6, GOLD);
      p.px(8, 6, GOLD);
    }),
);

/** A shelf tile (against the back wall): a cabinet under a glowing niche; the first holds the case, the rest a locked silhouette. */
export const natShelf = cached(
  (x: number) => `${x}`,
  (x: number) =>
    bake(TILE, 20, (p) => {
      // Six shelves of two tiles each, from x = 2 (the first holds the case on sale).
      const shelf = Math.floor((x - 2) / 3);
      const glow = ["#ffb347", "#5fd7ff", "#ff6fb5", "#9b7bff", "#6bffb0", "#ffd36a"][shelf % 6]!;
      p.rect(1, 18, 14, 2, C.shadow);
      p.rect(0, 0, 16, 18, C.ink);
      p.rect(1, 1, 14, 17, TIMBER);
      p.rect(2, 2, 12, 9, glow);
      p.rect(2, 2, 12, 1, "#ffffff");
      p.rect(1, 11, 14, 1, TIMBER_L);
      p.rect(2, 12, 6, 5, TIMBER_D);
      p.rect(8, 12, 6, 5, TIMBER_D);
      p.px(7, 14, GOLD);
      p.px(8, 14, GOLD);
      if (shelf === 0) {
        if (x !== 2) {
          // The other half of the first shelf: a gold plaque, the niche left bare.
          p.rect(4, 5, 8, 3, PAPER);
          p.rect(4, 5, 8, 1, RED_D);
          return;
        }
        p.rect(4, 4, 8, 7, "#5a2a6e");
        p.rect(4, 3, 8, 2, GOLD);
        p.rect(4, 9, 8, 1, "#a82840");
        p.rect(7, 6, 2, 2, "#ffd36a");
      } else {
        const shape = Math.floor(hash(x, 1, 5) * 3);
        const dark = "#0e0a14";
        if (shape === 0) p.rect(4, 5, 8, 6, dark);
        else if (shape === 1) {
          p.rect(5, 4, 6, 7, dark);
          p.rect(4, 4, 8, 1, dark);
        } else {
          p.rect(4, 7, 8, 4, dark);
          p.rect(5, 5, 6, 2, dark);
        }
        p.rect(11, 12, 3, 3, GOLD);
        p.rect(12, 11, 1, 1, GOLD);
      }
    }),
);

type Fixture = "post" | "stall" | "table";

/** What a `‡` is in Natmarked: a lantern post, a stall's counter, or a tea table. */
export const natFixture = cached(
  (kind: Fixture, flip: boolean) => `${kind}${flip}`,
  (kind: Fixture, flip: boolean) => {
    if (kind === "stall")
      return bake(TILE, 16, (p) => {
        p.rect(0, 14, TILE, 2, C.shadow);
        p.rect(0, 2, TILE, 12, C.ink);
        p.rect(0, 3, TILE, 4, "#3a3342");
        p.rect(1, 7, 14, 6, flip ? INDIGO : RED_D);
        p.rect(1, 7, 14, 1, GOLD);
        // A pot with steam, a bowl, a bun basket.
        p.rect(3, 1, 4, 3, "#9aa3ad");
        p.rect(10, 2, 3, 2, "#c9a05a");
        p.px(4, 0, "#f4f0ea");
        p.px(11, 0, "#f4f0ea");
      });
    if (kind === "table")
      return bake(TILE, 16, (p) => {
        p.rect(3, 14, 10, 2, C.shadow);
        p.rect(2, 4, 12, 6, C.ink);
        p.rect(3, 5, 10, 4, LACQUER);
        p.rect(3, 5, 10, 1, "#3a3342");
        p.rect(7, 10, 2, 4, TIMBER_D);
        p.rect(5, 13, 6, 1, TIMBER_D);
        p.rect(4, 3, 3, 2, "#f3efe2");
        p.rect(9, 3, 3, 2, RED);
      });
    return bake(TILE, 28, (p) => {
      p.rect(4, 26, 8, 2, C.shadow);
      p.rect(6, 6, 4, 21, C.ink);
      p.rect(7, 7, 2, 19, TIMBER_D);
      p.rect(5, 24, 6, 3, TIMBER_L);
      p.rect(4, 5, 8, 2, TIMBER_L);
      p.rect(10, 7, 1, 4, TIMBER_L);
      lantern(p, 10, 8);
      p.rect(1, 3, 14, 1, C.ink);
    });
  },
);
export type { Fixture };
