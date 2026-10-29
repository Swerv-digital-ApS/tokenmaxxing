import { beforeAll, expect, test } from "bun:test";
import * as THREE from "three";
import { installHeadlessGlobals } from "../src/render3d/perf/stubs.ts";

installHeadlessGlobals();

let avatar: typeof import("../src/render3d/people/avatar.ts");
let bake: typeof import("../src/render3d/perf/bake.ts");
let freeze: typeof import("../src/render3d/perf/freeze.ts");
beforeAll(async () => {
  avatar = await import("../src/render3d/people/avatar.ts");
  bake = await import("../src/render3d/perf/bake.ts");
  freeze = await import("../src/render3d/perf/freeze.ts");
});

const drawn = (root: THREE.Object3D): number => {
  let n = 0;
  root.traverseVisible((o) => {
    if ((o as THREE.Mesh).isMesh) n++;
  });
  return n;
};

test("an idle person is merged into a couple of meshes, and comes back when they move", () => {
  const scene = new THREE.Scene();
  const a = new avatar.Avatar(
    avatar.randomLook(() => 0.3),
    "voxel",
  );
  scene.add(a.root);
  const before = drawn(a.root);
  expect(before).toBeGreaterThan(8);
  // 24 frames at rest, then it is frozen.
  for (let i = 0; i < 30; i++) a.update(1 / 60, i / 60);
  const frozen = drawn(a.root);
  expect(frozen).toBeLessThan(before / 2);
  expect(frozen).toBeGreaterThan(0);
  // Walking gives the limbs back.
  a.pose = "walk";
  a.update(1 / 60, 1);
  expect(drawn(a.root)).toBe(before);
  a.dispose();
});

test("a frozen copy follows its person", () => {
  const scene = new THREE.Scene();
  const a = new avatar.Avatar(
    avatar.randomLook(() => 0.6),
    "voxel",
  );
  scene.add(a.root);
  for (let i = 0; i < 30; i++) a.update(1 / 60, i / 60);
  a.root.position.set(5, 0, 7);
  scene.updateMatrixWorld(true);
  let moved = 0;
  a.root.traverseVisible((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh && m.name.startsWith("baked")) {
      m.geometry.computeBoundingBox();
      const c = m.geometry.boundingBox!.getCenter(new THREE.Vector3()).applyMatrix4(m.matrixWorld);
      if (Math.abs(c.x - 5) < 1.5 && Math.abs(c.z - 7) < 1.5) moved++;
    }
  });
  expect(moved).toBeGreaterThan(0);
});

test("freezing frees what it made when the person leaves", () => {
  const scene = new THREE.Scene();
  const a = new avatar.Avatar(
    avatar.randomLook(() => 0.9),
    "voxel",
  );
  scene.add(a.root);
  for (let i = 0; i < 30; i++) a.update(1 / 60, i / 60);
  const held = bake.frozenCount();
  expect(held).toBeGreaterThan(0);
  scene.remove(a.root);
  freeze.sweep();
  expect(bake.frozenCount()).toBeLessThan(held);
});
