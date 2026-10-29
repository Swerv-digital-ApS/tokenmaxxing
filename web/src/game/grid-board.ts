import { PRICE_LAMP, priceSign } from "@tokenmaxxing/core/grid.ts";
import { TILE } from "@tokenmaxxing/core/world.ts";
import type { Frame } from "./frame.ts";
import { currentGrid, PRICE_TONES } from "./grid.ts";
import { nearPill } from "./labels.ts";
import { world } from "./world.ts";

/**
 * The price board on the square's north-east lamp post (`core/src/grid.ts`), hung at its foot: over its head
 * it would be in the top row of the map, under the HUD. Town only.
 */
export function drawGrid({ g, labels, toScreen, dpr }: Frame): void {
  if (world.room !== "town") return;
  const sign = priceSign(currentGrid());
  const [sx, sy] = toScreen(PRICE_LAMP.x * TILE + TILE / 2, (PRICE_LAMP.y + 1) * TILE + 4);
  labels.push(() => nearPill(g, sx, sy, sign.text, dpr, PRICE_TONES[sign.tone], "#fbf7ef"));
}
