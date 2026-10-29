import { MUSICIANS } from "@tokenmaxxing/core/tavern-band.ts";
import * as THREE from "three";
import { bandPlaying, currentBandSet } from "../../game/tavern-performance.ts";
import { mergeStill } from "../engine/merge3d.ts";
import { Model } from "../kit/kit.ts";
import { Avatar, personLook } from "../people/avatar.ts";
import type { LiveFrame } from "./rooms.ts";

export class TavernBand {
  readonly group = new THREE.Group();
  private readonly players: Avatar[] = [];
  constructor() {
    this.group.name = "tavern-band";
    this.group.visible = currentBandSet() !== null;
    this.group.userData.nobatch = true;
    for (const [i, m] of MUSICIANS.entries()) {
      const a = new Avatar(
        personLook({
          skin: i ? "#c58d68" : "#f0c49c",
          hair: i ? "#754b34" : "#d5ac6c",
          style: i ? 2 : 0,
          outfit: i ? ["#87465e", "#5d3044"] : ["#557b56", "#34563d"],
          pants: "#514033",
          hat: "none",
          top: "cardigan",
        }),
        "voxel",
      );
      a.root.name = `musician-${m.instrument}`;
      // The hand-built room starts at map (1,2); the band stands on its raised stage.
      a.root.position.set(m.x - 0.5, 0.14, m.y - 1.5);
      a.root.rotation.y = Math.PI / 2;
      a.root.scale.setScalar(0.85);
      a.pose = "dj";
      const instrument = new Model();
      if (m.instrument === "lute") {
        instrument.ball(0.23, "#d69e56", [0, 0, 0], [1, 1.2, 0.45]);
        instrument.ball(0.075, "#503726", [0, 0.025, 0.11], [1, 1, 0.25]);
        instrument.box([0.065, 0.55, 0.07], "#815b37", [0.06, 0.15, 0]);
        for (const x of [-0.035, 0, 0.035])
          instrument.box([0.007, 0.52, 0.01], "#fff0ca", [x + 0.04, -0.04, 0.12], 0);
        instrument.rotation.z = -0.5;
        instrument.scale.setScalar(0.65);
        instrument.position.set(0.02, 0.48, 0.2);
      } else {
        instrument.box([0.5, 0.045, 0.045], "#e9cb83", [0.1, 0.84, 0.2]);
        for (const x of [0, 0.1, 0.2, 0.3])
          instrument.box([0.018, 0.012, 0.018], "#6c4d32", [x, 0.885, 0.2], 0);
      }
      mergeStill(instrument);
      a.body.add(instrument);
      this.players.push(a);
      this.group.add(a.root);
    }
  }
  update(f: LiveFrame): void {
    this.group.visible = currentBandSet() !== null;
    if (!this.group.visible) return;
    const playing = bandPlaying() && !f.calm;
    for (const [i, a] of this.players.entries()) {
      a.update(f.dt, f.t);
      a.body.rotation.z = playing ? Math.sin(f.t * 2.5 + i) * 0.035 : 0;
      if (i === 0) {
        a.arms[0].rotation.set(-0.8, 0, -0.2);
        a.arms[1].rotation.set(-0.8 + (playing ? Math.sin(f.t * 17) * 0.18 : 0), 0, 0.35);
      } else {
        a.arms[0].rotation.set(-1.15, 0, -0.3);
        a.arms[1].rotation.set(-1.15, 0, 0.4);
      }
    }
  }
  dispose(): void {
    for (const player of this.players) player.dispose();
  }
}
