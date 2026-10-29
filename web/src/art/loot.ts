import { LOOT } from "@tokenmaxxing/core/loot.ts";
import { itemsIn } from "@tokenmaxxing/core/shop.ts";
import type { Look } from "@tokenmaxxing/core/world.ts";
import { TILE } from "@tokenmaxxing/core/world.ts";
import type { View } from "./characters.ts";
import { C } from "./palette.ts";
import { bake, once, type Palette, perObject } from "./pixels.ts";

/**
 * The raid's loot (core/src/loot.ts), drawn like the shop's: hats, glasses and outfits are 16-wide grids
 * over the character (characters.ts appends them to its own), pets are 12×10 with two hop frames
 * (pets.ts appends them), trophies are furniture (objects.ts asks `trophyAt`). Plus the sparkle round
 * anyone wearing a legendary.
 */

/** Hats from `LOOT_FIRST.hat` on (after the head pack), from row 0 of the head. */
// Pixel art reads as a grid.
// prettier-ignore
export const LOOT_HATS: { rows: Record<View, string[]>; pal: Palette }[] = [
  // Hourglass hat: a little hourglass on a wooden brim.
  {
    rows: {
      down: ["....okkkkkko....", ".....ogyyyo.....", "......oyyo......", ".....oyyyyo.....", "...okKKKKKKko..."],
      side: ["....okkkkkko....", ".....ogyyyo.....", "......oyyo......", ".....oyyyyo.....", "...okKKKKKKKko.."],
      up: ["....okkkkkko....", ".....ogyyyo.....", "......oyyo......", ".....oyyyyo.....", "...okKKKKKKko..."],
    },
    pal: { o: C.ink, k: "#b57c4b", K: "#8c5c36", y: "#f2c46b", g: "#cfeaf5" },
  },
  // Infinite Context Crown: a wide gold crown with ∞ across its band.
  {
    rows: {
      down: ["...y.y.yy.y.y...", "...yyccyyccyy...", "...ycyyccyycy...", "...yyccyyccyy...", "...YYYYYYYYYY..."],
      side: ["...y.y.yy.y.y...", "...yyccyyccyy...", "...ycyyccyycy...", "...yyccyyccyy...", "...YYYYYYYYYY..."],
      up: ["...y.y.yy.y.y...", "...yyyyyyyyyy...", "...yyyyyyyyyy...", "...yyyyyyyyyy...", "...YYYYYYYYYY..."],
    },
    pal: { y: "#f5c842", Y: "#c9971f", c: "#5ff0ff" },
  },
  // <<<<<<< HEAD band: a conflict-red headband, its knot hanging off the back.
  {
    rows: {
      down: ["................", "................", "................", "..obbbbbbbbbbo..", "..obwbbwbbwbbobb"],
      side: ["................", "................", "................", "..obbbbbbbbbbo..", "bbobwbbwbbwbo..."],
      up: ["................", "................", "................", "..obbbbbbbbbbo..", "..obbbbbbbbbbobb"],
    },
    pal: { o: C.ink, b: "#e0584f", w: C.white },
  },
  // Mirage Crown: the Hallucination’s purple swirls, watchful eyes and golden stars.
  {
    rows: {
      down: ["..g.v..gg..v.g..", "....vv.pp.vv....", "...vwwvppvwwv...", "...vwkvppvwkv...", "...ddddggdddd..."],
      side: ["..g.v..gg..v.g..", "....vv.pp.vv....", "...vvvppwwvvv...", "...vvvwpkwvvv...", "...ddddggdddd..."],
      up: ["..g.v......v.g..", "....vv.vv.vv....", "...vvvvvvvvvv...", "...vpvvpvvvpv...", "...ddddggdddd..."],
    },
    pal: { v: "#9b6fd6", p: "#d9c2f5", d: "#4a2a73", g: "#ffd35c", w: "#fffdf6", k: C.ink },
  },
  // Paid in Full crown: gold, with a green band and a white tick on it.
  {
    rows: {
      down: ["...y.y.yy.y.y...", "...yyyyyyyyyy...", "...yggwgggwgy...", "...yggggwgggy...", "...YYYYYYYYYY..."],
      side: ["...y.y.yy.y.y...", "...yyyyyyyyyy...", "...yggwgggwgy...", "...yggggwgggy...", "...YYYYYYYYYY..."],
      up: ["...y.y.yy.y.y...", "...yyyyyyyyyy...", "...yggggggggy...", "...yggggggggy...", "...YYYYYYYYYY..."],
    },
    pal: { y: "#f5c842", Y: "#c9971f", g: "#3fae5a", w: C.white },
  },
];

/** Glasses from `LOOT_FIRST.glasses` on (after the head pack), over rows 5–7 of the head. */
// Pixel art reads as a grid.
// prettier-ignore
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
// Pixel art reads as a grid.
// prettier-ignore
export const LOOT_OUTFITS: { colors: [string, string]; pants: string; over: Record<View, string[]>; pal: Palette }[] = [
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
      down: ["...pq..yy..qp...", "..pq........qp..", "..pq........qp..", "..qp........pq..", "..pq........qp..", "...q........q..."],
      side: ["....pq..........", "...pqp..........", "...pq...........", "..pqp...........", "..qpq...........", "..pq............"],
      up: ["....pqpqpqpq....", "...pqpqpqpqpq...", "...qpqpqpqpqp...", "...pqpqpqpqpq...", "...qpqpqpqpqp...", "....pqpqpqpq...."],
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
// Pixel art reads as a grid.
// prettier-ignore
export const LOOT_PETS: { frames: [string[], string[]]; pal: Palette }[] = [
  // Sand golem: a block of every second you waited, eyes glowing.
  {
    frames: [
      ["............", ".....oooooo.", "....osSsssso", "....ossysyso", "..ooosssssso", ".osSosSssSo.", ".osssssssso.", ".oSsssssSso.", "..oso..oso..", "..oo....oo.."],
      [".....oooooo.", "....osSsssso", "....ossysyso", "..ooosssssso", ".osSosSssSo.", ".osssssssso.", ".oSsssssSso.", "..oso..oso..", ".oo......oo.", "............"],
    ],
    pal: { o: C.ink, s: "#e3c07a", S: "#b8934e", y: "#ff9a3c" },
  },
  // Goldfish: floating along, a bubble at a time. It forgot already.
  {
    frames: [
      ["..........w.", "......ooo...", ".o...ogggo..", "ogo.ogggego.", "oggoggggggGo", "ogo.oggggGo.", ".o...ooooo..", "............", "............", "............"],
      ["......ooo..w", ".o...ogggo..", "ogo.ogggego.", "oggoggggggGo", "ogo.oggggGo.", ".o...ooooo..", "............", "............", "............", "............"],
    ],
    pal: { o: C.ink, g: "#ff8a3c", G: "#d9622b", e: C.white, w: "#a8dcf7" },
  },
  // Forked cat: two tails, one history.
  {
    frames: [
      ["............", "t..b...o..o.", "t..b..obooba", ".t.b..obbbbo", "..tb..oebebo", "...o.obbnbbo", "..oooobbbbo.", ".obbbbbbbo..", ".obobbbobo..", ".o.o..o.o..."],
      ["t..b...o..o.", "t..b..obooba", ".t.b..obbbbo", "..tb..oebebo", "...o.obbnbbo", "..oooobbbbo.", ".obbbbbbbo..", ".obobbbobo..", "o.o....o.o..", "............"],
    ],
    pal: { o: C.ink, b: "#8a93a1", a: "#8a93a1", t: "#f0a04b", e: C.ink, n: "#e0584f" },
  },
  // Ghost: it says it exists.
  {
    frames: [
      ["............", "....oooo....", "...owwwwo...", "..owwwwwwo..", "..owkwwkwo..", "..owwwwwwo..", "..owwwwwwwo.", "..owwwwwwwo.", "..owowwowo..", "..o.o..o.o.."],
      ["....oooo....", "...owwwwo...", "..owwwwwwo..", "..owkwwkwo..", "..owwwwwwo..", "..owwwwwwwo.", "..owwwwwwwo.", "..oowwowwo..", "...o.o..o.o.", "............"],
    ],
    pal: { o: "#7a7f9a", w: "#f4f6ff", k: C.ink },
  },
  // Piggy bank: a coin dropping in the slot, every one you owe.
  {
    frames: [
      ["....yy......", "..oooooo.oo.", ".obbkkbboboo", ".obbbbbbbbbo", "obbbbbbbebss", "obbbbbbbbbsn", ".obbbbbbbbbo", ".obbbbbbbbo.", "..obo..obo..", "..ooo..ooo.."],
      ["..oooooo.oo.", ".obbkkbboboo", ".obbbbbbbbbo", "obbbbbbbebss", "obbbbbbbbbsn", ".obbbbbbbbbo", ".obbbbbbbbo.", "..obo..obo..", "..ooo..ooo..", "............"],
    ],
    pal: { o: C.ink, b: "#f0a0b8", k: "#7a2a3f", y: "#ffd35c", e: C.ink, s: "#f7c0d0", n: "#c05070" },
  },
];

const GOLD = "#f5c842";
const GOLD_DARK = "#c9971f";
const GOLD_LIGHT = "#fff1a8";

/** The Golden Hourglass: gold frame, sand that never runs out, on a dark plinth. */
const hourglass = once(() =>
  bake(16, 24, (p) => {
    p.rect(2, 22, 12, 2, C.shadow);
    p.rect(2, 18, 12, 5, C.ink);
    p.rect(3, 19, 10, 3, "#3a3546");
    p.rect(3, 19, 10, 1, "#5a5468");
    // Top and bottom bars, and the posts.
    p.rect(2, 0, 12, 3, C.ink);
    p.rect(3, 1, 10, 1, GOLD);
    p.rect(2, 15, 12, 3, C.ink);
    p.rect(3, 16, 10, 1, GOLD);
    p.rect(3, 3, 1, 12, GOLD_DARK);
    p.rect(12, 3, 1, 12, GOLD_DARK);
    // The glass: wide, pinched, wide.
    for (let y = 0; y < 12; y++) {
      const half = Math.max(1, Math.abs(y - 5.5) * 0.8 + 0.5);
      const x0 = Math.round(8 - half);
      const w = Math.round(half * 2);
      p.rect(x0 - 1, 3 + y, w + 2, 1, C.ink);
      p.rect(x0, 3 + y, w, 1, "#e9f6fb");
      // Sand: a little left on top, a heap below, a thread between.
      if (y >= 2 && y <= 4) p.rect(x0, 3 + y, w, 1, "#f2c46b");
      if (y >= 8) p.rect(x0, 3 + y, w, 1, y === 8 ? GOLD_LIGHT : "#f2c46b");
    }
    p.px(8, 8, "#f2c46b");
    p.px(8, 9, "#f2c46b");
    p.px(5, 4, C.white);
  }),
);

/** The Golden Rebase: a gold cup on a plinth, with one clean line of commits across it. */
const rebase = once(() =>
  bake(16, 22, (p) => {
    p.rect(2, 20, 12, 2, C.shadow);
    p.rect(3, 16, 10, 5, C.ink);
    p.rect(4, 17, 8, 3, "#3a3546");
    p.rect(4, 17, 8, 1, "#5a5468");
    p.rect(6, 12, 4, 4, C.ink);
    p.rect(7, 12, 2, 4, GOLD_DARK);
    // The cup and its handles.
    p.rect(1, 2, 14, 2, C.ink);
    p.rect(0, 3, 3, 5, C.ink);
    p.rect(13, 3, 3, 5, C.ink);
    p.rect(1, 4, 1, 3, GOLD_DARK);
    p.rect(14, 4, 1, 3, GOLD_DARK);
    p.rect(2, 2, 12, 9, C.ink);
    p.rect(3, 3, 10, 7, GOLD);
    p.rect(4, 10, 8, 2, C.ink);
    p.rect(5, 10, 6, 1, GOLD_DARK);
    p.rect(3, 3, 10, 1, GOLD_LIGHT);
    // A straight history: four commits on one line.
    p.rect(4, 6, 8, 1, C.ink);
    for (const x of [4, 6, 9, 11]) p.rect(x, 5, 1, 3, C.ink);
    p.px(4, 6, "#5aa8ff");
    p.px(11, 6, "#5aa8ff");
    p.px(4, 3, C.white);
  }),
);

const TROPHY_ART: Record<string, () => HTMLCanvasElement> = { Y: hourglass, V: rebase };

/** A trophy on its tile (`objectAt`), standing on the tile's bottom edge like the other furniture. */
export function trophyAt(
  ch: string | undefined,
): { canvas: HTMLCanvasElement; dx: number; dy: number } | null {
  const art = ch ? TROPHY_ART[ch] : undefined;
  if (!art) return null;
  const canvas = art();
  return { canvas, dx: 0, dy: TILE - canvas.height };
}

// MARK: Legendary

/** Whether a look wears a legendary, worked out once per look: they sparkle in the world. */
const LEGENDARY = new Set(LOOT.filter((l) => l.rarity === "legendary").map((l) => l.id));
export const wearsLegendary = perObject((look: Look): boolean =>
  itemsIn(look).some((i) => LEGENDARY.has(i.id)),
);

/**
 * Twinkles round the head of someone wearing a legendary: a few gold stars that come and go, at
 * (px, py), the top-left of their 16×16 frame. Each star a plus at its brightest, a dot otherwise.
 */
export function drawSparkle(
  g: CanvasRenderingContext2D,
  px: number,
  py: number,
  now: number,
  seed: number,
): void {
  for (let i = 0; i < 4; i++) {
    const t = (((now / 900 + i * 0.27 + seed * 0.13) % 1) + 1) % 1;
    if (t > 0.6) continue;
    const a = i * 1.7 + seed + Math.floor(now / 900 + i * 0.27 + seed * 0.13) * 2.3;
    const x = Math.round(px + 8 + Math.cos(a) * 9);
    const y = Math.round(py + 3 + Math.sin(a) * 6 - t * 4);
    g.globalAlpha = 1 - t / 0.6;
    g.fillStyle = t < 0.3 ? C.white : GOLD;
    g.fillRect(x, y, 1, 1);
    if (t < 0.3) {
      g.fillStyle = GOLD;
      g.fillRect(x - 1, y, 1, 1);
      g.fillRect(x + 1, y, 1, 1);
      g.fillRect(x, y - 1, 1, 1);
      g.fillRect(x, y + 1, 1, 1);
    }
  }
  g.globalAlpha = 1;
}
