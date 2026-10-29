import * as THREE from "three";
import { dressCop } from "../town/fx3d-town.ts";
import type { CopState } from "../town/world-logic.ts";
import type { Avatar } from "./avatar.ts";

const SIREN_MS = 170;
const RED = new THREE.Color("#ff4a4a");
const RED_OFF = new THREE.Color("#7a2a2e");
const BLUE = new THREE.Color("#4a9bff");
const BLUE_OFF = new THREE.Color("#25406e");

/**
 * Officer 429's light bar, notepad and pencil on his body, and the red and blue wash on the ground round him
 * while he is on a case (`CopWatch` says when). No real light is added: lights cost every material in the scene.
 */
export class CopGear {
  private readonly parts: ReturnType<typeof dressCop>;
  private readonly pool: THREE.Mesh;
  private on = false;

  constructor(avatar: Avatar, floor: THREE.Object3D) {
    this.parts = dressCop(avatar);
    // The bulbs change colour every few frames: they must not be batched.
    this.parts.l.userData.live = true;
    this.parts.r.userData.live = true;
    this.parts.red.color.copy(RED_OFF);
    this.parts.blue.color.copy(BLUE_OFF);
    this.pool = new THREE.Mesh(
      new THREE.CircleGeometry(1.15, 24),
      new THREE.MeshBasicMaterial({
        color: "#4a9bff",
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    this.pool.rotation.x = -Math.PI / 2;
    this.pool.position.y = 0.11;
    this.pool.visible = false;
    this.pool.userData.nopick = true;
    this.pool.userData.live = true;
    floor.add(this.pool);
  }

  /** Once a frame: the lights and the pad for what he is doing. `calm` slows the flashing to a steady glow. */
  update(state: CopState, now: number, calm: boolean): void {
    const { parts, pool } = this;
    if (state.siren !== this.on) {
      this.on = state.siren;
      pool.visible = state.siren;
      if (!state.siren) {
        parts.red.color.copy(RED_OFF);
        parts.blue.color.copy(BLUE_OFF);
      }
    }
    if (state.siren) {
      const flip = !calm && Math.floor(now / SIREN_MS) % 2 === 0;
      parts.red.color.copy(flip || calm ? RED : RED_OFF);
      parts.blue.color.copy(!flip || calm ? BLUE : BLUE_OFF);
      const m = pool.material as THREE.MeshBasicMaterial;
      m.color.copy(flip ? RED : BLUE);
      m.opacity = calm ? 0.2 : 0.34;
    }
    const pad = state.writing;
    if (parts.pad.visible !== pad) {
      parts.pad.visible = pad;
      parts.pencil.visible = pad;
    }
    if (pad) {
      const k = Math.floor(now / 200) % 2;
      parts.pencil.position.set(0.1 + k * 0.012, 0.31, 0.205);
      parts.pencil.rotation.x = -0.4;
    }
  }
}
