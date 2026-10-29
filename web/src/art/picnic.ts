/** The outage picnic: gingham blankets, a wicker basket and bunting between the square's lamps. */
import { C } from "./palette.ts";
import { bake, cached, once, type Pen } from "./pixels.ts";

/** Gingham: [main, where a main stripe crosses white, white]. Red for the first blanket, blue for the next. */
const GINGHAM: [string, string, string][] = [
  [C.roofRed, "#ec9c8f", C.white],
  [C.fabric, "#b3bde6", C.white],
];
const CHECK = 4;

/** A blanket `w × h` tiles, a little rumpled at the corners, with a snack or two on it. */
export const blanket = cached(
  (w: number, h: number, i: number) => `${w}x${h}:${i}`,
  (w: number, h: number, i: number) => {
    const W = w * 16;
    const H = h * 16;
    return bake(W, H + 1, (p) => {
      const [main, mix, white] = GINGHAM[i % GINGHAM.length]!;
      p.rect(1, 2, W - 2, H - 1, C.shadow);
      // Inset a pixel so the grass shows at the corners: a cloth, not a tile.
      for (let y = 1; y < H - 1; y++)
        for (let x = 1; x < W - 1; x++) {
          const a = Math.floor(x / CHECK) % 2 === 0;
          const b = Math.floor(y / CHECK) % 2 === 0;
          p.px(x, y, a && b ? main : a || b ? mix : white);
        }
      // A hem, and the corners turned up a little.
      p.rect(1, 1, W - 2, 1, main);
      p.rect(1, H - 2, W - 2, 1, main);
      p.rect(1, H - 1, W - 2, 1, C.ink);
      for (const [x, y] of [
        [1, 1],
        [W - 2, 1],
        [1, H - 2],
        [W - 2, H - 2],
      ] as const)
        p.px(x, y, white);
      snacks(p, W, H, i);
    });
  },
);

/** A plate of sandwiches and a cup of juice, in a front corner where nobody sits (`PICNIC_SEATS`). */
function snacks(p: Pen, W: number, H: number, i: number): void {
  const x = i % 2 === 0 ? W - 15 : 3;
  const y = H - 13;
  // The plate.
  p.rect(x, y + 2, 10, 5, C.stoneLight);
  p.rect(x + 1, y + 1, 8, 7, C.stoneLight);
  p.rect(x + 1, y + 7, 8, 1, C.stone);
  // Two sandwich halves: bread, lettuce, bread.
  for (const sx of [x + 1, x + 5]) {
    p.rect(sx, y + 2, 4, 1, C.pathLight);
    p.rect(sx, y + 3, 4, 1, C.leafLight);
    p.rect(sx, y + 4, 4, 1, C.path);
    p.px(sx + 3, y + 2, C.pathDark);
  }
  // A cup of orange juice.
  const cx = i % 2 === 0 ? x - 5 : x + 12;
  p.rect(cx, y + 2, 3, 5, C.white);
  p.rect(cx, y + 2, 3, 1, C.rugLight);
  p.rect(cx, y + 6, 3, 1, C.stone);
}

/** A wicker basket with its lid open: a cloth peeking out and a baguette. */
export const basket = once(() =>
  bake(16, 18, (p) => {
    p.rect(2, 16, 12, 2, C.shadow);
    // The handle.
    p.rect(4, 1, 8, 1, C.woodDark);
    p.rect(3, 2, 1, 5, C.woodDark);
    p.rect(12, 2, 1, 5, C.woodDark);
    p.rect(5, 2, 6, 1, C.wood);
    // A baguette sticking out, and the checked cloth.
    p.rect(9, 3, 3, 6, C.pathDark);
    p.rect(10, 3, 1, 5, C.path);
    p.px(10, 4, C.pathLight);
    p.rect(3, 6, 6, 3, C.white);
    p.px(4, 6, C.roofRed);
    p.px(6, 7, C.roofRed);
    p.px(4, 8, C.roofRed);
    p.px(8, 6, C.roofRed);
    // The wicker body: woven rows.
    p.rect(1, 8, 14, 8, C.ink);
    p.rect(2, 9, 12, 6, C.woodLight);
    for (let y = 9; y < 15; y++) for (let x = 2 + (y % 2); x < 14; x += 2) p.px(x, y, C.wood);
    p.rect(2, 9, 12, 1, C.woodDark);
    p.rect(2, 14, 12, 1, C.woodDark);
  }),
);

const PENNANTS = [C.roofRed, C.flowerYellow, C.fabric, C.leafLight, C.white, C.rugLight];

/**
 * A string of bunting `w` pixels long that sags `sag` in the middle, with pennants every 8 pixels.
 * Its top-left is the first lamp's head.
 */
export const bunting = cached(
  (w: number, sag: number) => `${w}:${sag}`,
  (w: number, sag: number) =>
    bake(w + 1, sag + 8, (p) => {
      const at = (x: number) => Math.round((4 * sag * x * (w - x)) / (w * w));
      for (let x = 0; x <= w; x++) p.px(x, at(x), C.trunkDark);
      for (let x = 6, n = 0; x + 5 < w - 2; x += 8, n++) {
        const color = PENNANTS[n % PENNANTS.length]!;
        const y = Math.min(at(x), at(x + 4)) + 1;
        // A triangle hanging off the string, its point down.
        p.rect(x, y, 5, 2, color);
        p.rect(x + 1, y + 2, 3, 2, color);
        p.px(x + 2, y + 4, color);
        p.px(x, y, C.ink);
        p.px(x + 4, y, C.ink);
      }
    }),
);
