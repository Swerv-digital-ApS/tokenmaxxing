import { C } from "../palette.ts";
import { PETS } from "../pets.ts";
import { line, type PetVariant, swap } from "./types.ts";

const BASE = PETS[1]!;

/** Colour swaps of the duck. Shapes are in shapes.ts. */
// Pixel art reads as a grid.
// prettier-ignore
export const DUCK_SWAPS: PetVariant[] = [
  {
    id: "mallard",
    name: "Mallard",
    frames: [
      [
        "............",
        "......ooo...",
        ".....ogggo..",
        ".....ogegoo.",
        ".....owwwnno",
        ".oo..obbboo.",
        "oyyooybbbyo.",
        ".oyyyyyyyo..",
        "..ooooooo...",
        "...n...n....",
      ],
      [
        "......ooo...",
        ".....ogggo..",
        ".....ogegoo.",
        ".....owwwnno",
        ".oo..obbboo.",
        "oyyooybbbyo.",
        ".oyyyyyyyo..",
        "..ooooooo...",
        "..n.....n...",
        "............",
      ],
    ],
    pal: { o: C.ink, y: "#8c8077", e: C.ink, n: "#f2b13b", g: "#3f8a57", w: C.white, b: "#7a4a2e" },
  },
  {
    id: "rubber",
    name: "Rubber duck",
    frames: [
      [
        "............",
        "......ooo...",
        ".....ohhyo..",
        ".....ohyeoo.",
        "o....oyyynno",
        "oyo..oyyyoo.",
        ".oyyoohhyyo.",
        ".osyyyyyyso.",
        "..ooooooo...",
        "............",
      ],
      [
        "......ooo...",
        ".....ohhyo..",
        ".....ohyeoo.",
        "o....oyyynno",
        "oyo..oyyyoo.",
        ".oyyoohhyyo.",
        ".osyyyyyyso.",
        "..ooooooo...",
        "............",
        "............",
      ],
    ],
    pal: { o: C.ink, y: "#ffcf00", e: C.ink, n: "#ff6a00", h: C.white, s: "#f2a100" },
  },
  swap(BASE, "pekin", "White Pekin", { y: "#f7f2e6", s: "#bfb8ad" }, line(7, 2, 8, "s"), line(6, 2, 8, "s")),
  swap(BASE, "swedish", "Black Swedish", { y: "#3b4762", e: C.white, l: "#7f93bd", w: C.white }, [
    [2, 6, "l"],
    [2, 7, "l"],
    [2, 8, "l"],
    [5, 8, "w"],
    [6, 8, "w"],
    [6, 9, "w"],
    [6, 1, "l"],
    [6, 2, "l"],
  ], [
    [1, 6, "l"],
    [1, 7, "l"],
    [1, 8, "l"],
    [4, 8, "w"],
    [5, 8, "w"],
    [5, 9, "w"],
    [5, 1, "l"],
    [5, 2, "l"],
  ]),
];
