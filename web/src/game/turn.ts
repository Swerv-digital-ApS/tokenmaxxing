import type { Facing } from "@tokenmaxxing/core/world.ts";

/**
 * How long a changed direction has to stay held before you walk, in ms. Shorter than a deliberate press, longer
 * than a tap: the way you face is shown at once, and the walk follows only if the key is still down.
 */
export const TURN_DELAY_MS = 120;

/** The direction I turned to on the spot, and when: the walk waits `TURN_DELAY_MS` from then. */
export interface Turning {
  dir: Facing;
  at: number;
}

export type TurnStep =
  /** Take the step. */
  | { act: "walk"; turning: null }
  /** Face `dir` without moving. */
  | { act: "turn"; turning: Turning }
  /** Already turned, and the delay isn't up. */
  | { act: "wait"; turning: Turning };

/**
 * Pokémon-style turning for a held or tapped arrow key. `pressed` is the grid direction the key means now,
 * `facing` the way I look, `turning` what the last call returned (null before the first). A different
 * direction turns me first and walks only once it has stayed held `TURN_DELAY_MS`; the way I already face
 * walks at once. A tap is over before the delay, so the next call sees no key and drops `turning`.
 */
export function turnStep(turning: Turning | null, pressed: Facing, facing: Facing, now: number): TurnStep {
  if (turning?.dir === pressed) {
    return now - turning.at < TURN_DELAY_MS ? { act: "wait", turning } : { act: "walk", turning: null };
  }
  if (pressed === facing) return { act: "walk", turning: null };
  return { act: "turn", turning: { dir: pressed, at: now } };
}
