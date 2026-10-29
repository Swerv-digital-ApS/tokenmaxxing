import { expect, test } from "bun:test";
import * as THREE from "three";
import { Model } from "../src/render3d/kit/kit.ts";
import { bakeStatic, staticShadowEpoch, trackAdditions } from "../src/render3d/perf/bake.ts";
import { updateDetails } from "../src/render3d/perf/details.ts";
import { sceneStats } from "../src/render3d/perf/stats.ts";

trackAdditions();

for (const mode of ["smooth", "block"] as const) {
  test(`${mode} batches drop subpixel trim without extra draws and restore it on zoom`, () => {
    const scene = new THREE.Scene();
    const model = new Model();
    model.box([2, 2, 2], "#887766", [0, 0, 0], 0);
    const rail = model.box([1, 0.05, 0.05], "#ccaa88", [0, 2, 0], 0);
    rail.scale.x = -1;
    rail.userData.detailSize = 0.05;
    const bar = model.box([0.025, 0.5, 0.025], "#eeccaa", [0, 2, 0], 0);
    bar.geometry = bar.geometry.toNonIndexed();
    bar.userData.detailSize = 0.025;
    scene.add(model);
    const layer = bakeStatic(model)!;
    layer.show(mode);
    updateDetails(scene, 100);
    expect(sceneStats(scene).triangles).toBe(36);
    expect(sceneStats(scene).drawables).toBe(1);

    const shadowBefore = staticShadowEpoch();
    updateDetails(scene, 30);
    expect(sceneStats(scene).triangles).toBe(24);
    expect(sceneStats(scene).drawables).toBe(1);
    expect(staticShadowEpoch()).toBeGreaterThan(shadowBefore);
    updateDetails(scene, 40);
    expect(sceneStats(scene).triangles).toBe(24);
    updateDetails(scene, 10);
    expect(sceneStats(scene).triangles).toBe(12);
    updateDetails(scene, 20);
    expect(sceneStats(scene).triangles).toBe(12);
    updateDetails(scene, 60);
    expect(sceneStats(scene).triangles).toBe(36);
    expect(sceneStats(scene).drawables).toBe(1);

    layer.suspend();
    expect(sceneStats(scene).triangles).toBe(36);
    expect(sceneStats(scene).drawables).toBe(3);
    layer.resume(mode);
    updateDetails(scene, 1);
    expect(sceneStats(scene).triangles).toBe(12);
    layer.dispose();
    expect(sceneStats(scene).triangles).toBe(36);
  });
}
