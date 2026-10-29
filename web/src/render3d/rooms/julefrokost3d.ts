import * as THREE from "three";
import { RUNNER } from "../../art/december.ts";
import { julefrokostNow } from "../../game/december.ts";
import { mergeStill } from "../engine/merge3d.ts";
import { Model } from "../kit/kit.ts";
import type { Room } from "./room.ts";

/** The table top's height (`tavernTable` in `tavern3d.ts`). */
const TOP = 0.745;
const FOOD = ["#c8743a", "#e3b23c", "#8c3a2a", "#f2e6c8"];

/**
 * Julefrokost in the 3D Tavern (the 2D one is `game/december.ts`): on each long table a red runner down the
 * middle and a plate with food and a snaps glass at every place, built once beside the tables, merged, and shown
 * only on julefrokost evenings (`julefrokostNow`, the same rule as 2D).
 */
export class JulefrokostSpread {
  readonly group = new THREE.Group();

  constructor(room: Room, tables: readonly THREE.Object3D[]) {
    this.group.name = "julefrokost";
    const m = new Model();
    const box = new THREE.Box3();
    const c = new THREE.Vector3();
    const size = new THREE.Vector3();
    room.group.updateMatrixWorld(true);
    for (const [k, t] of tables.entries()) {
      box.setFromObject(t);
      room.group.worldToLocal(box.getCenter(c));
      box.getSize(size);
      const along = size.x >= size.z;
      const len = Math.max(size.x, size.z) - 0.25;
      m.box(along ? [len, 0.012, 0.24] : [0.24, 0.012, len], RUNNER, [c.x, TOP, c.z], 0.002);
      // A place either side of each tile of the table.
      const tiles = Math.max(1, Math.round(len));
      for (let i = 0; i < tiles; i++) {
        const a = (i - (tiles - 1) / 2) * (len / tiles);
        for (const side of [-1, 1]) {
          const [x, z] = along ? [c.x + a, c.z + side * 0.25] : [c.x + side * 0.25, c.z + a];
          m.cyl(0.12, 0.015, "#fbf7ef", [x, TOP, z], 0.12, 14);
          m.ball(0.055, FOOD[(k + i + side + 2) % FOOD.length]!, [x, TOP + 0.02, z], [1, 0.45, 1], 8);
          m.cyl(0.022, 0.07, "#dff3ff", [x + 0.17, TOP, z], 0.026, 8);
        }
      }
    }
    this.group.add(m);
    mergeStill(m);
    this.group.traverse((o) => {
      o.userData.nopick = true;
    });
    // It comes and goes with the evening: the room's batching leaves it as it is.
    this.group.userData.nobatch = true;
    this.group.visible = false;
    room.group.add(this.group);
  }

  update(): void {
    this.group.visible = julefrokostNow();
  }
}
