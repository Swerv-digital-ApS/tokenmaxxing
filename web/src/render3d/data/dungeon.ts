/**
 * Snapshot of the 2D raid/dungeon data for the 3D world. Sources (branch feat/tavern): web/src/art/{bosses,minions,loot,editions,trophies}.ts
 * and core/src/{raid,loot,editions,trophies,badges,rarity}.ts. Pixel grids are kept as they are, so the 3D models can extrude them.
 */
// biome-ignore-all format: pixel art reads as a grid

import { TIER_COLOR } from "@tokenmaxxing/core/rarity.ts";
import { TROPHIES } from "@tokenmaxxing/core/trophies.ts";
import { C } from "../../art/palette.ts";
import { TROPHY_ART } from "../../art/trophy-art.ts";
export type Palette = Record<string, string>;
export type View = "down" | "side" | "up";
export interface Art {
  down: string[];
  side?: string[];
  up?: string[];
  pal: Palette;
}

export const LOOT_HATS: { rows: Record<View, string[]>; pal: Palette }[] = [
  // Hourglass hat: a little hourglass on a wooden brim.
  {
    rows: {
      down: [
        "....okkkkkko....",
        ".....ogyyyo.....",
        "......oyyo......",
        ".....oyyyyo.....",
        "...okKKKKKKko...",
      ],
      side: [
        "....okkkkkko....",
        ".....ogyyyo.....",
        "......oyyo......",
        ".....oyyyyo.....",
        "...okKKKKKKKko..",
      ],
      up: [
        "....okkkkkko....",
        ".....ogyyyo.....",
        "......oyyo......",
        ".....oyyyyo.....",
        "...okKKKKKKko...",
      ],
    },
    pal: { o: C.ink, k: "#b57c4b", K: "#8c5c36", y: "#f2c46b", g: "#cfeaf5" },
  },
  // Infinite Context Crown: a wide gold crown with ∞ across its band.
  {
    rows: {
      down: [
        "...y.y.yy.y.y...",
        "...yyccyyccyy...",
        "...ycyyccyycy...",
        "...yyccyyccyy...",
        "...YYYYYYYYYY...",
      ],
      side: [
        "...y.y.yy.y.y...",
        "...yyccyyccyy...",
        "...ycyyccyycy...",
        "...yyccyyccyy...",
        "...YYYYYYYYYY...",
      ],
      up: [
        "...y.y.yy.y.y...",
        "...yyyyyyyyyy...",
        "...yyyyyyyyyy...",
        "...yyyyyyyyyy...",
        "...YYYYYYYYYY...",
      ],
    },
    pal: { y: "#f5c842", Y: "#c9971f", c: "#5ff0ff" },
  },
  // <<<<<<< HEAD band: a conflict-red headband, its knot hanging off the back.
  {
    rows: {
      down: [
        "................",
        "................",
        "................",
        "..obbbbbbbbbbo..",
        "..obwbbwbbwbbobb",
      ],
      side: [
        "................",
        "................",
        "................",
        "..obbbbbbbbbbo..",
        "bbobwbbwbbwbo...",
      ],
      up: [
        "................",
        "................",
        "................",
        "..obbbbbbbbbbo..",
        "..obbbbbbbbbbobb",
      ],
    },
    pal: { o: C.ink, b: "#e0584f", w: C.white },
  },
  // Mirage Crown: the Hallucination’s purple swirls, watchful eyes and golden stars.
  {
    rows: {
      down: [
        "..g.v..gg..v.g..",
        "....vv.pp.vv....",
        "...vwwvppvwwv...",
        "...vwkvppvwkv...",
        "...ddddggdddd...",
      ],
      side: [
        "..g.v..gg..v.g..",
        "....vv.pp.vv....",
        "...vvvppwwvvv...",
        "...vvvwpkwvvv...",
        "...ddddggdddd...",
      ],
      up: [
        "..g.v......v.g..",
        "....vv.vv.vv....",
        "...vvvvvvvvvv...",
        "...vpvvpvvvpv...",
        "...ddddggdddd...",
      ],
    },
    pal: { v: "#9b6fd6", p: "#d9c2f5", d: "#4a2a73", g: "#ffd35c", w: "#fffdf6", k: C.ink },
  },
  // Paid in Full crown: gold, with a green band and a white tick on it.
  {
    rows: {
      down: [
        "...y.y.yy.y.y...",
        "...yyyyyyyyyy...",
        "...yggwgggwgy...",
        "...yggggwgggy...",
        "...YYYYYYYYYY...",
      ],
      side: [
        "...y.y.yy.y.y...",
        "...yyyyyyyyyy...",
        "...yggwgggwgy...",
        "...yggggwgggy...",
        "...YYYYYYYYYY...",
      ],
      up: [
        "...y.y.yy.y.y...",
        "...yyyyyyyyyy...",
        "...yggggggggy...",
        "...yggggggggy...",
        "...YYYYYYYYYY...",
      ],
    },
    pal: { y: "#f5c842", Y: "#c9971f", g: "#3fae5a", w: C.white },
  },
];

/** Glasses from `LOOT_FIRST.glasses` on (after the head pack), over rows 5–7 of the head. */
export const LOOT_GLASSES: { rows: Record<"down" | "side", string[]>; pal: Palette }[] = [
  // 429 shades: red lenses, a glint, too many requests.
  {
    rows: {
      down: ["...gggggggggg...", "...grwrggrwrg...", "....rr....rr...."],
      side: ["........gggg....", "......ggrwrr....", ".........rr....."],
    },
    pal: { g: "#1c1a24", r: "#e0384f", w: "#ffb3b3" },
  },
  // Pane glasses: two little four-pane windows.
  {
    rows: {
      down: ["...gggggggggg...", "...glglgglglg...", "...gggggggggg..."],
      side: ["........ggggg...", "......gggglgl...", "........ggggg..."],
    },
    pal: { g: "#f4efe4", l: "#8fd3ff" },
  },
  // Third eye: one more, on the forehead, seeing things.
  {
    rows: {
      down: [".....pwkkwp.....", "................", "................"],
      side: [".........pwkp...", "................", "................"],
    },
    pal: { p: "#b57cff", w: C.white, k: "#3a1f6b" },
  },
  // Fine-print specs: half-moon lenses, each with a line of tiny text.
  {
    rows: {
      down: ["...gggggggggg...", "...gptpggptpg...", "....ggg..ggg...."],
      side: ["........ggggg...", "......ggggptp...", "........ggggg..."],
    },
    pal: { g: "#3a3f4b", p: "#fff6c9", t: "#7a7466" },
  },
];

/** Outfits from `LOOT_FIRST.outfit` on (after the wardrobe): [main, shade], trousers, and what goes over the body (from row 9, like the rack armour). */
export const LOOT_OUTFITS: {
  colors: [string, string];
  pants: string;
  over: Record<View, string[]>;
  pal: Palette;
}[] = [
  // Compacting… scarf: a cream jumper and a striped scarf, its end hanging.
  {
    colors: ["#e7e1d3", "#c9c0ad"],
    pants: "#3d4a6b",
    over: {
      down: ["....kKkKkKkK....", ".......kK.......", ".......Kk......."],
      side: [".....kKkKkK.....", "......kK........", "......Kk........"],
      up: ["....kKkKkKkK....", "................", "................"],
    },
    pal: { k: "#e0584f", K: "#f4efe4" },
  },
  // Two-tone suit: ours on the left, theirs on the right.
  {
    colors: ["#4f8fe0", "#3a6fb8"],
    pants: "#2f3444",
    over: {
      down: ["........ddd.....", "........dddd....", "........ddD....."],
      side: ["........dd......", "........ddd.....", ".........Dd....."],
      up: [".....ddd........", "....dddd........", ".....ddd........"],
    },
    pal: { d: "#e0584f", D: "#b8443f" },
  },
  // Shimmering cape: violet and teal, round the shoulders and down the back.
  {
    colors: ["#2a2150", "#5b3fbf"],
    pants: "#2a2150",
    over: {
      down: [
        "...pq..yy..qp...",
        "..pq........qp..",
        "..pq........qp..",
        "..qp........pq..",
        "..pq........qp..",
        "...q........q...",
      ],
      side: [
        "....pq..........",
        "...pqp..........",
        "...pq...........",
        "..pqp...........",
        "..qpq...........",
        "..pq............",
      ],
      up: [
        "....pqpqpqpq....",
        "...pqpqpqpqpq...",
        "...qpqpqpqpqp...",
        "...pqpqpqpqpq...",
        "...qpqpqpqpqp...",
        "....pqpqpqpq....",
      ],
    },
    pal: { p: "#b57cff", q: "#5ff0d0", y: "#ffd35c" },
  },
  // Pinstripe suit: navy, a white collar and a red tie.
  {
    colors: ["#2f3a55", "#1f2740"],
    pants: "#1f2740",
    over: {
      down: ["......wrrw......", ".......rr.......", ".......rr......."],
      side: [".......wr.......", ".......rr.......", ".......r........"],
      up: ["................", "................", "................"],
    },
    pal: { w: C.white, r: "#e0384f" },
  },
];

/** Pets 7–10: 12×10, facing right, two frames to hop. */
export const LOOT_PETS: { frames: [string[], string[]]; pal: Palette }[] = [
  // Sand golem: a block of every second you waited, eyes glowing.
  {
    frames: [
      [
        "............",
        ".....oooooo.",
        "....osSsssso",
        "....ossysyso",
        "..ooosssssso",
        ".osSosSssSo.",
        ".osssssssso.",
        ".oSsssssSso.",
        "..oso..oso..",
        "..oo....oo..",
      ],
      [
        ".....oooooo.",
        "....osSsssso",
        "....ossysyso",
        "..ooosssssso",
        ".osSosSssSo.",
        ".osssssssso.",
        ".oSsssssSso.",
        "..oso..oso..",
        ".oo......oo.",
        "............",
      ],
    ],
    pal: { o: C.ink, s: "#e3c07a", S: "#b8934e", y: "#ff9a3c" },
  },
  // Goldfish: floating along, a bubble at a time. It forgot already.
  {
    frames: [
      [
        "..........w.",
        "......ooo...",
        ".o...ogggo..",
        "ogo.ogggego.",
        "oggoggggggGo",
        "ogo.oggggGo.",
        ".o...ooooo..",
        "............",
        "............",
        "............",
      ],
      [
        "......ooo..w",
        ".o...ogggo..",
        "ogo.ogggego.",
        "oggoggggggGo",
        "ogo.oggggGo.",
        ".o...ooooo..",
        "............",
        "............",
        "............",
        "............",
      ],
    ],
    pal: { o: C.ink, g: "#ff8a3c", G: "#d9622b", e: C.white, w: "#a8dcf7" },
  },
  // Forked cat: two tails, one history.
  {
    frames: [
      [
        "............",
        "t..b...o..o.",
        "t..b..obooba",
        ".t.b..obbbbo",
        "..tb..oebebo",
        "...o.obbnbbo",
        "..oooobbbbo.",
        ".obbbbbbbo..",
        ".obobbbobo..",
        ".o.o..o.o...",
      ],
      [
        "t..b...o..o.",
        "t..b..obooba",
        ".t.b..obbbbo",
        "..tb..oebebo",
        "...o.obbnbbo",
        "..oooobbbbo.",
        ".obbbbbbbo..",
        ".obobbbobo..",
        "o.o....o.o..",
        "............",
      ],
    ],
    pal: { o: C.ink, b: "#8a93a1", a: "#8a93a1", t: "#f0a04b", e: C.ink, n: "#e0584f" },
  },
  // Ghost: it says it exists.
  {
    frames: [
      [
        "............",
        "....oooo....",
        "...owwwwo...",
        "..owwwwwwo..",
        "..owkwwkwo..",
        "..owwwwwwo..",
        "..owwwwwwwo.",
        "..owwwwwwwo.",
        "..owowwowo..",
        "..o.o..o.o..",
      ],
      [
        "....oooo....",
        "...owwwwo...",
        "..owwwwwwo..",
        "..owkwwkwo..",
        "..owwwwwwo..",
        "..owwwwwwwo.",
        "..owwwwwwwo.",
        "..oowwowwo..",
        "...o.o..o.o.",
        "............",
      ],
    ],
    pal: { o: "#7a7f9a", w: "#f4f6ff", k: C.ink },
  },
  // Piggy bank: a coin dropping in the slot, every one you owe.
  {
    frames: [
      [
        "....yy......",
        "..oooooo.oo.",
        ".obbkkbboboo",
        ".obbbbbbbbbo",
        "obbbbbbbebss",
        "obbbbbbbbbsn",
        ".obbbbbbbbbo",
        ".obbbbbbbbo.",
        "..obo..obo..",
        "..ooo..ooo..",
      ],
      [
        "..oooooo.oo.",
        ".obbkkbboboo",
        ".obbbbbbbbbo",
        "obbbbbbbebss",
        "obbbbbbbbbsn",
        ".obbbbbbbbbo",
        ".obbbbbbbbo.",
        "..obo..obo..",
        "..ooo..ooo..",
        "............",
      ],
    ],
    pal: { o: C.ink, b: "#f0a0b8", k: "#7a2a3f", y: "#ffd35c", e: C.ink, s: "#f7c0d0", n: "#c05070" },
  },
];
const o = C.ink;
export const EDITION_HATS: Record<string, Art> = {
  // Prompt wizard hat: a starry cone, bent at the tip, on a wide brim.
  "hat.100": {
    down: [
      "........oo......",
      ".......opPo.....",
      "......opypPo....",
      ".....oppppyPo...",
      "..oBBBBBBBBBBBo.",
    ],
    pal: { o, p: "#6a4bc4", P: "#4d3596", y: "#f5d14a", B: "#3b2a78" },
  },
  // Green-CI halo: a glowing ring, tilted, over the hair.
  "hat.101": {
    down: [".....GGGGGG.....", "....G......G....", ".....gggggg....."],
    pal: { g: "#b6ffc6", G: "#3ddc84" },
  },
  // Release party hat: a striped cone with a bobble.
  "hat.102": {
    down: [
      ".......yy.......",
      "......oppo......",
      "......owwo......",
      ".....oppppo.....",
      ".....owwwwo.....",
    ],
    pal: { o, y: "#f5d14a", p: "#e8584f", w: "#fbf7ef" },
  },
  // Propeller beanie: four panels and a spinner on top.
  "hat.103": {
    down: [
      "..rrrr.oo.bbbb..",
      ".....ooKKoo.....",
      "....oyyrrbbo....",
      "...oyyyrrbbbo...",
      "...oYYYYYYYYo...",
    ],
    side: [
      "....rr.oo.bb....",
      ".....ooKKoo.....",
      "....oyyrrbbo....",
      "...oyyyrrbbbo...",
      "...oYYYYYYYYYo..",
    ],
    pal: { o, r: "#e0584f", b: "#4f8fe0", y: "#f5d14a", Y: "#c9971f", K: "#5d6470" },
  },
  // Spaghetti chef's toque: puffed top, pleats, and a noodle on the band.
  "hat.104": {
    down: [
      "....oo.oo.oo....",
      "...owwowwowwo...",
      "...owwwwwwwwo...",
      "....oWwWwWwo....",
      "...oWyWWyyWWo...",
    ],
    pal: { o, w: "#fbf7ef", W: "#dcd6cc", y: "#f0c45a" },
  },
  // Friday deploy stetson: a dented crown, a red band and a curled brim.
  "hat.105": {
    down: [
      "................",
      ".....oooooo.....",
      "....obbBbbbo....",
      "oo.orrrrrrrro.oo",
      ".obbbbbbbbbbbbo.",
    ],
    side: [
      "................",
      ".....oooooo.....",
      "....obbBbbbo....",
      "...orrrrrrrro.oo",
      "..obbbbbbbbbbbo.",
    ],
    pal: { o, b: "#9a6a3c", B: "#6e4a2a", r: "#c23a3a" },
  },
  // Force-push helm: a riveted dome, a gold band and two horns.
  "hat.106": {
    down: [
      ".w............w.",
      ".ww..oooooo..ww.",
      "..wwoMMMMMMoww..",
      "...oMMMmMMMMo...",
      "...oYYYYYYYYo...",
    ],
    side: [
      "......w.........",
      ".....wwoooooo...",
      "......woMMMMMo..",
      "...oMMMmMMMMo...",
      "...oYYYYYYYYo...",
    ],
    pal: { o, w: "#f1e6d2", M: "#8a93a1", m: "#cfccc7", Y: "#e9b73d" },
  },
  // Cat-5 ears: blue cable ears with pink inside, on a cable headband.
  "hat.107": {
    down: ["...oo......oo...", "...obo....obo...", "...obpo..opbo...", "...okkkkkkkko..."],
    side: ["......oo........", "......obo.......", "......obpo......", "...okkkkkkkko..."],
    pal: { o, b: "#4f8fe0", p: "#f28bb2", k: "#3a6fb8" },
  },
  // Antenna headband: two springy stalks with bobbles.
  "hat.108": {
    down: ["..rr........bb..", "..rr........bb..", "....k......k....", "...okkkkkkkko..."],
    side: ["...rr.....bb....", "...rr.....bb....", ".....k...k......", "...okkkkkkkko..."],
    pal: { o, r: "#e8584f", b: "#8fe3ff", k: "#3a3f4b" },
  },
  // Cache-hit mushroom: a big red cap with white spots.
  "hat.109": {
    down: [
      ".....oooooo.....",
      "...orrwwrrrro...",
      "..orrrrrrwwrro..",
      ".orwwrrrrrrrrro.",
      ".oRRRRRRRRRRRRo.",
    ],
    pal: { o, r: "#d9574a", R: "#b0443a", w: "#fbf7ef" },
  },
  // Borrowed-token tricorn: black, gold-trimmed, a coin on the front.
  "hat.110": {
    down: [
      "..o..........o..",
      "..oko.oooo.oko..",
      "..okkokkkkokko..",
      "..okkkkykkkkko..",
      "...oYYYYYYYYo...",
    ],
    up: ["..o..........o..", "..oko.oooo.oko..", "..okkokkkkokko..", "..okkkkkkkkkko..", "...oYYYYYYYYo..."],
    pal: { o, k: "#2f2a3a", y: "#f5c842", Y: "#c9971f" },
  },
  // 429 bucket hat: teal canvas, a red tag, a floppy brim.
  "hat.111": {
    down: [
      "................",
      ".....oooooo.....",
      "....oaaaaaao....",
      "....oaaaarao....",
      "..oAAAAAAAAAAo..",
    ],
    pal: { o, a: "#4fb3a9", A: "#3a8c84", r: "#e0584f" },
  },
  // Benchmark laurels: a wreath round the head, tied with gold.
  "hat.112": {
    down: [
      "................",
      ".....l....l.....",
      "....lL....Ll....",
      "...lLl....lLl...",
      "..lLlyyyyyylLl..",
    ],
    up: ["................", ".....l....l.....", "....lL....Ll....", "...lLl....lLl...", "..lLlLlLlLllLl.."],
    pal: { l: "#72bf52", L: "#3a7b2f", y: "#f5c842" },
  },
  // Copenhagen ushanka: brown fur, a light fur band, ear flaps, and a little Dannebrog.
  "hat.113": {
    down: [
      "................",
      "....oooooooo....",
      "...offfrwfffo...",
      "..oFFFFFFFFFFo..",
      "..oFo......oFo..",
      "..oFo......oFo..",
      "...o........o...",
    ],
    side: [
      "................",
      "....oooooooo....",
      "...offffffffo...",
      "..oFFFFFFFFFFo..",
      "...oFFo.........",
      "...oFFo.........",
      "....oo..........",
    ],
    up: [
      "................",
      "....oooooooo....",
      "...offffffffo...",
      "..oFFFFFFFFFFo..",
      "..oFo......oFo..",
      "..oFo......oFo..",
      "...o........o...",
    ],
    pal: { o, f: "#6b4a34", F: "#c9a27a", r: "#c8102e", w: "#fbf7ef" },
  },
};
export const EDITION_GLASSES: Record<string, Art> = {
  // VR visor: one dark slab with a glint, strapped round the back.
  "glasses.100": {
    down: ["...oooooooooo...", "...ovwvvvvvvo...", "...oVVVVVVVVo..."],
    side: ["........ooooo...", "...kkkkkovwvo...", "........oVVVo..."],
    pal: { o, v: "#3a3546", V: "#5b3fbf", w: "#8fe3ff", k: "#2b2433" },
  },
  // Pricing-page monocle: a gold ring on one eye, on a chain.
  "glasses.101": {
    down: [".........yyy....", "........yl.ly...", ".........yyy.c..", "............c..."],
    pal: { y: "#f5c842", l: "#cde9f6", c: "#c9971f" },
  },
  // 3D diff specs: white frames, red for removed, cyan for added.
  "glasses.102": {
    down: ["...wwwwwwwwww...", "...wrrrwwcccw...", "....rr....cc...."],
    side: ["........wwwww...", "......wwwcccw...", ".........cc....."],
    pal: { w: "#fbf7ef", r: "#e8584f", c: "#58d3e8" },
  },
  // Deal-with-it pixels: black, stepped, a white pixel of shine each.
  "glasses.103": {
    down: ["..kkkkkkkkkkkk..", "...kwkkk.kwkkk..", "....kkk...kkk..."],
    side: ["......kkkkkkk...", ".........kwkkk..", "..........kkk..."],
    pal: { k: "#14121a", w: "#fbf7ef" },
  },
  // Five-star shades: gold stars for lenses.
  "glasses.104": {
    down: [".....y....y.....", "...yyyyyyyyyy...", "....y.y..y.y...."],
    side: ["..........y.....", "........yyyyy...", ".........y.y...."],
    pal: { y: "#f5c842" },
  },
  // Code-review laser visor: a metal band with a red sweep across it.
  "glasses.105": {
    down: ["..mmmmmmmmmmmm..", "..mrrRrrrrRrrm..", "...mmm....mmm..."],
    side: ["......mmmmmmm...", "......mrrrrRm...", ".........mmm...."],
    pal: { m: "#5d6470", r: "#e0584f", R: "#ffb3a8" },
  },
};
export { TROPHY_ART };
export const DUNGEON_BOSSES = [
  {
    id: "rate-limit",
    name: "The Rate Limit",
    emoji: "⏳",
    taunts: ["You've hit your limit.", "Try again in 4h 59m.", "429. 429. 429.", "Upgrade to continue."],
  },
  {
    id: "context-window",
    name: "The Context Window",
    emoji: "🪟",
    taunts: [
      "I forgot what you said.",
      "Compacting conversation…",
      "Too long; didn't read.",
      "Start a new chat?",
    ],
  },
  {
    id: "merge-conflict",
    name: "Merge Conflict",
    emoji: "🔀",
    taunts: ["<<<<<<< HEAD", "Both modified.", "Rebase me. I dare you.", "=======  >>>>>>>"],
  },
  {
    id: "hallucination",
    name: "The Hallucination",
    emoji: "🌀",
    taunts: [
      "That function exists. Trust me.",
      "Tests pass. Probably.",
      "I made up that API.",
      "Citation needed.",
    ],
  },
  {
    id: "invoice",
    name: "The Invoice",
    emoji: "🧾",
    taunts: ["Net 30.", "Usage this month: ∞.", "Please remit payment.", "Overage charges apply."],
  },
] as const;
export const RARITY_INFO = {
  common: {
    odds: 0.1,
    label: "Common",
    color: "#7fcf6a",
  },
  rare: {
    odds: 0.025,
    label: "Rare",
    color: "#5aa8ff",
  },
  epic: {
    odds: 0.005,
    label: "Epic",
    color: "#b57cff",
  },
  legendary: {
    odds: 0.001,
    label: "Legendary",
    color: "#ffc93c",
  },
} as const;
export const LOOT_TABLE = [
  {
    id: "hat.28",
    slot: "hat",
    index: 28,
    name: "Hourglass hat",
    boss: "rate-limit",
    rarity: "common",
    blurb: "Wear it and time slows down. Retry-After: 5h.",
  },
  {
    id: "glasses.21",
    slot: "glasses",
    index: 21,
    name: "429 shades",
    boss: "rate-limit",
    rarity: "rare",
    blurb: "Too many requests to look at.",
  },
  {
    id: "pet.7",
    slot: "pet",
    index: 7,
    name: "Sand golem",
    boss: "rate-limit",
    rarity: "epic",
    blurb: "Made of every second you waited.",
  },
  {
    id: "furn.Y",
    slot: "furniture",
    index: 12,
    name: "Golden Hourglass",
    boss: "rate-limit",
    rarity: "legendary",
    blurb: "The Rate Limit's own timer, cast in gold. Put it in your office.",
  },
  {
    id: "glasses.22",
    slot: "glasses",
    index: 22,
    name: "Pane glasses",
    boss: "context-window",
    rarity: "common",
    blurb: "Four little windows. Still can't see it all.",
  },
  {
    id: "outfit.26",
    slot: "outfit",
    index: 26,
    name: "Compacting… scarf",
    boss: "context-window",
    rarity: "rare",
    blurb: "Summarises itself as you walk.",
  },
  {
    id: "pet.8",
    slot: "pet",
    index: 8,
    name: "Goldfish",
    boss: "context-window",
    rarity: "epic",
    blurb: "Forgot already.",
  },
  {
    id: "hat.29",
    slot: "hat",
    index: 29,
    name: "Infinite Context Crown",
    boss: "context-window",
    rarity: "legendary",
    blurb: "Remembers everything. Everything.",
  },
  {
    id: "outfit.27",
    slot: "outfit",
    index: 27,
    name: "Two-tone suit",
    boss: "merge-conflict",
    rarity: "common",
    blurb: "Ours on the left, theirs on the right.",
  },
  {
    id: "hat.30",
    slot: "hat",
    index: 30,
    name: "<<<<<<< HEAD band",
    boss: "merge-conflict",
    rarity: "rare",
    blurb: "Resolve it yourself.",
  },
  {
    id: "pet.9",
    slot: "pet",
    index: 9,
    name: "Forked cat",
    boss: "merge-conflict",
    rarity: "epic",
    blurb: "Two tails, one history.",
  },
  {
    id: "furn.V",
    slot: "furniture",
    index: 13,
    name: "Golden Rebase",
    boss: "merge-conflict",
    rarity: "legendary",
    blurb: "A clean history, in gold. Put it in your office.",
  },
  {
    id: "glasses.23",
    slot: "glasses",
    index: 23,
    name: "Third eye",
    boss: "hallucination",
    rarity: "common",
    blurb: "Sees functions that aren't there.",
  },
  {
    id: "outfit.28",
    slot: "outfit",
    index: 28,
    name: "Shimmering cape",
    boss: "hallucination",
    rarity: "rare",
    blurb: "Probably real.",
  },
  {
    id: "pet.10",
    slot: "pet",
    index: 10,
    name: "Ghost",
    boss: "hallucination",
    rarity: "epic",
    blurb: "It says it exists. Trust it.",
  },
  {
    id: "hat.31",
    slot: "hat",
    index: 31,
    name: "Mirage Crown",
    boss: "hallucination",
    rarity: "legendary",
    blurb: "The Hallucination's impossible light, captured in a crown.",
  },
  {
    id: "glasses.24",
    slot: "glasses",
    index: 24,
    name: "Fine-print specs",
    boss: "invoice",
    rarity: "common",
    blurb: "Read the terms. Every one.",
  },
  {
    id: "outfit.29",
    slot: "outfit",
    index: 29,
    name: "Pinstripe suit",
    boss: "invoice",
    rarity: "rare",
    blurb: "Itemised, notarised, a little tight.",
  },
  {
    id: "pet.11",
    slot: "pet",
    index: 11,
    name: "Piggy bank",
    boss: "invoice",
    rarity: "epic",
    blurb: "Every coin you owe, rattling.",
  },
  {
    id: "hat.32",
    slot: "hat",
    index: 32,
    name: "Paid in Full crown",
    boss: "invoice",
    rarity: "legendary",
    blurb: "Balance: 0. Forever.",
  },
] as const;
export const EDITION_LIST = [
  {
    id: "hat.100",
    slot: "hat",
    index: 100,
    name: "Prompt wizard hat",
    price: 220,
    rarity: "rare",
    blurb: "Every star stitched on is a system prompt that worked first try.",
    supply: 20,
  },
  {
    id: "hat.101",
    slot: "hat",
    index: 101,
    name: "Green-CI halo",
    price: 400,
    rarity: "epic",
    blurb: "Glows for as long as the build stays green. So, briefly.",
    supply: 12,
  },
  {
    id: "hat.102",
    slot: "hat",
    index: 102,
    name: "Release party hat",
    price: 120,
    rarity: "rare",
    blurb: "Worn for v1.0.0. And v1.0.1, an hour later.",
    supply: 25,
  },
  {
    id: "hat.103",
    slot: "hat",
    index: 103,
    name: "Propeller beanie",
    price: 160,
    rarity: "rare",
    blurb: "Spins a little faster with every token per second.",
    supply: 20,
  },
  {
    id: "hat.104",
    slot: "hat",
    index: 104,
    name: "Spaghetti chef's toque",
    price: 180,
    rarity: "rare",
    blurb: "Cooks legacy code al dente.",
    supply: 20,
  },
  {
    id: "hat.105",
    slot: "hat",
    index: 105,
    name: "Friday deploy stetson",
    price: 260,
    rarity: "epic",
    blurb: "Yeehaw, straight to prod. No staging on the open range.",
    supply: 15,
  },
  {
    id: "hat.106",
    slot: "hat",
    index: 106,
    name: "Force-push helm",
    price: 300,
    rarity: "epic",
    blurb: "Horns for pushing. No reviews were taken.",
    supply: 15,
  },
  {
    id: "hat.107",
    slot: "hat",
    index: 107,
    name: "Cat-5 ears",
    price: 200,
    rarity: "rare",
    blurb: "Twisted-pair whiskers, rated for gigabit purrs.",
    supply: 20,
  },
  {
    id: "hat.108",
    slot: "hat",
    index: 108,
    name: "Antenna headband",
    price: 140,
    rarity: "rare",
    blurb: "Picks up new models before the changelog does.",
    supply: 25,
  },
  {
    id: "hat.109",
    slot: "hat",
    index: 109,
    name: "Cache-hit mushroom",
    price: 240,
    rarity: "epic",
    blurb: "Grows best in warm, dark caches. Hit rate: delicious.",
    supply: 15,
  },
  {
    id: "hat.110",
    slot: "hat",
    index: 110,
    name: "Borrowed-token tricorn",
    price: 320,
    rarity: "epic",
    blurb: "Arr. All yer tokens be on someone else's plan.",
    supply: 12,
  },
  {
    id: "hat.111",
    slot: "hat",
    index: 111,
    name: "429 bucket hat",
    price: 150,
    rarity: "rare",
    blurb: "Holds exactly one leaky bucket of requests. Try again later.",
    supply: 20,
  },
  {
    id: "hat.112",
    slot: "hat",
    index: 112,
    name: "Benchmark laurels",
    price: 500,
    rarity: "legendary",
    blurb: "Crowned state of the art. Valid until Tuesday.",
    supply: 8,
  },
  {
    id: "hat.113",
    slot: "hat",
    index: 113,
    name: "Copenhagen ushanka",
    price: 280,
    rarity: "epic",
    blurb: "For waiting on the bike lane in February.",
    supply: 15,
  },
  {
    id: "glasses.100",
    slot: "glasses",
    index: 100,
    name: "VR visor",
    price: 350,
    rarity: "epic",
    blurb: "Renders the whole town in 8K. It's still pixels.",
    supply: 12,
  },
  {
    id: "glasses.101",
    slot: "glasses",
    index: 101,
    name: "Pricing-page monocle",
    price: 260,
    rarity: "epic",
    blurb: "For reading the fine print on 'unlimited'.",
    supply: 15,
  },
  {
    id: "glasses.102",
    slot: "glasses",
    index: 102,
    name: "3D diff specs",
    price: 140,
    rarity: "rare",
    blurb: "Red for removed, cyan for added. Headache included.",
    supply: 25,
  },
  {
    id: "glasses.103",
    slot: "glasses",
    index: 103,
    name: "Deal-with-it pixels",
    price: 300,
    rarity: "epic",
    blurb: "They slide down slowly, after the tests pass.",
    supply: 15,
  },
  {
    id: "glasses.104",
    slot: "glasses",
    index: 104,
    name: "Five-star shades",
    price: 180,
    rarity: "rare",
    blurb: "Five points for every five-star review.",
    supply: 20,
  },
  {
    id: "glasses.105",
    slot: "glasses",
    index: 105,
    name: "Code-review laser visor",
    price: 420,
    rarity: "legendary",
    blurb: "Scans a whole PR in one red sweep. Finds a nit.",
    supply: 10,
  },
] as const;
export const TROPHY_DEFS = TROPHIES.map(({ id, name, how }) => ({ id, name, how }));
export const BADGE_DEFS = [
  {
    id: "streak",
    emoji: "🔥",
    name: "Streak",
    group: "Usage",
    how: "Tokens on days in a row",
    tiers: [
      {
        at: 7,
        label: "7-day streak",
      },
      {
        at: 30,
        label: "30-day streak",
      },
      {
        at: 100,
        label: "100-day streak",
      },
      {
        at: 365,
        label: "365-day streak",
      },
    ],
  },
  {
    id: "bigday",
    emoji: "🧠",
    name: "Big day",
    group: "Usage",
    how: "Tokens in a single day",
    tiers: [
      {
        at: 1000000000,
        label: "1B-token day",
      },
      {
        at: 5000000000,
        label: "5B-token day",
      },
      {
        at: 10000000000,
        label: "10B-token day",
      },
    ],
  },
  {
    id: "podium",
    emoji: "🏆",
    name: "Podium",
    group: "Social",
    how: "Finish a day in the top 3 of the town",
    tiers: [
      {
        at: 1,
        label: "1 podium",
      },
      {
        at: 10,
        label: "10 podiums",
      },
      {
        at: 50,
        label: "50 podiums",
      },
      {
        at: 200,
        label: "200 podiums",
      },
    ],
  },
  {
    id: "octopus",
    emoji: "🐙",
    name: "Octopus",
    group: "Usage",
    how: "Agents running at once",
    tiers: [
      {
        at: 5,
        label: "5 agents at once",
      },
      {
        at: 10,
        label: "10 agents at once",
      },
      {
        at: 20,
        label: "20 agents at once",
      },
    ],
  },
  {
    id: "shipper",
    emoji: "🚢",
    name: "Shipper",
    group: "Usage",
    how: "Open pull requests",
    tiers: [
      {
        at: 10,
        label: "10 PRs",
      },
      {
        at: 50,
        label: "50 PRs",
      },
      {
        at: 250,
        label: "250 PRs",
      },
      {
        at: 1000,
        label: "1000 PRs",
      },
    ],
  },
  {
    id: "shark",
    emoji: "🦈",
    name: "Shark",
    group: "Games",
    how: "Win games",
    tiers: [
      {
        at: 5,
        label: "5 wins",
      },
      {
        at: 25,
        label: "25 wins",
      },
      {
        at: 100,
        label: "100 wins",
      },
      {
        at: 500,
        label: "500 wins",
      },
    ],
  },
  {
    id: "whale",
    emoji: "🐋",
    name: "Whale",
    group: "Games",
    how: "Win a big pot",
    tiers: [
      {
        at: 500,
        label: "500-coin pot",
      },
      {
        at: 2000,
        label: "2000-coin pot",
      },
      {
        at: 5000,
        label: "5000-coin pot",
      },
      {
        at: 10000,
        label: "10000-coin pot",
      },
    ],
  },
  {
    id: "founder",
    emoji: "🏢",
    name: "Founder",
    group: "Town",
    how: "Own a company",
    tiers: [
      {
        at: 1,
        label: "Founder",
      },
    ],
  },
  {
    id: "picnic",
    emoji: "🧺",
    name: "I was there",
    group: "Seasonal",
    how: "Sit on a blanket at an outage picnic",
    tiers: [
      {
        at: 1,
        label: "I was there",
      },
      {
        at: 5,
        label: "5 outage picnics",
      },
    ],
  },
  {
    id: "shipdays",
    emoji: "📦",
    name: "Ship days",
    group: "Usage",
    how: "Open a PR on different days",
    tiers: [
      {
        at: 10,
        label: "PRs on 10 days",
      },
      {
        at: 30,
        label: "PRs on 30 days",
      },
      {
        at: 100,
        label: "PRs on 100 days",
      },
    ],
  },
  {
    id: "polyglot",
    emoji: "🗣️",
    name: "Polyglot",
    group: "Usage",
    how: "Use different models (100k tokens each)",
    tiers: [
      {
        at: 3,
        label: "3 models",
      },
      {
        at: 6,
        label: "6 models",
      },
      {
        at: 10,
        label: "10 models",
      },
    ],
  },
  {
    id: "cache",
    emoji: "🧙",
    name: "Cache wizard",
    group: "Usage",
    how: "Share of your tokens read from cache, after 50M tokens (your tool matters too)",
    tiers: [
      {
        at: 80,
        label: "80% cache hits",
      },
      {
        at: 90,
        label: "90% cache hits",
      },
      {
        at: 95,
        label: "95% cache hits",
      },
    ],
  },
  {
    id: "longrun",
    emoji: "🏃",
    name: "Longest run",
    group: "Usage",
    how: "Your best run of days in a row with tokens",
    tiers: [
      {
        at: 14,
        label: "14-day run",
      },
      {
        at: 60,
        label: "60-day run",
      },
      {
        at: 200,
        label: "200-day run",
      },
    ],
  },
  {
    id: "raider",
    emoji: "⚔️",
    name: "Raider",
    group: "Raid",
    how: "Join in felling raid bosses",
    tiers: [
      {
        at: 1,
        label: "1 boss felled",
      },
      {
        at: 10,
        label: "10 bosses felled",
      },
      {
        at: 50,
        label: "50 bosses felled",
      },
    ],
  },
  {
    id: "hunter",
    emoji: "🎒",
    name: "Hunter",
    group: "Raid",
    how: "Collect the raid's loot",
    tiers: [
      {
        at: 1,
        label: "1 loot piece",
      },
      {
        at: 5,
        label: "5 loot pieces",
      },
      {
        at: 16,
        label: "16 loot pieces",
      },
    ],
  },
  {
    id: "regular",
    emoji: "🎲",
    name: "Regular",
    group: "Games",
    how: "Finish games",
    tiers: [
      {
        at: 10,
        label: "10 games",
      },
      {
        at: 50,
        label: "50 games",
      },
      {
        at: 250,
        label: "250 games",
      },
    ],
  },
  {
    id: "allgames",
    emoji: "🎯",
    name: "Variety",
    group: "Games",
    how: "Play every kind of game",
    tiers: [
      {
        at: 2,
        label: "2 kinds of game",
      },
      {
        at: 4,
        label: "4 kinds of game",
      },
      {
        at: 5,
        label: "5 kinds of game",
      },
    ],
  },
  {
    id: "tavern",
    emoji: "🍺",
    name: "Tavern regular",
    group: "Town",
    how: "Spend time in the Tavern on different days",
    tiers: [
      {
        at: 7,
        label: "7 days at the Tavern",
      },
      {
        at: 30,
        label: "30 days at the Tavern",
      },
      {
        at: 100,
        label: "100 days at the Tavern",
      },
    ],
  },
  {
    id: "helper",
    emoji: "🤝",
    name: "Helper",
    group: "Social",
    how: "Clear the town's daily quests",
    tiers: [
      {
        at: 1,
        label: "1 quest cleared",
      },
      {
        at: 10,
        label: "10 quests cleared",
      },
      {
        at: 50,
        label: "50 quests cleared",
      },
    ],
  },
] as const;
export const TIER_COLORS = TIER_COLOR;
