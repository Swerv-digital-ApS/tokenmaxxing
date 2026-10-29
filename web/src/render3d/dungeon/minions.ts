import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { graphics } from "../../settings/graphics.ts";
import { buildMinion } from "./bossvox.ts";

/**
 * The raid's robot minions, as a few instanced draws: the voxel robot (a dozen meshes, each its own draw call
 * and its own animation) is merged once into two poses (idle, and the blaster arm up), and every minion in the room
 * is an instance of one of them. Forty minions cost four draw calls instead of five hundred.
 */

interface Pose {
  solid: THREE.BufferGeometry | null;
  glow: THREE.BufferGeometry | null;
}

/** The robot at clock `t` of its own cycle, merged into the toon-shaded body and the unlit glints. */
function pose(t: number): { pose: Pose; solid: THREE.Material | null; glow: THREE.Material | null } {
  const bot = buildMinion();
  bot.update(t);
  bot.root.updateMatrixWorld(true);
  const parts = new Map<THREE.Material, THREE.BufferGeometry[]>();
  bot.root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || !m.visible) return;
    // A glow mesh is a child of a solid one: both are visible only when their parents are.
    for (let p: THREE.Object3D | null = m; p; p = p.parent) if (!p.visible) return;
    const g = m.geometry.clone();
    for (const name of Object.keys(g.attributes))
      if (name !== "position" && name !== "normal" && name !== "color") g.deleteAttribute(name);
    g.applyMatrix4(m.matrixWorld);
    const mat = m.material as THREE.Material;
    const list = parts.get(mat) ?? [];
    list.push(g);
    parts.set(mat, list);
  });
  let solid: THREE.BufferGeometry | null = null;
  let glow: THREE.BufferGeometry | null = null;
  let solidMat: THREE.Material | null = null;
  let glowMat: THREE.Material | null = null;
  for (const [mat, list] of parts) {
    const merged = mergeGeometries(list, false);
    for (const g of list) g.dispose();
    if (!merged) continue;
    if ((mat as THREE.MeshBasicMaterial).type === "MeshBasicMaterial") {
      glow = merged;
      glowMat = mat;
    } else {
      solid = merged;
      solidMat = mat;
    }
  }
  return { pose: { solid, glow }, solid: solidMat, glow: glowMat };
}

const IDLE_T = 0.63;
const FIRE_T = 0.2;

/** Where no shadow map runs (Medium, or shadows off) each minion gets a soft disc on the floor, in one instanced draw. */
function blobDiscs(max: number): THREE.InstancedMesh {
  const c = document.createElement("canvas");
  c.width = c.height = 32;
  const g = c.getContext("2d")!;
  const grad = g.createRadialGradient(16, 16, 2, 16, 16, 16);
  grad.addColorStop(0, "rgba(0,0,0,0.55)");
  grad.addColorStop(0.6, "rgba(0,0,0,0.28)");
  grad.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, 32, 32);
  const mat = new THREE.MeshBasicMaterial({
    map: new THREE.CanvasTexture(c),
    transparent: true,
    depthWrite: false,
  });
  const mesh = new THREE.InstancedMesh(
    new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2),
    mat,
    Math.max(1, max),
  );
  mesh.count = 0;
  mesh.frustumCulled = false;
  mesh.renderOrder = 1;
  mesh.userData.live = true;
  mesh.userData.nopick = true;
  mesh.userData.nobatch = true;
  mesh.userData.noBake = true;
  return mesh;
}

const BLOB_RADIUS = 0.34;

export class Minions {
  readonly group = new THREE.Group();
  private readonly blob: THREE.InstancedMesh;
  private blobs = 0;
  private seen: unknown = null;
  private blobOn = false;
  private readonly meshes: THREE.InstancedMesh[][] = [[], []];
  private readonly counts = [0, 0];
  private readonly m = new THREE.Matrix4();
  private readonly q = new THREE.Quaternion();
  private readonly e = new THREE.Euler();
  private readonly p = new THREE.Vector3();
  private readonly s = new THREE.Vector3();

  constructor(readonly max: number) {
    this.group.userData.live = true;
    this.blob = blobDiscs(max);
    this.group.add(this.blob);
    const idle = pose(IDLE_T);
    const fire = pose(FIRE_T);
    [idle, fire].forEach((v, i) => {
      for (const [geometry, material] of [
        [v.pose.solid, v.solid],
        [v.pose.glow, v.glow],
      ] as const) {
        if (!geometry || !material) continue;
        const mesh = new THREE.InstancedMesh(geometry, material, Math.max(1, max));
        mesh.count = 0;
        mesh.frustumCulled = false;
        mesh.castShadow = material.type !== "MeshBasicMaterial";
        mesh.userData.live = true;
        mesh.userData.nopick = true;
        mesh.userData.nobatch = true;
        this.meshes[i]!.push(mesh);
        this.group.add(mesh);
      }
    });
  }

  begin(): void {
    this.counts[0] = this.counts[1] = 0;
    this.blobs = 0;
  }

  /** A minion standing at (x, z) facing `yaw`, `scale` times the robot's size; `firing` raises the blaster. `bob` lifts it. */
  add(x: number, z: number, yaw: number, scale: number, firing: boolean, bob: number): void {
    const k = firing ? 1 : 0;
    const i = this.counts[k]!;
    if (i >= this.max) return;
    this.counts[k] = i + 1;
    this.m.compose(
      this.p.set(x, bob, z),
      this.q.setFromEuler(this.e.set(0, yaw, 0)),
      this.s.setScalar(scale),
    );
    for (const mesh of this.meshes[k]!) mesh.setMatrixAt(i, this.m);
    if (this.blobs < this.max) {
      const d = BLOB_RADIUS * 2 * scale;
      this.blob.setMatrixAt(
        this.blobs++,
        this.m.compose(this.p.set(x, 0.03, z), this.q.identity(), this.s.set(d, d, d)),
      );
    }
  }

  end(): void {
    // Only without a shadow map: with one, the robots cast their own.
    const st = graphics.get();
    if (st !== this.seen) {
      this.seen = st;
      const g = graphics.effective();
      this.blobOn = g.tier === "medium" || g.tier === "low" || g.shadows === "off";
    }
    const on = this.blobOn;
    this.blob.count = on ? this.blobs : 0;
    this.blob.visible = on && this.blobs > 0;
    this.blob.instanceMatrix.needsUpdate = on;
    for (const k of [0, 1])
      for (const mesh of this.meshes[k]!) {
        mesh.count = this.counts[k]!;
        mesh.visible = mesh.count > 0;
        mesh.instanceMatrix.needsUpdate = true;
      }
  }
}
