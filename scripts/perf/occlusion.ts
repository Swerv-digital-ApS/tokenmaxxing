// bun scripts/perf/occlusion.ts: CPU probe cost, independent of GPU and render cadence.
import * as THREE from "../../web/node_modules/three/build/three.module.js";
import { installHeadlessGlobals } from "../../web/src/render3d/perf/stubs.ts";

installHeadlessGlobals();
const { loadAllSlices } = await import("../../web/src/render3d/perf/headless.ts");
const { World } = await import("../../web/src/render3d/rooms/world.ts");
const { bakeStatic, freezeLayer, trackAdditions } = await import("../../web/src/render3d/perf/bake.ts");
const { PlayerOcclusion, seeThrough } = await import("../../web/src/render3d/engine/seethrough.ts");
const { disposeObject } = await import("../../web/src/render3d/engine/dispose.ts");
trackAdditions();
await loadAllSlices();
const world = new World();
const percentile = (times: number[], p: number) => {
  times.sort((a, b) => a - b);
  return Math.round(times[Math.floor((times.length - 1) * p)]! * 100) / 100;
};
for (const id of ["town", "shop-clothes", "shop-pets", "inn"] as const) {
  const root = world.room(id).group;
  const scene = new THREE.Scene();
  scene.add(root);
  seeThrough(root);
  const layer = bakeStatic(root);
  layer?.show("smooth");
  const actors: THREE.Object3D[] = [];
  root.traverse((o) => {
    if (o.userData.actor) actors.push(o);
  });
  for (const actor of actors) freezeLayer(actor);
  root.updateMatrixWorld(true);
  const center = new THREE.Box3().setFromObject(root).getCenter(new THREE.Vector3());
  const camera = new THREE.OrthographicCamera(-15, 15, 10, -10, 0.1, 200);
  camera.position.set(center.x + 14, 18, center.z + 14);
  camera.lookAt(center.x, 0, center.z);
  camera.updateMatrixWorld();
  const probe = new PlayerOcclusion(root);
  const at = new THREE.Vector3(center.x, 0.9, center.z);
  const cold = performance.now();
  probe.update(at, camera, 0.081, false);
  const coldMs = performance.now() - cold;
  const moving: number[] = [];
  const stationary: number[] = [];
  // Discard one full journey to separate construction/JIT from settled probe timings.
  for (let round = 0; round < 2; round++)
    for (let i = 0; i < 40; i++) {
      at.set(center.x + ((i % 5) - 2) * 2, 0.9, center.z + ((Math.floor(i / 5) % 5) - 2) * 2);
      const start = performance.now();
      probe.update(at, camera, 0.081, false);
      if (round) moving.push(performance.now() - start);
    }
  for (let i = 0; i < 40; i++) {
    const start = performance.now();
    probe.update(at, camera, 0.081, false);
    stationary.push(performance.now() - start);
  }
  console.log(
    JSON.stringify({
      room: id,
      coldMs: Math.round(coldMs * 100) / 100,
      moving: { p50: percentile(moving, 0.5), p95: percentile(moving, 0.95) },
      stationary: { p50: percentile(stationary, 0.5), p95: percentile(stationary, 0.95) },
    }),
  );
  disposeObject(scene);
  scene.clear();
}
