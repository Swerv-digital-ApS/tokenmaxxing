/**
 * Game furniture in town: a table per game (16×16, on the middle tile of its spot),
 * and arena desks with laptops for long games. Drawn in code like the rest.
 */
import type { GameId } from "@tokenmaxxing/core/games/types.ts";
import { typedSwitch, typedSwitchGroup } from "hanzio";
import { C } from "./palette.ts";
import { bake, cached, type Pen } from "./pixels.ts";

/** A round wooden table on one leg, with something on top. */
function tableBase(p: Pen, top: string, rim: string): void {
  p.rect(7, 11, 2, 4, C.woodDark);
  p.rect(4, 14, 8, 2, C.woodDark);
  p.disc(8, 8, 6, C.ink);
  p.disc(8, 8, 5, rim);
  p.disc(8, 7, 5, top);
}

export const gameTable = cached(
  (game: GameId) => game,
  (game: GameId) =>
    bake(16, 16, (p) => {
      typedSwitch(game, {
        dice: () => {
          // A green card table with two dice.
          tableBase(p, "#3f8f5a", "#2c6b41");
          for (const [x, y] of [
            [5, 5],
            [9, 7],
          ] as const) {
            p.rect(x, y, 3, 3, C.white);
            p.px(x + 1, y + 1, C.ink);
          }
        },
        hype: () => {
          // A small screen with a line shooting up.
          tableBase(p, C.wood, C.woodDark);
          p.rect(3, 1, 10, 8, C.ink);
          p.rect(4, 2, 8, 6, "#1b1f2a");
          for (const [x, y] of [
            [4, 7],
            [6, 6],
            [8, 5],
            [10, 3],
            [11, 2],
          ] as const)
            p.px(x, y, "#3ddc84");
        },
        sprint: () => {
          // A keyboard with a row of keys lit up, mid-race.
          tableBase(p, C.wood, C.woodDark);
          p.rect(2, 4, 12, 6, C.ink);
          p.rect(3, 5, 10, 4, C.metal);
          for (let x = 3; x < 13; x += 2) {
            p.px(x, 5, C.metalLight);
            p.px(x + 1, 7, C.metalLight);
          }
          p.rect(5, 8, 6, 1, C.white);
          p.px(9, 5, C.lamp);
          p.px(4, 7, C.lamp);
        },
        ...typedSwitchGroup(game, ["spr", "tokenmaxxing"], () => {
          // A desk bell between two founders.
          tableBase(p, C.woodLight, C.wood);
          p.rect(6, 4, 4, 1, C.ink);
          p.disc(8, 6, 2, "#e9b73d");
          p.rect(6, 7, 5, 1, C.ink);
        }),
      });
    }),
);

/** One arena desk with a laptop; its screen glows brighter the harder its player is burning tokens. */
export const arenaDesk = cached(
  (glow: number) => String(glow),
  (glow: number) =>
    bake(16, 16, (p) => {
      p.rect(0, 6, 16, 8, C.ink);
      p.rect(1, 7, 14, 6, C.woodLight);
      p.rect(1, 12, 14, 1, C.woodDark);
      p.rect(2, 13, 2, 3, C.woodDark);
      p.rect(12, 13, 2, 3, C.woodDark);
      // The laptop, its lid towards us.
      p.rect(4, 1, 8, 7, C.ink);
      p.rect(5, 2, 6, 5, ["#2a3a55", "#3f6fb0", "#6fb8ff", "#bfe9ff"][glow]!);
      p.rect(4, 8, 8, 1, C.metalLight);
    }),
);
