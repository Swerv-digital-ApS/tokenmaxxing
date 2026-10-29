import { GRAVES, type Stone, signOf } from "@tokenmaxxing/core/graveyard.ts";
import { providerOf } from "@tokenmaxxing/core/launch.ts";
import * as THREE from "three";
import { currentStones, readStones, SIGN_AT } from "../../game/graveyard.ts";
import { hud } from "../../store.ts";
import { disposeObject } from "../engine/dispose.ts";
import { mergeStill } from "../engine/merge3d.ts";
import type { Sign } from "../rooms/rooms.ts";
import { tombstoneModel } from "./fx3d-town.ts";

/** The stones are looked at this often: they change a few times a month. */
const CHECK_MS = 1000;

/**
 * The model graveyard in the 3D town (2D: `game/graveyard.ts`): a tombstone on each plot that has one,
 * built again only when the stones change, with the graveyard's sign over it and each stone's name over
 * the stone (click one for its epitaph, as E in front of it does).
 */
export class Graveyard3D {
  readonly group = new THREE.Group();
  private stones: Stone[] = [];
  private key = "";
  private checkedAt = -Infinity;

  constructor(private readonly toWorld: (tx: number, ty: number) => [number, number]) {
    this.group.name = "graveyard";
    // Built after the town is batched, and built again as stones come: the batching leaves it alone.
    this.group.userData.live = true;
    this.group.userData.nobatch = true;
  }

  update(now: number): void {
    readStones();
    if (now - this.checkedAt < CHECK_MS) return;
    this.checkedAt = now;
    const stones = currentStones();
    const key = stones.map((s) => `${s.id}@${s.plot}`).join("|");
    if (key === this.key) return;
    this.key = key;
    this.stones = stones;
    for (const old of [...this.group.children]) {
      this.group.remove(old);
      disposeObject(old);
    }
    for (const s of stones) {
      const [x, z] = this.toWorld(...GRAVES[s.plot]!);
      const model = tombstoneModel(providerOf(s.provider).accent);
      // A little askew, each its own way: an old graveyard.
      model.rotation.y = (((s.plot * 7) % 5) - 2) * 0.04;
      model.position.set(x, 0, z);
      mergeStill(model);
      this.group.add(model);
    }
  }

  signs(): Sign[] {
    if (this.stones.length === 0) return [];
    const [sx, sz] = this.toWorld(SIGN_AT.x - 0.5, SIGN_AT.y);
    return [
      { key: "graveyard", at: [sx, 1.4, sz], kind: "label", text: signOf(this.stones) },
      ...this.stones.map((s): Sign => {
        const [x, z] = this.toWorld(...GRAVES[s.plot]!);
        return {
          key: `grave:${s.plot}`,
          at: [x, 0.8, z],
          kind: "label",
          text: s.model,
          onClick: () => hud.set({ panel: { kind: "tombstone", id: s.id } }),
        };
      }),
    ];
  }

  dispose(): void {
    disposeObject(this.group);
  }
}
