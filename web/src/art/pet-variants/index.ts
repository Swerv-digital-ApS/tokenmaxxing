import { PET_VARIANTS } from "@tokenmaxxing/core/pets.ts";
import { CAT_SWAPS } from "./cat.ts";
import { DOG_SWAPS } from "./dog.ts";
import { DOG_SHAPES } from "./dog-shapes.ts";
import { DRAGON_SWAPS } from "./dragon.ts";
import { DUCK_SWAPS } from "./duck.ts";
import { NAMED } from "./named.ts";
import { CAT_SHAPES, DRAGON_SHAPES, DUCK_SHAPES, PANDA_SHAPES } from "./other-shapes.ts";
import { PANDA_SWAPS } from "./panda.ts";
import type { PetVariant } from "./types.ts";

/** Every variation's art, by pet then id. */
const ART: Record<number, PetVariant[]> = {
  1: [...DUCK_SWAPS, ...DUCK_SHAPES],
  2: [...CAT_SWAPS, ...CAT_SHAPES],
  3: [...DOG_SWAPS, ...DOG_SHAPES],
  4: [...DRAGON_SWAPS, ...DRAGON_SHAPES],
  5: [...PANDA_SWAPS, ...PANDA_SHAPES],
};

/** The art of `pet`'s variation `variant` (1-based, as in `Look.petVariant`), or null for the original. */
export function variantArt(pet: number, variant: number): PetVariant | null {
  const id = PET_VARIANTS[pet]?.[variant - 1];
  return (id && ART[pet]?.find((v) => v.id === id)) || null;
}

/** Ids in `PET_VARIANTS` that have no art yet, for tests and the sheet tool. */
export const missingArt = (): string[] =>
  Object.entries(PET_VARIANTS).flatMap(([pet, ids]) =>
    ids.filter((id) => !ART[Number(pet)]?.some((v) => v.id === id)).map((id) => `${pet}:${id}`),
  );

/** The costume `id` (from `petOutfit`), or null. */
export const outfitArt = (id: string | null): PetVariant | null =>
  (id && NAMED.find((v) => v.id === id)) || null;
