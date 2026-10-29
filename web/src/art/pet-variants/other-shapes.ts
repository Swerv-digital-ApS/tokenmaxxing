import { C } from "../palette.ts";
import type { PetVariant } from "./types.ts";

/** The duck, cat, dragon and panda variations that need a different shape from the base pet. */
// Pixel art reads as a grid.
// prettier-ignore
export const DUCK_SHAPES: PetVariant[] = [
  {
    id: "duckling",
    name: "Duckling",
    frames: [
      [
      "............",
      "......y.....",
      "....oooo....",
      "...oyyyyo...",
      "..oyyyeyyo..",
      "..oyyyyynn..",
      "..oyyyyyyo..",
      "..oyYYyyyo..",
      "...oyyyyo...",
      "....n..n....",
      ],
      [
      "......y.....",
      "....oooo....",
      "...oyyyyo...",
      "..oyyyeyyo..",
      "..oyyyyynn..",
      "..oyyyyyyo..",
      "..oyYYyyyo..",
      "...oyyyyo...",
      "...n....n...",
      "............",
      ],
    ],
    pal: { o: C.ink, y: "#f7e08a", Y: "#e8c862", e: C.ink, n: "#f08a3c" },
  },
  {
    id: "ghost",
    name: "Ghost duck",
    frames: [
      [
      "............",
      "....oooo....",
      "...owwwwo...",
      "..owwwwwwo..",
      "..owkkwkkwo.",
      "..owkkwkkwnn",
      "..owwwwwwo..",
      ".owwwwwwwwo.",
      ".owwwwwwwswo",
      ".owo.n.n.ow.",
      ],
      [
      "....oooo....",
      "...owwwwo...",
      "..owwwwwwo..",
      "..owkkwkkwo.",
      "..owkkwkkwnn",
      "..owwwwwwo..",
      ".owwwwwwwwo.",
      ".owwwwwwwswo",
      ".owo.n.n.ow.",
      "............",
      ],
    ],
    pal: { o: C.ink, w: C.white, s: "#d8d4e0", k: "#3a3540", n: "#f08a3c" },
  },
];
// Pixel art reads as a grid.
// prettier-ignore
export const CAT_SHAPES: PetVariant[] = [
  {
    id: "sphynx",
    name: "Sphynx",
    frames: [
      [
        "............",
        "..d..b....b.",
        ".d..bib..bib",
        ".d..bibddbib",
        "d...bebbbebb",
        "d....bbbbbn.",
        "ddbbbbbbbb..",
        ".dbdbbdbbb..",
        ".b.b...b.b..",
        ".b.b...b.b..",
      ],
      [
        "..d..b....b.",
        ".d..bib..bib",
        ".d..bibddbib",
        "d...bebbbebb",
        "d....bbbbbn.",
        "ddbbbbbbbb..",
        ".dbdbbdbbb..",
        "b.b....b.b..",
        "b.b....b.b..",
        "............",
      ],
    ],
    pal: { o: C.ink, b: "#e2b49a", d: "#b46c58", i: "#ee8c8c", e: "#3b6e55", n: "#d9787a" },
  },
  {
    id: "witch",
    name: "Witch cat",
    frames: [
      [
      "............",
      ".......o....",
      "......opo...",
      ".....oyyyo..",
      "...oppppppo.",
      "....obebebo.",
      "b....obnbo..",
      "bo..obbbbbo.",
      ".obbbbbbbbo.",
      ".o.o...o.o..",
      ],
      [
      ".......o....",
      "......opo...",
      ".....oyyyo..",
      "...oppppppo.",
      "....obebebo.",
      "b....obnbo..",
      "bo..obbbbbo.",
      ".obbbbbbbbo.",
      "o.o.....o.o.",
      "............",
      ],
    ],
    pal: { o: C.ink, b: "#4a4358", p: "#7a55b8", y: "#f5d14a", e: "#f5d14a", n: "#e0584f" },
  },
];
// Pixel art reads as a grid.
// prettier-ignore
export const DRAGON_SHAPES: PetVariant[] = [
  {
    id: "baby",
    name: "Baby dragon",
    frames: [
      [
      "............",
      "....o...o...",
      "...oggggggof",
      "...ogeggggon",
      "...oggggggof",
      ".ww.ogggggo.",
      "owwoogyygo..",
      "g.oogyyyygo.",
      "gg.ogyyyygo.",
      "...oo..oo...",
      ],
      [
      "....o...o...",
      "...oggggggof",
      "...ogeggggon",
      "...oggggggof",
      ".ww.ogggggo.",
      "owwoogyygo..",
      "g.oogyyyygo.",
      "gg.ogyyyygo.",
      "...oo..oo...",
      "............",
      ],
    ],
    pal: { o: C.ink, g: "#8ccf86", G: "#6fb571", w: "#f0a58a", y: "#f5e2a8", e: C.ink, n: "#ff8a3c", f: "#f5d14a" },
  },
];
// Pixel art reads as a grid.
// prettier-ignore
export const PANDA_SHAPES: PetVariant[] = [
  {
    id: "red",
    name: "Red panda",
    frames: [
      [
        "............",
        "..lll.w..w..",
        ".rrrr.rrrrr.",
        "lllll.rwewew",
        "rrrrr.rwtwtn",
        ".llll.rrwwr.",
        ".rrrrrrrrr..",
        ".rrkkkkkrr..",
        "..k.k..k.k..",
        "..k.k..k.k..",
      ],
      [
        "..lll.w..w..",
        ".rrrr.rrrrr.",
        "lllll.rwewew",
        "rrrrr.rwtwtn",
        ".llll.rrwwr.",
        ".rrrrrrrrr..",
        ".rrkkkkkrr..",
        ".k.k...k.k..",
        ".k.k...k.k..",
        "............",
      ],
    ],
    pal: { o: C.ink, r: "#c8643a", l: "#ecd0a2", w: "#f4f1ea", k: "#3a3540", t: "#6e2a18", e: C.ink, n: C.ink },
  },
];
