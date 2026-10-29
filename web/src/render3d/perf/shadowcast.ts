import type * as THREE from "three";
import { bumpStaticShadow, STATIC_LAYER, sceneEpoch } from "./bake.ts";

/**
 * Which shadow casters are worth redrawing. Whatever the batching left as separate meshes (live props, glass, signs,
 * a lamp that sways) is watched for changes to its full world transform. Moving props stay on the per-frame
 * layer and go back to the baked one after a long rest. Actors, skinned meshes and instanced animations
 * always stay live, since their silhouette can change without moving the mesh itself.
 */
interface Caster {
  mesh: THREE.Mesh;
  transform: number[];
  vis: boolean;
  calm: number;
  flips: number;
  fixed: boolean;
}

interface State {
  epoch: number;
  list: Caster[];
  known: WeakMap<THREE.Mesh, Caster>;
}

/** Debug: why the baked map was redrawn. */
export const why = { vis: 0, unfix: 0, fix: 0 };
(globalThis as unknown as { __shadowWhy: typeof why }).__shadowWhy = why;
const states = new WeakMap<THREE.Object3D, State>();
const TRANSFORM_EPSILON = 1e-5;
/** Calm frames before a mesh moves to the baked layer; a mesh that has travelled before waits much longer. */
const CALM = 180;
const CALM_AFTER_TRAVEL = 400;

function visibleUp(o: THREE.Object3D, top: THREE.Object3D): boolean {
  for (let p: THREE.Object3D | null = o; p && p !== top; p = p.parent) if (!p.visible) return false;
  return true;
}

function actorUp(o: THREE.Object3D): boolean {
  for (let p: THREE.Object3D | null = o; p; p = p.parent) if (p.userData.actor) return true;
  return false;
}

/** Watches the scene's casters for one frame; returns true when the static set changed (the baked map is stale). */
export function classifyCasters(scene: THREE.Scene): boolean {
  let s = states.get(scene);
  if (!s) {
    s = { epoch: -1, list: [], known: new WeakMap() };
    states.set(scene, s);
  }
  let changed0 = false;
  if (s.epoch !== sceneEpoch()) {
    s.epoch = sceneEpoch();
    const list: Caster[] = [];
    scene.traverseVisible((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh || !m.castShadow || m.userData.bakedSource) return;
      let c = s!.known.get(m);
      if (!c) {
        // Merged batches are already on the baked layer; actors never leave the live one.
        const deforming =
          (m as THREE.InstancedMesh).isInstancedMesh ||
          (m as THREE.SkinnedMesh).isSkinnedMesh ||
          (m.morphTargetInfluences?.length ?? 0) > 0;
        if (m.layers.mask !== 1 || actorUp(m) || deforming) return;
        c = {
          mesh: m,
          transform: m.matrixWorld.elements.slice(),
          vis: true,
          calm: 0,
          flips: 0,
          fixed: false,
        };
        s!.known.set(m, c);
      }
      list.push(c);
    });
    // A baked caster that left the scene (a floating emoji after a few seconds) is still in the baked map.
    const now = new Set(list);
    if (s.list.some((c) => c.fixed && !now.has(c))) changed0 = true;
    s.list = list;
  }
  let changed = changed0;
  for (const c of s.list) {
    const m = c.mesh;
    const e = m.matrixWorld.elements;
    const vis = visibleUp(m, scene);
    if (vis !== c.vis) {
      // Shown or hidden (a night copy, a door): the baked map shows the wrong thing, so it goes back to the live layer.
      c.vis = vis;
      c.calm = 0;
      c.flips++;
      if (c.fixed) {
        c.fixed = false;
        m.layers.set(0);
        changed = true;
        why.vis++;
      }
      continue;
    }
    let moved = false;
    for (let i = 0; i < 16; i++) {
      if (Math.abs(e[i]! - c.transform[i]!) > TRANSFORM_EPSILON) {
        moved = true;
        break;
      }
    }
    if (moved) {
      c.calm = 0;
      c.flips++;
      for (let i = 0; i < 16; i++) c.transform[i] = e[i]!;
      if (c.fixed) {
        c.fixed = false;
        m.layers.set(0);
        changed = true;
        why.unfix++;
      }
    } else if (!c.fixed && vis && ++c.calm >= (c.flips > 0 ? CALM_AFTER_TRAVEL : CALM)) {
      c.fixed = true;
      m.layers.set(STATIC_LAYER);
      changed = true;
      why.fix++;
    }
  }
  if (changed) bumpStaticShadow();
  return changed;
}
