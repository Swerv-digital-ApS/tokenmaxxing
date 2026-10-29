import type { BoardRow } from "@tokenmaxxing/core/games/types.ts";
import type { WorldGame } from "@tokenmaxxing/core/world.ts";

/**
 * The town's games as the 3D renderer draws them: pure rules over the world's `WorldGame`s (where their tables and
 * arena desks are, how the players sit, what the scoreboard says), the same data the 2D game draws from (`game/games.ts`).
 */

/** The pose of someone at a game: sitting on a stool at a table, typing at an arena desk; null for anyone not in one. */
export function seatPose(game: Pick<WorldGame, "spot"> | undefined, racing: boolean): "sit" | "type" | null {
  if (!game || racing) return null;
  return game.spot.kind === "arena" ? "type" : "sit";
}

/** How high a stool's top is: the sitter's hips go there. */
export const STOOL_Y = 0.36;

/** The tile a table stands on (the middle of its 3x3 patch) or an arena's desk row: where the props go. */
export function propTilesOf(spot: WorldGame["spot"]): [number, number][] {
  if (spot.kind === "table") return [[spot.x + 1, spot.y + 1]];
  return Array.from({ length: spot.w }, (_, i) => [spot.x + i, spot.y] as [number, number]);
}

/** How lit an arena desk's screen is, 0 to 3: the leader's blazes, the others flicker faster the higher they rank. */
export function arenaGlow(place: number, now: number): number {
  if (place === 0) return 3;
  const speed = 120 + place * 90;
  return Math.floor(now / speed) % 2 === 0 ? 2 : 1;
}

/** Where each player stands in the ranking (0 first), by the board's order; players not on it rank last. */
export function rankOf(board: readonly BoardRow[] | null, player: number): number {
  const rows = board ?? [];
  const at = rows.findIndex((r) => r.player === player);
  return at < 0 ? rows.length : at;
}

export interface ScoreLine {
  name: string;
  /** What the row's bar shows, 0 to 1. */
  share: number;
  label: string;
  leader: boolean;
}

/** The arena scoreboard's rows: the bar of each against the best (at least a sliver), names from `names`. */
export function scoreLines(
  board: readonly BoardRow[] | null,
  names: ReadonlyMap<number, string>,
  compact: (n: number) => string,
): ScoreLine[] {
  const rows = board ?? [];
  const top = rows[0]?.value || 1;
  return rows.map((r, i) => ({
    name: names.get(r.player) ?? "?",
    share: Math.max(0.02, r.value / top),
    label: r.label || compact(r.value),
    leader: i === 0,
  }));
}

/** The chequered strip across a race's lanes, in tiles: its x, and the top and bottom of the lanes it spans. */
export function startLineSpan(
  plazaLeft: number,
  plazaRight: number,
  plazaTop: number,
  lanes: readonly number[],
): { x: number; y0: number; y1: number } | null {
  if (!lanes.length) return null;
  return {
    x: (plazaLeft + plazaRight) / 2 + 13 / 16,
    y0: plazaTop + Math.min(...lanes) + 6 / 16,
    y1: plazaTop + Math.max(...lanes) + 1,
  };
}
