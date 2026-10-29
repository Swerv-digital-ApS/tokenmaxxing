/**
 * The variations of each shop pet: the same animal in other colours or breeds. Holding a pet unlocks
 * all of its variations; `Look.petVariant` says which one is worn (0 is the pet as the shop sells it, n is
 * `PET_VARIANTS[pet][n - 1]`). The order is saved in looks, so only ever append to a list. The art for each
 * id is in `web/src/art/pet-variants/`.
 */
export const PET_VARIANTS: Record<number, readonly string[]> = {
  // Duck
  1: ["mallard", "rubber", "pekin", "swedish", "duckling", "ghost"],
  // Cat
  2: ["black", "tuxedo", "siamese", "calico", "greytabby", "sphynx", "witch"],
  // Dog
  3: [
    "dalmatian",
    "husky",
    "shiba",
    "golden",
    "pug",
    "corgi",
    "dachshund",
    "poodle",
    "frenchie",
    "chowchow",
    "chihuahua",
    "greyhound",
    "jackolantern",
  ],
  // Dragon
  4: ["red", "ice", "gold", "shadow", "skeleton", "baby"],
  // Panda
  5: ["qinling", "polar", "albino", "red"],
};

import type { Look } from "./world.ts";

/** How many looks a pet has: the original, then its variations. */
export const petLooks = (pet: number): number => (PET_VARIANTS[pet]?.length ?? 0) + 1;

/** The most looks any pet has, for `Look.petVariant`'s bound. */
export const MAX_PET_LOOKS = Math.max(...Object.keys(PET_VARIANTS).map((p) => petLooks(Number(p))));

/**
 * `look` wearing `pet`. A look is one of that pet's, so changing pet starts from the original (0): a variation
 * number kept from another pet could be out of range for this one, and the server would refuse the whole look.
 */
export const wearPet = (look: Look, pet: number): Look => ({
  ...look,
  pet,
  petVariant: look.pet === pet ? look.petVariant : 0,
});

/** The longest pet name. */
export const PET_NAME_MAX = 16;

/**
 * A pet's name as saved: trimmed, runs of spaces made one. Letters, digits, spaces, apostrophes and hyphens
 * only, 1 to `PET_NAME_MAX` long, or null. An empty string is no name (callers treat it as "unnamed").
 */
export function cleanPetName(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const name = raw.trim().replace(/ {2,}/g, " ");
  if (name.length < 1 || name.length > PET_NAME_MAX) return null;
  return /^[\p{L}\p{N}][\p{L}\p{N} '’-]*$/u.test(name) ? name : null;
}

/**
 * Easter eggs: a pet with this name, of this kind and look, wears a costume. Matched on the cleaned name,
 * ignoring case. `art` is an id in `web/src/art/pet-variants/named.ts`. To add one, append a row and draw it.
 */
export const PET_NAMED: readonly { name: string; pet: number; variant: string; art: string }[] = [
  // Italian greyhounds feel the cold.
  { name: "Penny", pet: 3, variant: "greyhound", art: "penny-sweater" },
  // A pug with a Wookiee's bandolier.
  { name: "Nemo", pet: 3, variant: "pug", art: "nemo-wookiee" },
];

/** The costume art id for a worn pet, or null for none: renaming it away takes the costume off. */
export function petOutfit(look: Pick<Look, "pet" | "petVariant" | "petName">): string | null {
  const name = cleanPetName(look.petName ?? "")?.toLowerCase();
  const variant = look.petVariant > 0 ? PET_VARIANTS[look.pet]?.[look.petVariant - 1] : undefined;
  if (!name || !variant) return null;
  return (
    PET_NAMED.find((n) => n.name.toLowerCase() === name && n.pet === look.pet && n.variant === variant)
      ?.art ?? null
  );
}

/**
 * What you can do with your pet. Cosmetic, shown to everyone in the room (`world.petPlay` → `petPlay`):
 * `pet` is a free stroke, `treat` costs `TREAT_COST` coins (at most `TREATS_PER_DAY` a day), `trick` a spin.
 */
export const PET_ACTS = ["pet", "treat", "trick"] as const;
export type PetAct = (typeof PET_ACTS)[number];
export const isPetAct = (v: unknown): v is PetAct => PET_ACTS.includes(v as PetAct);

/** Coins a treat costs, and how many a player can give in a world day. Both are checked in the town's SQL. */
export const TREAT_COST = 2;
export const TREATS_PER_DAY = 5;

/** The least gap between two of the same act from one player, in ms: a stroke is quick, a trick takes its time. */
export const PET_COOLDOWN_MS: Record<PetAct, number> = { pet: 2_500, treat: 3_000, trick: 5_000 };

/** The emoji that float up from the pet for each act. */
export const PET_ACT_EMOJI: Record<PetAct, string[]> = {
  pet: ["💕", "❤️"],
  treat: ["🍖", "💖"],
  trick: ["⭐", "✨"],
};
