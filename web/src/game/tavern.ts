import { TILE } from "@tokenmaxxing/core/world.ts";
import { hash } from "../art/pixels.ts";
import { FLAME_AT, HEARTH_H, hearthFlame, sconce } from "../art/tavern.ts";
import { drawJulefrokost } from "./december.ts";
import type { Frame } from "./frame.ts";
import { drawGlow, flicker } from "./glow.ts";
import { drawBarTab, drawRegulars } from "./regulars.ts";
import { darknessNow, warmthNow } from "./sky.ts";
import { drawTavernBand } from "./tavern-band.ts";
import { bandPlaying } from "./tavern-performance.ts";
import { world } from "./world.ts";

/**
 * The Tavern's evening (`inn` only). Rooms get no sky, so it has its own pass: the fire burns in the
 * hearth, sconces glow along the wall, and once the sun is down the room dims, the fire and candles
 * light it. The stage plays from 16:00 on the town clock. By day it's bright and the glow is faint.
 */

/** Wall sconces: tiles on the wall face (row 1), either side of the boards. */
const SCONCES: readonly (readonly [number, number])[] = [
  [11, 1],
  [19, 1],
];

const FIRE = "255,150,60";
const CANDLE = "255,206,120";
/** How dark the room gets: the sky's darkness times this, as the overlay's alpha (the basement is 0.5 always). */
const NIGHT_DIM = 0.66;
/** The low sun's warmth times this adds a dusk step before the dark comes. */
const DUSK_DIM = 0.45;
/** Notes drift up while the evening band is playing. */
const NOTES = 7;

/** The left tile of each hearth in a run (hearths are two tiles wide). */
const hearths = () => world.map.find("f").filter(([x, y]) => world.map.at(x - 1, y) !== "f");

/** Queues the fire in each hearth and the sconces. Nothing in any other room. */
export function drawTavern(f: Frame): void {
  const { g, items, now } = f;
  if (world.map.id !== "inn") return;
  const frame = Math.floor(now / 160) % 2;
  for (const [x, y] of hearths()) {
    const sprite = hearthFlame(frame);
    // Just after the hearth, so the fire is in its opening.
    items.push({
      y: y * TILE + TILE - 0.5,
      draw: () => g.drawImage(sprite, x * TILE + FLAME_AT.x, (y + 1) * TILE - HEARTH_H + FLAME_AT.y + 1),
    });
  }
  drawRegulars(f);
  drawBarTab(f);
  drawJulefrokost(f);
  drawTavernBand(f);
  for (const [x, y] of SCONCES) {
    const s = sconce(Math.floor(now / 140 + x) % 2);
    items.push({ y: y * TILE + 4, draw: () => g.drawImage(s, x * TILE + 5, y * TILE + 2) });
  }
}

/**
 * The room's light, over the drawn scene and under the labels (world space): dims it after dark, then
 * adds the fire, the sconces and the candles on the tap and tables, and drifts notes up from the stage.
 */
export function lightTavern({ g, now }: Frame): void {
  const map = world.map;
  if (map.id !== "inn") return;
  const dark = darknessNow(now);
  const dusk = warmthNow(now) * (1 - dark);
  const dim = Math.min(0.7, dark * NIGHT_DIM + dusk * DUSK_DIM);
  if (dim > 0.01) {
    // Blue at night, a warm brown at dusk.
    const [r, gr, b] = [14 + 50 * dusk, 18 + 6 * dusk, 46 - 16 * dusk].map(Math.round);
    g.fillStyle = `rgba(${r}, ${gr}, ${b}, ${dim.toFixed(3)})`;
    g.fillRect(map.x0 * TILE, map.y0 * TILE, map.width * TILE, map.height * TILE);
  }
  // Light is strongest in the dark, but the fire always shows a little.
  const lit = Math.min(1, 0.35 + 0.65 * Math.max(dark, dusk * 0.7));
  for (const [i, [x, y]] of hearths().entries()) {
    const k = flicker(now, i);
    const cx = (x + 1) * TILE;
    const cy = (y + 1) * TILE - HEARTH_H / 2 + 4;
    drawGlow(g, cx, cy, 58 * k, FIRE, 0.55 * lit * k);
    drawGlow(g, cx, cy + 4, 22 * k, "255,214,120", 0.6 * lit);
  }
  for (const [i, [x, y]] of SCONCES.entries()) {
    const k = flicker(now, i + 3);
    drawGlow(g, x * TILE + 8, y * TILE + 5, 30 * k, CANDLE, 0.5 * lit * k);
  }
  // A candle on every table, and the tap's lamp on the bar.
  for (const [x, y] of [...map.find("n"), ...map.find("y")])
    drawGlow(g, x * TILE + 8, y * TILE + 7, 16, CANDLE, 0.3 * lit * flicker(now, x + y));
  if (bandPlaying()) notes(g, now);
}

/** `♪` and `♫` rising from the stage, each on its own slow loop. */
function notes(g: CanvasRenderingContext2D, now: number): void {
  const stage = world.map.find("e");
  if (!stage.length) return;
  const xs = stage.map(([x]) => x);
  const left = Math.min(...xs) * TILE;
  const right = (Math.max(...xs) + 1) * TILE;
  const top = Math.min(...stage.map(([, y]) => y)) * TILE;
  g.font = "9px sans-serif";
  g.textAlign = "center";
  g.textBaseline = "middle";
  for (let i = 0; i < NOTES; i++) {
    const t = (now / 3200 + i / NOTES) % 1;
    const x = left + 8 + hash(i, 1, 33) * (right - left - 16) + Math.sin(t * 6 + i) * 3;
    const y = top + 8 - t * 34;
    g.globalAlpha = Math.sin(t * Math.PI) * 0.9;
    g.fillStyle = i % 2 ? "#ffe9a8" : "#fff6d6";
    g.fillText(i % 3 ? "♪" : "♫", x, y);
  }
  g.globalAlpha = 1;
}
