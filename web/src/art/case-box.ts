/**
 * The cases and their keys in 2D pixel art. The Night Market's: a lacquered plum-to-crimson crate with a lantern
 * emblem, gold straps and a hanging tag, and a gold market coin with a square hole on a red tassel. The
 * Nusantara's: a teak sea chest with rattan corners, turquoise rope handles, a batik kawung band on the lid and a
 * white sail on the front, daylight and jasmine petals when it opens, and a brass anchor-bow key on a knotted
 * batik ribbon. Ragnarok Eve's is drawn in `case-ragnarok-box.ts`.
 *
 *   caseBoxSprite("closed")    // 24x28 canvas: the case, lid down
 *   caseBoxSprite("open", f)   // 24x28 canvas: lid up, light spilling out; f = 0 | 1 (sparkles shift)
 *   caseBoxSprite("key")       // 16x24 canvas: the key
 *   caseBoxSprite(kind, f, id) // the same for the case `id` (`CaseDef.id`); the Night Market's by default
 *   CASE_BOX_SIZE[kind]        // { w, h } of each, in art pixels (draw scaled with imageSmoothingEnabled = false)
 *
 * Canvases are baked once and cached: draw them, do not mutate them. `closed`/`open` share one frame and
 * baseline, so swapping them in place makes the lid pop open. `CASE_BOX_FRAMES` is how many frames animate.
 */

import { drawRagnarokBox } from "./case-ragnarok-box.ts";
import { C } from "./palette.ts";
import { bake, type Pen } from "./pixels.ts";

export type CaseBoxKind = "closed" | "open" | "key";

export const CASE_BOX_SIZE: Record<CaseBoxKind, { w: number; h: number }> = {
  closed: { w: 24, h: 28 },
  open: { w: 24, h: 28 },
  key: { w: 16, h: 24 },
};

/** Frames per kind: the open case's sparkles and glow shift between two. */
export const CASE_BOX_FRAMES: Record<CaseBoxKind, number> = { closed: 1, open: 2, key: 1 };

const P = {
  plum: "#3d1a52",
  plumDark: "#2a1139",
  plumLight: "#5a2a6e",
  wine: "#6e2260",
  crimson: "#a82840",
  crimsonLight: "#d8402f",
  lacquer: "#23202b",
  gold: "#e9b73d",
  goldDark: "#b8860b",
  goldLight: "#ffd36a",
  paper: "#fff1c9",
  glow: "#ffd36a",
  orange: "#f08a3c",
  red: "#d8402f",
  redDark: "#a42a22",
} as const;

// A 6x8 lantern: gold caps, orange ribs, a lit paper belly and a red tassel.
// prettier-ignore
const LANTERN = [
  "..gg..",
  ".gGGg.",
  "RyWWyR",
  "RyWWyR",
  "RyyyyR",
  ".gGGg.",
  "..rr..",
  "..rr..",
];
const LANTERN_PAL = { g: P.gold, G: P.goldDark, R: P.red, y: P.glow, W: P.paper, r: P.redDark };

// Lantern stamped on the coin: 4x5, darker gold.
// prettier-ignore
const STAMP = [
  ".dd.",
  "dLLd",
  "dLLd",
  "dLLd",
  ".dd.",
];

/** The case body, lower part, lid not included. `y0` is the top of the body's ink outline. */
function body(p: Pen, y0: number, lit: boolean): void {
  // Outline and fill, plum at the foot to crimson under the lid.
  p.rect(1, y0, 22, 11, C.ink);
  p.rect(2, y0 + 1, 20, 9, P.plum);
  p.rect(2, y0 + 1, 20, 3, P.crimson);
  p.rect(2, y0 + 4, 20, 2, P.wine);
  p.rect(2, y0 + 1, 20, 1, P.plumDark); // the shadow under the lid
  p.rect(2, y0 + 2, 20, 1, P.crimson);
  p.rect(2, y0 + 9, 20, 1, P.plumDark);
  // Lacquer highlight.
  p.rect(3, y0 + 3, 2, 1, P.crimsonLight);
  // Gold straps and their rivets.
  for (const x of [3, 19]) {
    p.rect(x, y0 + 1, 2, 9, P.gold);
    p.rect(x, y0 + 1, 1, 9, P.goldLight);
    p.px(x + 1, y0 + 3, P.goldDark);
    p.px(x + 1, y0 + 7, P.goldDark);
  }
  // The lantern plate and the lantern.
  p.rect(7, y0 + 1, 10, 9, P.lacquer);
  p.rect(7, y0 + 1, 10, 1, P.gold);
  p.grid(LANTERN, LANTERN_PAL, 9, y0 + 2);
  if (lit) p.px(8, y0 + 4, P.orange);
  // The hanging tag: a cord from the strap, a paper tag with a red seal.
  p.px(18, y0 + 5, P.goldDark);
  p.rect(16, y0 + 6, 4, 4, C.ink);
  p.rect(17, y0 + 7, 2, 2, P.paper);
  p.px(17, y0 + 7, P.red);
}

function drawClosed(p: Pen): void {
  // Shadow on the floor.
  p.rect(2, 25, 20, 2, C.shadow);
  body(p, 14, false);
  // The lid: a domed crimson top over the body, a gold band along its edge.
  p.rect(0, 8, 24, 7, C.ink);
  p.rect(1, 9, 22, 5, P.wine);
  p.rect(1, 9, 22, 2, P.crimson);
  p.rect(1, 9, 22, 1, P.crimsonLight);
  p.rect(1, 13, 22, 1, P.gold);
  p.rect(1, 13, 22, 1, P.goldDark);
  p.rect(1, 12, 22, 1, P.gold);
  for (const x of [3, 19]) {
    p.rect(x, 9, 2, 5, P.gold);
    p.rect(x, 9, 1, 5, P.goldLight);
  }
  // Clasp: a gold plate over the seam with a lantern-red bead.
  p.rect(10, 11, 4, 4, C.ink);
  p.rect(11, 11, 2, 3, P.gold);
  p.px(11, 12, P.red);
  p.px(12, 12, P.goldDark);
  // Top edge rim highlight.
  p.rect(2, 8, 20, 1, C.ink);
  p.px(0, 8, "rgba(0,0,0,0)");
}

function drawOpen(p: Pen, frame: number): void {
  // Warm light on the floor.
  p.rect(2, 25, 20, 2, C.shadow);
  p.rect(5, 26, 14, 1, "rgba(255, 211, 106, 0.45)");
  // The lid, standing up behind: its inside lit from below.
  p.rect(1, 0, 22, 12, C.ink);
  p.rect(2, 1, 20, 10, P.wine);
  p.rect(2, 1, 20, 2, P.crimson);
  p.rect(2, 3, 20, 3, P.wine);
  p.rect(2, 6, 20, 2, "#a85a4a");
  p.rect(2, 8, 20, 2, "#e08a4a");
  p.rect(2, 10, 20, 1, P.goldLight);
  p.rect(2, 1, 20, 1, P.gold);
  p.rect(2, 1, 20, 1, P.goldDark);
  for (const x of [3, 19]) {
    p.rect(x, 2, 2, 9, P.gold);
    p.rect(x, 2, 1, 9, P.goldLight);
  }
  p.rect(7, 5, 10, 4, "#d8662f");
  p.rect(9, 7, 6, 2, "#f6b24a");
  // The body, its mouth full of light.
  body(p, 14, true);
  p.rect(0, 11, 24, 3, C.ink);
  p.rect(1, 12, 22, 2, P.glow);
  p.rect(4, 12, 16, 1, P.paper);
  p.rect(1, 11, 22, 1, P.gold);
  p.rect(1, 11, 22, 1, P.goldDark);
  p.rect(1, 11, 22, 1, P.gold);
  // The beam rising out of the mouth and the motes in it.
  p.rect(5, 9, 14, 2, "rgba(255, 233, 160, 0.75)");
  p.rect(8, 8, 8, 1, "rgba(255, 233, 160, 0.6)");
  const motes: [number, number][] =
    frame === 0
      ? [
          [6, 5],
          [12, 4],
          [17, 6],
          [9, 9],
        ]
      : [
          [7, 4],
          [11, 5],
          [16, 4],
          [14, 9],
        ];
  for (const [x, y] of motes) p.px(x, y, P.paper);
  p.px(frame === 0 ? 20 : 3, 8, P.glow);
}

function drawKey(p: Pen): void {
  // The cord loop through the hole, up top.
  p.rect(6, 0, 4, 1, C.ink);
  p.rect(5, 1, 1, 3, C.ink);
  p.rect(10, 1, 1, 3, C.ink);
  p.rect(6, 1, 1, 3, P.red);
  p.rect(9, 1, 1, 3, P.red);
  // The coin: ink ring, gold face, a darker inner ring, a highlight and a shaded edge.
  p.disc(8, 9, 7, C.ink);
  p.disc(8, 9, 6, P.gold);
  p.disc(8, 9, 5, P.goldDark);
  p.disc(8, 9, 4, P.gold);
  p.px(4, 6, P.goldLight);
  p.px(5, 5, P.goldLight);
  p.px(6, 4, P.goldLight);
  p.px(3, 8, P.goldLight);
  p.px(12, 13, P.goldDark);
  p.px(11, 14, P.goldDark);
  // The square hole.
  p.rect(7, 5, 2, 2, C.ink);
  p.px(7, 5, P.plumDark);
  // The lantern stamp below it.
  p.grid(STAMP, { d: P.goldDark, L: P.red }, 6, 8);
  // The tassel: a gold bead on the cord, a red skirt.
  p.rect(7, 16, 2, 1, C.ink);
  p.rect(6, 17, 4, 3, C.ink);
  p.rect(7, 17, 2, 2, P.gold);
  p.px(7, 17, P.goldLight);
  p.rect(5, 19, 6, 5, C.ink);
  p.rect(6, 20, 4, 4, P.red);
  p.rect(6, 19, 4, 1, P.redDark);
  p.px(7, 21, P.redDark);
  p.px(9, 22, P.redDark);
  p.px(8, 20, "#f06a4a");
  p.px(6, 23, P.redDark);
  p.px(9, 23, P.redDark);
}

// MARK: Nusantara

const T = {
  teak: "#8a5a2b",
  teakDark: "#5a3a1c",
  teakLight: "#b57c4b",
  sea: "#1fb5b0",
  seaDark: "#0f6e86",
  saffron: "#f2b632",
  saffronLight: "#ffd36a",
  brass: "#e9b73d",
  brassDark: "#b8860b",
  cream: "#f1e3c2",
  white: "#fbf7ef",
  indigo: "#243a73",
  indigoDark: "#1b2a5e",
  soga: "#6b4226",
  rattan: "#d9b36a",
  rattanDark: "#a8793a",
  daylight: "#fff6d8",
  petal: "#ffffff",
} as const;

/** The kawung band: cream four-oval marks on indigo, `w` wide, three rows from (`x`, `y`). */
function kawungBand(p: Pen, x: number, y: number, w: number): void {
  p.rect(x, y, w, 3, T.indigo);
  p.rect(x, y, w, 1, T.indigoDark);
  for (let cx = x + 2; cx < x + w - 1; cx += 5) {
    p.rect(cx - 1, y + 1, 3, 1, T.cream);
    p.px(cx, y, T.cream);
    p.px(cx, y + 2, T.cream);
    p.px(cx, y + 1, T.soga);
  }
}

/** A rattan-wrapped corner post: tan with dark diagonal binding. */
function rattanPost(p: Pen, x: number, y: number, h: number): void {
  p.rect(x, y, 2, h, T.rattan);
  for (let k = 0; k < h; k++) p.px(x + (k % 2), y + k, T.rattanDark);
}

/** The chest's body, `y0` the top of the outline. */
function chestBody(p: Pen, y0: number, lit: boolean): void {
  p.rect(2, y0, 20, 11, C.ink);
  p.rect(3, y0 + 1, 18, 9, T.teak);
  p.rect(3, y0 + 1, 18, 1, T.teakDark);
  p.rect(3, y0 + 2, 18, 1, T.teakLight);
  p.rect(3, y0 + 5, 18, 1, T.teakDark);
  p.rect(3, y0 + 8, 18, 1, T.teakDark);
  p.rect(3, y0 + 9, 18, 1, T.teakDark);
  for (const x of [8, 15]) p.px(x, y0 + 3, T.teakDark);
  rattanPost(p, 3, y0 + 1, 9);
  rattanPost(p, 19, y0 + 1, 9);
  // Turquoise rope handles, a loop on each side.
  for (const [x, d] of [
    [0, 1],
    [22, -1],
  ] as const) {
    p.rect(x, y0 + 3, 2, 5, C.ink);
    p.rect(x + (d === 1 ? 0 : 1), y0 + 4, 1, 3, T.sea);
    p.px(x + (d === 1 ? 1 : 0), y0 + 3, T.sea);
    p.px(x + (d === 1 ? 1 : 0), y0 + 7, T.sea);
    p.px(x + (d === 1 ? 0 : 1), y0 + 5, T.seaDark);
  }
  // The sail emblem on a dark indigo plate: a white sail on a teak mast over a turquoise hull.
  p.rect(8, y0 + 2, 8, 8, C.ink);
  p.rect(9, y0 + 3, 6, 6, T.indigoDark);
  p.rect(11, y0 + 3, 1, 5, T.cream);
  p.px(12, y0 + 3, T.cream);
  p.rect(12, y0 + 4, 2, 3, T.white);
  p.px(14, y0 + 6, T.white);
  p.rect(10, y0 + 5, 1, 2, T.white);
  p.rect(9, y0 + 8, 6, 1, T.sea);
  p.rect(10, y0 + 8, 4, 1, T.seaDark);
  p.px(9, y0 + 8, T.sea);
  if (lit) p.px(16, y0 + 2, T.saffronLight);
}

function drawNusClosed(p: Pen): void {
  p.rect(3, 25, 18, 2, C.shadow);
  chestBody(p, 14, false);
  // The lid: a domed teak top with a kawung band across it, rattan-wrapped corners and a brass clasp.
  p.rect(1, 8, 22, 7, C.ink);
  p.rect(2, 9, 20, 5, T.teak);
  p.rect(3, 8, 18, 1, C.ink);
  p.rect(3, 9, 18, 1, T.teakLight);
  p.rect(2, 13, 20, 1, T.teakDark);
  kawungBand(p, 2, 10, 20);
  rattanPost(p, 2, 9, 5);
  rattanPost(p, 19, 9, 5);
  // The clasp: a brass plate over the seam with a keyhole.
  p.rect(10, 12, 4, 5, C.ink);
  p.rect(11, 12, 2, 4, T.brass);
  p.px(11, 12, T.saffronLight);
  p.px(12, 14, C.ink);
}

function drawNusOpen(p: Pen, frame: number): void {
  p.rect(3, 25, 18, 2, C.shadow);
  p.rect(5, 26, 14, 1, "rgba(255, 246, 216, 0.55)");
  // The lid standing open behind, its lining flooded with daylight: cream-white at the hinge, gold at the top.
  p.rect(1, 0, 22, 12, C.ink);
  p.rect(2, 1, 20, 10, T.teak);
  p.rect(2, 1, 20, 2, T.teakDark);
  p.rect(3, 3, 18, 8, T.saffron);
  p.rect(3, 6, 18, 5, T.saffronLight);
  p.rect(3, 9, 18, 2, T.daylight);
  rattanPost(p, 2, 1, 10);
  rattanPost(p, 19, 1, 10);
  // The body, its mouth full of light.
  chestBody(p, 14, true);
  p.rect(1, 11, 22, 3, C.ink);
  p.rect(2, 12, 20, 2, T.daylight);
  p.rect(4, 12, 16, 1, T.white);
  p.rect(2, 11, 20, 1, T.saffron);
  // The beam of daylight rising out of the mouth.
  p.rect(5, 9, 14, 2, "rgba(255, 246, 216, 0.8)");
  p.rect(8, 8, 8, 1, "rgba(255, 246, 216, 0.6)");
  // Jasmine petals rising: a white petal with a gold heart, each a pair of pixels.
  const petals: [number, number][] =
    frame === 0
      ? [
          [6, 6],
          [12, 3],
          [17, 7],
          [9, 9],
        ]
      : [
          [7, 4],
          [11, 6],
          [16, 4],
          [14, 9],
        ];
  for (const [x, y] of petals) {
    p.px(x, y, T.petal);
    p.px(x + 1, y, T.petal);
    p.px(x, y - 1, T.petal);
    p.px(x + 1, y - 1, T.saffron);
  }
  p.px(frame === 0 ? 20 : 3, 8, T.petal);
}

function drawNusKey(p: Pen): void {
  const blue = "#3b5da8";
  // The batik ribbon: two tails falling either side of the anchor, tied above the ring in a cream and blue knot.
  for (const [x, d] of [
    [2, -1],
    [11, 1],
  ] as const) {
    p.rect(x, 5, 4, 9, C.ink);
    p.rect(x + 1, 5, 2, 8, blue);
    p.px(x + (d === 1 ? 2 : 1), 7, T.cream);
    p.px(x + (d === 1 ? 1 : 2), 9, T.cream);
    p.px(x + (d === 1 ? 2 : 1), 11, T.cream);
    p.px(x + (d === 1 ? 1 : 2), 12, T.soga);
  }
  p.px(5, 3, C.ink);
  p.px(4, 4, C.ink);
  p.px(10, 3, C.ink);
  p.px(11, 4, C.ink);
  p.px(5, 4, blue);
  p.px(10, 4, blue);
  p.rect(5, 0, 6, 4, C.ink);
  p.rect(6, 1, 4, 2, blue);
  p.rect(7, 1, 2, 2, T.cream);
  p.px(7, 2, T.soga);
  // The anchor bow: a ring, a stock, a shank, two curved arms with flukes, and the shaft below with its bit.
  p.disc(8, 7, 3, C.ink);
  p.disc(8, 7, 2, T.brass);
  p.disc(8, 7, 1, C.ink);
  p.px(6, 6, T.saffronLight);
  p.px(7, 5, T.saffronLight);
  p.px(10, 9, T.brassDark);
  p.rect(7, 9, 4, 15, C.ink);
  p.rect(8, 10, 2, 13, T.brass);
  p.rect(8, 10, 1, 13, T.saffronLight);
  p.rect(9, 12, 1, 11, T.brassDark);
  p.rect(4, 11, 10, 3, C.ink);
  p.rect(5, 12, 8, 1, T.brass);
  p.rect(5, 12, 2, 1, T.saffronLight);
  const arm = [
    [6, 20],
    [5, 20],
    [4, 19],
    [3, 18],
    [3, 17],
    [3, 16],
  ] as const;
  for (const side of [0, 1])
    for (const ink of [true, false])
      for (const [x, y] of arm) {
        const px = side ? 17 - x : x;
        if (ink)
          for (const [dx, dy] of [
            [1, 0],
            [-1, 0],
            [0, 1],
            [0, -1],
          ] as const)
            p.px(px + dx, y + dy, C.ink);
        else p.px(px, y, side ? T.brassDark : T.brass);
      }
  p.rect(10, 21, 4, 3, C.ink);
  p.rect(11, 22, 2, 1, T.brassDark);
}

const cache = new Map<string, HTMLCanvasElement>();

/** The cases whose art is not the Night Market's, by case id (`core/src/cases.ts`); every other id draws the Night Market's. */
const OTHER_CASES: Record<string, (p: Pen, kind: CaseBoxKind, frame: number) => void> = {
  nusantara: (p, kind, frame) =>
    kind === "closed" ? drawNusClosed(p) : kind === "open" ? drawNusOpen(p, frame) : drawNusKey(p),
  "ragnarok-eve": drawRagnarokBox,
};

/**
 * The sprite for `kind` (frame 0 or 1; only the open case animates) of the case `caseId` (`CaseDef.id`, the Night
 * Market's if left out). Cached: do not draw into it.
 */
export function caseBoxSprite(kind: CaseBoxKind, frame = 0, caseId = "night-market"): HTMLCanvasElement {
  const f = kind === "open" ? frame % 2 : 0;
  const draw = OTHER_CASES[caseId];
  const k = `${draw ? caseId : ""}${kind}${f}`;
  let c = cache.get(k);
  if (!c) {
    const { w, h } = CASE_BOX_SIZE[kind];
    c = bake(w, h, (p) =>
      draw
        ? draw(p, kind, f)
        : kind === "closed"
          ? drawClosed(p)
          : kind === "open"
            ? drawOpen(p, f)
            : drawKey(p),
    );
    cache.set(k, c);
  }
  return c;
}
