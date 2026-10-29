import * as THREE from "three";
import { hud } from "../../store.ts";
import { disposeObject } from "../engine/dispose.ts";
import { Swarm } from "../engine/swarm.ts";
import { canvasTexture } from "../kit/kit.ts";
import type { Sign } from "../rooms/rooms.ts";
import { type GateState, gateState, gateText } from "./raidfx.ts";

/**
 * The raid dungeon's gate in town: open (the swirling portal), boarded up before the first raid (planks, tape and a
 * danger sign, a rumble every so often, dust shaken off the arch), shut with a portcullis between a week's end and Monday
 * 08:00, and the boards bursting off at the launch. It sits over the town's gate model and changes with `hud.raid`.
 */

const RUMBLE_EVERY_S = 7;
const RUMBLE_S = 0.7;
const BURST_S = 2.6;
const WOOD = "#a8743e";

const openRaid = () => hud.set({ panel: { kind: "raid" } });

interface Plank {
  mesh: THREE.Mesh;
  home: THREE.Vector3;
  roll: number;
  v: THREE.Vector3;
  spin: number;
}

export class GateLive {
  readonly group = new THREE.Group();
  private readonly boards = new THREE.Group();
  private readonly bars = new THREE.Group();
  private readonly planks: Plank[] = [];
  /** The tape and the danger sign: they come off first in a burst. */
  private readonly tags: THREE.Object3D[] = [];
  private readonly sparks = new Swarm(48, 0.05);
  private readonly dust = new Swarm(10, 0.04);
  private state: GateState | null = null;
  private burstAt = -100;
  private readonly sign: Sign;

  /** `at` is the gate model's origin in world units (the town puts it a quarter tile south of its tile's middle). */
  constructor(at: [number, number]) {
    this.group.userData.live = true;
    this.group.userData.nobatch = true;
    this.group.name = "gate-live";
    this.group.position.set(at[0], 0, at[1]);
    const wood = new THREE.MeshToonMaterial({ color: WOOD });
    const plank = new THREE.BoxGeometry(1.75, 0.17, 0.05);
    for (const [y, z, roll] of [
      [0.35, 0.3, -0.06],
      [0.7, 0.32, 0.06],
      [1.05, 0.3, -0.06],
      [1.4, 0.28, 0.06],
    ] as const) {
      const mesh = new THREE.Mesh(plank, wood);
      mesh.position.set(0, y, z);
      mesh.rotation.z = roll;
      mesh.castShadow = true;
      mesh.userData.nopick = true;
      this.boards.add(mesh);
      this.planks.push({ mesh, home: mesh.position.clone(), roll, v: new THREE.Vector3(), spin: 0 });
    }
    const tapeTex = canvasTexture(32, 4, (g) => {
      for (let x = 0; x < 32; x += 8) {
        g.fillStyle = "#f5d14a";
        g.fillRect(x, 0, 4, 4);
        g.fillStyle = "#2b2433";
        g.fillRect(x + 4, 0, 4, 4);
      }
    });
    tapeTex.wrapS = THREE.RepeatWrapping;
    tapeTex.repeat.set(4, 1);
    const tape = new THREE.Mesh(
      new THREE.PlaneGeometry(2.0, 0.14),
      new THREE.MeshBasicMaterial({ map: tapeTex }),
    );
    tape.position.set(0, 0.9, 0.36);
    tape.rotation.z = -0.28;
    tape.userData.nopick = true;
    this.boards.add(tape);
    this.tags.push(tape);
    const danger = canvasTexture(
      64,
      40,
      (g) => {
        g.fillStyle = "#f5d14a";
        g.fillRect(0, 0, 64, 40);
        g.fillStyle = "#2b2433";
        g.fillRect(0, 0, 64, 3);
        g.fillRect(0, 37, 64, 3);
        g.font = "800 14px system-ui, sans-serif";
        g.textAlign = "center";
        g.fillText("DANGER", 32, 17);
        g.font = "700 9px system-ui, sans-serif";
        g.fillText("OPENS MON 08:00", 32, 31, 58);
      },
      true,
    );
    const sign = new THREE.Mesh(
      new THREE.PlaneGeometry(0.7, 0.44),
      new THREE.MeshBasicMaterial({ map: danger }),
    );
    sign.position.set(0, 0.85, 0.4);
    sign.userData.nopick = true;
    this.boards.add(sign);
    this.tags.push(sign);
    this.boards.visible = false;
    this.group.add(this.boards);

    // The portcullis: iron bars over the way down.
    const iron = new THREE.MeshToonMaterial({ color: "#1c1924" });
    const bar = new THREE.BoxGeometry(0.06, 1.7, 0.06);
    for (let i = 0; i < 7; i++) {
      const m = new THREE.Mesh(bar, iron);
      m.position.set(-0.48 + i * 0.16, 0.95, 0.3);
      m.userData.nopick = true;
      this.bars.add(m);
    }
    const rail = new THREE.BoxGeometry(1.1, 0.06, 0.07);
    for (const y of [0.35, 1.0, 1.7]) {
      const m = new THREE.Mesh(rail, iron);
      m.position.set(0, y, 0.3);
      m.userData.nopick = true;
      this.bars.add(m);
    }
    // And a veil over the portal's glow.
    const veil = new THREE.Mesh(
      new THREE.PlaneGeometry(1.05, 1.7),
      new THREE.MeshBasicMaterial({ color: "#0b0912", transparent: true, opacity: 0.6, depthWrite: false }),
    );
    veil.position.set(0, 0.95, 0.27);
    veil.userData.nopick = true;
    this.bars.add(veil);
    this.bars.visible = false;
    this.group.add(this.bars);

    this.group.add(this.sparks.mesh, this.dust.mesh);
    this.sign = {
      key: "gate",
      at: [at[0], 2.75, at[1]],
      kind: "label",
      text: "",
      cls: "dark",
      onClick: openRaid,
    };
  }

  /** Once a frame, `t` seconds on the room's clock. */
  update(t: number): void {
    const raid = hud.get().raid;
    const next = gateState(raid);
    if (this.state === "boarded" && next === "open" && raid) this.burstAt = t;
    if (this.state !== next) {
      this.state = next;
      this.boards.visible = next === "boarded";
      for (const t of this.tags) t.visible = true;
      this.bars.visible = next === "shut";
      if (next === "boarded") this.restore();
    }
    const bursting = t - this.burstAt < BURST_S;
    if (bursting) this.burst(t - this.burstAt);
    else if (this.sparks.size) {
      this.sparks.begin();
      this.sparks.end();
    }
    if (next === "boarded") this.rumble(t);
    else if (this.dust.size) {
      this.dust.begin();
      this.dust.end();
    }
  }

  /** The planks back where they hang. */
  private restore(): void {
    for (const p of this.planks) {
      p.mesh.position.copy(p.home);
      p.mesh.rotation.set(0, 0, p.roll);
    }
  }

  /** A shake now and then, dust coming off the arch. */
  private rumble(t: number): void {
    const phase = (Date.now() / 1000) % RUMBLE_EVERY_S;
    const on = phase < RUMBLE_S;
    this.boards.position.x = on ? Math.sin(t * 40) * 0.02 : 0;
    this.dust.begin();
    if (on)
      for (let i = 0; i < 10; i++) {
        const k = (phase / RUMBLE_S + i / 10) % 1;
        this.dust.add(-0.8 + (i / 9) * 1.6, 1.9 - k * 1.6, 0.35, 1 - k, "#aaa6b8");
      }
    this.dust.end();
  }

  /** The boards fly off in a burst of gold and violet, and the sparks come up out of the way down. */
  private burst(age: number): void {
    const t = age / BURST_S;
    this.boards.visible = age < BURST_S * 0.9;
    this.boards.position.x = 0;
    for (const t of this.tags) t.visible = age < 0.2;
    this.planks.forEach((p, i) => {
      const dir = i % 2 === 0 ? -1 : 1;
      p.mesh.position.set(
        p.home.x + dir * (0.5 + 0.7 * age),
        p.home.y + (1.6 + i * 0.3) * age - 3.2 * age * age,
        p.home.z + age * 1.2,
      );
      p.mesh.rotation.set(0, 0, p.roll + dir * age * 7);
    });
    this.sparks.begin();
    for (let i = 0; i < 40; i++) {
      const a = (((i * 2654435761) >>> 0) % 628) / 100;
      const v = 0.7 + ((((i * 40503) >>> 0) % 100) / 100) * 1.8;
      this.sparks.add(
        Math.cos(a) * v * age,
        0.9 + Math.sin(a) * v * age * 0.7 - age * age * 0.6,
        0.4 + age * 0.5,
        Math.max(0, 1 - t * 1.2),
        i % 3 === 0 ? "#ffd35c" : "#c9a2ff",
      );
    }
    this.sparks.end();
  }

  signs(): Sign[] {
    const text = gateText(hud.get().raid);
    if (text === null) return [];
    this.sign.text = text;
    return [this.sign];
  }

  dispose(): void {
    this.group.removeFromParent();
    disposeObject(this.group);
  }
}
