/**
 * December in the 2D game (`core/src/december.ts`): julefrokost in the Tavern, its tables laid with a red runner,
 * plates and snaps, on Friday and Saturday evenings. The calendar is the HUD's (`hud/Julekalender.tsx`), the snow
 * is `decemberSnow` in `weatherNow`. On `skyNow()`, so `?sky=2026-12-11T19:00` shows the julefrokost. The 3D
 * spread is `render3d/rooms/julefrokost3d.ts`.
 */
import { julefrokostOn } from "@tokenmaxxing/core/december.ts";
import { TILE } from "@tokenmaxxing/core/world.ts";
import { placeSetting } from "../art/december.ts";
import { sortY } from "../art/objects.ts";
import type { Frame } from "./frame.ts";
import { skyNow } from "./sky.ts";
import { world } from "./world.ts";

/** Whether it's julefrokost, asked once a minute (it starts on the hour). */
let tonight = { minute: Number.NaN, on: false };
export function julefrokostNow(): boolean {
  const minute = Math.floor(skyNow() / 60_000);
  if (minute !== tonight.minute) tonight = { minute, on: julefrokostOn(skyNow()) };
  return tonight.on;
}

/** A place setting on every tile of every table in the Tavern, at julefrokost. */
export function drawJulefrokost({ g, items }: Frame): void {
  if (world.map.id !== "inn" || !julefrokostNow()) return;
  const s = placeSetting();
  for (const [x, y] of world.map.find("n"))
    items.push({ y: y * TILE + sortY("n") + 0.01, draw: () => g.drawImage(s, x * TILE, y * TILE) });
}
