import { loopMs, TRACK_MS, TUNES } from "./tunes.ts";

/**
 * The Tavern's jukebox: one track at a time for the whole room, free and cosmetic. The rules live
 * here; the world actor keeps the state in memory and the web plays the tune (`web/src/game/jukebox.ts`).
 */

/** The shortest time between two tracks started by the same player. */
export const COOLDOWN_MS = 60_000;

/** The track that is playing: when it started, who put it on, and who voted to skip it. */
export interface Playing {
  track: string;
  startedAt: number;
  by: number;
  skips: number[];
}

/** The room's jukebox: nothing playing, or one track. */
export type Jukebox = Playing | null;

/** What a client is told: no clock of the server's, just how far in the track is. */
export interface JukeboxNow {
  track: string;
  by: number;
  byName: string;
  elapsed: number;
  ms: number;
  votes: number;
  need: number;
}

export const trackIds = (): string[] => TUNES.map((t) => t.id);

/** How long a track plays: its loop, repeated until it has run about `TRACK_MS`. */
export function trackMs(id: string): number {
  const tune = TUNES.find((t) => t.id === id);
  if (!tune) return 0;
  const one = loopMs(tune);
  return Math.ceil(TRACK_MS / one) * one;
}

/** Ms until `last` (when they started their last track) is more than `COOLDOWN_MS` ago. */
export const cooldownLeft = (last: number | undefined, now: number): number =>
  last === undefined ? 0 : Math.max(0, last + COOLDOWN_MS - now);

/** Whether the track has played to its end. */
export const isOver = (j: Playing, now: number): boolean => now >= j.startedAt + trackMs(j.track);

/** Skip votes it takes with `present` in the room: two, or the majority when that is fewer (a room of one or two). */
export const skipNeeded = (present: number): number => Math.min(2, Math.floor(present / 2) + 1);

export type Started = { ok: true; jukebox: Playing } | { ok: false; why: "unknown" | "busy" | "cooldown" };

/** `by` puts `track` on, if it exists, nothing else is playing and `by` has waited out their cooldown. */
export function start(j: Jukebox, track: string, by: number, last: number | undefined, now: number): Started {
  if (!TUNES.some((t) => t.id === track)) return { ok: false, why: "unknown" };
  if (j && !isOver(j, now)) return { ok: false, why: "busy" };
  if (cooldownLeft(last, now) > 0) return { ok: false, why: "cooldown" };
  return { ok: true, jukebox: { track, startedAt: now, by, skips: [] } };
}

/** Votes that count: those of players still in the room, once each. */
export const votesOf = (j: Playing, present: readonly number[]): number =>
  new Set(j.skips.filter((id) => present.includes(id))).size;

/** `userId` votes to skip. Only someone in the room can. */
export function voteSkip(j: Jukebox, userId: number, present: readonly number[]): Jukebox {
  if (!j || !present.includes(userId) || j.skips.includes(userId)) return j;
  return { ...j, skips: [...j.skips, userId] };
}

/**
 * The jukebox after time passes or people come and go: over, or skipped, is nothing; else the same.
 * ponytail: nothing queues; whoever is quickest after the last track ends picks the next.
 */
export function settle(j: Jukebox, present: readonly number[], now: number): Jukebox {
  if (!j || isOver(j, now)) return null;
  return present.length > 0 && votesOf(j, present) >= skipNeeded(present.length) ? null : j;
}

export function wire(j: Playing, byName: string, present: readonly number[], now: number): JukeboxNow {
  return {
    track: j.track,
    by: j.by,
    byName,
    elapsed: now - j.startedAt,
    ms: trackMs(j.track),
    votes: votesOf(j, present),
    need: skipNeeded(present.length),
  };
}
