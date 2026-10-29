/**
 * The Ragnarok Eve case's furniture: six pieces only a case opening gives, like the Night Market's
 * (`case-furniture.ts`): never sold, never raided, tradeable, and put down only in your own office. Each is
 * one map character from the Cyrillic block (`З Ы Ч Н Т Х`; note `Н Т Х` look like Latin letters but are
 * different code points), the item id is `furn.<ch>`, and `art` is its sprite in `web/src/art/furniture-home.ts`
 * and its model in `web/src/render3d/furniture/`. Design brief: `docs/cases/ragnarok-eve.md`.
 */
import type { CasePiece } from "./case-furniture.ts";
import type { HomePiece } from "./home.ts";
import type { Rarity } from "./rarity.ts";

const entry = (
  ch: string,
  art: string,
  name: string,
  rarity: Rarity,
  blurb: string,
  w: number,
  extra: Partial<Pick<HomePiece, "wall" | "flat">> = {},
): CasePiece => ({ ch, art, name, price: 0, text: blurb, home: true, rarity, blurb, w, ...extra });

/** Never reorder or reuse: the characters are in saved offices and the ids in bags. Add new ones at the end. */
// prettier-ignore
export const RAGNAROK_PIECES: readonly CasePiece[] = [
  entry("З", "norse-raven-banner", "Raven banner", "common", "A black raven on a red cloth, snapping in a draught.", 2, { wall: true }),
  entry("Ы", "norse-bearskin-rug", "Bearskin rug", "common", "Its expression says it has seen things.", 2, { flat: true }),
  entry("Ч", "norse-mead-stump", "Mead stump", "common", "A log stool and a horn of mead, left by the last guest.", 1),
  entry("Н", "norse-feast-table", "Feast table", "uncommon", "A boar roast that is never finished, which is how it works in Valhalla.", 2),
  entry("Т", "norse-runestone", "Painted runestone", "uncommon", "Painted in loud colours, like the originals. It says \"Gorm made this\".", 1),
  entry("Х", "norse-yggdrasil", "Yggdrasil sapling", "rare", "The World Tree, in sapling size: an eagle on top and a squirrel running up and down.", 3),
];
