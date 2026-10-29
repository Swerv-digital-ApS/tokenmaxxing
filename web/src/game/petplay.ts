import type { PetAct } from "@tokenmaxxing/core/pets.ts";

/** How long each reaction moves for, in ms. The hearts float for `BURST_MS`, a little longer. */
export const PLAY_MS: Record<PetAct, number> = { pet: 1100, treat: 1500, trick: 1300 };

/** What a pet is doing `t` (0 to 1) through a reaction: a hop as a fraction of its full height, and spins turned. */
export interface PlayPose {
  lift: number;
  spin: number;
}

/** How high a full hop lifts the 2D pet, in world pixels (the avatar's own hop is 7). */
export const PLAY_LIFT = 8;

const REST: PlayPose = { lift: 0, spin: 0 };
const ease = (t: number) => t * t * (3 - 2 * t);

/**
 * The pure motion of a reaction, drawn by both renderers (2D flips its sprite and lifts it in pixels, 3D lifts
 * its body and turns it): a stroke is a few happy bounces that settle, a treat a jump for it and then chewing, a
 * trick a hop with one whole turn in the air.
 */
export function playPose(act: PetAct, t: number): PlayPose {
  if (t < 0 || t >= 1) return REST;
  switch (act) {
    case "pet":
      return { lift: Math.abs(Math.sin(t * Math.PI * 3)) * 0.55 * (1 - t), spin: 0 };
    case "treat":
      return t < 0.3
        ? { lift: Math.sin((t / 0.3) * Math.PI), spin: 0 }
        : { lift: Math.abs(Math.sin((t - 0.3) * 24)) * 0.12 * (1 - t), spin: 0 };
    case "trick":
      return { lift: Math.sin(t * Math.PI), spin: ease(t) };
  }
}
