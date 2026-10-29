import { C } from "./palette.ts";
import { bake, cached } from "./pixels.ts";

/** A tombstone in the model graveyard (`game/graveyard.ts`): a rounded headstone with RIP on it, on a mound, with flowers in its maker's colour. */

export const STONE_W = 16;
export const STONE_H = 22;

export const stoneSprite = cached(
  (accent: string) => `tombstone:${accent}`,
  (accent: string) =>
    bake(STONE_W, STONE_H, (p) => {
      // The headstone: an arch, outlined in ink, lit from the left, RIP carved in it.
      p.rect(4, 1, 8, 1, C.ink);
      p.rect(2, 2, 2, 1, C.ink);
      p.rect(12, 2, 2, 1, C.ink);
      p.rect(1, 3, 1, 16, C.ink);
      p.rect(14, 3, 1, 16, C.ink);
      p.rect(4, 2, 8, 1, C.stoneLight);
      p.rect(2, 3, 12, 16, C.stone);
      p.rect(2, 3, 1, 15, C.stoneLight);
      p.rect(13, 3, 1, 16, C.stoneDark);
      p.text("RIP", 3, 6, C.ink);
      // A line of carving under it: the name, too small to read.
      p.rect(4, 13, 8, 1, C.stoneDark);
      p.rect(5, 15, 6, 1, C.stoneDark);
      // The mound in front of it, and its shadow.
      p.rect(0, 21, 16, 1, C.shadow);
      p.rect(1, 18, 14, 3, C.trunkDark);
      p.rect(2, 18, 12, 1, C.trunk);
      // Flowers laid at its foot, in its maker's colour.
      for (const [x, y] of [
        [3, 18],
        [12, 18],
        [7, 19],
      ] as const) {
        p.px(x, y + 1, C.leafDark);
        p.px(x, y, accent);
      }
    }),
);
