import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { toon } from "../kit/kit.ts";

/** One string of bunting: both ends (world units) and how far the middle sags. */
export interface Bunting {
  a: [number, number, number];
  b: [number, number, number];
  sag: number;
}

const PENNANT = ["#e2443a", "#f5d14a", "#6f7fc9", "#a5d977", "#fbf7ef", "#f2a6c8"].map(
  (c) => new THREE.Color(c),
);

/**
 * Strings of bunting as two meshes in all (the cords, and every pennant with its colour in the vertices),
 * where `buntingModel` (`fx3d-town.ts`) is a mesh and a material per pennant. They hang still: the town is not windy enough
 * to be worth a draw call a pennant.
 */
export function buntingMeshes(strings: readonly Bunting[]): THREE.Group {
  const cords: THREE.BufferGeometry[] = [];
  const flags: THREE.BufferGeometry[] = [];
  const A = new THREE.Vector3();
  const B = new THREE.Vector3();
  const tri = new THREE.Shape();
  tri.moveTo(-0.1, 0);
  tri.lineTo(0.1, 0);
  tri.lineTo(0, -0.26);
  const flag = new THREE.ShapeGeometry(tri);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const one = new THREE.Vector3(1, 1, 1);
  for (const s of strings) {
    A.set(...s.a);
    B.set(...s.b);
    const len = A.distanceTo(B);
    const at = (f: number, out = new THREE.Vector3()) =>
      out
        .copy(A)
        .lerp(B, f)
        .setY(A.y + (B.y - A.y) * f - 4 * s.sag * f * (1 - f));
    const segs = Math.max(6, Math.round(len * 3));
    const p = new THREE.Vector3();
    const n = new THREE.Vector3();
    for (let i = 0; i < segs; i++) {
      at(i / segs, p);
      at((i + 1) / segs, n);
      const g = new THREE.BoxGeometry(p.distanceTo(n), 0.02, 0.02);
      e.set(
        0,
        -Math.atan2(n.z - p.z, n.x - p.x),
        Math.atan2(n.y - p.y, Math.hypot(n.x - p.x, n.z - p.z)),
        "YXZ",
      );
      m.compose(p.clone().add(n).multiplyScalar(0.5), q.setFromEuler(e), one);
      g.applyMatrix4(m);
      cords.push(g);
    }
    const count = Math.max(2, Math.round(len / 0.36));
    const yaw = Math.atan2(B.x - A.x, B.z - A.z);
    for (let i = 1; i < count; i++) {
      const g = flag.clone();
      const c = PENNANT[i % PENNANT.length]!;
      const colours = new Float32Array(g.attributes.position!.count * 3);
      for (let k = 0; k < colours.length; k += 3) colours.set([c.r, c.g, c.b], k);
      g.setAttribute("color", new THREE.BufferAttribute(colours, 3));
      m.compose(at(i / count), q.setFromEuler(e.set(0, yaw, 0)), one);
      g.applyMatrix4(m);
      flags.push(g);
    }
  }
  flag.dispose();
  const group = new THREE.Group();
  const cord = mergeGeometries(cords);
  const pennants = mergeGeometries(flags);
  for (const g of [...cords, ...flags]) g.dispose();
  if (cord) {
    const mesh = new THREE.Mesh(cord, toon("#5e3d28"));
    mesh.userData.nopick = true;
    mesh.userData.noBlock = true;
    group.add(mesh);
  }
  if (pennants) {
    const mesh = new THREE.Mesh(
      pennants,
      new THREE.MeshToonMaterial({
        vertexColors: true,
        side: THREE.DoubleSide,
        gradientMap: toon("#fff").gradientMap,
      }),
    );
    mesh.userData.nopick = true;
    mesh.userData.noBlock = true;
    mesh.castShadow = true;
    group.add(mesh);
  }
  return group;
}
