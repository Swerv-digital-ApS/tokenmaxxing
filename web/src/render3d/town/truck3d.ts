import { JULEBRYG, TRUCK, truckAt } from "@tokenmaxxing/core/jdag.ts";
import * as THREE from "three";
import { TRUCK_SIGN } from "../../game/jdag.ts";
import { skyNow } from "../../game/sky.ts";
import { mergeStill } from "../engine/merge3d.ts";
import { canvasTexture, glow, Model } from "../kit/kit.ts";
import type { Sign } from "../rooms/rooms.ts";

const RED = "#b3262e";
const RED_DARK = "#8c1d24";
const CREAM = "#fbf7ef";
const GREEN = "#2f6b3a";
const INK = "#2b2433";
const BULBS = ["#ff5a5a", "#f5d14a", "#5fd38a", "#6fb4ff"];

/** Its name down a side, cream on red. */
function nameplate(): THREE.MeshBasicMaterial {
  const map = canvasTexture(
    256,
    64,
    (g) => {
      g.fillStyle = RED;
      g.fillRect(0, 0, 256, 64);
      g.fillStyle = CREAM;
      g.font = "900 40px system-ui, sans-serif";
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.fillText(JULEBRYG.name.toUpperCase(), 128, 34);
    },
    true,
  );
  return new THREE.MeshBasicMaterial({ map });
}

/** The truck facing +x, its middle at the origin: a red box with the name on both sides, a green cab, fairy lights. */
function truckModel(): Model {
  const m = new Model();
  m.box([2.7, 1.3, 1.1], RED, [-0.55, 0.5, 0]);
  m.box([2.72, 0.25, 1.12], RED_DARK, [-0.55, 0.3, 0]);
  m.box([2.72, 0.06, 1.12], CREAM, [-0.55, 1.62, 0]);
  const plate = nameplate();
  for (const side of [1, -1]) {
    const p = m.plane(2.3, 0.58, plate, [-0.55, 1.15, side * 0.561]);
    p.rotation.y = side > 0 ? 0 : Math.PI;
  }
  m.box([1.1, 1.05, 1.05], GREEN, [1.35, 0.3, 0]);
  m.box([0.04, 0.38, 0.82], "#a8d8f0", [1.9, 0.85, 0], 0.005);
  m.box([0.62, 0.34, 1.07], "#a8d8f0", [1.38, 0.88, 0], 0.005);
  m.box([0.1, 0.16, 1.1], "#9aa3ad", [1.94, 0.3, 0], 0.01);
  const headlight = glow("#ffe08a");
  for (const z of [-0.35, 0.35]) m.box([0.04, 0.12, 0.18], headlight, [1.97, 0.5, z], 0.005);
  for (const x of [-1.5, 0.2, 1.4])
    for (const z of [-0.5, 0.5]) m.ball(0.26, INK, [x, 0.26, z], [1, 1, 0.45], 12);
  // The fairy lights along both edges of the roof: a material a colour, so they merge.
  const bulbs = BULBS.map((c) => glow(c));
  for (let i = 0; i < 9; i++)
    for (const z of [-0.56, 0.56])
      m.ball(0.045, bulbs[i % bulbs.length]!, [-1.8 + i * 0.32, 1.7, z], [1, 1, 1], 6);
  return m;
}

/**
 * J-dag's truck in the 3D town (`core/src/jdag.ts`; the 2D one is `game/jdag.ts`): built once per town, merged into
 * a few meshes, and moved along the road under the square as `truckAt` says, on `skyNow()` like the 2D one. Hidden the rest of
 * the year. Its sign is a live one while it's parked.
 */
export class Truck3d {
  readonly group = new THREE.Group();
  private readonly toWorld: (tx: number, ty: number) => [number, number];
  private readonly sign: Sign = { key: "jdag-truck", at: [0, 0, 0], kind: "door", text: TRUCK_SIGN };
  private parked = false;

  constructor(toWorld: (tx: number, ty: number) => [number, number]) {
    this.toWorld = toWorld;
    this.group.name = "jdag-truck";
    const model = truckModel();
    this.group.add(model);
    // Merged where it all lies in one patch of floor (the batching splits at multiples of 100, 0 among them):
    // the merged meshes are in the model's own space, so it goes back after.
    model.position.set(50, 0, 50);
    mergeStill(model);
    model.position.set(0, 0, 0);
    this.group.traverse((o) => {
      o.userData.nopick = true;
    });
    // It drives, and comes and goes with the calendar: the room's batching leaves it as it is.
    this.group.userData.nobatch = true;
    this.group.visible = false;
  }

  update(): void {
    const t = truckAt(skyNow());
    this.group.visible = t !== null;
    this.parked = t?.parked ?? false;
    if (!t) return;
    // `t.x` is its back tile; the model's middle is half its length on.
    const [x, z] = this.toWorld(t.x, t.y);
    this.group.position.set(x + (TRUCK.w - 1) / 2, 0, z);
    this.sign.at = [this.group.position.x, 2.2, z];
  }

  signs(): Sign[] {
    return this.parked ? [this.sign] : [];
  }
}
