/**
 * The windmill in 2D (`core/src/windmill.ts`): the tower is scenery (`art/objects.ts`); this turns its sails with
 * the weather on screen (`weatherNow`, so `?weather=storm` spins them and `?weather=fog` stills them) and says on
 * E how hard the wind blows. The 3D mill is `render3d/town/windmill3d.ts`, driven by the same `turnMill`.
 */
import type { GameMap } from "@tokenmaxxing/core/maps.ts";
import { type Mill, millSays, newMill, turnMill, WINDMILL } from "@tokenmaxxing/core/windmill.ts";
import { TILE } from "@tokenmaxxing/core/world.ts";
import { sortY } from "../art/objects.ts";
import { CAP, hubOffset, MILL_H, MILL_W, millSails, SAILS_HALF, sailsInFront } from "../art/windmill.ts";
import { hud } from "../store.ts";
import { type Frame, inView } from "./frame.ts";
import { weatherNow } from "./sky.ts";
import { world } from "./world.ts";

let mill: Mill | null = null;
let lastAt = 0;

/** Each windmill's top-left tile, per town map. */
const corners = new WeakMap<GameMap, [number, number][]>();
function millsOf(map: GameMap): [number, number][] {
  let found = corners.get(map);
  if (!found) {
    found = map
      .find(WINDMILL)
      .filter(([x, y]) => map.at(x - 1, y) !== WINDMILL && map.at(x, y - 1) !== WINDMILL)
      .map(([x, y]) => [x, y]);
    corners.set(map, found);
  }
  return found;
}

/** The sails of every windmill in view, turned on by this frame's share of the wind. */
export function drawWindmills(f: Frame): void {
  if (world.room !== "town") return;
  const weather = weatherNow();
  // Capped like the sky's, so a slow frame rate doesn't slow the sails, and coming back to the tab doesn't jump them.
  const dt = Math.min(0.5, Math.max(0, (f.now - lastAt) / 1000));
  lastAt = f.now;
  mill = mill ? turnMill(mill, weather, dt) : newMill(weather);
  const sails = millSails(mill.facing, mill.turn);
  const [hx, hy] = hubOffset(mill.facing);
  // Sails facing up the screen are behind the tower; facing down it or across, in front.
  const side = sailsInFront(mill.facing) ? 1 : -1;
  for (const [x, y] of millsOf(world.map)) {
    const left = x * TILE;
    const top = (y + 2) * TILE - MILL_H;
    const sx = left + CAP[0] + hx - SAILS_HALF;
    const sy = top + CAP[1] + hy - SAILS_HALF;
    if (!inView(f, Math.min(left, sx), sy, Math.max(MILL_W, SAILS_HALF * 2), SAILS_HALF * 2, TILE)) continue;
    f.items.push({ y: y * TILE + sortY(WINDMILL) + side, draw: () => f.g.drawImage(sails, sx, sy) });
  }
}

/** E on a windmill: the wind over Aarhus, and what it does to the sails. False when it's not one. */
export function windmillInteract(x: number, y: number): boolean {
  if (world.room !== "town" || world.map.at(x, y) !== WINDMILL) return false;
  hud.set({ dialog: millSays(weatherNow()) });
  return true;
}
