import { C } from "../palette.ts";
import { PETS } from "../pets.ts";
import { type PetVariant, swap } from "./types.ts";

const BASE = PETS[4]!;

/** Colour swaps of the dragon. Shapes are in shapes.ts. */
export const DRAGON_SWAPS: PetVariant[] = [
  swap(BASE, "red", "Red dragon", {
    g: "#c94a3f",
    w: "#f19a8a",
    y: "#f7e6c2",
    n: "#f5d14a",
  }),
  swap(BASE, "ice", "Ice dragon", {
    g: "#9fd8ee",
    w: "#dff3ff",
    y: "#fbf7ef",
    n: "#7fd4ff",
  }),
  swap(BASE, "gold", "Gold dragon", {
    g: "#e0b23a",
    w: "#f7eaa0",
    y: "#fbf0d0",
    n: "#f08a3c",
  }),
  swap(BASE, "shadow", "Shadow dragon", {
    g: "#463f86",
    w: "#7d4fb0",
    y: "#5b5680",
    e: "#ff4fd2",
    n: "#b070ff",
  }),
  // Bone-white skull, rib cage and wing struts with dark gaps between the bones.
  {
    id: "skeleton",
    name: "Skeleton dragon",
    frames: [
      [
        "..oo........",
        ".ogwo....oo.",
        "owwgwo..oggo",
        "ogggggooeego",
        ".oowwwoggnon",
        "o...orrrrro.",
        "go.ogggyyyo.",
        ".ogrrrrrro..",
        "..oggoogo...",
        "..oo..oo....",
      ],
      [
        "............",
        "..oo.....oo.",
        ".ogwo...oggo",
        "owwgwoooeego",
        "ogggggoggnon",
        "go.orrrrrro.",
        ".oggggyyyyo.",
        "..orrrrrro..",
        "..oggoogo...",
        "..oo..oo....",
      ],
    ],
    pal: {
      o: C.ink,
      g: "#f1ead6",
      w: "#4a4158",
      y: "#d6cdb4",
      e: "#14101c",
      n: "#fffaf0",
      r: "#4a4258",
    },
  },
];
