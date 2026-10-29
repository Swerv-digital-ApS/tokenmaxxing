import { BARREL, cracks } from "@tokenmaxxing/core/fastelavn.ts";
import * as THREE from "three";
import { barrelNow, barrelSign } from "../../game/fastelavn.ts";
import { hud } from "../../store.ts";
import { mergeStill } from "../engine/merge3d.ts";
import { Model } from "../kit/kit.ts";
import type { Sign } from "../rooms/rooms.ts";

const WOOD = "#a0703f";
const WOOD_DARK = "#6e4a26";
const BAND = "#3c3a44";
const INK = "#2b2433";
const STREAMERS = ["#e8584f", "#f5d14a", "#5ee0ff", "#7dff8a"];
/** Where the barrel hangs (its middle), over its tile. */
const HANG_Y = 1.15;

/** The frame: a post on the tile either side, a bar across, streamers on it. Its middle over the barrel's tile. */
function frameModel(): Model {
  const m = new Model();
  for (const x of [-1, 1]) m.box([0.14, 2.1, 0.14], WOOD_DARK, [x, 0, 0], 0.02);
  m.box([2.3, 0.14, 0.16], WOOD_DARK, [0, 2.05, 0], 0.02);
  for (const [i, c] of STREAMERS.entries()) m.box([0.05, 0.3, 0.02], c, [-0.75 + i * 0.5, 1.75, 0.09], 0.004);
  return m;
}

/** The barrel on its rope: staves, two bands, a black cat painted on the front. */
function barrelModel(): Model {
  const m = new Model();
  m.cyl(0.015, 0.45, "#d9c7a0", [0, 0.35, 0], 0.015, 6);
  m.cyl(0.32, 0.7, WOOD, [0, -0.35, 0], 0.32, 14);
  for (const y of [-0.22, 0.22]) m.cyl(0.33, 0.06, BAND, [0, y, 0], 0.33, 14);
  m.box([0.26, 0.24, 0.02], INK, [0, -0.13, 0.325], 0.01);
  for (const x of [-0.09, 0.09]) m.box([0.07, 0.08, 0.02], INK, [x, 0.1, 0.325], 0.005);
  for (const x of [-0.06, 0.06]) m.box([0.04, 0.04, 0.02], "#f5d14a", [x, -0.03, 0.336], 0.004);
  return m;
}

/** What's left: staves on the grass, a band, sweets. */
function brokenModel(): Model {
  const m = new Model();
  for (const [x, z, turn] of [
    [-0.3, 0.1, 0.4],
    [0.25, -0.15, -0.6],
    [0.05, 0.3, 1.2],
    [-0.1, -0.3, 2.0],
  ] as const)
    m.part([x, 0.02, z], turn).box([0.12, 0.04, 0.6], WOOD, [0, 0, 0], 0.01);
  m.cyl(0.3, 0.05, BAND, [0.1, 0.02, 0], 0.3, 12).rotation.z = 0.15;
  for (const [i, c] of STREAMERS.entries()) m.ball(0.06, c, [-0.4 + i * 0.25, 0.05, 0.45 - (i % 2) * 0.8]);
  return m;
}

/**
 * The fastelavn barrel in the 3D town (the 2D one is `game/fastelavn.ts`), from the same state: up on
 * Fastelavn Sunday, swinging with the whacks and tilting more as it cracks, staves on the grass once it's broken.
 * Its sign is a live one.
 */
export class Barrel3d {
  readonly group = new THREE.Group();
  private readonly barrel = barrelModel();
  private readonly broken = brokenModel();
  private readonly sign: Sign = { key: "fastelavn-barrel", at: [0, 2.6, 0], kind: "door", text: "" };

  constructor(toWorld: (tx: number, ty: number) => [number, number]) {
    this.group.name = "fastelavn";
    const [x, z] = toWorld(BARREL.x, BARREL.y);
    this.group.position.set(x, 0, z);
    this.sign.at = [x, 2.6, z];
    const frame = frameModel();
    this.barrel.position.y = HANG_Y;
    this.group.add(frame, this.barrel, this.broken);
    // Merged off the origin, so each lies in one patch of floor (the batching splits at multiples of 100).
    for (const m of [frame, this.barrel, this.broken]) {
      m.position.x += 50;
      m.position.z += 50;
      mergeStill(m);
      m.position.x -= 50;
      m.position.z -= 50;
    }
    this.group.traverse((o) => {
      o.userData.nopick = true;
    });
    // It comes and goes with the calendar, and swings: the room's batching leaves it as it is.
    this.group.userData.nobatch = true;
    this.group.visible = false;
  }

  update(t: number): void {
    this.group.visible = barrelNow();
    if (!this.group.visible) return;
    const b = hud.get().barrel;
    const broken = !!b?.king;
    this.barrel.visible = !broken;
    this.broken.visible = broken;
    if (broken) return;
    const hits = b?.hits ?? 0;
    // A slow sway, and a lean that grows with the cracks.
    this.barrel.rotation.z = Math.sin(t * 2.2 + hits) * 0.05 + cracks(hits) * 0.04;
  }

  signs(): Sign[] {
    if (!this.group.visible) return [];
    this.sign.text = barrelSign();
    return [this.sign];
  }
}
