import { C } from "./palette.ts";
import { bake, cached } from "./pixels.ts";

/**
 * The keynote watch party (`game/keynote.ts`): a pull-down projector screen on the Tavern's west wall, seen
 * from the side like the bar tab, and the poster that hangs there before it.
 */

export const SCREEN_W = 16;
/** Five tiles of wall, beside the stage (`SCREEN` in core). */
export const SCREEN_H = 80;
export const POSTER_H = 28;

const CLOTH = "#eef3fb";
const LIVE = "#e8434b";

/** The screen pulled down, the event's slide on it in the host's colour; `blink` lights the LIVE dot. */
export const screenSide = cached(
  (accent: string, blink: boolean) => `screen:${accent}:${blink}`,
  (accent: string, blink: boolean) =>
    bake(SCREEN_W, SCREEN_H, (p) => {
      // The roller's housing, bolted to the wall, and its end caps.
      p.rect(1, 0, 14, 4, C.ink);
      p.rect(2, 1, 12, 2, "#6b7180");
      p.rect(2, 1, 12, 1, "#8d93a3");
      // The cloth, lit by the projector.
      p.rect(2, 4, 12, 71, C.ink);
      p.rect(3, 4, 10, 70, CLOTH);
      // The slide: a title band in the host's colour over a stage with someone presenting.
      p.rect(3, 9, 10, 22, accent);
      p.rect(4, 13, 8, 2, C.white);
      p.rect(4, 17, 6, 1, C.white);
      p.rect(4, 20, 7, 1, C.white);
      p.rect(4, 26, 4, 2, C.white);
      p.disc(8, 45, 3, "#3b3450");
      p.rect(5, 49, 7, 12, "#3b3450");
      p.rect(3, 61, 10, 2, "#c9d2e3");
      p.rect(3, 63, 10, 11, "#dbe3f0");
      // LIVE: a red dot, top right, blinking.
      p.rect(9, 5, 3, 3, blink ? LIVE : "#f4b4b6");
      // The hem's weighted bar and the pull cord.
      p.rect(2, 74, 12, 2, C.ink);
      p.rect(8, 76, 1, 4, C.ink);
    }),
);

/** The poster before it: a film reel on a card in the host's colour, pinned to the wall. */
export const posterSide = cached(
  (accent: string) => `poster:${accent}`,
  (accent: string) =>
    bake(SCREEN_W, POSTER_H, (p) => {
      p.rect(2, 0, 12, POSTER_H, C.ink);
      p.rect(3, 1, 10, POSTER_H - 2, C.white);
      p.rect(3, 1, 10, 6, accent);
      p.px(8, 0, "#c4544b");
      // A reel of film.
      p.disc(8, 13, 3, C.ink);
      for (const [x, y] of [
        [8, 11],
        [6, 13],
        [10, 13],
        [8, 15],
      ] as const)
        p.px(x, y, C.white);
      // Lines of small print: what and when.
      for (const [y, w] of [
        [19, 8],
        [21, 6],
        [23, 7],
      ] as const)
        p.rect(4, y, w, 1, "#8d93a3");
    }),
);

/** The projector on the ceiling over the crowd: a small box, its lens towards the screen (west). */
export const projector = cached(
  (on: boolean) => `projector:${on}`,
  (on: boolean) =>
    bake(12, 8, (p) => {
      p.rect(5, 0, 2, 2, C.ink);
      p.rect(1, 2, 11, 6, C.ink);
      p.rect(2, 3, 9, 4, "#5b6170");
      p.rect(2, 3, 9, 1, "#8d93a3");
      p.rect(0, 3, 2, 4, C.ink);
      p.px(0, 4, on ? "#fff6d6" : "#3b3450");
      p.px(0, 5, on ? "#fff6d6" : "#3b3450");
    }),
);
