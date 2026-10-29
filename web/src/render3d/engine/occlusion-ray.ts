import * as THREE from "three";

/** Small contiguous triangle ranges share the source buffers, but reject rays against their own bounds. */
const ranges = new WeakMap<THREE.BufferGeometry, { version: string; chunks: THREE.BufferGeometry[] }>();
const boundsVersions = new WeakMap<
  THREE.BufferGeometry,
  { position: unknown; index: unknown; version: string }
>();
const inverse = new THREE.Matrix4();
const localRay = new THREE.Ray();
const point = new THREE.Vector3();
const empty = new THREE.BufferGeometry();
const material = new THREE.MeshBasicMaterial();
const proxy: THREE.Mesh = new THREE.Mesh(empty, material);
const CHUNK = 64 * 3;

export function occlusionRaycast(
  mesh: THREE.Mesh,
  caster: THREE.Raycaster,
  hits: THREE.Intersection[],
): void {
  const source = mesh.geometry;
  const position = source.getAttribute("position");
  const count = source.index?.count ?? position.count;
  if (
    (mesh as THREE.InstancedMesh).isInstancedMesh ||
    (mesh as THREE.SkinnedMesh).isSkinnedMesh ||
    mesh.morphTargetInfluences?.some((v) => v !== 0)
  ) {
    mesh.raycast(caster, hits);
    return;
  }
  const version = `${(position as THREE.BufferAttribute).version ?? (position as THREE.InterleavedBufferAttribute).data.version}:${source.index?.version}:${source.drawRange.start}:${source.drawRange.count}`;
  const previous = boundsVersions.get(source);
  if (previous?.version !== version || previous.position !== position || previous.index !== source.index) {
    source.computeBoundingBox();
    source.computeBoundingSphere();
    boundsVersions.set(source, { position, index: source.index, version });
    ranges.delete(source);
  }
  if (count <= CHUNK) {
    mesh.raycast(caster, hits);
    return;
  }
  inverse.copy(mesh.matrixWorld).invert();
  localRay.copy(caster.ray).applyMatrix4(inverse);
  if (!localRay.intersectsBox(source.boundingBox!)) return;

  let entry = ranges.get(source);
  if (!entry || entry.version !== version) {
    const chunks: THREE.BufferGeometry[] = [];
    const end = Math.min(count, source.drawRange.start + source.drawRange.count);
    for (let start = source.drawRange.start; start < end; start += CHUNK) {
      const g = new THREE.BufferGeometry();
      g.attributes = source.attributes;
      g.index = source.index;
      g.setDrawRange(start, Math.min(CHUNK, end - start));
      const box = new THREE.Box3();
      for (let i = start; i < Math.min(start + CHUNK, end); i++) {
        const vertex = source.index ? source.index.getX(i) : i;
        box.expandByPoint(point.fromBufferAttribute(position, vertex));
      }
      g.boundingBox = box;
      g.boundingSphere = box.getBoundingSphere(new THREE.Sphere());
      chunks.push(g);
    }
    entry = { version, chunks };
    ranges.set(source, entry);
  }
  proxy.matrixWorld.copy(mesh.matrixWorld);
  proxy.material = mesh.material;
  for (const g of entry.chunks) {
    if (!localRay.intersectsBox(g.boundingBox!)) continue;
    proxy.geometry = g;
    proxy.raycast(caster, hits);
  }
  // Do not keep the last room's buffers alive through the reusable mesh.
  proxy.geometry = empty;
  proxy.material = material;
}
