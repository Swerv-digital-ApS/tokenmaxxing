/**
 * Sankt Hans in 2D (`core/src/sankthans.ts`): the bonfire on the lawn in front of the Tavern on 23 June, a pile
 * from the morning, burning from 21:00 to 01:00 with a glow through the dusk. E on it says what's going on. On
 * `skyNow()`, so `?sky=2027-06-23T22:00` shows it lit. The 3D bonfire is `render3d/town/bonfire3d.ts`.
 */
import { BONFIRE, bonfireAt, bonfireSays, isBonfire } from "@tokenmaxxing/core/sankthans.ts";
import { TILE } from "@tokenmaxxing/core/world.ts";
import { FIRE_AT, fireSprite, PILE_PX, pileSprite } from "../art/sankthans.ts";
import { hud } from "../store.ts";
import { type Frame, inView } from "./frame.ts";
import { drawGlow, flicker } from "./glow.ts";
import { skyNow } from "./sky.ts";
import { world } from "./world.ts";

/** The bonfire now, in town: asked once a second (it changes on the minute). */
let shown = { second: Number.NaN, state: null as ReturnType<typeof bonfireAt> };
export function bonfireNow(): ReturnType<typeof bonfireAt> {
  if (world.room !== "town") return null;
  const second = Math.floor(skyNow() / 1000);
  if (second !== shown.second) shown = { second, state: bonfireAt(skyNow()) };
  return shown.state;
}

const left = () => BONFIRE.x * TILE;
const top = () => (BONFIRE.y + 1) * TILE - PILE_PX.h;

export function drawBonfire(f: Frame): void {
  const state = bonfireNow();
  if (!state || !inView(f, left(), top(), PILE_PX.w, PILE_PX.h, TILE)) return;
  const pile = pileSprite();
  const [x, y] = [left(), top()];
  f.items.push({
    y: (BONFIRE.y + 1) * TILE - 1,
    draw: () => {
      f.g.drawImage(pile, x, y);
      if (state === "lit") f.g.drawImage(fireSprite(Math.floor(f.now / 140) % 2), x, y);
    },
  });
}

/** The fire's glow, over the night's tint (`drawLight`), in world space. It shows by day too, faintly. */
export function lightBonfire(g: CanvasRenderingContext2D, strength: number, now: number): void {
  if (bonfireNow() !== "lit") return;
  const k = flicker(now, 7);
  drawGlow(g, left() + FIRE_AT[0], top() + FIRE_AT[1], 46 * k, "255,150,60", (0.35 + 0.6 * strength) * k);
}

export const blocksBonfire = (x: number, y: number): boolean =>
  world.room === "town" && isBonfire(x, y, skyNow());

/** E on the bonfire. False when there's none. */
export function bonfireInteract(x: number, y: number): boolean {
  const state = bonfireNow();
  if (!state || !isBonfire(x, y, skyNow())) return false;
  hud.set({ dialog: bonfireSays(state) });
  return true;
}
