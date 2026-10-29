import { effectiveDesk } from "@tokenmaxxing/core/desks.ts";
import type { GameMap } from "@tokenmaxxing/core/maps.ts";
import { companyOfRoom } from "@tokenmaxxing/core/world.ts";
import { world } from "../../game/world.ts";
import { disposeObject } from "../engine/dispose.ts";
import { fleetDesk } from "./hq3d.ts";
import type { Placed } from "./room.ts";

/** How often the desks look at who sits at them (ms): a sitter's screens change in a blink, not a frame. */
const EVERY = 250;

/**
 * The screens on a room's desks, as the 2D game has them: whoever sits at a desk (on the chair below it) brings the
 * setup they chose, never less than the house's fleet tier; an empty desk shows the fleet's. The desks are kept out
 * of the room's static batches (`live`) so their models can change.
 */
export class DeskSetups {
  private readonly desks: { x: number; y: number; model: Placed["model"]; tier: number; seed: number }[] = [];
  private at = -Infinity;

  /** `inset` is what a room tile's (x, z) adds to be the map tile's: (1, 2) in a house, (1, 1) in an office. */
  constructor(
    private readonly map: GameMap,
    placed: readonly Placed[],
    inset: readonly [number, number],
  ) {
    let seed = 3;
    for (const p of placed) {
      if (p.asset.id !== "desk" && p.asset.id !== "office-desk") continue;
      p.model.userData.live = true;
      this.desks.push({ x: p.x + inset[0], y: p.z + inset[1], model: p.model, tier: -1, seed: seed++ });
    }
  }

  update(nowMs: number): void {
    if (!this.desks.length || nowMs - this.at < EVERY) return;
    this.at = nowMs;
    const fleet = world.companies.get(companyOfRoom(world.room) ?? -1)?.deskFleet;
    const seated = new Map<number, number | undefined>();
    for (const a of world.avatars.values())
      if (a.state === "working" || a.state === "sit") seated.set(this.map.index(a.x, a.y), a.info.desk);
    for (const d of this.desks) {
      const chair = this.map.at(d.x, d.y + 1) === "c" ? this.map.index(d.x, d.y + 1) : -1;
      const tier = effectiveDesk(chair < 0 ? undefined : seated.get(chair), fleet);
      if (tier === d.tier) continue;
      d.tier = tier;
      const next = fleetDesk(tier, d.seed);
      for (const c of [...d.model.children]) {
        d.model.remove(c);
        disposeObject(c);
      }
      for (const c of [...next.children]) d.model.add(c);
    }
  }
}
