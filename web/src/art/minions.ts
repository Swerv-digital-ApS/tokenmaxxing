import { C } from "./palette.ts";
import { bake, cached } from "./pixels.ts";

/**
 * A raider's robot minion: one per agent beyond their own, firing at the boss next to their desk.
 * Two frames: its antenna blinks and its blaster arm comes up as it fires.
 */
// Pixel art reads as a grid.
// prettier-ignore
const FRAMES = [
  [
    "...a....",
    "...o....",
    ".oooooo.",
    ".obbbbo.",
    ".obeebo.",
    ".obbbbo.",
    "oooooooo",
    "o.oggo.o",
    "..oggo..",
    "..o..o..",
  ],
  [
    "...A....",
    "...o....",
    ".oooooo.",
    ".obbbbo.",
    ".obeebo.",
    ".obbbbo.",
    "ooooooom",
    "..oggo.m",
    "..oggo..",
    "..o..o..",
  ],
];

const PAL = {
  o: C.ink,
  b: C.metalLight,
  e: C.screen,
  g: C.metal,
  a: "#e06c5f",
  A: "#ffd35c",
  m: "#9dff8a",
};

export const MINION_W = 8;
export const MINION_H = 10;

export const minionFrame = cached(
  (frame: number) => `minion${frame}`,
  (frame: number) => bake(MINION_W, MINION_H, (p) => p.grid(FRAMES[frame]!, PAL)),
);
