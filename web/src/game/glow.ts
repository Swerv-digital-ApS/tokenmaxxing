import { hash } from "../art/pixels.ts";

/**
 * Soft light to add over a scene: one baked radial gradient per colour, drawn "lighter" so it adds up.
 * The sky's lamps and windows (`sky.ts`), the Tavern's hearth and sconces, and the basement's screens
 * all use it.
 */

/** A radial glow of `size`×`size`: `rgb` ("255,214,120") at the centre, fading out to nothing. */
export function bakeGlow(size: number, rgb: string): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const g = c.getContext("2d")!;
  const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, `rgba(${rgb},1)`);
  grad.addColorStop(0.35, `rgba(${rgb},0.4)`);
  grad.addColorStop(1, `rgba(${rgb},0)`);
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  return c;
}

const baked = new Map<string, HTMLCanvasElement>();

/** The glow sprite for a colour, baked once. */
export function glowSprite(rgb: string): HTMLCanvasElement {
  const hit = baked.get(rgb);
  if (hit) return hit;
  const c = bakeGlow(64, rgb);
  baked.set(rgb, c);
  return c;
}

/**
 * A glow of `radius` world pixels around (x, y), at `alpha`, added to what's there. Call it in world
 * space, after the scene is drawn (and after any darkening, so the light shines through it).
 */
export function drawGlow(
  g: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  rgb: string,
  alpha: number,
): void {
  if (alpha <= 0.01) return;
  const was = g.globalCompositeOperation;
  g.globalCompositeOperation = "lighter";
  g.globalAlpha = Math.min(1, alpha);
  g.drawImage(glowSprite(rgb), x - radius, y - radius, radius * 2, radius * 2);
  g.globalAlpha = 1;
  g.globalCompositeOperation = was;
}

/** A fire's flicker: about 0.8 to 1.2, quick and uneven, different for each `seed`. */
export const flicker = (now: number, seed = 0): number => {
  const t = now / 90;
  return (
    1 +
    0.12 * Math.sin(t + seed * 2.1) +
    0.08 * Math.sin(t * 2.3 + seed) +
    (hash(Math.floor(t), seed, 5) - 0.5) * 0.1
  );
};
