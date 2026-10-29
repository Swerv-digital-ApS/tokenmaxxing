/**
 * Halloween in town (`core/src/halloween.ts`): the jack-o'-lanterns on the doorsteps and in the patch by the
 * pond, for the week up to it. Their faces light up with the street lamps, and glow through the night's tint.
 * `?sky=2026-10-31T21:00` shows them lit.
 */
import { type Pumpkin, pumpkinSpots, pumpkinsOut } from "@tokenmaxxing/core/halloween.ts";
import type { GameMap } from "@tokenmaxxing/core/maps.ts";
import { TILE } from "@tokenmaxxing/core/world.ts";
import { pumpkinSprite } from "../art/halloween.ts";
import type { Frame } from "./frame.ts";
import { drawGlow, flicker } from "./glow.ts";
import { lightsNow, skyNow } from "./sky.ts";
import { world } from "./world.ts";

/** How bright the lamps must be for the candles to be lit. */
const LIT_FROM = 0.3;

/** Whether the candles are lit: with the street lamps (both renderers ask). */
export const candlesLit = (now: number): boolean => lightsNow(now) > LIT_FROM;

/** Whether they're out, asked once a minute: the window opens and shuts on a day (both renderers ask). */
let out = { minute: Number.NaN, on: false };
export function pumpkinsOutNow(): boolean {
  const minute = Math.floor(skyNow() / 60_000);
  if (minute !== out.minute) out = { minute, on: pumpkinsOut(skyNow()) };
  return out.on;
}

let spots: { map: GameMap; pumpkins: Pumpkin[] } | null = null;

/** The pumpkins in town now, or none. */
export function pumpkinsNow(): Pumpkin[] {
  if (world.room !== "town" || !pumpkinsOutNow()) return [];
  if (spots?.map !== world.map) spots = { map: world.map, pumpkins: pumpkinSpots(world.map) };
  return spots.pumpkins;
}

export function drawPumpkins({ g, items, now }: Frame): void {
  const lit = candlesLit(now);
  for (const { x, y, big } of pumpkinsNow()) {
    const s = pumpkinSprite(big, lit);
    items.push({
      y: (y + 1) * TILE - 2,
      draw: () => g.drawImage(s, x * TILE + Math.floor((TILE - s.width) / 2), (y + 1) * TILE - 1 - s.height),
    });
  }
}

/** The candles' glow, over the night's tint (`drawLight`), at `strength` (the lamps'). In world space. */
export function lightPumpkins(g: CanvasRenderingContext2D, strength: number, now: number): void {
  if (!candlesLit(now)) return;
  for (const [i, { x, y, big }] of pumpkinsNow().entries())
    drawGlow(
      g,
      x * TILE + TILE / 2,
      (y + 1) * TILE - (big ? 6 : 4),
      big ? 11 : 8,
      "255,150,40",
      strength * 0.75 * flicker(now, i),
    );
}
