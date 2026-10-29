import { type Pumpkin, pumpkinSpots } from "@tokenmaxxing/core/halloween.ts";
import type { GameMap } from "@tokenmaxxing/core/maps.ts";
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { candlesLit, pumpkinsOutNow } from "../../game/halloween.ts";
import { mergeStill } from "../engine/merge3d.ts";
import { Model } from "../kit/kit.ts";

const ORANGE = "#e8772a";
const RIB = "#c25a1c";
const STEM = "#5a8a2a";
const LIT = new THREE.Color("#ffc23a");
const HOLLOW = new THREE.Color("#4a2410");

/** One pumpkin's body at `at` (its tile's middle), `s` its size: lumpy, ribbed, a stem on top. */
function body(m: Model, at: [number, number], s: number): void {
  const p = m.part([at[0], 0, at[1]]);
  const y = 0.22 * s;
  p.ball(0.3 * s, ORANGE, [0, y, 0], [1.15, 0.8, 1.1], 16);
  for (let i = 0; i < 4; i++) {
    const a = Math.PI / 4 + (i * Math.PI) / 2;
    p.ball(0.21 * s, RIB, [Math.cos(a) * 0.14 * s, y, Math.sin(a) * 0.13 * s], [1, 1.05, 1], 10);
  }
  p.cyl(0.04 * s, 0.12 * s, STEM, [0, y + 0.2 * s, 0], 0.03 * s, 6).rotation.z = 0.25;
}

/** One pumpkin's carved face, facing the street (+z): two eyes and a grin, as boxes in world space. */
function face(at: [number, number], s: number): THREE.BufferGeometry[] {
  const y = 0.22 * s;
  const z = at[1] + 0.31 * s;
  const box = (w: number, h: number, x: number, dy: number) =>
    new THREE.BoxGeometry(w * s, h * s, 0.04 * s).translate(at[0] + x * s, y + dy * s, z);
  return [box(0.09, 0.08, -0.11, 0.05), box(0.09, 0.08, 0.11, 0.05), box(0.24, 0.05, 0, -0.07)];
}

/**
 * Halloween's jack-o'-lanterns in the 3D town, on the tiles `core/src/halloween.ts` gives (the 2D ones are
 * `game/halloween.ts`, and both ask it whether they're out and lit). Built once per town: the bodies are batched,
 * and every carved face is one merged mesh with one material, a dark hollow by day and candlelit once the lamps are on.
 */
export class Pumpkins {
  readonly group = new THREE.Group();
  readonly pumpkins: readonly Pumpkin[];
  private readonly faces = new THREE.MeshBasicMaterial({ color: HOLLOW });
  private lit = false;

  constructor(map: GameMap, toWorld: (tx: number, ty: number) => [number, number]) {
    this.group.name = "pumpkins";
    this.pumpkins = pumpkinSpots(map);
    const bodies = new Model();
    const carved: THREE.BufferGeometry[] = [];
    for (const { x, y, big } of this.pumpkins) {
      const at = toWorld(x, y);
      const s = big ? 1 : 0.7;
      body(bodies, at, s);
      carved.push(...face(at, s));
    }
    this.group.add(bodies);
    mergeStill(bodies);
    const merged = carved.length ? mergeGeometries(carved) : null;
    for (const g of carved) g.dispose();
    if (merged) {
      const mesh = new THREE.Mesh(merged, this.faces);
      mesh.userData.live = true;
      this.group.add(mesh);
    }
    this.group.traverse((o) => {
      o.userData.nopick = true;
      o.userData.noBlock = true;
    });
    // They come and go with the calendar: the room's batching leaves them as they are.
    this.group.userData.nobatch = true;
    this.group.visible = false;
  }

  update(now: number): void {
    this.group.visible = this.pumpkins.length > 0 && pumpkinsOutNow();
    if (!this.group.visible) return;
    const lit = candlesLit(now);
    if (lit === this.lit) return;
    this.lit = lit;
    this.faces.color.copy(lit ? LIT : HOLLOW);
  }
}
