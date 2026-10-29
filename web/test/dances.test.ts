import { expect, test } from "bun:test";
import { DANCES } from "@tokenmaxxing/core/dances.ts";
import type { PlayerInfo } from "@tokenmaxxing/core/world.ts";
import { battlers, dance2D, danceOf } from "../src/game/dance.ts";
import { dancePose, newDancePose } from "../src/render3d/people/dances.ts";

/** A voxel adult's hip height and height, in world units; the thigh is 4 of the leg's 9 cubes. */
const HIP = 0.45;
const HEIGHT = 1.2;
const THIGH = (HIP * 4) / 9;
const SHIN = HIP - THIGH;

/** How high a foot is over the floor: the leg's swing forward and out, then the knee. */
const footY = (lift: number, leg: [number, number, number], knee: number): number =>
  HIP + lift - (THIGH * Math.cos(leg[0]) + SHIN * Math.cos(leg[0] + knee)) * Math.cos(leg[2]);

const TIMES = Array.from({ length: 240 }, (_, i) => i * 0.137);

test("every move gives finite angles at any time", () => {
  const p = newDancePose();
  for (const d of DANCES)
    for (const t of TIMES) {
      dancePose(d.move, t, HIP, HEIGHT, p);
      const numbers = [p.lift, p.slide, p.step, p.turn, p.lean, p.tilt, p.kneeL, p.kneeR];
      for (const v of [p.head, p.armL, p.armR, p.legL, p.legR]) numbers.push(...v);
      for (const n of numbers) expect(Number.isFinite(n), `${d.move} at ${t}`).toBe(true);
    }
});

test("feet never sink through the floor, and stay on it unless the move leaves it", () => {
  const p = newDancePose();
  for (const d of DANCES) {
    if (d.move === "headspin") continue;
    for (const t of TIMES) {
      dancePose(d.move, t, HIP, HEIGHT, p);
      const feet = [footY(p.lift, p.legL, p.kneeL), footY(p.lift, p.legR, p.kneeR)];
      expect(Math.min(...feet), `${d.move} at ${t}`).toBeGreaterThan(-0.02);
      if (d.move !== "levitate") expect(Math.min(...feet), `${d.move} at ${t}`).toBeLessThan(0.12);
    }
  }
  // Levitation floats clear of the floor.
  dancePose("levitate", 1, HIP, HEIGHT, p);
  expect(p.lift + HIP).toBeGreaterThan(0.35);
});

test("a headspin stands them on their head: upside down, lifted their own height", () => {
  const p = dancePose("headspin", 2, HIP, HEIGHT);
  expect(p.lean).toBeCloseTo(Math.PI);
  expect(p.lift).toBe(HEIGHT);
});

test("the 2D take keeps every dancer on or near their tile", () => {
  for (const d of DANCES)
    for (const t of TIMES) {
      const m = dance2D(d.move, t, "down");
      expect(Math.abs(m.dx), d.move).toBeLessThanOrEqual(4);
      expect(Math.abs(m.dy), d.move).toBeLessThanOrEqual(6);
      expect(m.squash).toBeGreaterThan(0.5);
    }
});

const who = (id: number, x: number, dance: number, state: "idle" | "sit" = "idle") => ({
  info: { id, dance } as PlayerInfo,
  state,
  x,
  y: 0,
});

test("dancing is on your feet only; dancers within three tiles of each other are in an aura battle", () => {
  expect(danceOf(who(1, 0, 15))?.name).toBe("Boat kid");
  expect(danceOf(who(1, 0, 15, "sit"))).toBeUndefined();
  expect(danceOf(who(1, 0, 0))).toBeUndefined();
  const fights = battlers([who(1, 0, 15), who(2, 3, 1), who(3, 10, 2), who(4, 1, 0)]);
  expect([...fights].sort()).toEqual([1, 2]);
});
