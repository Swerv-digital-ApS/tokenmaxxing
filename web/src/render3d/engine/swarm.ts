import * as THREE from "three";
import { toon } from "../kit/kit.ts";

/**
 * Many small glowing boxes in one draw call: missiles, sparks and the like. Each frame `begin`, `add` the ones that are
 * alive, `end`. It moves every frame, so it is marked `live` and the static batching leaves it alone.
 */
export class Swarm {
  readonly mesh: THREE.InstancedMesh;
  private n = 0;
  private readonly m = new THREE.Matrix4();
  private readonly q = new THREE.Quaternion();
  private readonly p = new THREE.Vector3();
  private readonly s = new THREE.Vector3();
  private readonly c = new THREE.Color();

  constructor(
    readonly max: number,
    size = 0.06,
    lit = false,
  ) {
    const geometry = new THREE.BoxGeometry(size, size, size);
    const material = lit
      ? toon("#ffffff")
      : new THREE.MeshBasicMaterial({ color: "#ffffff", toneMapped: false });
    this.mesh = new THREE.InstancedMesh(geometry, material, Math.max(1, max));
    this.mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(Math.max(1, max) * 3), 3);
    this.mesh.frustumCulled = false;
    this.mesh.castShadow = false;
    this.mesh.receiveShadow = false;
    this.mesh.count = 0;
    this.mesh.userData.live = true;
    this.mesh.userData.nopick = true;
    this.mesh.userData.nobatch = true;
  }

  get size(): number {
    return this.n;
  }

  begin(): void {
    this.n = 0;
  }

  /** One box at (x, y, z), `scale` times the base size, in `colour`; ignored once the swarm is full. */
  add(x: number, y: number, z: number, scale: number, colour: THREE.ColorRepresentation): boolean {
    if (this.n >= this.max) return false;
    this.m.compose(this.p.set(x, y, z), this.q, this.s.setScalar(scale));
    this.mesh.setMatrixAt(this.n, this.m);
    this.mesh.setColorAt(this.n, this.c.set(colour));
    this.n++;
    return true;
  }

  end(): void {
    this.mesh.count = this.n;
    this.mesh.visible = this.n > 0;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }
}

/**
 * Seated stand-ins for people the room is too busy to draw in full: a block of torso and one of head, each its own
 * colour, two draw calls for the whole crowd. They sit like a raider at a desk, facing -z.
 */
export class Figures {
  readonly group = new THREE.Group();
  private readonly torso: Swarm;
  private readonly head: Swarm;

  constructor(max: number) {
    this.torso = new Swarm(max, 1, true);
    this.head = new Swarm(max, 1, true);
    // Unit blocks, sized by the instance scale: the torso is wider than it is deep, the head a cube.
    this.torso.mesh.geometry.dispose();
    this.torso.mesh.geometry = new THREE.BoxGeometry(0.34, 0.42, 0.22);
    this.head.mesh.geometry.dispose();
    this.head.mesh.geometry = new THREE.BoxGeometry(0.24, 0.24, 0.24);
    this.torso.mesh.castShadow = this.head.mesh.castShadow = true;
    this.group.add(this.torso.mesh, this.head.mesh);
  }

  begin(): void {
    this.torso.begin();
    this.head.begin();
  }

  /** A sitter at (x, z) whose seat top is at `y`, in `shirt` and `skin`. */
  add(
    x: number,
    y: number,
    z: number,
    shirt: THREE.ColorRepresentation,
    skin: THREE.ColorRepresentation,
  ): void {
    this.torso.add(x, y + 0.3, z, 1, shirt);
    this.head.add(x, y + 0.7, z, 1, skin);
  }

  end(): void {
    this.torso.end();
    this.head.end();
  }
}
