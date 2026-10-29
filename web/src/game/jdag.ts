/**
 * J-dag in 2D (`core/src/jdag.ts`): Nissebryg's truck driving in along the road under the square at 20:59,
 * parked with its lights on till 03:00, and off again. E on it says what's on at the Tavern. On `skyNow()`, so
 * `?sky=2026-11-06T20:58` shows it arrive. The 3D truck is `render3d/town/truck3d.ts`, on the same `truckAt`.
 */
import { isTruck, JULEBRYG, TRUCK, truckAt } from "@tokenmaxxing/core/jdag.ts";
import { TILE } from "@tokenmaxxing/core/world.ts";
import { BULBS_Y, HEADLIGHT, TRUCK_PX, truckSprite } from "../art/jdag.ts";
import { hud } from "../store.ts";
import { type Frame, inView } from "./frame.ts";
import { drawGlow, flicker } from "./glow.ts";
import { sign } from "./labels.ts";
import { skyNow } from "./sky.ts";
import { world } from "./world.ts";

/** What its sign says, in both renderers. */
export const TRUCK_SIGN = `🍺 ${JULEBRYG.name} · free at the Tavern`;

/** What E on it says. */
export const TRUCK_SAYS = `The ${JULEBRYG.name} truck from ${JULEBRYG.brewery}. It's J-dag: the julebryg is out, and the Tavern pours it on the house all weekend. 🎅`;

/** Where the truck is now, in town, or null. */
export const truckNow = () => (world.room === "town" ? truckAt(skyNow()) : null);

export function drawTruck(f: Frame): void {
  const t = truckNow();
  if (!t) return;
  const left = Math.round(t.x * TILE);
  const bottom = (t.y + 1) * TILE;
  const top = bottom - TRUCK_PX.h;
  if (!inView(f, left, top, TRUCK_PX.w, TRUCK_PX.h, TILE)) return;
  const s = truckSprite();
  f.items.push({ y: bottom - 1, draw: () => f.g.drawImage(s, left, top) });
  if (!t.parked) return;
  const [sx, sy] = f.toScreen(left + TRUCK_PX.w / 2, top);
  f.labels.push(() => sign(f.g, sx, sy - 4 * f.dpr, TRUCK_SIGN, f.dpr, true));
}

/** Its headlight and fairy lights, over the night's tint (`drawLight`), at `strength` (the lamps'). In world space. */
export function lightTruck(g: CanvasRenderingContext2D, strength: number, now: number): void {
  const t = truckNow();
  if (!t) return;
  const left = Math.round(t.x * TILE);
  const top = (t.y + 1) * TILE - TRUCK_PX.h;
  drawGlow(g, left + HEADLIGHT[0], top + HEADLIGHT[1], 14, "255,224,138", strength * 0.8);
  for (let i = 0; i < 4; i++)
    drawGlow(g, left + 6 + i * 11, top + BULBS_Y, 7, "255,190,140", strength * 0.5 * flicker(now, i));
}

/** The parked truck takes up its tiles: a step onto it is no step. */
export const blocksTruck = (x: number, y: number): boolean =>
  world.room === "town" && isTruck(x, y, skyNow());

/** E on the truck: what it's here for. False when it isn't there. */
export function truckInteract(x: number, y: number): boolean {
  const t = truckNow();
  if (!t || y !== TRUCK.y || x < Math.floor(t.x) || x >= Math.ceil(t.x) + TRUCK.w) return false;
  hud.set({ dialog: TRUCK_SAYS });
  return true;
}
