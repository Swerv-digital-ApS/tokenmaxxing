import * as THREE from "three";
import { biting, held, leap, lines } from "../../game/fishing-line.ts";
import { serverNow } from "../../game/world.ts";
import { liveModel, toon } from "../kit/kit.ts";
import { buildFish, type FishRig } from "./fish3d.ts";

/** How high a catch is held over the bank: above the angler's head. */
const HELD_Y = 1.75;
/** Held up a size bigger than life, so it reads from the camera's distance. */
const HELD_SCALE = 1.35;
/** Where the rod is held, and how far it reaches out and up over the water. */
const HAND_Y = 0.68;
const HAND_OUT = 0.2;
const ROD_OUT = 0.5;
const ROD_UP = 0.62;

const UP = new THREE.Vector3(0, 1, 0);
const ROD_GEOMETRY = new THREE.CylinderGeometry(0.011, 0.02, 1, 6);
ROD_GEOMETRY.userData.shared = true;

/** One angler's rod, line and bobber. */
class Tackle {
  readonly group = new THREE.Group();
  private readonly rod = new THREE.Mesh(ROD_GEOMETRY, toon("#815b37"));
  private readonly bobber = liveModel();
  private readonly points = new Float32Array(9);
  private readonly line: THREE.Line;
  private readonly dir = new THREE.Vector3();
  constructor() {
    this.bobber.cyl(0.035, 0.07, "#fff0d1");
    this.bobber.cyl(0.035, 0.04, "#db655f", [0, 0.07, 0]);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(this.points, 3));
    this.line = new THREE.Line(geometry, new THREE.LineBasicMaterial({ color: "#fff0c8" }));
    this.line.frustumCulled = false;
    this.group.add(this.rod, this.bobber, this.line);
  }

  /** From the angler at (`px`, `pz`) to the water at (`wx`, `wz`); `bite`: the bobber is under. */
  place(px: number, pz: number, wx: number, wz: number, now: number, calm: boolean, bite: boolean): void {
    const ux = Math.sign(wx - px);
    const uz = Math.sign(wz - pz);
    const hx = px + ux * HAND_OUT;
    const hz = pz + uz * HAND_OUT;
    const tx = hx + ux * ROD_OUT;
    const tz = hz + uz * ROD_OUT;
    const ty = HAND_Y + ROD_UP;
    this.dir.set(tx - hx, ty - HAND_Y, tz - hz);
    const length = this.dir.length();
    this.rod.position.set((hx + tx) / 2, (HAND_Y + ty) / 2, (hz + tz) / 2);
    this.rod.quaternion.setFromUnitVectors(UP, this.dir.normalize());
    this.rod.scale.set(1, length, 1);
    const y = bite ? -0.035 + Math.sin(now / 45) * 0.012 : 0.06 + (calm ? 0 : Math.sin(now / 220) * 0.015);
    this.bobber.position.set(wx, y, wz);
    // A little slack: the line sags between the tip and the water.
    this.points.set([
      tx,
      ty,
      tz,
      (tx + wx) / 2,
      Math.max(0.2, (ty + y) / 2 - 0.15),
      (tz + wz) / 2,
      wx,
      y + 0.1,
      wz,
    ]);
    this.line.geometry.attributes.position!.needsUpdate = true;
  }
}

/** A slot for one catch being held up: the rigs it has built, by fish, and the one showing. */
interface Hold {
  rigs: Map<string, FishRig>;
  shown: FishRig | null;
}

/**
 * Everyone fishing at the real pond: each angler's rod, line and bobber, and each catch leaping out of the water
 * and held up over its angler's head for a moment before it goes back in. Mine come from my panel, everyone
 * else's from what the room was told (`fishing-line.ts`).
 */
export class FishingLine {
  readonly group = liveModel();
  private readonly tackle: Tackle[] = [];
  private readonly holds: Hold[] = [];
  constructor() {
    this.group.name = "fishing-line";
    this.group.userData.nopick = true;
    this.group.userData.noBlock = true;
  }

  update(now: number, toWorld: (x: number, y: number) => [number, number], calm: boolean): void {
    const server = serverNow();
    const shown = lines();
    for (let i = 0; i < shown.length; i++) {
      const l = shown[i]!;
      let t = this.tackle[i];
      if (!t) {
        t = new Tackle();
        this.tackle.push(t);
        this.group.add(t.group);
      }
      t.group.visible = true;
      const [px, pz] = toWorld(l.x, l.y);
      const [wx, wz] = toWorld(l.waterX, l.waterY);
      t.place(px, pz, wx, wz, now, calm, biting(l, server));
    }
    for (let i = shown.length; i < this.tackle.length; i++) this.tackle[i]!.group.visible = false;
    this.updateHeld(now, toWorld, calm);
  }

  /** Each catch along its leap (`leap`): out of the water, up over the bank, held, and back in. */
  private updateHeld(now: number, toWorld: (x: number, y: number) => [number, number], calm: boolean): void {
    const shown = held(now);
    for (let i = 0; i < Math.max(shown.length, this.holds.length); i++) {
      const h = shown[i];
      let slot = this.holds[i];
      if (!slot) {
        slot = { rigs: new Map(), shown: null };
        this.holds.push(slot);
      }
      let rig: FishRig | null = null;
      if (h) {
        rig = slot.rigs.get(h.fish) ?? null;
        if (!rig) {
          rig = buildFish(h.fish);
          rig.root.scale.setScalar(HELD_SCALE);
          slot.rigs.set(h.fish, rig);
        }
      }
      if (rig !== slot.shown) {
        if (slot.shown) this.group.remove(slot.shown.root);
        if (rig) this.group.add(rig.root);
        slot.shown = rig;
      }
      if (!h || !rig) continue;
      const [px, pz] = toWorld(h.x, h.y);
      const [wx, wz] = toWorld(h.waterX, h.waterY);
      const { k, lift } = leap(h.t);
      const thrashing = !calm && h.t < 0.8;
      rig.root.position.set(wx + (px - wx) * k, 0.1 + (HELD_Y - 0.1) * Math.min(1, lift), wz + (pz - wz) * k);
      // Nose towards the water; it thrashes, tail flapping, until it's back in.
      rig.root.rotation.set(0, wx < px ? Math.PI : 0, thrashing ? Math.sin(now / 60) * 0.25 : 0);
      if (rig.tail) rig.tail.rotation.y = thrashing ? Math.sin(now / 45) * 0.6 : 0;
    }
  }
}
