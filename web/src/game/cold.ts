import { isBot } from "@tokenmaxxing/core/bots.ts";
import { breathShows, SNEEZE_MS, scarvesOn, sneezeAt, type Weather } from "@tokenmaxxing/core/sky.ts";
import type { Facing } from "@tokenmaxxing/core/world.ts";
import { hash } from "../art/pixels.ts";
import { skyNow, weatherNow } from "./sky.ts";
import { type Avatar, world } from "./world.ts";

/**
 * The town's people and the air (`core/src/sky.ts`): breath that shows in the cold, scarves on the bots, and
 * sneezes when the pollen is high. Worked out here for both renderers; this file draws the 2D side, and
 * `render3d/people/entities.ts` the 3D one. Outdoors only: the rooms have no weather.
 */

/** What the cold does to the town right now; null indoors. */
export interface Chill {
  breath: boolean;
  scarves: boolean;
}

export function chillOf(weather: Weather): Chill | null {
  const breath = breathShows(weather);
  return breath ? { breath, scarves: scarvesOn(weather) } : null;
}

/** What a sneeze says over the head. */
export const SNEEZE_TEXT = "Achoo! 🤧";

/** Up and about: breathing and sneezing show (not asleep, not at a desk). */
const awake = (a: Avatar) => a.state !== "away" && a.state !== "working";

/** How far into a sneeze `a` is, 0..1, or null: in town while the pollen is high, off the shared clock. */
export function sneezeOf(a: Avatar): number | null {
  if (world.room !== "town" || !awake(a) || a.warp) return null;
  const into = sneezeAt(a.info.id, skyNow(), weatherNow().pollen);
  return into === null ? null : into / SNEEZE_MS;
}

/** The sneeze's jolt, 0..1: a breath in, then the head snaps forward and comes back. */
export const sneezeJolt = (t: number): number =>
  t < 0.3 ? 0 : t < 0.42 ? 1 : Math.max(0, 1 - (t - 0.42) * 4);

/** A breath every few seconds, each person on their own beat. */
const BREATH_MS = 3_400;
/** How long a puff hangs in the air. */
const PUFF_MS = 1_600;

/** How far through a puff of breath person `id` is at `now` (ms), 0..1, or null between breaths. */
export function breathPuff(id: number, now: number): number | null {
  const into = (now + hash(id, 3, 77) * BREATH_MS) % BREATH_MS;
  return into < PUFF_MS ? into / PUFF_MS : null;
}

const SCARVES: readonly (readonly [string, string])[] = [
  ["#d8414f", "#f4efe4"],
  ["#2f6fb5", "#e9eef6"],
  ["#e0a32e", "#7a3b2e"],
  ["#3f8f5a", "#f4efe4"],
];

/** A bot's scarf, two colours in stripes: the same one every winter. */
export const scarfOf = (id: number): readonly [string, string] =>
  SCARVES[Math.floor(hash(id, 5, 78) * SCARVES.length)]!;

/** Whether `a` wears a scarf in this `chill`: the bots do, in the cold. */
export const wearsScarf = (a: Avatar, chill: Chill | null): boolean =>
  !!chill?.scarves && isBot(a.info.id) && awake(a);

// MARK: 2D

/**
 * A scarf over a 16×16 character frame drawn at (`x`, `top`): round the neck at row 9 (where the body starts) and,
 * from the front or side, an end hanging down. Left is the side view mirrored.
 */
export function drawScarf(
  g: CanvasRenderingContext2D,
  x: number,
  top: number,
  facing: Facing,
  id: number,
): void {
  const [a, b] = scarfOf(id);
  const side = facing === "left" || facing === "right";
  const put = (px: number, py: number, c: string) => {
    g.fillStyle = c;
    g.fillRect(x + (facing === "left" ? 15 - px : px), top + py, 1, 1);
  };
  for (let px = side ? 5 : 4; px <= (side ? 10 : 11); px++) put(px, 9, px % 2 ? a : b);
  if (facing === "up") return;
  const end = side ? 6 : 7;
  for (let py = 10; py <= 11; py++) {
    put(end, py, py % 2 ? b : a);
    put(end + 1, py, py % 2 ? a : b);
  }
}

/** Where the mouth is on a 16×16 character frame, and which way breath leaves it (0: from the front or back, downwind). */
const MOUTH: Record<Facing, [number, number, number]> = {
  down: [8, 8, 0],
  up: [8, 2, 0],
  left: [2, 7, -1],
  right: [13, 7, 1],
};

/**
 * A puff of breath from someone drawn at (`x`, `top`), `t` (0..1) through it: a soft cloud leaving the mouth, swelling,
 * drifting with the wind (`push`, -1..1) out past the body and fading. Seen from the front or behind it drifts
 * downwind, so it shows beside the face rather than over it.
 */
export function drawBreath(
  g: CanvasRenderingContext2D,
  x: number,
  top: number,
  facing: Facing,
  t: number,
  push: number,
): void {
  const [mx, my, side] = MOUTH[facing];
  const dir = side || (push < 0 ? -1 : 1);
  const cx = x + mx + dir * (2 + t * 7) + push * t * 2;
  const cy = top + my - t * 3;
  const r = 2 + t * 3;
  g.fillStyle = `rgba(240, 245, 252, ${0.8 * (1 - t * t)})`;
  g.fillRect(Math.round(cx - r / 2), Math.round(cy - r / 2), Math.round(r), Math.round(r));
  // A wisp trailing back towards the mouth.
  const s = Math.max(1, Math.round(r * 0.55));
  g.fillRect(Math.round(cx - dir * r * 0.8 - s / 2), Math.round(cy + r * 0.3 - s / 2), s, s);
}
