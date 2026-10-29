/**
 * The contract every mini game follows. Rules are pure functions over plain JSON
 * state, so the server runs them, the client shares their types and helpers, and
 * tests need no server. Adding a game is one `GameDef` plus one React component.
 */
import { isRecord } from "hanzio";

export type GameId = "spr" | "hype" | "dice" | "sprint" | "tokenmaxxing";

/** The host's choices when opening a table, e.g. `{ minutes: 60 }`. */
export type Options = Record<string, string | number>;

/**
 * How a match ended: players ranked best first (players who tie share a group),
 * or void, which refunds every stake and side bet.
 */
export type Outcome = { places: number[][] } | { void: string };

export interface Callout {
  /** Who says it (a bubble over their head), or null for the table. */
  player: number | null;
  text: string;
}

/** One row of a live scoreboard over the players in the world (Tokenmaxxing's arena). */
export interface BoardRow {
  player: number;
  value: number;
  label: string;
}

/** A player's usage in a match's window. `flagged`: some minute went over the cap and was cut to it. */
export interface Usage {
  tokens: number;
  flagged: boolean;
}

export interface GameDef<State = unknown, View = unknown> {
  id: GameId;
  name: string;
  emoji: string;
  /** One line for the lobby. */
  blurb: string;
  players: { min: number; max: number };
  /** Real-time games get `tick` this often. Every game with a time limit needs it. */
  tickMs?: number;
  /** The host's choices and their allowed values; the first is the default. */
  options?: Record<string, readonly (string | number)[]>;
  /**
   * False for long games (Tokenmaxxing): players walk around meanwhile instead of standing at the
   * table, and being disconnected isn't a forfeit.
   */
  holdPlayers?: boolean;

  setup(players: number[], seed: number, options: Options, now: number): State;
  /** A player's move: the new state, or why it's refused (shown to that player). */
  move(state: State, player: number, move: unknown, now: number): State | { refused: string };
  tick?(state: State, now: number): State;
  /** Usage games: which events count (`from` ≤ timestamp < `to`), and until when syncs still arrive. */
  usageWindow?(state: State): { from: number; to: number; until: number } | null;
  /** Usage games: a player's tokens so far in the window, pulled after each of their syncs. */
  usage?(state: State, player: number, usage: Usage, now: number): State;
  /** Takes a player out: they left or lost their connection. They're placed last. */
  forfeit(state: State, player: number, now: number): State;
  /** What one player may see, or a spectator (null). Must hide what they shouldn't know yet. */
  view(state: State, viewer: number | null, now: number): View;
  /** Null while it's being played. */
  outcome(state: State): Outcome | null;
  /** When side bets stop being taken. */
  betsCloseAt(state: State): number;
  /** Lines said out loud in the world when something happens ("Liar!", "💥 crashed at ×3.4"). */
  callouts?(before: State, after: State): Callout[];
  /** A short live status over a player's head in the world ("🪂 ×3.1", "✓"). */
  status?(state: State, player: number, now: number): string | null;
  /** A live scoreboard over the players in the world, best first. Games without one show a banner. */
  board?(state: State, now: number): BoardRow[];
  /** How it's going, in a few words, for the banner over the table ("Round 3 · 2–1"). */
  headline?(state: State, now: number): string;
  /** When it ends, for a countdown on the banner (long games). */
  endsAt?(state: State): number | null;
}

export const refused = (why: string) => ({ refused: why });

export const isRefused = (r: unknown): r is { refused: string } =>
  isRecord(r) && "refused" in r && Object.keys(r).length === 1;

/** `forfeit` for a game that lists who left (`forfeited`): adds them, once. */
export const leave = <S extends { forfeited: readonly number[] }>(s: S, player: number): S =>
  s.forfeited.includes(player) ? s : { ...s, forfeited: [...s.forfeited, player] };

/** Players who left, a place each: whoever left last places best among them. */
export const leavers = (out: readonly number[]): number[][] => [...out].reverse().map((p) => [p]);

/** Once at most one player is left, the game is over: them, then whoever left. Null while it's on. */
export const lastStanding = (
  left: readonly number[],
  out: readonly number[],
): { places: number[][] } | null =>
  left.length <= 1 ? { places: [[...left], ...leavers(out)].filter((g) => g.length > 0) } : null;

/** Players grouped by score, highest first: a tie shares a place. */
export function byScore(players: readonly number[], score: (player: number) => number): number[][] {
  const scores = [...new Set(players.map(score))].sort((a, b) => b - a);
  return scores.map((n) => players.filter((p) => score(p) === n));
}
