import type * as THREE from "three";
import { blockify } from "../kit/blocky.ts";
import { batchStatic } from "./batch.ts";

/**
 * Merges the parts of `root` that never move into a few meshes, once, as the stage does for a room (events are
 * built after it): a model of sixty little boxes becomes a handful of draw calls. `keep` names meshes that change
 * (a flame's colour). `root` may be hidden: it is shown while it is merged.
 */
export function mergeStill(root: THREE.Object3D, keep: (mesh: THREE.Mesh) => boolean = () => false): void {
  const was = root.visible;
  root.visible = true;
  blockify(root);
  batchStatic(root, {
    chunk: 100,
    samples: 1,
    probe: () => {},
    keep: (m) => m.userData.live === true || keep(m),
  });
  root.visible = was;
}
