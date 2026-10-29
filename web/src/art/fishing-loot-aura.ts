import { FISHING_BASE } from "@tokenmaxxing/core/fishing-loot.ts";
import type { Pen } from "./pixels.ts";

/**
 * The pond treasures' legendary aura in 2D (`core/src/fishing-loot.ts`, slot "aura"): the draw `case-aura.ts` files
 * under `FISHING_BASE + n`, on the same 28×28 frame with the 16×16 character at (6, 6), eight frames to a loop.
 */

const CX = 14;
const TAU = Math.PI * 2;
const FRAMES = 8;

type Draw = (p: Pen, f: number) => void;

const RIM = "rgba(200, 240, 255, 0.95)";
const FILL = "rgba(140, 205, 255, 0.3)";
const GLINT = "#ffffff";

/** One bubble of `size` 2, 3 or 4 pixels across with its top left at (`x`, `y`): a pale rim, a faint fill, a glint. */
function bubble(p: Pen, x: number, y: number, size: number): void {
  if (size === 2) {
    p.px(x, y, GLINT);
    p.px(x + 1, y, RIM);
    p.px(x, y + 1, RIM);
    p.px(x + 1, y + 1, RIM);
    return;
  }
  const e = size - 1;
  for (let i = 0; i <= e; i++) {
    // A bubble of 4 or more has rounded corners.
    const corner = size > 3 && (i === 0 || i === e);
    for (const [bx, by] of [
      [i, 0],
      [i, e],
      [0, i],
      [e, i],
    ] as const)
      if (!(corner && (bx === 0 || bx === e) && (by === 0 || by === e))) p.px(x + bx, y + by, RIM);
  }
  for (let j = 1; j < e; j++) for (let i = 1; i < e; i++) p.px(x + i, y + j, FILL);
  // The glint sits on the rim of a small bubble and just inside a big one.
  const g = size > 3 ? 1 : 0;
  p.px(x + g, y + g, GLINT);
}

/** The pop: four specks flung out of where a bubble of `size` was. */
function pop(p: Pen, x: number, y: number, size: number): void {
  const e = size + 1;
  p.px(x - 1, y - 1, GLINT);
  p.px(x + e - 1, y - 1, RIM);
  p.px(x - 1, y + e - 1, RIM);
  p.px(x + e - 1, y + e - 1, GLINT);
}

// Bubble stream: bubbles lift off round the feet, wobble up past the shoulders in three sizes, and pop at different
// heights, some above the head. Each one is on its own lap of the loop, so the stream never bunches.
const SIZES = [3, 2, 4, 2, 3, 4, 2, 3, 2];
const stream: Draw = (p, f) => {
  for (const [i, size] of SIZES.entries()) {
    const k = (f / FRAMES + i / SIZES.length) % 1;
    const side = i % 2 ? 1 : -1;
    const reach = 6 + ((i * 7) % 6);
    const wobble = Math.sin(k * TAU * 1.5 + i * 2.2) * 1.6;
    const x = Math.max(1, Math.min(27 - size, Math.round(CX + side * reach + wobble) - 1));
    const top = 3 + ((i * 5) % 9);
    const y = Math.round(24 - Math.min(k, 0.875) * ((24 - top) / 0.875));
    if (k >= 0.875) pop(p, x, y, size);
    else bubble(p, x, y, size);
  }
};

/** The draws by look index, for `case-aura.ts` to file with the cases'. */
export const FISHING_AURAS: Record<number, Draw> = {
  [FISHING_BASE + 0]: stream,
};
