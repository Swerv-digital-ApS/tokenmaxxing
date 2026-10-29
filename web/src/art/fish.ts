import { FISH } from "@tokenmaxxing/core/fishing.ts";
import { C } from "./palette.ts";
import { bake, type Palette, type Pen } from "./pixels.ts";

/**
 * The pond's fish (`core/src/fishing.ts`), side on and facing right, on a 16x10 grid: the journal draws them, the
 * panel holds up a catch, and the 2D town lifts it out of the water (the 3D town has its own sculptures,
 * `render3d/town/fish3d.ts`). `o` is the outline; `.` is clear. `shift` slides the columns from there one pixel
 * down: the off-by-one bass is never quite where you drew it.
 */
export interface FishArt {
  rows: readonly string[];
  pal: Palette;
  shift?: number;
}

export const FISH_W = 16;
export const FISH_H = 10;

const o = C.ink;
const EYE = { k: "#14121a", w: "#fffdf6" };

// Pixel art reads as a grid.
// prettier-ignore
export const FISH_ART: Record<string, FishArt> = {
  // Pond perch: green with dark bars, a spiny dorsal and orange fins.
  perch: {
    rows: ["......f.f.f.f...", "t....ooooooooo..", "tt..obbsbbsbbso.", "tttobbsbbsbbswko", ".ttobbsbbsbbsbbo", "tttolllllllllllo", "tt..olllllllllo.", "t....ooooooooo..", ".......ff..ff...", "................"],
    pal: { o, ...EYE, b: "#8db56b", s: "#4d6b38", l: "#d9e6b0", f: "#e8873a", t: "#e8873a" },
  },
  // Copper carp: big copper scales, a pale belly and barbels at the lip.
  carp: {
    rows: ["......dddd......", "t....ooooooooo..", "tt..obsbsbsbsbo.", "tttobsbsbsbsbwko", ".ttobbsbsbsbsbbo", "tttolllllllllllo", "tt..olllllllllor", "t....ooooooooo.r", "........ff......", "................"],
    pal: { o, ...EYE, b: "#db9c54", s: "#b8743a", d: "#a8622c", l: "#f3d6a4", f: "#c06a2e", t: "#c06a2e", r: "#8a5a2b" },
  },
  // Sleepy tench: smooth olive, round fins, and its eye mostly shut.
  tench: {
    rows: ["................", "t....ooooooooo..", "tt..obbbbbbbbbo.", "tttobbbbbbbbbkko", ".ttobbbbbbbbbbbo", "tttolllllllllllo", "tt..olllllllllo.", "t....ooooooooo..", ".......fff......", "................"],
    pal: { o, k: "#2b2433", b: "#8fa098", d: "#5f6f66", l: "#c8d2b8", f: "#6d7d73", t: "#6d7d73" },
  },
  // Mossy pike: long and lean, pale spots, a duck-bill jaw with teeth.
  pike: {
    rows: ["................", "................", "..........ff....", "t..oooooooooooo.", "ttobsbbsbbsbbwko", ".tobbsbbsbbsbbbw", "ttollllllllllloo", "t..oooffoooooo..", "................", "................"],
    pal: { o, ...EYE, b: "#6e9275", s: "#c9dca0", l: "#d7e2c4", f: "#577a5c", t: "#577a5c" },
  },
  // Rubber duck: yellow, an orange bill, bobbing.
  duck: {
    rows: ["................", ".......oooo.....", "......oyyyyo....", "......oyykyooo..", "......oyyyyoBBo.", "..o...oyyyyooo..", ".oyoooyyyyyyo...", ".oyyyYYYYyyyyo..", "..oyyyyyyyyyo...", "...ooooooooo...."],
    pal: { o, k: "#14121a", y: "#f3ce59", Y: "#d9a92e", B: "#f08a2c" },
  },
  // Golden koi: gold and white, long flowing fins, a glint either side.
  golden: {
    rows: ["x.....ffff.....x", "t....ooooooooo..", "tt..oggwwgggwgo.", "tttowwggggwwgwko", ".ttoggggwwgggggo", "tttolllllllllllo", "tt..olllllllllo.", "t....ooooooooo..", ".......fff..x...", "................"],
    pal: { o, k: "#14121a", w: "#fffdf6", g: "#f6cc6c", l: "#fbe6ae", f: "#f0a830", t: "#f0a830", x: "#fff3b0" },
  },
  // Water bug: a beetle from above, its shell split down the back, six legs and two feelers.
  bug: {
    rows: ["................", "......ohho......", "..k.ooddddoo.k..", "...odsddddsdo...", "l.odddsddsdddo.l", ".lodddddddddddol", "l.oddddsdddddo.l", "...oodddddddoo..", ".....oooooo.....", "................"],
    pal: { o, h: "#2f3d25", k: "#4f6b3a", d: "#4f6b3a", s: "#9cc27a", l: "#2f3d25" },
  },
  // Legacy boot: an old brown boot, laces and all, dripping.
  boot: {
    rows: ["................", "...oooooo.......", "...obbbbo.......", "...obwbwo.......", "...obbbbo.......", "...obwbwboooo...", ".c.obbbbbbbbbo..", "...obbbbbbbbbbo.", "c..ossssssssssso", "....ooooooooooo."],
    pal: { o, b: "#7a5236", w: "#e8dcc4", s: "#3d2a1e", c: "#7fc4ea" },
  },
  // Red herring: slim, silver below and red on top.
  herring: {
    rows: ["........ff......", "t....ooooooooo..", "tt..obbbbbbbbbo.", "tttobbbbbbbbbwko", ".ttolllllllllllo", "tttolllllllllllo", "tt..olllllllllo.", "t....ooooooooo..", "................", "................"],
    pal: { o, ...EYE, b: "#d9534a", l: "#e9e4e0", f: "#b53a33", t: "#b53a33" },
  },
  // Spaghetti code: a tangle of noodles round a meatball.
  spaghetti: {
    rows: ["................", "......yYyy......", "....yy.yY.yy....", "...y.yYyyYy.y...", "..yYy.yy.yYyy...", "..y.yyommoyy.y..", "...yYyoMmmoYy...", "..y..yommmo..y..", ".y....yooo...Y..", "Y......y......y."],
    pal: { o, y: "#f0d27a", Y: "#c9a24a", m: "#8a4a2a", M: "#c0603a" },
  },
  // Off-by-one bass: a striped bass, its front half one pixel lower than its back.
  offbyone: {
    rows: ["......f.f.f.....", "t....ooooooooo..", "tt..odbdbdbdbdo.", "tttobbbbbbbbbwko", ".ttobbbbbbbbbbbo", "tttolllllllllkko", "tt..olllllllllo.", "t....ooooooooo..", "........ff......", "................"],
    pal: { o, ...EYE, b: "#5f8fb0", d: "#2f5f80", l: "#cfe0ea", f: "#3f6f90", t: "#3f6f90" },
    shift: 8,
  },
  // Memory leak eel: a long grey-violet S, still growing.
  eel: {
    rows: ["................", "..........oooo..", ".........obbbwko", ".oo.....obbbbbbo", "obbo...obblloo..", "obbbo.obblo.....", ".obbbobblo......", "..obbbbllo......", "...ollllo.......", "....oooo........"],
    pal: { o, ...EYE, b: "#5a5f7a", l: "#9a9fb8" },
  },
  // Floating-point fish: plain and pale, but one pixel came loose and drifted off.
  float: {
    rows: ["................", "t....ooooooooo..", "tt..obsbbsbbsbo.", "tttobbbbbbbbbwko", ".ttobsbbsbbsbbbo", "tttolllllllllllo", "tt..olllllllllo.", "t....ooooooooo..", "................", "b..............."],
    pal: { o, ...EYE, b: "#9ad1d4", s: "#5fa8ad", l: "#e1f3f2", t: "#5fa8ad" },
  },
  // Tech-debt kraken: one tentacle, curled at the tip, suckers all the way down.
  kraken: {
    rows: ["................", "...ooooo........", "..obbbbbo.......", ".obsooosbo......", ".obo...obso.....", "..oo....obso....", "........obbso...", ".......obbsbbo..", "......obbbsbbbo.", ".....obbbbsbbbbo"],
    pal: { o, b: "#8a4fbf", s: "#e0b8f0" },
  },
  // Rain trout: silver with a pink stripe and dark spots, out in the rain.
  trout: {
    rows: ["c.......c.......", "t....ooooooooo..", "tt..obsbbbsbbso.", "tttobbbbbbbbbwko", ".ttoppppppppppbo", "tttolllllllllllo", "tt..olllllllllo.", "t....ooooooooo..", "....c..ff..c....", "................"],
    pal: { o, ...EYE, b: "#9fb7c8", d: "#6f8fa8", s: "#3f4f60", p: "#e88aa8", l: "#e6eef2", f: "#7f9fb8", t: "#7f9fb8", c: "#7fc4ea" },
  },
  // Ghost carp: the carp, see-through, with hollow eyes.
  ghost: {
    rows: ["................", "t....ooooooooo..", "tt..obbbbbbbbbo.", "tttobbbbbbbbbkko", ".ttobbbbbbbbbbbo", "tttolllllllllllo", "tt..olllllllllo.", "t....ooooooooo..", "........ff......", "................"],
    pal: { o: "rgba(120,140,170,0.75)", k: "rgba(40,50,70,0.8)", b: "rgba(223,231,239,0.6)", l: "rgba(240,246,252,0.55)", f: "rgba(200,214,230,0.5)", t: "rgba(200,214,230,0.5)" },
  },
  // Friday-deploy puffer: puffed right up, spines out.
  puffer: {
    rows: ["....s.s.s.s.....", "...soooooooos...", "..sobbbbbbbbos..", ".sobbbbbbbwkbos.", "tsobbbbbbbbbbbo.", "ttobllllllllllo.", "tsollllllllllos.", ".sollllllllllos.", "..soooooooooos..", "....s.s.s.s....."],
    pal: { o, ...EYE, b: "#e8b04a", l: "#f6e2a8", s: "#8a6420", t: "#c98a2a" },
  },
  // 1337 bass: green, striped, and wearing its shades.
  leet: {
    rows: ["......f.f.f.....", "t....ooooooooo..", "tt..odbdbdbdbdo.", "tttobbbbbbbkkkko", ".ttobbbbbbbbkbbo", "tttolllllllllkko", "tt..olllllllllo.", "t....ooooooooo..", "........ff......", "................"],
    pal: { o, k: "#14121a", b: "#3ddc84", d: "#1f8a50", l: "#c8f5dc", f: "#1f8a50", t: "#1f8a50" },
  },
  // 404 fish: the hook came up empty, and a question mark where the fish should be.
  notfound: {
    rows: ["........m.......", "........m.......", "...qqq..m.......", "..q...q.m.......", "......q.m.......", ".....q..m...m...", "....q...m...M...", "........mM.mM...", "....q....MMM....", "................"],
    pal: { m: "#c9ced6", M: "#8e95a3", q: "#ffb347" },
  },
};

/** Paints a fish at (`ox`, `oy`); `ghost` greys it out for the journal's not-yet-caught. */
export function drawFish(p: Pen, id: string, ox = 0, oy = 0, ghost = false): void {
  const art = FISH_ART[id];
  if (!art) return;
  const pal = ghost ? silhouette(art.pal) : art.pal;
  if (art.shift === undefined) {
    p.grid(art.rows, pal, ox, oy);
    return;
  }
  // The back columns where drawn, the front ones a pixel lower.
  const back = art.rows.map((r) => r.slice(0, art.shift).padEnd(FISH_W, "."));
  const front = art.rows.map((r) => ".".repeat(art.shift!) + r.slice(art.shift));
  p.grid(back, pal, ox, oy);
  p.grid(front, pal, ox, oy + 1);
}

const silhouette = (pal: Palette): Palette => Object.fromEntries(Object.keys(pal).map((k) => [k, "#3b4556"]));

const baked = new Map<string, HTMLCanvasElement>();

/** A fish baked once at `scale`, for the HUD (`ghost`: the dark silhouette). One pixel of headroom for the shift. */
export function fishCanvas(id: string, scale: number, ghost = false): HTMLCanvasElement {
  const key = `${id}:${scale}:${+ghost}`;
  let c = baked.get(key);
  if (!c) {
    c = bake(FISH_W * scale, (FISH_H + 1) * scale, (p) => {
      p.g.scale(scale, scale);
      drawFish(p, id, 0, 0, ghost);
    });
    baked.set(key, c);
  }
  return c;
}

/** Every fish in the pond has art. */
export const missingFishArt = (): string[] => FISH.filter((f) => !FISH_ART[f.id]).map((f) => f.id);
