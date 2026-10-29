import { blockOf, type GameMap, PLOT_H, PLOT_W, plotId } from "@tokenmaxxing/core/maps.ts";
import { type CompanyInfo, type Peek, TILE } from "@tokenmaxxing/core/world.ts";
import type { Pane } from "../art/buildings.ts";
import { characterFrame, sleeperFrame } from "../art/characters.ts";
import { world } from "./world.ts";

/** Faces in house windows this frame, in world pixels, so clicks can find them. */
export const peekHits: { x: number; y: number; w: number; h: number; id: number }[] = [];

interface Building {
  /** Footprint in tiles; the door is on the bottom row. */
  x: number;
  y: number;
  w: number;
  h: number;
  plot: number | null;
}

const buildingCache = new WeakMap<GameMap, Building[]>();

/** Company houses (7×5, door in the middle of the bottom row) and the Inn (7×4), from the town grid. */
export function buildings(map: GameMap): Building[] {
  let list = buildingCache.get(map);
  if (list) return list;
  list = [];
  if (map.id === "town") {
    for (const [dx, dy] of map.find("D"))
      list.push({ x: dx - 3, y: dy - 4, w: PLOT_W, h: PLOT_H, plot: plotId(...blockOf(dx, dy)) });
    const [ix, iy] = map.find("I")[0]!;
    list.push({ x: ix - 3, y: iy - 3, w: 7, h: 4, plot: null });
  }
  buildingCache.set(map, list);
  return list;
}

export const buildingAt = (x: number, y: number): Building | undefined =>
  buildings(world.map).find((b) => x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h);

/** Largest building the door search walks through; past that it is fences or trees, not a building. */
const BUILDING_MAX_TILES = 120;

/**
 * The door of the building at (`x`, `y`): through the building's own (unwalkable) tiles to the nearest
 * way in. Null off a building, on anything with a use of its own (a bench, a fountain).
 */
export function doorOf(map: GameMap, x: number, y: number): [number, number] | null {
  if (!map.contains(x, y) || map.walkable(x, y)) return null;
  const k = map.kind(x, y);
  if (k.portal || k.seat || k.pours || k.serves || k.tosses || k.shop || k.counter || k.poker || k.roulette)
    return null;
  const seen = new Set([`${x},${y}`]);
  const queue: [number, number][] = [[x, y]];
  let best: [number, number] | null = null;
  let bestD = Infinity;
  for (let i = 0; i < queue.length; i++) {
    if (seen.size > BUILDING_MAX_TILES) return null;
    const [cx, cy] = queue[i]!;
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ] as const) {
      const nx = cx + dx;
      const ny = cy + dy;
      const key = `${nx},${ny}`;
      if (seen.has(key) || !map.contains(nx, ny)) continue;
      seen.add(key);
      if (map.kind(nx, ny).portal) {
        const d = Math.abs(nx - x) + Math.abs(ny - y);
        if (d < bestD) [best, bestD] = [[nx, ny], d];
      } else if (!map.walkable(nx, ny)) queue.push([nx, ny]);
    }
  }
  return best;
}

/** Each plot's company, worked out again when the world's companies are replaced (`setCompanies`). */
let plotsOf: Map<number, CompanyInfo> | null = null;
const onPlot = new Map<number, CompanyInfo>();

export function companyOnPlot(plot: number): CompanyInfo | undefined {
  if (plotsOf !== world.companies) {
    plotsOf = world.companies;
    onPlot.clear();
    for (const c of world.companies.values()) if (!onPlot.has(c.plot)) onPlot.set(c.plot, c);
  }
  return onPlot.get(plot);
}

const logos = new Map<string, HTMLImageElement | null>();

/**
 * Draws a company logo fitted into its `w`×`h` plaque at (`x`, `y`) in world pixels. Drawn from the
 * original image with smoothing, so it stays sharp at the screen's resolution rather than being
 * baked down to plaque pixels. Nothing until it has loaded (or if it never does).
 */
export function drawLogo(
  g: CanvasRenderingContext2D,
  src: string,
  x: number,
  y: number,
  w: number,
  h: number,
): void {
  if (!logos.has(src)) {
    logos.set(src, null);
    const img = new Image();
    img.onload = () => logos.set(src, img);
    img.src = src;
  }
  const img = logos.get(src);
  if (!img) return;
  const iw = img.naturalWidth || w;
  const ih = img.naturalHeight || h;
  const scale = Math.min(w / iw, h / ih);
  g.save();
  g.imageSmoothingEnabled = true;
  g.imageSmoothingQuality = "high";
  g.drawImage(img, x + (w - iw * scale) / 2, y + (h - ih * scale) / 2, iw * scale, ih * scale);
  g.restore();
}

/** Someone inside, seen through a window: their face against a lit room, or asleep in the dark. */
export function drawFace(
  g: CanvasRenderingContext2D,
  p: Peek,
  x: number,
  y: number,
  pane: Pane,
  now: number,
): void {
  const asleep = p.state === "away";
  g.save();
  g.beginPath();
  g.rect(x, y, pane.w, pane.h);
  g.clip();
  g.fillStyle = asleep ? "#2e3a5c" : p.state === "working" ? "#bfe9ff" : "#ffe9b0";
  g.fillRect(x, y, pane.w, pane.h);
  const frame = asleep ? sleeperFrame(p.look) : characterFrame(p.look, "down", "stand");
  // Working: the head bobs along with the typing, like at the desk.
  const bob = p.state === "working" && Math.floor(now / 180) % 2 === 0 ? 1 : 0;
  g.drawImage(frame, x + Math.floor((pane.w - TILE) / 2), y - 1 + (asleep ? 2 : bob));
  // Glass: a glint, and the frame's cross bar at the top.
  g.fillStyle = "rgba(255, 255, 255, 0.35)";
  g.fillRect(x, y, pane.w, 1);
  g.fillRect(x + pane.w - 3, y + 1, 2, 1);
  g.restore();
}
