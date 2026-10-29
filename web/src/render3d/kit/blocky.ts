/**
 * Voxel (Plethora) style geometry: a swap table that turns every smooth primitive into a block, applied to a
 * scene on the fly and reversed when the style changes back. Each replacement keeps the original's bounding
 * box (so pivots, scales and rotations of the owning mesh stay valid), nothing in the assets is edited.
 *
 *  sphere / capsule      -> box of the same bounding box (partial domes too)
 *  rounded box           -> box with a hairline bevel (just enough to catch a highlight)
 *  cylinder              -> square prism (thin) or octagonal prism (wide), flat-shaded
 *  wide cone / taper     -> stepped pyramid of boxes
 *  torus                 -> square-section octagonal ring
 *  face patch on a head  -> a flat decal on the front of the block head
 * Flat things (circles, planes), 4-sided cones (roofs), open tubes and anything see-through stay as they are.
 */
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { markMiddle } from "../engine/seethrough.ts";
import { chamferBox } from "./kit.ts";

const BEVEL = 0.014;
/** Per original geometry (and whether it carries a texture): its blocky stand-in, or null to leave it be. */
const table = new WeakMap<THREE.BufferGeometry, Map<string, THREE.BufferGeometry | null>>();

interface Saved {
  geometry: THREE.BufferGeometry;
  rotX?: number;
}
const SAVED = "voxelSaved";

function bounds(g: THREE.BufferGeometry): THREE.Box3 {
  if (!g.boundingBox) g.computeBoundingBox();
  return g.boundingBox!;
}

function blockOf(box: THREE.Box3, textured: boolean, bevel = BEVEL): THREE.BufferGeometry {
  const s = box.getSize(new THREE.Vector3());
  const c = box.getCenter(new THREE.Vector3());
  const r = Math.min(bevel, s.x / 2 - 0.001, s.y / 2 - 0.001, s.z / 2 - 0.001);
  const g =
    r > 0.004 && !textured
      ? chamferBox(s.x, s.y, s.z, r)
      : new THREE.BoxGeometry(Math.max(s.x, 0.001), Math.max(s.y, 0.001), Math.max(s.z, 0.001));
  return g.translate(c.x, c.y, c.z);
}

/** A prism with flat faces, axis-aligned sides, circumscribing the same width as the cylinder. */
function prism(top: number, bottom: number, h: number, sides: number): THREE.BufferGeometry {
  const g = new THREE.CylinderGeometry(top, bottom, h, sides, 1);
  g.rotateY(Math.PI / sides);
  g.scale(
    1 / Math.cos(Math.PI / sides) ** (sides === 4 ? 0.5 : 1),
    1,
    1 / Math.cos(Math.PI / sides) ** (sides === 4 ? 0.5 : 1),
  );
  const flat = g.toNonIndexed();
  flat.computeVertexNormals();
  g.dispose();
  return flat;
}

/** Stacked boxes narrowing from `bottom` radius to `top` radius over `h`. */
function steps(top: number, bottom: number, h: number, n: number): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  for (let i = 0; i < n; i++) {
    const r = bottom + ((top - bottom) * (i + 0.5)) / n;
    const p = new THREE.BoxGeometry(Math.max(r * 1.9, 0.01), h / n, Math.max(r * 1.9, 0.01));
    p.translate(0, ((i + 0.5) * h) / n - h / 2, 0);
    parts.push(p.toNonIndexed());
  }
  const m = mergeGeometries(parts)!;
  for (const p of parts) p.dispose();
  return m;
}

function ring(g: THREE.TorusGeometry): THREE.BufferGeometry {
  const { radius, tube, arc } = g.parameters;
  const tubular = radius > 0.5 ? 16 : 8;
  const t = new THREE.TorusGeometry(
    radius,
    tube,
    4,
    Math.max(2, Math.round((tubular * arc) / (Math.PI * 2))),
    arc,
  );
  // Square section: rotate the tube's diamond a quarter-eighth turn.
  const p = t.getAttribute("position");
  for (let i = 0; i < p.count; i++) {
    const u = Math.atan2(p.getY(i), p.getX(i));
    const d = Math.hypot(p.getX(i), p.getY(i)) - radius;
    const z = p.getZ(i);
    const a = Math.atan2(z, d) + Math.PI / 4;
    const rr = Math.hypot(d, z) * 0.85;
    const nr = radius + Math.cos(a) * rr;
    p.setXYZ(i, Math.cos(u) * nr, Math.sin(u) * nr, Math.sin(a) * rr);
  }
  const flat = t.toNonIndexed();
  flat.computeVertexNormals();
  t.dispose();
  return flat;
}

function shrunk(b: THREE.Box3, k: number): THREE.Box3 {
  const c = b.getCenter(new THREE.Vector3());
  const h = b.getSize(new THREE.Vector3()).multiplyScalar(k / 2);
  return new THREE.Box3(c.clone().sub(h), c.clone().add(h));
}

/** A hair cap as blocks: a slab on top, a back, two sideburns, leaving the face and fringe line clear. */
function hairBlock(R: number): THREE.BufferGeometry {
  const part = (x0: number, x1: number, y0: number, y1: number, z0: number, z1: number) =>
    new THREE.BoxGeometry((x1 - x0) * R, (y1 - y0) * R, (z1 - z0) * R)
      .translate(((x0 + x1) / 2) * R, ((y0 + y1) / 2) * R, ((z0 + z1) / 2) * R)
      .toNonIndexed();
  const parts = [
    part(-1, 1, 0.5, 1, -1, 0.95),
    part(-1, 1, -0.2, 0.5, -1, -0.35),
    part(-1, -0.8, -0.1, 0.5, -1, 0.4),
    part(0.8, 1, -0.1, 0.5, -1, 0.4),
    part(-0.45, 0.4, 0.35, 0.55, 0.7, 1.08),
  ];
  const m = mergeGeometries(parts)!;
  for (const p of parts) p.dispose();
  return m;
}

function convert(mesh: THREE.Mesh, textured: boolean): THREE.BufferGeometry | null {
  const g = mesh.geometry;
  switch (g.type) {
    case "SphereGeometry": {
      const p = (g as THREE.SphereGeometry).parameters;
      if (textured && p.phiLength < Math.PI * 2) {
        // The face decal: a flat patch just proud of the block head's front.
        const w = 2 * Math.sin(p.phiLength / 2) * p.radius;
        const h = 2 * Math.cos(p.thetaStart) * p.radius;
        const d = new THREE.PlaneGeometry(w, h);
        d.translate(0, 0, p.radius * 1.012);
        return d;
      }
      if (textured) return null;
      if (mesh.userData.voxelHair) return hairBlock(p.radius);
      const k = (mesh.userData.blockScale as number | undefined) ?? 1;
      const b = bounds(g);
      return blockOf(k === 1 ? b : shrunk(b, k), false);
    }
    case "CapsuleGeometry":
      return blockOf(bounds(g), textured);
    case "BoxGeometry":
      return null;
    case "RoundedBoxGeometry":
      return blockOf(bounds(g), textured);
    case "CylinderGeometry":
    case "ConeGeometry": {
      const p = (g as THREE.CylinderGeometry).parameters;
      const mat = mesh.material as THREE.Material;
      if (p.openEnded || p.thetaLength < Math.PI * 2 - 0.01 || mat.transparent || p.radialSegments <= 4)
        return null;
      const big = Math.max(p.radiusTop, p.radiusBottom);
      const small = Math.min(p.radiusTop, p.radiusBottom);
      const taper = small / Math.max(big, 1e-6);
      if (big >= 0.18 && taper < 0.4 && p.height > big * 0.5) {
        const flip = p.radiusTop > p.radiusBottom;
        const s = steps(p.radiusTop, p.radiusBottom, p.height, big > 0.5 ? 4 : 3);
        if (flip) s.scale(1, 1, 1);
        return s.translate(0, p.height / 2, 0);
      }
      return prism(p.radiusTop, p.radiusBottom, p.height, big >= 0.12 ? 8 : 4).translate(0, p.height / 2, 0);
    }
    case "TorusGeometry":
      return (g as THREE.TorusGeometry).parameters.tube < 0.003 ? null : ring(g as THREE.TorusGeometry);
    default:
      return null;
  }
}

function standIn(mesh: THREE.Mesh): THREE.BufferGeometry | null {
  const mat = mesh.material;
  if (Array.isArray(mat) || mesh.userData.noBlock) return null;
  const textured = !!(mat as THREE.MeshToonMaterial).map;
  let per = table.get(mesh.geometry);
  if (!per) {
    per = new Map();
    table.set(mesh.geometry, per);
  }
  const key = `${textured ? "t" : "p"}${mesh.userData.voxelHair ? "h" : ""}${mesh.userData.blockScale ?? ""}`;
  if (!per.has(key)) {
    const made = convert(mesh, textured);
    // Its own middle for the see-through cut, as the smooth geometry it stands in for has (`markMiddle`).
    if (made) markMiddle(made);
    // A block made from a shared geometry is shared too: freeing one room's must not free the others'.
    if (made && mesh.geometry.userData.shared) made.userData.shared = true;
    per.set(key, made);
  }
  return per.get(key)!;
}

/** Swaps every smooth primitive in `scene` for its block (new meshes are picked up on later calls). */
export function blockify(scene: THREE.Object3D): void {
  scene.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || m.userData[SAVED] || m.userData.bakedSource) return;
    const g = standIn(m);
    if (!g) return;
    const saved: Saved = { geometry: m.geometry };
    if (g.type === "PlaneGeometry" || m.userData.voxelHair) {
      saved.rotX = m.rotation.x;
      m.rotation.x = 0; // the face sits square on the block head
    }
    m.userData[SAVED] = saved;
    m.geometry = g;
  });
}

/** Puts the original smooth geometry back. */
export function unblockify(scene: THREE.Object3D): void {
  scene.traverse((o) => {
    const m = o as THREE.Mesh;
    const s = m.userData?.[SAVED] as Saved | undefined;
    if (!s) return;
    m.geometry = s.geometry;
    if (s.rotX !== undefined) m.rotation.x = s.rotX;
    m.userData[SAVED] = undefined;
  });
}

/** Whether the Voxel swap also moves the mesh itself (face decals, hair caps): a merged batch cannot do that. */
export function blockMoves(mesh: THREE.Mesh): boolean {
  if (mesh.userData.voxelHair) return true;
  const g = mesh.geometry;
  if (
    g.type !== "SphereGeometry" ||
    Array.isArray(mesh.material) ||
    !(mesh.material as THREE.MeshToonMaterial).map
  )
    return false;
  return (g as THREE.SphereGeometry).parameters.phiLength < Math.PI * 2;
}

/** The block geometry a static mesh gets in the Voxel style, or null when it keeps its own. */
export function blockStandIn(mesh: THREE.Mesh): THREE.BufferGeometry | null {
  return standIn(mesh);
}
