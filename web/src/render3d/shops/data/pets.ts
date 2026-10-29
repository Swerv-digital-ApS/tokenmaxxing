/**
 * A snapshot of what the 2D pet shop sells, so the 3D store needs nothing from core.
 * Sources: `core/src/shop.ts` (the `pet` items: ids `pet.<index>`, prices, the Lv30 Singularity orb reward),
 * `core/src/wardrobe.ts` (the `petwear` items: ids `petwear.<index>`, prices, rarity), `core/src/pets.ts`
 * (`PET_VARIANTS`: holding a pet unlocks all of its looks, so a variant has no price of its own) and
 * `core/src/milestones.ts` (`LEGENDARY_LEVEL`: the pet crown comes with the top level, never sold).
 * Only ever append, like the originals.
 */
import { fromCore } from "./core.ts";

export interface ShopPet {
  /** `pet.<index>`, like the 2D item id. */
  id: string;
  /** `Look.pet`. */
  index: number;
  name: string;
  species: "duck" | "cat" | "dog" | "dragon" | "panda" | "orb";
  price: number;
  /** Granted at this level; never sold. */
  level?: number;
}

const PET_SNAPSHOT: readonly ShopPet[] = [
  { id: "pet.1", index: 1, name: "Duck", species: "duck", price: 250 },
  { id: "pet.2", index: 2, name: "Cat", species: "cat", price: 400 },
  { id: "pet.3", index: 3, name: "Dog", species: "dog", price: 400 },
  { id: "pet.4", index: 4, name: "Dragon", species: "dragon", price: 1500 },
  { id: "pet.5", index: 5, name: "Panda", species: "panda", price: 800 },
  { id: "pet.6", index: 6, name: "Singularity orb", species: "orb", price: 0, level: 30 },
];

export const CATALOG_PETS: readonly ShopPet[] = fromCore(PET_SNAPSHOT);

/** `Look.petVariant` n is `PET_VARIANTS[species][n - 1]`; 0 is the pet as the shop sells it. */
export const SHOP_VARIANTS: Record<"duck" | "cat" | "dog" | "dragon" | "panda", readonly string[]> = {
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

export interface ShopPetwear {
  /** `petwear.<index>`. */
  id: string;
  index: number;
  name: string;
  price: number;
  rarity: "common" | "rare" | "epic";
  blurb: string;
}

const WEAR_SNAPSHOT: readonly ShopPetwear[] = [
  {
    id: "petwear.1",
    index: 1,
    name: "Red bandana",
    price: 60,
    rarity: "common",
    blurb: "Very good dog energy, any species.",
  },
  {
    id: "petwear.2",
    index: 2,
    name: "Pink bow",
    price: 60,
    rarity: "common",
    blurb: "Adorable, and it knows it.",
  },
  {
    id: "petwear.3",
    index: 3,
    name: "Bow tie",
    price: 140,
    rarity: "rare",
    blurb: "For pets who attend standups.",
  },
  {
    id: "petwear.4",
    index: 4,
    name: "Party hat",
    price: 160,
    rarity: "rare",
    blurb: "Every merge is a birthday.",
  },
  {
    id: "petwear.5",
    index: 5,
    name: "Gold collar",
    price: 450,
    rarity: "epic",
    blurb: "The tag says: 10x pet.",
  },
  {
    id: "petwear.6",
    index: 6,
    name: "Propeller cap",
    price: 200,
    rarity: "rare",
    blurb: "Spins up when it's thinking.",
  },
  {
    id: "petwear.7",
    index: 7,
    name: "Winter scarf",
    price: 90,
    rarity: "common",
    blurb: "Hygge, for the small ones.",
  },
];

export const SHOP_PETWEAR: readonly ShopPetwear[] = fromCore(WEAR_SNAPSHOT);

/** The top level: owners this high have their pet crowned (`LEGENDARY_LEVEL` in `core/src/milestones.ts`). */
export const CROWN_LEVEL = 50;
