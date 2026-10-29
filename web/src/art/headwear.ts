import { C } from "./palette.ts";
import type { Palette } from "./pixels.ts";

/**
 * Art for the head and face pack (`core/src/headwear.ts`), in its order. Hats are drawn from the
 * top of the 16×16 frame, face things from row `y` (5 is the row above the eyes, which are at
 * x 5 and 10 on row 6). Letters not in an item's palette fall back to the wearer's, so `h`/`H` is
 * their own hair colour: a beard or moustache matches. No `up` means it doesn't show from behind;
 * no `side` means it looks the same from the side.
 */
export interface Wear {
  down: readonly string[];
  side?: readonly string[];
  up?: readonly string[];
  y?: number;
  pal: Palette;
}

const o = C.ink;
const hat = (pal: Palette, down: string[], side = down, up = down): Wear => ({ down, side, up, pal });

// Pixel art reads as a grid.
// prettier-ignore
export const HAT_ART: readonly Wear[] = [
  // Tinfoil hat: a crumpled silver cone.
  hat({ o, s: "#c9ced6", W: "#eef2f6", w: "#ffffff", d: "#8d95a3" }, [
    ".......oo.......",
    "......owdo......",
    ".....osWsdo.....",
    "....oWsdwsdo....",
    "...odsWsdsWdo...",
  ]),
  // Ship-it party hat: a striped cone with a pompom.
  hat({ o, p: "#e86fb0", w: "#fbf7ef", y: "#f5d14a" }, [
    ".......yy.......",
    "......opwo......",
    ".....oppwpo.....",
    "....owppwppo....",
    "...oppwppwppo...",
  ]),
  // Danish flag cap: red with the white cross set toward the back, brim forward.
  hat(
    { o, r: "#d8283a", R: "#a81d2c", w: "#fbf7ef" },
    [
      "................",
      ".....oooooo.....",
      "....orrwrrro....",
      "...owwwwwwwwo...",
      "..oRRRRRRRRRRo..",
    ],
    [
      "................",
      ".....oooooo.....",
      "....orwrrrro....",
      "...owwwwwwwwo...",
      "...orrrrrRRRRRo.",
    ],
    [
      "................",
      ".....oooooo.....",
      "....orrwrrro....",
      "...owwwwwwwwo...",
      "...orrrwrrrro...",
    ],
  ),
  // Cykelhjelm: a vented bike helmet with its chin strap.
  hat(
    { o, t: "#3fb8a8", T: "#2a8b7f", k: "#1c3b3a", s: "#2b2433" },
    [
      "................",
      ".....oooooo.....",
      "....otkttkto....",
      "...ottkttktto...",
      "...oTTTTTTTTo...",
      "...s........s...",
      "...s........s...",
      "....s......s....",
    ],
    [
      "................",
      ".....oooooo.....",
      "....otkttkto....",
      "...ottkttktTo...",
      "...oTTTTTTTTTo..",
      "........s.......",
      ".........s......",
      "..........s.....",
    ],
  ),
  // Wi-Fi antennae: a headband with two glowing bobbles.
  hat({ o, g: "#3ddc84", G: "#b6ffd4", k: "#3a3f4b" }, [
    "..ogo......ogo..",
    "..oGo......oGo..",
    "....k......k....",
    "...okkkkkkkko...",
  ]),
  // Cat ears: ginger ears with pink insides, on a band.
  hat({ o, k: "#e0904a", K: "#b86a2c", p: "#f19ab8" }, [
    "...o........o...",
    "..oko......oko..",
    "..okpo....opko..",
    "...oKkkkkkkKo...",
  ]),
  // Prod hard hat: yellow, with a ridge and a brim.
  hat({ o, y: "#f5c842", Y: "#c9971f", w: "#fff0a8" }, [
    "................",
    ".....oooooo.....",
    "....owyYYyyo....",
    "...oyyyYYyyyo...",
    "..oYYYYYYYYYYo..",
  ]),
  // Julehue: a floppy red nisse hat, its pompom to one side.
  hat({ o, r: "#d8283a", R: "#a81d2c", w: "#fbf7ef" }, [
    "......ooooo.....",
    ".....orrrrrroww.",
    "....orRrrrrrrww.",
    "...orrrrrrrro...",
    "...owwwwwwwwo...",
  ]),
  // Whirlybird beanie: two-tone panels, a red brim, a spinner on top.
  hat({ o, y: "#f5d14a", b: "#4f8fe0", r: "#e0584f", p: "#e0584f", P: "#3ddc84", k: o }, [
    "...ppppkkPPPP...",
    ".....oooooo.....",
    "....oyyybbbo....",
    "...oyyyybbbbo...",
    "...orrrrrrrro...",
  ]),
  // Prompt chef toque: a pleated white puff on a band.
  hat({ o, w: "#fbf7ef", W: "#d9d3c6" }, [
    "....oooooooo....",
    "...owwwWwwWwo...",
    "...owWwwwWwwo...",
    "....oWWWWWWo....",
    "...owwwwwwwwo...",
  ]),
  // Cowboy coder hat: a creased crown, a red band and an upturned brim.
  hat({ o, b: "#9a6236", B: "#6e4224", r: "#c23a3a" }, [
    "................",
    ".....oooooo.....",
    "....obbBBbbo....",
    "ob.orrrrrrrro.bo",
    "obbbbbbbbbbbbbbo",
  ]),
  // Smørrebrød hat: rye bread with butter, egg, shrimp and dill.
  hat({ o, d: "#6b4226", D: "#4a2c18", b: "#f5d98a", w: "#fbf7ef", y: "#f5c842", p: "#f28c78", g: "#4f9b3d" }, [
    "................",
    "....owwo.opo....",
    "...owyywgppgo...",
    "...obbbbbbbbo...",
    "...odDddDddDo...",
  ]),
  // PhD mortarboard: a flat black board with a gold tassel.
  hat({ o, k: "#2e2e3a", K: "#1c1a24", y: "#f5c842" }, [
    "................",
    ".okkkkkkyyyyyko.",
    "..oKKKKKKKKKKoy.",
    "...okkkkkkkko.y.",
    "...okkkkkkkko.y.",
    "..............y.",
  ]),
  // Viking helmet: a steel dome, bronze rim, nose guard and two horns.
  hat(
    { o, m: "#8a93a1", M: "#cfd5dd", b: "#b0793a", r: "#f5c842", w: "#f4efe4", W: "#cbbf9f" },
    [
      ".o............o.",
      "owo..oooooo..owo",
      "owWoommMmmmooWwo",
      ".oWWmmmMmmmmWWo.",
      "..obbrbbbbrbbo..",
      ".......bb.......",
    ],
    [
      "....owo.........",
      "....owWooooo....",
      "...ooWWmMmmmo...",
      "...oWWmMmmmmmo..",
      "...obbbbrbbbbo..",
      "...........b....",
    ],
    [
      ".o............o.",
      "owo..oooooo..owo",
      "owWoommmmmmooWwo",
      ".oWWmmmmmmmmWWo.",
      "..obbrbbbbrbbo..",
    ],
  ),
  // Pirate tricorn: black, gold-trimmed, with a skull.
  hat({ o, k: "#2e2e3a", w: "#fbf7ef", y: "#f5c842" }, [
    "................",
    ".yo..oooooo..oy.",
    ".oyookkwwkkooyo.",
    "..oyykkwwkkyyo..",
    "...okkkkkkkko...",
  ]),
  // Jailbreak horns: two small devil horns.
  hat({ o, r: "#d8283a", R: "#ff6b5e" }, [
    "..o..........o..",
    "..oRo......oRo..",
    "...orro..orro...",
  ]),
  // Thinking cloud: a thought bubble with "…" in it.
  hat({ o, w: "#fbf7ef", k: "#6d7fc4" }, [
    "..........oooo..",
    ".........owwwwo.",
    "........owkwkwko",
    ".........owwwwo.",
    "..........oooo..",
    "..........ow....",
  ]),
  // Archmage hat: tall, starry, a tip that flops.
  hat({ o, b: "#5b4fc2", B: "#3e3590", y: "#f5d14a" }, [
    "........obo.....",
    ".......obbo.....",
    "......obybbo....",
    ".....obbbbybo...",
    ".oBBBBBBBBBBBBo.",
  ]),
  // Aligned halo: a gold ring around the top of the head.
  hat({ y: "#f5d14a", Y: "#fff3a8" }, [
    ".....YYYYYY.....",
    "....y......y....",
    ".....yyyyyy.....",
  ]),
  // GPU crown: a green circuit-board crown with glowing tips and gold pins.
  hat({ o, G: "#b6ffd4", g: "#3ddc84", k: "#1f6b45", y: "#f5c842", c: "#2b2433" }, [
    "....G..GG..G....",
    "...oko.oo.oko...",
    "...okkokkokko...",
    "...okckcckcko...",
    "...oyyyyyyyyo...",
  ]),
  // Rubber-duck hat (level 5): a duck sitting on your head.
  hat(
    { o, y: "#f5d14a", Y: "#d9a92a", b: "#f08a2b", k: o },
    [
      "........ooo.....",
      ".......oykybb...",
      "...ooooyyyo.....",
      "...oyyyyyyyyo...",
      "...oYYYYYYYYo...",
    ],
    undefined,
    [
      "........ooo.....",
      ".......oyyyo....",
      "...ooooyyyo.....",
      "...oyyyyyyyyo...",
      "...oYYYYYYYYo...",
    ],
  ),
  // Lego brick hat (level 15): a red two-by-three with its studs.
  hat({ o, r: "#d8283a", R: "#a81d2c", w: "#ff7a6e" }, [
    "....ww.ww.ww....",
    "...orrorrorro...",
    "...orrrrrrrro...",
    "...orrrrrrrro...",
    "...oRRRRRRRRo...",
  ]),
  // Aurora crown (level 25): ribbons of northern light over a gold band.
  hat({ o, g: "#57e3a1", t: "#5fd8e8", v: "#b28cff", y: "#f5c842", Y: "#c9971f", w: "#ffffff" }, [
    "..g...v..t...g..",
    "..gt.vg.tv..vg..",
    "...tvgtvgtvgt...",
    "...oyywyyyyyo...",
    "...oYYYYYYYYo...",
  ]),
];

const face = (pal: Palette, y: number, down: string[], side: string[], up?: string[]): Wear => ({
  down,
  side,
  ...(up && { up }),
  y,
  pal,
});

// Pixel art reads as a grid.
// prettier-ignore
export const FACE_ART: readonly Wear[] = [
  // Hallucination nose: a red clown nose with a shine.
  face({ r: "#e0302e", w: "#ffb3a8" }, 7, [
    ".......wr.......",
    ".......rr.......",
  ], [
    "............wr..",
    "............rr..",
  ]),
  // 3D glasses: a white frame, one red lens and one blue.
  face({ w: "#fbf7ef", r: "#e0302e", b: "#3f89e2" }, 5, [
    "...wwwwwwwwww...",
    "...wrrrwwbbbw...",
    "....rrr..bbb....",
  ], [
    "......wwwwww....",
    ".........bbb....",
    ".........bbb....",
  ]),
  // Hygge moustache: a handlebar in your own hair colour, wider than the face, its tips curled up.
  face({}, 6, [
    "..H..........H..",
    "...hhhhHHhhhh...",
    "....hh......hh..",
  ], [
    ".............H..",
    ".......hhhhhhH..",
    "..........hh....",
  ]),
  // Eyepatch: black, its strap across the forehead.
  face({ k: "#1c1a24" }, 3, [
    "...........k....",
    ".........kk.....",
    "....kkkkk.......",
    "....kkk.........",
    ".....k..........",
  ], [
    "................",
    ".....kkkkk......",
    "..........k.....",
  ], [
    "...k............",
    "....kk..........",
    "......kkkk......",
    "..........kk....",
  ]),
  // Harbour swim goggles: tinted lenses on a black strap.
  face({ k: "#1c1a24", b: "#2fb5c9", L: "#1f6b7a" }, 5, [
    "....bbb..bbb....",
    "..kkbLbkkbLbkk..",
    "....bbb..bbb....",
  ], [
    ".........bbb....",
    "...kkkkkkbLb....",
    ".........bbb....",
  ], [
    "................",
    "..kkkkkkkkkkkk..",
  ]),
  // Monocle: a gold ring on the right eye, its chain to the collar.
  face({ y: "#f5c842", Y: "#c9971f" }, 5, [
    ".........yyy....",
    ".........y.y....",
    ".........yyy....",
    ".........Y......",
    "........Y.......",
    "........Y.......",
  ], [
    ".........yyy....",
    ".........y.y....",
    ".........yyy....",
    ".........Y......",
    "........Y.......",
  ]),
  // Rockstar glasses: gold stars with pink lenses.
  face({ y: "#f5c842", p: "#ff6fa3" }, 5, [
    ".....y....y.....",
    "...yypyyyypyy...",
    "....y.y..y.y....",
  ], [
    "..........y.....",
    "......yyyypyy...",
    ".........y.y....",
  ]),
  // Prompt bandit bandana: red with white spots, over the mouth.
  face({ o, r: "#c23a3a", w: "#fbf7ef" }, 7, [
    "...orrrrrrrro...",
    "....orwrrwro....",
    ".....orrrro.....",
    "......orro......",
  ], [
    "..rr..orrrrro...",
    "..r.r.orwrro....",
    "........orro....",
    ".........oo.....",
  ], [
    "...orrrrrrrro...",
    "......rr........",
    ".....r..r.......",
  ]),
  // CopenHill ski goggles: a mirrored lens on a wide strap.
  face({ o, k: "#2e2e3a", y: "#f5b342", p: "#b04fc2" }, 5, [
    "..oooooooooooo..",
    ".koyyyyyyyyyyok.",
    ".kopppppoppppok.",
    "...oooo..oooo...",
  ], [
    "........ooooo...",
    "...kkkkkoyyyyo..",
    "........opppo...",
    "........ooo.....",
  ], [
    "................",
    "..kkkkkkkkkkkk..",
  ]),
  // Rate-limit visor: a band of red LEDs over the eyes.
  face({ o, k: "#2e2e3a", r: "#c2232b", R: "#ff5a4f" }, 5, [
    "...okkkkkkkko...",
    "...krRrRrRrRk...",
    "...okkkkkkkko...",
  ], [
    "........okkkko..",
    "...kkkkkkrRrRo..",
    "........okkkko..",
  ], [
    "................",
    "...kkkkkkkkkk...",
  ]),
  // Viking beard: big, braided, beaded, in your own hair colour.
  face({ o, y: "#f5c842" }, 7, [
    "...ohh....hho...",
    "...ohhhhhhhho...",
    "....ohhHHhho....",
    ".....ohyyho.....",
    "......ohho......",
  ], [
    ".......ohhhho...",
    "......ohhhhhho..",
    ".......ohHhho...",
    "........oyyo....",
    "........oho.....",
  ]),
  // Deal-with-it shades: black pixel shades with a glint.
  face({ k: "#1c1a24", w: "#fbf7ef" }, 5, [
    "..kkkkkkkkkkkk..",
    "...kwkkkkwkkk...",
    "....kwk..kwk....",
  ], [
    "......kkkkkkk...",
    ".........kwkk...",
    "..........kw....",
  ]),
  // Context window glasses: wide window frames with a title bar and its three lights.
  face({ f: "#3a3f4b", r: "#ff5f57", y: "#febc2e", n: "#28c840", l: "#cde9f6" }, 5, [
    ".frynffffffffff.",
    ".flll.lffl.lllf.",
    ".ffffffffffffff.",
  ], [
    "......frynfffff.",
    "......ffffl.llf.",
    "......fffffffff.",
  ]),
  // Vision headset: a glossy visor on a strap.
  face({ o, k: "#2e2e3a", K: "#1c1a24", w: "#8a93a1" }, 5, [
    "..oooooooooooo..",
    "..okwwkkkkkkko..",
    "..oKKKKKKKKKKo..",
    "...oooooooooo...",
  ], [
    ".......oooooo...",
    "...kkkkokwkkkko.",
    ".......oKKKKKKo.",
    "........oooooo..",
  ], [
    "................",
    "..kkkkkkkkkkkk..",
  ]),
  // Bot mask: a steel faceplate with cyan eyes and a speaker grille.
  face({ o, m: "#8a93a1", M: "#cfd5dd", c: "#8fe3ff", k: "#3a3f4b" }, 5, [
    "...oMmmmmmmmo...",
    "...omcmmmmcmo...",
    "...ommkkkkmmo...",
    "....ommmmmmo....",
  ], [
    ".......oMmmmo...",
    ".......ommmcmo..",
    ".......ommkkmo..",
    "........ommmo...",
  ], [
    "................",
    "...k........k...",
  ]),
  // Laser eyes: white-hot eyes with red flares.
  face({ r: "#ff3b30", W: "#fff3c4" }, 5, [
    ".....r....r.....",
    ".rrrrWr..rWrrrr.",
    ".....r....r.....",
  ], [
    "..........r.....",
    "..........Wrrrrr",
    "..........r.....",
  ]),
  // Nebula visor (level 40): one wraparound lens, violet at the edges to cyan in the middle, with a glint.
  face({ o, a: "#3b2a8f", b: "#7a6cf0", c: "#8fe3ff", w: "#ffffff" }, 5, [
    "...oooooooooo...",
    "..oabwcccccbao..",
    "...oabbccbbao...",
  ], [
    "........ooooo...",
    "......oabccwo...",
    "........obcco...",
  ]),
];
