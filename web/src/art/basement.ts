import { TILE } from "@tokenmaxxing/core/world.ts";
import { C } from "./palette.ts";
import { bake, cached, once, type Palette } from "./pixels.ts";

/**
 * The basement net cafe's own art (`basement` only; the rest is the office furniture it shares): the big
 * screen over the back wall, a wall terminal, and the stairs tile. Each is baked once. `game/basement.ts`
 * paints the live feed on the screen and the live values on the terminals.
 */

/** The big screen: a run of `SCREEN_TILES` tiles, bezel and a dark glass `SCREEN_GLASS` the feed goes on. */
export const SCREEN_TILES = 6;
export const SCREEN_W = SCREEN_TILES * TILE;
export const SCREEN_H = 44;
export const SCREEN_GLASS = { x: 4, y: 4, w: SCREEN_W - 8, h: 32 } as const;

export const bigScreen = once(() =>
  bake(SCREEN_W, SCREEN_H, (p) => {
    const { x, y, w, h } = SCREEN_GLASS;
    // Bezel, glass, and a shelf of cables under it.
    p.rect(0, 0, SCREEN_W, 40, C.ink);
    p.rect(1, 1, SCREEN_W - 2, 38, C.metal);
    p.rect(1, 1, SCREEN_W - 2, 1, C.metalLight);
    p.rect(x - 1, y - 1, w + 2, h + 2, C.ink);
    p.rect(x, y, w, h, "#0e1420");
    p.rect(x, y, w, 1, "#1d2a44");
    // Standby LED and the mounting bar.
    p.px(SCREEN_W - 5, 37, "#3ddc84");
    p.rect(8, 40, SCREEN_W - 16, 2, C.ink);
    p.rect(9, 40, SCREEN_W - 18, 1, C.metal);
    p.rect(8, 42, SCREEN_W - 16, 2, C.shadow);
  }),
);

// biome-ignore format: pixel art reads as a grid
const TERMINAL: { rows: string[]; pal: Palette } = {
  rows: [
    "................",
    "..oooooooooooo..",
    "..omMMMMMMMMmo..",
    "..omggggggggmo..",
    "..omggggggggmo..",
    "..omggggggggmo..",
    "..omggggggggmo..",
    "..omggggggggmo..",
    "..omMMMMMMMMmo..",
    "..oooooooooooo..",
    "....oMMMMMMo....",
    "...oMMMMMMMMo...",
    "...oooooooooo...",
    "................",
    "................",
    "................",
  ],
  pal: { o: C.ink, M: C.metal, m: C.metalLight, g: "#0e1f17" },
};

/** The glass of the terminal in tile pixels, for the live values and the scan lines. */
export const TERMINAL_GLASS = { x: 4, y: 3, w: 8, h: 5 } as const;

/** A wall terminal: a green-glass CRT on a bracket. The values are painted over it each frame. */
export const wallTerminal = once(() =>
  bake(TILE, TILE, (p) => {
    p.grid(TERMINAL.rows, TERMINAL.pal);
    // Scan lines.
    for (let y = TERMINAL_GLASS.y; y < TERMINAL_GLASS.y + TERMINAL_GLASS.h; y += 2)
      p.rect(TERMINAL_GLASS.x, y, TERMINAL_GLASS.w, 1, "#12301f");
  }),
);

/**
 * The stairs on the Tavern's `S` (down) and the basement's `x` (up): a landing with steps, dark at the
 * far end for down, lit for up.
 */
export const stairs = cached(
  (down: boolean) => `${down}`,
  (down: boolean) =>
    bake(TILE, TILE, (p) => {
      p.rect(0, 0, 2, TILE, C.woodDark);
      p.rect(TILE - 2, 0, 2, TILE, C.woodDark);
      for (let i = 0; i < 5; i++) {
        // Down: the steps get darker and shorter going toward the bottom of the tile; up: the reverse.
        const row = down ? i : 4 - i;
        const y = 2 + i * 3;
        const shade = down ? 0.9 - row * 0.17 : 0.45 + row * 0.12;
        p.rect(2, y, TILE - 4, 3, C.ink);
        p.rect(2, y, TILE - 4, 2, rgb(shade));
        p.rect(2, y, TILE - 4, 1, rgb(Math.min(1, shade + 0.15)));
      }
      p.rect(0, 0, TILE, 1, C.ink);
    }),
);

/** The tournament board: a framed slate with a little bracket chalked on it and a gold star for the winner. */
export const tournamentBoard = once(() =>
  bake(TILE, TILE, (p) => {
    p.rect(0, 1, TILE, 14, C.ink);
    p.rect(1, 2, TILE - 2, 12, C.woodDark);
    p.rect(2, 3, TILE - 4, 10, "#1c2b2a");
    // Four lines into two into one: the bracket.
    const chalk = "#d8e4dc";
    for (const y of [4, 6, 9, 11]) p.rect(3, y, 3, 1, chalk);
    p.rect(5, 4, 1, 3, chalk);
    p.rect(5, 9, 1, 3, chalk);
    p.rect(6, 5, 2, 1, chalk);
    p.rect(6, 10, 2, 1, chalk);
    p.rect(7, 5, 1, 6, chalk);
    p.rect(8, 8, 2, 1, chalk);
    // The star.
    p.rect(11, 7, 3, 3, "#ffd75a");
    p.px(12, 6, "#ffd75a");
    p.px(12, 10, "#ffd75a");
    p.rect(2, 14, TILE - 4, 1, C.shadow);
  }),
);

/** A warm wood brown at `k` brightness (0 to 1), for the steps. */
const rgb = (k: number): string => {
  const c = Math.max(0, Math.min(1, k));
  return `rgb(${Math.round(190 * c)}, ${Math.round(128 * c)}, ${Math.round(78 * c)})`;
};
