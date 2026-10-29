import { expect, test } from "bun:test";
import {
  COOLDOWN_MS,
  Governor,
  MIN_SCALE,
  percentile,
  refreshInterval,
  STABLE_MS,
  type Step,
  SUSTAIN_MS,
} from "../src/settings/governor.ts";

/** Feeds frames of `dt` ms until `ms` of time has passed; returns the steps taken. */
function run(
  g: Governor,
  from: number,
  ms: number,
  dt: number,
  target = 16.7,
): { steps: Step[]; at: number } {
  const steps: Step[] = [];
  let t = from;
  while (t < from + ms) {
    t += dt;
    const s = g.push(dt, target, t);
    if (s) steps.push(s);
  }
  return { steps, at: t };
}

test("percentiles", () => {
  expect(percentile([], 0.5)).toBe(0);
  expect(percentile([1, 2, 3, 4], 0.75)).toBe(4);
});

test("a smooth run changes nothing", () => {
  const g = new Governor("high");
  expect(run(g, 0, 20_000, 16.7).steps).toEqual([]);
});

test("slowness lowers the render scale first, then the tier", () => {
  const g = new Governor("high");
  let at = 0;
  const kinds: string[] = [];
  for (let i = 0; i < 8; i++) {
    const r = run(g, at, SUSTAIN_MS + COOLDOWN_MS + 2000, 40);
    at = r.at;
    kinds.push(...r.steps.map((s) => s.kind));
  }
  expect(kinds.slice(0, 4)).toEqual(["scale", "scale", "scale", "tier"]);
  expect(g.scaleMul).toBeGreaterThanOrEqual(MIN_SCALE);
  expect(g.tier).not.toBe("high");
});

test("a machine far too slow skips the scale steps and drops a tier at once", () => {
  const g = new Governor("high");
  const r = run(g, 0, SUSTAIN_MS + 6000, 80);
  expect(r.steps).toEqual([{ kind: "tier", tier: "medium", scaleMul: 1 }]);
});

test("a short stutter is ignored, and so is a hidden tab", () => {
  const g = new Governor("high");
  expect(run(g, 0, 2000, 40).steps).toEqual([]);
  const r = run(g, 2000, 3000, 16.7);
  expect(g.push(30_000, 16.7, r.at + 30_000)).toBeNull();
  expect(run(g, r.at + 30_000, 20_000, 16.7).steps).toEqual([]);
});

test("after a change it waits before judging again", () => {
  const g = new Governor("high");
  const first = run(g, 0, SUSTAIN_MS + 3000, 40);
  expect(first.steps).toHaveLength(1);
  expect(run(g, first.at, COOLDOWN_MS - 2000, 40).steps).toEqual([]);
});

test("it never goes below Low", () => {
  const g = new Governor("low", MIN_SCALE);
  expect(run(g, 0, 30_000, 60).steps).toEqual([]);
});

test("a long stable run steps back up, but only in Auto", () => {
  const g = new Governor("medium", 1, 0);
  g.autoUp = false;
  expect(run(g, 0, STABLE_MS + 5000, 16.7).steps).toEqual([]);
  g.autoUp = true;
  expect(run(g, STABLE_MS + 5000, 1000, 16.7).steps[0]).toMatchObject({ kind: "up", tier: "high" });
});

test("it restores the scale before going up a tier", () => {
  const g = new Governor("high", 0.75, 0);
  expect(run(g, 0, STABLE_MS + 2000, 16.7).steps[0]).toMatchObject({ kind: "scale", scaleMul: 0.875 });
});

test("a tier it had to leave right after stepping up is off limits", () => {
  const g = new Governor("medium", 1, 0);
  const up = run(g, 0, STABLE_MS + 2000, 16.7);
  expect(up.steps.at(-1)).toMatchObject({ kind: "up", tier: "high" });
  let at = up.at;
  for (let i = 0; i < 6 && g.tier === "high"; i++) at = run(g, at, SUSTAIN_MS + COOLDOWN_MS, 40).at;
  expect(g.tier).toBe("medium");
  expect(run(g, at, STABLE_MS * 3, 16.7).steps.filter((s) => s.kind === "up")).toEqual([]);
});

test("a change from outside starts fresh", () => {
  const g = new Governor("high");
  run(g, 0, SUSTAIN_MS - 500, 40);
  g.reset("medium", 1, 5000);
  expect(run(g, 5000, 3000, 40).steps).toEqual([]);
});

test("the refresh interval is the median of the first gaps, bounded to 60-240 Hz", () => {
  expect(refreshInterval(Array(30).fill(8.33))).toBeCloseTo(8.33);
  expect(refreshInterval([8.3, 8.4, 8.3, 40, 8.3, 8.4, 90, 8.3])).toBeCloseTo(8.35, 0);
  expect(refreshInterval(Array(30).fill(33))).toBeCloseTo(1000 / 60);
  expect(refreshInterval(Array(30).fill(1))).toBeCloseTo(1000 / 240);
  expect(refreshInterval([16, 16])).toBeCloseTo(1000 / 60);
});

test("on a 120 Hz screen a steady 60 fps is slow and gets judged so", () => {
  const g = new Governor("high");
  const r = run(g, 0, SUSTAIN_MS + 14_000, 16.7, 8.33);
  expect(r.steps.length).toBeGreaterThan(0);
});
