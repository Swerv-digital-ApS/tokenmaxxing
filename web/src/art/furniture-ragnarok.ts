/**
 * The Ragnarok Eve case's six pieces (`RAGNAROK_PIECES` in core/src/case-ragnarok-furniture.ts), drawn like the
 * Night Market's in `furniture-home.ts` (same palette idiom, three-quarter view, ink outlines): `furniture-fancy.ts`
 * looks these up through `fancyPiece`. Cold oak, iron, fur and gold leaf; nothing here is a hate symbol and the
 * runestone's marks are the safe set only (see `docs/cases/ragnarok-eve.md`).
 */
import type { FancyPiece } from "./furniture-fancy.ts";
import { C } from "./palette.ts";
import type { Pen } from "./pixels.ts";

const N = {
  oak: "#6b4a2e",
  oakDark: "#3f2a1a",
  oakLight: "#8a6340",
  iron: "#4a5160",
  steel: "#7a8394",
  bone: "#e8dfc8",
  boneDark: "#b8a98a",
  fur: "#9aa3ad",
  frost: "#cfe8f2",
  red: "#a8322e",
  redDark: "#7a2220",
  redLight: "#c8483e",
  woad: "#3b6fb8",
  gold: "#e9b73d",
  goldDark: "#b8860b",
  goldLight: "#ffd36a",
  ember: "#ff9a3c",
  raven: "#252a3a",
  sheen: "#4a4366",
  bear: "#5a3c26",
  bearDark: "#3e2918",
  bearLight: "#7a5636",
  stone: "#9ea3ab",
  stoneDark: "#757b85",
  stoneLight: "#c4c8ce",
  moss: "#6a8a4a",
  boar: "#8a4a22",
  boarLight: "#c0803a",
  bread: "#d9a45a",
} as const;

/** A filled rectangle with a one-pixel ink outline. */
function box(p: Pen, x: number, y: number, w: number, h: number, fill: string): void {
  p.rect(x, y, w, h, C.ink);
  p.rect(x + 1, y + 1, w - 2, h - 2, fill);
}

const shadow = (p: Pen, x: number, y: number, w: number) => p.rect(x, y, w, 2, C.shadow);

/** A filled ellipse, pixel-exact. */
function oval(p: Pen, cx: number, cy: number, rx: number, ry: number, color: string): void {
  for (let y = -ry; y <= ry; y++) {
    const half = Math.floor(rx * Math.sqrt(1 - (y * y) / (ry * ry + 0.01)) + 0.3);
    p.rect(cx - half, cy + y, half * 2 + 1, 1, color);
  }
}

/** An ink-outlined ellipse. */
function blob(p: Pen, cx: number, cy: number, rx: number, ry: number, fill: string): void {
  oval(p, cx, cy, rx + 1, ry + 1, C.ink);
  oval(p, cx, cy, rx, ry, fill);
}

const dots = (p: Pen, pts: readonly (readonly [number, number])[], color: string) => {
  for (const [x, y] of pts) p.px(x, y, color);
};

// MARK: Raven banner

// The raven on the cloth, in profile with its wings folded: 12×8.
// prettier-ignore
const BANNER_RAVEN = [
  "......kkk...",
  ".....kkkwbb.",
  "....kkkkkb..",
  "...kkkkkkk..",
  "..kvkkkkkk..",
  ".kkvkkkkk...",
  "kkkkkkkk....",
  "kk..kk......",
];

/** How far the cloth has swung at row `y`: the hem moves most, the top not at all. */
const sway = (frame: number, y: number): number =>
  frame === 0 ? (y >= 12 ? 1 : 0) : y >= 13 ? -2 : y >= 9 ? -1 : 0;

function ravenBanner(p: Pen, frame: number): void {
  // The pole across the top, a gold knob at each end.
  p.rect(2, 1, 28, 3, C.ink);
  p.rect(3, 2, 26, 1, N.oakLight);
  p.rect(3, 3, 26, 1, N.oakDark);
  for (const x of [0, 29]) {
    p.rect(x, 0, 3, 5, C.ink);
    p.rect(x + (x === 0 ? 0 : 1), 1, 2, 3, N.gold);
    p.px(x + (x === 0 ? 0 : 1), 1, N.goldLight);
  }
  // The cloth: red, a swallowtail hem, flapping in the draught. Rows lower down swing further.
  for (let y = 4; y <= 15; y++) {
    const dx = sway(frame, y);
    const notch = y === 14 ? 3 : y === 15 ? 7 : 0;
    const col = y >= 13 ? N.redDark : N.red;
    const segs: [number, number][] = notch
      ? [
          [6, 15 - Math.floor(notch / 2)],
          [16 + Math.ceil(notch / 2), 25],
        ]
      : [[6, 25]];
    for (const [x0, x1] of segs) {
      p.rect(x0 + dx - 1, y, x1 - x0 + 3, 1, C.ink);
      p.rect(x0 + dx, y, x1 - x0 + 1, 1, col);
    }
  }
  // Folds in the cloth, and its gold hem band.
  for (let y = 5; y < 13; y++) {
    const dx = sway(frame, y);
    p.px(9 + dx, y, N.redDark);
    p.px(22 + dx, y, N.redLight);
  }
  for (let x = 6; x < 26; x++) p.px(x + sway(frame, 12), 12, N.gold);
  BANNER_RAVEN.forEach((row, dy) => {
    const dx = sway(frame, 5 + dy);
    [...row].forEach((c, dxx) => {
      const col =
        c === "k" ? N.raven : c === "v" ? N.sheen : c === "w" ? C.white : c === "b" ? N.goldDark : null;
      if (col) p.px(10 + dxx + dx, 5 + dy, col);
    });
  });
}

// MARK: Bearskin rug

function bearskinRug(p: Pen): void {
  // The pelt, seen from above: head to the right, four paws splayed, a fringe of fur round the edge.
  const lobe = (cx: number, cy: number, rx: number, ry: number) => blob(p, cx, cy, rx, ry, N.bear);
  lobe(6, 5, 4, 3);
  lobe(6, 18, 4, 3);
  lobe(19, 4, 4, 3);
  lobe(19, 19, 4, 3);
  blob(p, 14, 12, 12, 7, N.bear);
  // Cover the seams where the lobes meet the body.
  oval(p, 14, 12, 11, 6, N.bear);
  oval(p, 6, 6, 3, 2, N.bear);
  oval(p, 6, 17, 3, 2, N.bear);
  oval(p, 19, 5, 3, 2, N.bear);
  oval(p, 19, 18, 3, 2, N.bear);
  // Fur: a lighter back, darker tufts.
  oval(p, 13, 11, 8, 4, N.bearLight);
  oval(p, 13, 10, 5, 2, N.bear);
  for (const [x, y] of [
    [7, 9],
    [10, 14],
    [16, 15],
    [18, 9],
    [12, 8],
    [8, 13],
    [15, 7],
    [21, 12],
  ] as const) {
    p.px(x, y, N.bearDark);
    p.px(x + 1, y + 1, N.bearDark);
  }
  // Claws, bone-white, at the end of each paw.
  for (const [x, y] of [
    [2, 4],
    [2, 6],
    [2, 17],
    [2, 19],
    [23, 3],
    [23, 5],
    [23, 18],
    [23, 20],
  ] as const)
    p.px(x, y, N.bone);
  // The head: ears, a round skull, a pale snout, a black nose and a face that has seen things.
  blob(p, 24, 6, 2, 2, N.bear);
  blob(p, 24, 18, 2, 2, N.bear);
  p.px(24, 6, "#c98a7a");
  p.px(24, 18, "#c98a7a");
  blob(p, 25, 12, 5, 6, N.bear);
  oval(p, 25, 12, 4, 5, N.bear);
  oval(p, 28, 12, 2, 3, "#b8946a");
  p.rect(29, 11, 2, 2, C.ink);
  // Half-lidded eyes, a faint crooked grin and one tooth.
  p.rect(24, 9, 3, 1, C.ink);
  p.rect(24, 15, 3, 1, C.ink);
  p.px(25, 10, N.bone);
  p.px(25, 14, N.bone);
  p.rect(27, 14, 3, 1, C.ink);
  p.px(28, 15, N.bone);
}

// MARK: Mead stump

function meadStump(p: Pen): void {
  shadow(p, 2, 16, 12);
  // Roots and the trunk's bark, grooved.
  p.rect(2, 14, 12, 2, C.ink);
  p.rect(3, 14, 3, 1, N.oakDark);
  p.rect(10, 14, 3, 1, N.oakDark);
  p.rect(3, 6, 10, 9, C.ink);
  p.rect(4, 7, 8, 8, N.oak);
  p.rect(4, 7, 2, 8, N.oakLight);
  p.rect(10, 7, 2, 8, N.oakDark);
  dots(
    p,
    [
      [7, 9],
      [8, 12],
      [6, 13],
      [9, 10],
    ],
    N.oakDark,
  );
  // The cut top: pale wood with rings, and a ring of foam where a horn stood.
  oval(p, 8, 5, 6, 3, C.ink);
  oval(p, 8, 5, 5, 2, "#d9b27c");
  oval(p, 8, 5, 3, 1, "#b88a58");
  p.px(8, 5, "#8a6340");
  dots(
    p,
    [
      [4, 4],
      [11, 6],
    ],
    "#fff3c4",
  );
  // The horn lying across it: curved bone, a gold cap, spilled foam.
  p.rect(4, 3, 7, 3, C.ink);
  p.rect(5, 4, 5, 1, N.bone);
  p.rect(5, 3, 3, 1, N.boneDark);
  p.px(10, 3, N.goldLight);
  p.rect(11, 3, 2, 2, C.ink);
  p.px(11, 3, N.gold);
  p.px(12, 4, N.iron);
  p.px(3, 4, N.goldLight);
  p.px(3, 3, "#fff3c4");
  p.px(2, 4, "#fff3c4");
}

// MARK: Feast table

function feastTable(p: Pen, frame: number): void {
  shadow(p, 1, 26, 30);
  // Trestle legs under a long plank top.
  for (const x of [3, 25]) {
    box(p, x, 20, 4, 7, N.oakDark);
    p.rect(x + 1, 21, 1, 5, N.oak);
  }
  box(p, 1, 17, 30, 5, N.oak);
  p.rect(2, 18, 28, 1, N.oakLight);
  p.rect(2, 20, 28, 1, N.oakDark);
  dots(
    p,
    [
      [8, 19],
      [14, 19],
      [21, 19],
      [27, 19],
    ],
    N.oakDark,
  );
  // The top surface in perspective.
  box(p, 0, 12, 32, 6, N.oakLight);
  p.rect(1, 13, 30, 1, "#a07848");
  p.rect(1, 15, 30, 1, "#a07848");
  p.rect(1, 17, 30, 1, N.oak);
  // The boar: a whole roast on a board, glazed brown, an apple in its mouth, sprigs round it.
  oval(p, 16, 11, 9, 4, C.ink);
  p.rect(7, 13, 18, 1, C.ink);
  oval(p, 16, 10, 8, 3, N.boar);
  p.rect(10, 8, 9, 1, N.boarLight);
  p.rect(12, 9, 4, 1, "#e0a050");
  dots(
    p,
    [
      [9, 11],
      [13, 12],
      [18, 11],
      [21, 10],
    ],
    N.oakDark,
  );
  // Head to the right, with a tusk and an apple.
  oval(p, 24, 10, 3, 3, C.ink);
  oval(p, 24, 10, 2, 2, N.boar);
  p.px(25, 9, C.ink);
  p.px(26, 11, N.bone);
  p.rect(27, 10, 3, 3, C.ink);
  p.rect(28, 10, 1, 2, N.red);
  p.px(28, 10, N.redLight);
  // Parsley.
  dots(
    p,
    [
      [10, 14],
      [12, 14],
      [20, 14],
      [22, 14],
      [21, 13],
    ],
    "#4f9b3d",
  );
  // Bread on the left.
  blob(p, 3, 14, 2, 1, N.bread);
  p.px(3, 13, "#f0c07a");
  blob(p, 6, 15, 2, 1, N.bread);
  // Two tankards on the right, foam spilling.
  for (const x of [26, 29]) {
    box(p, x, 11, 3, 4, N.steel);
    p.rect(x, 10, 3, 1, "#fff3c4");
    p.px(x + 1, 13, N.goldDark);
  }
  // Steam rising off the roast, a wisp or two, drifting.
  const wisps: [number, number][] =
    frame === 0
      ? [
          [14, 6],
          [15, 4],
          [14, 2],
          [19, 5],
          [20, 3],
        ]
      : [
          [15, 6],
          [14, 4],
          [15, 2],
          [20, 5],
          [19, 3],
        ];
  for (const [x, y] of wisps) p.px(x, y, "rgba(255, 255, 255, 0.7)");
  p.px(frame === 0 ? 16 : 13, 3, "rgba(255, 255, 255, 0.4)");
}

// MARK: Runestone

// Three safe glyphs, one over the other (Gebo, Raidho, Mannaz): 3×5 each, painted red.
// prettier-ignore
const STONE_GLYPHS = [
  ["X.X", "X.X", ".X.", "X.X", "X.X"],
  ["XX.", "X.X", "XX.", "X.X", "X.X"],
  ["X.X", "XXX", "X.X", "X.X", "X.X"],
];

function runestone(p: Pen): void {
  shadow(p, 2, 29, 12);
  // The standing stone: a tall slab with a rounded top, ink outlined, lit from the left.
  p.rect(5, 1, 6, 1, C.ink);
  p.rect(3, 2, 10, 1, C.ink);
  p.rect(2, 3, 12, 25, C.ink);
  p.rect(3, 3, 10, 1, N.stoneLight);
  p.rect(4, 2, 8, 1, N.stoneLight);
  p.rect(3, 4, 10, 23, N.stone);
  p.rect(3, 4, 2, 23, N.stoneLight);
  p.rect(11, 4, 2, 23, N.stoneDark);
  p.rect(3, 26, 10, 1, N.stoneDark);
  // The painted band round the top: red, with woad dots.
  p.rect(5, 5, 6, 1, N.red);
  p.px(4, 6, N.red);
  p.px(11, 6, N.red);
  p.rect(4, 7, 1, 18, N.red);
  p.rect(11, 7, 1, 18, N.red);
  p.rect(5, 25, 6, 1, N.red);
  for (let y = 8; y < 24; y += 3) {
    p.px(5, y, N.woad);
    p.px(10, y, N.woad);
  }
  // The inscription, painted in loud colours: three glyphs, red with a woad dot between.
  for (const [i, g] of STONE_GLYPHS.entries())
    for (const [dy, row] of g.entries())
      for (const [dx, c] of [...row].entries()) if (c === "X") p.px(6 + dx, 7 + i * 6 + dy, N.red);
  p.px(8, 12, N.woad);
  p.px(8, 18, N.woad);
  // Moss and a rime of snow at the foot.
  p.rect(3, 27, 4, 1, N.moss);
  p.px(9, 27, N.moss);
  p.px(4, 26, N.moss);
  p.rect(5, 1, 4, 1, N.frost);
  p.px(6, 0, "rgba(207, 232, 242, 0.8)");
}

// MARK: Yggdrasil

const LEAVES = ["#ffd36a", "#f5b830", "#ffe9a0", "#e9a020"];

function yggdrasil(p: Pen, frame: number): void {
  oval(p, 24, 51, 20, 3, C.shadow);
  // Roots: splayed over the mound, one on the left nibbled through.
  p.rect(10, 47, 28, 4, C.ink);
  oval(p, 24, 49, 12, 3, "#5a8a3a");
  oval(p, 24, 48, 9, 2, "#7aaa50");
  for (const [x, y, w] of [
    [14, 49, 7],
    [28, 49, 7],
    [20, 47, 8],
  ] as const) {
    p.rect(x - 1, y - 1, w + 2, 3, C.ink);
    p.rect(x, y, w, 1, N.oak);
  }
  p.rect(12, 50, 3, 1, N.oakDark);
  // The nibbled root's end: bite marks and a few shavings.
  p.px(11, 49, "rgba(0,0,0,0)");
  dots(
    p,
    [
      [11, 50],
      [12, 52],
      [14, 52],
      [9, 51],
    ],
    N.boneDark,
  );
  // The trunk, banded with pale bark, bright on the left.
  p.rect(19, 24, 10, 25, C.ink);
  p.rect(20, 24, 8, 25, N.oak);
  p.rect(20, 24, 2, 25, N.oakLight);
  p.rect(26, 24, 2, 25, N.oakDark);
  for (let y = 26; y < 48; y += 4) p.px(23 + (y % 8 === 2 ? 1 : 0), y, N.oakDark);
  // Branches reaching out to the crown.
  const limb = (x0: number, y0: number, x1: number, y1: number) => {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
    for (let i = 0; i <= n; i++) {
      const x = Math.round(x0 + ((x1 - x0) * i) / n);
      const y = Math.round(y0 + ((y1 - y0) * i) / n);
      p.rect(x - 1, y - 1, 3, 3, C.ink);
    }
    for (let i = 0; i <= n; i++) {
      const x = Math.round(x0 + ((x1 - x0) * i) / n);
      const y = Math.round(y0 + ((y1 - y0) * i) / n);
      p.px(x, y, N.oak);
    }
  };
  limb(24, 26, 10, 18);
  limb(24, 26, 38, 18);
  limb(24, 24, 24, 10);
  limb(20, 30, 6, 28);
  limb(28, 30, 42, 28);
  // The crown: clumps of gold leaf, a lit core in each.
  const clump = (cx: number, cy: number, r: number) => {
    p.disc(cx, cy, r + 1, "#9a6a10");
    p.disc(cx, cy, r, LEAVES[3]!);
    p.disc(cx - 1, cy - 1, Math.max(1, r - 2), LEAVES[1]!);
    p.disc(cx - 1, cy - 2, Math.max(1, r - 4), LEAVES[0]!);
  };
  clump(24, 14, 8);
  clump(12, 18, 6);
  clump(36, 18, 6);
  clump(7, 28, 4);
  clump(41, 28, 4);
  clump(24, 8, 5);
  // Leaves catching light, shifting from frame to frame.
  const glints: [number, number][] = [
    [18, 10],
    [30, 12],
    [10, 16],
    [37, 15],
    [24, 6],
    [6, 26],
    [41, 26],
    [22, 18],
    [32, 20],
  ];
  glints.forEach(([x, y], i) => {
    if ((i + frame) % 3 === 0) {
      p.px(x, y, "#ffffff");
      p.px(x + 1, y, "#fff3c4");
    }
  });
  // The eagle on the top, wings folded, a pale head, a gold beak.
  p.grid(
    [".bbb..", "bBbbww", "BBBbwy", ".bBb..", "..y.y."],
    { b: "#6a4a2a", B: "#4a321c", w: "#f4efe4", y: "#e9b73d" },
    21,
    0,
  );
  // The squirrel running up and down the trunk: one bound per frame.
  const sy = [40, 34, 28, 34][frame % 4]!;
  p.rect(28, sy, 5, 5, C.ink);
  p.rect(29, sy + 1, 3, 3, "#c0592a");
  p.px(30, sy + 1, C.ink);
  p.px(31, sy + 3, "#f1d8b0");
  p.rect(32, sy - 3, 2, 4, C.ink);
  p.rect(32, sy - 2, 1, 3, "#c0592a");
}

// MARK: Catalog

const piece = (
  id: string,
  name: string,
  w: number,
  height: number,
  draw: FancyPiece["draw"],
  extra: Partial<Pick<FancyPiece, "frames" | "frameMs" | "placement" | "rarity">>,
): FancyPiece => ({
  id,
  name,
  w,
  h: 1,
  height,
  price: 0,
  rarity: "common",
  frames: 1,
  frameMs: 500,
  tint: null,
  placement: "floor",
  draw,
  ...extra,
});

/** The Ragnarok Eve case's pieces (`RAGNAROK_PIECES` in core/src/case-ragnarok-furniture.ts). */
export const RAGNAROK_FURNITURE: readonly FancyPiece[] = [
  piece("norse-raven-banner", "Raven banner", 2, 16, ravenBanner, {
    frames: 2,
    frameMs: 600,
    placement: "wall",
    rarity: "common",
  }),
  piece("norse-bearskin-rug", "Bearskin rug", 2, 24, bearskinRug, { placement: "flat", rarity: "common" }),
  piece("norse-mead-stump", "Mead stump", 1, 18, meadStump, { rarity: "common" }),
  piece("norse-feast-table", "Feast table", 2, 28, feastTable, {
    frames: 2,
    frameMs: 500,
    rarity: "uncommon",
  }),
  piece("norse-runestone", "Painted runestone", 1, 32, runestone, { rarity: "uncommon" }),
  piece("norse-yggdrasil", "Yggdrasil sapling", 3, 56, yggdrasil, {
    frames: 4,
    frameMs: 450,
    rarity: "rare",
  }),
];
