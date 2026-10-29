import { C } from "./palette.ts";
import { bake, cached, once, type Palette } from "./pixels.ts";

/**
 * The Tavern's furniture (`inn`): the bar and its tap, a stool, the hearth and its flames, a barrel, the
 * quest board, the Hall of Fame wall, the regulars' plaque and a table. Each is baked once; `objects.ts`
 * places them and `game/tavern.ts` lights the hearth.
 */

const BRASS = "#c98e22";
const BRASS_LIGHT = "#fff4b8";
const BRASS_DARK = "#8a5f14";
const PAPER = "#f1e6d2";

/** The bar counter, one tile: a polished top over a planked front. With `tap`, a brass tap and a mug on it. */
export const bar = cached(
  (tap: boolean) => `${tap}`,
  (tap: boolean) =>
    bake(16, 22, (p) => {
      p.rect(0, 20, 16, 2, C.shadow);
      // Front: planks under the overhang.
      p.rect(0, 9, 16, 11, C.ink);
      p.rect(0, 10, 16, 9, C.woodDark);
      for (const x of [3, 8, 13]) p.rect(x, 11, 1, 7, C.trunkDark);
      p.rect(0, 18, 16, 1, C.trunkDark);
      // Top.
      p.rect(0, 4, 16, 6, C.ink);
      p.rect(0, 5, 16, 4, C.woodLight);
      p.rect(0, 5, 16, 1, C.white);
      p.rect(0, 8, 16, 1, C.wood);
      if (!tap) return;
      // The tap: a brass spout over a drip tray, and a full mug beside it.
      p.rect(5, 0, 4, 2, C.ink);
      p.rect(6, 0, 2, 1, BRASS_LIGHT);
      p.rect(6, 2, 2, 4, BRASS);
      p.rect(5, 6, 4, 1, BRASS_DARK);
      p.rect(10, 1, 4, 5, C.ink);
      p.rect(11, 2, 2, 3, "#f5d14a");
      p.rect(11, 2, 2, 1, C.white);
    }),
);

/** The bar with the tip jar on it (the coin toss, `tosses`): a glass jar with a few coins and a handwritten label. */
export const barJar = once(() =>
  bake(16, 22, (p) => {
    p.g.drawImage(bar(false), 0, 0);
    p.rect(5, 0, 6, 1, C.ink);
    p.rect(4, 1, 8, 6, C.ink);
    p.rect(5, 1, 6, 5, "#cfeaf4");
    p.rect(5, 1, 6, 1, C.white);
    p.rect(5, 4, 6, 2, BRASS);
    p.px(6, 4, BRASS_LIGHT);
    p.px(9, 5, BRASS_LIGHT);
    p.rect(6, 7, 4, 1, PAPER);
  }),
);

const STOOL: { rows: string[]; pal: Palette } = {
  rows: [
    "..oooo..",
    ".orrrro.",
    "orRrrrro",
    "oddddddo",
    ".oooooo.",
    "..m..m..",
    "..mmmm..",
    "..m..m..",
    ".m....m.",
    ".m....m.",
    "ss....ss",
  ],
  pal: { o: C.ink, r: C.rug, R: C.rugLight, d: C.rugDark, m: C.metal, s: C.shadow },
};
export const stool = once(() => bake(8, 11, (p) => p.grid(STOOL.rows, STOOL.pal)));

const BARREL: { rows: string[]; pal: Palette } = {
  rows: [
    "..oooooo..",
    ".olwwwwdo.",
    "ommmmmmmmo",
    "olwwwwwwdo",
    "olwlwwwwdo",
    "olwwwwwwdo",
    "olwwwwlwdo",
    "olwwwwwwdo",
    "ommmmmmmmo",
    ".olwwwwdo.",
    "..oooooo..",
    "..ssssss..",
  ],
  pal: { o: C.ink, w: C.wood, d: C.woodDark, l: C.woodLight, m: C.metal, s: C.shadow },
};
export const barrel = once(() => bake(10, 12, (p) => p.grid(BARREL.rows, BARREL.pal)));

/** The hearth, two tiles wide: a stone surround, the dark opening, and logs. Its flames are `hearthFlame`. */
export const HEARTH_W = 32;
export const HEARTH_H = 24;
/** Where the flames sit in it. */
export const FLAME_AT = { x: 8, y: 9, w: 16, h: 11 } as const;
export const hearth = once(() =>
  bake(HEARTH_W, HEARTH_H, (p) => {
    p.rect(1, 22, 30, 2, C.shadow);
    // Chimney breast and mantel.
    p.rect(2, 0, 28, 22, C.ink);
    p.rect(3, 1, 26, 20, C.stone);
    p.rect(3, 1, 26, 2, C.stoneLight);
    for (let y = 4; y < 21; y += 4) p.rect(3, y, 26, 1, C.stoneDark);
    for (let y = 4; y < 21; y += 4)
      for (let x = ((y / 4) % 2) * 4 + 5; x < 29; x += 8) p.rect(x, y + 1, 1, 3, C.stoneDark);
    p.rect(0, 5, 32, 3, C.ink);
    p.rect(1, 6, 30, 1, C.woodLight);
    p.rect(1, 7, 30, 1, C.woodDark);
    // The opening and its logs.
    p.rect(FLAME_AT.x - 1, FLAME_AT.y - 1, FLAME_AT.w + 2, FLAME_AT.h + 2, C.ink);
    p.rect(FLAME_AT.x, FLAME_AT.y, FLAME_AT.w, FLAME_AT.h, "#1c1620");
    p.rect(10, 18, 12, 3, C.trunkDark);
    p.rect(10, 18, 12, 1, C.trunk);
    p.rect(12, 17, 8, 1, C.trunkDark);
    p.rect(2, 21, 28, 1, C.stoneDark);
  }),
);

// biome-ignore format: pixel art reads as a grid
const FLAMES = [
  [
    ".......o........",
    "......oyo.......",
    "..o...oyo..o....",
    ".oro..oyyo.oro..",
    ".orro.oyyo.orro.",
    "oorryyoyyyorrryo",
    "orryyyyyyyyyyrro",
    "orrryyyYYyyyrrro",
    ".orrryyYYyyrrro.",
  ],
  [
    "........o.......",
    ".......oyo..o...",
    "..o....oyo.oro..",
    ".oro..oyyo.orro.",
    ".orro.oyyyoorro.",
    "oorrryoyyyyrrryo",
    "orryyyyyyyyyyrro",
    "orrryyYYYyyyrrro",
    ".orrryyYYyyrrro.",
  ],
];
const FLAME_PAL: Palette = { o: "#c0412f", r: "#ee7a2c", y: "#f8c43a", Y: "#fff0a8" };

/** The fire in the hearth's opening, two frames of flicker. */
export const hearthFlame = cached(
  (frame: number) => `${frame % 2}`,
  (frame: number) => bake(16, 9, (p) => p.grid(FLAMES[frame % 2]!, FLAME_PAL)),
);

/** A wall sconce: a bracket and a candle flame. */
export const sconce = cached(
  (frame: number) => `${frame % 2}`,
  (frame: number) =>
    bake(6, 12, (p) => {
      p.rect(2, 5, 2, 5, C.ink);
      p.rect(1, 9, 4, 2, C.ink);
      p.rect(2, 5, 2, 4, BRASS);
      p.rect(2, 5, 1, 4, BRASS_LIGHT);
      p.rect(2, 3 - (frame % 2 ? 1 : 0), 2, 2 + (frame % 2 ? 1 : 0), "#f8c43a");
      p.px(2, 4, "#fff0a8");
    }),
);

/** The quest board, two tiles wide: a cork board in a wooden frame, pinned with notes. */
export const questBoard = once(() =>
  bake(32, 22, (p) => {
    p.rect(2, 20, 28, 2, C.shadow);
    p.rect(0, 0, 32, 20, C.ink);
    p.rect(1, 1, 30, 18, C.woodDark);
    p.rect(2, 2, 28, 16, "#c89460");
    for (let i = 0; i < 24; i++) p.px(3 + ((i * 7) % 26), 3 + ((i * 5) % 14), "#a8764a");
    // Notes: paper, a pin, and a few scribbled lines each.
    const notes: [number, number, number, string][] = [
      [4, 4, 7, PAPER],
      [13, 3, 6, "#f8e3a3"],
      [21, 5, 7, PAPER],
      [8, 11, 7, "#f8e3a3"],
      [18, 11, 6, PAPER],
      [25, 11, 4, "#f2a0b8"],
    ];
    for (const [x, y, w, color] of notes) {
      p.rect(x, y, w, 6, color);
      p.px(x + Math.floor(w / 2), y, C.rug);
      for (let k = 2; k < 5; k += 2) p.rect(x + 1, y + k, w - 2, 1, C.stoneDark);
    }
    p.rect(2, 2, 28, 1, "#dcab76");
  }),
);

/** One tile of the Hall of Fame wall: dark panelling and a gold frame; every other tile has a crest. */
export const hallWall = cached(
  (crest: boolean) => `${crest}`,
  (crest: boolean) =>
    bake(16, 22, (p) => {
      p.rect(0, 20, 16, 2, C.shadow);
      p.rect(0, 0, 16, 20, C.ink);
      p.rect(1, 1, 14, 18, BRASS);
      p.rect(1, 1, 14, 1, BRASS_LIGHT);
      p.rect(2, 2, 12, 16, "#3d2c3a");
      p.rect(2, 2, 12, 1, "#4d3a4a");
      if (crest) {
        // A shield with a star.
        p.rect(4, 4, 8, 9, C.ink);
        p.rect(5, 5, 6, 7, C.rug);
        p.rect(6, 12, 4, 1, C.rug);
        p.rect(7, 13, 2, 1, C.ink);
        p.rect(7, 7, 2, 3, BRASS_LIGHT);
        p.rect(6, 8, 4, 1, BRASS_LIGHT);
      } else {
        // A scroll of names.
        p.rect(4, 4, 8, 12, PAPER);
        p.rect(4, 4, 8, 1, C.stoneLight);
        for (let y = 6; y < 15; y += 2) p.rect(5, y, 4 + ((y * 3) % 3), 1, C.stoneDark);
      }
    }),
);

const PLAQUE: { rows: string[]; pal: Palette } = {
  rows: [
    "oooooooooooo",
    "owaaaaaaaabo",
    "oaddddddddbo",
    "oaaaaaaaaabo",
    "oaddddaaabbo",
    "obbbbbbbbbbo",
    "oooooooooooo",
  ],
  pal: { o: C.ink, a: C.flowerYellow, b: BRASS, w: BRASS_LIGHT, d: BRASS_DARK },
};

/** A regular's plaque: a brass nameplate on a wooden post. */
export const plaque = once(() =>
  bake(16, 20, (p) => {
    p.rect(3, 18, 10, 2, C.shadow);
    p.rect(6, 8, 4, 11, C.ink);
    p.rect(7, 8, 2, 10, C.woodDark);
    p.rect(7, 8, 1, 10, C.wood);
    p.rect(1, 0, 14, 10, C.ink);
    p.rect(2, 1, 12, 8, C.woodDark);
    p.grid(PLAQUE.rows, PLAQUE.pal, 2, 1);
  }),
);

/**
 * The face of a regular's plaque: a brass board one tile wide with a 3-letter name a row (the 3×5 font
 * is 4 pixels a letter), the best first. `names` is one string per row; an empty one is a dash.
 */
export const NAMEBOARD_ROW = 6;
export const nameboard = cached(
  (names: string[]) => names.join("|"),
  (names: string[]) => {
    const h = 3 + NAMEBOARD_ROW * names.length;
    return bake(16, h, (p) => {
      p.rect(0, 0, 16, h, C.ink);
      p.rect(1, 1, 14, h - 2, BRASS);
      p.rect(1, 1, 14, 1, BRASS_LIGHT);
      for (const [i, n] of names.entries()) p.text(n || "---", 2, 2 + i * NAMEBOARD_ROW, BRASS_DARK);
    });
  },
);

const CHALK = "#f1ede0";
const CHALK_DIM = "#a9b0b4";
/**
 * The bar tab as it hangs on the west wall: a slate one tile wide and four tall, the week's best as
 * three-letter names (the full list is a click away); `crown` is the row of last week's winner.
 */
export const barTabSide = cached(
  (names: string[], crown: number) => `${names.join("|")}#${crown}`,
  (names: string[], crown: number) =>
    bake(16, 64, (p) => {
      p.rect(0, 0, 16, 64, C.ink);
      p.rect(1, 1, 14, 62, C.woodDark);
      p.rect(2, 2, 12, 60, "#2f3b3a");
      p.rect(2, 2, 12, 1, "#3d4b49");
      p.text("TAB", 3, 5, CHALK);
      p.rect(3, 11, 10, 1, CHALK_DIM);
      for (let i = 0; i < 5; i++) {
        const y = 16 + i * 9;
        if (i === crown) {
          for (const x of [3, 5, 7]) p.px(x, y - 3, CHALK);
          p.rect(3, y - 2, 5, 1, CHALK);
        }
        p.text(names[i] ?? "---", 3, y, names[i] ? CHALK : CHALK_DIM);
      }
    }),
);

/** A table top, one tile of a run: `left` and `right` say which ends are the table's own. */
export const table = cached(
  (left: boolean, right: boolean) => `${left}${right}`,
  (left: boolean, right: boolean) =>
    bake(16, 16, (p) => {
      const from = left ? 1 : 0;
      const w = (right ? 15 : 16) - from;
      p.rect(0, 14, 16, 2, C.shadow);
      if (left) p.rect(2, 11, 2, 4, C.woodDark);
      if (right) p.rect(12, 11, 2, 4, C.woodDark);
      p.rect(0, 3, 16, 9, C.ink);
      p.rect(from, 4, w, 6, C.woodLight);
      p.rect(from, 4, w, 1, C.white);
      p.rect(from, 10, w, 1, C.wood);
      p.rect(from, 11, w, 1, C.woodDark);
    }),
);

/** The jukebox on the west wall: a rounded cabinet, a lit window with a record in it, a speaker grille. */
export const jukebox = once(() =>
  bake(16, 22, (p) => {
    p.rect(1, 20, 14, 2, C.shadow);
    // Cabinet and its rounded top.
    p.rect(2, 0, 12, 1, C.ink);
    p.rect(1, 1, 14, 19, C.ink);
    p.rect(2, 1, 12, 18, C.rug);
    p.rect(2, 1, 12, 1, C.rugLight);
    p.rect(2, 18, 12, 1, C.rugDark);
    // The lit window with a record in it.
    p.rect(3, 3, 10, 7, C.ink);
    p.rect(4, 4, 8, 5, "#3a2a5a");
    p.rect(6, 5, 4, 3, C.ink);
    p.rect(7, 6, 2, 1, "#f8c43a");
    p.px(4, 4, "#f2a0b8");
    p.px(11, 4, "#72bf52");
    p.px(4, 8, "#72bf52");
    p.px(11, 8, "#f2a0b8");
    // Speaker grille and a brass coin slot.
    p.rect(3, 11, 10, 5, C.ink);
    for (let x = 4; x < 12; x += 2) p.rect(x, 12, 1, 3, BRASS_DARK);
    p.rect(7, 17, 2, 1, BRASS_LIGHT);
  }),
);

const FELT = "#2f7a4a";
const FELT_DARK = "#1f5a35";
const FELT_LIGHT = "#3f9460";

/**
 * One tile of the poker table (a 4×2 block of them): green felt in a wooden rim. `left`, `right`, `top` and
 * `bottom` say which sides are the table's own edge: those get the rim (the bottom edge also the skirt and its
 * shadow), the inner sides run on into the next tile's felt.
 */
export const pokerTable = cached(
  (left: boolean, right: boolean, top: boolean, bottom: boolean) => `${+left}${+right}${+top}${+bottom}`,
  (left: boolean, right: boolean, top: boolean, bottom: boolean) =>
    bake(16, 16, (p) => {
      const y0 = top ? 3 : 0;
      const y1 = bottom ? 12 : 16;
      if (bottom) p.rect(0, 14, 16, 2, C.shadow);
      // Wood under everything, then the felt inside the rim.
      p.rect(0, y0, 16, y1 - y0, C.ink);
      p.rect(
        left ? 1 : 0,
        top ? 4 : 0,
        16 - (left ? 1 : 0) - (right ? 1 : 0),
        y1 - (top ? 4 : 0) - (bottom ? 1 : 0),
        C.woodLight,
      );
      const fx = left ? 3 : 0;
      const fy = top ? 6 : 0;
      p.rect(fx, fy, 16 - fx - (right ? 3 : 0), y1 - fy - (bottom ? 3 : 0), FELT);
      // A lit edge along the top of the felt, a darker one along the bottom, the table's own light.
      if (top) p.rect(fx, fy, 16 - fx - (right ? 3 : 0), 1, FELT_LIGHT);
      if (bottom) p.rect(fx, y1 - 4, 16 - fx - (right ? 3 : 0), 1, FELT_DARK);
      if (top) p.rect(left ? 1 : 0, 4, 16 - (left ? 1 : 0) - (right ? 1 : 0), 1, C.white);
      if (bottom) {
        p.rect(0, 12, 16, 3, C.ink);
        p.rect(left ? 1 : 0, 12, 16 - (left ? 1 : 0) - (right ? 1 : 0), 2, C.woodDark);
      }
      if (bottom && left) p.rect(2, 13, 2, 2, C.ink);
      if (bottom && right) p.rect(12, 13, 2, 2, C.ink);
    }),
);

const ROULETTE_RED = "#c8382f";
const ROULETTE_BLACK = "#231d2b";
const ROULETTE_GOLD = "#f2c14e";

/** The whole roulette table, 3×2 tiles: wooden rim and skirt, felt, the wheel on the left, the betting grid on the right. */
const rouletteBody = once(() =>
  bake(48, 32, (p) => {
    p.rect(0, 30, 48, 2, C.shadow);
    p.rect(0, 3, 48, 26, C.ink);
    p.rect(1, 4, 46, 25, C.woodLight);
    p.rect(3, 6, 42, 19, FELT);
    p.rect(3, 6, 42, 1, FELT_LIGHT);
    p.rect(3, 24, 42, 1, FELT_DARK);
    p.rect(1, 4, 46, 1, C.white);
    // The skirt.
    p.rect(0, 25, 48, 4, C.ink);
    p.rect(1, 25, 46, 3, C.woodDark);
    p.rect(2, 27, 2, 3, C.ink);
    p.rect(44, 27, 2, 3, C.ink);
    // The wheel: a round brown rim, red and black pockets, a gold hub, the ball.
    const cx = 14;
    const cy = 15;
    for (let y = -7; y <= 7; y++)
      for (let x = -7; x <= 7; x++) {
        const d = x * x + y * y;
        if (d > 49) continue;
        let c: string = C.woodDark;
        if (d <= 36)
          c = (Math.atan2(y, x) + Math.PI) % (Math.PI / 4) < Math.PI / 8 ? ROULETTE_RED : ROULETTE_BLACK;
        if (d <= 16) c = C.wood;
        if (d <= 5) c = ROULETTE_GOLD;
        p.px(cx + x, cy + y, c);
      }
    p.px(cx + 3, cy - 3, C.white);
    // The betting grid: 3 rows of 4 red and black cells, a green zero strip on its left.
    const gx = 28;
    const gy = 9;
    p.rect(gx - 1, gy - 1, 16, 14, C.white);
    p.rect(gx, gy, 3, 12, FELT_DARK);
    for (let r = 0; r < 3; r++)
      for (let c = 0; c < 3; c++)
        p.rect(gx + 3 + c * 3, gy + r * 4, 3, 3, (r + c) % 2 ? ROULETTE_BLACK : ROULETTE_RED);
  }),
);

/** One tile of the roulette table (`col` 0-2, `row` 0-1 of its 3×2 block). */
export const rouletteTable = cached(
  (col: number, row: number) => `${col}${row}`,
  (col: number, row: number) =>
    bake(16, 16, (p) => {
      p.g.drawImage(rouletteBody(), -col * 16, -row * 16);
    }),
);

/** A walkable player spot below the roulette table: a small round red mat with a gold ring. */
export const rouletteSpot = once(() =>
  bake(16, 16, (p) => {
    for (let y = -4; y <= 4; y++)
      for (let x = -5; x <= 5; x++) {
        const d = (x * x) / 25 + (y * y) / 16;
        if (d > 1) continue;
        p.px(8 + x, 9 + y, d > 0.7 ? ROULETTE_GOLD : ROULETTE_RED);
      }
  }),
);

/** The request pile: a corkboard in a wooden frame with a few notes pinned to it, one with a gold star. */
export const requestPile = once(() =>
  bake(16, 16, (p) => {
    p.rect(0, 1, 16, 14, C.ink);
    p.rect(1, 2, 14, 12, C.woodDark);
    p.rect(2, 3, 12, 10, "#b98a52");
    p.rect(2, 3, 12, 1, "#d2a46a");
    // Notes, each held by a red pin.
    p.rect(3, 4, 4, 4, PAPER);
    p.rect(8, 5, 4, 3, "#f5d14a");
    p.rect(4, 9, 3, 3, "#9fd3ef");
    p.rect(9, 9, 4, 3, "#f2a0b8");
    for (const [x, y] of [
      [4, 4],
      [9, 5],
      [5, 9],
      [10, 9],
    ] as const)
      p.px(x, y, C.flowerRed);
    // The scribbles.
    p.rect(4, 6, 2, 1, C.ink);
    p.rect(9, 7, 2, 1, C.ink);
    p.rect(10, 11, 2, 1, C.ink);
    p.px(7, 11, "#ffd75a");
    p.rect(2, 14, 12, 1, C.shadow);
  }),
);

/**
 * The world clocks' board: two tiles of wall, three dials in a row (SF, NY, Copenhagen). It hangs high, reaching
 * into the wall's top like the Hall of Fame, so the regulars' plaque standing below its right half leaves the
 * dials in sight: draw it `CLOCKS_DY` above the wall face's top.
 */
export const CLOCKS_W = 32;
export const CLOCKS_DY = -7;
/** Where each dial's middle is on the board; the SF lamp is on the board's top edge over the first. */
export const DIALS = [6, 16, 26] as const;
const DIAL_Y = 5;
/** A circle 7 pixels across, as each row's half width from the middle column. */
const DIAL_ROWS = [1, 2, 3, 3, 3, 2, 1];

/**
 * The board with the hands at each dial's hour and minute. `lit`: the launch window is open, so SF's face
 * glows warm and the lamp over it is on.
 */
export function worldClocks(
  hands: readonly { hour: number; minute: number }[],
  lit: boolean,
): HTMLCanvasElement {
  return bake(CLOCKS_W, 12, (p) => {
    p.rect(0, 1, CLOCKS_W, 10, C.ink);
    p.rect(1, 2, CLOCKS_W - 2, 8, C.woodDark);
    p.rect(1, 2, CLOCKS_W - 2, 1, C.wood);
    p.rect(1, 11, CLOCKS_W - 2, 1, C.shadow);
    // The lamp over SF.
    p.rect(DIALS[0] - 1, 0, 3, 1, C.ink);
    p.px(DIALS[0], 0, lit ? "#ff6a4a" : "#6b2a2a");
    for (const [i, cx] of DIALS.entries()) {
      for (const [j, half] of DIAL_ROWS.entries())
        p.rect(cx - half, DIAL_Y - 3 + j, half * 2 + 1, 1, j === 0 || j === 6 ? BRASS_DARK : BRASS);
      const face = i === 0 && lit ? BRASS_LIGHT : PAPER;
      for (const [j, half] of DIAL_ROWS.slice(1, -1).entries())
        p.rect(cx - half + 1, DIAL_Y - 2 + j, half * 2 - 1, 1, face);
      const { hour, minute } = hands[i] ?? { hour: 0, minute: 0 };
      const hand = (turns: number, len: number, color: string) => {
        const a = turns * 2 * Math.PI;
        for (let r = 1; r <= len; r++)
          p.px(cx + Math.round(Math.sin(a) * r), DIAL_Y - Math.round(Math.cos(a) * r), color);
      };
      hand(minute / 60, 2, C.ink);
      hand(((hour % 12) + minute / 60) / 12, 1, C.rug);
      p.px(cx, DIAL_Y, C.ink);
    }
  });
}
