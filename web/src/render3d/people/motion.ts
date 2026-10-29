import type { Facing, PlayerState } from "@tokenmaxxing/core/world.ts";
import type { Pose } from "./avatar.ts";

/** Pure movement and pose rules for the 3D people, kept apart from three.js so they can be tested. */

/** Which way each facing turns a character (they face +z, "down" the map, at yaw 0). */
export const YAW: Record<Facing, number> = { down: 0, right: Math.PI / 2, up: Math.PI, left: -Math.PI / 2 };

/** The shortest signed turn from `from` to `to`, in radians. */
export function angleDelta(from: number, to: number): number {
  let d = (to - from) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  else if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

/** Eases `from` toward `to` over `tau` ms: frame-rate independent, never overshoots. */
export function approach(from: number, to: number, dtMs: number, tauMs: number): number {
  return from + (to - from) * (1 - Math.exp(-dtMs / tauMs));
}

/** Turns toward `to` over `tauMs`, the short way round. */
export function turnToward(yaw: number, to: number, dtMs: number, tauMs: number): number {
  return yaw + angleDelta(yaw, to) * (1 - Math.exp(-dtMs / tauMs));
}

export interface Posing {
  state: PlayerState;
  dozing: boolean;
}

export interface PoseOut {
  pose: Pose;
  /** Lying down: in a bed, or on a sleeping bag. */
  lying: boolean;
  /** The seat (or bed) they are on, if any. */
  seat: string | undefined;
}

/**
 * The pose for someone in the 2D game's states (`render.ts drawAvatar`): `away` and a bed lie down,
 * `working` types at the desk, a seat sits, everyone else stands or walks. `seat` is the legend's seat kind
 * under them and `walking` whether they are between tiles.
 */
export function poseOf(p: Posing, seat: string | undefined, walking: boolean): PoseOut {
  const lying = p.state === "away" || (p.state === "sit" && seat === "bed");
  if (lying) return { pose: "sleep", lying: true, seat };
  if (p.state === "working") return { pose: "type", lying: false, seat };
  if (p.state === "sit") return { pose: "sit", lying: false, seat };
  return { pose: walking ? "walk" : "stand", lying: false, seat };
}

/**
 * A hop's height in world units, `t` being how far through it (0 to 1; past 1 is none). The 2D game's
 * seven pixels of a sixteen-pixel tile.
 */
export function hopHeight(t: number): number {
  return t >= 0 && t < 1 ? Math.sin(t * Math.PI) * 0.44 : 0;
}

/** Whether a position changed enough in a frame to count as walking (tiles a second). */
export function isMoving(dx: number, dz: number, dtMs: number, minTilesPerSec = 0.6): boolean {
  return dtMs > 0 && Math.hypot(dx, dz) / (dtMs / 1000) > minTilesPerSec;
}

/**
 * The grid direction a key means when the camera looks from `quarter` quarter-turns round from the default
 * (`quarter` 0 keeps the 2D game's: Up walks up the map). Each key keeps the screen diagonal it has at 0, so
 * turning the view doesn't turn the keys against you.
 */
const VECTOR: Record<Facing, [number, number]> = { up: [0, -1], right: [1, 0], down: [0, 1], left: [-1, 0] };
/** Each key's place on screen at quarter 0: [right, up]. */
const SCREEN: Record<Facing, [number, number]> = {
  up: [1, 1],
  right: [1, -1],
  down: [-1, -1],
  left: [-1, 1],
};

export function keyDirection(key: Facing, quarter: number, base = Math.PI / 4): Facing {
  const az = base + (quarter * Math.PI) / 2;
  const right: [number, number] = [Math.cos(az), -Math.sin(az)];
  const away: [number, number] = [-Math.sin(az), -Math.cos(az)];
  let best: Facing = key;
  let score = -Infinity;
  for (const dir of Object.keys(VECTOR) as Facing[]) {
    const [vx, vz] = VECTOR[dir];
    const sx = vx * right[0] + vz * right[1];
    const sy = vx * away[0] + vz * away[1];
    const d = sx * SCREEN[key][0] + sy * SCREEN[key][1];
    if (d > score + 1e-6) {
      score = d;
      best = dir;
    }
  }
  return best;
}

// ——— The walk cycle ———

/** World units one full cycle (two steps) covers: the legs turn with the ground, so feet don't slide. */
export const STRIDE = 1.5;
/** How the legs, arms and knees swing, in radians, and how high the body bobs, in world units. */
export const SWING = { leg: 0.52, arm: 0.44, knee: 0.55, bob: 0.025, sway: 0.03, lean: 0.12 };
/** Blending in and out of the walk, in ms. */
const BLEND_MS = 100;
/** Someone who stops keeps the legs going to the next half-step at least this fast (cycles a second). */
const MIN_SETTLE_RATE = 1.6;

/** Where someone is in their stride and how much of it shows. */
export interface Gait {
  /** Cycles walked; `k / 2` are the moments the legs pass each other (the neutral pose). */
  phase: number;
  /** 0 standing, 1 walking; eases between. */
  weight: number;
  /** Smoothed speed, world units a second. */
  speed: number;
  /** Lean of the torso (radians, forward positive): only while speeding up or slowing down. */
  lean: number;
}

export function newGait(phase = 0): Gait {
  return { phase, weight: 0, speed: 0, lean: 0 };
}

/**
 * Advances a gait by `moved` world units over `dtS` seconds. Walking, the phase follows the distance (a speed change
 * changes the cadence, not the stride); stopping, the legs run on at their last pace to the next neutral and settle
 * there, never freezing mid-stride.
 */
export function stepGait(g: Gait, moved: number, dtS: number, walking: boolean): void {
  if (dtS <= 0) return;
  const dtMs = dtS * 1000;
  const v = Math.max(0, moved) / dtS;
  const on = walking && moved > 0;
  if (on) {
    g.phase += moved / STRIDE;
    g.weight = approach(g.weight, 1, dtMs, BLEND_MS);
  } else {
    const next = Math.max(g.phase, Math.ceil(g.phase * 2 - 1e-6) / 2);
    const rate = Math.max(MIN_SETTLE_RATE, g.speed / STRIDE);
    g.phase = Math.min(next, g.phase + rate * dtS);
    g.weight = g.phase >= next ? 0 : approach(g.weight, 0, dtMs, BLEND_MS);
  }
  // The lean follows the difference between this frame's pace and the smoothed one: nothing at a steady walk.
  const want = on ? Math.max(-SWING.lean, Math.min(SWING.lean, (v - g.speed) * 0.05)) : 0;
  g.lean = approach(g.lean, want, dtMs, 120);
  g.speed = approach(g.speed, on ? v : 0, dtMs, 80);
}

export interface WalkPose {
  /** Hip turn of the left leg (the right is its mirror); positive swings back. */
  leg: number;
  /** Knee bend of each leg: the one swinging forward bends. */
  knee: [number, number];
  /** Shoulder turn of the left arm (the right is its mirror): opposite to the leg. */
  arm: number;
  /** Rise of the body, highest as the legs pass each other, twice a cycle. */
  bob: number;
  /** Side-to-side roll of the body. */
  sway: number;
}

/** The limbs at a point in the walk, scaled by how much of the walk shows. */
export function walkPose(phase: number, weight: number): WalkPose {
  const a = phase * Math.PI * 2;
  const s = Math.sin(a) * weight;
  const c = Math.cos(a);
  return {
    leg: SWING.leg * s,
    knee: [SWING.knee * Math.max(0, -c) * weight, SWING.knee * Math.max(0, c) * weight],
    arm: -SWING.arm * s,
    bob: (SWING.bob * weight * (1 + Math.cos(a * 2))) / 2,
    sway: SWING.sway * s,
  };
}

/** Whether a gait is at rest: the neutral pose, nothing left to settle. */
export function gaitSettled(g: Gait): boolean {
  return g.weight < 1e-3 && Math.abs(g.lean) < 1e-3;
}

/** How far from the tile's middle people sharing a tile stand (tiles), so their figures don't overlap and flicker. */
const CROWD_RADIUS = 0.27;

/**
 * Where the `index`-th of `count` people on one tile stands, off its middle: round a ring, starting across the
 * default camera's line of sight, so two stand side by side on screen rather than one behind the other.
 */
export function crowdOffset(index: number, count: number): [number, number] {
  if (count < 2) return [0, 0];
  const a = Math.PI / 4 + (index / count) * Math.PI * 2;
  return [Math.sin(a) * CROWD_RADIUS, -Math.cos(a) * CROWD_RADIUS];
}
