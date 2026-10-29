import { PET_W, petTop } from "./pets.ts";
import { bake, cached, once, type Palette } from "./pixels.ts";

/**
 * The legendary level's look, drawn from the level alone: a golden halo floating over the head, a
 * soft glow behind the body and sparkles drifting up through it, and a little crown on the pet.
 * The aura is `AURA_W`×`AURA_H` with the 16×16 character at (`AURA_X`, `AURA_Y`) inside it.
 */

export const AURA_X = 3;
export const AURA_Y = 6;
export const AURA_W = 22;
export const AURA_H = 26;
const FRAMES = 6;
const FRAME_MS = 140;

// Pixel art reads as a grid.
// prettier-ignore
const HALO = [
  ".YwyyyyyY.",
  "Y........Y",
  ".YDDDDDDY.",
];
const HALO_COLORS: Palette = { w: "#fffbe0", y: "#ffe066", Y: "#f5c842", D: "#c98e22" };

/** Where each sparkle starts, low on the body; they rise 2px a frame and fade. */
const SPARKS: [number, number][] = [
  [2, 20],
  [19, 16],
  [5, 12],
  [17, 23],
];

const frame = cached(
  (i: number, glow: boolean) => `${i}:${glow}`,
  (i: number, glow: boolean) =>
    bake(AURA_W, AURA_H, (p) => {
      // The glow: three rings of see-through gold, the outer one breathing in and out.
      const cx = AURA_X + 8;
      const cy = AURA_Y + 9;
      if (glow) {
        p.disc(cx, cy, i % 3 === 0 ? 10 : 9, "rgba(255, 214, 74, 0.12)");
        p.disc(cx, cy, 8, "rgba(255, 214, 74, 0.14)");
        p.disc(cx, cy, 6, "rgba(255, 236, 150, 0.16)");
      }
      // The halo bobs a pixel, half the time.
      p.grid(HALO, HALO_COLORS, AURA_X + 3, 1 + (i < FRAMES / 2 ? 0 : 1));
      SPARKS.forEach(([x, y], s) => {
        const phase = (i + s * 2) % FRAMES;
        const sy = y - phase * 2;
        if (phase === 2 || phase === 3) {
          p.px(x, sy - 1, "#ffe066");
          p.px(x - 1, sy, "#ffe066");
          p.px(x + 1, sy, "#ffe066");
          p.px(x, sy + 1, "#ffe066");
          p.px(x, sy, "#fffbe0");
        } else if (phase < 5) p.px(x, sy, phase === 4 ? "#f5c842" : "#fffbe0");
      });
    }),
);

/**
 * The aura at time `now`, to draw behind a character at (x − `AURA_X`, y − `AURA_Y`). `glow`: the
 * see-through gold behind the body, which suits the world's floors but muddies a dark panel.
 */
export const auraFrame = (now: number, glow = true): HTMLCanvasElement =>
  frame(Math.floor(now / FRAME_MS) % FRAMES, glow);

/** How far the halo reaches over the head, for the name tag to sit above it. */
export const HALO_LIFT = 8;

// Pixel art reads as a grid.
// prettier-ignore
const CROWN = [
  "y.y.y",
  "yyryy",
  "YYYYY",
];
const crown = once(() => bake(5, 3, (p) => p.grid(CROWN, { y: "#ffe066", Y: "#c98e22", r: "#e0405a" })));

/** The pet's crown and where it sits on the pet's frame: on the top of its head. */
export function petCrown(
  pet: number,
  left: boolean,
  hop: boolean,
): [HTMLCanvasElement, number, number] | null {
  const top = petTop(pet, hop);
  if (!top) return null;
  const x = Math.round(left ? PET_W - 1 - top.x : top.x) - 2;
  return [crown(), x, top.y - 2];
}
