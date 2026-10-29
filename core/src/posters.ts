/**
 * Parody game posters for the company house: wall decor bought from the company wallet like the rest of
 * `COMPANY_FURNITURE` (appended to it in office.ts), hung only on the building's top wall (`canHang`).
 * Invented titles, nothing from the real games. Each is one map character (a digit: the free ones),
 * `art` its sprite in `web/src/art/furniture-posters.ts`, `text` the joke E shows.
 */
import type { Piece } from "./office.ts";

export type Poster = Piece & { art: string; text: string; wall: true };

const poster = (ch: string, art: string, name: string, price: number, w: number, text: string): Poster => ({
  ch,
  art,
  name,
  price,
  w,
  text,
  wall: true,
});

/** Cheapest first; the 1x1s are the small ones, the 2x1s the big prints. */
export const POSTERS: readonly Poster[] = [
  poster(
    "7",
    "super-merge",
    "Super Merge Bros",
    60,
    1,
    "World 1-1: resolve the conflict, grab the flag. The princess is in another repo.",
  ),
  poster(
    "6",
    "dark-deploys",
    "Dark Deploys",
    70,
    1,
    "YOU DIED. Rolled back to the last checkpoint: Friday, 4:59 pm.",
  ),
  poster(
    "8",
    "slay-backlog",
    "Slay the Backlog",
    90,
    1,
    "Pick a card: refactor, hotfix or quick sync. The deck has no way to remove meetings.",
  ),
  poster(
    "9",
    "last-dev",
    "Last Dev Standing",
    110,
    1,
    "100 devs drop in. The storm is the sprint deadline. Nobody remembers where the loot was.",
  ),
  poster(
    "5",
    "pipeline-valley",
    "Pipeline Valley",
    120,
    2,
    "Plant a commit, water it with CI, harvest a green build. The cows are on call.",
  ),
  poster(
    "1",
    "deploy-league",
    "Deploy League",
    140,
    2,
    "A rocket-powered car, a very large ball and no rollback plan. GOAL! (To prod.)",
  ),
  poster(
    "0",
    "counter-ci",
    "Counter-CI: Global Flake",
    160,
    2,
    "The bomb is defused, the pipeline goes red, a rerun fixes it. Nobody knows why.",
  ),
  poster(
    "2",
    "league-linters",
    "League of Linters",
    180,
    2,
    "5v5, one lane, 40 minutes. The ancient is a 2,000-line function. Surrender at 20 (warnings).",
  ),
  poster(
    "3",
    "defense-deps",
    "Defense of the Dependencies",
    210,
    2,
    "Three lanes, 120 heroes, and every patch breaks the meta. node_modules is the final boss.",
  ),
  poster(
    "4",
    "lootborn",
    "Lootborn",
    250,
    2,
    "Kill the same boss 300 times for a helmet one power level higher. Season pass not included.",
  ),
];

const BY_CH = new Map(POSTERS.map((p) => [p.ch, p]));

export const isPoster = (ch: unknown): boolean => BY_CH.has(ch as string);
export const posterOf = (ch: unknown): Poster | undefined => BY_CH.get(ch as string);
