import { beforeAll, expect, test } from "bun:test";
import * as THREE from "three";
import {
  type Gait,
  gaitSettled,
  newGait,
  STRIDE,
  SWING,
  stepGait,
  walkPose,
} from "../src/render3d/people/motion.ts";
import { installHeadlessGlobals } from "../src/render3d/perf/stubs.ts";

installHeadlessGlobals();

let avatar: typeof import("../src/render3d/people/avatar.ts");
beforeAll(async () => {
  avatar = await import("../src/render3d/people/avatar.ts");
});

const DEG = Math.PI / 180;

test("the stride follows the ground covered, not the clock", () => {
  const g = newGait();
  // Standing still for a long time: no phase.
  for (let i = 0; i < 100; i++) stepGait(g, 0, 1 / 60, true);
  expect(g.phase).toBe(0);
  expect(g.weight).toBe(0);
  // One stride's worth of ground, slow or fast, is one cycle.
  const slow = newGait();
  const fast = newGait();
  for (let i = 0; i < 60; i++) stepGait(slow, STRIDE / 60, 1 / 30, true);
  for (let i = 0; i < 60; i++) stepGait(fast, STRIDE / 60, 1 / 120, true);
  expect(slow.phase).toBeCloseTo(1, 6);
  expect(fast.phase).toBeCloseTo(1, 6);
  expect(slow.weight).toBeGreaterThan(0.95);
});

test("the swing is about thirty degrees at the hip, the arms opposite and a little less, with a small bob", () => {
  let maxLeg = 0;
  let maxArm = 0;
  let maxBob = 0;
  let minBob = 1;
  for (let p = 0; p < 1; p += 1 / 64) {
    const w = walkPose(p, 1);
    maxLeg = Math.max(maxLeg, Math.abs(w.leg));
    maxArm = Math.max(maxArm, Math.abs(w.arm));
    maxBob = Math.max(maxBob, w.bob);
    minBob = Math.min(minBob, w.bob);
    // Arms oppose the legs on the same side.
    if (Math.abs(w.leg) > 1e-6) expect(Math.sign(w.arm)).toBe(-Math.sign(w.leg));
    expect(w.knee[0]).toBeGreaterThanOrEqual(0);
    expect(w.knee[1]).toBeGreaterThanOrEqual(0);
  }
  expect(maxLeg).toBeCloseTo(30 * DEG, 1);
  expect(maxArm).toBeCloseTo(25 * DEG, 1);
  expect(maxBob).toBeCloseTo(SWING.bob, 6);
  expect(maxBob).toBeGreaterThanOrEqual(0.02);
  expect(maxBob).toBeLessThanOrEqual(0.03);
  expect(minBob).toBeCloseTo(0, 6);
  // Twice a cycle: the body is highest as the legs pass each other.
  expect(walkPose(0, 1).bob).toBeCloseTo(SWING.bob, 6);
  expect(walkPose(0.5, 1).bob).toBeCloseTo(SWING.bob, 6);
  expect(walkPose(0.25, 1).bob).toBeCloseTo(0, 6);
});

test("stopping settles at the neutral pose within half a step, and never freezes mid-stride", () => {
  const g = newGait();
  for (let i = 0; i < 30; i++) stepGait(g, 2.5 / 60, 1 / 60, true);
  const walkedTo = g.phase;
  expect(Math.abs(walkPose(g.phase, g.weight).leg)).toBeGreaterThan(0.05);
  let frames = 0;
  while (!gaitSettled(g) && frames < 600) {
    stepGait(g, 0, 1 / 60, false);
    frames++;
  }
  expect(gaitSettled(g)).toBe(true);
  // Legs together, body level, inside one half-step of ground.
  const w = walkPose(g.phase, g.weight);
  expect(w.leg).toBeCloseTo(0, 6);
  expect(w.arm).toBeCloseTo(0, 6);
  expect(w.bob).toBeCloseTo(0, 6);
  expect(g.phase - walkedTo).toBeLessThanOrEqual(0.5 + 1e-9);
  expect(g.phase % 0.5).toBeCloseTo(0, 6);
  expect(frames / 60).toBeLessThan(0.4);
});

test("the torso leans only while the pace changes", () => {
  const g = newGait();
  for (let i = 0; i < 6; i++) stepGait(g, 3 / 60, 1 / 60, true);
  const starting = g.lean;
  expect(starting).toBeGreaterThan(0.01);
  for (let i = 0; i < 90; i++) stepGait(g, 3 / 60, 1 / 60, true);
  expect(Math.abs(g.lean)).toBeLessThan(0.005);
  expect(Math.abs(g.lean)).toBeLessThan(starting);
  expect(Math.abs(g.lean)).toBeLessThanOrEqual(SWING.lean);
});

/** The voxel rig, walked through a cycle: where the hip, knee and foot of each leg end up. */
function legsOf(a: InstanceType<typeof import("../src/render3d/people/avatar.ts").Avatar>) {
  a.root.updateMatrixWorld(true);
  return a.legs.map((leg) => {
    const knee = leg.children.find((c) => (c as THREE.Group).isGroup) as THREE.Group;
    const shin = knee.children.find((c) => (c as THREE.Mesh).isMesh) as THREE.Mesh;
    shin.geometry.computeBoundingBox();
    const bb = shin.geometry.boundingBox!;
    return {
      hip: leg.getWorldPosition(new THREE.Vector3()),
      thighEnd: leg.localToWorld(knee.position.clone()),
      knee: knee.getWorldPosition(new THREE.Vector3()),
      shinTop: shin.localToWorld(new THREE.Vector3(0, bb.max.y, 0)),
      foot: shin.localToWorld(new THREE.Vector3(0, bb.min.y, 0)),
    };
  });
}

test("the feet stay on the legs through the whole stride and the legs pivot at the hip", () => {
  const a = new avatar.Avatar(
    avatar.randomLook(() => 0.3),
    "voxel",
  );
  new THREE.Scene().add(a.root);
  a.pose = "walk";
  const hips = legsOf(a).map((l) => l.hip.clone());
  const legLength = a.hip;
  let swung = 0;
  for (let i = 0; i < 90; i++) {
    a.update(1 / 60, i / 60, 2.5 / 60);
    for (const [k, l] of legsOf(a).entries()) {
      // The shin's top sits on the thigh's end: no gap opens at the knee.
      expect(l.shinTop.distanceTo(l.thighEnd)).toBeLessThan(1e-6);
      expect(l.knee.distanceTo(l.thighEnd)).toBeLessThan(1e-6);
      // The foot is a leg's length from the hip at most (a bent knee brings it closer), never further.
      expect(l.foot.distanceTo(l.hip)).toBeLessThanOrEqual(legLength + 1e-6);
      // The hip doesn't drift sideways or along the walk: the leg turns, it doesn't slide (the body only bobs).
      expect(Math.hypot(l.hip.x - hips[k]!.x, l.hip.z - hips[k]!.z)).toBeLessThan(0.03);
      swung = Math.max(swung, Math.abs(a.legs[k]!.rotation.x));
    }
  }
  expect(swung).toBeGreaterThan(25 * DEG);
  expect(swung).toBeLessThan(35 * DEG);
  a.dispose();
});

test("a person who stops ends in the neutral pose, and sitting and sleeping still work", () => {
  const a = new avatar.Avatar(
    avatar.randomLook(() => 0.7),
    "voxel",
  );
  new THREE.Scene().add(a.root);
  a.pose = "walk";
  for (let i = 0; i < 20; i++) a.update(1 / 60, i / 60, 2.5 / 60);
  a.pose = "stand";
  for (let i = 0; i < 40; i++) a.update(1 / 60, 1 + i / 60, 0);
  expect(gaitSettled(a.gait)).toBe(true);
  expect(Math.abs(a.legs[0]!.rotation.x)).toBeLessThan(1e-6);
  expect(Math.abs(a.legs[1]!.rotation.x)).toBeLessThan(1e-6);
  expect(Math.abs(a.arms[0]!.rotation.x)).toBeLessThan(1e-6);
  expect(Math.abs(a.body.rotation.x)).toBeLessThan(1e-3);
  // Breathing only.
  expect(Math.abs(a.body.position.y)).toBeLessThan(0.01);
  a.pose = "sit";
  a.update(1 / 60, 3, 0);
  expect(a.legs[0]!.rotation.x).toBeCloseTo(-Math.PI / 2, 6);
  expect(a.body.position.y).toBeCloseTo(-a.hip + 0.02, 6);
  a.pose = "sleep";
  a.update(1 / 60, 4, 0);
  expect(a.body.rotation.x).toBeCloseTo(-Math.PI / 2, 6);
  a.dispose();
});

test("a walk at a fixed pace reads as one gait in the sampler and the pet trots by distance too", () => {
  const g: Gait = newGait(0.3);
  stepGait(g, 0.5, 1 / 60, true);
  expect(g.phase).toBeCloseTo(0.3 + 0.5 / STRIDE, 9);
  const p = new avatar.Pet("dog", "#a0522d");
  new THREE.Scene().add(p.root);
  p.moving = true;
  for (let i = 0; i < 30; i++) p.update(i / 60, 2 / 60);
  const bobbing = Math.abs((p.root.children[0] as THREE.Object3D).position.y);
  p.moving = false;
  for (let i = 30; i < 90; i++) p.update(i / 60, 0);
  expect((p.root.children[0] as THREE.Object3D).position.y).toBeCloseTo(0, 6);
  expect(bobbing).toBeGreaterThanOrEqual(0);
  p.dispose();
});
