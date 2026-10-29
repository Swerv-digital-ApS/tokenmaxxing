import { C } from "./palette.ts";
import { bake, cached, once } from "./pixels.ts";

/**
 * Sankt Hans (`game/sankthans.ts`): the bonfire, two tiles wide: a pile of logs and branches with a straw witch
 * on a stick on top, and the fire that eats it once it's lit (two frames, flickering).
 */
export const PILE_PX = { w: 32, h: 34 } as const;
/** The fire's middle, from the pile's top left, for the glow. */
export const FIRE_AT: readonly [number, number] = [16, 18];

const LOG = "#7a4f2b";
const LOG_DARK = "#4f321b";

export const pileSprite = once(() =>
  bake(PILE_PX.w, PILE_PX.h, (p) => {
    // The logs, leaning in to a point.
    for (let row = 0; row < 12; row++) {
      const w = 28 - row * 2;
      const x = 2 + row;
      p.rect(x, 33 - row, w, 1, row % 3 === 0 ? LOG_DARK : LOG);
    }
    for (const x of [6, 12, 19, 25]) p.rect(x, 24, 1, 9, LOG_DARK);
    // The witch on her stick: a straw body, a black hat.
    p.rect(15, 10, 2, 12, LOG_DARK);
    p.rect(13, 12, 6, 7, "#e3c35a");
    p.rect(14, 8, 4, 4, "#f2d9a0");
    p.rect(12, 7, 8, 1, C.ink);
    p.rect(14, 3, 4, 4, C.ink);
    p.rect(11, 14, 2, 1, "#e3c35a");
    p.rect(19, 14, 2, 1, "#e3c35a");
  }),
);

/** The fire over the pile, frame 0 or 1. */
export const fireSprite = cached(
  (frame: number) => String(frame),
  (frame: number) =>
    bake(PILE_PX.w, PILE_PX.h, (p) => {
      const tongues = frame ? [4, 9, 15, 21, 26] : [6, 11, 17, 23];
      for (const [i, x] of tongues.entries()) {
        const h = 10 + ((i * 7 + frame * 5) % 9);
        p.rect(x, 33 - h, 4, h, "#e8582a");
        p.rect(x + 1, 33 - h + 3, 2, h - 3, "#ffb43a");
        p.rect(x + 1, 33 - Math.floor(h / 2), 2, Math.floor(h / 2) - 2, "#fff0a8");
      }
    }),
);
