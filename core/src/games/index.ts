/** Every game there is. The lobby, the server and the client all read this list. */
import { isOneOf, isRecord } from "hanzio";
import type { GameStatus } from "../world.ts";
import { dice } from "./dice.ts";
import { hype } from "./hype.ts";
import { spr } from "./spr.ts";
import { sprint } from "./sprint.ts";
import { tokenmaxxing } from "./tokenmaxxing.ts";
import type { GameDef, GameId, Options } from "./types.ts";

// biome-ignore lint/suspicious/noExplicitAny: each game has its own state and view types
export const GAMES: Partial<Record<GameId, GameDef<any, any>>> = { spr, hype, dice, sprint, tokenmaxxing };

export const gameOf = (id: unknown) =>
  typeof id === "string" && id in GAMES ? GAMES[id as GameId] : undefined;

/** The host's options for `game`, each checked against its allowed values; anything else is the default. */
export function parseOptions(game: GameDef, raw: unknown): Options {
  const out: Options = {};
  const given: Record<string, unknown> = isRecord(raw) ? raw : {};
  for (const [key, allowed] of Object.entries(game.options ?? {})) {
    const value = given[key];
    out[key] = isOneOf(allowed, value) ? value : allowed[0]!;
  }
  return out;
}

/**
 * What a match tells the world about itself: only the public headline, board, per-player status and
 * watcher count. Nothing from `view` or the state goes on this wire, because the basement's big screen
 * (and everyone in the square) shows it to people who aren't playing.
 */
export function publicStatus(
  def: GameDef,
  state: unknown,
  players: readonly number[],
  watchers: number,
  now: number,
): GameStatus {
  return {
    status: Object.fromEntries(players.map((p) => [p, def.status?.(state, p, now) ?? null])),
    board: def.board?.(state, now) ?? null,
    watchers,
    headline: def.headline?.(state, now) ?? null,
    endsAt: def.endsAt?.(state) ?? null,
  };
}
