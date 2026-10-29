import { beforeAll, expect, test } from "bun:test";
import * as THREE from "three";
import { blockify } from "../src/render3d/kit/blocky.ts";
import { installHeadlessGlobals } from "../src/render3d/perf/stubs.ts";

installHeadlessGlobals();

let assets: typeof import("../src/render3d/rooms/tavern3d.ts").TAVERN_ASSETS;
beforeAll(async () => {
  assets = (await import("../src/render3d/rooms/tavern3d.ts")).TAVERN_ASSETS;
});

function expectSingleSurface(model: THREE.Object3D, ray: THREE.Raycaster) {
  const hits = ray.intersectObject(model, true);
  expect(hits.length).toBeGreaterThan(0);
  const nearest = hits.filter((hit) => Math.abs(hit.distance - hits[0]!.distance) < 1e-5);
  expect(new Set(nearest.map((hit) => hit.object)).size).toBe(1);
}

for (const mode of ["smooth", "block"] as const) {
  for (const id of ["tavern:booth-r", "tavern:sofa-r", "tavern:armchair"]) {
    test(`${mode} ${id} has one visible surface on the outer arm`, () => {
      const model = assets.find((asset) => asset.id === id)!.build();
      if (mode === "block") blockify(model);
      model.updateMatrixWorld(true);

      for (const y of [0.17, 0.5]) {
        const ray = new THREE.Raycaster(new THREE.Vector3(2, y, -0.32), new THREE.Vector3(-1, 0, 0));
        expectSingleSurface(model, ray);
      }
    });
  }

  test(`${mode} stage trim has one visible surface along its top and front`, () => {
    const asset = assets.find((asset) => asset.id === "tavern:stage")!;
    const model = asset.build();
    if (mode === "block") blockify(model);
    model.updateMatrixWorld(true);

    expectSingleSurface(
      model,
      new THREE.Raycaster(new THREE.Vector3(asset.w / 2 - 0.025, 2, 0), new THREE.Vector3(0, -1, 0)),
    );
    expectSingleSurface(
      model,
      new THREE.Raycaster(new THREE.Vector3(0, 0.02, 3), new THREE.Vector3(0, 0, -1)),
    );
  });
}
