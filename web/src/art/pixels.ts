/**
 * All art is drawn in code: string grids for characters and furniture, a few
 * primitives for ground and buildings. Everything is baked once into canvases.
 */

import { mapValues } from "hanzio";

export type Palette = Record<string, string>;

export class Pen {
  constructor(readonly g: CanvasRenderingContext2D) {}

  px(x: number, y: number, color: string): void {
    this.g.fillStyle = color;
    this.g.fillRect(x, y, 1, 1);
  }

  rect(x: number, y: number, w: number, h: number, color: string): void {
    this.g.fillStyle = color;
    this.g.fillRect(x, y, w, h);
  }

  /** A filled circle, pixel-exact (no anti-aliasing). */
  disc(cx: number, cy: number, r: number, color: string): void {
    for (let y = -r; y <= r; y++) {
      const half = Math.floor(Math.sqrt(r * r - y * y) + 0.3);
      this.rect(cx - half, cy + y, half * 2 + 1, 1, color);
    }
  }

  /** Paints a string grid; `.` and unknown characters are transparent. Each run of one colour is one rect. */
  grid(rows: readonly string[], pal: Palette, ox = 0, oy = 0, flip = false): void {
    let last = "";
    rows.forEach((row, y) => {
      for (let x = 0; x < row.length;) {
        const color = pal[row[x]!];
        let end = x + 1;
        while (color && end < row.length && pal[row[end]!] === color) end++;
        if (color) {
          if (color !== last) this.g.fillStyle = last = color;
          this.g.fillRect(ox + (flip ? row.length - end : x), oy + y, end - x, 1);
        }
        x = end;
      }
    });
  }

  /** `text` in the 3×5 font (`GLYPHS`), its top-left at (`x`, `y`). */
  text(text: string, x: number, y: number, color: string): void {
    for (const [dx, dy] of glyphPixels(text)) this.px(x + dx, y + dy, color);
  }
}

export function bake(w: number, h: number, draw: (p: Pen) => void): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  draw(new Pen(canvas.getContext("2d")!));
  return canvas;
}

/** Memoizes a baked sprite by key. */
export function cached<A extends unknown[]>(
  key: (...args: A) => string,
  make: (...args: A) => HTMLCanvasElement,
): (...args: A) => HTMLCanvasElement {
  const cache = new Map<string, HTMLCanvasElement>();
  return (...args: A) => {
    const k = key(...args);
    let c = cache.get(k);
    if (!c) {
      c = make(...args);
      cache.set(k, c);
    }
    return c;
  };
}

/** A sprite that takes no arguments, baked the first time it's asked for. */
export function once(make: () => HTMLCanvasElement): () => HTMLCanvasElement {
  let c: HTMLCanvasElement | undefined;
  return () => (c ??= make());
}

const gradients = new WeakMap<CanvasRenderingContext2D, Map<string, CanvasGradient>>();

/** A gradient for `g` made once per `key` rather than every frame: one whose place and stops never change. */
export function gradient(
  g: CanvasRenderingContext2D,
  key: string,
  make: () => CanvasGradient,
): CanvasGradient {
  let made = gradients.get(g);
  if (!made) {
    made = new Map();
    gradients.set(g, made);
  }
  let grad = made.get(key);
  if (!grad) {
    grad = make();
    made.set(key, grad);
  }
  return grad;
}

/**
 * Memoizes `f` per object, for things that are replaced rather than edited (a look, a set). With
 * `version`, it all starts again whenever that changes.
 */
export function perObject<K extends object, V>(f: (k: K) => V, version?: () => number): (k: K) => V {
  let memo = new WeakMap<K, V>();
  let at = version?.();
  return (k) => {
    if (version && version() !== at) {
      memo = new WeakMap();
      at = version();
    }
    if (memo.has(k)) return memo.get(k)!;
    const v = f(k);
    memo.set(k, v);
    return v;
  };
}

/** `pal` with every colour replaced by `to(key)`: a boss flashing white, a trophy's dim outline. */
export const recolour = (pal: Palette, to: (key: string) => string): Palette =>
  mapValues(pal, (_, k) => to(k));

/** Deterministic noise in [0, 1) for tile variation. */
export function hash(x: number, y: number, seed = 0): number {
  let h = Math.imul(x * 374761393 + y * 668265263 + seed * 2147483647, 1274126177);
  h = Math.imul(h ^ (h >>> 13), 1103515245);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** A 3×5 pixel font, row by row (`1` lit), for signs, initials on merch and the like. */
// One glyph a line.
// prettier-ignore
const GLYPHS: Record<string, string> = {
  A: "010101111101101", B: "110101110101110", C: "011100100100011", D: "110101101101110",
  E: "111100110100111", F: "111100110100100", G: "011100101101011", H: "101101111101101",
  I: "111010010010111", J: "001001001101010", K: "101101110101101", L: "100100100100111",
  M: "101111111101101", N: "110101101101101", O: "010101101101010", P: "110101110100100",
  Q: "010101101110011", R: "110101110101101", S: "011100010001110", T: "111010010010010",
  U: "101101101101111", V: "101101101101010", W: "101101111111101", X: "101101010101101",
  Y: "101101010010010", Z: "111001010100111", "0": "111101101101111", "1": "010110010010111",
  "2": "110001010100111", "3": "110001010001110", "4": "101101111001001", "5": "111100110001110",
  "6": "011100111101111", "7": "111001010010010", "8": "111101111101111", "9": "111101111001110",
  "&": "010101010101011", "-": "000000111000000", ".": "000000000000010", "!": "010010010000010",
};

/** The lit pixels of `text` in `GLYPHS` (unknown characters are blanks), 4 pixels a letter. */
export function glyphPixels(text: string): [number, number][] {
  const out: [number, number][] = [];
  [...text.toUpperCase()].forEach((ch, i) => {
    const g = GLYPHS[ch];
    if (g) for (let k = 0; k < 15; k++) if (g[k] === "1") out.push([i * 4 + (k % 3), Math.floor(k / 3)]);
  });
  return out;
}

/** A company's initials: the first letter of its first two words ("Acme Rockets" → "AR"), or its first two. */
export function initialsOf(name: string): string {
  const words = name.toUpperCase().match(/[A-Z0-9]+/g) ?? ["?"];
  return (words.length > 1 ? words[0]![0]! + words[1]![0]! : words[0]!.slice(0, 2)) || "?";
}
