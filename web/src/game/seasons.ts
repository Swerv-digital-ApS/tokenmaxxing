import {
  bakedLook,
  lookKey,
  pinnedDay,
  type Season,
  type SeasonLook,
  seasonLook,
  seasonOfDay,
  townDay,
} from "@tokenmaxxing/core/seasons.ts";
import { C, rgbOf } from "../art/palette.ts";
import { hash } from "../art/pixels.ts";
import { hud } from "../store.ts";
import { skyNow } from "./sky.ts";

/**
 * The town's season (`core/src/seasons.ts`) on the canvas: each baked tree, bush and ground canvas gets a twin for
 * the season's look, made from its pixels when the look changes (every few days while the town turns) and drawn
 * in its place. Trees turn orange, yellow and red a few leaves at a time, drop them to bare branches, and blossom
 * in spring; fallen leaves lie on the grass.
 *
 * Dev override in the page URL: `?season=autumn` (spring, summer, autumn, winter) or a date, `?season=11-12`. The
 * server's `SKY_SEASON` pins it for everyone.
 */

const urlPin = pinnedDay(new URLSearchParams(location.search).get("season") ?? "");

/** The day of the year the town shows: the date's (moved by `?sky=`), unless it is pinned. */
export const seasonDayNow = (): number => townDay(skyNow(), urlPin ?? hud.get().seasonDay);
export const seasonNow = (): Season => seasonOfDay(seasonDayNow());

let shown: { minute: number; pin: number | null; look: SeasonLook; key: string } | null = null;

/** The season's look now and its `lookKey`, worked out again once a minute (it moves over days). */
export function seasonLookNow(): { look: SeasonLook; key: string } {
  const minute = Math.floor(skyNow() / 60_000);
  const pin = urlPin ?? hud.get().seasonDay;
  if (shown?.minute === minute && shown.pin === pin) return shown;
  const look = seasonLook(seasonDayNow());
  shown = { minute, pin, look, key: lookKey(look) };
  return shown;
}

// MARK: Colours

type RGB = readonly [number, number, number];
const mix = (a: RGB, b: RGB, t: number): RGB => [
  Math.round(a[0] + (b[0] - a[0]) * t),
  Math.round(a[1] + (b[1] - a[1]) * t),
  Math.round(a[2] + (b[2] - a[2]) * t),
];
const rgb = (hexes: readonly string[]): RGB[] => hexes.map(rgbOf);
const pack = (r: number, g: number, b: number) => (r << 16) | (g << 8) | b;

/** Canopy shades, in this order: mid, dark, light, outline. */
const LEAVES = rgb([C.leaf, C.leafDark, C.leafLight, C.leafInk]);
const FRESH = rgb(["#7cc24a", "#5fa23c", "#a8dc6c", "#3d7a2c"]);
const RESTING = rgb(["#5b7f4c", "#486a3e", "#76966a", "#34502f"]);
const AUTUMN = [
  rgb(["#e08a3a", "#b8612a", "#f5b05a", "#7a3a1e"]),
  rgb(["#e8bf3e", "#c0922a", "#f6dc72", "#7a5a1c"]),
  rgb(["#d4483a", "#a6302c", "#ee7a5a", "#6a221e"]),
];
const BLOSSOM = [rgb(["#f6b8d0", "#e889b2", "#fde4ee"]), rgb(["#fbf3f0", "#e6ddd6", "#ffffff"])];
const BRANCH = rgbOf("#6e5040");
const BRANCH_DARK = rgbOf(C.trunkDark);

const GRASS = rgb([C.grass, C.grassDark, C.grassLight]);
const GRASS_FRESH = rgb(["#9bd46c", "#7ab955", "#bdea90"]);
const GRASS_DRY = rgb(["#aeb062", "#90914e", "#c8c67a"]);
const GRASS_RESTING = rgb(["#9cae88", "#819570", "#b5c7a0"]);
const FLOWERS = new Set([C.flowerRed, C.flowerYellow, C.flowerWhite].map((h) => pack(...rgbOf(h))));
const PATHS = new Set([C.path, C.pathDark, C.pathLight].map((h) => pack(...rgbOf(h))));
const LITTER = rgb(["#d77a34", "#e4b23c", "#c4442f", "#9a5a2a", "#b86a2c"]);

const leafIndex = new Map(LEAVES.map((c, i) => [pack(...c), i]));
const grassIndex = new Map(GRASS.map((c, i) => [pack(...c), i]));

/** A grass shade on the day: fresh in spring, a little dry as the leaves turn, dull at rest. */
const grassOf = (i: number, l: SeasonLook): RGB => {
  let c = mix(GRASS[i]!, GRASS_FRESH[i]!, l.fresh * 0.8);
  c = mix(c, GRASS_DRY[i]!, l.turn * l.leaf * 0.45);
  return mix(c, GRASS_RESTING[i]!, l.dormant * 0.85);
};

/**
 * The bare tree's branches (the 2D tree sprite is 16 by 26, its canopy a disc round (8, 9)): drawn under the
 * leaves, so they show where the leaves have gone.
 */
const BRANCHES: readonly (readonly [number, number])[] = [
  [7, 15],
  [8, 15],
  [7, 14],
  [8, 13],
  [8, 12],
  [8, 11],
  [8, 10],
  [8, 9],
  [9, 8],
  [9, 7],
  [8, 6],
  [8, 5],
  [7, 4],
  [6, 13],
  [5, 12],
  [4, 11],
  [3, 10],
  [3, 9],
  [2, 8],
  [5, 11],
  [5, 10],
  [6, 9],
  [6, 8],
  [5, 7],
  [4, 6],
  [9, 13],
  [10, 12],
  [11, 11],
  [12, 10],
  [12, 9],
  [13, 8],
  [13, 7],
  [11, 10],
  [10, 9],
  [10, 8],
  [11, 7],
  [11, 6],
  [12, 5],
];

export type Plant = "tree" | "bush" | "ground";

/** Trees come in three variants: each turns a colour of its own, a little earlier or later, and blossoms or not. */
export const TREE_VARIANTS = 3;

/** Paints `l` into a copy of `src`, whose pixels are the town's palette. */
function paint(src: HTMLCanvasElement, plant: Plant, variant: number, l: SeasonLook): HTMLCanvasElement {
  const out = document.createElement("canvas");
  out.width = src.width;
  out.height = src.height;
  const g = out.getContext("2d")!;
  g.drawImage(src, 0, 0);
  const image = g.getImageData(0, 0, out.width, out.height);
  const d = image.data;
  const w = out.width;
  const put = (i: number, c: RGB) => {
    d[i] = c[0];
    d[i + 1] = c[1];
    d[i + 2] = c[2];
  };
  if (plant === "ground") {
    for (let i = 0; i < d.length; i += 4) {
      const x = (i / 4) % w;
      const y = Math.floor(i / 4 / w);
      const k = pack(d[i]!, d[i + 1]!, d[i + 2]!);
      const grass = grassIndex.get(k);
      if (grass !== undefined) put(i, grassOf(grass, l));
      // The meadows' flowers rest in winter, a few at a time.
      else if (FLOWERS.has(k) && hash(x >> 2, y >> 2, 71) < l.dormant) put(i, grassOf(0, l));
      // Fallen leaves on the grass, and fewer on the paths (they get swept).
      const litter = grass !== undefined ? 0.07 : PATHS.has(k) ? 0.025 : 0;
      if (litter && hash(x, y, 73) < l.litter * litter)
        put(i, LITTER[Math.floor(hash(x, y, 74) * LITTER.length)]!);
    }
  } else {
    const tree = plant === "tree";
    // Bushes are hedges: they turn less, and keep their leaves (they only rest).
    const leaf = tree ? l.leaf : 1;
    const turn = tree ? l.turn : l.turn * 0.6;
    const early = variant / TREE_VARIANTS;
    const was = Uint8ClampedArray.from(d);
    const shade = (x: number, y: number) =>
      x < 0 || y < 0 || x >= w || y >= out.height
        ? undefined
        : leafIndex.get(pack(was[(y * w + x) * 4]!, was[(y * w + x) * 4 + 1]!, was[(y * w + x) * 4 + 2]!));
    // Leaves fall two by two pixels: a clump stays while `leaf` is above its number.
    const stays = (x: number, y: number) => hash(x >> 1, y >> 1, 75 + variant) * 0.94 + 0.03 < leaf;
    if (tree && leaf < 1)
      for (const [x, y] of BRANCHES) {
        const i = (y * w + x) * 4;
        put(i, x < 8 ? BRANCH_DARK : BRANCH);
        d[i + 3] = 255;
      }
    for (let y = 0; y < out.height; y++)
      for (let x = 0; x < w; x++) {
        const s = shade(x, y);
        if (s === undefined) continue;
        const i = (y * w + x) * 4;
        const ink = s === 3;
        // The outline goes with the leaves it outlines.
        const kept = ink
          ? [
              [1, 0],
              [-1, 0],
              [0, 1],
              [0, -1],
            ].some(([dx, dy]) => {
              const n = shade(x + dx!, y + dy!);
              return n !== undefined && n !== 3 && stays(x + dx!, y + dy!);
            })
          : stays(x, y);
        if (!kept) {
          if (!(tree && BRANCHES.some(([bx, by]) => bx === x && by === y))) d[i + 3] = 0;
          continue;
        }
        let c = mix(LEAVES[s]!, FRESH[s]!, l.fresh * 0.85);
        c = mix(c, RESTING[s]!, tree ? 0 : l.dormant * 0.7);
        // Clumps of four by four turn one by one: earlier on some trees than others.
        const late = hash(x >> 2, y >> 2, 77) * 0.7 + early * 0.3;
        const hue = AUTUMN[(variant + (hash(x >> 2, y >> 2, 78) < 0.25 ? 1 : 0)) % AUTUMN.length]!;
        if (turn > late) c = hue[s]!;
        else c = mix(c, hue[s]!, turn * 0.35);
        // Blossom on two of the three trees: pink and white.
        const bloom = tree && variant < BLOSSOM.length && !ink ? l.blossom : 0;
        if (bloom && hash(x, y, 79) < bloom * 0.5) c = BLOSSOM[variant]![Math.floor(hash(x, y, 80) * 3)]!;
        put(i, c);
      }
  }
  g.putImageData(image, 0, 0);
  return out;
}

const SUMMER = lookKey({ leaf: 1, turn: 0, blossom: 0, fresh: 0, falling: 0, litter: 0, dormant: 0 });
const twins = new WeakMap<HTMLCanvasElement, Map<string, HTMLCanvasElement>>();

/**
 * The twin of a town tree, bush or ground canvas for the season's look (`seasonLookNow`); `variant` picks one of
 * the `TREE_VARIANTS` trees. Kept for the look's key, so a canvas is painted once every few days.
 */
export function seasonalCanvas(
  src: HTMLCanvasElement,
  plant: Plant,
  now: { look: SeasonLook; key: string },
  variant = 0,
): HTMLCanvasElement {
  // High summer is how the canvases are drawn.
  if (now.key === SUMMER) return src;
  const id = `${now.key}:${variant}`;
  const mine = twins.get(src) ?? new Map<string, HTMLCanvasElement>();
  twins.set(src, mine);
  const existing = mine.get(id);
  if (existing) return existing;
  // Only the look on screen is kept: the last one goes when the town turns.
  for (const k of mine.keys()) if (!k.startsWith(`${now.key}:`)) mine.delete(k);
  const out = paint(src, plant, variant, bakedLook(now.look));
  mine.set(id, out);
  return out;
}

/** Which of the `TREE_VARIANTS` the tree drawn at world pixel (`x`, `y`) is. */
export const treeVariant = (x: number, y: number): number => Math.floor(hash(x, y, 61) * TREE_VARIANTS);

const hex = (c: RGB) => `#${c.map((v) => v.toString(16).padStart(2, "0")).join("")}`;

/**
 * A grass shade on the day, for the 3D town's ground: `i` is the 2D palette's (0 grass, 1 dark, 2 light), and
 * `base` a green of the 3D ground's own in place of the palette's.
 */
export function seasonGrass(i: 0 | 1 | 2, l: SeasonLook, base?: string): string {
  if (!base) return hex(grassOf(i, l));
  // The base's own offset from the palette's grass rides along.
  const [r, g, b] = rgbOf(base);
  const [r0, g0, b0] = GRASS[i]!;
  const [r1, g1, b1] = grassOf(i, l);
  const at = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  return hex([at(r1 + r - r0), at(g1 + g - g0), at(b1 + b - b0)]);
}

/** A fallen leaf's colour, `k` 0..1 picking it. */
export const seasonLitter = (k: number): string =>
  hex(LITTER[Math.floor(k * LITTER.length) % LITTER.length]!);
