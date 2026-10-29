/**
 * New Year's Eve: at midnight in Copenhagen, ten minutes of fireworks over the square (`fireworks.ts`), the
 * same rockets for everyone. Clock only.
 */
import type { Fireworks } from "./fireworks.ts";
import { worldWall } from "./range.ts";
import { copenhagenToMs } from "./sky.ts";

export const NEW_YEAR_MS = 10 * 60_000;

/** The show for the New Year nearest `ms` (from December, the coming one). */
export function newYearShow(ms: number): Fireworks {
  const { y, m } = worldWall(ms);
  const year = m === 12 ? y + 1 : y;
  const at = copenhagenToMs(`${year}-01-01T00:00`)!;
  return { at, ms: NEW_YEAR_MS, x: 10, y: 4.5, w: 9, h: 3, seed: year };
}
