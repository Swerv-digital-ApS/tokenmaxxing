import * as THREE from "three";

/** Visible, clickable meshes under `root`: anything hidden (a lowered wall) or marked `nopick` is left out. */
export function pickable(root: THREE.Object3D, out: THREE.Object3D[] = []): THREE.Object3D[] {
  if (!root.visible || root.userData.nopick) return out;
  if ((root as THREE.Mesh).isMesh) {
    const m = (root as THREE.Mesh).material;
    const glass = !Array.isArray(m) && m.transparent && m.opacity < 0.85;
    if (!glass) out.push(root);
  }
  for (const c of root.children) pickable(c, out);
  return out;
}

const FLOOR = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

export interface Hit {
  /** The floor point under the click. */
  floor: THREE.Vector3 | null;
  /** The first thing the ray hit that stands up from the floor, and where. */
  prop: THREE.Vector3 | null;
}

/**
 * What a ray from the camera touches: the floor, and any prop in front of it. A prop's point is nudged a
 * little along the ray so it falls inside the prop's own tile rather than on its edge.
 */
export function castAt(ray: THREE.Ray, room: THREE.Object3D, caster = new THREE.Raycaster()): Hit {
  const floor = ray.intersectPlane(FLOOR, new THREE.Vector3());
  caster.ray.copy(ray);
  const hit = caster.intersectObjects(pickable(room), false)[0];
  let prop: THREE.Vector3 | null = null;
  if (hit && hit.point.y > 0.06) prop = hit.point.clone().addScaledVector(ray.direction, 0.04);
  return { floor, prop };
}
