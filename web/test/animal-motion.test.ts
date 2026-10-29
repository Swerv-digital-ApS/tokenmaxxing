import { expect, test } from "bun:test";
import { Box3 } from "three";
import { PigeonMotion } from "../src/game/animal-motion.ts";
import { TownPigeon } from "../src/render3d/town/animals3d.ts";

test("a pigeon takes off continuously, flaps, lands aside and returns home", () => {
  const bird = new PigeonMotion();
  expect(bird.sample(999).offset).toBe(0);
  bird.scare(1000);
  expect(bird.sample(1000)).toMatchObject({ offset: 0, lift: 0, wing: 0 });
  const first = { ...bird.sample(1001) };
  expect(first.offset).toBeLessThan(0.001);
  expect(first.lift).toBeLessThan(0.01);
  const peak = { ...bird.sample(1350) };
  expect(peak.offset).toBeCloseTo(0.5);
  expect(peak.lift).toBeCloseTo(0.8);
  expect(peak.wing).toBeGreaterThan(0);
  expect(bird.sample(1700)).toMatchObject({ offset: 1, lift: 0, wing: 0 });
  const back = { ...bird.sample(3075) };
  expect(back.returning).toBe(true);
  expect(back.offset).toBeCloseTo(0.5);
  expect(back.lift).toBeCloseTo(0.8);
  expect(bird.sample(3550)).toMatchObject({ offset: 0, lift: 0, wing: 0 });
});

test("lingering near a pigeon keeps it grounded aside instead of hovering or restarting", () => {
  const bird = new PigeonMotion();
  for (let now = 1000; now <= 5000; now += 50) {
    const p = bird.sample(now, true);
    if (now >= 1700) expect(p).toMatchObject({ offset: 1, lift: 0, wing: 0 });
  }
  expect(bird.sample(5900)).toMatchObject({ offset: 1, lift: 0, wing: 0 });
  expect(bird.sample(6375).lift).toBeCloseTo(0.8);
  expect(bird.sample(6850)).toMatchObject({ offset: 0, lift: 0 });
  // A second encounter starts at ground level again.
  expect(bird.sample(7000, true)).toMatchObject({ offset: 0, lift: 0 });
});

test("repeated clicks during a hop do not snap it back to its launch point", () => {
  const bird = new PigeonMotion();
  bird.scare(1000);
  const before = { ...bird.sample(1300) };
  bird.scare(1300);
  expect(bird.sample(1300)).toEqual(before);
  bird.sample(2700); // On the return leg now.
  const returning = { ...bird.sample(2800) };
  bird.scare(2800);
  expect(bird.sample(2800)).toEqual(returning);
});

test("pose depends on elapsed time rather than frame rate", () => {
  const sparse = new PigeonMotion();
  const dense = new PigeonMotion();
  sparse.scare(1000);
  dense.scare(1000);
  for (let now = 1000; now < 1350; now += 8) dense.sample(now);
  expect(sparse.sample(1350)).toEqual(dense.sample(1350));
  expect(sparse.sample(100_000)).toMatchObject({ offset: 0, lift: 0, wing: 0 });
});

test("a grounded pigeon's wings fold down beside its body and lift symmetrically in flight", () => {
  const bird = new TownPigeon();
  const pose = { offset: 0, lift: 0, wing: 0, peck: 0, returning: false };
  bird.update(pose, 0, false);
  for (const name of ["left-wing", "right-wing"]) {
    const box = new Box3().setFromObject(bird.root.getObjectByName(name)!);
    expect(box.min.y).toBeGreaterThan(-0.02);
    expect(box.max.y).toBeLessThan(0.3);
  }
  bird.update({ ...pose, lift: 0.8, wing: 1.2 }, 0, false);
  const left = new Box3().setFromObject(bird.root.getObjectByName("left-wing")!);
  const right = new Box3().setFromObject(bird.root.getObjectByName("right-wing")!);
  expect(left.max.y).toBeGreaterThan(0.4);
  expect(left.max.y).toBeCloseTo(right.max.y);
});
