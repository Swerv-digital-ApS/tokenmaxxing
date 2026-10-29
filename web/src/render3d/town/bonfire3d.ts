import { BONFIRE } from "@tokenmaxxing/core/sankthans.ts";
import * as THREE from "three";
import { bonfireNow } from "../../game/sankthans.ts";
import { mergeStill } from "../engine/merge3d.ts";
import { glow, Model } from "../kit/kit.ts";

const LOG = "#7a4f2b";
const LOG_DARK = "#4f321b";
const FLAMES = ["#e8582a", "#ffb43a", "#fff0a8"];

/** The pile: logs leaning in to a point, a straw witch on a stick on top. Its middle at the origin. */
function pileModel(): Model {
  const m = new Model();
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2;
    const log = m.part([Math.cos(a) * 0.35, 0, Math.sin(a) * 0.3]);
    const l = log.cyl(0.07, 1.1, i % 2 ? LOG : LOG_DARK, [0, 0, 0], 0.05, 6);
    l.rotation.set(Math.sin(a) * 0.45, 0, -Math.cos(a) * 0.45);
  }
  m.cyl(0.03, 0.7, LOG_DARK, [0, 0.8, 0], 0.03, 6);
  m.cyl(0.13, 0.32, "#e3c35a", [0, 1.15, 0], 0.08, 8);
  m.ball(0.09, "#f2d9a0", [0, 1.55, 0]);
  m.cyl(0.14, 0.03, "#2b2433", [0, 1.6, 0], 0.14, 10);
  m.cyl(0.08, 0.22, "#2b2433", [0, 1.62, 0], 0.005, 8);
  return m;
}

/**
 * The Sankt Hans bonfire in the 3D town (the 2D one is `game/sankthans.ts`, and both ask `bonfireNow`): the pile
 * from the morning of 23 June, and from 21:00 flames that flicker, until 01:00.
 */
export class Bonfire3d {
  readonly group = new THREE.Group();
  private readonly flames: Model[] = [];

  constructor(toWorld: (tx: number, ty: number) => [number, number]) {
    this.group.name = "sankthans";
    const [x0, z] = toWorld(BONFIRE.x, BONFIRE.y);
    this.group.position.set(x0 + (BONFIRE.w - 1) / 2, 0, z);
    const pile = pileModel();
    this.group.add(pile);
    // Merged off the origin, so it lies in one patch of floor (the batching splits at multiples of 100).
    pile.position.set(50, 0, 50);
    mergeStill(pile);
    pile.position.set(0, 0, 0);
    for (let i = 0; i < 6; i++) {
      // A tongue of flame: a cone the town's own way (`Model.cyl` with a point), so the blocky look keeps its size.
      const flame = new Model();
      flame.cyl(0.2, 0.9, glow(FLAMES[i % 3]!), [0, 0, 0], 0.01, 6);
      const a = (i / 6) * Math.PI * 2;
      flame.position.set(Math.cos(a) * 0.22, 0.15, Math.sin(a) * 0.2);
      flame.userData.live = true;
      this.flames.push(flame);
      this.group.add(flame);
    }
    this.group.traverse((o) => {
      o.userData.nopick = true;
    });
    // It comes and goes with the calendar, and burns: the room's batching leaves it as it is.
    this.group.userData.nobatch = true;
    this.group.visible = false;
  }

  update(t: number): void {
    const state = bonfireNow();
    this.group.visible = state !== null;
    const lit = state === "lit";
    for (const [i, f] of this.flames.entries()) {
      f.visible = lit;
      if (lit) f.scale.set(1, 0.8 + 0.5 * Math.abs(Math.sin(t * 7 + i * 1.7)), 1);
    }
  }
}
