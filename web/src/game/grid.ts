/**
 * The power grid in the page (`core/src/grid.ts`): what `world` says (the `grid` event), worked out for
 * the clock once a minute. `?grid=green|expensive|both|off` makes one up for screenshots; the coins
 * only ever go by the server's. The 2D price board is `grid-board.ts`: this file stays light for the 3D side.
 */
import { DIM_LAMPS, type Grid, type GridNow, gridNow, NO_GRID, presetGrid } from "@tokenmaxxing/core/grid.ts";
import { useSyncExternalStore } from "react";
import { serverNow } from "./world.ts";

const forced = presetGrid(new URLSearchParams(location.search).get("grid") ?? "", Date.now());
let fromServer: Grid = NO_GRID;
const listeners = new Set<() => void>();
let seen: { minute: number; now: GridNow } | null = null;

export function setGrid(g: Grid): void {
  fromServer = g;
  seen = null;
  for (const l of listeners) l();
}

/** The grid right now, worked out again when the minute changes or the server's does. */
export function currentGrid(): GridNow {
  const at = serverNow();
  const minute = Math.floor(at / 60_000);
  if (seen?.minute !== minute) seen = { minute, now: gridNow(forced ?? fromServer, at) };
  return seen.now;
}

/** `currentGrid` for React: it re-renders when the server's grid changes, or the minute does. */
export const useGrid = (): GridNow =>
  useSyncExternalStore((l) => {
    listeners.add(l);
    const tick = setInterval(l, 30_000);
    return () => {
      listeners.delete(l);
      clearInterval(tick);
    };
  }, currentGrid);

/** How bright the street lamps burn: dimmed while power is expensive. */
export const lampDim = (): number => (currentGrid().expensive ? DIM_LAMPS : 1);

/** The board's colours, by `priceSign`'s tone. */
export const PRICE_TONES = {
  green: "rgba(46, 140, 82, 0.95)",
  dear: "rgba(178, 74, 46, 0.95)",
  plain: "rgba(43, 36, 51, 0.7)",
} as const;
