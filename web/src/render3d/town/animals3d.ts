import type { PigeonPose } from "../../game/animal-motion.ts";
import { mergeStill } from "../engine/merge3d.ts";
import { liveModel, type Model } from "../kit/kit.ts";

/** The square's orange tabby, facing +z. The broad white muzzle reads at town zoom. */
export class TownCat {
  readonly root = liveModel();
  private readonly head: Model;
  private readonly tail: Model;

  constructor() {
    const m = this.root;
    m.name = "town-cat";
    const fur = "#d78b45";
    const stripe = "#93512e";
    const cream = "#fff0d1";
    m.box([0.43, 0.3, 0.48], fur, [0, 0.08, -0.08], 0);
    // White chest and two front paws, with a darker haunch behind them.
    m.box([0.27, 0.23, 0.08], cream, [0, 0.1, 0.18], 0);
    for (const x of [-0.14, 0.14]) {
      m.box([0.13, 0.1, 0.2], cream, [x, 0, 0.18], 0);
      m.box([0.08, 0.16, 0.06], stripe, [x, 0.17, -0.21], 0);
    }
    this.head = m.part([0, 0.32, 0.19]);
    this.head.box([0.4, 0.3, 0.3], fur, [0, 0, 0], 0);
    // Pointed ears with contrasting pink centres.
    for (const x of [-0.14, 0.14]) {
      const ear = this.head.cyl(0.105, 0.19, fur, [x, 0.25, 0], 0, 4);
      ear.rotation.y = Math.PI / 4;
      this.head.box([0.065, 0.08, 0.025], "#e6a29a", [x, 0.28, 0.06], 0);
      this.head.box([0.075, 0.065, 0.025], "#b4d678", [x * 0.75, 0.13, 0.154], 0);
      this.head.box([0.025, 0.055, 0.012], "#302d32", [x * 0.75, 0.135, 0.171], 0);
      this.head.box([0.14, 0.085, 0.06], cream, [x * 0.45, 0.035, 0.16], 0);
      for (const y of [0.065, 0.105]) this.head.box([0.1, 0.012, 0.018], cream, [x * 1.35, y, 0.17], 0);
    }
    this.head.box([0.06, 0.045, 0.035], "#cf7d83", [0, 0.09, 0.2], 0);
    this.head.box([0.018, 0.04, 0.015], "#71453d", [0, 0.05, 0.225], 0);
    for (const x of [-0.09, 0, 0.09]) this.head.box([0.035, 0.07, 0.04], stripe, [x, 0.235, 0.135], 0);
    this.tail = m.part([0.21, 0.12, -0.2]);
    this.tail.box([0.09, 0.13, 0.3], fur, [0.1, 0, -0.03], 0);
    this.tail.box([0.09, 0.3, 0.09], fur, [0.1, 0.08, -0.14], 0);
    this.tail.box([0.16, 0.09, 0.09], stripe, [0.065, 0.33, -0.14], 0);
    // Bake each rigid part separately; head and tail retain their animation pivots.
    mergeStill(this.head);
    mergeStill(this.tail);
    mergeStill(m, (mesh) => mesh.parent !== m);
  }

  update(now: number, petted: boolean, calm: boolean): void {
    this.head.rotation.z = petted ? -0.16 : 0;
    this.tail.rotation.z = calm ? 0 : Math.sin(now / (petted ? 160 : 850)) * (petted ? 0.18 : 0.07);
  }
}

export class TownPigeon {
  readonly root = liveModel();
  private readonly head: Model;
  private readonly wings: Model[] = [];

  constructor() {
    const m = this.root;
    m.name = "town-pigeon";
    for (const x of [-0.065, 0.065]) m.box([0.065, 0.04, 0.13], "#cf8a83", [x, 0, 0.065], 0);
    m.box([0.25, 0.19, 0.32], "#8897a4", [0, 0.05, 0], 0);
    m.box([0.15, 0.045, 0.22], "#505d70", [0, 0.1, -0.2], 0);
    this.head = m.part([0, 0.19, 0.1]);
    this.head.box([0.13, 0.1, 0.13], "#63978d", [0, 0, 0], 0);
    this.head.box([0.17, 0.15, 0.17], "#738394", [0, 0.065, 0.02], 0);
    this.head.box([0.065, 0.035, 0.1], "#d5b274", [0, 0.09, 0.13], 0);
    for (const side of [-1, 1]) {
      this.head.box([0.012, 0.03, 0.03], "#202936", [side * 0.087, 0.14, 0.065], 0);
      const wing = m.part([side * 0.12, 0.24, -0.01]);
      wing.name = side < 0 ? "left-wing" : "right-wing";
      wing.box([0.26, 0.055, 0.25], "#a9b5bf", [side * 0.11, -0.03, -0.025], 0);
      for (const z of [-0.09, -0.015]) wing.box([0.19, 0.012, 0.035], "#536174", [side * 0.13, 0.026, z], 0);
      mergeStill(wing);
      this.wings.push(wing);
    }
    mergeStill(this.head);
    mergeStill(m, (mesh) => mesh.parent !== m);
  }

  update(pose: PigeonPose, index: number, calm: boolean): void {
    const flying = pose.lift > 0.001;
    const direction = index % 2 ? 1 : -1;
    const idleYaw = -0.35 + index * 0.5;
    const flightYaw = Math.atan2(direction * 0.7, 0.2) + (pose.returning ? Math.PI : 0);
    const turn = Math.atan2(Math.sin(flightYaw - idleYaw), Math.cos(flightYaw - idleYaw));
    this.root.rotation.y = idleYaw + turn * Math.min(1, pose.lift * 5);
    this.head.rotation.x = flying || calm ? 0 : pose.peck * 0.55;
    for (let i = 0; i < this.wings.length; i++) {
      const side = i === 0 ? -1 : 1;
      // Fold against the body on the ground; both wings lift from their shoulders.
      this.wings[i]!.rotation.z = side * ((calm ? pose.lift : pose.wing) * 2 - 1.25);
    }
  }
}
