/**
 * Street life: small things in town that run on the world's clock (Copenhagen) and nothing else, so
 * every client sees them in the same place without the server keeping any state. The paperboy at
 * 07:00, the pølsevogn from 11 to 14, and the build snail crossing the square all day.
 */
import { lerp, normalize, sortBy } from "hanzio";
import { BLOCK_H } from "./maps.ts";
import { worldWall } from "./range.ts";
import { DIRS, type Facing } from "./world.ts";

/** Minutes since midnight on the world's clock, with the seconds as a fraction (0 to 1440). */
export function clockMinutes(ms: number): number {
  const { hour, minute, second } = worldWall(ms);
  return hour * 60 + minute + (second + (ms % 1000) / 1000) / 60;
}

/** `HH:MM` or `HH:MM:SS` as minutes since midnight; null for anything else. */
export function parseClock(s: string): number | null {
  const m = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(s);
  if (!m) return null;
  const [h, min, sec] = [Number(m[1]), Number(m[2]), Number(m[3] ?? 0)];
  return h < 24 && min < 60 && sec < 60 ? h * 60 + min + sec / 60 : null;
}

const facingTile = (x: number, y: number, facing: Facing): [number, number] => [
  x + DIRS[facing][0],
  y + DIRS[facing][1],
];

// MARK: Pølsevogn

/** The hot dog cart: a rød pølse is on the house. How long it lasts, how much quicker you walk, and its hours. */
export const POLSE = {
  ms: 10 * 60_000,
  /** Step time is multiplied by this while it lasts: 0.8 is a quarter faster. */
  pace: 0.8,
  opens: 11 * 60,
  closes: 14 * 60,
} as const;

/** The cart's two tiles, on the square below the coffee. Nobody walks through it. */
export const CART: readonly [number, number][] = [
  [16, 4],
  [17, 4],
];

export const isCart = (x: number, y: number): boolean => CART.some(([cx, cy]) => cx === x && cy === y);

export const facesCart = (x: number, y: number, facing: Facing): boolean =>
  isCart(...facingTile(x, y, facing));

export function cartOpen(ms: number): boolean {
  const m = clockMinutes(ms);
  return m >= POLSE.opens && m < POLSE.closes;
}

export const hasPolse = (until: number, now: number): boolean => until > now;

/** How much a step takes, times the usual: quicker with a pølse in you. */
export const stepPace = (polseUntil: number, now: number): number =>
  hasPolse(polseUntil, now) ? POLSE.pace : 1;

// MARK: The build snail

/** It leaves at 07:00 from the left of the square and reaches the goal flag at 17:00, along row `y`. */
export const SNAIL = { y: 7, from: 4, to: 14, leaves: 7 * 60, arrives: 17 * 60 } as const;

type SnailPhase = "queued" | "deploying" | "deployed";

/** Where the snail is (a fractional tile) and how its build is going, at `ms`. */
export function snailAt(ms: number): { x: number; y: number; phase: SnailPhase; progress: number } {
  const m = clockMinutes(ms);
  const progress = normalize(m, SNAIL.leaves, SNAIL.arrives);
  const phase = m < SNAIL.leaves ? "queued" : m < SNAIL.arrives ? "deploying" : "deployed";
  return { x: lerp(SNAIL.from, SNAIL.to, progress), y: SNAIL.y, phase, progress };
}

/** The tile the snail is on, for E. */
export const snailTile = (ms: number): [number, number] => {
  const s = snailAt(ms);
  return [Math.round(s.x), s.y];
};

// MARK: The morning paper

/** When the paperboy sets off, and how fast he bikes (tiles a second). */
export const PAPER = { at: 7 * 60, tilesPerSecond: 4 } as const;

/** Where the paper lands for a door: on the grass just right of the path below it. */
export const paperSpot = ([x, y]: readonly [number, number]): [number, number] => [x + 1, y + 1];

/** One pass along a road, left to right: the road's row, its ends, and when it starts (minutes). */
export interface Ride {
  y: number;
  from: number;
  to: number;
  at: number;
}

/**
 * The paperboy's round: along the road below each row of blocks that has a door, top to bottom,
 * one after the other, from `left` to `right`.
 */
export function paperRides(
  doors: readonly (readonly [number, number])[],
  left: number,
  right: number,
): Ride[] {
  const roads = sortBy([...new Set(doors.map(([, y]) => (Math.floor(y / BLOCK_H) + 1) * BLOCK_H))]);
  const minutes = (right - left) / PAPER.tilesPerSecond / 60;
  return roads.map((y, i) => ({ y, from: left, to: right, at: PAPER.at + i * minutes }));
}

const rideMinutes = (r: Ride) => (r.to - r.from) / PAPER.tilesPerSecond / 60;

/** Where the paperboy is at minute `m` of the day, or null when he isn't out. */
export function paperboyAt(rides: readonly Ride[], m: number): { x: number; y: number } | null {
  const r = rides.find((r) => m >= r.at && m < r.at + rideMinutes(r));
  return r ? { x: r.from + (m - r.at) * PAPER.tilesPerSecond * 60, y: r.y } : null;
}

/** When the paper for a door lands: as the paperboy passes it. Null if his round never comes by. */
export function deliveredAt(rides: readonly Ride[], door: readonly [number, number]): number | null {
  const [x] = paperSpot(door);
  const road = (Math.floor(door[1] / BLOCK_H) + 1) * BLOCK_H;
  const r = rides.find((r) => r.y === road);
  return r ? r.at + Math.max(0, x - r.from) / PAPER.tilesPerSecond / 60 : null;
}
