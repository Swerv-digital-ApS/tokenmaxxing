import type { Look } from "@tokenmaxxing/core/world.ts";
import { characterFrame } from "./characters.ts";
import { C } from "./palette.ts";
import { bake, cached } from "./pixels.ts";

/** The launch stand (`game/launch.ts`): a striped awning in the provider's colour (or a rainbow, for several) over a counter. */

/** The rainbow awning's stripes, when more than one provider has something out. */
const RAINBOW = ["#e8434b", "#f28c28", "#f5d14a", "#58b36a", "#3f89c9", "#8e63d8"];

export const STAND_W = 32;
export const STAND_H = 36;

/** Who's presenting: a lanyard-and-hoodie type, in purple. */
const PRESENTER: Look = {
  style: 1,
  skin: 2,
  hair: 3,
  outfit: 5,
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

/** `#rrggbb` mixed towards black (`k` below 1) or white (above 1), for the awning's shade and light. */
function shade(hex: string, k: number): string {
  const n = Number.parseInt(hex.slice(1), 16);
  const ch = (s: number) => {
    const v = (n >> s) & 255;
    return Math.max(0, Math.min(255, Math.round(k <= 1 ? v * k : v + (255 - v) * (k - 1))));
  };
  return `rgb(${ch(16)}, ${ch(8)}, ${ch(0)})`;
}

/**
 * The stand with its feet on the bottom row, two tiles wide, in `accent` or (null) a rainbow. `lit`
 * makes the board's star blink.
 */
export const standSprite = cached(
  (accent: string | null, lit: boolean) => `stand:${accent ?? "rainbow"}:${lit}`,
  (accent: string | null, lit: boolean) =>
    bake(STAND_W, STAND_H, (p) => {
      // A rainbow stand trims in each colour in turn; its band is the first.
      const stripe = (i: number) => accent ?? RAINBOW[i % RAINBOW.length]!;
      p.rect(2, 33, 28, 2, C.shadow);
      // Two poles holding the awning up.
      for (const x of [1, 29]) {
        p.rect(x, 6, 2, 25, C.woodDark);
        p.rect(x, 6, 1, 25, C.wood);
      }
      // The presenter, behind the counter.
      p.g.drawImage(characterFrame(PRESENTER, "down", "stand"), 8, 6);
      // The awning: stripes in the accent and white (or every colour of the rainbow), a scalloped hem.
      p.rect(3, 0, 26, 1, C.ink);
      p.rect(0, 1, 32, 1, C.ink);
      for (let x = 0; x < 32; x++) {
        const k = Math.floor((x + 2) / 4);
        const col = accent ? (k % 2 === 0 ? accent : C.white) : stripe(k);
        const top = x < 3 || x > 28 ? 2 : 1;
        p.rect(x, top, 1, 7 - top, col);
        p.px(x, 7, x % 4 !== 3 ? col : col === C.white ? C.plazaDark : shade(col, 0.75));
        if (top === 1) p.px(x, 2, col === C.white ? col : shade(col, 1.3));
      }
      p.rect(0, 2, 1, 5, C.ink);
      p.rect(31, 2, 1, 5, C.ink);
      // The counter top.
      p.rect(0, 18, 32, 1, C.ink);
      p.rect(0, 19, 32, 2, C.woodLight);
      p.rect(0, 20, 32, 1, C.wood);
      // The front: wood with an accent band, and a white board on it.
      p.rect(1, 21, 30, 10, C.ink);
      p.rect(2, 21, 28, 9, C.wood);
      for (let x = 2; x < 30; x++)
        p.rect(x, 21, 1, 2, accent ?? stripe(Math.floor(((x - 2) * RAINBOW.length) / 28)));
      p.rect(2, 28, 28, 2, C.woodDark);
      p.rect(7, 22, 18, 8, C.ink);
      p.rect(8, 23, 16, 6, C.white);
      // A star on it that blinks, with sparkles either side.
      const star = lit ? "#f5d14a" : C.plazaDark;
      p.rect(14, 24, 3, 4, star);
      p.rect(13, 25, 5, 2, star);
      for (const [i, x] of [10, 12, 19, 21].entries()) p.px(x, 26, stripe(i));
      // Wheels: it's a stand that turns up the day something ships.
      for (const cx of [6, 26]) {
        p.disc(cx, 31, 3, C.ink);
        p.disc(cx, 31, 2, C.metal);
        p.px(cx, 31, C.metalLight);
      }
    }),
);
