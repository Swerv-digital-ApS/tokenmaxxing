import { C } from "./palette.ts";
import type { Pet } from "./pet-base.ts";

/**
 * The pond treasures' pets (`core/src/fishing-loot.ts`, pet.600 and pet.601), 12×10 facing right with two frames,
 * like the cases' (`case-ragnarok-pets.ts`). `pet-base.ts` files them at `FISHING_BASE + n` in `PETS`.
 */

// Pixel art reads as a grid.
// prettier-ignore
export const FISHING_PETS: Pet[] = [
  // Axolotl: a pink salamander with three frilly red gill fronds fanning off the back of its head, a big smile, little legs and a finned tail. The fronds and the tail wave.
  {
    frames: [
      ["....R.R.R.R.", "....r.r.r.r.", "....r.ooooo.", "....ropppppo", "..oooopeppeo", ".opppppmppmo", "oppwwpppmmpo", ".opwwpooooo.", "..opo..opo..", "..ooo..ooo.."],
      ["...R.R.R.R..", "....r.r.r.r.", "....r.ooooo.", "....ropppppo", "..oooopeppeo", ".opppppmppmo", "oppwwpppmmpo", "oopwwpooooo.", "..opo..opo..", ".ooo...ooo.."],
    ],
    pal: { o: "#8a3a5a", p: "#ffb3cf", w: "#ffe6ef", r: "#e8527a", R: "#ff8fae", e: C.ink, m: "#c2395f" },
  },
  // Pocket kraken: a small purple kraken, a round head, big white eyes with dark pupils, a tiny grin, and curling tentacles with pale suckers.
  {
    frames: [
      ["...oooooo...", "..opPPpppo..", ".oppppppppo.", ".opwwppwwpo.", ".opwkppwkpo.", ".oppppkkppo.", "..oppppppo..", "..opoopoopo.", ".ooppoopoopo", "oo.op.op..oo"],
      ["...oooooo...", "..opPPpppo..", ".oppppppppo.", ".opwwppwwpo.", ".opwkppwkpo.", ".oppppkkppo.", "..oppppppo..", "..opoopoopo.", "oopoopoopoo.", ".o.op.op.oo."],
    ],
    pal: { o: "#3b2a66", p: "#9b6fd6", P: "#c3a0f0", w: "#ffffff", k: "#14101f" },
  },
];
