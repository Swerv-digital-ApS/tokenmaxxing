/**
 * The Night Market case's furniture: six pieces only a case opening gives, never sold in a shop and never
 * dropped by a raid. Like a personal office's own pieces (`home.ts`) they go down only in your own office,
 * but they are tradeable. Each is one map
 * character from the Cyrillic block, which nothing else uses (checked in `case-furniture.test.ts`), the
 * item id is `furn.<ch>`, and `art` is its sprite in `web/src/art/furniture-home.ts` and its model in
 * `web/src/render3d/furniture/furniture3d.ts`.
 */
import { NUSANTARA_PIECES } from "./case-nusantara-furniture.ts";
import { RAGNAROK_PIECES } from "./case-ragnarok-furniture.ts";
import type { HomePiece } from "./home.ts";
import type { Rarity } from "./rarity.ts";

export interface CasePiece extends HomePiece {
  rarity: Rarity;
  blurb: string;
}

const entry = (
  ch: string,
  art: string,
  name: string,
  rarity: Rarity,
  blurb: string,
  w: number,
  extra: Partial<Pick<HomePiece, "wall" | "flat">> = {},
): CasePiece => ({ ch, art, name, price: 0, w, text: blurb, home: true, rarity, blurb, ...extra });

/** Never reorder or reuse: the characters are in saved offices and the ids in bags. Add new ones at the end. */
// prettier-ignore
export const CASE_PIECES: readonly CasePiece[] = [
  entry("Ж", "night-lanterns", "Lantern string", "common", "A string of paper lanterns, glowing over the stalls.", 2, { wall: true }),
  entry("Щ", "night-koi-rug", "Koi rug", "common", "Two koi circle a pond woven into the wool.", 2, { flat: true }),
  entry("Я", "night-tea-stool", "Tea stool", "common", "A low stool with a steaming cup, left by the last customer.", 1),
  entry("Ф", "night-ramen-counter", "Ramen counter", "uncommon", "A counter with a noren curtain and a bowl always on the boil.", 2),
  entry("Д", "night-claw-machine", "Arcade claw machine", "uncommon", "Forty coins to win a plush that was never in the machine.", 1),
  entry("Ц", "night-torii", "Torii gate", "rare", "A vermilion gate lit by lanterns: the way into the night market.", 3),
];

/** Every case's furniture: the Night Market's (`CASE_PIECES`), then the Nusantara's, then Ragnarok Eve's (a later case adds its own here). */
export const ALL_CASE_PIECES: readonly CasePiece[] = [
  ...CASE_PIECES,
  ...NUSANTARA_PIECES,
  ...RAGNAROK_PIECES,
];

const BY_CH = new Map(ALL_CASE_PIECES.map((p) => [p.ch, p]));

export const isCasePiece = (ch: unknown): boolean => BY_CH.has(ch as string);
export const casePieceOf = (ch: unknown): CasePiece | undefined => BY_CH.get(ch as string);
