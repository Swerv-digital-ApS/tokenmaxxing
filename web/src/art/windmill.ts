import { C } from "./palette.ts";
import { bake, cached, once, type Pen } from "./pixels.ts";

/**
 * The windmill by the Tavern (`core/src/windmill.ts`): a Danish gallery mill, a brick base, a wooden gallery, a
 * white-washed tower and a dark cap. The tower is one sprite over its 2×2 tiles; the sails are baked per facing
 * and angle (rounded), so turning them is one `drawImage` a frame (`game/windmill.ts`).
 */

export const MILL_W = 32;
export const MILL_H = 64;
/** The cap's middle on the tower sprite: the windshaft comes out of it towards the wind. */
export const CAP: readonly [number, number] = [16, 12];
/** The sails' frame is this many pixels each side of the hub. */
export const SAILS_HALF = 26;

const BRICK = "#b0503f";
const BRICK_DARK = "#8e3d31";
const BRICK_LIGHT = "#c96a55";

/** A row of the tower `y` px down the sprite: its left edge and width (it tapers towards the cap). */
const towerRow = (y: number): [number, number] => {
  const half = Math.round(9 - ((41 - y) / 25) * 3);
  return [16 - half, half * 2];
};

export const millTower = once(() =>
  bake(MILL_W, MILL_H, (p) => {
    p.rect(3, 58, 26, 3, C.shadow);
    // The brick base, lit from the left, with a door.
    p.rect(5, 43, 22, 16, BRICK);
    p.rect(5, 43, 3, 16, BRICK_LIGHT);
    p.rect(23, 43, 4, 16, BRICK_DARK);
    for (let y = 46; y < 58; y += 3)
      for (let x = 6 + ((y / 3) % 2) * 2; x < 26; x += 4) p.px(x, y, BRICK_DARK);
    p.rect(13, 49, 6, 10, C.ink);
    p.rect(14, 50, 4, 9, C.woodDark);
    p.rect(14, 50, 4, 1, C.wood);
    p.px(17, 54, C.lamp);
    // The tower: white-washed, tapering, its octagon's edges in shade, a little window.
    for (let y = 16; y < 42; y++) {
      const [x, w] = towerRow(y);
      p.rect(x, y, w, 1, C.wall);
      p.rect(x, y, 2, 1, C.white);
      p.rect(x + w - 3, y, 3, 1, C.wallDark);
      p.px(x + Math.round(w * 0.3), y, C.wallDark);
      p.px(x + Math.round(w * 0.7), y, C.wallDark);
      p.px(x - 1, y, C.ink);
      p.px(x + w, y, C.ink);
    }
    p.rect(14, 25, 4, 5, C.ink);
    p.rect(15, 26, 2, 3, C.metalLight);
    // The gallery round it, on brackets, with its railing.
    p.rect(1, 41, 30, 3, C.wood);
    p.rect(1, 41, 30, 1, C.woodLight);
    p.rect(1, 44, 30, 1, C.woodDark);
    for (const x of [4, 10, 21, 27]) p.rect(x, 45, 1, 2, C.woodDark);
    p.rect(1, 36, 30, 1, C.woodDark);
    for (let x = 1; x < 31; x += 5) p.rect(x, 36, 1, 5, C.woodDark);
    // The cap: a rounded hood with a ridge.
    capDome(p);
  }),
);

function capDome(p: Pen): void {
  p.rect(7, 15, 18, 2, C.ink);
  p.disc(16, 15, 8, C.ink);
  p.disc(16, 15, 7, C.wallTop);
  p.disc(14, 13, 4, C.wallTopLight);
  p.rect(8, 15, 16, 1, C.wallTop);
  p.rect(7, 16, 18, 1, C.ink);
  p.rect(16, 7, 1, 8, C.ink);
}

/** Steps the baked sails are rounded to: the cap's facing every 10°, the sails' angle every 5° of a quarter turn. */
const FACINGS = 36;
const ANGLES = 18;
/** The sails' plane is sheared a little so that, side on to the view, they still read as sails. */
const SHEAR = 0.4;
/** How much a step towards or away from the view moves things up or down the screen. */
const DEPTH = 0.5;
const RADIUS = 23;
const CLOTH = 6;

/** The windshaft's end, where the sails turn, from the cap's middle (screen px) for compass `facing`. */
export function hubOffset(facing: number): [number, number] {
  const a = (facing * Math.PI) / 180;
  return [Math.round(Math.sin(a) * 6), Math.round(-Math.cos(a) * 6 * DEPTH)];
}

/** Whether sails facing `facing` are on the near side of the tower (they face down the screen, or across it). */
export const sailsInFront = (facing: number): boolean => Math.cos((facing * Math.PI) / 180) <= 0.01;

const sailsFrame = cached(
  (f: number, a: number) => `${f}:${a}`,
  (f: number, a: number) =>
    bake(SAILS_HALF * 2, SAILS_HALF * 2, (p) => {
      const facing = (f / FACINGS) * Math.PI * 2;
      // The sails' own right, as seen from in front of them, on screen; up is up.
      const rx = -Math.cos(facing) - SHEAR * Math.sin(facing);
      const ry = -Math.sin(facing) * DEPTH;
      const c = SAILS_HALF;
      const put = (x: number, y: number, colour: string) =>
        p.px(Math.round(c + x), Math.round(c + y), colour);
      // The windshaft, back into the cap.
      const [hx, hy] = hubOffset((f / FACINGS) * 360);
      for (let t = 0; t <= 1; t += 0.1) put(-hx * t, -hy * t, C.ink);
      const away = !sailsInFront((f / FACINGS) * 360);
      for (let i = 0; i < 4; i++) {
        const phi = (a / ANGLES) * (Math.PI / 2) + (i * Math.PI) / 2;
        // Along the stock, and across it towards the leading edge (they turn anticlockwise, seen from in front).
        const dx = Math.cos(phi) * rx;
        const dy = Math.cos(phi) * ry - Math.sin(phi);
        const ex = -Math.sin(phi) * rx;
        const ey = -Math.sin(phi) * ry - Math.cos(phi);
        // The lattice sail, on the trailing side of the stock: cloth in a frame, with bars across it.
        for (let s = RADIUS * 0.3; s <= RADIUS; s += 0.5)
          for (let b = 1; b <= CLOTH; b += 0.5) {
            const bar = Math.round(s) % 4 === 0 || b >= CLOTH - 0.25 || s >= RADIUS - 0.25;
            put(s * dx - b * ex, s * dy - b * ey, bar ? C.woodDark : away ? C.wallDark : C.white);
          }
        for (let s = 0; s <= RADIUS + 1; s += 0.5) put(s * dx, s * dy, C.trunkDark);
      }
      p.disc(c, c, 2, C.ink);
      p.px(c, c, C.metalLight);
    }),
);

/** The sails at compass `facing`, `turn` turns round (they look the same every quarter turn). */
export function millSails(facing: number, turn: number): HTMLCanvasElement {
  const f = Math.round((((facing % 360) + 360) % 360) / (360 / FACINGS)) % FACINGS;
  const a = Math.floor(((((turn * 4) % 1) + 1) % 1) * ANGLES) % ANGLES;
  return sailsFrame(f, a);
}
