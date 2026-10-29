import { RAGNAROK_BASE } from "@tokenmaxxing/core/case-ragnarok.ts";
import type { Back, BackView, Held, Outfit } from "./wardrobe.ts";

/**
 * The Ragnarok Eve case's outfits, held things and back items in 2D (`core/src/case-ragnarok.ts`). Same shapes as
 * the Night Market's in `case-body.ts`; `wardrobe.ts` merges these in under their look indices (`RAGNAROK_BASE + n`).
 * Design: `docs/cases/ragnarok-eve.md`.
 */

const at = (n: number) => RAGNAROK_BASE + n;

// MARK: Outfits

// Marks sit over the body from row 9; a fourth row lands on the trousers' row (a hem, an apron).
// Pixel art reads as a grid.
// prettier-ignore
export const RAGNAROK_OUTFITS: Record<number, Outfit> = {
  // Wool tunic: brown-grey, a lace-up neck, a dark belt with a brass buckle and a hem over the trousers.
  [at(0)]: {
    c: "#8a7a68", C: "#6a5c4c", p: "#4a4034",
    marks: {
      down: [".......nn.......", ".......n........", ".....kkyykk.....", "....oTTTTTTo...."],
      side: ["........n.......", "........n.......", ".....kkkkky.....", ".....oTTTo......"],
      up: ["................", "................", ".....kkkkkk.....", "....oTTTTTTo...."],
    },
    pal: { n: "#e8dfc8", k: "#3a2a1e", y: "#e9b73d", T: "#8a7a68", o: "#2b2433" },
  },
  // Brewer's apron: a cream apron over brown, a mug mark and a gold stain on the bib, a rope tie at the waist.
  [at(1)]: {
    c: "#8a5a3a", C: "#6a4228", p: "#3e3a34",
    marks: {
      down: [".....a....a.....", ".....aamAga.....", ".....rrrrrr.....", "....oaagaaao...."],
      side: [".......a........", ".......aaa......", ".......rrr......", ".....oaao......."],
      up: [".....a....a.....", ".....a.aa.a.....", ".....rrrrrr.....", "....o.arra.o...."],
    },
    pal: { a: "#efe6d0", A: "#cdbf9c", m: "#7a5230", g: "#e0a82a", r: "#b89a5a", o: "#2b2433" },
  },
  // Yoke sweater: navy, with a cream yoke across the shoulders knitted with little snowflakes.
  [at(2)]: {
    c: "#2a3b6a", C: "#1c2a4e", p: "#3a3a48",
    marks: {
      down: ["....wwwwwwww....", "....wnwwnwwn....", "....wwnwwnww....", "....nnnnnnnn...."],
      side: ["....wwwww.......", "....wnwwn.......", ".....wnww.......", ".....nnnn......."],
      up: ["....wwwwwwww....", "....wnwwnwwn....", "....wwnwwnww....", "....nnnnnnnn...."],
    },
    pal: { w: "#efe9d8", n: "#2a3b6a" },
  },
  // Byrnie: grey mail in a fine dot hatch, a leather collar and an iron belt, a mail skirt.
  [at(3)]: {
    c: "#8b94a3", C: "#6a7382", p: "#4a4034",
    marks: {
      down: ["....d.llll.d....", ".....d.d.d.d....", ".....iiyyii.....", "....odcdcdcdo..."],
      side: ["......d.ll......", ".......d.d......", ".....iiiiy......", ".....odcdo......"],
      up: ["....d.d.d.d.....", ".....d.d.d.d....", ".....iiiiii.....", "....odcdcdcdo..."],
    },
    pal: { d: "#5a6374", l: "#6b4a2e", i: "#4a5160", y: "#e9b73d", c: "#aab3c3", o: "#2b2433" },
  },
  // Berserker bearskin: a shaggy brown pelt over the shoulders, the bear's head on one with its snout and ears, claws at the hands.
  [at(4)]: {
    c: "#6a4a30", C: "#4a3220", p: "#3a2c20",
    marks: {
      down: [".bb.fFfFfFfF....", "bbbbfFfffFf.....", "bkbnfff.ffFf....", "bwww.fFf.fFwww.."],
      side: ["...bb.fFfFf.....", "..bbbbfFfFf.....", "..bkbnfFfff.....", "..bwww.fFf......"],
      up: ["....fFfFfFfF....", "...fFfFfFfFfF...", "...fFfFFfFfFf...", "....FfFfFfFf...."],
    },
    pal: { b: "#7a5638", k: "#2b2433", n: "#2b2433", f: "#7a5638", F: "#4a3220", w: "#e8dfc8" },
  },
  // Valkyrie plate: a silver breastplate with a gold rim, a woad-blue sash across it, and a spear-tip over the shoulder.
  [at(5)]: {
    c: "#c9d1dc", C: "#8d97a8", p: "#3b4a70",
    marks: {
      down: ["....gwwwwwwg.s..", "....bbwwwwwg.s..", "....wbbwwwwg.s..", ".....wbbwwg....."],
      side: ["....gwwwwg......", "....wbbwwg......", ".....wbbwg......", "................"],
      up: ["....gwwwwwwg...s", "....wbbwwwwg..s.", "....wwbbwwwg.s..", "................"],
    },
    pal: { g: "#e9b73d", w: "#dfe5ee", b: "#3b6fb8", s: "#aab3c3" },
  },
};

// MARK: In the hand

// `h` is the hand: the item is placed so that it lands on the character's hand (and, past it, within 16 columns).
// Pixel art reads as a grid.
// prettier-ignore
export const RAGNAROK_HELD: Record<number, Held> = {
  // Drinking horn: a curved bone horn with an iron tip cap, gold foam at the mouth.
  [at(0)]: {
    rows: ["..fFf.", ".ogggo", ".owwwo", ".owwwo", "hwwwo.", ".owwo.", "..oio."],
    pal: { o: "#8a7f68", w: "#efe6d0", g: "#e9b73d", f: "#fff3c4", F: "#f0d880", i: "#4a5160" },
  },
  // Round shield: a disc painted in quarters of red, bone, woad and gold, a grey iron boss in the middle.
  [at(1)]: {
    rows: [".ooooo.", "orrrwwo", "orrrwwo", "osshsso", "obbbyyo", "obbbyyo", ".ooooo."],
    pal: { o: "#2b2433", r: "#a8322e", w: "#e8dfc8", b: "#3b6fb8", y: "#e9b73d", s: "#8a93a1" },
  },
  // Tafl board: a little 7×7 checker, a gold king in the middle and light and dark pegs.
  [at(2)]: {
    rows: ["ooooooo", "oDlDlDo", "olDwDlo", "oDwKwDo", "olDwDlo", "oDlDlDo", "oohoooo"],
    pal: { o: "#3f2a1a", D: "#6b4a2e", l: "#b8946a", w: "#efe6d0", K: "#e9b73d" },
  },
  // Bearded axe: an oak handle and a crescent iron head, the beard swept down.
  [at(3)]: {
    rows: ["..ss..", ".sSSs.", ".sSSSs", ".ssbSs", "..b.ss", "..b...", "..h...", "..b...", "..b..."],
    pal: { s: "#aab3c3", S: "#7a8394", b: "#8a5a2e" },
  },
  // Squeaky Mjölnir: a stubby grey foam hammer, a leather-wrapped handle, a pale squeak star. A toy.
  [at(4)]: {
    rows: [".ooooo.", "ogggGgo", "ogpgggo", "ogggGgo", ".ooboo.", "...b...", "..hB...", "...b...", "...o..."],
    pal: { o: "#4a5160", g: "#c9ced8", G: "#a2a9b6", p: "#fff6c4", b: "#8a5a2e", B: "#6a4228" },
  },
};

// MARK: On the back

/** An empty 16×16 frame, then `rows` dropped in at row `y`. */
const frameAt = (rows: string[], y: number): string[] => [...Array<string>(y).fill(""), ...rows];
/** `rows` shifted a column to the right, for a flap. */
const nudge = (rows: string[]): string[] => rows.map((r) => (r ? `.${r.slice(0, 15)}` : r));
const view = (front: string[]): BackView => ({ front });

// Fur mantle: a shaggy grey cape with a ragged hem, pinned with a gold brooch.
const MANTLE_DOWN = frameAt(
  [
    "................",
    "...oo......oo...",
    "..ofFo....oFfo..",
    "..oFfl....lfFo..",
    "..ofFl....lFfo..",
    "..olfF....Ffo...",
    "...ofFlFfFlFfo..",
    "....o.oo.oo.o...",
  ],
  8,
);
const MANTLE_SIDE = frameAt(
  [
    "................",
    ".....o..........",
    "....of..........",
    "...ofF..........",
    "..ofFl..........",
    "..oFfl..........",
    ".ofFlf..........",
    ".o.oo.o.........",
  ],
  8,
);
const MANTLE_UP = frameAt(
  [
    "....oooooooo....",
    "....offfFffo....",
    "...ofFfflffFo...",
    "...offFfffFfo...",
    "...oFfflfFffo...",
    "...offFfffffo...",
    "...ofFfflFffo...",
    "....o.oo.oo.o...",
  ],
  8,
);

// Skíðblaðnir: a small ship folded on the back, a pleated striped sail lying along the hull with its fold lines
// showing, a dragon prow at each end. The sail's tip flaps on the walking frame.
const SHIP_UP = frameAt(
  [
    "......mm........",
    "....rwrwrwrw....",
    "....rwrwrwrw....",
    "....FFFFFFFF....",
    ".d.oBBBBBBBBo.d.",
    ".dooBBbBBbBBood.",
    "..ddoBBBBBBodd..",
    "....oooooooo....",
  ],
  8,
);
const SHIP_UP_B = frameAt(
  [
    ".......mm.......",
    "....wrwrwrwr....",
    "....wrwrwrwr....",
    "....FFFFFFFF....",
    ".d.oBBBBBBBBo.d.",
    ".dooBBbBBbBBood.",
    "..ddoBBBBBBodd..",
    "....oooooooo....",
  ],
  8,
);
const SHIP_SIDE = frameAt(
  [
    "................",
    "..mm............",
    ".rwrw...........",
    ".rwrw...........",
    ".FFFF...........",
    "doBBBBo.........",
    ".odBBbBo........",
    "..ooooo.........",
  ],
  8,
);
const SHIP_SIDE_B = nudge(SHIP_SIDE);
const SHIP_DOWN = frameAt([".d..........d...", "..d........d...."], 9);

// Pixel art reads as a grid.
// prettier-ignore
export const RAGNAROK_BACKS: Record<number, Back> = {
  // Fur mantle: grey shaggy fur hanging off both shoulders, pinned at the throat with a gold brooch.
  [at(0)]: {
    views: {
      down: { behind: MANTLE_DOWN, front: frameAt(["....fFfyyfFf...."], 9) },
      side: { behind: MANTLE_SIDE, front: frameAt([".....fFfy......."], 9) },
      up: view(MANTLE_UP),
    },
    pal: { o: "#2b2433", f: "#9aa3ad", F: "#6f7884", l: "#d3dae0", y: "#e9b73d" },
  },
  // Skíðblaðnir: the ship folded on the back, straps showing from the front, its sail flapping as they walk.
  [at(1)]: {
    views: {
      down: { front: SHIP_DOWN },
      side: { behind: SHIP_SIDE },
      up: view(SHIP_UP),
    },
    walk: { side: { behind: SHIP_SIDE_B }, up: view(SHIP_UP_B) },
    pal: { o: "#2b2433", m: "#7a5230", r: "#a8322e", w: "#efe6d0", F: "#b8a98a", B: "#6b4a2e", b: "#3f2a1a", d: "#e9b73d", k: "#4a3219" },
  },
};
