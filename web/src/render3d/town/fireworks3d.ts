/**
 * Fireworks in the 3D town's sky. Which shows are up, and every rocket in them, come from the same place the
 * 2D canvas reads them (`game/fireworks.ts`, `core/src/fireworks.ts`), so both draw the same rockets at the
 * same moment. One instanced mesh of small glowing sparks (the camera is orthographic, so points would be a
 * pixel), set in place each frame; hidden, and drawing nothing, while no show is on.
 */
import { climbOf, sparkAt, sparkFade } from "@tokenmaxxing/core/fireworks.ts";
import * as THREE from "three";
import { rocketsNow } from "../../game/fireworks.ts";

/** Sparks at once: the busiest moment of a finale is about 15 rockets of up to 27 sparks. */
const MAX = 1024;
/** A climbing rocket is its head and a short tail of fading sparks under it. */
const TRAIL = 4;
const SIZE = 0.16;

export class Fireworks3d {
  readonly group = new THREE.Group();
  private readonly sparks = new THREE.InstancedMesh(
    new THREE.OctahedronGeometry(SIZE / 2),
    new THREE.MeshBasicMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    }),
    MAX,
  );
  private readonly palette = new Map<string, THREE.Color>();
  private readonly m4 = new THREE.Matrix4();
  private readonly tint = new THREE.Color();

  constructor(private readonly toWorld: (tx: number, ty: number) => [number, number]) {
    // They move every frame and fly well out of their box: never batched, culled, picked or shadowed.
    const s = this.sparks;
    s.frustumCulled = false;
    s.castShadow = s.receiveShadow = false;
    s.userData.live = true;
    s.userData.nopick = true;
    s.setColorAt(0, this.tint);
    s.count = 0;
    this.group.add(s);
    this.group.visible = false;
  }

  private colourOf(hex: string): THREE.Color {
    let c = this.palette.get(hex);
    if (!c) {
      c = new THREE.Color(hex);
      this.palette.set(hex, c);
    }
    return c;
  }

  update(): void {
    const rockets = rocketsNow();
    this.group.visible = rockets.length > 0;
    if (!this.group.visible) return;
    const s = this.sparks;
    let n = 0;
    const put = (x: number, y: number, z: number, c: THREE.Color, k: number) => {
      if (n >= MAX) return;
      // Fading sparks shrink as they dim.
      const size = 0.4 + 0.6 * k;
      s.setMatrixAt(n, this.m4.makeScale(size, size, size).setPosition(x, y, z));
      s.setColorAt(n, this.tint.copy(c).multiplyScalar(k));
      n++;
    };
    for (const r of rockets) {
      const [x, z] = this.toWorld(r.x, r.y);
      const c = this.colourOf(r.colour);
      if (r.burst === null) {
        const top = climbOf(r);
        for (let i = 0; i < TRAIL; i++) put(x, top - i * 0.25, z, c, 1 - i * 0.25);
        continue;
      }
      const fade = sparkFade(r);
      for (let i = 0; i < r.sparks; i++) {
        const [dx, dy, dz] = sparkAt(r, i);
        put(x + dx, r.height + dy, z + dz, c, fade);
      }
    }
    s.count = n;
    s.instanceMatrix.needsUpdate = true;
    if (s.instanceColor) s.instanceColor.needsUpdate = true;
  }

  dispose(): void {
    this.sparks.geometry.dispose();
    (this.sparks.material as THREE.Material).dispose();
    this.sparks.dispose();
  }
}
