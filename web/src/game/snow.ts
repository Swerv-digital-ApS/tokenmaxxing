import { iceOver, snowCover } from "@tokenmaxxing/core/sky.ts";
import { clamp } from "hanzio";
import { C, rgbOf } from "../art/palette.ts";
import { hash } from "../art/pixels.ts";
import { skyNow, weatherNow } from "./sky.ts";

/**
 * Snow on the ground, roofs and trees, and ice on the pond. Each baked canvas (the town's ground, a sprite) gets a
 * snowy twin made once, from its pixels; while the cover fades in or out the render loop draws both, and otherwise
 * just one. The ice is a see-through twin of the ground with only the pond in it, laid over whatever is under. Nothing
 * here runs per frame except numbers moving towards 0 or 1.
 */

/** Seconds for the snow to settle once it starts, and (slowly) to melt after it stops. */
const SETTLE_S = 20;
const MELT_S = 90;

/** A cover easing towards 0 or 1 at its own pace in and out; a page that opens in it starts covered. */
function easer(inS: number, outS: number): (target: boolean, now: number) => number {
  let amount = -1;
  let lastAt = 0;
  return (target, now) => {
    const to = target ? 1 : 0;
    const dt = Math.min(0.1, (now - lastAt) / 1000);
    lastAt = now;
    amount = amount < 0 ? to : amount + clamp(to - amount, -dt / outS, dt / inS);
    return amount;
  };
}

const snowEase = easer(SETTLE_S, MELT_S);
const iceEase = easer(30, 60);

/** How snowy the town is, 0..1: eases in while snow falls (or in winter), melts away slowly after. */
export const snowAmount = (now: number): number => snowEase(snowCover(weatherNow(), skyNow()), now);

/** How iced over the pond is, 0..1: freezes while it's below 0 °C, thaws after. */
export const iceAmount = (now: number): number => iceEase(iceOver(weatherNow()), now);

const key = (r: number, g: number, b: number) => (r << 16) | (g << 8) | b;

const WATER = new Set([C.water, C.waterDark, C.waterLight, C.foam].map((h) => key(...rgbOf(h))));
/** Palette colour to its snowy replacement: grass white, paths trodden grey, the pond iced over. */
const GROUND = new Map<number, [number, number, number]>(
  (
    [
      [C.grass, [244, 248, 255]],
      [C.grassDark, [224, 233, 246]],
      [C.grassLight, [255, 255, 255]],
      [C.path, [204, 208, 216]],
      [C.pathDark, [180, 186, 198]],
      [C.pathLight, [218, 222, 230]],
      [C.plaza, [232, 234, 240]],
      [C.plazaDark, [206, 210, 220]],
      [C.plazaLight, [246, 248, 252]],
      [C.water, [178, 216, 238]],
      [C.waterDark, [150, 198, 226]],
      [C.waterLight, [214, 237, 249]],
      [C.foam, [242, 249, 255]],
      [C.flowerRed, [244, 248, 255]],
      [C.flowerYellow, [244, 248, 255]],
      [C.flowerWhite, [244, 248, 255]],
    ] as const
  ).map(([hex, to]) => [key(...rgbOf(hex)), [...to] as [number, number, number]]),
);
const SNOW_TOP: [number, number, number][] = [
  [252, 253, 255],
  [228, 236, 248],
  [208, 220, 238],
  [196, 210, 232],
];
const dark = (r: number, g: number, b: number) => r * 0.3 + g * 0.59 + b * 0.11 < 62;
const leafy = (r: number, g: number, b: number) => g > r + 12 && g > b + 12;

const twins = new WeakMap<HTMLCanvasElement, HTMLCanvasElement>();
const iced = new WeakMap<HTMLCanvasElement, HTMLCanvasElement>();

/**
 * The pond of the town's baked ground iced over, and nothing else (the rest is see-through): pale ice, a white rim,
 * streaks of glare and a few cracks.
 */
export function iceLayer(ground: HTMLCanvasElement): HTMLCanvasElement {
  const hit = iced.get(ground);
  if (hit) return hit;
  const w = ground.width;
  const h = ground.height;
  const was = ground.getContext("2d")!.getImageData(0, 0, w, h).data;
  const out = document.createElement("canvas");
  out.width = w;
  out.height = h;
  const g = out.getContext("2d")!;
  const img = g.createImageData(w, h);
  const d = img.data;
  const waterAt = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return false;
    const i = (y * w + x) * 4;
    return WATER.has(key(was[i]!, was[i + 1]!, was[i + 2]!));
  };
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      if (!waterAt(x, y)) continue;
      const rim = !(waterAt(x - 1, y) && waterAt(x + 1, y) && waterAt(x, y - 1) && waterAt(x, y + 1));
      const glare = (x + y) % 13 < 2 && hash(Math.floor((x - y) / 9), 0, 51) < 0.5;
      const crack = hash(x, y, 52) < 0.025;
      const c = rim ? [236, 246, 252] : glare ? [234, 245, 252] : crack ? [158, 194, 220] : [192, 224, 240];
      const i = (y * w + x) * 4;
      d[i] = c[0]!;
      d[i + 1] = c[1]!;
      d[i + 2] = c[2]!;
      d[i + 3] = 255;
    }
  g.putImageData(img, 0, 0);
  iced.set(ground, out);
  return out;
}

/**
 * The snowy twin of a baked canvas: `ground` for the town's opaque ground, else a sprite (caps and dust). `plain` is
 * the canvas in the town's own palette, when `src` is its season's twin: what is grass, path or pond is read there.
 */
function bake(src: HTMLCanvasElement, ground: boolean, plain: HTMLCanvasElement): HTMLCanvasElement {
  const out = document.createElement("canvas");
  out.width = src.width;
  out.height = src.height;
  const g = out.getContext("2d")!;
  g.drawImage(src, 0, 0);
  const img = g.getImageData(0, 0, src.width, src.height);
  const d = img.data;
  const w = src.width;
  const h = src.height;
  const was = Uint8ClampedArray.from(d);
  const palette =
    plain === src ? was : plain.getContext("2d")!.getImageData(0, 0, plain.width, plain.height).data;
  const solid = (x: number, y: number) => y >= 0 && was[(y * w + x) * 4 + 3]! >= 200;
  const put = (x: number, y: number, c: readonly [number, number, number]) => {
    const i = (y * w + x) * 4;
    d[i] = c[0];
    d[i + 1] = c[1];
    d[i + 2] = c[2];
  };
  const waterAt = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return true;
    const i = (y * w + x) * 4;
    return WATER.has(key(palette[i]!, palette[i + 1]!, palette[i + 2]!));
  };

  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if (was[i + 3]! < 200) continue;
      const k = key(palette[i]!, palette[i + 1]!, palette[i + 2]!);
      const to = GROUND.get(k);
      if (to) {
        // The pond's rim is white; a few pixels of the ground are speckled.
        const rim =
          WATER.has(k) && !(waterAt(x - 1, y) && waterAt(x + 1, y) && waterAt(x, y - 1) && waterAt(x, y + 1));
        put(x, y, rim ? [240, 247, 253] : hash(x, y, 41) < 0.05 && !WATER.has(k) ? [226, 234, 246] : to);
      } else if (
        !ground &&
        leafy(was[i]!, was[i + 1]!, was[i + 2]!) &&
        hash(x, y, 43) < (h > 60 ? 0.88 : 0.3)
      ) {
        put(x, y, [228, 238, 248]); // dusted canopy
      }
    }

  if (!ground) {
    // Caps: wherever a column's solid pixels start (below open air), the first rows turn to snow,
    // after the outline.
    const roof = h > 60 ? 1 : 0;
    for (let x = 0; x < w; x++)
      for (let y = 0; y < h; y++) {
        if (!solid(x, y) || solid(x, y - 1)) continue;
        let yy = y;
        const ink = (yy: number) => {
          const i = (yy * w + x) * 4;
          return dark(was[i]!, was[i + 1]!, was[i + 2]!);
        };
        if (ink(yy)) {
          yy++;
          if (!solid(x, yy)) continue;
        }
        const depth = 2 + roof + (hash(x, y, 47) < 0.3 ? 1 : 0) - (hash(x, y, 48) > 0.85 ? 1 : 0);
        for (let k = 0; k < depth && solid(x, yy + k) && !ink(yy + k); k++)
          put(x, yy + k, SNOW_TOP[Math.min(k, SNOW_TOP.length - 1)]!);
      }
  }
  g.putImageData(img, 0, 0);
  return out;
}

/**
 * What to draw for `src` at snow `amount`: the plain canvas, its snowy twin, or both with the twin's alpha
 * while the snow is settling or melting. `plain` is `src` before the season painted it (`seasons.ts`).
 */
export function snowLayers(
  src: HTMLCanvasElement,
  amount: number,
  ground = false,
  plain = src,
): readonly (readonly [HTMLCanvasElement, number])[] {
  if (amount < 0.01) return [[src, 1]];
  let twin = twins.get(src);
  if (!twin) {
    twin = bake(src, ground, plain);
    twins.set(src, twin);
  }
  return amount > 0.99
    ? [[twin, 1]]
    : [
        [src, 1],
        [twin, amount],
      ];
}
