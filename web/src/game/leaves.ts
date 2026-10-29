import type { Weather } from "@tokenmaxxing/core/sky.ts";
import { windPush } from "./sky.ts";

/**
 * Leaves coming down from the town's trees in autumn (`SeasonLook.falling`): a few dozen pixels in world space at
 * most, each let go from a tree in view, fluttering down to the grass under it, lying a moment and gone. Cheap by
 * design: no canvases, one `fillRect` a leaf.
 */

interface Leaf {
  x: number;
  y: number;
  /** Where it lands. */
  floor: number;
  ph: number;
  colour: string;
  /** Seconds since it landed, or -1 while it falls. */
  lying: number;
}

/** At most this many leaves, and this many for each tree in view. */
const MAX = 60;
const PER_TREE = 1.2;
const LIE_S = 1.6;
const COLOURS = ["#e08a3a", "#e8bf3e", "#d4483a", "#f5b05a", "#b8612a"];

let leaves: Leaf[] = [];
let lastAt = 0;

/** Falls and draws the leaves: `trees` are the sprites in view (top left, 16 by 26), `falling` 0..1. */
export function drawLeaves(
  g: CanvasRenderingContext2D,
  trees: readonly (readonly [number, number])[],
  falling: number,
  weather: Weather,
  now: number,
): void {
  const dt = Math.min(0.1, (now - lastAt) / 1000);
  lastAt = now;
  const want = Math.round(Math.min(MAX, trees.length * PER_TREE) * falling);
  if (!want && !leaves.length) return;
  // A leaf or two let go each frame until there are enough; the wind takes more.
  const push = windPush(weather);
  for (let i = 0; i < 2 && leaves.length < want && trees.length; i++) {
    const [tx, ty] = trees[Math.floor(Math.random() * trees.length)]!;
    leaves.push({
      x: tx + 2 + Math.random() * 12,
      y: ty + 2 + Math.random() * 11,
      floor: ty + 19 + Math.random() * 9,
      ph: Math.random() * 6.28,
      colour: COLOURS[Math.floor(Math.random() * COLOURS.length)]!,
      lying: -1,
    });
  }
  const gust = 1 + Math.min(1, weather.windMs / 8);
  for (const l of leaves) {
    if (l.lying >= 0) {
      l.lying += dt;
      continue;
    }
    l.y += (7 + Math.sin(now / 260 + l.ph) * 3) * gust * dt;
    l.x += (Math.sin(now / 520 + l.ph) * 9 + push * 22) * dt;
    if (l.y >= l.floor) l.lying = 0;
  }
  leaves = leaves.filter((l) => l.lying < LIE_S);
  if (leaves.length > want + 8) leaves.length = want + 8;
  for (const l of leaves) {
    g.globalAlpha = l.lying < 0 ? 1 : 1 - l.lying / LIE_S;
    g.fillStyle = l.colour;
    // Tumbling: wide, then tall, as it turns over.
    const flat = l.lying >= 0 || Math.sin(now / 160 + l.ph) > 0;
    g.fillRect(Math.round(l.x), Math.round(l.y), flat ? 2 : 1, flat ? 1 : 2);
  }
  g.globalAlpha = 1;
}
