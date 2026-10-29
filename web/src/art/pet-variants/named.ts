import { DOG_SHAPES } from "./dog-shapes.ts";
import { line, type Patch, type PetVariant, swap, up } from "./types.ts";

/**
 * Costumes for named pets (`PET_NAMED` in core/src/pets.ts): a look of a pet with a few pixels dressed.
 * They're built on the plain look, so the picker's art and the costume never drift apart.
 */
const dog = (id: string) => DOG_SHAPES.find((v) => v.id === id)!;

/**
 * Penny, after the real dog: a dark chocolate knitted sweater from behind the neck to the hips, a chunky pink
 * roll neck, a pink hem at the rear and a pink cuff by the near front leg. Legs, tail and head stay the greyhound's.
 */
const pennyBody: Patch[] = [
  ...line(3, 7, 8, "c"),
  ...line(4, 7, 9, "c"),
  [4, 8, "k"],
  ...line(5, 1, 9, "S"),
  ...line(6, 3, 9, "S"),
  // Pink ribbed hem along the rear underside, with its darker stitches.
  ...line(6, 3, 5, "c"),
  [6, 4, "k"],
  // Knit: a few darker stitches in the brown.
  [5, 2, "s"],
  [5, 4, "s"],
  [5, 6, "s"],
  [5, 8, "s"],
  [6, 7, "s"],
  [6, 9, "s"],
  [7, 6, "s"],
  [7, 7, "S"], // the sweater hangs low over the belly, between the legs
  [7, 8, "c"], // the cuff at the near front elbow
];

/**
 * Nemo, the author's pug, in his Chewbacca costume: a shaggy dark brown fur coat over the back that wraps up
 * round the head like a hood, a near-black bandolier panel with a pale grey grid across the top of the back,
 * and the pug's fawn legs, belly, cheeks and black muzzle showing. Frame 0's rows; the hop frame is one row higher.
 */
const nemoStanding: Patch[] = [
  // The hood: fur over the top of the head and down the back of it, round the ears.
  ...line(1, 5, 10, "J"),
  [1, 6, "j"],
  [1, 9, "j"],
  [2, 5, "J"],
  [2, 10, "J"],
  [3, 5, "j"],
  [3, 10, "J"],
  [4, 5, "J"],
  [5, 5, "j"],
  // The coat: over the back and down the flanks, with a ragged lower edge; the belly and legs stay fawn.
  ...line(5, 1, 3, "J"),
  ...line(6, 1, 8, "J"),
  ...line(7, 1, 8, "J"),
  [6, 8, "j"],
  [7, 2, "j"],
  [7, 4, "j"],
  [7, 6, "j"],
  [7, 8, "j"],
  // The bandolier panel: near black with pale grid lines, along the top of the back.
  ...line(5, 1, 3, "T"),
  ...line(6, 1, 7, "T"),
  [5, 2, "G"],
  [6, 3, "G"],
  [6, 6, "G"],
  [7, 4, "G"],
];

const penny = dog("greyhound");
const nemo = dog("pug");

export const NAMED: PetVariant[] = [
  swap(
    penny,
    "penny-sweater",
    "Penny",
    { S: "#5e3a26", s: "#432718", c: "#f0adbd", k: "#d98aa0" },
    pennyBody,
  ),
  swap(
    nemo,
    "nemo-wookiee",
    "Nemo",
    { J: "#5a3822", j: "#3b2314", T: "#1f1e27", G: "#9a9eb0" },
    nemoStanding,
    up(nemoStanding),
  ),
];
