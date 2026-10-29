import { FISHING_BASE } from "@tokenmaxxing/core/fishing-loot.ts";
import type { Art } from "./editions.ts";
import { C } from "./palette.ts";
import type { Back, BackView, Held } from "./wardrobe.ts";

/**
 * The pond treasures' hat, held thing and back item in 2D (`core/src/fishing-loot.ts`, only fishing turns them up).
 * Same shapes as the cases' (`case.ts`, `case-ragnarok-body.ts`): the hat is keyed by item id and merged into
 * `CASE_HATS`, the rod and the tackle box by look index (`FISHING_BASE + n`) and merged into `wardrobe.ts`'s tables.
 * The pets are in `fishing-loot-pets.ts` and the aura in `fishing-loot-aura.ts`.
 */

const o = C.ink;
const at = (n: number) => FISHING_BASE + n;

// Pixel art reads as a grid.
// prettier-ignore
export const FISHING_HATS: Record<string, Art> = {
  // Lucky lure hat: an olive bucket hat with a soft sloping brim and a dark band, flies and lures hooked all round
  // it (red, blue, yellow, green, pink, orange), two more dangling off the brim on silver hooks.
  "hat.600": {
    down: [
      ".....oooooo.....",
      "....okkkkkko....",
      "...oRkUkYkGko...",
      "...oBPBOBPBUo...",
      ".obbbbbbbbbbbbo.",
      "..P..........O..",
      "..s..........s..",
    ],
    side: [
      ".....oooooo.....",
      "....okkkkkKo....",
      "...okRkUkkYko...",
      "...oBBPBOBBBo...",
      "..obbbbbbbbbbbbo",
      "...P............",
      "...s............",
    ],
    up: [
      ".....oooooo.....",
      "....okkkkkKo....",
      "...okkkRkkUko...",
      "...oBBBBPBBBo...",
      ".obbbbbbbbbbbbo.",
    ],
    pal: { o, k: "#b3ad5c", K: "#8d8846", B: "#4f5528", b: "#8f8a48", R: "#e0473f", U: "#4f8fe0", G: "#3ddc84", Y: "#ffd84a", P: "#ff7ab8", O: "#ff8a3c", s: "#dfe6ee" },
  },
};

// MARK: In the hand

// Pixel art reads as a grid.
// prettier-ignore
export const FISHING_HELD: Record<number, Held> = {
  // Golden rod: a slim gold rod bending up to the right, a dark gold reel by the hand, cork grip, a thin line
  // hanging from the tip with a red and white bobber.
  [at(0)]: {
    rows: [
      "....yw",
      "...y.w",
      "...g.w",
      "..y..w",
      "..g..r",
      ".y...W",
      ".gdd..",
      ".hdy..",
      "c.....",
      "c.....",
    ],
    pal: { y: "#ffe27a", g: "#f5b82e", d: "#a8701a", w: "#e8f2f8", r: "#e0473f", W: "#fbf7ef", c: "#8a5a2e" },
  },
};

// MARK: On the back

/** An empty 16×16 frame, then `rows` dropped in at row `y`. */
const frameAt = (rows: string[], y: number): string[] => [...Array<string>(y).fill(""), ...rows];
const view = (front: string[]): BackView => ({ front });

// Tackle box: a teal metal box with a handle on the lid, a seam, two silver latches, and a lure hanging off each side.
const BOX_DOWN = frameAt(
  [
    "...oooooooooo...",
    "...oLttttttto...",
    "...otttttttto...",
    "...oddddddddo...",
    "...otttttttto...",
    "...oooooooooo...",
  ],
  9,
);
const BOX_UP = frameAt(
  [
    "......oooooo....",
    "......oh..ho....",
    "...oooooooooo...",
    "...oLttttttto...",
    "...otsttttstow..",
    "..woddddddddoR..",
    "..Yottttttttos..",
    "..soooooooooo...",
  ],
  8,
);
const BOX_UP_B = frameAt(
  [
    "......oooooo....",
    "......oh..ho....",
    "...oooooooooo...",
    "...oLttttttto...",
    "...otsttttsto.w.",
    ".w.oddddddddo.R.",
    ".Y.otttttttto.s.",
    ".s.oooooooooo...",
  ],
  8,
);
const BOX_SIDE = frameAt(
  [
    "..oooo..........",
    "..oh.o..........",
    ".oooooo.........",
    "woLttto.........",
    "Rotstto.........",
    "soddddo.........",
    ".otttto.........",
    ".oooooo.........",
  ],
  8,
);

// Pixel art reads as a grid.
// prettier-ignore
export const FISHING_BACKS: Record<number, Back> = {
  // Tackle box pack: a green-teal metal box worn on the back, straps over the shoulders, a handle, latches, and lures swinging off it.
  [at(0)]: {
    views: {
      down: { behind: BOX_DOWN, front: frameAt([".....d....d....."], 9) },
      side: { behind: BOX_SIDE },
      up: view(BOX_UP),
    },
    walk: { up: view(BOX_UP_B) },
    pal: { o, t: "#3fa89a", L: "#7fd8c8", d: "#256b66", s: "#dfe6ee", h: "#9aa3ad", R: "#e0473f", Y: "#ffd84a", w: "#c9d2da" },
  },
};
