/**
 * The coffee buzz as a smooth tremor: a few slow sines per axis, driven by the clock, so it looks the same
 * at 30 and 144 frames per second (it used to be a random nudge every frame, twice as violent on a 120 Hz
 * screen). Pure: the caller says how many cups are left, what time it is and whose phase to use.
 */

/** Cups at which the buzz stops getting stronger. */
export const MAX_CUPS = 4;
/** Peak sideways reach per cup, in tiles (a third of the old nudge: 1/3 px of a 16 px tile). */
const REACH_PER_CUP = 1 / 3 / 16;
/** Three frequencies per axis (Hz), none a multiple of another, with the weight each has (they sum to 1). */
const X_WAVES: readonly (readonly [number, number])[] = [
  [7.3, 0.5],
  [11.9, 0.3],
  [17.3, 0.2],
];
const Z_WAVES: readonly (readonly [number, number])[] = [
  [6.1, 0.5],
  [13.7, 0.3],
  [19.1, 0.2],
];
const LIFT_HZ = 9.1;
/** The 2D tremor is redrawn this often, whole pixels at a time. */
export const TREMOR_2D_HZ = 15;

const smooth = (x: number) => {
  const t = Math.min(1, Math.max(0, x));
  return t * t * (3 - 2 * t);
};

/** How strong the buzz is for `cups` still in their system: 0 with none, easing in and out around the last half cup. */
export const buzz = (cups: number): number => Math.min(MAX_CUPS, Math.max(0, cups)) * smooth(cups / 0.5);

/** A steady phase offset for someone, so two people with coffee don't shake in step. */
export const tremorPhase = (id: number): number => ((Math.abs(id) * 2.399963) % 1) * Math.PI * 2;

const wave = (
  waves: readonly (readonly [number, number])[],
  t: number,
  phase: number,
  skew: number,
): number => {
  let sum = 0;
  for (const [hz, w] of waves) sum += w * Math.sin(Math.PI * 2 * hz * t + phase * skew + hz);
  return sum;
};

export interface Tremor {
  /** Sideways and depth offsets, in tiles. */
  dx: number;
  dz: number;
  /** A small hop up, in tiles (never below zero). */
  lift: number;
}

/** The shake at `tSec` seconds for someone with `cups` left. At most `buzz(cups)` / 48 tiles sideways. */
export function tremor(cups: number, tSec: number, phase = 0): Tremor {
  const b = buzz(cups);
  if (b <= 0) return { dx: 0, dz: 0, lift: 0 };
  const reach = b * REACH_PER_CUP;
  return {
    dx: reach * wave(X_WAVES, tSec, phase, 1),
    dz: reach * 0.5 * wave(Z_WAVES, tSec, phase, 1.7),
    lift: reach * 0.35 * (0.5 + 0.5 * Math.sin(Math.PI * 2 * LIFT_HZ * tSec + phase * 2.3)),
  };
}

/** Peak tilt per cup, in radians (about a degree). */
const TILT_PER_CUP = 0.018;
/** Fast enough to read as a buzz, not a drift (Hz, none a multiple of another). */
const ROLL_WAVES: readonly (readonly [number, number])[] = [
  [17.9, 0.6],
  [26.3, 0.4],
];
const PITCH_WAVES: readonly (readonly [number, number])[] = [
  [15.7, 0.6],
  [23.9, 0.4],
];
/** The buzz comes in fits, about one every 1.6 s, and never quite stops between them. */
const FIT_HZ = 0.62;

export interface Jitter {
  /** Tilts about the feet, in radians: side to side and back and forth. */
  roll: number;
  pitch: number;
  /** A small bounce, in tiles (never below zero). */
  lift: number;
}

/**
 * The 3D buzz: the feet stay where they are and the body vibrates over them, in fits. Sliding the whole
 * figure about (`tremor`) reads as a laggy connection, not as too much coffee.
 */
export function jitter(cups: number, tSec: number, phase = 0): Jitter {
  const b = buzz(cups);
  if (b <= 0) return { roll: 0, pitch: 0, lift: 0 };
  const fit = 0.3 + 0.7 * smooth(0.5 + 0.6 * Math.sin(Math.PI * 2 * FIT_HZ * tSec + phase));
  const tilt = b * TILT_PER_CUP * fit;
  return {
    roll: tilt * wave(ROLL_WAVES, tSec, phase, 1),
    pitch: tilt * 0.5 * wave(PITCH_WAVES, tSec, phase, 1.7),
    lift: b * REACH_PER_CUP * 0.35 * fit * Math.abs(Math.sin(Math.PI * 2 * LIFT_HZ * tSec + phase * 2.3)),
  };
}

/**
 * The 2D shake in whole pixels, held for 1/15 s so nothing flickers between pixels: one pixel across, two at
 * four cups.
 */
export function tremor2d(cups: number, tMs: number, phase = 0): { dx: number; dy: number } {
  const b = buzz(cups);
  if (b <= 0) return { dx: 0, dy: 0 };
  const t = Math.floor((tMs / 1000) * TREMOR_2D_HZ) / TREMOR_2D_HZ;
  const amp = 0.6 + (b / MAX_CUPS) * 1.4; // 0.6 to 2.0 px, rounded to whole pixels below
  const cap = b >= MAX_CUPS - 1e-9 ? 2 : 1;
  const px = (v: number) => Math.max(-cap, Math.min(cap, Math.round(v * amp)));
  return { dx: px(wave(X_WAVES, t, phase, 1)), dy: px(0.5 * wave(Z_WAVES, t, phase, 1.7)) };
}
