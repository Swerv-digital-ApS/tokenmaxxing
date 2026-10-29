import { expect, test } from "bun:test";
import { PET_ACTS } from "@tokenmaxxing/core/pets.ts";
import { PLAY_MS, playPose } from "../src/game/petplay.ts";

test("every reaction starts and ends at rest, and stays within a hop", () => {
  for (const act of PET_ACTS) {
    expect(PLAY_MS[act]).toBeGreaterThan(0);
    expect(playPose(act, 0).lift).toBeCloseTo(0, 5);
    expect(playPose(act, 1)).toEqual({ lift: 0, spin: 0 });
    expect(playPose(act, -0.1)).toEqual({ lift: 0, spin: 0 });
    for (let t = 0; t < 1; t += 0.01) {
      const { lift, spin } = playPose(act, t);
      expect(lift).toBeGreaterThanOrEqual(0);
      expect(lift).toBeLessThanOrEqual(1);
      expect(spin).toBeGreaterThanOrEqual(0);
      expect(spin).toBeLessThanOrEqual(1);
    }
  }
});

test("only the trick turns the pet right round, and a treat jumps first", () => {
  expect(playPose("trick", 0.999).spin).toBeGreaterThan(0.99);
  expect(playPose("trick", 0.5).lift).toBeCloseTo(1, 5);
  expect(playPose("pet", 0.5).spin).toBe(0);
  expect(playPose("treat", 0.15).lift).toBeCloseTo(1, 5);
  expect(playPose("treat", 0.8).lift).toBeLessThan(0.15);
});
