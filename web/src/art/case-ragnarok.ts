import type { Art } from "./editions.ts";
import { C } from "./palette.ts";

/**
 * The Ragnarok Eve case's hats and glasses (`core/src/case-ragnarok.ts`, indices 500 up), drawn like the Night
 * Market's (`case.ts`, which merges these in): hats over the head from row 0, glasses over the eyes from row 5.
 * A grid per view; a missing side or back view is the front one. Keyed by item id. Design: `docs/cases/ragnarok-eve.md`.
 */

const o = C.ink;

// Pixel art reads as a grid.
// prettier-ignore
export const RAGNAROK_HATS: Record<string, Art> = {
  // Fur hood: a rounded wolf-grey cap with a pale fringe over the brow and darker ear bumps at the sides.
  "hat.500": {
    down: [
      "...oo......oo...",
      "..oFFooooooFFo..",
      "..oFffllffllFo..",
      "..offfffffffffo.",
      "..oflflflflflfo.",
      "...ol......lo...",
      "...oF......Fo...",
    ],
    side: [
      "..oo............",
      ".oFFooooooo.....",
      ".oFfffllfffoo...",
      ".offfffffffffo..",
      ".oFfffflflflflo.",
      "..ofF......lo...",
      "...oF...........",
    ],
    up: [
      "...oo......oo...",
      "..oFFooooooFFo..",
      "..oFffffffffFo..",
      "..offfFfffFffo..",
      "..oFfffFfffFfo..",
      "..oFfffffffffo..",
      "...ooFfffffFoo..",
    ],
    pal: { o, f: "#9aa3ad", F: "#6f7884", l: "#d3dae0" },
  },
  // Nasal helm: a plain iron dome with a rivet band and a bar down the nose. No horns.
  "hat.501": {
    down: [
      ".....oooooo.....",
      "...oossssSSoo...",
      "..ossSSSSSSSso..",
      "..odRdRdRdRdRo..",
      "..oSSSSnnSSSSo..",
      "...oS.onno.So...",
      "......onno......",
      ".......oo.......",
    ],
    side: [
      ".....oooooo.....",
      "...oossssSSoo...",
      "..osssSSSSSSso..",
      "..odRdRdRdRdRo..",
      "..oSSSSSSSSSSSo.",
      "............onn.",
      "............onn.",
      ".............oo.",
    ],
    up: [
      ".....oooooo.....",
      "...oossssSSoo...",
      "..ossSSSSSSSso..",
      "..odRdRdRdRdRo..",
      "..oSSSSSSSSSSo..",
      "...oSSSSSSSSo...",
    ],
    pal: { o, s: "#aab3c3", S: "#7a8394", d: "#555e6e", R: "#e8dfc8", n: "#8f98a9" },
  },
  // Beaded braids: a leather headband and three plaits, one over each shoulder and one down the back, an ember or gold bead on each.
  "hat.502": {
    down: [
      "................",
      "................",
      "................",
      "...kkkkkkkkkk...",
      "obB..........Bbo",
      "oBb..........bBo",
      "obB..........Bbo",
      "oBb..........bBo",
      "obB..........Bbo",
      ".oy..........yo.",
      ".oe..........go.",
    ],
    side: [
      "................",
      "................",
      "................",
      "...kkkkkkkkkk...",
      "..obB...........",
      "..oBb...........",
      "..obB...........",
      "..oBb...........",
      "..obB...........",
      "...oy...........",
      "...oe...........",
    ],
    up: [
      "................",
      "................",
      "................",
      "...kkkkkkkkkk...",
      "obB..........Bbo",
      "oBb..........bBo",
      "obB...obBo...Bbo",
      "oBb...oBbo...bBo",
      "obB...obBo...Bbo",
      ".oy...oBbo...yo.",
      ".oe...oyo....go.",
      ".......oe.......",
    ],
    pal: { o, b: "#b8702e", B: "#8a4c1e", k: "#6b4a2e", y: "#a8782a", e: "#ff9a3c", g: "#e9b73d" },
  },
  // Opera horns: an iron cap with huge curved bone horns. A costume: nobody's real helmet had them.
  "hat.503": {
    down: [
      "ow............wo",
      "oww..oooooo..wwo",
      ".owwoossSSoowwo.",
      "..owoSsSSSsowo..",
      "...ooSSSSSSoo...",
      "....oSSSSSSo....",
    ],
    side: [
      ".....oww........",
      "....owwwo.......",
      "....owwoooo.....",
      "...owwoossoo....",
      "...ooSSSSSSSo...",
      "....oSSSSSSSo...",
    ],
    up: [
      "ow............wo",
      "oww..oooooo..wwo",
      ".owwoossSSoowwo.",
      "..owoSsSSSsowo..",
      "...ooSSSSSSoo...",
      "....oSSSSSSo....",
    ],
    pal: { o, w: "#f0e8d2", s: "#aab3c3", S: "#7a8394" },
  },
};

// Pixel art reads as a grid.
// prettier-ignore
export const RAGNAROK_GLASSES: Record<string, Art> = {
  // Warpaint stripes: a woad-blue slash across each eye, and a second thinner one under it.
  "glasses.500": {
    down: ["...bb......bb...", "....bb....bb....", ".....bb..bb....."],
    side: ["........bb......", ".........bb.....", "..........bb...."],
    pal: { b: "#3b6fb8" },
  },
  // Frosted specs: round lenses rimed white, a few sparkles of ice.
  "glasses.501": {
    down: ["..wffff..ffffw..", "...f..ffff..f...", "...ffff..ffff.w."],
    side: ["........fffff...", "......ffff...f..", "........fffff.w."],
    pal: { f: "#dff1f8", w: "#ffffff" },
  },
  // Mimir's lens: one round lens on a leather strap, a faint shimmer of well-water.
  "glasses.502": {
    down: ["...kkkkkkggg....", "........gqqqg...", ".........ggg...."],
    side: ["...kkkkkkkggg...", "........gqqqg...", ".........ggg...."],
    pal: { k: "#6b4a2e", g: "#c9a24a", q: "rgba(120, 190, 255, 0.4)" },
  },
};
