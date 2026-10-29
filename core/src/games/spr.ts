/**
 * Ship, Pivot, Raise: rock-paper-scissors for founders. Best of 5, both pick in
 * secret, and the other pick is hidden until both have picked.
 */
import { recordFromKeys } from "hanzio";
import { type GameDef, refused } from "./types.ts";

export type Pick = "ship" | "pivot" | "raise";
export const PICKS: Record<Pick, { emoji: string; beats: Pick; why: string }> = {
  ship: { emoji: "🚢", beats: "raise", why: "traction beats a deck" },
  raise: { emoji: "💰", beats: "pivot", why: "money buys time" },
  pivot: { emoji: "🔀", beats: "ship", why: "the market moved" },
};
const isPick = (v: unknown): v is Pick => typeof v === "string" && v in PICKS;

export const PICK_MS = 15_000;
export const REVEAL_MS = 2_000;
const TO_WIN = 3;
/** Draws replay the round; this many rounds and the leader wins, or it's a tie. */
const MAX_ROUNDS = 9;

interface Round {
  picks: Record<number, Pick | null>;
  /** Null: a draw (same pick, or neither picked in time). */
  winner: number | null;
}

export interface SprState {
  players: [number, number];
  picks: Record<number, Pick | null>;
  /** When the current picks close. */
  deadline: number;
  /** While set, the last round is on show and nobody picks. */
  revealUntil: number | null;
  rounds: Round[];
  forfeited: number | null;
  startedAt: number;
}

export interface SprView {
  players: [number, number];
  wins: Record<number, number>;
  /** Mine, when I'm playing; the other's stays secret. */
  mine: Pick | null;
  picked: Record<number, boolean>;
  deadline: number;
  revealUntil: number | null;
  rounds: Round[];
}

const winsOf = (s: SprState) => {
  const w: Record<number, number> = { [s.players[0]]: 0, [s.players[1]]: 0 };
  for (const r of s.rounds) if (r.winner !== null) w[r.winner]!++;
  return w;
};

function resolve(s: SprState, now: number): SprState {
  const [a, b] = s.players;
  const pa = s.picks[a] ?? null;
  const pb = s.picks[b] ?? null;
  const winner = pa && pb ? (pa === pb ? null : PICKS[pa].beats === pb ? a : b) : pa ? a : pb ? b : null;
  return {
    ...s,
    rounds: [...s.rounds, { picks: { [a]: pa, [b]: pb }, winner }],
    picks: { [a]: null, [b]: null },
    revealUntil: now + REVEAL_MS,
    deadline: now + REVEAL_MS + PICK_MS,
  };
}

export const spr: GameDef<SprState, SprView> = {
  id: "spr",
  name: "Ship, Pivot, Raise",
  emoji: "🚢",
  blurb: "Rock-paper-scissors for founders. Best of 5.",
  players: { min: 2, max: 2 },
  tickMs: 250,

  setup: (players, _seed, _options, now) => ({
    players: [players[0]!, players[1]!],
    picks: { [players[0]!]: null, [players[1]!]: null },
    deadline: now + PICK_MS,
    revealUntil: null,
    rounds: [],
    forfeited: null,
    startedAt: now,
  }),

  move(s, player, move, now) {
    const pick = (move as { pick?: unknown } | null)?.pick;
    if (!isPick(pick)) return refused("Pick ship, pivot or raise.");
    if (s.revealUntil !== null && now < s.revealUntil) return refused("Wait for the next round.");
    if (s.picks[player]) return refused("You've picked this round.");
    const next = { ...s, revealUntil: null, picks: { ...s.picks, [player]: pick } };
    return next.players.every((p) => next.picks[p]) ? resolve(next, now) : next;
  },

  tick(s, now) {
    if (spr.outcome(s)) return s;
    if (s.revealUntil !== null) return now >= s.revealUntil ? { ...s, revealUntil: null } : s;
    // Time's up: whoever picked wins the round; nobody picking is a draw.
    return now >= s.deadline ? resolve(s, now) : s;
  },

  // The first to leave loses.
  forfeit: (s, player) => (s.forfeited === null ? { ...s, forfeited: player } : s),

  view(s, viewer, now) {
    const revealing = s.revealUntil !== null && now < s.revealUntil;
    return {
      players: s.players,
      wins: winsOf(s),
      mine: viewer !== null && s.players.includes(viewer) ? (s.picks[viewer] ?? null) : null,
      picked: recordFromKeys(s.players, (p) => Boolean(s.picks[p])),
      deadline: s.deadline,
      revealUntil: revealing ? s.revealUntil : null,
      rounds: s.rounds,
    };
  },

  outcome(s) {
    const [a, b] = s.players;
    if (s.forfeited !== null) {
      const other = s.forfeited === a ? b : a;
      return { places: [[other], [s.forfeited]] };
    }
    const w = winsOf(s);
    if (w[a]! >= TO_WIN) return { places: [[a], [b]] };
    if (w[b]! >= TO_WIN) return { places: [[b], [a]] };
    if (s.rounds.length >= MAX_ROUNDS)
      return w[a] === w[b]
        ? { places: [[a, b]] }
        : w[a]! > w[b]!
          ? { places: [[a], [b]] }
          : { places: [[b], [a]] };
    return null;
  },

  betsCloseAt: (s) => s.startedAt + 10_000,

  callouts(before, after) {
    if (after.rounds.length === before.rounds.length) return [];
    const r = after.rounds.at(-1)!;
    if (r.winner === null) return [{ player: null, text: "🤝 Draw" }];
    const mine = r.picks[r.winner]!;
    const theirs = r.picks[after.players.find((p) => p !== r.winner)!];
    return [
      {
        player: r.winner,
        text: theirs
          ? `${PICKS[mine].emoji} ${cap(mine)} beats ${cap(theirs)}!`
          : `${PICKS[mine].emoji} ${cap(mine)}, and they didn't pick`,
      },
    ];
  },

  headline(s) {
    const w = winsOf(s);
    return `Round ${s.rounds.length + 1} · ${w[s.players[0]]}–${w[s.players[1]]}`;
  },

  status(s, player) {
    return `${"★".repeat(winsOf(s)[player] ?? 0)}${s.picks[player] ? " ✓" : ""}`.trim() || null;
  },
};

const cap = (p: Pick) => p[0]!.toUpperCase() + p.slice(1);
