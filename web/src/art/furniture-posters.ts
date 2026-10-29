/**
 * Posters for the company house (`POSTERS` in core/src/posters.ts): parodies of famous games, drawn in
 * code like the rest. Each hangs on the building's wall face, `w` tiles wide and `POSTER_H` tall (the
 * top reaches a little over the wall's lip), so the art is small: a framed picture over a dark band with
 * the title in the 3x5 pixel font. Bold shapes, a few colours each, nothing from the real games.
 */
import { TILE } from "@tokenmaxxing/core/world.ts";
import { C } from "./palette.ts";
import { bake, cached, type Pen } from "./pixels.ts";

/** Sprite height in pixels. */
export const POSTER_H = 24;
/** The picture: rows 2 to 14 of the frame. The title band is rows 15 to 21. */
const BAND = 15;

export interface PosterArt {
  id: string;
  /** Tiles wide. */
  w: number;
  /** The frame's colour, the picture's backdrop and the band's ink. */
  frame: string;
  bg: string;
  title: string;
  titleInk: string;
  draw: (p: Pen, w: number) => void;
}

const K = {
  night: "#1b2a55",
  gold: "#ffb347",
  yellow: "#f5d14a",
  red: "#e8584f",
  green: "#3ddc84",
  blue: "#4f8fe0",
  cyan: "#7fe3ff",
  purple: "#9b6fd6",
  orange: "#ff8a1f",
  stone: "#9aa0b4",
  stoneDark: "#6c7288",
} as const;

/** A filled rectangle with a one-pixel ink outline. */
function box(p: Pen, x: number, y: number, w: number, h: number, fill: string): void {
  p.rect(x, y, w, h, C.ink);
  p.rect(x + 1, y + 1, w - 2, h - 2, fill);
}

const dots = (p: Pen, pts: readonly (readonly [number, number])[], color: string) => {
  for (const [x, y] of pts) p.px(x, y, color);
};

// MARK: The pictures

/** A tactical team shooter: a masked operator, a crate, and a bomb that shows ERR. */
function counterCi(p: Pen): void {
  p.rect(2, 2, 28, 6, "#f2d9a0");
  p.rect(2, 11, 28, 4, "#c99a55");
  p.rect(2, 11, 28, 1, "#b08a4e");
  // A wall and a door behind.
  p.rect(18, 4, 12, 7, "#b08a4e");
  p.rect(18, 4, 12, 1, "#8c6b36");
  box(p, 24, 6, 3, 5, "#5a4326");
  // Crates.
  box(p, 3, 9, 4, 4, C.woodLight);
  p.rect(4, 10, 2, 1, C.woodDark);
  // The operator: helmet, a cyan visor, a vest and a rifle.
  box(p, 8, 3, 6, 5, "#2f4a3a");
  p.rect(9, 5, 4, 1, K.cyan);
  box(p, 7, 8, 8, 5, "#2f4a3a");
  p.rect(9, 9, 4, 3, "#3d6149");
  p.rect(8, 13, 3, 2, C.ink);
  p.rect(12, 13, 3, 2, C.ink);
  p.rect(15, 9, 8, 2, C.ink);
  p.rect(15, 9, 7, 1, "#4a4f5e");
  // The bomb: wires, and a screen with ERR (the build is red).
  box(p, 17, 8, 13, 7, "#3a3f4a");
  p.rect(18, 9, 11, 5, C.ink);
  p.text("ERR", 18, 9, "#ff4d4d");
  p.px(16, 13, K.red);
  p.px(15, 14, K.red);
  // A crosshair over it.
  dots(
    p,
    [
      [23, 3],
      [23, 4],
      [20, 6],
      [21, 6],
      [25, 6],
      [26, 6],
    ],
    K.red,
  );
}

/** Car soccer: a rocket-powered car, a very big ball, a goal. */
function deployLeague(p: Pen): void {
  p.rect(2, 2, 28, 13, K.night);
  dots(
    p,
    [
      [5, 3],
      [10, 4],
      [16, 3],
      [21, 4],
      [27, 3],
      [8, 6],
    ],
    "#6f86c9",
  );
  // The pitch, striped, with a chalk line.
  p.rect(2, 11, 28, 4, "#3f9b4d");
  for (let x = 2; x < 30; x += 8) p.rect(x, 12, 4, 3, "#4fb35d");
  p.rect(2, 11, 28, 1, "#d6f2d6");
  // The goal: posts and a net.
  p.rect(24, 4, 1, 8, C.white);
  p.rect(24, 4, 6, 1, C.white);
  p.rect(25, 5, 5, 6, "#2c3d78");
  for (let y = 5; y < 11; y++) for (let x = 25 + (y % 2); x < 30; x += 2) p.px(x, y, "#8aa2d6");
  // The ball, hit hard.
  p.disc(19, 6, 3, C.ink);
  p.disc(19, 6, 2, "#eef0fa");
  dots(
    p,
    [
      [19, 5],
      [18, 6],
      [20, 7],
    ],
    "#3a3f55",
  );
  p.rect(17, 12, 5, 1, "#2e7a3c");
  // The car, with its boost.
  p.rect(2, 11, 3, 1, K.yellow);
  p.rect(2, 12, 5, 1, K.orange);
  p.rect(2, 13, 3, 1, K.yellow);
  box(p, 6, 9, 9, 5, K.orange);
  p.rect(9, 7, 5, 3, C.ink);
  p.rect(10, 8, 3, 1, "#bfe6ff");
  p.rect(7, 10, 7, 1, "#ffc27a");
  p.disc(8, 14, 1, C.ink);
  p.disc(13, 14, 1, C.ink);
}

/** A lane-based MOBA: a tower with a crystal, minions marching down the lane. */
function leagueLinters(p: Pen): void {
  p.rect(2, 2, 28, 7, "#3a2a66");
  p.rect(2, 7, 28, 2, "#4b3a82");
  p.rect(2, 9, 28, 2, "#3a7b4f");
  // The lane.
  p.rect(2, 11, 28, 4, "#b79a5e");
  p.rect(2, 11, 28, 1, "#8c7440");
  dots(
    p,
    [
      [4, 4],
      [9, 3],
      [23, 4],
      [28, 3],
    ],
    "#8c7ad6",
  );
  // The tower, a crystal over it glowing.
  p.disc(16, 4, 3, "#5d4fa0");
  box(p, 13, 6, 7, 9, K.stone);
  p.rect(13, 6, 7, 1, C.ink);
  p.rect(14, 7, 5, 1, "#c4c9da");
  p.rect(13, 5, 2, 2, C.ink);
  p.rect(18, 5, 2, 2, C.ink);
  p.rect(15, 9, 3, 2, C.ink);
  p.rect(15, 12, 3, 3, C.ink);
  p.rect(15, 3, 3, 3, C.ink);
  p.rect(16, 2, 1, 4, K.cyan);
  p.rect(15, 4, 3, 1, K.cyan);
  // Minions: blue from the left, red from the right.
  for (const [x, c] of [
    [3, K.blue],
    [8, K.blue],
    [21, K.red],
    [26, K.red],
  ] as const) {
    box(p, x, 10, 4, 4, c);
    p.px(x + (c === K.blue ? 2 : 1), 11, C.white);
    p.rect(x + (c === K.blue ? 4 : -1), 9, 1, 5, C.ink);
  }
  // A lint warning.
  p.rect(10, 3, 1, 1, K.yellow);
  p.rect(9, 4, 3, 1, K.yellow);
  p.px(10, 4, C.ink);
}

/** A three-lane MOBA with a roster of heroes. */
function defenseDeps(p: Pen): void {
  p.rect(2, 2, 28, 13, "#1d1a1f");
  // The map: three lanes meeting two bases.
  p.rect(5, 3, 22, 7, "#2b2a33");
  const lane = "#8c7a55";
  p.rect(7, 3, 18, 1, lane);
  p.rect(7, 9, 18, 1, lane);
  p.rect(7, 3, 1, 7, lane);
  p.rect(24, 3, 1, 7, lane);
  for (let i = 0; i < 17; i++) p.px(8 + i, 9 - Math.floor((i * 6) / 16), lane);
  p.disc(7, 9, 1, K.green);
  p.disc(24, 3, 1, K.red);
  dots(
    p,
    [
      [12, 3],
      [19, 3],
      [12, 9],
      [19, 9],
      [15, 6],
      [7, 6],
      [24, 6],
    ],
    K.yellow,
  );
  // The roster: eight heroes, one picked.
  const colors = [K.red, K.blue, K.green, K.yellow, K.purple, K.orange, K.cyan, "#ff7ac6"];
  colors.forEach((c, i) => {
    const x = 3 + i * 3;
    p.rect(x, 12, 3, 3, i === 3 ? C.white : C.ink);
    p.rect(x, 12, 2, 2, c);
    p.px(x, 12, C.white);
  });
  p.rect(2, 11, 28, 1, "#3a3646");
}

/** A looter-shooter space fantasy: a ringed planet, a helmeted guardian, a drop. */
function lootborn(p: Pen): void {
  p.rect(2, 2, 28, 13, "#14112b");
  dots(
    p,
    [
      [4, 3],
      [8, 5],
      [12, 3],
      [14, 8],
      [18, 3],
      [26, 4],
      [28, 9],
      [6, 10],
    ],
    "#cfd6ff",
  );
  // The planet, with a tilted ring across it.
  p.disc(21, 7, 5, "#7a3f26");
  p.disc(21, 7, 4, "#c9763a");
  p.rect(18, 5, 4, 1, "#e69a54");
  p.rect(20, 9, 4, 1, "#a85d2d");
  for (let dx = -8; dx <= 8; dx++) {
    const y = 7 + Math.round(dx * 0.25);
    p.px(21 + dx, y, "#f3c98b");
    p.px(21 + dx, y + 1, "#a4733f");
  }
  // The guardian: helmet, a gold visor, a cape.
  p.rect(2, 9, 3, 6, "#a02c2c");
  box(p, 6, 3, 6, 6, "#4a4f66");
  p.rect(7, 5, 4, 2, K.gold);
  p.rect(7, 4, 4, 1, "#6b7090");
  box(p, 4, 9, 10, 6, "#4a4f66");
  p.rect(6, 10, 6, 1, "#6b7090");
  p.rect(13, 10, 6, 2, C.ink);
  // Loot drops: gold and purple.
  p.grid([".o.", "ooo", ".o."], { o: K.gold }, 23, 11);
  p.px(24, 12, C.white);
  p.grid([".o.", "ooo", ".o."], { o: K.purple }, 17, 12);
  p.px(18, 13, C.white);
}

/** A farm sim: a barn, rows of crops, and the green check of a passing build. */
function pipelineValley(p: Pen): void {
  p.rect(2, 2, 28, 7, "#9fd8f2");
  p.disc(26, 5, 2, "#ffe27a");
  p.rect(5, 4, 5, 1, C.white);
  p.rect(6, 3, 3, 1, C.white);
  // Hills and the field.
  p.rect(2, 8, 28, 3, "#86c35e");
  p.rect(2, 11, 28, 4, "#6aa84a");
  for (const y of [12, 14]) p.rect(2, y, 28, 1, "#4f9b3d");
  for (let x = 4; x < 30; x += 3) {
    p.px(x, 12, "#a5d977");
    p.px(x + 1, 14, "#a5d977");
  }
  // The barn.
  box(p, 4, 5, 9, 7, K.red);
  p.rect(5, 4, 7, 1, C.ink);
  p.rect(6, 3, 5, 1, C.ink);
  p.rect(7, 2, 3, 1, C.ink);
  p.rect(7, 8, 3, 4, C.white);
  p.rect(7, 9, 3, 1, K.red);
  p.rect(8, 8, 1, 4, K.red);
  // A sign in the field: the build passed.
  p.rect(20, 9, 1, 5, C.ink);
  box(p, 17, 6, 8, 5, C.white);
  dots(
    p,
    [
      [19, 8],
      [20, 9],
      [21, 8],
      [22, 7],
    ],
    K.green,
  );
  p.rect(26, 11, 1, 2, "#a5d977");
}

/** A retro platformer: a ? block, a flagpole, bricks, a little dev jumping. */
function superMerge(p: Pen): void {
  p.rect(2, 2, 12, 13, "#5aa9ff");
  p.rect(3, 4, 3, 1, C.white);
  p.rect(4, 3, 2, 1, C.white);
  // Bricks.
  p.rect(2, 12, 12, 3, "#c2703d");
  p.rect(2, 12, 12, 1, "#e08e57");
  dots(
    p,
    [
      [5, 13],
      [9, 14],
      [12, 13],
      [3, 14],
    ],
    "#8a4a26",
  );
  // The ? block.
  box(p, 3, 3, 7, 7, K.yellow);
  p.grid(["111", "..1", ".1.", "...", ".1."], { "1": C.ink }, 5, 4);
  // The goal: a pole with a pull-request pennant.
  p.rect(12, 4, 1, 8, C.ink);
  p.px(12, 3, K.yellow);
  p.rect(9, 4, 3, 2, K.green);
  p.px(11, 6, K.green);
  // A little dev, jumping.
  p.rect(5, 10, 4, 1, "#3a5fd6");
  p.rect(5, 11, 4, 1, "#f2c9a0");
  p.px(7, 11, C.ink);
  p.rect(4, 12, 2, 1, C.ink);
  p.rect(8, 12, 2, 1, C.ink);
}

/** A souls-like: a hooded figure under a moon, and a bonfire. */
function darkDeploys(p: Pen): void {
  p.rect(2, 2, 12, 13, "#1a1d2b");
  p.disc(10, 5, 3, "#e8e4d0");
  p.px(9, 4, "#c9c3a8");
  p.px(11, 6, "#c9c3a8");
  dots(
    p,
    [
      [3, 3],
      [6, 5],
      [4, 8],
    ],
    "#6f78a0",
  );
  // The figure: a hood with glowing eyes, a long cloak, a sword planted beside.
  p.rect(5, 6, 5, 1, "#3a3f55");
  p.rect(4, 7, 6, 3, "#3a3f55");
  p.rect(5, 8, 4, 2, C.ink);
  p.px(6, 9, K.gold);
  p.px(8, 9, K.gold);
  p.rect(3, 10, 8, 3, "#2f3348");
  p.rect(2, 13, 10, 1, "#2f3348");
  p.rect(5, 10, 1, 4, "#3a3f55");
  p.rect(12, 8, 1, 6, "#cfd6df");
  p.rect(11, 9, 3, 1, K.stoneDark);
  // The bonfire.
  p.rect(2, 14, 12, 1, "#3b3647");
  p.rect(3, 13, 2, 1, K.orange);
  p.px(3, 12, K.yellow);
}

/** A roguelike deckbuilder: three cards fanned out. */
function slayBacklog(p: Pen): void {
  p.rect(2, 2, 12, 13, "#2a2040");
  dots(
    p,
    [
      [3, 3],
      [12, 3],
      [8, 3],
    ],
    "#8c7ad6",
  );
  for (const [x, y, c] of [
    [2, 8, K.blue],
    [9, 8, K.green],
    [5, 5, K.red],
  ] as const) {
    box(p, x, y, 6, 8, C.white);
    p.rect(x + 1, y + 1, 4, 4, c);
    p.rect(x + 1, y + 6, 4, 1, c);
    p.px(x + 2, y + 2, C.white);
    p.px(x + 3, y + 3, C.ink);
  }
  p.px(8, 3, K.yellow);
}

/** A battle royale: a parachute dropping onto the island, the storm closing in. */
function lastDev(p: Pen): void {
  p.rect(2, 2, 12, 13, "#6cc3ff");
  // The storm: purple in the corners.
  for (let i = 0; i < 4; i++) {
    p.rect(2, 2 + i, 4 - i, 1, K.purple);
    p.rect(14 - (4 - i), 2 + i, 4 - i, 1, K.purple);
  }
  // The island.
  p.rect(2, 12, 12, 3, "#58a9e2");
  p.rect(3, 11, 10, 3, "#4f9b3d");
  p.rect(5, 10, 6, 1, "#4f9b3d");
  p.px(11, 11, C.leaf);
  // The parachute: a dome, lines, a dev.
  p.disc(8, 6, 3, C.ink);
  p.rect(5, 6, 7, 1, C.ink);
  p.disc(8, 6, 2, K.red);
  p.rect(6, 6, 5, 1, C.white);
  dots(
    p,
    [
      [5, 7],
      [6, 8],
      [11, 7],
      [10, 8],
    ],
    C.ink,
  );
  p.rect(7, 9, 2, 2, C.ink);
  p.px(7, 9, "#f2c9a0");
}

// MARK: Catalog

const art = (
  id: string,
  w: number,
  frame: string,
  bg: string,
  title: string,
  titleInk: string,
  draw: PosterArt["draw"],
): PosterArt => ({ id, w, frame, bg, title, titleInk, draw });

export const POSTER_ART: readonly PosterArt[] = [
  art("super-merge", 1, K.red, "#5aa9ff", "MRG", C.white, superMerge),
  art("dark-deploys", 1, "#7a7f8c", "#1a1d2b", "GIT", "#ff6a4d", darkDeploys),
  art("slay-backlog", 1, K.purple, "#2a2040", "RNG", K.yellow, slayBacklog),
  art("last-dev", 1, K.gold, "#6cc3ff", "1ST", C.white, lastDev),
  art("pipeline-valley", 2, C.woodDark, "#9fd8f2", "VALLEY", C.white, pipelineValley),
  art("deploy-league", 2, "#2f6fe0", K.night, "DEPLOY", K.gold, deployLeague),
  art("counter-ci", 2, "#d9a441", "#e7c27d", "CI-GO", K.yellow, counterCi),
  art("league-linters", 2, "#c9a227", "#3a2a66", "LINTERS", K.cyan, leagueLinters),
  art("defense-deps", 2, "#d1453b", "#1d1a1f", "DOTD", "#ff6a4d", defenseDeps),
  art("lootborn", 2, K.gold, "#14112b", "LOOT", K.gold, lootborn),
];

export const posterArt = (id: string): PosterArt | undefined => POSTER_ART.find((a) => a.id === id);

/** The frame, the picture and the title in its band, baked once. */
export function drawPoster(p: Pen, a: PosterArt): void {
  const w = a.w * TILE;
  p.rect(0, 0, w, POSTER_H, C.ink);
  p.rect(1, 1, w - 2, POSTER_H - 2, a.frame);
  p.rect(2, 2, w - 4, POSTER_H - 4, a.bg);
  a.draw(p, w);
  // The band: dark, with the title centred in it.
  p.rect(2, BAND, w - 4, 7, C.ink);
  p.rect(2, BAND, w - 4, 1, a.frame);
  const tw = a.title.length * 4 - 1;
  p.text(a.title, Math.floor((w - tw) / 2), BAND + 1, a.titleInk);
}

/** A poster's baked sprite, memoized. */
export const posterSprite = cached(
  (id: string) => id,
  (id: string) => {
    const a = posterArt(id);
    if (!a) throw new Error(`no poster "${id}"`);
    return bake(a.w * TILE, POSTER_H, (p) => drawPoster(p, a));
  },
);
