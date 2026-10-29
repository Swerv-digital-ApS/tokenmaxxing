import type { Item } from "@tokenmaxxing/core/shop.ts";
import type { Facing, Look } from "@tokenmaxxing/core/world.ts";
import { characterFrame, itemFrame } from "./characters.ts";
import { C } from "./palette.ts";
import { bake, cached, gradient, once, type Pen } from "./pixels.ts";

/**
 * The traveling merchant's cart (`core/src/merchant.ts`): a wooden wagon under a striped awning,
 * this week's editions out on the counter, a lantern on the post and an "LTD" board on the front.
 * 48×48, standing on the bottom row. And the merchant, in a wide feathered hat.
 */

export const CART_PX = { w: 48, h: 48 } as const;

const AWNING = [C.roofRed, C.white];

function wheel(p: Pen, cx: number, cy: number): void {
  p.disc(cx, cy, 6, C.ink);
  p.disc(cx, cy, 5, C.woodDark);
  p.disc(cx, cy, 3, C.ink);
  p.disc(cx, cy, 2, C.wood);
  // Spokes, then the hub.
  for (const [dx, dy] of [
    [0, -4],
    [0, 4],
    [-4, 0],
    [4, 0],
    [-3, -3],
    [3, 3],
    [-3, 3],
    [3, -3],
  ] as const)
    p.px(cx + dx, cy + dy, C.wood);
  p.rect(cx - 1, cy - 1, 2, 2, C.ink);
  p.px(cx - 4, cy - 2, C.woodLight);
}

function awning(p: Pen): void {
  // Sloped top, then stripes six wide, each ending in a scallop.
  p.rect(3, 2, 42, 1, C.ink);
  p.rect(1, 3, 46, 1, C.ink);
  for (let x = 0, i = 0; x < 48; x += 6, i++) {
    const color = AWNING[i % 2]!;
    const shade = i % 2 ? C.wallDark : C.roofRedDark;
    const top = x === 0 || x === 42 ? 5 : 4;
    p.rect(x + (x === 0 ? 1 : 0), top, x === 42 ? 5 : 6, 11 - top, color);
    p.rect(x + (x === 0 ? 1 : 0), 10, x === 42 ? 5 : 6, 1, shade);
    p.rect(x + 1, 11, 4, 1, color);
    p.rect(x + 2, 12, 2, 1, color);
    p.rect(x, 11, 1, 1, C.ink);
    p.px(x + 1, 12, C.ink);
    p.px(x + 4, 12, C.ink);
    p.rect(x + 2, 13, 2, 1, C.ink);
  }
  p.rect(0, 4, 1, 7, C.ink);
  p.rect(47, 4, 1, 7, C.ink);
  p.rect(2, 4, 44, 1, "rgba(255, 255, 255, 0.35)");
}

/** The cart with `items` on its counter. */
export const cartSprite = cached(
  (items: readonly Item[]) => items.map((i) => i.id).join(","),
  (items: readonly Item[]) =>
    bake(CART_PX.w, CART_PX.h, (p) => {
      p.rect(3, 44, 42, 3, C.shadow);
      // The back wall: a curtain between the posts, for the goods to stand out against.
      p.rect(5, 12, 38, 12, C.fabricDark);
      for (let x = 8; x < 42; x += 5) p.rect(x, 13, 1, 11, C.fabric);
      // Posts.
      p.rect(3, 8, 3, 17, C.ink);
      p.rect(4, 8, 1, 16, C.woodDark);
      p.rect(42, 8, 3, 17, C.ink);
      p.rect(43, 8, 1, 16, C.woodDark);
      awning(p);
      // Strings of bunting across the curtain.
      for (let x = 7; x < 42; x += 4)
        p.px(x, 15 + ((x >> 2) % 2), [C.flowerYellow, C.screen, C.flowerRed][x % 3]!);
      // The counter, the goods on it, and the box below.
      for (const [i, item] of items.entries()) {
        const sprite = itemFrame(item);
        p.g.drawImage(sprite, Math.round(1 + i * 10.5), 25 - sprite.height);
      }
      p.rect(1, 25, 46, 3, C.ink);
      p.rect(2, 25, 44, 2, C.woodLight);
      p.rect(3, 28, 42, 12, C.ink);
      p.rect(4, 28, 40, 11, C.wood);
      for (const y of [31, 35]) p.rect(4, y, 40, 1, C.woodDark);
      p.rect(4, 28, 40, 1, C.woodDark);
      for (const x of [4, 43]) p.rect(x, 28, 1, 11, C.woodDark);
      // The board on the front: "LTD" in gold.
      p.rect(17, 29, 15, 8, C.ink);
      p.rect(18, 30, 13, 6, C.woodDark);
      p.text("LTD", 19, 30, C.flowerYellow);
      wheel(p, 11, 40);
      wheel(p, 37, 40);
    }),
);

/** The lantern on the right post, flickering between two flames. */
export const lantern = cached(
  (lit: boolean) => String(lit),
  (lit: boolean) =>
    bake(7, 10, (p) => {
      p.px(3, 0, C.ink);
      p.rect(1, 1, 5, 1, C.ink);
      p.rect(1, 2, 5, 6, C.ink);
      p.rect(2, 3, 3, 4, lit ? C.lamp : "#f5c86a");
      p.px(3, lit ? 4 : 5, C.white);
      p.rect(1, 8, 5, 1, C.metal);
      p.px(3, 9, C.ink);
    }),
);

/** A soft glow under the lantern at night-ish moments: a few translucent rings. */
export function glow(g: CanvasRenderingContext2D, cx: number, cy: number, r: number): void {
  g.fillStyle = gradient(g, `lantern ${cx},${cy},${r}`, () => {
    const grad = g.createRadialGradient(cx, cy, 1, cx, cy, r);
    grad.addColorStop(0, "rgba(255, 226, 138, 0.35)");
    grad.addColorStop(1, "rgba(255, 226, 138, 0)");
    return grad;
  });
  g.fillRect(cx - r, cy - r, r * 2, r * 2);
}

/** Who the merchant is under the hat. */
const MERCHANT_LOOK: Look = {
  style: 0,
  skin: 2,
  hair: 4,
  outfit: 4,
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

/** The merchant's own hat: wide, plum, with a gold band and a feather. Not for sale. */
// Pixel art reads as a grid.
// prettier-ignore
const HAT = {
  down: ["...........ff...", ".....oooooofF...", "....oppppppo....", "....oYYYYYYo....", "..oPPPPPPPPPPo.."],
  side: ["......ff........", ".....oFfoooo....", "....oppppppo....", "....oYYYYYYo....", "...oPPPPPPPPPPo."],
};
const HAT_PAL = { o: C.ink, p: "#7a3b6e", P: "#5a2a52", Y: "#e9b73d", f: "#f5d14a", F: "#e8584f" };
/** A grey moustache, over the mouth. */
const MOUSTACHE = { down: ["......mmmm......", ".....m....m....."], side: ["........mmmm...."] };

/** The merchant standing, facing `facing` (down or to the side). */
export const merchantFrame = cached(
  (facing: Facing) => facing,
  (facing: Facing) =>
    bake(16, 16, (p) => {
      const view = facing === "down" ? "down" : "side";
      const flip = facing === "left";
      p.g.drawImage(characterFrame(MERCHANT_LOOK, facing, "stand"), 0, 0);
      p.grid(MOUSTACHE[view], { m: "#d9d3c6" }, 0, 7, flip);
      p.grid(HAT[view], HAT_PAL, 0, 0, flip);
    }),
);

/** The pitch while the cart is away: a little signpost. */
export const signpost = once(() =>
  bake(16, 24, (p) => {
    p.rect(3, 22, 10, 2, C.shadow);
    p.rect(7, 8, 2, 15, C.woodDark);
    p.rect(1, 2, 14, 8, C.ink);
    p.rect(2, 3, 12, 6, C.wood);
    p.rect(2, 3, 12, 1, C.woodLight);
    // A tiny cart on it.
    p.rect(5, 5, 6, 2, C.roofRed);
    p.px(5, 7, C.ink);
    p.px(10, 7, C.ink);
  }),
);
