import type { Rot } from "@tokenmaxxing/core/office.ts";
import { TILE } from "@tokenmaxxing/core/world.ts";
import { storage } from "../storage.ts";
import { world } from "./world.ts";

/** The current view, kept for turning clicks into tiles. */
export const camera = { x: 0, y: 0, scale: 1, dpr: 1 };

const ZOOM_KEY = "tokenmaxxing.zoom";

/**
 * What the 3D renderer answers to while it is drawing (`render3d/index.ts` sets them): zooming and turning
 * the view are its own, and the arrow keys follow the way the view is turned. Unset: the 2D game's.
 */
export const viewHooks: {
  zoom?: (step: 1 | -1 | 0) => void;
  rotate?: (step: 1 | -1) => void;
  /** The grid direction a key's direction means with the view as it is. */
  key?: <D extends string>(dir: D) => D;
  /** E on a shop's display at this tile: true when the 3D buy panel took it. */
  shop?: (shop: string, x: number, y: number) => boolean;
  /** A coin landed in the fountain or the Tavern's tip jar at this tile: the 3D renderer throws it. */
  toss?: (x: number, y: number) => void;
  /** The furniture ghost (`furniture.ts`): the piece to show over a tile, whether it fits there and how far it is turned, or null to clear. */
  ghost?: (
    g: { item: string; tile: { x: number; y: number } | null; fits: boolean; rot: Rot } | null,
  ) => void;
} = {};

/**
 * Zoom is device pixels per world pixel, always a whole number so the pixel art
 * stays crisp. `null` follows the window size; the player's choice is saved.
 */
let chosenScale: number | null = Number(storage.getItem(ZOOM_KEY)) || null;

const zoomRange = { min: 1, max: 12 };

/** The scale on screen, easing towards the chosen one: zooming glides instead of jumping. */
let shown: number | null = null;
let shownAt = 0;
/** How quickly the view catches up with a zoom: about 90% of the way in a quarter second. */
const ZOOM_EASE_MS = 110;

/**
 * This frame's scale. It eases towards the target, which is always a whole number, so the art is only
 * in between sizes while it moves and crisp again once it settles.
 */
export function zoomScale(dpr: number, w: number, h: number, now: number): number {
  const target = targetScale(dpr, w, h);
  if (shown === null || Math.abs(target - shown) < 0.01) shown = target;
  else shown += (target - shown) * (1 - Math.exp(-(now - shownAt) / ZOOM_EASE_MS));
  shownAt = now;
  return shown;
}

function targetScale(dpr: number, w: number, h: number): number {
  const map = world.map;
  // Out: until the whole map fits, but never above the default (small rooms fit early).
  // In: twice the old closest view.
  const fit = Math.min(Math.floor(w / (map.width * TILE)), Math.floor(h / (map.height * TILE)));
  // The dungeon is a show: by default, all of it at once.
  const auto =
    map.id === "dungeon"
      ? Math.max(2 * dpr, fit)
      : Math.max(2, Math.min(5, Math.round(window.innerHeight / (TILE * 13)))) * dpr;
  zoomRange.min = Math.max(1, Math.min(fit, auto));
  zoomRange.max = Math.round(10 * dpr);
  return Math.max(zoomRange.min, Math.min(zoomRange.max, chosenScale ?? auto));
}

/** Zooms one step in (+1) or out (-1), or back to following the window (0). */
export function zoom(step: 1 | -1 | 0): void {
  if (viewHooks.zoom) {
    viewHooks.zoom(step);
    return;
  }
  if (step === 0) chosenScale = null;
  else
    chosenScale = Math.max(
      zoomRange.min,
      Math.min(
        zoomRange.max,
        Math.round(chosenScale ?? camera.scale) + step * Math.max(1, Math.round(camera.dpr)),
      ),
    );
  if (chosenScale === null) storage.removeItem(ZOOM_KEY);
  else storage.setItem(ZOOM_KEY, String(chosenScale));
}
