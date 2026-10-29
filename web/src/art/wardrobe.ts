import type { Item } from "@tokenmaxxing/core/shop.ts";
import type { Look } from "@tokenmaxxing/core/world.ts";
import { typedSwitch } from "hanzio";
import { CASE_BACKS, CASE_HELD, CASE_OUTFITS } from "./case-body.ts";
import { RAGNAROK_BACKS, RAGNAROK_HELD, RAGNAROK_OUTFITS } from "./case-ragnarok-body.ts";
import type { Pose, View } from "./characters.ts";
import { FISHING_BACKS, FISHING_HELD } from "./fishing-loot.ts";
import { C } from "./palette.ts";
import { bake, type Palette, type Pen } from "./pixels.ts";

/**
 * Art for the wardrobe (core/src/wardrobe.ts): outfits from 13 on, things held in the hand, things
 * on the back, and pet gear. Characters are 16×16 (see characters.ts: the head is rows 0–8, the body
 * rows 9–15, hands at x 4 and 11 facing down, x 8 facing right); pets are 12×10 facing right.
 */

/** When a layer goes on: before the body, right after it (outfit details), or over everything. */
type Layer = "behind" | "body" | "front";

// MARK: Outfits

export interface Outfit {
  /** Outfit, its shade, trousers. */
  c: string;
  C: string;
  p: string;
  /** Details over the top of the body (rows 9–11), like the server-rack armour. */
  marks: Record<View, string[]>;
  pal: Palette;
}

// Pixel art reads as a grid.
// prettier-ignore
const OUTFITS: Record<number, Outfit> = {
  // Hoodie of infinite context: a glowing ∞ on the chest, the hood down the back.
  13: {
    c: "#3b2f6b", C: "#2a2150", p: "#22223a",
    marks: {
      down: ["......i.i.......", ".....i.i.i......", "......i.i......."],
      side: [".......i.i......", "......i.i.i.....", "................"],
      up: [".....HHHHHH.....", "......HHHH......", "................"],
    },
    pal: { i: "#7fe8ff", H: "#4a3d82" },
  },
  // Rain jacket: Copenhagen yellow, a zip and the hood's drawstrings.
  14: {
    c: "#f2c230", C: "#c99a1a", p: "#2f3444",
    marks: {
      down: [".....w.zw.......", ".......z........", ".......z........"],
      side: ["........zw......", ".........z......", "................"],
      up: ["....oCCCCCCo....", ".....CCCCCC.....", "................"],
    },
    pal: { z: "#8a6a10", w: "#f4efe4", C: "#c99a1a", o: C.ink },
  },
  // Lab coat: open over a blue shirt, a red pen in the pocket.
  15: {
    c: "#f4f4f0", C: "#cfd3d6", p: "#3d4a6b",
    marks: {
      down: [".......bb.......", ".....r.bb.......", ".....k.b........"],
      side: ".........b......|........rb......|................".split("|"),
      up: ["................", "......cccc......", "................"],
    },
    pal: { b: "#6fa8dc", r: "#e0584f", k: "#3a3f4b", c: "#e2e4e2" },
  },
  // Flannel: red checks.
  16: {
    c: "#c43b3b", C: "#8a2424", p: "#3d4a6b",
    marks: {
      down: ["......k..k......", "...okKkkKkko....", "......k..k......"],
      side: [".......k..k.....", "....okKkkKk.....", ".......k........"],
      up: ["......k..k......", "...okKkkKkko....", "......k..k......"],
    },
    pal: { k: "#8a2424", K: "#4a1214", o: C.ink },
  },
  // Founder vest: grey fleece over a blue shirt, a tiny logo.
  17: {
    c: "#8a8f99", C: "#5f646d", p: "#c9b48a",
    marks: {
      down: [".......bb.......", "....bl.bb...b...", "...........b...."],
      side: [".........b......", ".....b...b......", "................"],
      up: ["................", "....b......b....", "................"],
    },
    pal: { b: "#7fb0e6", l: "#f4f1ea" },
  },
  // Merge-conflict sweater: green knit, a red and white zigzag, <<< on the chest.
  18: {
    c: "#2f8f4e", C: "#1f6a38", p: "#2f3444",
    marks: {
      down: [".....w.w.w......", "....rwrwrwrw....", "................"],
      side: [".......w.w......", ".....rwrwrw.....", "................"],
      up: ["................", "....rwrwrwrw....", "................"],
    },
    pal: { r: "#e0584f", w: "#f4efe4" },
  },
  // Tuxedo: a white shirt and a red bow tie.
  19: {
    c: "#24242c", C: "#15151b", p: "#15151b",
    marks: {
      down: ["......rRRr......", ".......ww.......", ".......ww......."],
      side: [".........rR.....", ".........w......", "................"],
      up: ["................", "................", "................"],
    },
    pal: { r: "#e0584f", R: "#a82a2a", w: "#f4f4f0" },
  },
  // Space suit: an orange collar ring and a panel of lights.
  20: {
    c: "#eef0f4", C: "#b8bec8", p: "#d9dde3",
    marks: {
      down: ["....oOOOOOOo....", "......kgrk......", "................"],
      side: [".....oOOOOo.....", ".........kg.....", "................"],
      up: ["....oOOOOOOo....", ".....mmmmmm.....", ".....mmmmmm....."],
    },
    pal: { O: "#f08a3c", k: "#3a3f4b", g: "#3ddc84", r: "#e0584f", m: "#9aa3b0", o: C.ink },
  },
  // Retro tracksuit: teal, white stripes down the sleeves, a white collar.
  21: {
    c: "#2fa39a", C: "#1f7a73", p: "#2fa39a",
    marks: {
      down: [".....w..w.......", "....w......w....", "................"],
      side: ["......w.........", "......w.........", "......w........."],
      up: ["................", "....w......w....", "................"],
    },
    pal: { w: "#f4f4f0" },
  },
  // Denim overalls over a white tee, two brass buttons.
  22: {
    c: "#f2f0ea", C: "#cfcac0", p: "#3f6fb0",
    marks: {
      down: [".....d....d.....", ".....ydddyd.....", ".....dddddd....."],
      side: [".......d.d......", ".......ddd......", ".......dd......."],
      up: [".....d....d.....", "......dddd......", ".....dddddd....."],
    },
    pal: { d: "#3f6fb0", y: "#f5c842" },
  },
  // Prompt wizard robe: deep blue with gold stars, long enough to hide the trousers.
  23: {
    c: "#3a4fb8", C: "#28388a", p: "#3a4fb8",
    marks: {
      down: [".....y..........", "..........y.....", ".......y........"],
      side: [".......y........", "..........y.....", "......y........."],
      up: ["......y.........", ".........y......", ".....y......y..."],
    },
    pal: { y: "#f5d14a" },
  },
  // Hazard vest: orange with silver reflective strips.
  24: {
    c: "#f28a1e", C: "#c96a10", p: "#3d4a6b",
    marks: {
      down: [".....s....s.....", "....ssssssss....", "................"],
      side: ["......s...s.....", ".....ssssss.....", "................"],
      up: [".....s....s.....", "....ssssssss....", "................"],
    },
    pal: { s: "#e8eef2" },
  },
  // Golden regalia (level 50): an ermine collar, a ruby brooch and a purple sash with a gold buckle.
  25: {
    c: "#ffd54a", C: "#d99a16", p: "#7a4fb8",
    marks: {
      down: [".....wkwwkw.....", "....d..rr..d....", ".....mmymm......"],
      side: ["......wkww......", "..........r.....", ".....mmm..m....."],
      up: [".....wkwwkw.....", "....d......d....", ".....mmmmmm....."],
    },
    pal: { w: "#fbf7ef", k: C.ink, d: "#b07a12", r: "#e0405a", y: "#fff1a8", m: "#7a4fb8" },
  },
};

/** A wardrobe outfit's colours, to spread over a look's palette; nothing for the others. */
export const wardrobePalette = (outfit: number): Palette => {
  const o = OUTFITS[outfit];
  return o ? { c: o.c, C: o.C, p: o.p } : {};
};

/** An outfit's details, at row `oy` (9 on a character, 0 in the bag). */
export function outfitMarks(p: Pen, outfit: number, view: View, oy: number, flip = false): void {
  const o = OUTFITS[outfit];
  if (o) p.grid(o.marks[view], o.pal, 0, oy, flip);
}

// MARK: In the hand

export interface Held {
  /** Facing right, `h` the hand holding it: it lands on the character's hand. */
  rows: string[];
  pal: Palette;
}

// Pixel art reads as a grid.
// prettier-ignore
const HELD: (Held | null)[] = [
  null,
  // Coffee mug, steaming.
  {
    rows: ["...s.s", "..oooo", ".howwo", "..orwo", "..oooo"],
    pal: { o: C.ink, w: "#f4efe4", r: "#e0584f", s: "#d8dde3" },
  },
  // Rubber duck.
  {
    rows: ["...yy.", "...yen", ".hyyy.", "..yyyy", "..oooo"],
    pal: { o: C.ink, y: "#f5d14a", e: C.ink, n: "#f08a3c" },
  },
  // Laptop with stickers, held flat against the hip.
  {
    rows: ["..ooooo", ".hlrlbo", "..lylpo", "..ooooo"],
    pal: { o: C.ink, l: "#aab3bf", r: "#e0584f", b: "#4f8fe0", y: "#f5c842", p: "#3ddc84" },
  },
  // Bubble tea: a fat straw, tea, pearls at the bottom.
  {
    rows: ["....k.", "..ooko", ".hotto", "..otto", "..obbo", "..oooo"],
    pal: { o: C.ink, k: "#e86bd8", t: "#d9a46a", b: "#3a2e2a" },
  },
  // Mechanical keyboard: rainbow caps.
  {
    rows: ["ooooooo", "owhgwbo", "ooooooo"],
    pal: { o: C.ink, w: "#f4efe4", g: "#3ddc84", b: "#4f8fe0" },
  },
  // Pizza slice, held by the crust.
  {
    rows: [".hcccc", "..yryo", "..yyo.", "...o.."],
    pal: { o: "#c9971f", c: "#c98e3c", y: "#f5d14a", r: "#e0584f" },
  },
  // Energy drink: green can, lightning bolt.
  {
    rows: ["..mmm", "..gyo", ".hgyo", "..ygo", "..mmm"],
    pal: { o: "#1f6a38", m: "#aab3bf", g: "#3ddc84", y: "#f5f542" },
  },
  // Magnifying glass, raised.
  {
    rows: ["...oo.", "..olwo", "..ollo", "...oo.", "..b...", ".h...."],
    pal: { o: "#5a3a1e", l: "#a8d8f0", w: "#f4f4f0", b: "#7a4f2c" },
  },
  // Fire extinguisher: red tank, black hose and nozzle.
  {
    rows: ["..kkk.", ".hkrr.", "..rrrk", "..rwrk", "..rrr.", "..ooo."],
    pal: { o: "#8a2424", k: C.ink, r: "#e0473f", w: "#f4f4f0" },
  },
  // Baguette, over the shoulder.
  {
    rows: ["....oB", "...obB", "..obB.", ".obB..", ".hB..."],
    pal: { o: "#a86e2a", b: "#e8b464", B: "#c98e3c" },
  },
];

/** Where the hand is in each view (none from behind: the item is drawn behind the body there). */
const HAND: Record<View, [number, number]> = { down: [11, 11], side: [8, 11], up: [11, 11] };

function drawHeld(p: Pen, i: number, view: View, skin: string, flip: boolean): void {
  const h = HELD[i];
  if (!h) return;
  const hy = h.rows.findIndex((r) => r.includes("h"));
  const hx = h.rows[hy]!.indexOf("h");
  const [x, y] = HAND[view];
  // Padded to 16 wide so the side view mirrors like the rest of the character.
  const rows = h.rows.map((r) => ".".repeat(x - hx) + r + ".".repeat(Math.max(0, 16 - (x - hx) - r.length)));
  p.grid(rows, { ...h.pal, h: skin }, 0, y - hy, flip);
}

// MARK: On the back

/** One view of a back item: drawn behind the body, and over it. */
export interface BackView {
  behind?: string[];
  front?: string[];
}
export interface Back {
  /** By view; `walk` is the second walking frame (a flutter, a flame), if it differs. */
  views: Record<View, BackView>;
  walk?: Partial<Record<View, BackView>>;
  pal: Palette;
}

// Rows are full 16×16 frames, top row first; `.` is nothing.
// Pixel art reads as a grid.
// prettier-ignore
const BACKS: (Back | null)[] = [
  null,
  // Cape: red with a gold clasp at each shoulder, swaying when walking.
  {
    views: {
      down: {
        behind: [
          "", "", "", "", "", "", "", "",
          "................",
          "...oo......oo...",
          "..orr......rro..",
          "..orR......Rro..",
          "..orR......Rro..",
          "..orr......rro..",
          "...orrRrrRrro...",
          "....oooooooo....",
        ],
        front: ["", "", "", "", "", "", "", "", "", ".....y....y....."],
      },
      side: {
        behind: [
          "", "", "", "", "", "", "", "",
          "................",
          ".....o..........",
          "....or..........",
          "...orr..........",
          "..orrR..........",
          "..orrR..........",
          ".orrrR..........",
          ".ooooo..........",
        ],
        front: ["", "", "", "", "", "", "", "", "", "......y........."],
      },
      up: {
        front: [
          "", "", "", "", "", "", "", "",
          "....oooooooo....",
          "....orrrrrro....",
          "...orrRrrRrro...",
          "...orrRrrRrro...",
          "...orrRrrRrro...",
          "...orrRrrRrro...",
          "...orrrrrrrro...",
          "....oooooooo....",
        ],
      },
    },
    walk: {
      side: {
        behind: [
          "", "", "", "", "", "", "", "",
          "................",
          ".....o..........",
          "...oor..........",
          "..orrr..........",
          ".orrrR..........",
          "orrrrR..........",
          "ooorrR..........",
          "...ooo..........",
        ],
        front: ["", "", "", "", "", "", "", "", "", "......y........."],
      },
    },
    pal: { o: C.ink, r: "#d23c3c", R: "#962626", y: "#f5c842" },
  },
  // Jetpack: twin silver tanks with red caps; flames while walking.
  {
    views: {
      down: {
        behind: [
          "", "", "", "", "", "", "", "",
          ".orro......orro.",
          ".ommo......ommo.",
          ".omMo......oMmo.",
          ".omMo......oMmo.",
          ".oooo......oooo.",
        ],
        front: ["", "", "", "", "", "", "", "", "", ".....k....k.....", ".....k....k....."],
      },
      side: {
        behind: [
          "", "", "", "", "", "", "", "",
          ".orro...........",
          ".ommo...........",
          ".omMo...........",
          ".omMo...........",
          ".oooo...........",
        ],
        front: ["", "", "", "", "", "", "", "", "", "......k.........", "......k........."],
      },
      up: {
        front: [
          "", "", "", "", "", "", "", "",
          "....orro.orro...",
          "....ommoomMo....",
          "....omMoomMo....",
          "....omMoomMo....",
          "....oooooooo....",
        ],
      },
    },
    walk: {
      down: {
        behind: [
          "", "", "", "", "", "", "", "",
          ".orro......orro.",
          ".ommo......ommo.",
          ".omMo......oMmo.",
          ".omMo......oMmo.",
          ".oooo......oooo.",
          "..yy........yy..",
          "..fy........yf..",
          "...f........f...",
        ],
        front: ["", "", "", "", "", "", "", "", "", ".....k....k.....", ".....k....k....."],
      },
      side: {
        behind: [
          "", "", "", "", "", "", "", "",
          ".orro...........",
          ".ommo...........",
          ".omMo...........",
          ".omMo...........",
          ".oooo...........",
          "..yy............",
          ".fyf............",
          "..f.............",
        ],
        front: ["", "", "", "", "", "", "", "", "", "......k.........", "......k........."],
      },
      up: {
        front: [
          "", "", "", "", "", "", "", "",
          "....orro.orro...",
          "....ommoomMo....",
          "....omMoomMo....",
          "....omMoomMo....",
          "....oooooooo....",
          ".....yy..yy.....",
          ".....fy..yf.....",
          "......f..f......",
        ],
      },
    },
    pal: { o: C.ink, m: "#c4ccd6", M: "#7c8592", r: "#e0473f", k: "#3a3f4b", y: "#ffd84a", f: "#ff8a3c" },
  },
  // Backpack: blue with a pocket; only the straps show from the front.
  {
    views: {
      down: { front: ["", "", "", "", "", "", "", "", "", ".....B....B.....", ".....B....B....."] },
      side: {
        behind: [
          "", "", "", "", "", "", "", "", "",
          "..ooo...........",
          ".obbbo..........",
          ".obBbo..........",
          ".obBbo..........",
          "..ooo...........",
        ],
        front: ["", "", "", "", "", "", "", "", "", "......B.........", "......B........."],
      },
      up: {
        front: [
          "", "", "", "", "", "", "", "", "",
          ".....oooooo.....",
          "....obbbbbbo....",
          "....obBBBBbo....",
          "....obByBBbo....",
          ".....oooooo.....",
        ],
      },
    },
    pal: { o: C.ink, b: "#4f8fe0", B: "#2f5aa0", y: "#f5c842" },
  },
  // Pixel wings: white feathers either side, a flap while walking.
  {
    views: {
      down: {
        behind: [
          "", "", "", "",
          "o..............o",
          "wo............ow",
          "wwo..........oww",
          "wWwo........owWw",
          "wWWwo......owWWw",
          "oWWwo......owWWo",
          ".oWwo......owWo.",
          "..oo........oo..",
        ],
      },
      side: {
        behind: [
          "", "", "", "",
          "o...............",
          "wo..............",
          "wwo.............",
          "wWwo............",
          "wWWwo...........",
          "oWWwo...........",
          ".oWwo...........",
          "..oo............",
        ],
      },
      up: {
        front: [
          "", "", "", "", "", "",
          "o..............o",
          "wo............ow",
          "wwo..........oww",
          "wWwo...oo...owWw",
          "wWWwoowwwwoowWWw",
          "oWWwwwWWWWwwwWWo",
          ".oWwwoo..oowwWo.",
          "..oo........oo..",
        ],
      },
    },
    walk: {
      down: {
        behind: [
          "", "", "",
          "o..............o",
          "wo............ow",
          "wwo..........oww",
          "wWwo........owWw",
          "wWWwo......owWWw",
          "oWWwo......owWWo",
          ".oWwo......owWo.",
          "..oo........oo..",
        ],
      },
      side: {
        behind: [
          "", "", "",
          "o...............",
          "wo..............",
          "wwo.............",
          "wWwo............",
          "wWWwo...........",
          "oWWwo...........",
          ".oWwo...........",
          "..oo............",
        ],
      },
    },
    pal: { o: "#6f86a8", w: "#ffffff", W: "#cfe0f4" },
  },
  // Guitar, slung across the back: the neck shows over a shoulder.
  {
    views: {
      down: {
        behind: [
          "", "",
          ".............oo.",
          ".............no.",
          ".............n..",
          ".............n..",
          ".............n..",
          ".............n..",
          ".............n..",
          "............on..",
          "..oo............",
          ".oggo...........",
          ".oGgo...........",
          "..oo............",
        ],
      },
      side: {
        behind: [
          "", "",
          "..oo............",
          "..on............",
          "...n............",
          "...n............",
          "...n............",
          "...n............",
          "...n............",
          "..ooo...........",
          ".oggg...........",
          ".ogkg...........",
          ".oggg...........",
          "..ooo...........",
        ],
      },
      up: {
        front: [
          "", "",
          ".............oo.",
          ".............no.",
          ".............n..",
          "............n...",
          "............n...",
          "...........n....",
          "..........n.....",
          ".........n......",
          ".....ooon.......",
          "....oggggo......",
          "....ogkkGo......",
          "....oggGGo......",
          ".....oooo.......",
        ],
      },
    },
    pal: { o: C.ink, g: "#d9832e", G: "#a85e1c", k: "#3a2e2a", n: "#6b4226" },
  },
  // Yoga mat, rolled across the back: the ends show either side.
  {
    views: {
      down: {
        behind: [
          "", "", "", "", "", "", "", "", "",
          "oooo........oooo",
          "eppp........pppe",
          "oooo........oooo",
        ],
      },
      side: {
        behind: [
          "", "", "", "", "", "", "", "",
          "..ooo...........",
          ".opppo..........",
          ".opeppo.........",
          ".opppo..........",
          "..ooo...........",
        ],
      },
      up: {
        front: [
          "", "", "", "", "", "", "", "", "",
          "oooooooooooooooo",
          "epppPpppppppPppe",
          "oooooooooooooooo",
        ],
      },
    },
    pal: { o: "#5a3f8a", p: "#9b6fd6", P: "#7852ad", e: "#d8c2f4" },
  },
  // Katana in its sheath: the hilt over the right shoulder.
  {
    views: {
      down: {
        behind: [
          "", "", "",
          "..............r.",
          ".............rr.",
          ".............y..",
          "............yk..",
          "............k...",
          "............k...",
          "", "", "", "",
          "...k............",
          "...k............",
        ],
      },
      side: {
        behind: [
          "", "", "",
          ".r..............",
          ".rr.............",
          "..y.............",
          "..ky............",
          "...k............",
          "...k............",
          "....k...........",
          "....k...........",
          "....k...........",
          ".....k..........",
          ".....k..........",
        ],
      },
      up: {
        front: [
          "", "", "",
          "..............r.",
          ".............rr.",
          ".............y..",
          "............yk..",
          "...........k....",
          "..........k.....",
          ".........k......",
          "........k.......",
          ".......k........",
          "......k.........",
          ".....k..........",
          "....k...........",
        ],
      },
    },
    pal: { k: "#2a2a35", r: "#c23a3a", y: "#f5c842" },
  },
];

// The cases (indices from `CASE_BASE` and `NUSANTARA_BASE`) live in `case-body.ts`; sparse slots, looked up by index like the rest.
Object.assign(OUTFITS, CASE_OUTFITS);
Object.assign(HELD, CASE_HELD);
Object.assign(BACKS, CASE_BACKS);
// Ragnarok Eve (`case-ragnarok-body.ts`, indices from `RAGNAROK_BASE`) is merged the same way.
Object.assign(OUTFITS, RAGNAROK_OUTFITS);
Object.assign(HELD, RAGNAROK_HELD);
Object.assign(BACKS, RAGNAROK_BACKS);
// The pond treasures (`fishing-loot.ts`, indices from `FISHING_BASE`) too.
Object.assign(HELD, FISHING_HELD);
Object.assign(BACKS, FISHING_BACKS);

function drawBack(p: Pen, i: number, view: View, pose: Pose, layer: "behind" | "front", flip: boolean): void {
  const b = BACKS[i];
  if (!b) return;
  const v = (pose === "walkB" && b.walk?.[view]) || b.views[view];
  const rows = v[layer];
  if (rows) p.grid(rows, b.pal, 0, 0, flip);
}

// MARK: On a character

/** Draws the look's wardrobe for one layer of a character frame (see `characterFrame`). */
export function drawWardrobe(
  p: Pen,
  look: Look,
  view: View,
  pose: Pose,
  layer: Layer,
  skin: string,
  flip: boolean,
): void {
  typedSwitch(layer, {
    body: () => outfitMarks(p, look.outfit, view, 9, flip),
    // From behind, a held thing peeks out behind the body; otherwise it's in front, over the back item's straps.
    behind: () => {
      if (view === "up") drawHeld(p, look.held, view, skin, flip);
      drawBack(p, look.back, view, pose, "behind", flip);
    },
    front: () => {
      drawBack(p, look.back, view, pose, "front", flip);
      if (view !== "up") drawHeld(p, look.held, view, skin, flip);
    },
  });
}

// MARK: On a pet

interface PetWear {
  /** At the neck (bandana, collar) or on top of the head (bow, hat). */
  at: "neck" | "top";
  rows: string[];
  pal: Palette;
}

// Pixel art reads as a grid.
// prettier-ignore
const PETWEAR: (PetWear | null)[] = [
  null,
  { at: "neck", rows: ["rrrr", ".rR."], pal: { r: "#d23c3c", R: "#962626" } },
  { at: "top", rows: ["p...p", "ppPpp", "p...p"], pal: { p: "#ff7fb0", P: "#c23a6b" } },
  { at: "neck", rows: ["b...b", "bbBbb", "b...b"], pal: { b: "#2a3a8a", B: "#f5c842" } },
  { at: "top", rows: [".w.", ".p.", "pyp"], pal: { w: "#f4f4f0", p: "#4f8fe0", y: "#f5d14a" } },
  { at: "neck", rows: ["yYyy", "..t."], pal: { y: "#f5c842", Y: "#c9971f", t: "#fff2a8" } },
  { at: "top", rows: ["yykyy", ".rgb."], pal: { y: "#f5d14a", k: C.ink, r: "#e0584f", g: "#3ddc84", b: "#4f8fe0" } },
  { at: "neck", rows: ["rwrw", "r...", "w..."], pal: { r: "#d23c3c", w: "#f4f1ea" } },
];

/** Room above a pet for a hat: its frame grows this much when it wears something. */
export const PET_HEADROOM = 3;

/**
 * Where gear goes on each pet (standing frame, facing right): the middle of the neck and the top of
 * the head, and how far the hop frame moves them (the dragon's head stays put).
 */
const PET_ANCHORS: { neck: [number, number]; top: [number, number]; hop: number }[] = [
  { neck: [0, 0], top: [0, 0], hop: 0 },
  { neck: [7, 5], top: [7, 1], hop: -1 }, // duck
  { neck: [8, 6], top: [8, 2], hop: -1 }, // cat
  { neck: [8, 6], top: [8, 1], hop: -1 }, // dog
  { neck: [8, 5], top: [9, 1], hop: 0 }, // dragon
  { neck: [8, 6], top: [8, 2], hop: -1 }, // panda
  { neck: [5, 7], top: [5, 1], hop: -1 }, // singularity orb
];

/** Pet gear `wear` on pet `pet`, in a frame `PET_HEADROOM` taller than the pet (facing right). */
export function drawPetwear(p: Pen, pet: number, wear: number, hop: boolean): void {
  const w = PETWEAR[wear];
  const a = PET_ANCHORS[pet];
  if (!w || !a) return;
  const [cx, y] = a[w.at];
  const top = w.at === "top" ? y - w.rows.length + 1 : y;
  p.grid(w.rows, w.pal, cx - Math.floor(w.rows[0]!.length / 2), PET_HEADROOM + top + (hop ? a.hop : 0));
}

// MARK: On its own

/** A held thing, back item or pet gear on its own, for the bag and the floor; null for anything else. */
export function wardrobeIcon(item: Item): HTMLCanvasElement | null {
  const { slot, index: i } = item;
  if (slot === "held" && HELD[i]) {
    const h = HELD[i]!;
    return bake(Math.max(...h.rows.map((r) => r.length)), h.rows.length, (p) => p.grid(h.rows, h.pal));
  }
  if (slot === "petwear" && PETWEAR[i]) {
    const w = PETWEAR[i]!;
    return bake(w.rows[0]!.length, w.rows.length, (p) => p.grid(w.rows, w.pal));
  }
  if (slot === "back" && BACKS[i]) {
    // The item as you'd see it from behind, cropped to what's drawn.
    const art = BACKS[i]!.views.up.front ?? [];
    const first = art.findIndex((r) => r.replaceAll(".", "") !== "");
    const rows = art.slice(first);
    return bake(16, rows.length, (p) => p.grid(rows, BACKS[i]!.pal));
  }
  return null;
}
