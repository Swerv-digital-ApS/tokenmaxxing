import { C } from "./palette.ts";
import { bake, cached, once } from "./pixels.ts";

/**
 * Fastelavn (`game/fastelavn.ts`): the frame the barrel hangs from, three tiles wide (its posts stand on the
 * tiles either side of the barrel's), the barrel with a black cat painted on it, more cracked as it's whacked,
 * and what's left once it breaks.
 */

export const FRAME_PX = { w: 48, h: 34 } as const;
/** Where the barrel hangs in the frame: its top left. */
export const BARREL_AT = { x: 18, y: 10 } as const;

const WOOD = "#a0703f";
const WOOD_DARK = "#6e4a26";
const BAND = "#3c3a44";

export const frameSprite = once(() =>
  bake(FRAME_PX.w, FRAME_PX.h, (p) => {
    for (const x of [3, 43]) {
      p.rect(x, 3, 3, 31, C.ink);
      p.rect(x + 1, 4, 1, 29, WOOD);
    }
    p.rect(2, 1, 45, 4, C.ink);
    p.rect(3, 2, 43, 2, WOOD);
    p.rect(23, 5, 2, 5, "#d9c7a0");
    // Paper streamers on the bar.
    for (const [x, c] of [
      [8, "#e8584f"],
      [13, "#f5d14a"],
      [34, "#5ee0ff"],
      [39, "#7dff8a"],
    ] as const)
      p.rect(x, 5, 1, 4, c);
  }),
);

/** The barrel at `cracks` (0 to 3): staves, two iron bands, the cat on its front. */
export const barrelSprite = cached(
  (cracks: number) => String(cracks),
  (cracks: number) =>
    bake(12, 15, (p) => {
      p.rect(1, 0, 10, 15, C.ink);
      p.rect(0, 2, 12, 11, C.ink);
      p.rect(2, 1, 8, 13, WOOD);
      p.rect(1, 3, 10, 9, WOOD);
      for (const x of [3, 6, 9]) p.rect(x, 1, 1, 13, WOOD_DARK);
      p.rect(1, 3, 10, 1, BAND);
      p.rect(1, 11, 10, 1, BAND);
      // The cat: ears, a head, two yellow eyes.
      p.rect(4, 5, 4, 4, C.ink);
      p.px(4, 4, C.ink);
      p.px(7, 4, C.ink);
      p.px(5, 6, "#f5d14a");
      p.px(6, 6, "#f5d14a");
      const lines: [number, number, number][] = [
        [2, 8, 3],
        [9, 2, 4],
        [8, 9, 4],
      ];
      for (const [x, y, len] of lines.slice(0, cracks))
        for (let i = 0; i < len; i++) p.px(x + (i % 2), y + i, C.ink);
    }),
);

/** What's left on the grass once it breaks: staves, a band, sweets. */
export const brokenSprite = once(() =>
  bake(20, 6, (p) => {
    p.rect(1, 3, 6, 2, WOOD);
    p.rect(8, 4, 5, 2, WOOD_DARK);
    p.rect(13, 2, 6, 2, WOOD);
    p.rect(5, 1, 9, 1, BAND);
    for (const [x, y, c] of [
      [3, 0, "#e8584f"],
      [11, 0, "#5ee0ff"],
      [16, 5, "#f5d14a"],
      [7, 2, "#b18cff"],
    ] as const)
      p.rect(x, y, 2, 1, c);
  }),
);
