/**
 * The cold in the 3D town (2D: `game/cold.ts`, `game/snow.ts`): how iced over the pond is, a person's breath in the air
 * and the bots' scarves. `Fx` eases `ICE`; `entities.ts` puts the breath and scarves on the people.
 */

import * as THREE from "three";
import { breathPuff, scarfOf } from "../../game/cold.ts";
import { Model } from "../kit/kit.ts";

/** 0..1 how iced over the pond is: `Fx` eases it towards the weather, the pond (`town3d.ts`) reads it every frame. */
export const ICE = { value: 0 };

const PUFF = new THREE.SphereGeometry(1, 8, 6);
const PUFF_MAT = new THREE.MeshBasicMaterial({
  color: "#f4f7fc",
  transparent: true,
  opacity: 0.75,
  depthWrite: false,
});
// Everyone's breath is made of these two: freeing a person must leave them for the rest.
PUFF.userData.shared = PUFF_MAT.userData.shared = true;

/** Off the picking and the block swap, like the other effects hung on a person. */
const loose = (o: THREE.Object3D) => {
  o.userData.nopick = true;
  o.userData.noBlock = true;
};

/**
 * Where a person's neck is, above their feet, standing: measured once from where the voxel head sits on them (heads
 * differ by style), not counting how far the pose has the body dropped right now.
 */
export function neckOf(root: THREE.Object3D, body: THREE.Object3D, head: THREE.Object3D): number {
  root.updateMatrixWorld(true);
  const at = root.worldToLocal(head.getWorldPosition(new THREE.Vector3()));
  return at.y - body.position.y;
}

/** A puff of breath leaving the mouth every few seconds: two soft balls swelling, drifting forward and up, gone. */
export class Breath {
  readonly group = new THREE.Group();
  private readonly puffs: THREE.Mesh[] = [];

  constructor() {
    for (let i = 0; i < 2; i++) {
      const m = new THREE.Mesh(PUFF, PUFF_MAT);
      loose(m);
      this.puffs.push(m);
      this.group.add(m);
    }
    loose(this.group);
    this.group.visible = false;
  }

  /** Poses the puff for person `id` at `now` (ms), the mouth `mouth` units up and facing +z. */
  update(id: number, now: number, mouth: number): void {
    const t = breathPuff(id, now);
    this.group.visible = t !== null;
    if (t === null) return;
    for (const [i, m] of this.puffs.entries()) {
      const k = Math.max(0, t - i * 0.18);
      m.position.set((i - 0.5) * 0.05, mouth + k * 0.18, 0.22 + k * 0.45);
      m.scale.setScalar(Math.max(0.001, Math.sin(Math.PI * Math.min(1, k * 1.2)) * (0.1 + i * 0.03)));
    }
  }
}

/** A striped scarf round the neck (at 0) with an end hanging down the front, in bot `id`'s colours. */
export function scarf(id: number): Model {
  const [a, b] = scarfOf(id);
  const m = new Model();
  m.box([0.36, 0.085, 0.3], a, [0, 0.02, 0.01], 0.03);
  m.box([0.37, 0.03, 0.31], b, [0, 0.02, 0.01], 0.01);
  m.box([0.085, 0.2, 0.045], a, [0.07, -0.1, 0.17], 0.02);
  m.box([0.09, 0.03, 0.05], b, [0.07, -0.08, 0.17], 0.01);
  m.box([0.09, 0.03, 0.05], b, [0.07, -0.16, 0.17], 0.01);
  loose(m);
  return m;
}
