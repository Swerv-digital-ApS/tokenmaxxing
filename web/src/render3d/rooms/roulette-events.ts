import { hud } from "../../store.ts";
import type { LiveFrame } from "./rooms.ts";
import type { RouletteModel } from "./roulette3d.ts";

/**
 * The net cafe's roulette table, live: the wheel and ball play each spin the server rolled (`hud.roulette`),
 * the landed number and the last pockets show over the table, and a chip stack and a glow mark each seated spot.
 */
export class RouletteEvents {
  constructor(private readonly table: RouletteModel | null) {}

  update(f: LiveFrame): void {
    this.table?.show(hud.get().roulette, Date.now(), Math.min(f.dt, 0.1));
  }

  dispose(): void {}
}
