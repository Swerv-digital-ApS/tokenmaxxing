/**
 * Sankt Hans, the evening of 23 June (`holidays.ts`): a bonfire on the lawn in front of the Tavern, with a
 * witch of straw on top. The pile is built in the morning, it's lit at 21:00 and burns until 01:00. While it
 * stands nobody walks into it. All from the clock: the server keeps nothing.
 */
import { minutesFrom } from "./holidays.ts";

/** Its tiles: the lawn in front of the Tavern, two wide, under its path. */
export const BONFIRE = { x: 9, y: 17, w: 2 } as const;

/** In minutes from 23 June's midnight: the pile goes up, it's lit, it's out (01:00 the next night). */
export const SANKT_HANS = { built: 8 * 60, lit: 21 * 60, out: 25 * 60 } as const;

/** The bonfire at `ms`: a pile waiting, a fire, or nothing. */
export function bonfireAt(ms: number): "pile" | "lit" | null {
  const m = minutesFrom("sanktHans", ms);
  if (m < SANKT_HANS.built || m >= SANKT_HANS.out) return null;
  return m < SANKT_HANS.lit ? "pile" : "lit";
}

export const isBonfire = (x: number, y: number, ms: number): boolean =>
  y === BONFIRE.y && x >= BONFIRE.x && x < BONFIRE.x + BONFIRE.w && bonfireAt(ms) !== null;

/** What E on it says. */
export const bonfireSays = (state: "pile" | "lit"): string =>
  state === "pile"
    ? "🔥 The Sankt Hans bonfire, waiting for dark. It's lit at 21:00; the witch on top is straw."
    : "🔥 Sankt Hans! The bonfire is lit and the town sings Midsommervisen: “Vi elsker vort land…”";
