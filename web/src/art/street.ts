import type { Look } from "@tokenmaxxing/core/world.ts";
import { characterFrame } from "./characters.ts";
import { C } from "./palette.ts";
import { bake, cached, once, type Palette } from "./pixels.ts";

/**
 * Street life (`game/street.ts`): the pølsevogn, the build snail and its goal flag, the paperboy on
 * his bike, a paper on the grass, and the sausage over the head of anyone who just had one.
 */

const RED = "#d8343c";
const RED_DARK = "#a8262e";
const RED_LIGHT = "#f06a6a";
const BUN = "#e8b06a";
const BUN_DARK = "#b9813f";
const MUSTARD = "#f5d14a";

/** Who's behind the counter: white coat, a paper hat. */
const VENDOR: Look = {
  style: 0,
  skin: 1,
  hair: 0,
  outfit: 7,
  glasses: 0,
  hat: 0,
  pet: 0,
  held: 0,
  back: 0,
  petwear: 0,
  petVariant: 0,
  merch: 0,
  merchWorn: 0,
};
/** The paperboy: yellow jacket, beanie. */
const PAPERBOY: Look = {
  style: 1,
  skin: 0,
  hair: 2,
  outfit: 3,
  glasses: 0,
  hat: 1,
  pet: 0,
  held: 0,
  back: 0,
  petwear: 0,
  petVariant: 0,
  merch: 0,
  merchWorn: 0,
};

export const CART_W = 32;
export const CART_H = 36;

/** A red-and-white Copenhagen pølsevogn, two tiles wide; its feet are the bottom row. Closed: brolly down, shutter up. */
export const cartSprite = cached(
  (open: boolean) => `cart:${open}`,
  (open: boolean) =>
    bake(CART_W, CART_H, (p) => {
      p.rect(2, 33, 28, 2, C.shadow);
      // The brolly: red and white panels with a scalloped hem, on a steel pole.
      p.rect(15, 6, 2, 13, C.metal);
      p.rect(15, 6, 1, 13, C.metalLight);
      if (open) {
        p.rect(4, 0, 24, 1, C.ink);
        p.rect(1, 1, 30, 1, C.ink);
        for (let x = 0; x < 32; x++) {
          const stripe = Math.floor((x + 2) / 4) % 2 === 0 ? RED : C.white;
          const top = x < 4 || x > 27 ? 2 : 1;
          p.rect(x, top, 1, 6 - top + 1, stripe);
          if (x % 4 !== 3) p.px(x, 7, stripe);
        }
        for (let x = 0; x < 32; x += 4) p.px(x + 3, 6, C.ink);
        p.rect(0, 2, 1, 5, C.ink);
        p.rect(31, 2, 1, 5, C.ink);
        p.px(15, 0, C.metalLight);
        // The vendor, behind the counter.
        p.g.drawImage(characterFrame(VENDOR, "down", "stand"), 17, 5);
        // A paper hat.
        p.rect(19, 4, 10, 2, C.white);
        p.rect(20, 3, 8, 1, C.white);
        p.rect(19, 5, 10, 1, C.plazaDark);
      } else {
        // Furled: a tight roll of stripes on the pole.
        p.rect(14, 1, 4, 12, C.ink);
        for (let y = 2; y < 12; y++) p.rect(15, y, 2, 1, Math.floor(y / 2) % 2 ? RED : C.white);
      }
      // Counter: steel top, with ketchup, mustard and remoulade when it's open.
      if (open) {
        p.rect(4, 14, 2, 5, RED);
        p.px(4, 13, RED_DARK);
        p.rect(7, 15, 2, 4, MUSTARD);
        p.px(7, 14, "#c9a52e");
        p.rect(10, 16, 3, 3, "#f1e6b8");
      }
      p.rect(0, 18, 32, 1, C.ink);
      p.rect(0, 19, 32, 2, C.stoneLight);
      p.rect(0, 20, 32, 1, C.stone);
      // The body: white, a red band top and bottom, and a pølse in a bun on the front.
      p.rect(1, 21, 30, 10, C.ink);
      p.rect(2, 21, 28, 9, C.white);
      p.rect(2, 21, 28, 2, RED);
      p.rect(2, 28, 28, 2, RED);
      p.rect(2, 23, 28, 1, RED_DARK);
      if (open) {
        p.rect(9, 25, 14, 2, BUN);
        p.rect(9, 26, 14, 1, BUN_DARK);
        p.rect(8, 24, 16, 1, RED);
        p.rect(9, 23, 14, 1, RED_LIGHT);
        p.px(7, 24, RED_DARK);
        p.px(24, 24, RED_DARK);
        for (let x = 10; x < 22; x += 3) p.px(x, 24, MUSTARD);
      } else {
        // The shutter: grey slats where the picture was.
        for (let y = 24; y < 28; y += 2) p.rect(4, y, 24, 1, C.plazaDark);
      }
      // Wheels.
      for (const cx of [8, 24]) {
        p.disc(cx, 31, 3, C.ink);
        p.disc(cx, 31, 2, C.metal);
        p.px(cx, 31, C.metalLight);
      }
    }),
);

// Pixel art reads as a grid.
// prettier-ignore
const SNAIL_FRAMES = [
  [
    "...........e..e.",
    "...........b..b.",
    "....oooo...b.bb.",
    "...oSSSSo..bbbb.",
    "..oShhhSSo.bbbbo",
    "..oShSShSSobbbbo",
    "..oShhSShSobbbo.",
    "...oSSSSSobbbo..",
    ".oobooooobbbbo..",
    "obbbbbbbbbbbo...",
    ".ooooooooooo....",
  ],
  [
    "............e..e",
    "............b..b",
    "....oooo....b.bb",
    "...oSSSSo...bbbb",
    "..oShhhSSo..bbbb",
    "..oShSShSSobbbbb",
    "..oShhSShSobbbbo",
    "...oSSSSSobbbbo.",
    "oobbooooobbbbbo.",
    "bbbbbbbbbbbbbo..",
    "oooooooooooooo..",
  ],
];
const SNAIL_PAL: Palette = { o: C.ink, e: C.ink, b: "#b9c7a3", S: "#d98b45", h: "#f3c27a" };
const SNAIL_W = 16;
export const SNAIL_H = 11;

/** The build snail, facing right; `inch` is the stretched frame. Its sign is drawn over it, on a stick. */
export const snailSprite = cached(
  (inch: boolean) => `snail:${inch}`,
  (inch: boolean) =>
    bake(SNAIL_W, SNAIL_H + 6, (p) => {
      p.rect(1, SNAIL_H + 4, 13, 2, C.shadow);
      // The sign's stick, out of the shell.
      p.rect(6, 0, 1, 7, C.woodDark);
      p.grid(SNAIL_FRAMES[inch ? 1 : 0]!, SNAIL_PAL, 0, 6);
    }),
);

/** The goal flag at the end of the snail's run: chequered, on a pole. */
export const goalFlag = once(() =>
  bake(12, 22, (p) => {
    p.rect(1, 20, 6, 2, C.shadow);
    p.rect(2, 1, 1, 20, C.metal);
    p.rect(1, 19, 3, 2, C.metal);
    p.rect(3, 1, 9, 7, C.ink);
    for (let y = 0; y < 3; y++)
      for (let x = 0; x < 4; x++) p.rect(3 + x * 2, 2 + y * 2, 2, 2, (x + y) % 2 ? C.ink : C.white);
  }),
);

/** The paperboy on his bike, facing right, a sack of papers on the back. `pedal` is the other frame. */
export const bikeSprite = cached(
  (pedal: boolean) => `bike:${pedal}`,
  (pedal: boolean) =>
    bake(24, 22, (p) => {
      p.rect(2, 20, 20, 2, C.shadow);
      for (const cx of [5, 18]) {
        p.disc(cx, 17, 4, C.ink);
        p.disc(cx, 17, 3, C.metalLight);
        p.disc(cx, 17, 2, C.ink);
        p.px(cx, 17, C.metalLight);
      }
      // The frame, the seat and the bars.
      p.rect(6, 13, 11, 1, RED);
      p.rect(9, 10, 1, 7, RED);
      p.rect(16, 9, 1, 8, RED);
      p.rect(7, 9, 4, 1, C.ink);
      p.rect(15, 8, 3, 1, C.ink);
      // The rider.
      const rider = characterFrame(PAPERBOY, "right", pedal ? "walkA" : "walkB");
      p.g.drawImage(rider, 3, -2);
      // His sack of papers, on the rack.
      p.rect(1, 9, 6, 5, "#c9b48a");
      p.rect(1, 9, 6, 1, "#a38c5f");
      p.rect(2, 8, 2, 1, C.white);
      p.rect(4, 7, 2, 2, C.white);
    }),
);

/** A rolled paper on the grass, held with a red rubber band. */
export const paperSprite = once(() =>
  bake(12, 8, (p) => {
    p.rect(1, 6, 11, 2, C.shadow);
    p.rect(0, 1, 12, 6, C.ink);
    p.rect(1, 2, 10, 4, C.white);
    p.rect(1, 5, 10, 1, C.plazaDark);
    p.rect(2, 3, 3, 1, C.stoneDark);
    p.rect(7, 3, 3, 1, C.stoneDark);
    p.rect(5, 1, 2, 6, RED);
  }),
);

// Pixel art reads as a grid.
// prettier-ignore
const SAUSAGE = [
  "..rrrrrrrrrr..",
  ".rRRRRRRRRRRr.",
  "ryrrryrrryrrrr",
  "obbbbbbbbbbbbo",
  ".oBBBBBBBBBBo.",
  "..oooooooooo..",
];

/** A rød pølse in a bun, a squiggle of mustard on top: the icon over a fed head. */
export const sausageIcon = once(() =>
  bake(14, 6, (p) => p.grid(SAUSAGE, { r: RED, R: RED_LIGHT, y: MUSTARD, b: BUN, B: BUN_DARK, o: C.ink })),
);
