/**
 * The Nusantara case's furniture: six pieces only a case opening gives, never sold in a shop and never
 * dropped by a raid. Same rules as the Night Market's (`case-furniture.ts`): they go down only in your
 * own office, are tradeable, take one map character from the Cyrillic block that nothing else uses
 * (checked in `case-furniture.test.ts`), have the item id `furn.<ch>`, and `art` is the sprite in
 * `web/src/art/furniture-home.ts` and the model in `web/src/render3d/furniture/`.
 */
import type { CasePiece } from "./case-furniture.ts";

const entry = (
  ch: string,
  art: string,
  name: string,
  rarity: CasePiece["rarity"],
  blurb: string,
  w: number,
  extra: Partial<Pick<CasePiece, "wall" | "flat">> = {},
): CasePiece => ({ ch, art, name, price: 0, w, text: blurb, home: true, rarity, blurb, ...extra });

/** Never reorder or reuse: the characters are in saved offices and the ids in bags. Add new ones at the end. */
// prettier-ignore
export const NUSANTARA_PIECES: readonly CasePiece[] = [
  entry("Б", "nus-batik-hanging", "Batik hanging", "common", "A length of hand-waxed batik on a bamboo pole.", 2, { wall: true }),
  entry("Г", "nus-sawah-rug", "Sawah rug", "common", "Rice terraces woven in steps, with one patient buffalo.", 2, { flat: true }),
  entry("Ш", "nus-warung-stool", "Warung stool", "common", "Low, red, plastic, and the only seat that matters.", 1),
  entry("Э", "nus-angkringan-cart", "Angkringan cart", "uncommon", "A glass-front cart, a hissing kettle, and fried snacks in neat rows.", 2),
  entry("Ю", "nus-bonang-rack", "Bonang rack", "uncommon", "A dozen bronze pots on a rope bed, mallets left in the middle.", 2),
  entry("Й", "nus-pinisi", "Pinisi on the stand", "rare", "A pinisi under full sail, ready to be unloaded.", 3),
];
