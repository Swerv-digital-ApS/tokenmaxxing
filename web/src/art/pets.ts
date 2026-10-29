import { PET_H, PET_W, PETS, type Pet } from "./pet-base.ts";
import { outfitArt, variantArt } from "./pet-variants/index.ts";
import { bake, cached } from "./pixels.ts";
import { drawPetwear, PET_HEADROOM } from "./wardrobe.ts";

// The sprites live in pet-base.ts so the variation files, which build on them and which this file
// imports, can load first without a cycle.
export { PET_H, PET_W, PETS };

/** The art of `pet` in look `variant` (0 is the original, and also what a variation without art yet shows). */
const artOf = (pet: number, variant: number, outfit: string): Pet | null =>
  outfitArt(outfit || null) ?? (variant > 0 ? variantArt(pet, variant) : null) ?? PETS[pet] ?? null;

/**
 * One frame of pet `pet` in look `variant`, in the costume `outfit` (`petOutfit`) if any, or null for
 * none. With gear on (`wear`, see wardrobe.ts) it's `PET_HEADROOM` taller, room for a hat: stand it on
 * the same bottom line.
 */
export const petFrame = (
  pet: number,
  left: boolean,
  hop: boolean,
  variant = 0,
  outfit: string | null = null,
  wear = 0,
): HTMLCanvasElement | null => (PETS[pet] ? frame(pet, left, hop, variant, outfit ?? "", wear) : null);

const frame = cached(
  (pet: number, left: boolean, hop: boolean, variant: number, outfit: string, wear: number) =>
    `${pet}:${left}:${hop}:${variant}:${outfit}:${wear}`,
  (pet: number, left: boolean, hop: boolean, variant: number, outfit: string, wear: number) => {
    const art = artOf(pet, variant, outfit)!;
    const rows = art.frames[hop ? 1 : 0];
    if (!wear) return bake(PET_W, PET_H, (p) => p.grid(rows, art.pal, 0, 0, left));
    const right = bake(PET_W, PET_H + PET_HEADROOM, (p) => {
      p.grid(rows, art.pal, 0, PET_HEADROOM);
      drawPetwear(p, pet, wear, hop);
    });
    if (!left) return right;
    return bake(right.width, right.height, (p) => {
      p.g.scale(-1, 1);
      p.g.drawImage(right, -right.width, 0);
    });
  },
);

/** The middle of the top row of pet `pet`'s frame, for a hat to sit on; null for no pet. */
export function petTop(pet: number, hop: boolean): { x: number; y: number } | null {
  const rows = PETS[pet]?.frames[hop ? 1 : 0];
  const y = rows?.findIndex((r) => r.replaceAll(".", "") !== "") ?? -1;
  if (!rows || y < 0) return null;
  const row = rows[y]!;
  const first = row.search(/[^.]/);
  const last = row.length - 1 - [...row].reverse().findIndex((c) => c !== ".");
  return { x: (first + last) / 2, y };
}
