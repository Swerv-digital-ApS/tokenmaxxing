import { TILE } from "@tokenmaxxing/core/world.ts";
import { C } from "./palette.ts";
import { bake, cached, once } from "./pixels.ts";

/**
 * The company common room's own art (`common` only; the sofas, rug, TV, foosball and the rest are the
 * office furniture it shares): a window onto the sky, a tile of the wall of wins, and the kitchen counter.
 * Each is baked once and drawn over the wall's face or the floor.
 */

/** A window in the wall's face: a pane of sky with a cloud and green hills, a cross of frame and a sill. */
export const windowPane = once(() =>
  bake(TILE, TILE, (p) => {
    p.rect(0, 0, TILE, TILE, C.wall);
    p.rect(1, 1, 14, 12, C.ink);
    // Sky, lighter toward the horizon, then the hills.
    const sky = ["#7fc3ee", "#8ecbf0", "#9fd5f3", "#b4e0f6", "#c8eafa", "#d8f1fb"];
    for (const [i, color] of sky.entries()) p.rect(2, 2 + i, 12, 1, color);
    p.rect(2, 8, 12, 4, "#bfe3f4");
    p.rect(2, 9, 12, 3, C.leaf);
    p.rect(2, 9, 5, 1, C.leafLight);
    p.rect(8, 10, 6, 2, C.leafDark);
    p.disc(5, 4, 1, C.white);
    p.rect(4, 4, 4, 1, C.white);
    p.rect(10, 5, 3, 1, C.white);
    // The frame: a cross over the glass, and a sill with a little shadow under it.
    p.rect(7, 2, 2, 10, C.woodLight);
    p.rect(2, 6, 12, 1, C.woodLight);
    p.rect(0, 12, TILE, 2, C.woodLight);
    p.rect(0, 14, TILE, 1, C.woodDark);
    p.rect(0, 0, TILE, 2, C.wallTopLight);
  }),
);

/** The wall of wins, one letter per tile: a dark board with a gold frame and a star over the letter. */
export const winsTile = cached(
  (n: number) => `wins${n}`,
  (n: number) =>
    bake(TILE, TILE, (p) => {
      p.rect(0, 0, TILE, TILE, C.wall);
      p.rect(0, 0, 16, 2, C.wallTopLight);
      p.rect(0, 1, TILE, 13, C.ink);
      p.rect(0, 2, TILE, 11, "#2f3b4e");
      // The gold frame runs along the top and bottom, and closes at each end.
      p.rect(0, 2, TILE, 1, "#e8b93c");
      p.rect(0, 12, TILE, 1, "#e8b93c");
      if (n === 0) p.rect(0, 2, 1, 11, "#e8b93c");
      if (n === 3) p.rect(TILE - 1, 2, 1, 11, "#e8b93c");
      p.rect(0, 13, TILE, 1, C.woodDark);
      const letter = "WINS"[n] ?? "";
      p.text(letter, 6, 7, C.white);
      // A star over each letter, and a few sparkles.
      p.rect(7, 3, 2, 1, C.flowerYellow);
      p.rect(8, 4, 1, 2, C.flowerYellow);
      p.px(7, 4, C.lamp);
      p.px(3 + (n % 2) * 8, 10, C.lamp);
      p.px(12 - (n % 2) * 8, 4, C.lamp);
      p.rect(0, 14, TILE, 2, C.wall);
    }),
);

/** A kitchen counter: a pale worktop over wooden cabinets; `sink` has a tap and a basin on it. */
export const counter = cached(
  (sink: boolean) => `counter${+sink}`,
  (sink: boolean) =>
    bake(TILE, TILE, (p) => {
      p.rect(0, 5, TILE, 11, C.ink);
      p.rect(0, 6, TILE, 4, "#ece6d8");
      p.rect(0, 6, TILE, 1, C.white);
      p.rect(0, 9, TILE, 1, "#c9c1ae");
      p.rect(1, 10, 14, 5, C.wood);
      p.rect(1, 10, 14, 1, C.woodLight);
      p.rect(7, 10, 1, 5, C.woodDark);
      p.rect(8, 10, 1, 5, C.woodDark);
      p.px(6, 12, C.metalLight);
      p.px(9, 12, C.metalLight);
      p.rect(1, 15, 14, 1, C.woodDark);
      if (sink) {
        p.rect(3, 6, 7, 3, C.metal);
        p.rect(4, 7, 5, 1, C.metalLight);
        p.rect(11, 3, 1, 4, C.metalLight);
        p.rect(9, 3, 3, 1, C.metalLight);
      } else {
        // A cutting board, and a bowl of fruit.
        p.rect(2, 6, 5, 2, C.woodLight);
        p.disc(11, 6, 1, C.flowerRed);
        p.px(12, 6, C.flowerYellow);
      }
    }),
);
