import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

export interface BatchOptions {
  /** Meshes closer together than this (world units, in x and z) can share a draw call. */
  chunk: number;
  /** Puts the room in state `i` of `samples` (another hour, another time, another view): what moves shows. */
  probe: (i: number) => void;
  samples: number;
  /** Whatever the room changes by itself and this can't see (it swaps a mesh's material, say). */
  keep?: (mesh: THREE.Mesh) => boolean;
}

export interface BatchResult {
  /** Draw calls (meshes) before and after. */
  before: number;
  after: number;
  batches: number;
}

interface Snapshot {
  matrix: Float32Array;
  visible: boolean;
  material: string;
  colour: number;
  opacity: number;
  version: number;
}

const isMesh = (o: THREE.Object3D): o is THREE.Mesh => (o as THREE.Mesh).isMesh === true;

/** Whether `o` or anything above it (up to `root`) is set to stay out of the batches (`userData.nobatch`): a boss, a crowd, a gate's boards. */
function kept(o: THREE.Object3D, root: THREE.Object3D): boolean {
  for (let p: THREE.Object3D | null = o; p; p = p.parent) {
    if (p.userData.nobatch === true) return true;
    if (p === root) break;
  }
  return false;
}

function visibleThroughout(o: THREE.Object3D, root: THREE.Object3D): boolean {
  for (let p: THREE.Object3D | null = o; p; p = p.parent) {
    if (!p.visible) return false;
    if (p === root) break;
  }
  return true;
}

function snapshot(m: THREE.Mesh, root: THREE.Object3D): Snapshot {
  const mat = m.material as THREE.MeshStandardMaterial;
  return {
    matrix: Float32Array.from(m.matrixWorld.elements),
    visible: visibleThroughout(m, root),
    material: mat.uuid,
    colour: mat.color?.getHex() ?? 0,
    opacity: mat.opacity,
    version: (m.geometry.attributes.position as THREE.BufferAttribute | undefined)?.version ?? 0,
  };
}

const same = (a: Snapshot, b: Snapshot): boolean => {
  if (a.visible !== b.visible || a.material !== b.material || a.colour !== b.colour) return false;
  if (a.opacity !== b.opacity || a.version !== b.version) return false;
  for (let i = 0; i < 16; i++) if (Math.abs(a.matrix[i]! - b.matrix[i]!) > 1e-5) return false;
  return true;
};

/**
 * Merges everything in `root` that never moves into a few big meshes: one per material per patch of floor.
 * A town is some three thousand little boxes, and every one is a draw call (twice, with shadows); merged it
 * is a few hundred. What counts as "never moves" is found out by running the room's own animation (`probe`)
 * through several states and keeping only the meshes that were the same in all of them. Meshes the caller
 * says to `keep`, see-through ones (they sort one by one), instanced, skinned and mirrored ones stay as
 * they are.
 */
export function batchStatic(root: THREE.Object3D, o: BatchOptions): BatchResult {
  root.updateMatrixWorld(true);
  const all: THREE.Mesh[] = [];
  root.traverse((n) => {
    if (isMesh(n)) all.push(n);
  });
  const candidates = all.filter((m) => {
    const mat = m.material;
    if (Array.isArray(mat) || (mat as THREE.Material).transparent) return false;
    if (
      (m as unknown as THREE.InstancedMesh).isInstancedMesh ||
      (m as unknown as THREE.SkinnedMesh).isSkinnedMesh
    )
      return false;
    if (m.userData.nopick || m.userData.nobatch || o.keep?.(m) || kept(m, root)) return false;
    return m.matrixWorld.determinant() > 0 && m.geometry.attributes.position !== undefined;
  });
  // Which of them move: a snapshot in each of the room's states.
  const first = new Map(candidates.map((m) => [m, snapshot(m, root)]));
  const moving = new Set<THREE.Mesh>();
  for (let i = 1; i < o.samples; i++) {
    o.probe(i);
    root.updateMatrixWorld(true);
    for (const m of candidates) if (!moving.has(m) && !same(first.get(m)!, snapshot(m, root))) moving.add(m);
  }
  o.probe(0);
  root.updateMatrixWorld(true);
  for (const m of candidates) if (!moving.has(m) && !same(first.get(m)!, snapshot(m, root))) moving.add(m);

  // Group the still ones by material, shadow flags and patch of floor.
  const groups = new Map<string, THREE.Mesh[]>();
  const centre = new THREE.Vector3();
  for (const m of candidates) {
    if (moving.has(m) || !first.get(m)!.visible) continue;
    const mat = m.material as THREE.Material;
    if (!m.geometry.boundingBox) m.geometry.computeBoundingBox();
    centre.copy(m.geometry.boundingBox!.getCenter(new THREE.Vector3())).applyMatrix4(m.matrixWorld);
    const key = `${mat.uuid}|${+m.castShadow}${+m.receiveShadow}|${m.renderOrder}|${Math.floor(centre.x / o.chunk)},${Math.floor(centre.z / o.chunk)}`;
    const list = groups.get(key);
    if (list) list.push(m);
    else groups.set(key, [m]);
  }

  const inverse = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const out = new THREE.Group();
  out.name = "batched";
  let batches = 0;
  for (const list of groups.values()) {
    if (list.length < 2) continue;
    const parts: THREE.BufferGeometry[] = [];
    for (const m of list) {
      const src = m.geometry;
      const g = src.index ? src.toNonIndexed() : src.clone();
      // The vertex colours stay when the material reads them (the voxel people's bodies are painted that way).
      const colours = (m.material as THREE.MeshStandardMaterial).vertexColors === true;
      for (const name of Object.keys(g.attributes))
        if (name !== "position" && name !== "normal" && name !== "uv" && !(colours && name === "color"))
          g.deleteAttribute(name);
      const n = g.attributes.position!.count;
      if (colours && !g.attributes.color)
        g.setAttribute("color", new THREE.BufferAttribute(new Float32Array(n * 3).fill(1), 3));
      if (!g.attributes.normal) g.computeVertexNormals();
      if (!g.attributes.uv) g.setAttribute("uv", new THREE.BufferAttribute(new Float32Array(n * 2), 2));
      g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inverse, m.matrixWorld));
      parts.push(g);
    }
    const merged = mergeGeometries(parts, false);
    for (const p of parts) p.dispose();
    if (!merged) continue;
    merged.computeBoundingSphere();
    merged.computeBoundingBox();
    const first = list[0]!;
    const mesh = new THREE.Mesh(merged, first.material);
    mesh.castShadow = first.castShadow;
    mesh.receiveShadow = first.receiveShadow;
    mesh.renderOrder = first.renderOrder;
    mesh.userData.batched = list.length;
    out.add(mesh);
    for (const m of list) {
      m.removeFromParent();
      const g = m.geometry;
      if (!g.userData.shared) g.dispose();
      const saved = m.userData.voxelSaved as { geometry?: THREE.BufferGeometry } | undefined;
      if (saved?.geometry && !saved.geometry.userData.shared) saved.geometry.dispose();
    }
    batches++;
  }
  root.add(out);
  return {
    before: all.length,
    after:
      all.length -
      [...groups.values()].filter((l) => l.length > 1).reduce((a, l) => a + l.length, 0) +
      batches,
    batches,
  };
}
