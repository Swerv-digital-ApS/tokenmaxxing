import { C } from "../palette.ts";
import { PETS } from "../pets.ts";
import { type Patch, type PetVariant, swap } from "./types.ts";

const BASE = PETS[5]!;

/** The panda's eye patches: frame 0 has them on row 3, the hop lifts them to row 2. */
const EYES0: Patch[] = [
  [3, 8, "p"],
  [3, 9, "p"],
];
const EYES1: Patch[] = [
  [2, 8, "p"],
  [2, 9, "p"],
];

/** Colour swaps of the panda. Shapes are in shapes.ts. */
export const PANDA_SWAPS: PetVariant[] = [
  // Qinling: the rare brown-and-cream panda.
  swap(BASE, "qinling", "Qinling panda", { w: "#f3e2c4", k: "#8a5a3a", n: C.ink }),
  // Polar cub: white, blue-grey where the black was, dark eyes and nose.
  swap(BASE, "polar", "Polar cub", { w: "#f7fbfd", k: "#9fb4c7", p: "#2b2433" }, EYES0, EYES1),
  // Albino: all white with soft pink-lilac shading, pink inner ears and nose, red-pink eyes.
  swap(
    BASE,
    "albino",
    "Albino panda",
    { w: "#fffafc", k: "#e4c6ee", p: "#ff2f68", n: "#ff7fa8", q: "#ffa6c4" },
    [
      [1, 7, "q"],
      [1, 9, "q"],
      [3, 8, "w"],
      [3, 9, "p"],
    ],
    [
      [0, 7, "q"],
      [0, 9, "q"],
      [2, 8, "w"],
      [2, 9, "p"],
    ],
  ),
];
