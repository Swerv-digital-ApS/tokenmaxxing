import type * as THREE from "three";
import { bumpStaticShadow, STATIC_LAYER, sceneEpoch } from "./bake.ts";

export interface DetailRange {
  /** Smallest dimension in world units; zero keeps the main geometry at every zoom. */
  size: number;
  end: number;
}

const scenes = new WeakMap<THREE.Scene, { epoch: number; meshes: THREE.Mesh[] }>();

/** Omit subpixel trim at the end of each batch without splitting it into extra draw calls. */
export function updateDetails(scene: THREE.Scene, pixelsPerUnit: number): void {
  let state = scenes.get(scene);
  if (!state || state.epoch !== sceneEpoch()) {
    state = { epoch: sceneEpoch(), meshes: [] };
    scene.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh && mesh.userData.detailRanges) state!.meshes.push(mesh);
    });
    scenes.set(scene, state);
  }
  let shadowsChanged = false;
  for (const mesh of state.meshes) {
    const geometry = mesh.geometry;
    const previous = geometry.drawRange.count;
    let count = 0;
    for (const range of mesh.userData.detailRanges as DetailRange[]) {
      // Separate thresholds prevent a detail popping in and out while zoom settles near one pixel.
      const threshold = range.end <= previous ? 0.8 : 1.2;
      if (range.size === 0 || range.size * pixelsPerUnit >= threshold) count = range.end;
      else break;
    }
    if (count === previous) continue;
    geometry.setDrawRange(0, count);
    shadowsChanged ||= mesh.castShadow && mesh.layers.isEnabled(STATIC_LAYER);
  }
  if (shadowsChanged) bumpStaticShadow();
}
