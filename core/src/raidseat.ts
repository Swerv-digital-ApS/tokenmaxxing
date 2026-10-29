import type { PlayerState } from "./world.ts";

/**
 * Taking your own seat in the Raid Dungeon: the pure rules. The dungeon seats everyone with agents running at a
 * war desk (`web/src/game/raid.ts`, `seatFor`); the seat `r` is the tile you'd stand on and the desk `l` is the
 * tile north of it. E on your own clone (its seat tile) or its laptop (the desk) sits you there.
 */

/** Whether the tile (`x`, `y`) is `seat`'s seat or its desk: what E has to be facing to take that seat. */
export function ownSeatAt(seat: readonly [number, number] | null, x: number, y: number): boolean {
  return seat !== null && x === seat[0] && (y === seat[1] || y === seat[1] - 1);
}

/**
 * Whether someone may take their seat: in the dungeon, with a seat of their own (someone else's is never theirs to
 * take, and without one, nothing is offered), and standing about, not asleep or at a game.
 */
export function canSit(room: string, seat: readonly [number, number] | null, state: PlayerState): boolean {
  return room === "dungeon" && seat !== null && state === "idle";
}
