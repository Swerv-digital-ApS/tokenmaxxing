import { expect, test } from "bun:test";
import * as THREE from "three";
import { STATIC_LAYER, staticShadowEpoch, trackAdditions } from "../src/render3d/perf/bake.ts";
import { stabilizeShadow } from "../src/render3d/perf/shadow-grid.ts";
import { classifyCasters } from "../src/render3d/perf/shadowcast.ts";

trackAdditions();

function settle(scene: THREE.Scene): void {
  for (let frame = 0; frame < 420; frame++) {
    scene.updateMatrixWorld(true);
    classifyCasters(scene);
  }
}

for (const change of ["rotate", "scale", "translate", "parent"] as const) {
  test(`a cached prop returns to live shadows when it changes ${change}`, () => {
    const scene = new THREE.Scene();
    const parent = new THREE.Group();
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial());
    mesh.castShadow = true;
    parent.add(mesh);
    scene.add(parent);
    settle(scene);
    expect(mesh.layers.isEnabled(STATIC_LAYER)).toBe(true);
    const before = staticShadowEpoch();
    if (change === "rotate") mesh.rotation.y = 0.2;
    else if (change === "scale") mesh.scale.y = 1.2;
    else if (change === "translate") mesh.position.x = 0.02;
    else parent.rotation.y = 0.2;
    scene.updateMatrixWorld(true);
    classifyCasters(scene);
    expect(mesh.layers.mask).toBe(1);
    expect(staticShadowEpoch()).toBeGreaterThan(before);
    settle(scene);
    expect(mesh.layers.isEnabled(STATIC_LAYER)).toBe(true);
  });
}

test("removing a cached caster invalidates its old shadow", () => {
  const scene = new THREE.Scene();
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial());
  mesh.castShadow = true;
  scene.add(mesh);
  settle(scene);
  const before = staticShadowEpoch();
  mesh.removeFromParent();
  classifyCasters(scene);
  expect(staticShadowEpoch()).toBeGreaterThan(before);
});

test("instanced animations and actors keep live shadows after standing still", () => {
  const scene = new THREE.Scene();
  const instanced = new THREE.InstancedMesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial(), 2);
  const actor = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial());
  actor.userData.actor = true;
  instanced.castShadow = actor.castShadow = true;
  scene.add(instanced, actor);
  settle(scene);
  expect(instanced.layers.mask).toBe(1);
  expect(actor.layers.mask).toBe(1);
});

test("tracking the camera moves stationary geometry by whole shadow texels", () => {
  const light = new THREE.DirectionalLight();
  const camera = light.shadow.camera;
  camera.left = camera.bottom = -20;
  camera.right = camera.top = 20;
  camera.updateProjectionMatrix();

  for (const size of [512, 1024, 2048, 4096]) {
    light.shadow.mapSize.set(size, size);
    const projected = (x: number, z: number) => {
      light.target.position.set(x, 0, z);
      light.position.set(x - 11, 14, z + 7);
      stabilizeShadow(light);
      light.updateMatrixWorld();
      light.target.updateMatrixWorld();
      light.shadow.updateMatrices(light);
      return new THREE.Vector3(4, 0, 3).applyMatrix4(light.shadow.matrix).multiplyScalar(size);
    };
    let previous = projected(5, 6);
    for (let frame = 1; frame < 100; frame++) {
      const current = projected(5 + frame * 0.001, 6 + frame * 0.001);
      const dx = current.x - previous.x;
      const dy = current.y - previous.y;
      expect(dx).toBeCloseTo(Math.round(dx), 8);
      expect(dy).toBeCloseTo(Math.round(dy), 8);
      previous = current;
    }
  }
});
