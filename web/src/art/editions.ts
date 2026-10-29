import { caseAt } from "@tokenmaxxing/core/case.ts";
import { costumeAt } from "@tokenmaxxing/core/costumes.ts";
import { editionAt } from "@tokenmaxxing/core/editions.ts";
import type { Item } from "@tokenmaxxing/core/shop.ts";
import type { Look } from "@tokenmaxxing/core/world.ts";
import { CASE_GLASSES, CASE_HATS } from "./case.ts";
import type { View } from "./characters.ts";
import { C } from "./palette.ts";
import { bake, type Palette, type Pen } from "./pixels.ts";

/**
 * Merchant editions (`core/src/editions.ts`) and holiday costumes (`core/src/costumes.ts`), drawn like the
 * shop's hats and glasses in `characters.ts`: hats over the head from row 0, glasses over the eyes from row 5. A grid per view;
 * a missing side or back view is the front one. Keyed by item id, so the catalog order is free.
 */

export interface Art {
  down: string[];
  side?: string[];
  up?: string[];
  pal: Palette;
}

const o = C.ink;

// Pixel art reads as a grid.
// prettier-ignore
const HATS: Record<string, Art> = {
  // Prompt wizard hat: a starry cone, bent at the tip, on a wide brim.
  "hat.100": {
    down: ["........oo......", ".......opPo.....", "......opypPo....", ".....oppppyPo...", "..oBBBBBBBBBBBo."],
    pal: { o, p: "#6a4bc4", P: "#4d3596", y: "#f5d14a", B: "#3b2a78" },
  },
  // Green-CI halo: a glowing ring, tilted, over the hair.
  "hat.101": {
    down: [".....GGGGGG.....", "....G......G....", ".....gggggg....."],
    pal: { g: "#b6ffc6", G: "#3ddc84" },
  },
  // Release party hat: a striped cone with a bobble.
  "hat.102": {
    down: [".......yy.......", "......oppo......", "......owwo......", ".....oppppo.....", ".....owwwwo....."],
    pal: { o, y: "#f5d14a", p: "#e8584f", w: "#fbf7ef" },
  },
  // Propeller beanie: four panels and a spinner on top.
  "hat.103": {
    down: ["..rrrr.oo.bbbb..", ".....ooKKoo.....", "....oyyrrbbo....", "...oyyyrrbbbo...", "...oYYYYYYYYo..."],
    side: ["....rr.oo.bb....", ".....ooKKoo.....", "....oyyrrbbo....", "...oyyyrrbbbo...", "...oYYYYYYYYYo.."],
    pal: { o, r: "#e0584f", b: "#4f8fe0", y: "#f5d14a", Y: "#c9971f", K: "#5d6470" },
  },
  // Spaghetti chef's toque: puffed top, pleats, and a noodle on the band.
  "hat.104": {
    down: ["....oo.oo.oo....", "...owwowwowwo...", "...owwwwwwwwo...", "....oWwWwWwo....", "...oWyWWyyWWo..."],
    pal: { o, w: "#fbf7ef", W: "#dcd6cc", y: "#f0c45a" },
  },
  // Friday deploy stetson: a dented crown, a red band and a curled brim.
  "hat.105": {
    down: ["................", ".....oooooo.....", "....obbBbbbo....", "oo.orrrrrrrro.oo", ".obbbbbbbbbbbbo."],
    side: ["................", ".....oooooo.....", "....obbBbbbo....", "...orrrrrrrro.oo", "..obbbbbbbbbbbo."],
    pal: { o, b: "#9a6a3c", B: "#6e4a2a", r: "#c23a3a" },
  },
  // Force-push helm: a riveted dome, a gold band and two horns.
  "hat.106": {
    down: [".w............w.", ".ww..oooooo..ww.", "..wwoMMMMMMoww..", "...oMMMmMMMMo...", "...oYYYYYYYYo..."],
    side: ["......w.........", ".....wwoooooo...", "......woMMMMMo..", "...oMMMmMMMMo...", "...oYYYYYYYYo..."],
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
    down: [".....oooooo.....", "...orrwwrrrro...", "..orrrrrrwwrro..", ".orwwrrrrrrrrro.", ".oRRRRRRRRRRRRo."],
    pal: { o, r: "#d9574a", R: "#b0443a", w: "#fbf7ef" },
  },
  // Borrowed-token tricorn: black, gold-trimmed, a coin on the front.
  "hat.110": {
    down: ["..o..........o..", "..oko.oooo.oko..", "..okkokkkkokko..", "..okkkkykkkkko..", "...oYYYYYYYYo..."],
    up: ["..o..........o..", "..oko.oooo.oko..", "..okkokkkkokko..", "..okkkkkkkkkko..", "...oYYYYYYYYo..."],
    pal: { o, k: "#2f2a3a", y: "#f5c842", Y: "#c9971f" },
  },
  // 429 bucket hat: teal canvas, a red tag, a floppy brim.
  "hat.111": {
    down: ["................", ".....oooooo.....", "....oaaaaaao....", "....oaaaarao....", "..oAAAAAAAAAAo.."],
    pal: { o, a: "#4fb3a9", A: "#3a8c84", r: "#e0584f" },
  },
  // Benchmark laurels: a wreath round the head, tied with gold.
  "hat.112": {
    down: ["................", ".....l....l.....", "....lL....Ll....", "...lLl....lLl...", "..lLlyyyyyylLl.."],
    up: ["................", ".....l....l.....", "....lL....Ll....", "...lLl....lLl...", "..lLlLlLlLllLl.."],
    pal: { l: "#72bf52", L: "#3a7b2f", y: "#f5c842" },
  },
  // Copenhagen ushanka: brown fur, a light fur band, ear flaps, and a little Dannebrog.
  "hat.113": {
    down: ["................", "....oooooooo....", "...offfrwfffo...", "..oFFFFFFFFFFo..", "..oFo......oFo..", "..oFo......oFo..", "...o........o..."],
    side: ["................", "....oooooooo....", "...offffffffo...", "..oFFFFFFFFFFo..", "...oFFo.........", "...oFFo.........", "....oo.........."],
    up: ["................", "....oooooooo....", "...offffffffo...", "..oFFFFFFFFFFo..", "..oFo......oFo..", "..oFo......oFo..", "...o........o..."],
    pal: { o, f: "#6b4a34", F: "#c9a27a", r: "#c8102e", w: "#fbf7ef" },
  },
  // Holiday costumes (`core/src/costumes.ts`), drawn the same way.
  // Jack-o'-lantern: a carved pumpkin over the hair, its eyes and grin lit, a green stem on top.
  "hat.200": {
    down: [".......gG.......", "....oooooooo....", "...opPppppPpo...", "...opYpPPpYpo...", "...oPpYYYYpPo...", "....oooooooo...."],
    side: [".......gG.......", "....oooooooo....", "...opPpppPppo...", "...opPpppPYpo...", "...opPppPYYpo...", "....oooooooo...."],
    up: [".......Gg.......", "....oooooooo....", "...opPppppPpo...", "...oPpPppPpPo...", "...opPppppPpo...", "....oooooooo...."],
    pal: { o, p: "#e8772a", P: "#c25a1c", Y: "#ffd04a", g: "#5a8a2a", G: "#3f6b1f" },
  },
  // Kattekonge crown: gold points, a red jewel between two black cat's ears.
  "hat.201": {
    down: ["...Y...YY...Y...", "...YY.YYYY.YY...", "...oYYYYYYYYo...", "...oYrYkkYrYo...", "...oyyyyyyyyo..."],
    side: ["....Y...Y...Y...", "....YY.YYY.YY...", "....oYYYYYYYYo..", "....oYYkkYYrYo..", "....oyyyyyyyyo.."],
    pal: { o, Y: "#f5c842", y: "#c9971f", r: "#e8584f", k: o },
  },
};

// Pixel art reads as a grid.
// prettier-ignore
const GLASSES: Record<string, Art> = {
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

const artOf = (slot: "hat" | "glasses", index: number): Art | undefined => {
  const e = editionAt(slot, index) ?? costumeAt(slot, index) ?? caseAt(slot, index);
  // The cases' hats and glasses (the Night Market's and the Nusantara's) are drawn in `case.ts`.
  return e && ((slot === "hat" ? HATS : GLASSES)[e.id] ?? (slot === "hat" ? CASE_HATS : CASE_GLASSES)[e.id]);
};

/** Draws `look`'s editions and costume over a character frame (`characterFrame`, `sleeperFrame`). */
export function drawEditions(p: Pen, look: Look, view: View, flip = false, oy = 0): void {
  const glasses = artOf("glasses", look.glasses);
  if (glasses && view !== "up") p.grid(glasses[view] ?? glasses.down, glasses.pal, 0, 5 + oy, flip);
  const hat = artOf("hat", look.hat);
  if (hat) p.grid(hat[view] ?? hat.down, hat.pal, 0, oy, flip);
}

/** An edition on its own, as tall as it is, for the bag, the cart and the floor (`itemFrame`). */
export function editionFrame(item: Item): HTMLCanvasElement | null {
  if (item.slot !== "hat" && item.slot !== "glasses") return null;
  const art = artOf(item.slot, item.index);
  return art ? bake(16, art.down.length, (p) => p.grid(art.down, art.pal)) : null;
}
