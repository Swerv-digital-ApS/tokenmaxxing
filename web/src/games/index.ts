import type { GameId } from "@tokenmaxxing/core/games/types.ts";
import type { ComponentType } from "react";
import { Dice } from "./dice.tsx";
import { Hype } from "./hype.tsx";
import { Spr } from "./spr.tsx";
import { Sprint } from "./sprint.tsx";
import { Tokenmaxxing } from "./tokenmaxxing.tsx";
import type { GameProps } from "./types.ts";

/** Each game's panel. Adding a game: its rules in core/src/games, its component here. */
// biome-ignore lint/suspicious/noExplicitAny: each game has its own view type
export const COMPONENTS: Partial<Record<GameId, ComponentType<GameProps<any>>>> = {
  spr: Spr,
  hype: Hype,
  dice: Dice,
  sprint: Sprint,
  tokenmaxxing: Tokenmaxxing,
};
