/**
 * Characters: one look (skin, hair, outfit, hat, species, age) worn in any of five styles (`styles.ts`), all
 * posed the same way here, with painted faces (`faces.ts`). The colours are the game's own
 * (`web/src/art/palette.ts`), so every look a player has today has a 3D twin. Pets are built the same way.
 */
import type { DanceMove } from "@tokenmaxxing/core/dances.ts";
import * as THREE from "three";
import { HAIRS, OUTFITS, PANTS, SKINS } from "../../art/palette.ts";
import { liveModel, Model, tint, type V3 } from "../kit/kit.ts";
import { Freezer, TINY_PX, view } from "../perf/freeze.ts";
import { dancePose, newDancePose } from "./dances.ts";
import { type Expression, type Face, faceTexture } from "./faces.ts";
import { type Gait, gaitSettled, newGait, stepGait, walkPose } from "./motion.ts";
import {
  AGES,
  type Age,
  ANIMALS,
  animal,
  bot,
  type CharStyle,
  chibi,
  grown,
  type Hat,
  type Job,
  type Look,
  type Rig,
  type Top,
} from "./styles.ts";
import { voxel } from "./voxel.ts";

const BUILD: Record<CharStyle, (body: Model, look: Look) => Rig> = { voxel, grown, animal, chibi, bot };

export type { Expression } from "./faces.ts";
export type { CharStyle, Gear, Look } from "./styles.ts";

export const HATS: readonly Hat[] = ["none", "cap", "beanie", "headphones", "crown"];

const JOBS: readonly Job[] = ["chef", "farmer", "officer"];

/** What people wear at each age. */
const TOPS: Record<Age, readonly Top[]> = {
  young: ["tee", "hoodie", "hoodie"],
  adult: ["tee", "hoodie", "blazer", "blazer"],
  senior: ["cardigan", "cardigan", "blazer"],
};

export function randomLook(rnd = Math.random): Look {
  const pick = <T>(xs: readonly T[]) => xs[Math.floor(rnd() * xs.length)]!;
  const outfit = Math.floor(rnd() * OUTFITS.length);
  // Mostly working age.
  const age: Age = rnd() < 0.15 ? "senior" : pick(AGES.slice(0, 2));
  return {
    skin: pick(SKINS),
    hair: pick(HAIRS),
    style: Math.floor(rnd() * 5),
    outfit: OUTFITS[outfit]!,
    pants: PANTS[outfit] ?? PANTS[0]!,
    hat: rnd() < 0.55 ? "none" : pick(HATS.slice(1)),
    species: rnd() < 0.5 ? "human" : pick(ANIMALS),
    age,
    top: pick(TOPS[age]),
    beard: age !== "young" && rnd() < 0.4 ? 1 + Math.floor(rnd() * 2) : 0,
    glasses: age === "senior" || rnd() < 0.2,
    job: rnd() < 0.2 ? pick(JOBS) : undefined,
  };
}

/** A person from the basics: an adult human in a tee unless said otherwise. */
export function personLook(
  base: Pick<Look, "skin" | "hair" | "style" | "outfit" | "pants" | "hat"> & Partial<Look>,
): Look {
  return { species: "human", age: "adult", top: "tee", beard: 0, glasses: false, ...base };
}

export type Pose = "stand" | "walk" | "sit" | "type" | "sleep" | "wave" | "dance" | "dj";

export class Avatar {
  readonly root = liveModel();
  readonly body = this.root.part();
  readonly head: Model;
  /** Standing height, to the top of the head, and the hips, which a sitter drops by. */
  readonly height: number;
  readonly hip: number;
  private readonly rig: Rig;
  /** Short legs don't bend; theirs are stand-ins. */
  private readonly knees: [Model, Model];
  /** How they look; a blink or a word passes over it for a moment. */
  expression: Expression = "neutral";
  /** Talking: the mouth opens and shuts. */
  talking = false;
  /** The arms and legs, shoulder and hip at their origin (`gear3d.ts` hangs things from them). */
  readonly arms: [Model, Model];
  readonly legs: [Model, Model];
  pose: Pose = "stand";
  /** Which dance the "dance" pose is (`dances.ts`); none is the dance floor's own groove. */
  move: DanceMove | null = null;
  private readonly moves = newDancePose();
  /** Where they are in their stride: driven by the ground covered (`update`'s `moved`), not by the clock. */
  readonly gait: Gait = newGait(Math.random());
  /** Walking speed assumed when `update` isn't told how far they moved. */
  nominalSpeed = 2.1;
  /** Offsets the breathing so a crowd doesn't heave in step. */
  private readonly breath = Math.random() * 10;
  private readonly at = new THREE.Vector3();
  private blinkAt = Math.random() * 4;
  /** Idle people are merged into a couple of meshes (see `Freezer`); gear that animates keeps them live. */
  private readonly freezer = new Freezer(this.root);
  private freezable = true;

  constructor(
    readonly look: Look,
    readonly style: CharStyle = "voxel",
  ) {
    this.rig = BUILD[style](this.body, look);
    this.head = this.rig.head;
    this.height = this.rig.height;
    this.hip = this.rig.hip;
    this.knees = this.rig.knees ?? [new Model(), new Model()];
    this.arms = this.rig.arms;
    this.legs = this.rig.legs;
    look.gear?.dress(this);
    // The static batching merges what is fixed inside each limb (hair, clothes, gear): one mesh per limb, not per piece.
    this.root.userData.bake = true;
    this.root.userData.actor = true;
    for (const bone of [this.body, this.head, ...this.arms, ...this.legs, ...this.knees])
      bone.userData.rigid = true;
    for (const f of this.rig.faces) f.material.userData.dynamic = true;
    this.freezable = !this.rig.tick && (!look.gear || look.gear.animated === false);
    // The batching samples a walk and a stand to find the parts that gear and rigs move, and leaves those alone.
    this.root.userData.sample = (t: number) => this.sampleMotion(t);
  }

  /** The state worth freezing in right now (null while the limbs animate): resting poses, or any pose when tiny. */
  private frozenKey(): string | null {
    if (this.height * view.pxPerUnit < TINY_PX || this.root.userData.lod) return "tiny";
    if (!this.freezable || !gaitSettled(this.gait)) return null;
    // Typing moves the arms a few centimetres: not worth fifteen draw calls.
    return this.pose === "stand" || this.pose === "sit" || this.pose === "sleep" || this.pose === "type"
      ? this.pose
      : null;
  }

  dispose(): void {
    this.freezer.dispose();
  }

  private sampleMotion(t: number): void {
    const keep = this.pose;
    const g = this.gait;
    const { phase, weight } = g;
    // Mid-stride at a different point for each sample time: whatever the walk moves shows as moving.
    g.phase = phase + t * 1.7;
    g.weight = 1;
    this.pose = "walk";
    this.posed(1 / 60, t);
    g.phase = phase;
    g.weight = weight;
    this.pose = "stand";
    this.posed(1 / 60, t);
    this.pose = keep;
    this.posed(1 / 60, t);
  }

  /**
   * Moves the limbs for `pose`, `dt` seconds after the last frame, having come `moved` world units since (the walk
   * cycle turns with the ground; left out, the walk is assumed to go at `nominalSpeed`).
   */
  update(dt: number, t: number, moved?: number): void {
    const walking = this.pose === "walk";
    stepGait(this.gait, moved ?? (walking ? this.nominalSpeed * dt : 0), dt, walking);
    // Out of the picture nobody sees the limbs: skip posing (the walk cycle keeps its phase).
    const e = this.root.matrixWorld.elements;
    this.at.set(e[12]!, e[13]!, e[14]!);
    if (!view.sees(this.at, this.height + 0.5)) {
      this.freezer.touch();
      return;
    }
    const key = this.frozenKey();
    if (this.freezer.holds(key)) {
      this.updateFace(t);
      return;
    }
    this.posed(dt, t);
    this.freezer.settle(key);
  }

  private posed(dt: number, t: number): void {
    const [legL, legR] = this.rig.legs;
    const [armL, armR] = this.rig.arms;
    const [kneeL, kneeR] = this.knees;
    const HIP = this.rig.hip;
    const b = this.body;
    b.position.set(0, 0, 0);
    b.rotation.set(0, 0, 0);
    b.scale.set(1, 1, 1);
    this.head.rotation.set(0, 0, 0);
    legL.rotation.set(0, 0, 0);
    legR.rotation.set(0, 0, 0);
    armL.rotation.set(0, 0, 0);
    armR.rotation.set(0, 0, 0);
    kneeL.rotation.set(0, 0, 0);
    kneeR.rotation.set(0, 0, 0);

    // The stride: legs turn at the hip and arms at the shoulder, the opposite way; the body bobs twice a step and
    // leans only while the pace changes. It also plays out the last half-step of someone who just stopped.
    const stride = (): void => {
      const g = this.gait;
      const w = walkPose(g.phase, g.weight);
      legL.rotation.x = w.leg;
      legR.rotation.x = -w.leg;
      kneeL.rotation.x = w.knee[0];
      kneeR.rotation.x = w.knee[1];
      armL.rotation.x = w.arm;
      armR.rotation.x = -w.arm;
      b.position.y = w.bob;
      b.rotation.z = w.sway;
      b.rotation.x = g.lean;
    };

    switch (this.pose) {
      case "walk":
        stride();
        break;
      case "sit":
      case "type":
        b.position.y = -HIP + 0.02;
        legL.rotation.x = legR.rotation.x = -Math.PI / 2;
        kneeL.rotation.x = kneeR.rotation.x = 1.35;
        if (this.pose === "type") {
          armL.rotation.x = armR.rotation.x = -1.15;
          armL.rotation.x += Math.sin(t * 22) * 0.07;
          armR.rotation.x += Math.cos(t * 19) * 0.07;
          this.head.rotation.x = 0.08 + Math.sin(t * 1.3) * 0.03;
        } else {
          armL.rotation.x = armR.rotation.x = -0.35;
          this.head.rotation.y = Math.sin(t * 0.5) * 0.25;
        }
        break;
      case "sleep":
        b.rotation.x = -Math.PI / 2;
        // Feet to the foot of the bed, however tall.
        b.position.set(0, 0.06, 0.32 + Math.max(0, this.height - 0.97));
        b.scale.y = 1 + Math.sin(t * 1.6) * 0.02;
        armL.rotation.z = 0.15;
        armR.rotation.z = -0.15;
        break;
      case "wave":
        armR.rotation.z = 2.6 + Math.sin(t * 9) * 0.35;
        this.head.rotation.z = Math.sin(t * 3) * 0.06;
        break;
      case "dance": {
        if (this.move) {
          // On the clock, not offset: two people doing the same dance are in step.
          const d = dancePose(this.move, t, HIP, this.height, this.moves);
          b.position.set(d.slide, d.lift, d.step);
          b.rotation.set(d.lean, d.turn, d.tilt);
          const put = (o: THREE.Object3D, v: V3) => o.rotation.set(v[0], v[1], v[2]);
          put(this.head, d.head);
          put(armL, d.armL);
          put(armR, d.armR);
          put(legL, d.legL);
          put(legR, d.legR);
          kneeL.rotation.x = d.kneeL;
          kneeR.rotation.x = d.kneeR;
          break;
        }
        const beat = t * 7 + this.breath;
        b.position.y = Math.abs(Math.sin(beat)) * 0.07;
        b.rotation.y = Math.sin(beat * 0.5) * 0.4;
        armL.rotation.z = -2.4 - Math.sin(beat) * 0.4;
        armR.rotation.z = 2.4 - Math.sin(beat) * 0.4;
        legL.rotation.x = Math.max(0, Math.sin(beat)) * -0.5;
        legR.rotation.x = Math.max(0, -Math.sin(beat)) * -0.5;
        kneeL.rotation.x = Math.max(0, Math.sin(beat)) * 0.9;
        kneeR.rotation.x = Math.max(0, -Math.sin(beat)) * 0.9;
        this.head.rotation.z = Math.sin(beat) * 0.12;
        break;
      }
      case "dj":
        armL.rotation.x = -1.3 + Math.sin(t * 7) * 0.1;
        armR.rotation.x = -0.9;
        armR.rotation.z = 0.3 + Math.sin(t * 3.5) * 0.3;
        this.head.rotation.x = Math.max(0, Math.sin(t * 7)) * 0.18;
        b.position.y = Math.abs(Math.sin(t * 7)) * 0.02;
        break;
      case "stand":
        if (!gaitSettled(this.gait)) {
          stride();
          break;
        }
        b.position.y = Math.sin(t * 2.2 + this.breath) * 0.006;
        armL.rotation.z = -0.04 - Math.sin(t * 2.2) * 0.02;
        armR.rotation.z = 0.04 + Math.sin(t * 2.2) * 0.02;
        break;
    }

    this.updateFace(t);
    this.rig.tick?.(t);
    this.look.gear?.update?.(this, dt, t);
  }

  private updateFace(t: number): void {
    // Blink every few seconds, and move the mouth while talking.
    const blink = t > this.blinkAt && t < this.blinkAt + 0.12;
    if (t > this.blinkAt + 0.12) this.blinkAt = t + 2 + Math.random() * 4;
    const shut = this.pose === "sleep" || (this.pose === "dance" && this.moves.shut && this.move !== null);
    let face: Face = shut ? "sleep" : this.expression;
    if (face === "neutral" && this.talking && Math.sin(t * 16) > 0) face = "talk";
    if (blink && (face === "neutral" || face === "focus" || face === "surprised")) face = "blink";
    for (const f of this.rig.faces) {
      const map = faceTexture(face, f.kind);
      if (f.material.map !== map) f.material.map = map;
    }
  }
}

export type PetKind = "cat" | "dog" | "duck";

/** A pet, about a third of a tile tall, with a `bob` for walking. */
export class Pet {
  readonly root = liveModel();
  private readonly body = this.root.part();
  private readonly tail?: THREE.Object3D;
  moving = false;
  /** Pace assumed when `update` isn't told how far it came. */
  nominalSpeed = 1.6;
  private readonly gait = newGait(Math.random());
  private readonly at = new THREE.Vector3();
  private last = -1;
  private readonly freezer = new Freezer(this.root);

  constructor(
    readonly kind: PetKind,
    color: string,
  ) {
    this.root.userData.actor = true;
    const b = this.body;
    const eye = (at: V3) => b.ball(0.02, "#2b2433", at, [1, 1.2, 0.5], 8);
    switch (kind) {
      case "cat": {
        b.box([0.18, 0.13, 0.3], color, [0, 0.06, -0.03], 0.06);
        for (const [x, z] of [
          [-0.06, 0.08],
          [0.06, 0.08],
          [-0.06, -0.12],
          [0.06, -0.12],
        ] as const)
          b.box([0.05, 0.08, 0.05], color, [x, 0, z], 0.02);
        b.ball(0.12, color, [0, 0.25, 0.13], [1.1, 0.95, 1]);
        for (const s of [-1, 1]) {
          b.cyl(0.04, 0.08, color, [s * 0.07, 0.33, 0.12], 0.003, 4).rotation.z = -s * 0.25;
          eye([s * 0.045, 0.26, 0.24]);
        }
        b.ball(0.015, "#f28bb2", [0, 0.22, 0.25]);
        const tail = b.part([0, 0.16, -0.17]);
        tail.cyl(0.025, 0.24, color, [0, 0, 0], 0.02, 6).rotation.x = -0.5;
        this.tail = tail;
        break;
      }
      case "dog": {
        b.box([0.2, 0.15, 0.34], color, [0, 0.08, -0.03], 0.07);
        for (const [x, z] of [
          [-0.06, 0.1],
          [0.06, 0.1],
          [-0.06, -0.13],
          [0.06, -0.13],
        ] as const)
          b.box([0.06, 0.1, 0.06], color, [x, 0, z], 0.025);
        b.ball(0.13, color, [0, 0.29, 0.15]);
        b.box([0.11, 0.08, 0.1], tint(color, 0.3), [0, 0.22, 0.26], 0.04);
        b.ball(0.025, "#2b2433", [0, 0.29, 0.31]);
        for (const s of [-1, 1]) {
          b.box([0.05, 0.13, 0.06], tint(color, -0.3), [s * 0.13, 0.22, 0.13], 0.025).rotation.z = s * 0.2;
          eye([s * 0.05, 0.32, 0.26]);
        }
        const tail = b.part([0, 0.2, -0.19]);
        tail.cyl(0.025, 0.14, color, [0, 0, 0], 0.015, 6).rotation.x = -0.9;
        this.tail = tail;
        break;
      }
      case "duck":
        b.ball(0.15, color, [0, 0.13, 0], [1, 0.85, 1.2]);
        b.ball(0.1, color, [0, 0.31, 0.08]);
        b.box([0.09, 0.03, 0.08], "#f08a2c", [0, 0.28, 0.18], 0.012);
        b.ball(0.07, tint(color, -0.08), [0, 0.18, -0.15], [1, 0.6, 1]);
        for (const s of [-1, 1]) {
          eye([s * 0.045, 0.34, 0.16]);
          b.box([0.05, 0.02, 0.07], "#f08a2c", [s * 0.05, 0, 0.03], 0.008);
        }
        break;
    }
  }

  /** `moved`: how far it came since the last frame, world units (left out: `nominalSpeed` while `moving`). */
  update(t: number, moved?: number): void {
    const dt = this.last < 0 ? 1 / 60 : Math.min(0.1, Math.max(0, t - this.last));
    this.last = t;
    stepGait(this.gait, moved ?? (this.moving ? this.nominalSpeed * dt : 0), dt, this.moving);
    const e = this.root.matrixWorld.elements;
    this.at.set(e[12]!, e[13]!, e[14]!);
    if (!view.sees(this.at, 1)) {
      this.freezer.touch();
      return;
    }
    const key = this.root.userData.lod ? "far" : this.moving || !gaitSettled(this.gait) ? null : "idle";
    if (this.freezer.holds(key)) return;
    this.pose(t);
    this.freezer.settle(key);
  }

  dispose(): void {
    this.freezer.dispose();
  }

  private pose(t: number): void {
    const b = this.body;
    // A trot: the same cycle as the people's, shorter legs bobbing twice as much.
    const w = walkPose(this.gait.phase * 2, this.gait.weight);
    b.position.y = w.bob * 1.6;
    b.rotation.z = w.sway * 2;
    if (this.tail) this.tail.rotation.y = Math.sin(t * (this.moving ? 12 : 3)) * 0.5;
  }
}
