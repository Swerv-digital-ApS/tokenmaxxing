import { C } from "./palette.ts";
import { bake, cached, once } from "./pixels.ts";

/**
 * The statue of the #1 model (`game/statue.ts`): a marble figure holding up a star, a sash in its maker's
 * colour, on a stone plinth with a plaque in that colour. The plinth fills its tile; the figure stands over the
 * tile above.
 */

export const STATUE_W = 16;
export const STATUE_H = 34;
/** Where the figure's top is: the drape covers from here down to the plinth's cap. */
const CAP = 17;

const MARBLE = "#ece7de";
const MARBLE_SHADE = "#c9c2b6";
const GOLD = "#e3b341";
const GOLD_LIGHT = "#f7dc7a";
const VELVET = "#8e1b2e";
const VELVET_LIGHT = "#b8304a";

/** The plinth, its plaque in `accent`, and (unless `bare`) the figure on it. */
export const statueSprite = cached(
  (accent: string, bare: boolean) => `statue:${accent}:${bare}`,
  (accent: string, bare: boolean) =>
    bake(STATUE_W, STATUE_H, (p) => {
      p.rect(1, 32, 14, 2, C.shadow);
      // The plinth: a wide foot, the block, and its cap.
      p.rect(0, 27, 16, 5, C.ink);
      p.rect(1, 28, 14, 3, C.stoneDark);
      p.rect(1, 28, 14, 1, C.stone);
      p.rect(2, 18, 12, 10, C.ink);
      p.rect(3, 19, 10, 8, C.stone);
      p.rect(3, 19, 1, 8, C.stoneLight);
      p.rect(12, 19, 1, 8, C.stoneDark);
      p.rect(1, CAP, 14, 2, C.ink);
      p.rect(2, CAP, 12, 1, C.stoneLight);
      // The plaque: gold-rimmed, in the maker's colour, a "#1" too small to read.
      p.rect(4, 21, 8, 5, GOLD);
      p.rect(5, 22, 6, 3, accent);
      p.px(6, 23, GOLD_LIGHT);
      p.px(8, 23, GOLD_LIGHT);
      p.px(9, 23, GOLD_LIGHT);
      if (bare) return;
      // The figure: legs, a robe, its head with a laurel, and an arm holding a star up.
      p.rect(5, 13, 6, 4, C.ink);
      p.rect(6, 13, 4, 4, MARBLE_SHADE);
      p.rect(4, 7, 8, 7, C.ink);
      p.rect(5, 7, 6, 6, MARBLE);
      p.rect(10, 8, 1, 5, MARBLE_SHADE);
      // The sash, corner to corner.
      for (let i = 0; i < 5; i++) p.rect(5 + i, 8 + i, 2, 1, accent);
      p.rect(5, 2, 6, 6, C.ink);
      p.rect(6, 3, 4, 4, MARBLE);
      p.rect(9, 4, 1, 3, MARBLE_SHADE);
      p.rect(5, 2, 6, 1, GOLD);
      p.px(5, 3, GOLD);
      p.px(10, 3, GOLD);
      // The raised arm, and the star in its hand.
      p.rect(11, 3, 2, 6, C.ink);
      p.rect(11, 4, 1, 4, MARBLE);
      p.rect(11, 0, 3, 3, GOLD);
      p.px(12, 1, GOLD_LIGHT);
      p.px(10, 1, GOLD);
      p.px(14, 1, GOLD);
    }),
);

/** The velvet drape over a statue that's yet to be unveiled, tied with a gold cord. */
export const drapeSprite = once(() =>
  bake(STATUE_W, CAP + 1, (p) => {
    p.rect(5, 0, 6, 2, C.ink);
    p.rect(6, 0, 4, 2, VELVET);
    p.rect(3, 2, 10, 6, C.ink);
    p.rect(4, 2, 8, 6, VELVET);
    p.rect(2, 8, 12, CAP - 7, C.ink);
    p.rect(3, 8, 10, CAP - 8, VELVET);
    // Folds, light on the left.
    for (const x of [4, 7, 10]) p.rect(x, 3, 1, CAP - 4, VELVET_LIGHT);
    p.rect(3, 7, 10, 1, GOLD);
    p.px(8, 8, GOLD);
    p.px(8, 9, GOLD_LIGHT);
  }),
);
