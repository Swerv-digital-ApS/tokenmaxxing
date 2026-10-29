/**
 * The outage picnic in the page: what `world` says (the `outage` event), or `?picnic=claude|openai|both|off`
 * to force it for screenshots (only here: the blankets seat you only when the server has a picnic too).
 */
import { BASKET, BLANKETS, forcedOutage, type Outage, onBlanket } from "@tokenmaxxing/core/picnic.ts";
import { TILE } from "@tokenmaxxing/core/world.ts";
import { useSyncExternalStore } from "react";
import { basket, blanket, bunting } from "../art/picnic.ts";
import type { Frame } from "./frame.ts";
import { world } from "./world.ts";

const forced = forcedOutage(new URLSearchParams(location.search).get("picnic"), Date.now());
let fromServer: Outage | null = null;
const listeners = new Set<() => void>();

export const outageNow = (): Outage | null => (forced === undefined ? fromServer : forced);

export function setOutage(o: Outage | null): void {
  fromServer = o;
  for (const l of listeners) l();
}

export const useOutage = (): Outage | null =>
  useSyncExternalStore((l) => {
    listeners.add(l);
    return () => listeners.delete(l);
  }, outageNow);

/** Whether E on (x, y) sits you on a blanket. */
export const picnicSeat = (x: number, y: number): boolean =>
  world.room === "town" && outageNow() !== null && onBlanket(x, y);

/** The square's lamps the bunting hangs between: [left x, right x, y], in tiles. */
const STRINGS: [number, number, number][] = [
  [3, 16, 2],
  [3, 16, 6],
];

/** Blankets under everyone, the basket among them, bunting over the square. Town only, during an outage. */
export function drawPicnic({ g, items }: Frame): void {
  if (world.room !== "town" || !outageNow()) return;
  for (const [i, b] of BLANKETS.entries()) {
    const sprite = blanket(b.w, b.h, i);
    // Flat on the grass: before anything standing on it.
    items.push({ y: b.y * TILE - 1, draw: () => g.drawImage(sprite, b.x * TILE, b.y * TILE) });
  }
  const [bx, by] = BASKET;
  const b = basket();
  items.push({ y: by * TILE + TILE - 2, draw: () => g.drawImage(b, bx * TILE, (by + 1) * TILE - b.height) });
  for (const [x0, x1, y] of STRINGS) {
    // From one lamp's head to the other's (the lamp is drawn 16 wide, its head 12 px above its tile).
    const w = (x1 - x0) * TILE;
    const s = bunting(w, 10);
    items.push({ y: y * TILE + TILE, draw: () => g.drawImage(s, x0 * TILE + 8, y * TILE - 12) });
  }
}
