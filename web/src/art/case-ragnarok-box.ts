import { C } from "./palette.ts";
import { bake, once, type Pen } from "./pixels.ts";

/**
 * The Ragnarok Eve case and its key in 2D pixel art (`case-box.ts` picks these by case id): an oak sea chest with
 * iron bands, dragon-head studs, a round shield-boss clasp, frost along the lid and a plain knotwork band (no runes
 * on the box), a carved tally with a raven hanging from it; a pierced silver coin with a raven stamp on a leather
 * thong. Same canvases as the Night Market's: 24x28 closed/open (open has two frames), 16x24 key.
 */

const R = {
  oak: "#6b4a2e",
  oakDark: "#3f2a1a",
  oakLight: "#8a6340",
  iron: "#4a5160",
  steel: "#7a8394",
  steelLight: "#b4bdcb",
  bone: "#e8dfc8",
  boneDark: "#b8a98a",
  frost: "#cfe8f2",
  ice: "#8fc4e0",
  ember: "#ff9a3c",
  emberDark: "#c4571f",
  gold: "#e9b73d",
  raven: "#252a3a",
  sheen: "#4a4366",
  thong: "#7a5230",
  thongDark: "#4d3219",
  silver: "#c9d1dc",
  silverDark: "#8d97a8",
} as const;

// The carved tally: a raven, black with a violet sheen, a gold beak. 4x4 on a bone-coloured tag.
// prettier-ignore
const RAVEN_TAG = [
  "..kb",
  ".kkk",
  "kvk.",
  ".k..",
];
const RAVEN_TAG_PAL = { k: R.raven, v: R.sheen, b: R.gold };

// A dragon-head stud, 3x3, pointing out: a steel head with a lit ember eye.
// prettier-ignore
const DRAGON_L = [
  ".ss",
  "ses",
  ".ss",
];
// prettier-ignore
const DRAGON_R = [
  "ss.",
  "ses",
  "ss.",
];
const DRAGON_PAL = { s: R.steelLight, e: R.ember };

// The knotwork band: bone links, crossing over and under, on a dark groove. 12 wide, 3 tall.
// prettier-ignore
const KNOT = [
  "b..bb..bb..b",
  ".bB..bB..bB.",
  "b..bb..bb..b",
];

/** The chest body: planks, bands, studs, the knotwork band and the tally. `y0` is the top of its ink outline. */
function body(p: Pen, y0: number): void {
  p.rect(1, y0, 22, 11, C.ink);
  p.rect(2, y0 + 1, 20, 9, R.oak);
  p.rect(2, y0 + 1, 20, 1, R.oakDark); // the shadow under the lid
  p.rect(2, y0 + 4, 20, 1, R.oakDark);
  p.rect(2, y0 + 7, 20, 1, R.oakDark);
  p.rect(2, y0 + 2, 20, 1, R.oakLight);
  p.rect(2, y0 + 5, 20, 1, R.oakLight);
  p.rect(2, y0 + 8, 20, 1, R.oakLight);
  p.rect(2, y0 + 9, 20, 1, R.oakDark);
  // Iron bands, with a rivet each way.
  for (const x of [3, 19]) {
    p.rect(x, y0 + 1, 2, 9, R.iron);
    p.rect(x, y0 + 1, 1, 9, R.steel);
    p.px(x + 1, y0 + 3, R.steelLight);
    p.px(x + 1, y0 + 7, R.steelLight);
  }
  // Dragon-head studs on the lower corners.
  p.grid(DRAGON_L, DRAGON_PAL, 0, y0 + 6);
  p.grid(DRAGON_R, DRAGON_PAL, 21, y0 + 6);
  // The knotwork band across the planks.
  p.rect(6, y0 + 5, 12, 3, R.oakDark);
  p.grid(KNOT, { b: R.bone, B: R.boneDark }, 6, y0 + 5);
  // The tally: a cord from the clasp, a carved tag with a raven.
  p.px(17, y0 + 2, R.thongDark);
  p.px(17, y0 + 3, R.thongDark);
  p.rect(14, y0 + 4, 6, 6, C.ink);
  p.rect(15, y0 + 5, 4, 4, R.boneDark);
  p.grid(RAVEN_TAG, RAVEN_TAG_PAL, 15, y0 + 5);
}

function drawClosed(p: Pen): void {
  p.rect(2, 25, 20, 2, C.shadow);
  body(p, 14);
  // The lid: a low dome of planks with an iron band each side.
  p.rect(2, 7, 20, 1, C.ink);
  p.rect(0, 8, 24, 7, C.ink);
  p.px(0, 8, "rgba(0,0,0,0)");
  p.px(23, 8, "rgba(0,0,0,0)");
  p.rect(1, 8, 22, 6, R.oak);
  p.rect(2, 8, 20, 1, R.oakLight);
  p.rect(1, 10, 22, 1, R.oakDark);
  p.rect(1, 11, 22, 1, R.oakLight);
  p.rect(1, 13, 22, 1, R.iron);
  for (const x of [3, 19]) {
    p.rect(x, 8, 2, 6, R.iron);
    p.rect(x, 8, 1, 6, R.steel);
  }
  // Frost on the lid's top edge and rim, and icicles over the chest's mouth.
  for (const x of [3, 4, 5, 8, 9, 12, 13, 14, 17, 18, 21]) p.px(x, 8, R.frost);
  for (const x of [5, 6, 10, 15, 16, 20]) p.px(x, 9, "rgba(207, 232, 242, 0.8)");
  for (const x of [7, 8, 13, 14, 21]) p.px(x, 13, R.frost);
  for (const x of [8, 14]) p.px(x, 14, R.frost);
  p.px(8, 15, R.ice);
  // The shield-boss clasp over the seam: a steel disc, a dome, a bone spike.
  p.disc(12, 14, 4, C.ink);
  p.disc(12, 14, 3, R.steel);
  p.disc(12, 14, 2, R.steelLight);
  p.px(12, 14, R.bone);
  p.px(10, 15, R.iron);
  p.px(11, 16, R.iron);
  p.px(13, 16, R.iron);
}

function drawOpen(p: Pen, frame: number): void {
  p.rect(2, 25, 20, 2, C.shadow);
  p.rect(4, 26, 7, 1, "rgba(143, 196, 224, 0.5)");
  p.rect(13, 26, 7, 1, "rgba(255, 154, 60, 0.45)");
  // The lid, stood up behind: its inside lit from below, ice on the left and ember on the right.
  p.rect(1, 0, 22, 12, C.ink);
  p.rect(2, 1, 20, 10, R.oakDark);
  p.rect(2, 2, 20, 2, R.oak);
  p.rect(2, 5, 20, 1, R.oak);
  p.rect(2, 7, 10, 2, "#4d6a82");
  p.rect(12, 7, 10, 2, "#8a5a30");
  p.rect(2, 9, 10, 2, "#7fb4d4");
  p.rect(12, 9, 10, 2, "#e08a3c");
  for (const x of [3, 19]) {
    p.rect(x, 1, 2, 10, R.iron);
    p.rect(x, 1, 1, 10, R.steel);
  }
  for (const x of [3, 4, 8, 9, 10, 14, 15, 18, 19, 20]) p.px(x, 1, R.frost);
  p.px(6, 2, R.frost);
  p.px(16, 2, R.frost);
  // The body, its mouth full of light.
  body(p, 14);
  p.rect(0, 11, 24, 3, C.ink);
  p.rect(1, 12, 11, 2, R.ice);
  p.rect(12, 12, 11, 2, R.ember);
  p.rect(5, 12, 14, 1, "#fff6dc");
  p.rect(1, 11, 22, 1, R.iron);
  for (const x of [3, 4, 19, 20]) p.px(x, 11, R.steel);
  p.px(1, 12, R.frost);
  p.px(22, 12, R.frost);
  // The beam rising out: cold on the left, warm on the right, white where they meet.
  p.rect(5, 9, 7, 2, "rgba(190, 232, 255, 0.7)");
  p.rect(12, 9, 7, 2, "rgba(255, 190, 100, 0.7)");
  p.rect(10, 9, 4, 2, "rgba(255, 250, 235, 0.85)");
  p.rect(8, 8, 8, 1, "rgba(255, 240, 220, 0.55)");
  if (frame === 0) {
    // A breath of frost, puffing up out of the chest.
    p.rect(9, 5, 6, 2, "rgba(236, 248, 255, 0.85)");
    p.rect(7, 6, 10, 1, "rgba(236, 248, 255, 0.7)");
    p.rect(10, 3, 4, 1, "rgba(236, 248, 255, 0.6)");
    p.px(5, 4, R.frost);
    p.px(18, 3, R.frost);
    p.px(20, 8, R.frost);
  } else {
    // Ember sparks, flying up.
    const sparks: [number, number, string][] = [
      [13, 3, R.ember],
      [16, 5, "#ffd36a"],
      [11, 6, "#ffd36a"],
      [18, 8, R.ember],
      [14, 8, "#ffe9a0"],
      [8, 4, R.frost],
      [6, 7, R.frost],
    ];
    for (const [x, y, c] of sparks) p.px(x, y, c);
    p.px(15, 4, R.emberDark);
    p.px(12, 5, R.emberDark);
  }
}

function drawKey(p: Pen): void {
  // The leather thong through the hole, up top.
  p.rect(6, 0, 4, 1, C.ink);
  p.rect(5, 1, 1, 3, C.ink);
  p.rect(10, 1, 1, 3, C.ink);
  p.rect(6, 1, 1, 3, R.thong);
  p.rect(9, 1, 1, 3, R.thong);
  p.px(6, 2, R.thongDark);
  p.px(9, 3, R.thongDark);
  // The coin: ink ring, silver face, a darker inner ring, a highlight and a shaded edge.
  p.disc(8, 9, 7, C.ink);
  p.disc(8, 9, 6, R.silver);
  p.disc(8, 9, 5, R.silverDark);
  p.disc(8, 9, 4, R.silver);
  p.px(4, 6, "#ffffff");
  p.px(5, 5, "#ffffff");
  p.px(6, 4, "#ffffff");
  p.px(3, 8, "#ffffff");
  p.px(12, 13, R.silverDark);
  p.px(11, 14, R.silverDark);
  // The hole it hangs by.
  p.rect(7, 5, 2, 2, C.ink);
  p.px(7, 5, R.iron);
  // The raven stamp: a tiny bird, wings folded.
  p.grid(["..dd..", ".dddd.", "dddddd", ".dd.d.", "......"], { d: R.iron }, 5, 7);
  p.px(9, 8, R.silverDark);
  // The thong's end below: a knot, a bone bead, two tails.
  p.rect(7, 16, 2, 1, C.ink);
  p.rect(6, 17, 4, 3, C.ink);
  p.rect(7, 17, 2, 2, R.bone);
  p.px(7, 17, "#ffffff");
  p.rect(5, 19, 6, 5, C.ink);
  p.rect(6, 20, 4, 4, R.thong);
  p.rect(6, 19, 4, 1, R.thongDark);
  p.px(7, 21, R.thongDark);
  p.px(9, 22, R.thongDark);
  p.px(8, 20, R.oakLight);
  p.px(6, 23, R.thongDark);
  p.px(9, 23, R.thongDark);
}

/** Draws Ragnarok Eve's `kind` into `p` (the same canvas sizes as the Night Market's). */
export function drawRagnarokBox(p: Pen, kind: "closed" | "open" | "key", frame: number): void {
  if (kind === "closed") drawClosed(p);
  else if (kind === "open") drawOpen(p, frame);
  else drawKey(p);
}

// The opening screen's pointer: a raven perched over the strip's marker, facing right. 6x6.
// prettier-ignore
const POINTER = [
  "...vk.",
  "..kkwb",
  ".vkkk.",
  "vkkkk.",
  "kkkk..",
  "..y.y.",
];

/** The raven that hops along the top of the Ragnarok Eve opening strip (`CaseOpening.tsx`). Cached: do not draw into it. */
export const ravenPointer = once(() =>
  bake(6, 6, (p) => p.grid(POINTER, { v: "#6a6296", k: R.raven, w: R.bone, b: R.gold, y: R.emberDark })),
);
