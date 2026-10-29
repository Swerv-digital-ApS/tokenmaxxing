import { C } from "./palette.ts";
import { bake, glyphPixels, once } from "./pixels.ts";

/**
 * J-dag's truck (`game/jdag.ts`): Nissebryg's, a red box van with its name down the side, a nisse at the wheel
 * and a string of fairy lights along the roof, facing right. Four tiles long; it reaches up over the row behind.
 */

export const TRUCK_PX = { w: 64, h: 28 } as const;
/** Where its headlight and the middle of its lights are, from its top left, for the night's glow. */
export const HEADLIGHT: readonly [number, number] = [62, 18];
export const BULBS_Y = 1;

const RED = "#b3262e";
const RED_DARK = "#8c1d24";
const CREAM = "#fbf7ef";
const GREEN = "#2f6b3a";
const BULBS = ["#ff5a5a", "#f5d14a", "#5fd38a", "#6fb4ff"];

export const truckSprite = once(() =>
  bake(TRUCK_PX.w, TRUCK_PX.h, (p) => {
    // The fairy lights, on a wire along the roof.
    p.rect(1, BULBS_Y + 1, 43, 1, C.ink);
    for (let x = 2, i = 0; x < 44; x += 3, i++) p.px(x, BULBS_Y, BULBS[i % BULBS.length]!);
    // The box: red, a cream trim, a darker skirt, and the name.
    p.rect(0, 3, 45, 20, C.ink);
    p.rect(1, 4, 43, 18, RED);
    p.rect(1, 5, 43, 1, CREAM);
    p.rect(1, 18, 43, 4, RED_DARK);
    for (const [x, y] of glyphPixels("NISSEBRYG")) p.px(5 + x, 9 + y, CREAM);
    for (const x of [6, 16, 27, 38]) {
      p.px(x, 15, CREAM);
      p.px(x - 1, 16, CREAM);
      p.px(x + 1, 16, CREAM);
      p.px(x, 17, CREAM);
    }
    // The cab: green, a window with the nisse driving, a headlight and a bumper.
    p.rect(44, 9, 19, 14, C.ink);
    p.rect(45, 10, 17, 12, GREEN);
    p.rect(49, 11, 11, 5, "#a8d8f0");
    p.rect(52, 13, 4, 3, "#f2c29b");
    p.rect(51, 11, 6, 2, "#d8283a");
    p.px(57, 11, CREAM);
    p.rect(52, 15, 4, 1, CREAM);
    p.rect(61, 17, 2, 2, "#ffe08a");
    p.rect(44, 21, 20, 2, "#9aa3ad");
    // The wheels.
    for (const x of [9, 35, 54]) {
      p.disc(x, 24, 3, C.ink);
      p.px(x, 24, "#9aa3ad");
    }
  }),
);
