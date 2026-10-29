/**
 * A snapshot of the 2D pet data the 3D pets are built from, so this slice needs nothing from core.
 * Sources: `core/src/pets.ts` (PET_VARIANTS, PET_NAMED), `core/src/shop.ts` + `core/src/loot.ts` (the pets),
 * `core/src/wardrobe.ts` + `web/src/art/wardrobe.ts` (pet gear). Only ever append, like the originals.
 */

/** Pets by their 2D index (`Look.pet`): 0 is none. */
export const PET_SPECIES = [
  "none",
  "duck",
  "cat",
  "dog",
  "dragon",
  "panda",
  "orb", // Singularity orb, a level-30 reward
  "golem", // Sand golem (rate-limit boss loot)
  "goldfish", // Context-window boss loot
  "forkedcat", // Merge-conflict boss loot
  "ghost", // Loot ghost
  "piggy", // Invoice boss loot
  // The Night Market case's pets are at `CASE_BASE` and up (`CASE_PET_BASE`), not in this list.
  "koi",
  "crane",
  "tanuki",
  "maneki",
  "kitsune",
  "tengu",
  // The Nusantara case's pets are at `NUSANTARA_PET_BASE` and up, not in this list either.
  "komodo",
  "tarsier",
  "enggang",
  "rafflesia",
  "cenderawasih",
  "orangutan",
] as const;

/** `Look.pet` of the first Night Market case pet (`CASE_BASE` in core/src/case.ts); the six follow in order. */
export const CASE_PET_BASE = 300;
/** The species that stand at `CASE_PET_BASE` and up. */
export const CASE_PET_SPECIES = ["koi", "crane", "tanuki", "maneki", "kitsune", "tengu"] as const;

/** `Look.pet` of the first Nusantara case pet (`NUSANTARA_BASE` in core/src/case-nusantara.ts); the six follow in order. */
export const NUSANTARA_PET_BASE = 400;
/** The species that stand at `NUSANTARA_PET_BASE` and up. */
export const NUSANTARA_PET_SPECIES = [
  "komodo",
  "tarsier",
  "enggang",
  "rafflesia",
  "cenderawasih",
  "orangutan",
] as const;

/** `Look.pet` of the first Ragnarok Eve pet (`RAGNAROK_BASE` in core/src/case-ragnarok.ts); the six follow in order. */
export const RAGNAROK_PET_BASE = 500;
/** The species that stand at `RAGNAROK_PET_BASE` and up (the first draws the pair of ravens). */
export const RAGNAROK_PET_SPECIES = [
  "huginn",
  "ratatoskr",
  "tanngrisnir",
  "hildisvini",
  "sleipnir",
  "fenrir",
] as const;

/** `Look.pet` of the first pond treasure pet (`FISHING_BASE` in core/src/fishing-loot.ts); the second follows. */
export const POND_PET_BASE = 600;
/** The species that stand at `POND_PET_BASE` and up: only fishing turns them up. */
export const POND_PET_SPECIES = ["axolotl", "kraken"] as const;

/**
 * The case ranges, one entry per case: `Look.pet` from `base` up to `base + species.length` is `species[n - base]`.
 * A later case (the pond's treasures are 600 to 699) adds its own line here and its names to `Species` and `PET_NAME`.
 */
const CASE_PET_RANGES: readonly { base: number; species: readonly Species[] }[] = [
  { base: CASE_PET_BASE, species: CASE_PET_SPECIES },
  { base: NUSANTARA_PET_BASE, species: NUSANTARA_PET_SPECIES },
  { base: RAGNAROK_PET_BASE, species: RAGNAROK_PET_SPECIES },
  { base: POND_PET_BASE, species: POND_PET_SPECIES },
];

/** The species of `Look.pet` `n`: the shop's and the loot's by position below 300, each case's from its own base. */
export const speciesAt = (n: number): Species | undefined => {
  if (n < CASE_PET_BASE) return PET_SPECIES[n];
  // The last range whose base is at or below `n` owns it (a case's indices run to the next hundred).
  let range: (typeof CASE_PET_RANGES)[number] | undefined;
  for (const r of CASE_PET_RANGES) if (n >= r.base) range = r;
  return range && n - range.base < 100 ? range.species[n - range.base] : undefined;
};
export type Species =
  (typeof PET_SPECIES)[number] | (typeof RAGNAROK_PET_SPECIES)[number] | (typeof POND_PET_SPECIES)[number];

export const PET_NAME: Record<Species, string> = {
  none: "No pet",
  duck: "Duck",
  cat: "Cat",
  dog: "Dog",
  dragon: "Dragon",
  panda: "Panda",
  orb: "Singularity orb",
  golem: "Sand golem",
  goldfish: "Goldfish",
  forkedcat: "Forked cat",
  ghost: "Ghost",
  piggy: "Piggy bank",
  koi: "Koi",
  crane: "Paper crane",
  tanuki: "Tanuki pup",
  maneki: "Maneki cat",
  kitsune: "Kitsune",
  tengu: "Tengu",
  komodo: "Komodo",
  tarsier: "Tarsier",
  enggang: "Enggang",
  rafflesia: "Rafflesia",
  cenderawasih: "Cenderawasih",
  orangutan: "Orangutan",
  huginn: "Huginn and Muninn",
  ratatoskr: "Ratatoskr",
  tanngrisnir: "Tanngrisnir",
  hildisvini: "Hildisvíni",
  sleipnir: "Sleipnir foal",
  fenrir: "Fenrir pup",
  axolotl: "Axolotl",
  kraken: "Pocket kraken",
};

/** `Look.petVariant` n is `PET_VARIANTS[species][n - 1]`; 0 is the pet as the shop sells it. */
export const PET_VARIANTS: Partial<Record<Species, readonly string[]>> = {
  duck: ["mallard", "rubber", "pekin", "swedish", "duckling", "ghost"],
  cat: ["black", "tuxedo", "siamese", "calico", "greytabby", "sphynx", "witch"],
  dog: [
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
  dragon: ["red", "ice", "gold", "shadow", "skeleton", "baby"],
  panda: ["qinling", "polar", "albino", "red"],
};

/** Easter-egg costumes: a pet of this name, species and variant wears the `art` outfit. */
export const PET_NAMED: readonly { name: string; species: Species; variant: string; art: string }[] = [
  { name: "Penny", species: "dog", variant: "greyhound", art: "penny-sweater" },
  { name: "Nemo", species: "dog", variant: "pug", art: "nemo-wookiee" },
];

/** Pet gear, by `Look.petwear` (1-based). */
export const PETWEAR = [
  { name: "Red bandana", at: "neck" },
  { name: "Pink bow", at: "top" },
  { name: "Bow tie", at: "neck" },
  { name: "Party hat", at: "top" },
  { name: "Gold collar", at: "neck" },
  { name: "Propeller cap", at: "top" },
  { name: "Winter scarf", at: "neck" },
] as const;

/** Owners at this level or above (the cap) have their pet crowned. */
export const LEGENDARY_LEVEL = 50;
