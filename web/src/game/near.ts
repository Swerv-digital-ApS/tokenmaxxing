import { clamp } from "hanzio";

/** Labels over things (signs, doors, stalls, pet names) show within this many tiles of the player... */
export const LABEL_NEAR = 5;
/** ...fade out to here, and are hidden past it. */
export const LABEL_FAR = 8;
/** A hover (or a tap) brings back the labels within this many tiles of the pointed tile. */
export const HOVER_REACH = 2.5;
/** How long a reveal takes to come or go, so nothing pops. */
export const LABEL_FADE_MS = 150;

/** 1 within `LABEL_NEAR` tiles, down to 0 at `LABEL_FAR`. */
export const nearAlpha = (dist: number): number =>
  clamp(1 - (dist - LABEL_NEAR) / (LABEL_FAR - LABEL_NEAR), 0, 1);

/**
 * A label's alpha, `dist` tiles from the player and `hoverDist` from the pointed tile (Infinity when there
 * is none), with the reveal `hover` of the way in (0 to 1). Walking fades by distance; a hover eases in.
 */
export function labelAlpha(dist: number, hoverDist = Infinity, hover = 1): number {
  const near = nearAlpha(dist);
  if (near >= 1 || !(hoverDist <= HOVER_REACH) || hover <= 0) return near;
  return near + (1 - near) * clamp(hover, 0, 1);
}

/** The tile the pointer is over (or last tapped), and when it came and went: shared by both renderers. */
export const hover = { x: NaN, y: NaN, since: 0, left: 0 };

export function setHover(tile: { x: number; y: number } | null, now: number): void {
  if (!tile) {
    if (!Number.isNaN(hover.x) && hover.left === 0) hover.left = now;
    return;
  }
  if (tile.x !== hover.x || tile.y !== hover.y || hover.left > 0) hover.since = now;
  hover.x = tile.x;
  hover.y = tile.y;
  hover.left = 0;
}

/** How far the hover reveal is in at `now`: eased in since the pointer arrived, out since it left. */
export function hoverStrength(now: number): number {
  if (Number.isNaN(hover.x)) return 0;
  const up = clamp((now - hover.since) / LABEL_FADE_MS, 0, 1);
  if (hover.left === 0) return up;
  const down = clamp((now - hover.left) / LABEL_FADE_MS, 0, 1);
  if (down >= 1) hover.x = hover.y = NaN;
  return Math.min(up, 1 - down);
}
