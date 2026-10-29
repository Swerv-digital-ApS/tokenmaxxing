import { isTavernRoom } from "@tokenmaxxing/core/tavern.ts";
import type { TavernRow } from "./town/card.ts";

/** A player counts as a visit again after this long out of the Tavern. */
export const VISIT_GAP_MS = 10 * 60_000;

/** The bits of a world player that decide whether a minute counts. */
interface Presence {
  room: string;
  dozing?: boolean;
  state: string;
}

/**
 * Whether this player's minute counts for the plaques: connected (the caller checks), in the Tavern or
 * its basement, awake, and on their feet or seated: not asleep or resting at a desk.
 */
export const counts = (p: Presence): boolean =>
  isTavernRoom(p.room) && !p.dozing && p.state !== "away" && p.state !== "working";

/**
 * Minutes in the Tavern since the last flush, in memory: `world` ticks it once a minute and flushes it
 * to `town` every few minutes in one call. A restart loses at most one flush's worth.
 */
export class TavernClock {
  private minutes = new Map<number, number>();
  private visits = new Map<number, number>();
  private last = new Map<number, number>();

  /** A minute passes with `present` in the Tavern at `now`. */
  tick(present: Iterable<number>, now: number): void {
    for (const id of present) {
      this.minutes.set(id, (this.minutes.get(id) ?? 0) + 1);
      const before = this.last.get(id);
      if (before === undefined || now - before >= VISIT_GAP_MS)
        this.visits.set(id, (this.visits.get(id) ?? 0) + 1);
      this.last.set(id, now);
    }
    // Only the recent matter for the gap.
    if (this.last.size > 500)
      for (const [id, at] of this.last) if (now - at >= VISIT_GAP_MS) this.last.delete(id);
  }

  /** Everything counted so far, and starts again from nothing. */
  take(): TavernRow[] {
    const rows = [...this.minutes].map(([id, m]): TavernRow => [id, m, this.visits.get(id) ?? 0]);
    this.minutes.clear();
    this.visits.clear();
    return rows;
  }

  /** Puts rows back after a failed flush, so the next one carries them. */
  restore(rows: readonly TavernRow[]): void {
    for (const [id, m, v] of rows) {
      this.minutes.set(id, (this.minutes.get(id) ?? 0) + m);
      this.visits.set(id, (this.visits.get(id) ?? 0) + v);
    }
  }
}
