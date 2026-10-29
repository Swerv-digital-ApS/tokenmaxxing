import { expect, test } from "bun:test";
import * as THREE from "three";
import { installHeadlessGlobals } from "../src/render3d/perf/stubs.ts";

installHeadlessGlobals();

test("touched grass has a voxel model that fits its two-tile footprint", async () => {
  const { extraAssetById } = await import("../src/render3d/furniture/furniture3d.ts");
  const asset = extraAssetById.get("touched-grass")!;
  expect(asset.w).toBe(2);
  expect(asset.d).toBe(1);
  const model = asset.build();
  const box = new THREE.Box3().setFromObject(model);
  // Two tiles wide and one deep at most, a patch not a hedge.
  expect(box.max.x - box.min.x).toBeLessThanOrEqual(2);
  expect(box.max.z - box.min.z).toBeLessThanOrEqual(1);
  expect(box.max.y).toBeLessThan(0.7);
  let meshes = 0;
  model.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) meshes++;
  });
  expect(meshes).toBeGreaterThan(20); // sod, tufts and flowers
});
