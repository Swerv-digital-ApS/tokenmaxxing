/**
 * Hype Cycle: the valuation climbs until it crashes; cash out before it does.
 * Three rounds, the highest total wins. Each round's crash point comes from a
 * seed whose hash everyone sees before the round and whose seed everyone sees
 * after, so nobody (not even the server) can move it mid-round.
 */
import { clamp, recordFromKeys, sumBy } from "hanzio";
import { random } from "./random.ts";
import { sha256 } from "./sha256.ts";
import { byScore, type GameDef, lastStanding, leave, leavers, refused } from "./types.ts";

const ROUNDS = 3;
/** The countdown before each round. */
export const COUNTDOWN_MS = 3_000;
/** The crash stays on screen this long before the next countdown. */
const AFTER_MS = 3_000;
const MAX_CRASH = 50;

/** The multiplier `ms` into a round: ×2 after about 8 seconds, ×10 after 28. */
export const multiplier = (ms: number) => Math.exp(Math.max(0, ms) / 12_000);
/** How long a round runs before it reaches `m`. */
export const msToReach = (m: number) => 12_000 * Math.log(m);

/** The crash point for a round's seed, in hundredths: max(1, 0.99 / (1 − u)), capped at ×50. */
export function crashPoint(seed: string): number {
  const u = Number.parseInt(sha256(`crash:${seed}`).slice(0, 13), 16) / 16 ** 13;
  return Math.floor(clamp(0.99 / (1 - u), 1, MAX_CRASH) * 100);
}

interface HypeRound {
  seed: string;
  hash: string;
  /** Hundredths: 341 is ×3.41. */
  crash: number;
  startsAt: number;
  /** When it crashed (or everyone had cashed out); null while it runs. */
  endedAt: number | null;
  /** Who cashed out, at what (in hundredths). */
  cashed: Record<number, number>;
}

export interface HypeState {
  players: number[];
  rounds: HypeRound[];
  forfeited: number[];
}

export interface HypeView {
  players: number[];
  /** Past rounds with their seed and crash; the current one without; later ones not at all. */
  rounds: (Omit<HypeRound, "seed" | "crash"> & { seed: string | null; crash: number | null })[];
  totals: Record<number, number>;
  forfeited: number[];
}

const current = (s: HypeState) => s.rounds.findIndex((r) => r.endedAt === null);
const active = (s: HypeState) => s.players.filter((p) => !s.forfeited.includes(p));

const totals = (s: HypeState) =>
  recordFromKeys(s.players, (p) => sumBy(s.rounds, (r) => (r.endedAt !== null ? r.cashed[p] : 0)));

/** Ends round `i` at `now` and schedules the next one. */
function end(s: HypeState, i: number, now: number): HypeState {
  const rounds = s.rounds.map((r, j) =>
    j === i ? { ...r, endedAt: now } : j === i + 1 ? { ...r, startsAt: now + AFTER_MS + COUNTDOWN_MS } : r,
  );
  return { ...s, rounds };
}

export const hype: GameDef<HypeState, HypeView> = {
  id: "hype",
  name: "Hype Cycle",
  emoji: "📈",
  blurb: "The valuation climbs until it crashes. Cash out in time.",
  players: { min: 2, max: 8 },
  tickMs: 50,

  setup(players, seed, _options, now) {
    const rng = random(seed);
    const rounds = Array.from({ length: ROUNDS }, (_, i) => {
      const roundSeed = Array.from({ length: 4 }, () =>
        Math.floor(rng() * 2 ** 32)
          .toString(16)
          .padStart(8, "0"),
      ).join("");
      return {
        seed: roundSeed,
        hash: sha256(roundSeed),
        crash: crashPoint(roundSeed),
        // Only the first start is known; each next one is set when the one before ends.
        startsAt: i === 0 ? now + COUNTDOWN_MS : Number.MAX_SAFE_INTEGER,
        endedAt: null,
        cashed: {},
      };
    });
    return { players, rounds, forfeited: [] };
  },

  move(s, player, move, now) {
    if ((move as { cashOut?: unknown } | null)?.cashOut !== true) return refused("Cash out, or hold on.");
    const i = current(s);
    const r = s.rounds[i];
    if (!r || now < r.startsAt) return refused("The round hasn't started.");
    if (r.cashed[player] !== undefined) return refused("You've cashed out this round.");
    // It counts at the moment it arrives; after the crash point, it's too late.
    const at = Math.floor(multiplier(now - r.startsAt) * 100);
    if (at >= r.crash) return refused("💥 Too late: it crashed.");
    const next = {
      ...s,
      rounds: s.rounds.map((x, j) => (j === i ? { ...x, cashed: { ...x.cashed, [player]: at } } : x)),
    };
    // Everyone's out: no point watching the line climb alone.
    return active(next).every((p) => next.rounds[i]!.cashed[p] !== undefined) ? end(next, i, now) : next;
  },

  tick(s, now) {
    const i = current(s);
    const r = s.rounds[i];
    if (!r || hype.outcome(s)) return s;
    return now >= r.startsAt + msToReach(r.crash / 100) ? end(s, i, now) : s;
  },

  forfeit: leave,

  view(s) {
    const i = current(s);
    return {
      players: s.players,
      rounds: s.rounds
        .filter((_, j) => i === -1 || j <= i)
        .map((r) => (r.endedAt !== null ? r : { ...r, seed: null, crash: null })),
      totals: totals(s),
      forfeited: s.forfeited,
    };
  },

  outcome(s) {
    const left = active(s);
    const over = lastStanding(left, s.forfeited);
    if (over) return over;
    if (current(s) !== -1) return null;
    const t = totals(s);
    if (left.every((p) => t[p] === 0)) return { void: "Everyone crashed in every round." };
    return { places: [...byScore(left, (p) => t[p]!), ...leavers(s.forfeited)] };
  },

  betsCloseAt: (s) => s.rounds[0]!.startsAt + 10_000,

  callouts(before, after) {
    const out: { player: number | null; text: string }[] = [];
    for (const [i, r] of after.rounds.entries()) {
      const was = before.rounds[i]!;
      for (const [p, at] of Object.entries(r.cashed))
        if (was.cashed[Number(p)] === undefined)
          out.push({ player: Number(p), text: `🪂 ×${(at / 100).toFixed(2)}` });
      if (was.endedAt === null && r.endedAt !== null && Object.keys(r.cashed).length < active(after).length)
        out.push({ player: null, text: `💥 Crashed at ×${(r.crash / 100).toFixed(2)}` });
    }
    return out;
  },

  // Reported on changes only, so no live multiplier here: the players' 🪂 say how it's going.
  headline(s) {
    const i = current(s);
    return i === -1 ? "Over" : `Round ${i + 1}/${ROUNDS}`;
  },

  status(s, player) {
    const r = s.rounds[current(s)];
    const at = r?.cashed[player];
    return at === undefined ? null : `🪂 ×${(at / 100).toFixed(2)}`;
  },
};
