import { expect, test } from "bun:test";
import {
  angleDelta,
  approach,
  crowdOffset,
  hopHeight,
  isMoving,
  keyDirection,
  poseOf,
  turnToward,
  YAW,
} from "../src/render3d/people/motion.ts";

test("turning takes the short way round", () => {
  expect(angleDelta(0, Math.PI / 2)).toBeCloseTo(Math.PI / 2);
  expect(angleDelta(Math.PI * 0.9, -Math.PI * 0.9)).toBeCloseTo(Math.PI * 0.2);
  expect(angleDelta(-Math.PI * 0.9, Math.PI * 0.9)).toBeCloseTo(-Math.PI * 0.2);
  // From facing up (pi) to facing left (-pi/2) is a quarter turn, not three.
  expect(Math.abs(angleDelta(YAW.up, YAW.left))).toBeCloseTo(Math.PI / 2);
});

test("easing never overshoots and doesn't depend on the frame rate", () => {
  const once = approach(0, 10, 100, 100);
  let twice = 0;
  for (let i = 0; i < 2; i++) twice = approach(twice, 10, 50, 100);
  expect(once).toBeLessThan(10);
  expect(twice).toBeCloseTo(once, 5);
  expect(turnToward(0, Math.PI, 1e6, 70)).toBeCloseTo(Math.PI);
});

test("poses follow the 2D game's states", () => {
  const p = (
    state: "idle" | "sit" | "away" | "working" | "playing",
    seat: string | undefined,
    walking = false,
  ) => poseOf({ state, dozing: false }, seat, walking);
  expect(p("idle", undefined).pose).toBe("stand");
  expect(p("idle", undefined, true).pose).toBe("walk");
  expect(p("sit", "bench").pose).toBe("sit");
  expect(p("sit", "bed")).toMatchObject({ pose: "sleep", lying: true });
  expect(p("away", undefined)).toMatchObject({ pose: "sleep", lying: true });
  expect(p("working", "chair").pose).toBe("type");
  expect(p("playing", undefined).pose).toBe("stand");
});

test("a hop rises and falls, then is over", () => {
  expect(hopHeight(0)).toBe(0);
  expect(hopHeight(0.5)).toBeGreaterThan(0.4);
  expect(hopHeight(1)).toBe(0);
  expect(hopHeight(5)).toBe(0);
});

test("walking is told from standing by speed", () => {
  expect(isMoving(0.1, 0, 16)).toBe(true);
  expect(isMoving(0.001, 0, 16)).toBe(false);
  expect(isMoving(1, 1, 0)).toBe(false);
});

test("keys keep their place on screen when the view is turned", () => {
  // The default view: the 2D game's directions.
  for (const d of ["up", "right", "down", "left"] as const) expect(keyDirection(d, 0)).toBe(d);
  // Every quarter is a permutation: four keys, four different directions.
  for (let q = 0; q < 4; q++) {
    const dirs = (["up", "right", "down", "left"] as const).map((d) => keyDirection(d, q));
    expect(new Set(dirs).size).toBe(4);
  }
  // A full turn comes back to the start; one turn is not the identity.
  expect(keyDirection("up", 4)).toBe("up");
  expect(keyDirection("up", 1)).not.toBe("up");
  // Turning twice flips every key.
  expect(keyDirection("up", 2)).toBe("down");
  expect(keyDirection("left", 2)).toBe("right");
});

test("people sharing a tile stand apart on it, the lone one in its middle", () => {
  expect(crowdOffset(0, 1)).toEqual([0, 0]);
  for (const n of [2, 3, 4]) {
    const spots = Array.from({ length: n }, (_, i) => crowdOffset(i, n));
    for (const [x, z] of spots) expect(Math.max(Math.abs(x), Math.abs(z))).toBeLessThan(0.5);
    for (let i = 0; i < n; i++)
      for (let j = i + 1; j < n; j++)
        expect(Math.hypot(spots[i]![0] - spots[j]![0], spots[i]![1] - spots[j]![1])).toBeGreaterThan(0.3);
  }
});
