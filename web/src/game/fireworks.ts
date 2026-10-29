/**
 * Fireworks over the town (`core/src/fireworks.ts`). Anything that wants a show adds a source here: a
 * function from the world's clock to the show up then, or null. The star counter's milestones are one
 * (`stars.ts`); a show on the clock alone (New Year's at midnight) is just as easy. Both renderers draw
 * `showsNow`: `drawFireworks` on the 2D canvas, `Fireworks3d` in the 3D town's sky.
 * `?fireworks` puts on a show from when the page loads, for screenshots.
 */
import {
  climbOf,
  type Fireworks,
  fireworksOn,
  type Rocket,
  rocketsAt,
  sparkAt,
  sparkFade,
} from "@tokenmaxxing/core/fireworks.ts";
import { newYearShow } from "@tokenmaxxing/core/newyear.ts";
import { TILE } from "@tokenmaxxing/core/world.ts";
import type { Frame } from "./frame.ts";
import { serverNow, world } from "./world.ts";

type Source = (now: number) => Fireworks | null;

const sources = new Set<Source>();

/** Adds a source of shows; the function it returns takes it away again. */
export function addFireworks(source: Source): () => void {
  sources.add(source);
  return () => sources.delete(source);
}

// New Year's at midnight (`core/src/newyear.ts`).
addFireworks(newYearShow);

if (typeof location !== "undefined" && new URLSearchParams(location.search).has("fireworks")) {
  const at = Date.now();
  addFireworks(() => ({ at, ms: 60_000, x: 10, y: 4.5, w: 8, h: 2.5, seed: 1 }));
}

/** The shows with something in the air at `now` (the world's clock), in the town only. */
export function showsNow(now = serverNow()): Fireworks[] {
  if (world.room !== "town") return [];
  const out: Fireworks[] = [];
  for (const source of sources) {
    const show = source(now);
    if (show && fireworksOn(show, now)) out.push(show);
  }
  return out;
}

/** Every rocket in the air now, over all the shows. */
export const rocketsNow = (now = serverNow()): Rocket[] => showsNow(now).flatMap((s) => rocketsAt(s, now));

/** The 2D town: rockets climbing on a short trail, then their sparks, over everything else. */
export function drawFireworks({ g, labels, toScreen, scale }: Frame): void {
  const rockets = rocketsNow();
  if (rockets.length === 0) return;
  labels.push(() => {
    g.save();
    const size = Math.max(2, 2 * scale);
    for (const r of rockets) {
      const gx = (r.x + 0.5) * TILE;
      const gy = (r.y + 0.5) * TILE;
      g.fillStyle = r.colour;
      if (r.burst === null) {
        const top = climbOf(r);
        for (let i = 0; i < 4; i++) {
          const [sx, sy] = toScreen(gx, gy - (top - i * 0.25) * TILE);
          g.globalAlpha = 1 - i * 0.25;
          g.fillRect(sx - size / 2, sy - size / 2, size, size);
        }
        continue;
      }
      const cy = gy - r.height * TILE;
      // The flash as it bursts.
      if (r.burst < 0.15) {
        const [fx, fy] = toScreen(gx, cy);
        g.globalAlpha = 0.5 * (1 - r.burst / 0.15);
        g.beginPath();
        g.arc(fx, fy, r.radius * 0.6 * TILE * scale, 0, Math.PI * 2);
        g.fill();
      }
      g.globalAlpha = sparkFade(r);
      for (let i = 0; i < r.sparks; i++) {
        const [dx, dy] = sparkAt(r, i);
        const [sx, sy] = toScreen(gx + dx * TILE, cy - dy * TILE);
        g.fillRect(sx - size / 2, sy - size / 2, size, size);
      }
    }
    g.restore();
  });
}
