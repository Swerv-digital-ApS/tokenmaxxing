import { ALL_CASE_PIECES, isCasePiece } from "@tokenmaxxing/core/case-furniture.ts";
import { HOME_PIECES, isHomePiece } from "@tokenmaxxing/core/home.ts";
import type { GameMap } from "@tokenmaxxing/core/maps.ts";
import { COMPANY_FURNITURE, sideways, turnAt } from "@tokenmaxxing/core/office.ts";
import { isPoster, posterOf } from "@tokenmaxxing/core/posters.ts";
import { SHOP_DISPLAY_CHAR, SHOP_DOOR_CHAR, SHOP_IDS } from "@tokenmaxxing/core/shoprooms.ts";
import { WINDMILL } from "@tokenmaxxing/core/windmill.ts";
import { TILE } from "@tokenmaxxing/core/world.ts";
import { bigScreen, SCREEN_H, SCREEN_TILES, tournamentBoard, wallTerminal } from "./basement.ts";
import { counter, windowPane, winsTile } from "./common.ts";
import { type FancyPiece, fancyPiece, fancySprite } from "./furniture-fancy.ts";
import { POSTER_H, posterSprite } from "./furniture-posters.ts";
import { trophyAt } from "./loot.ts";
import { casePart, marketCase, marketCounter, marketFixture, marketShelf } from "./market.ts";
import { natCounter, natFixture, natShelf } from "./natmarked.ts";
import { C } from "./palette.ts";
import { bake, cached, once, type Pen } from "./pixels.ts";
import { coatStand, fixture, shopCounter, shopDisplay, storefront } from "./shops.ts";
import {
  bar,
  barJar,
  barrel,
  hallWall,
  hearth,
  jukebox,
  plaque,
  pokerTable,
  questBoard,
  requestPile,
  rouletteSpot,
  rouletteTable,
  stool,
  table,
} from "./tavern.ts";
import { MILL_H, millTower } from "./windmill.ts";

/** A baked sprite and where it sits relative to its tile's top-left corner. */
interface Placed {
  canvas: HTMLCanvasElement;
  dx: number;
  dy: number;
  /** Company furniture: the render loop picks its frame (and the neon sign's name) every frame. */
  fancy?: FancyPiece;
}

/** Company furniture and personal offices' furniture (`HOME_PIECES`) by map character, with its art. */
const FANCY = new Map(
  [...COMPANY_FURNITURE.filter((f) => !f.wall), ...HOME_PIECES, ...ALL_CASE_PIECES].map((f) => [
    f.ch,
    { w: f.w ?? 1, art: fancyPiece(f.art)! },
  ]),
);

const tree = once(() =>
  bake(16, 26, (p) => {
    p.rect(3, 23, 10, 2, C.shadow);
    p.rect(6, 16, 4, 8, C.trunkDark);
    p.rect(7, 16, 2, 7, C.trunk);
    p.disc(8, 9, 8, C.leafInk);
    p.disc(8, 9, 7, C.leafDark);
    p.disc(7, 8, 6, C.leaf);
    p.disc(5, 5, 2, C.leafLight);
    for (const [x, y] of [
      [10, 5],
      [4, 10],
      [11, 11],
      [8, 13],
      [12, 8],
    ] as const)
      p.px(x, y, C.leafDark);
    for (const [x, y] of [
      [9, 3],
      [3, 7],
      [6, 11],
    ] as const)
      p.px(x, y, C.leafLight);
  }),
);

const bush = once(() =>
  bake(16, 16, (p) => {
    p.rect(3, 14, 10, 2, C.shadow);
    p.disc(8, 9, 6, C.leafInk);
    p.disc(8, 9, 5, C.leafDark);
    p.disc(7, 8, 4, C.leaf);
    p.px(5, 6, C.leafLight);
    p.px(6, 5, C.leafLight);
    p.px(10, 10, C.leafDark);
  }),
);

const lamp = once(() =>
  bake(16, 32, (p) => {
    p.rect(4, 29, 8, 2, C.shadow);
    p.rect(5, 27, 6, 3, C.metal);
    p.rect(7, 8, 2, 20, C.metal);
    p.rect(7, 8, 1, 20, C.metalLight);
    p.rect(4, 1, 8, 1, C.metal);
    p.rect(4, 2, 8, 6, C.ink);
    p.rect(5, 3, 6, 4, C.lamp);
    p.rect(5, 3, 2, 1, C.white);
  }),
);

const fountain = once(() =>
  bake(32, 32, (p) => {
    p.disc(16, 18, 15, C.stoneDark);
    p.disc(16, 17, 14, C.stone);
    p.disc(16, 17, 12, C.stoneLight);
    p.disc(16, 17, 11, C.waterDark);
    p.disc(16, 16, 10, C.water);
    p.disc(16, 15, 3, C.stoneDark);
    p.disc(16, 14, 3, C.stoneLight);
    p.rect(15, 4, 3, 10, C.stone);
    p.rect(15, 4, 1, 10, C.stoneLight);
    p.disc(16, 4, 2, C.waterLight);
  }),
);

const board = once(() =>
  bake(16, 26, (p) => {
    p.rect(2, 24, 12, 2, C.shadow);
    p.rect(3, 14, 2, 11, C.woodDark);
    p.rect(11, 14, 2, 11, C.woodDark);
    p.rect(0, 1, 16, 15, C.ink);
    p.rect(1, 2, 14, 13, C.woodDark);
    p.rect(2, 3, 12, 11, C.wood);
    p.rect(3, 4, 6, 8, C.white);
    for (let y = 6; y < 12; y += 2) p.rect(4, y, 4, 1, C.stoneDark);
    // A little trophy: it's the leaderboard.
    p.rect(10, 5, 3, 3, C.flowerYellow);
    p.px(9, 5, C.flowerYellow);
    p.px(13, 5, C.flowerYellow);
    p.rect(11, 8, 1, 2, C.flowerYellow);
    p.rect(10, 10, 3, 1, C.woodDark);
  }),
);

/** The star counter (`★`): a navy board on a post with a big gold star; the count goes on a sign over it. */
const STAR = ["....#....", "...###...", "#########", ".#######.", "..#####..", "..##.##..", ".##...##."];
const starBoard = once(() =>
  bake(16, 26, (p) => {
    p.rect(3, 24, 10, 2, C.shadow);
    p.rect(7, 14, 2, 11, C.woodDark);
    p.rect(7, 14, 1, 11, C.wood);
    p.rect(0, 1, 16, 15, C.ink);
    p.rect(1, 2, 14, 13, "#2f3650");
    p.rect(2, 3, 12, 11, "#1f2433");
    STAR.forEach((row, y) => {
      for (let x = 0; x < row.length; x++) if (row[x] === "#") p.px(4 + x, 5 + y, C.flowerYellow);
    });
    p.px(8, 6, C.white);
    p.px(7, 7, C.white);
    // A few small stars twinkling round it.
    for (const [x, y] of [
      [3, 4],
      [12, 4],
      [12, 12],
    ] as const)
      p.px(x, y, C.white);
  }),
);

const bench = once(() =>
  bake(16, 16, (p) => {
    p.rect(1, 13, 14, 2, C.shadow);
    p.rect(1, 2, 14, 1, C.ink);
    p.rect(1, 3, 14, 3, C.woodDark);
    p.rect(1, 3, 14, 1, C.wood);
    p.rect(0, 7, 16, 5, C.ink);
    p.rect(1, 7, 14, 4, C.wood);
    p.rect(1, 9, 14, 1, C.woodDark);
    p.rect(2, 11, 2, 3, C.woodDark);
    p.rect(12, 11, 2, 3, C.woodDark);
  }),
);

const bed = once(() =>
  bake(16, 16, (p) => {
    p.rect(1, 0, 14, 16, C.ink);
    p.rect(2, 1, 12, 14, C.woodDark);
    p.rect(3, 1, 10, 14, C.white);
    p.rect(4, 2, 8, 4, C.pillow);
    p.rect(4, 5, 8, 1, C.stoneLight);
    p.rect(3, 7, 10, 8, C.fabric);
    p.rect(3, 7, 10, 1, C.fabricDark);
    p.rect(3, 14, 10, 1, C.fabricDark);
  }),
);

const desk = once(() =>
  bake(16, 18, (p) => {
    p.rect(0, 6, 16, 12, C.ink);
    p.rect(0, 7, 16, 4, C.woodLight);
    p.rect(0, 11, 16, 5, C.wood);
    p.rect(0, 16, 2, 2, C.woodDark);
    p.rect(14, 16, 2, 2, C.woodDark);
    // Laptop, screen glowing: someone's agents are running.
    p.rect(4, 0, 8, 7, C.ink);
    p.rect(5, 1, 6, 5, C.screen);
    p.rect(5, 2, 3, 1, C.white);
    p.rect(5, 4, 5, 1, "#5fc6e8");
    p.rect(3, 7, 10, 2, C.metalLight);
    p.rect(3, 9, 10, 1, C.metal);
  }),
);

/** The dungeon's war desk: a desk with its laptop shut until a raider sits at it (game/raid.ts). */
const warDesk = once(() =>
  bake(16, 18, (p) => {
    p.rect(0, 6, 16, 12, C.ink);
    p.rect(0, 7, 16, 4, C.metalLight);
    p.rect(0, 11, 16, 5, C.metal);
    p.rect(0, 16, 2, 2, C.ink);
    p.rect(14, 16, 2, 2, C.ink);
    p.rect(4, 0, 8, 7, C.ink);
    p.rect(5, 1, 6, 5, "#3b4252");
    p.rect(3, 7, 10, 2, C.stoneDark);
    p.rect(3, 9, 10, 1, C.metal);
  }),
);

const torch = once(() =>
  bake(16, 26, (p) => {
    p.rect(5, 24, 6, 2, C.shadow);
    p.rect(7, 10, 2, 15, C.ink);
    p.rect(7, 10, 1, 14, C.woodDark);
    p.rect(4, 7, 8, 4, C.ink);
    p.rect(5, 8, 6, 2, C.metal);
    // The flame; game/raid.ts flickers a glow over it.
    p.rect(6, 2, 4, 6, "#e9733d");
    p.rect(7, 0, 2, 3, "#e9733d");
    p.rect(7, 4, 2, 4, "#ffd35c");
  }),
);

/** Stairs down into the raid dungeon, under a stone arch a little wider than its tile. */
const gate = once(() =>
  bake(24, 28, (p) => {
    p.disc(12, 11, 11, C.ink);
    p.rect(1, 11, 22, 17, C.ink);
    p.disc(12, 11, 10, C.stoneDark);
    p.rect(2, 11, 20, 17, C.stoneDark);
    // Stone blocks round the arch.
    for (const [x, y] of [
      [4, 6],
      [9, 2],
      [15, 2],
      [19, 7],
      [2, 14],
      [20, 15],
      [3, 21],
      [19, 22],
    ] as const)
      p.rect(x, y, 3, 1, C.stoneLight);
    // The way down: dark, a violet glow at the bottom, and steps.
    p.disc(12, 12, 6, "#1c1924");
    p.rect(6, 12, 13, 16, "#1c1924");
    p.rect(7, 24, 11, 4, "#3b2a5a");
    for (let i = 0; i < 4; i++) {
      p.rect(6 + i, 15 + i * 3, 13 - 2 * i, 1, C.stone);
      p.rect(6 + i, 16 + i * 3, 13 - 2 * i, 1, C.stoneDark);
    }
    // The keystone, with a sword on it.
    p.rect(10, 0, 5, 5, C.ink);
    p.rect(11, 1, 3, 3, "#b98cff");
    p.px(12, 2, C.white);
  }),
);

/**
 * The gate before the first raid: planks nailed across the way down, caution tape over them and a
 * danger sign. Drawn over `gate` (same 24×28, same place); the gaps are left open for the glow.
 */
export const boardedGate = once(() =>
  bake(24, 28, (p) => {
    // Two planks, a little crooked, with a dark edge and nails; the sign hangs between them.
    for (const [y, tilt] of [
      [7, 1],
      [19, -1],
    ] as const)
      for (let x = 4; x < 21; x++) {
        const dy = y + Math.round(((x - 12) * tilt) / 9);
        p.px(x, dy - 1, C.ink);
        p.px(x, dy, (x + y) % 7 === 0 ? C.woodLight : C.wood);
        p.px(x, dy + 1, C.wood);
        p.px(x, dy + 2, C.woodDark);
        p.px(x, dy + 3, C.ink);
        if (x === 6 || x === 18) p.px(x, dy + 1, C.metalLight);
      }
    // Caution tape across the bottom step.
    p.rect(3, 24, 19, 1, C.ink);
    p.rect(3, 27, 19, 1, C.ink);
    for (let x = 3; x < 22; x++) p.rect(x, 25, 1, 2, Math.floor((x + 1) / 2) % 2 === 0 ? "#f5d14a" : C.ink);
  }),
);

/** A plank off the boarded gate, for when it bursts open. */
export const plank = once(() =>
  bake(10, 4, (p) => {
    p.rect(0, 0, 10, 4, C.ink);
    p.rect(1, 1, 8, 1, C.woodLight);
    p.rect(1, 2, 8, 1, C.woodDark);
  }),
);

/** A small ⚠️: a yellow triangle with a "!". */
export const dangerSign = once(() =>
  bake(11, 10, (p) => {
    for (let y = 0; y < 10; y++) {
      const half = Math.floor(y / 2) + 1;
      p.rect(5 - half, y, half * 2 + 1, 1, C.ink);
      if (y > 0 && y < 9) p.rect(6 - half, y, half * 2 - 1, 1, "#f5d14a");
    }
    p.rect(5, 3, 1, 3, C.ink);
    p.px(5, 7, C.ink);
  }),
);

export const chairBack = once(() =>
  bake(16, 16, (p) => {
    p.rect(4, 9, 8, 6, C.ink);
    p.rect(5, 10, 6, 4, C.fabricDark);
    p.rect(7, 15, 2, 1, C.metal);
  }),
);

const chair = once(() =>
  bake(16, 16, (p) => {
    p.rect(4, 4, 8, 6, C.ink);
    p.rect(5, 5, 6, 4, C.fabric);
    p.rect(4, 9, 8, 6, C.ink);
    p.rect(5, 10, 6, 4, C.fabricDark);
    p.rect(7, 15, 2, 1, C.metal);
  }),
);

const sofa = cached(
  (left: boolean, right: boolean) => `sofa${+left}${+right}`,
  (left: boolean, right: boolean) =>
    bake(16, 16, (p) => {
      p.rect(0, 1, 16, 14, C.ink);
      p.rect(0, 2, 16, 5, C.fabricDark);
      p.rect(0, 7, 16, 6, C.fabric);
      p.rect(0, 12, 16, 2, C.fabricDark);
      if (left) {
        p.rect(0, 1, 4, 14, C.ink);
        p.rect(1, 3, 2, 10, C.fabricDark);
      }
      if (right) {
        p.rect(12, 1, 4, 14, C.ink);
        p.rect(13, 3, 2, 10, C.fabricDark);
      }
    }),
);

const tv = once(() =>
  bake(32, 18, (p) => {
    p.rect(1, 11, 30, 7, C.ink);
    p.rect(2, 12, 28, 5, C.woodDark);
    p.rect(4, 0, 24, 12, C.ink);
    p.rect(5, 1, 22, 9, "#2f6f96");
    p.rect(5, 6, 22, 4, "#4f9b3d");
    p.disc(21, 4, 2, C.lamp);
    p.rect(14, 10, 4, 2, C.metal);
  }),
);

const shelf = once(() =>
  bake(16, 26, (p) => {
    p.rect(0, 0, 16, 26, C.ink);
    p.rect(1, 1, 14, 24, C.woodDark);
    const books = [C.rug, C.fabric, C.flowerYellow, C.leaf, C.white, "#9b6fd6", C.rugLight];
    for (const row of [2, 10, 18]) {
      let x = 2;
      let i = row;
      while (x < 14) {
        const w = 1 + (i % 2);
        p.rect(x, row + (i % 3 === 0 ? 1 : 0), w, 6 - (i % 3 === 0 ? 1 : 0), books[i % books.length]!);
        x += w + (i % 4 === 0 ? 1 : 0);
        i++;
      }
      p.rect(1, row + 6, 14, 1, C.wood);
    }
  }),
);

const plant = once(() =>
  bake(16, 20, (p) => {
    p.rect(4, 18, 8, 2, C.shadow);
    p.rect(4, 12, 8, 7, C.ink);
    p.rect(5, 13, 6, 5, "#c2703d");
    p.rect(5, 13, 6, 1, "#e08e57");
    p.disc(8, 7, 5, C.leafInk);
    p.disc(8, 7, 4, C.leaf);
    p.disc(6, 5, 2, C.leafLight);
    p.px(10, 9, C.leafDark);
  }),
);

/** The pet bed's basket, seen from the front: `front` is only its near wall, drawn over the pet lying in it. */
const petBedSprite = (front: boolean) =>
  bake(16, 16, (p) => {
    const top = front ? 11 : 4;
    // Outline, then the back rim, the cushion inside, and the woven front wall.
    p.rect(1, Math.max(5, top), 14, 15 - Math.max(5, top), C.ink);
    if (!front) {
      p.rect(2, 4, 12, 1, C.ink);
      p.rect(2, 5, 12, 1, C.woodLight);
      p.rect(2, 6, 12, 5, C.fabric);
      p.rect(2, 6, 12, 1, C.fabricDark);
      p.px(3, 8, C.pillow);
      p.px(4, 9, C.pillow);
      p.px(12, 7, C.pillow);
    }
    p.rect(2, 11, 12, 3, C.woodDark);
    p.rect(2, 11, 12, 1, C.woodLight);
    for (let x = 3; x < 13; x += 3) p.rect(x, 12, 1, 2, C.wood);
    if (!front) p.rect(2, 15, 12, 1, C.shadow);
  });

const petBed = once(() => petBedSprite(false));
const petBedNear = once(() => petBedSprite(true));

/** The bed's near wall, drawn after the pet that lies in it so the pet sits inside the basket. */
export const petBedFront = (): Placed => ({ canvas: petBedNear(), dx: 0, dy: 0 });

const coffee = once(() =>
  bake(16, 22, (p) => {
    p.rect(3, 2, 10, 18, C.ink);
    p.rect(4, 3, 8, 16, C.metal);
    p.rect(4, 3, 8, 3, C.metalLight);
    p.px(10, 7, C.rug);
    p.rect(6, 9, 4, 2, C.ink);
    p.rect(6, 14, 4, 4, C.white);
    p.rect(10, 15, 1, 2, C.white);
  }),
);

/** `text` in the 3×5 font, centred on `cx`, its top at `y`. */
const letters = (p: Pen, text: string, cx: number, y: number, color: string): void =>
  p.text(text, cx - Math.floor((text.length * 4 - 1) / 2), y, color);

/**
 * Touched grass (two tiles): a lush tuft on a lifted square of sod, a daisy, and a little park sign
 * behind it that says so. Earned at an outage picnic, never sold.
 */
const touchedGrass = once(() =>
  bake(32, 30, (p) => {
    p.rect(3, 28, 26, 2, C.shadow);
    // The sign: a plank on two stakes.
    for (const x of [6, 24]) {
      p.rect(x, 14, 2, 10, C.ink);
      p.rect(x, 14, 1, 10, C.woodDark);
    }
    p.rect(1, 0, 30, 15, C.ink);
    p.rect(0, 1, 32, 13, C.ink);
    p.rect(1, 1, 30, 13, C.woodDark);
    p.rect(1, 1, 30, 12, C.wood);
    p.rect(2, 2, 28, 10, C.woodLight);
    letters(p, "TOUCHED", 16, 2, C.ink);
    letters(p, "GRASS", 16, 8, C.ink);
    // The sod: soil under a carpet of grass, a little of it hanging over the edge.
    p.rect(2, 22, 28, 6, C.ink);
    p.rect(1, 23, 30, 4, C.ink);
    p.rect(2, 24, 28, 3, C.trunk);
    p.rect(2, 26, 28, 1, C.trunkDark);
    for (const x of [5, 12, 19, 26]) p.px(x, 25, C.trunkDark);
    for (const x of [7, 14, 23]) p.px(x, 24, C.trunkDark);
    p.rect(2, 20, 28, 4, C.grassDark);
    p.rect(3, 20, 26, 2, C.leaf);
    for (const x of [4, 8, 9, 16, 21, 27]) p.px(x, 24, C.grassDark);
    // Three tufts of blades, tallest in the middle of each, the odd one leaning.
    const tufts = [
      [6, 5],
      [16, 5],
      [26, 5],
    ] as const;
    const shades = [C.leafDark, C.leaf, C.leafLight, C.grass, C.leaf, C.grassLight];
    for (let x = 2; x < 30; x++) {
      const h = Math.min(6, Math.max(2, ...tufts.map(([cx, top]) => top - Math.abs(x - cx) + ((x * 7) % 3))));
      const color = shades[(x * 5) % shades.length]!;
      const lean = x % 4 === 1 ? 1 : x % 4 === 3 ? -1 : 0;
      for (let k = 0; k < h; k++) p.px(x + (k >= h - 2 ? lean : 0), 20 - k, k < 2 ? C.leafDark : color);
      p.px(x + lean, 20 - h, x % 3 === 0 ? C.grassLight : C.leafLight);
    }
    for (const x of [4, 11, 20, 28]) p.px(x, 20, C.leafInk);
    // A daisy, and a red bud.
    p.rect(11, 17, 1, 3, C.leafDark);
    p.px(12, 18, C.leaf);
    p.grid([".w.", "wyw", ".w."], { w: C.flowerWhite, y: C.flowerYellow }, 10, 14);
    p.rect(21, 16, 1, 4, C.leafDark);
    p.px(21, 15, C.flowerRed);
    p.px(22, 15, C.rugDark);
  }),
);

/** The open-offices board: a small wooden sign with a little house and a lit window. */
const officeBoard = once(() =>
  bake(16, 20, (p) => {
    p.rect(2, 18, 12, 2, C.shadow);
    p.rect(1, 0, 14, 17, C.ink);
    p.rect(2, 1, 12, 15, C.woodDark);
    p.rect(3, 2, 10, 13, "#c89460");
    // A house: roof, walls, a door and a lit window.
    p.rect(5, 5, 6, 1, C.rug);
    p.rect(4, 6, 8, 1, C.rug);
    p.rect(5, 7, 6, 6, "#f1e6d2");
    p.rect(7, 10, 2, 3, C.woodDark);
    p.rect(9, 8, 2, 2, "#f8c43a");
    p.rect(3, 2, 10, 1, "#dcab76");
  }),
);

/** The company house's office directory: a wooden board on two posts with a row of little doors. */
const directoryBoard = once(() =>
  bake(16, 20, (p) => {
    p.rect(2, 18, 12, 2, C.shadow);
    p.rect(3, 12, 2, 7, C.woodDark);
    p.rect(11, 12, 2, 7, C.woodDark);
    p.rect(1, 0, 14, 14, C.ink);
    p.rect(2, 1, 12, 12, C.woodDark);
    p.rect(3, 2, 10, 10, "#c89460");
    p.rect(3, 2, 10, 1, "#dcab76");
    // Three doors, the middle one lit.
    for (const [x, lit] of [
      [4, false],
      [7, true],
      [10, false],
    ] as const) {
      p.rect(x, 5, 2, 5, C.woodDark);
      p.px(x + 1, 8, lit ? "#f8c43a" : "#dcab76");
    }
    p.rect(4, 11, 8, 1, C.woodDark);
  }),
);

const at = (canvas: HTMLCanvasElement, dx = 0, dy = TILE - canvas.height): Placed => ({ canvas, dx, dy });

/** Maps are fixed, so each map's objects are worked out once (the render loop asks every frame). */
const placed = new WeakMap<GameMap, (Placed | null | undefined)[]>();

/**
 * The scenery or furniture on tile (x, y), if it draws anything. Multi-tile
 * things (fountain, TV) draw once from their top-left tile.
 */
export function objectAt(map: GameMap, x: number, y: number): Placed | null {
  let cells = placed.get(map);
  if (!cells) {
    cells = [];
    placed.set(map, cells);
  }
  const i = map.index(x, y);
  if (cells[i] === undefined) cells[i] = placeObject(map, x, y);
  return cells[i];
}

/** The tiles of the same letter to the left of (x, y): none for the top tile of a piece lying down its column. */
function runLeft(map: GameMap, x: number, y: number, ch: string): number {
  const turn = turnAt(map, x, y);
  if (turn && sideways(turn.rot)) return 0;
  let n = 0;
  while (map.at(x - n - 1, y) === ch) n++;
  return n;
}

function placeObject(map: GameMap, x: number, y: number): Placed | null {
  // A piece lying down its column (turned a quarter) is one picture from its top tile; the tiles below it have none.
  const turn = turnAt(map, x, y);
  if (turn && sideways(turn.rot) && (turn.x !== x || turn.y !== y)) return null;
  const ch = map.at(x, y);
  switch (ch) {
    case "w":
      return at(officeBoard(), 2);
    case "ς":
      return at(directoryBoard(), 0);
    // The common room: windows and the wall of wins in the wall's face, the kitchen counter on the floor.
    case "Ψ":
      return at(windowPane(), 0, 0);
    case "Θ": {
      let n = 0;
      while (map.at(x - n - 1, y) === ch) n++;
      return at(winsTile(n), 0, 0);
    }
    case "π":
      return at(counter(map.at(x - 1, y) !== "π"));
    // The shops: a front is one picture from its top-left tile, the tiles inside draw one each.
    case "Ħ": {
      if (map.at(x - 1, y) === ch || map.at(x, y - 1) === ch) return null;
      const shop = SHOP_IDS.find((id) => SHOP_DOOR_CHAR[id] === map.at(x + 2, y + 3));
      return shop ? at(storefront(shop), 0, 0) : null;
    }
    case "¢": {
      let n = 0;
      while (map.at(x - n - 1, y) === ch) n++;
      if (map.id === "shop-market") return at(marketCounter(n === 1 ? "till" : n === 4 ? "scale" : "plain"));
      return at(map.id === "shop-natmarked" ? natCounter(n === 3) : shopCounter(n % 3 === 1));
    }
    // Torvehallen's slots, empty: a shelf against the back wall, else one piece of a glass case (`game/market.ts` fills them).
    case "Ƙ":
      return map.at(x, y - 1) === "W"
        ? at(marketShelf(x))
        : at(marketCase(casePart(map.at(x - 1, y) === ch, map.at(x + 1, y) === ch)));
    case "¤":
    case "§":
    case "¶":
    case "Ŧ":
      return at(natShelf(x));
    case "¥": {
      const shop = SHOP_IDS.find((id) => SHOP_DISPLAY_CHAR[id] === ch)!;
      const wall = x === map.x0 || y <= 1;
      return wall ? at(shopDisplay(shop, true, x, y), 0, 0) : at(shopDisplay(shop, false, x, y));
    }
    case "‡": {
      if (map.id === "shop-market") return at(marketFixture(map.at(x, y - 1) === "W"));
      if (map.id !== "shop-natmarked") return at(fixture());
      // Natmarked's fixtures: a stall's counter (a run of them), a tea table between two stools, else a lantern post.
      const run = map.at(x - 1, y) === ch || map.at(x + 1, y) === ch;
      const table = map.at(x - 1, y) === "c" && map.at(x + 1, y) === "c";
      return at(natFixture(run ? "stall" : table ? "table" : "post", x > map.width / 2));
    }
    case "O":
      return at(coatStand());
    case "$":
      return at(barJar());
    case "T":
      return at(tree());
    case "^":
      return at(bush());
    case "L":
      return at(lamp());
    case "N":
      return at(board());
    case "★":
      return at(starBoard());
    case "B":
      return at(bench());
    case "F":
      return map.at(x - 1, y) !== "F" && map.at(x, y - 1) !== "F" ? at(fountain(), 0, 0) : null;
    // The windmill's tower, standing on its 2×2 tiles; its sails turn in `game/windmill.ts`.
    case WINDMILL:
      return map.at(x - 1, y) !== ch && map.at(x, y - 1) !== ch
        ? at(millTower(), 0, TILE * 2 - MILL_H)
        : null;
    case "b":
      return at(bed());
    case "d":
      return at(desk());
    case "c":
      return at(chair());
    case "s":
      return at(sofa(map.at(x - 1, y) !== "s", map.at(x + 1, y) !== "s"));
    case "t":
    case "g": {
      // Two tiles each: in a run of them (TVs side by side), every other tile starts one.
      const n = runLeft(map, x, y, ch);
      return n % 2 === 0 ? at(ch === "t" ? tv() : touchedGrass()) : null;
    }
    case "k":
      return at(shelf());
    case "p":
      return at(plant());
    case "o":
      return at(coffee());
    case "Q":
      return at(petBed());
    case "l":
      return at(warDesk());
    case "r":
      return at(chair());
    case "j":
      return at(torch());
    case "G":
      return at(gate(), -4);
    // The Tavern: runs of two (the hearth, the quest board) draw from their left tile.
    case "a":
    case "y":
      return at(bar(ch === "y"));
    case "v":
      return at(stool(), 4);
    case "h":
      return at(barrel(), 3);
    case "n":
      return at(table(map.at(x - 1, y) !== "n", map.at(x + 1, y) !== "n"));
    case "P":
      return at(plaque());
    case "z":
      return at(jukebox(), 2);
    case "?":
      return at(requestPile(), 0, 0);
    // The poker table: a block of felt tiles, its rim on the sides that have no neighbour of its own.
    case "♠":
      return at(
        pokerTable(
          map.at(x - 1, y) !== ch,
          map.at(x + 1, y) !== ch,
          map.at(x, y - 1) !== ch,
          map.at(x, y + 1) !== ch,
        ),
      );
    case "♣":
      return at(chair());
    // The roulette table: 3 wide, 2 tall; the spots below it are small floor mats.
    case "♦": {
      let col = 0;
      while (map.at(x - col - 1, y) === ch) col++;
      return at(rouletteTable(Math.min(col, 2), map.at(x, y - 1) === ch ? 1 : 0));
    }
    case "♥":
      return at(rouletteSpot());
    case "A": {
      let n = 0;
      while (map.at(x - n - 1, y) === ch) n++;
      return at(hallWall(n % 2 === 0));
    }
    // The basement: the big screen is a run of six, the cabinet is the office arcade machine.
    case "E": {
      let n = 0;
      while (map.at(x - n - 1, y) === ch) n++;
      return n % SCREEN_TILES === 0 ? at(bigScreen(), 0, TILE - SCREEN_H) : null;
    }
    case "M":
      return at(wallTerminal(), 0, 0);
    case "i":
      return at(tournamentBoard(), 0, 0);
    case "C": {
      const art = FANCY.get("β")!.art;
      return { canvas: fancySprite(art.id), dx: 0, dy: TILE - art.height, fancy: art };
    }
    case "f":
    case "m": {
      let n = 0;
      while (map.at(x - n - 1, y) === ch) n++;
      return n % 2 === 0 ? at(ch === "f" ? hearth() : questBoard()) : null;
    }
    default: {
      // A poster: a run of its own character is one picture, from the run's left tile, over the wall.
      if (isPoster(ch)) {
        const w = posterOf(ch)!.w ?? 1;
        let n = 0;
        while (map.at(x - n - 1, y) === ch) n++;
        return n % w === 0 ? at(posterSprite(posterOf(ch)!.art), 0, TILE - POSTER_H) : null;
      }
      const fancy = FANCY.get(ch);
      // The raid's trophies (art/loot.ts).
      if (!fancy) return trophyAt(ch);
      // `w` tiles each, from the left of a run of them.
      const n = runLeft(map, x, y, ch);
      if (n % fancy.w !== 0) return null;
      // Standing on its row; a deeper one reaches back over the row behind.
      return { canvas: fancySprite(fancy.art.id), dx: 0, dy: TILE - fancy.art.height, fancy: fancy.art };
    }
  }
}

/** Where on the tile the object's "feet" are, for depth sorting against people. */
export const sortY = (ch: string): number => {
  // Posters hang behind everyone, like a rug under them.
  if (isPoster(ch)) return -TILE;
  const placement = FANCY.get(ch)?.art.placement;
  // A rug lies under everyone, a chandelier hangs over them; a personal office's wall pieces hang behind.
  if (placement === "flat" || (placement === "wall" && (isHomePiece(ch) || isCasePiece(ch)))) return -TILE;
  if (placement === "ceiling") return TILE * 4;
  return ch === "F" || ch === WINDMILL ? TILE * 2 - 2 : ch === "b" || ch === "s" || ch === "Q" ? 0 : TILE - 1;
};
