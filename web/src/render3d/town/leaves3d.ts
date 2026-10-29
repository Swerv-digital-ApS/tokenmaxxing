import * as THREE from "three";

/**
 * Autumn's leaves coming down in the 3D town (`SeasonLook.falling`): one instanced mesh of little cards, let go
 * from the broadleaf crowns round where you stand, fluttering and spinning to the grass, lying a moment, then let
 * go again. One draw call; the leaves only move while it is the season, and only near you.
 */

/** Leaves at most, at full fall and full particle density. */
const MAX = 160;
/** How far round the middle (world units) leaves fall from. */
const REACH = 13;
const LIE_S = 2.2;
const COLOURS = ["#e08a3a", "#e8bf3e", "#d4483a", "#f5b05a", "#b8612a"];

interface Leaf {
  at: THREE.Vector3;
  spin: THREE.Euler;
  ph: number;
  /** Seconds lying on the grass, or -1 while it falls. */
  lying: number;
}

export class FallingLeaves {
  readonly group = new THREE.Group();
  private readonly mesh: THREE.InstancedMesh;
  private readonly leaves: Leaf[] = [];
  private near: (readonly [number, number, number])[] = [];
  private nearOf: [number, number] | null = null;
  /** Leaves due to let go, while there are fewer than wanted. */
  private owed = 0;
  private readonly m4 = new THREE.Matrix4();
  private readonly q = new THREE.Quaternion();
  private readonly one = new THREE.Vector3(1, 1, 1);
  private readonly flat = new THREE.Euler(-Math.PI / 2, 0, 0);

  constructor(private readonly crowns: readonly (readonly [number, number, number])[]) {
    const card = new THREE.PlaneGeometry(0.11, 0.08);
    this.mesh = new THREE.InstancedMesh(
      card,
      new THREE.MeshToonMaterial({ color: "#ffffff", side: THREE.DoubleSide }),
      MAX,
    );
    this.mesh.count = 0;
    this.mesh.visible = false;
    this.mesh.frustumCulled = false;
    this.mesh.castShadow = this.mesh.receiveShadow = false;
    this.mesh.userData.live = true;
    for (let i = 0; i < MAX; i++)
      this.mesh.setColorAt(
        i,
        new THREE.Color(COLOURS[i % COLOURS.length]!).multiplyScalar(0.9 + (i % 3) * 0.05),
      );
    this.group.add(this.mesh);
    this.group.userData.live = true;
  }

  /** The crowns within reach of (`x`, `z`), found again only once you have walked a few units. */
  private crownsNear(x: number, z: number) {
    if (!this.nearOf || Math.hypot(x - this.nearOf[0], z - this.nearOf[1]) > 3) {
      this.nearOf = [x, z];
      this.near = this.crowns.filter(([cx, , cz]) => Math.abs(cx - x) < REACH && Math.abs(cz - z) < REACH);
    }
    return this.near;
  }

  private letGo(leaf: Leaf | undefined, crown: readonly [number, number, number]): Leaf {
    const [x, y, z] = crown;
    const l = leaf ?? { at: new THREE.Vector3(), spin: new THREE.Euler(), ph: 0, lying: -1 };
    l.at.set(
      x + (Math.random() - 0.5) * 1.1,
      y * (0.75 + Math.random() * 0.3),
      z + (Math.random() - 0.5) * 1.1,
    );
    l.spin.set(Math.random() * 6.3, Math.random() * 6.3, Math.random() * 6.3);
    l.ph = Math.random() * 6.3;
    l.lying = -1;
    return l;
  }

  /**
   * Once a frame: `falling` 0..1 from the season, `density` the graphics tier's particle share, `wind` the push
   * (world units a second, x and z), round (`x`, `z`).
   */
  update(
    dt: number,
    t: number,
    falling: number,
    density: number,
    wind: THREE.Vector2,
    x: number,
    z: number,
  ): void {
    const near = this.crownsNear(x, z);
    const want = near.length ? Math.round(Math.min(MAX, near.length * 6) * falling * density) : 0;
    // Grow over a few seconds (so they don't all let go at once, at any frame rate); shrink as each one lands.
    this.owed = this.leaves.length < want ? this.owed + dt * (want / 3) : 0;
    for (; this.owed >= 1 && this.leaves.length < want; this.owed--)
      this.leaves.push(this.letGo(undefined, near[Math.floor(Math.random() * near.length)]!));
    let n = 0;
    for (let i = 0; i < this.leaves.length; i++) {
      const l = this.leaves[i]!;
      if (l.lying >= 0) {
        l.lying += dt;
        if (l.lying > LIE_S) {
          if (n >= want || !near.length) continue;
          this.letGo(l, near[Math.floor(Math.random() * near.length)]!);
        }
      } else {
        l.at.y -= dt * (0.55 + Math.sin(t * 2.3 + l.ph) * 0.2);
        l.at.x += (wind.x * 0.6 + Math.sin(t * 1.4 + l.ph) * 0.35) * dt;
        l.at.z += (wind.y * 0.6 + Math.cos(t * 1.1 + l.ph) * 0.25) * dt;
        l.spin.x += dt * 2.1;
        l.spin.z += dt * 1.3;
        if (l.at.y <= 0.03) {
          l.at.y = 0.03;
          l.lying = 0;
        }
      }
      this.leaves[n++] = l;
      this.q.setFromEuler(l.lying >= 0 ? this.flat : l.spin);
      const s = l.lying > LIE_S - 0.5 ? (LIE_S - l.lying) / 0.5 : 1;
      this.m4.compose(l.at, this.q, this.one.setScalar(Math.max(0.001, s)));
      this.mesh.setMatrixAt(n - 1, this.m4);
    }
    this.leaves.length = n;
    this.mesh.count = n;
    this.mesh.visible = n > 0;
    if (n) this.mesh.instanceMatrix.needsUpdate = true;
  }
}
