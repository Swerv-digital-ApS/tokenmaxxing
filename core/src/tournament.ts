import { GAMES } from "./games/index.ts";
import type { GameId } from "./games/types.ts";

/**
 * The basement's tournament board: a small single-elimination bracket for one arcade game. The board only
 * keeps the bracket; matches are played the usual way (a table in the arcade lobby, played in the town
 * square), and when one ends the arcade reports its two players and who won. No coins, no edge, no prize
 * but the name on the board and a title in chat.
 */

export const SIZES = [4, 8] as const;
export type Size = (typeof SIZES)[number];

/** Starts when full, or this long after it opened with at least `MIN_PLAYERS` signed up (byes fill the rest). */
export const WAIT_MS = 5 * 60_000;
export const MIN_PLAYERS = 4;
/** A bracket nobody has moved in this long is called off. */
export const IDLE_MS = 2 * 3_600_000;

/** One match in the bracket: head to head, so games that seat two. Tokenmaxxing is a day long; not here. */
export const TOURNAMENT_GAMES: GameId[] = (["spr", "hype", "dice", "sprint"] as const).filter(
  (g) => (GAMES[g]?.players.min ?? 9) <= 2 && (GAMES[g]?.players.max ?? 0) >= 2,
);

export interface Pairing {
  a: number | null;
  b: number | null;
  winner: number | null;
}
/** Rounds, first to last (the last has one match). */
export type Bracket = Pairing[][];

export interface TournamentState {
  size: Size;
  players: number[];
  createdAt: number;
}

export const isSize = (n: unknown): n is Size => n === 4 || n === 8;
export const isTournamentGame = (g: unknown): g is GameId => TOURNAMENT_GAMES.includes(g as GameId);

/** Whether an open board should start now. */
export const startDue = (t: TournamentState, now: number): boolean =>
  t.players.length >= t.size || (t.players.length >= MIN_PLAYERS && now - t.createdAt >= WAIT_MS);

/** When an open board with enough players starts on its own, or null while it's short of them. */
export const startsAt = (t: TournamentState): number | null =>
  t.players.length >= MIN_PLAYERS ? t.createdAt + WAIT_MS : null;

/** The same order for the same seed (mulberry32). */
export function shuffle<T>(items: readonly T[], seed: number): T[] {
  const out = [...items];
  let s = seed >>> 0;
  const next = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 2 ** 32;
  };
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

/**
 * A shuffled bracket for 4 to 8 players: four of them or fewer play in a bracket of four, more in eight.
 * ponytail: seats beyond the signed-up players are byes, spread so no one gets two; random, not ranked.
 */
export function makeBracket(players: readonly number[], seed: number): Bracket {
  const size: Size = players.length <= 4 ? 4 : 8;
  const order = shuffle(players, seed);
  const half = size / 2;
  const first: Pairing[] = Array.from({ length: half }, (_, i) => ({
    a: order[i] ?? null,
    b: order[i + half] ?? null,
    winner: null,
  }));
  const rounds: Bracket = [first];
  for (let n = half / 2; n >= 1; n /= 2)
    rounds.push(Array.from({ length: n }, () => ({ a: null, b: null, winner: null })));
  // A bye wins by showing up.
  first.forEach((m, i) => {
    if (m.a !== null && m.b === null) place(rounds, 0, i, m.a);
  });
  return rounds;
}

/** Records `winner` of match `i` in round `r`, and puts them in the next round's slot. Mutates. */
function place(rounds: Bracket, r: number, i: number, winner: number): void {
  rounds[r]![i]!.winner = winner;
  const next = rounds[r + 1]?.[i >> 1];
  if (next) next[i % 2 === 0 ? "a" : "b"] = winner;
}

/**
 * The bracket after `winner` beat the other of `a` and `b`, or null if they have no match waiting
 * (not in the bracket, already played, or `winner` isn't one of them).
 */
export function report(bracket: Bracket, a: number, b: number, winner: number): Bracket | null {
  if (winner !== a && winner !== b) return null;
  const rounds = structuredClone(bracket);
  for (const [r, round] of rounds.entries())
    for (const [i, m] of round.entries()) {
      if (m.winner !== null || m.a === null || m.b === null) continue;
      if ((m.a === a && m.b === b) || (m.a === b && m.b === a)) {
        place(rounds, r, i, winner);
        return rounds;
      }
    }
  return null;
}

/** Matches that can be played now: both players known, no winner. */
export const waiting = (bracket: Bracket): Pairing[] =>
  bracket.flat().filter((m) => m.a !== null && m.b !== null && m.winner === null);

/** The final's winner once it is played. */
export const champion = (bracket: Bracket): number | null => bracket.at(-1)?.[0]?.winner ?? null;

/** "Final", "Semifinal", then "Round 1"... */
export function roundName(rounds: number, r: number): string {
  const left = rounds - r;
  return left === 1 ? "Final" : left === 2 ? "Semifinal" : `Round ${r + 1}`;
}

/** What the board shows, with names filled in by the server. */
export interface TournamentView {
  id: number;
  game: GameId;
  size: Size;
  status: "open" | "running";
  host: number;
  players: { id: number; name: string }[];
  bracket: Bracket | null;
  /** When an open board starts by itself, if it has enough players. */
  startsAt: number | null;
}

export interface Champion {
  userId: number;
  name: string;
  game: GameId;
  at: number;
}

export interface TournamentBoard {
  current: TournamentView | null;
  /** Until the next tournament has its own. */
  champion: Champion | null;
}
