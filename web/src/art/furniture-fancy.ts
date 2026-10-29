/**
 * Fancy office furniture: the shop's nicer pieces, drawn in code like the rest (same palette, same
 * three-quarter view: a lighter top, a darker front face, ink outlines, a soft shadow on the floor).
 * Each sprite is `w·TILE` wide and stands on the bottom of its footprint; tall things reach up over
 * the tiles behind them. Some animate (a couple of frames) and some take a colour (a company's, say).
 * `FANCY_FURNITURE` is the catalog (company furniture, `COMPANY_FURNITURE` in core/src/office.ts, is
 * drawn with it), `fancySprite` bakes a frame.
 */
import { TILE } from "@tokenmaxxing/core/world.ts";
import { withAlpha } from "hanzio";
import { CASE_FURNITURE, HOME_FURNITURE, NUSANTARA_FURNITURE } from "./furniture-home.ts";
import { RAGNAROK_FURNITURE } from "./furniture-ragnarok.ts";
import { C, shade } from "./palette.ts";
import { bake, cached, glyphPixels, type Pen } from "./pixels.ts";

export type Rarity = "common" | "uncommon" | "rare" | "epic" | "legendary";
/** Where a piece goes: on the floor, against the top wall, hanging from the ceiling, or flat (walk over it). */
type Placement = "floor" | "wall" | "ceiling" | "flat";

export interface FancyPiece {
  id: string;
  name: string;
  /** Footprint in tiles. */
  w: number;
  h: number;
  /** Sprite height in pixels (its width is `w·TILE`); at least `h·TILE`. */
  height: number;
  price: number;
  rarity: Rarity;
  /** Animation frames; 1 is still. */
  frames: number;
  /** How long each frame shows, when it animates. */
  frameMs: number;
  /** The default colour if it takes one (`fancySprite(id, f, tint)`), else null. */
  tint: string | null;
  placement: Placement;
  draw: (p: Pen, frame: number, tint: string) => void;
}

// MARK: Colours and helpers

const K = {
  brass: "#e9b73d",
  brassDark: "#b98a1f",
  brassLight: "#f7dc7a",
  glass: "#a8dcf7",
  glassDark: "#7cc0e6",
  marble: "#ece8e0",
  marbleDark: "#cfc9bd",
  night: "#1b1f2a",
  nightLight: "#2a3a55",
  teak: "#a8683a",
  teakDark: "#7c4a28",
  teakLight: "#c98a55",
  pot: "#c2703d",
  potLight: "#e08e57",
  potDark: "#9a5530",
  green: "#3ddc84",
  red: "#e8584f",
  amber: "#f5d14a",
  blue: "#4f8fe0",
  purple: "#9b6fd6",
  orange: "#f08a3c",
  chrome: "#cfd6df",
  coffee: "#6b4226",
} as const;

/** A filled rectangle with a one-pixel ink outline. */
function box(p: Pen, x: number, y: number, w: number, h: number, fill: string): void {
  p.rect(x, y, w, h, C.ink);
  p.rect(x + 1, y + 1, w - 2, h - 2, fill);
}

const shadow = (p: Pen, x: number, y: number, w: number) => p.rect(x, y, w, 2, C.shadow);

/** A filled ellipse, pixel-exact. */
function oval(p: Pen, cx: number, cy: number, rx: number, ry: number, color: string): void {
  for (let y = -ry; y <= ry; y++) {
    const half = Math.floor(rx * Math.sqrt(1 - (y * y) / (ry * ry + 0.01)) + 0.3);
    p.rect(cx - half, cy + y, half * 2 + 1, 1, color);
  }
}

/** Pixels of a list. */
const dots = (p: Pen, pts: readonly (readonly [number, number])[], color: string) => {
  for (const [x, y] of pts) p.px(x, y, color);
};

// MARK: Pieces

function espressoBar(p: Pen, f: number): void {
  shadow(p, 1, 24, 30);
  box(p, 0, 9, 32, 16, C.woodDark);
  p.rect(1, 10, 30, 3, K.marble);
  p.rect(1, 12, 30, 1, K.marbleDark);
  p.rect(1, 13, 30, 1, C.ink);
  for (let x = 2; x < 30; x += 7) {
    p.rect(x, 15, 5, 8, C.wood);
    p.rect(x, 15, 5, 1, C.woodLight);
  }
  // The machine: chrome, two group heads, a pressure gauge, cups warming on top.
  box(p, 3, 1, 15, 11, C.metalLight);
  p.rect(4, 2, 13, 2, K.chrome);
  p.disc(10, 4, 1, K.brass);
  p.px(10, 4, C.ink);
  p.rect(5, 6, 3, 2, C.ink);
  p.rect(13, 6, 3, 2, C.ink);
  p.px(6, 8, C.metal);
  p.px(14, 8, C.metal);
  p.rect(4, 10, 13, 1, C.metal);
  p.rect(6, 9, 2, 1, C.white);
  for (const x of [5, 9, 13]) p.rect(x, 0, 2, 1, C.white);
  // Steam from the wand, drifting.
  const s = f === 0 ? 0 : 1;
  dots(
    p,
    [
      [18 + s, 3],
      [19 - s, 1],
      [18 + s, -1 + 1],
    ],
    withAlpha(C.white, 0.8),
  );
  p.rect(17, 5, 2, 1, C.metal);
  // A bean jar and a cup on its saucer.
  box(p, 22, 3, 5, 8, K.glass);
  p.rect(23, 6, 3, 4, K.coffee);
  p.rect(22, 3, 5, 1, C.woodDark);
  p.rect(27, 10, 4, 1, C.white);
  p.rect(28, 8, 2, 2, C.white);
  p.px(30, 9, C.white);
}

function arcadeCabinet(p: Pen, f: number, t: string): void {
  const dark = shade(t, -0.3);
  shadow(p, 2, 28, 12);
  box(p, 2, 1, 12, 28, t);
  p.rect(3, 2, 10, 1, shade(t, 0.3));
  // Marquee.
  p.rect(3, 3, 10, 4, C.lamp);
  p.rect(4, 4, 8, 1, K.orange);
  p.rect(5, 5, 6, 1, K.red);
  // Screen, a space invader marching.
  p.rect(3, 8, 10, 9, C.ink);
  p.rect(4, 9, 8, 7, K.night);
  const ox = 5 + f;
  p.grid([".1..1.", "111111", "1.11.1", "1....1"], { "1": K.green }, ox - 1, 10);
  p.rect(4, 15, 8, 1, K.nightLight);
  p.px(7, 14, C.white);
  // Control panel: stick and buttons.
  p.rect(2, 17, 12, 3, C.ink);
  p.rect(3, 17, 10, 2, dark);
  p.rect(5, 16, 1, 2, C.ink);
  p.px(5, 15, K.red);
  p.px(9, 18, K.amber);
  p.px(11, 18, K.blue);
  // Coin door.
  p.rect(6, 22, 4, 5, C.ink);
  p.rect(7, 23, 2, 3, C.metal);
  p.px(7, 23, f === 0 ? K.red : K.amber);
  p.rect(2, 28, 12, 1, dark);
}

function aquarium(p: Pen, f: number): void {
  shadow(p, 1, 22, 30);
  box(p, 1, 15, 30, 8, C.woodDark);
  p.rect(2, 16, 28, 1, C.wood);
  p.rect(16, 17, 1, 5, C.ink);
  p.px(14, 19, K.brass);
  p.px(18, 19, K.brass);
  // The tank.
  p.rect(0, 0, 32, 16, C.ink);
  p.rect(1, 2, 30, 13, C.water);
  p.rect(1, 2, 30, 1, C.waterLight);
  p.rect(0, 0, 32, 2, C.metal);
  p.rect(1, 12, 30, 3, C.path);
  for (let x = 2; x < 30; x += 3) p.px(x + (x % 2), 13, C.pathDark);
  // Weed, swaying.
  for (const [x, h] of [
    [4, 8],
    [6, 6],
    [26, 9],
    [28, 5],
  ] as const)
    for (let y = 0; y < h; y++) p.px(x + ((y + f) % 3 === 0 ? 1 : 0), 12 - y, y % 2 ? C.leaf : C.leafDark);
  p.disc(20, 12, 2, C.stoneDark);
  p.rect(18, 12, 5, 1, C.stone);
  // Fish: an orange one and two blue tetras.
  const fx = f === 0 ? 9 : 12;
  p.rect(fx, 5, 4, 3, K.orange);
  p.px(fx + 4, 6, K.orange);
  dots(
    p,
    [
      [fx - 1, 5],
      [fx - 1, 7],
    ],
    K.orange,
  );
  p.px(fx + 3, 5, C.ink);
  p.px(fx + 1, 6, C.white);
  const tx = f === 0 ? 22 : 19;
  for (const [dx, dy] of [
    [0, 0],
    [3, 2],
  ] as const) {
    p.rect(tx + dx, 7 + dy, 3, 1, K.blue);
    p.px(tx + dx + 1, 7 + dy, K.red);
  }
  // Bubbles.
  for (let i = 0; i < 3; i++) p.px(24 + ((i + f) % 2), 10 - i * 3 - f, C.foam);
  p.rect(2, 3, 1, 4, withAlpha(C.white, 0.6));
}

function neonSign(p: Pen, f: number, t: string): void {
  neon(p, f, t, "SHIP IT", 5);
}

/**
 * A neon sign saying `text` (up to 7 letters), on a dark board. Frame 1 flickers the letters from
 * `flicker` on, as neon does.
 */
function neon(p: Pen, f: number, t: string, text: string, flicker: number): void {
  box(p, 0, 2, 32, 13, "#2f2838");
  p.rect(1, 3, 30, 1, "#3b3347");
  dots(
    p,
    [
      [2, 4],
      [29, 4],
      [2, 12],
      [29, 12],
    ],
    C.metal,
  );
  const shown = text.slice(0, 7);
  const x0 = Math.floor((32 - (shown.length * 4 - 1)) / 2);
  const lit = glyphPixels(shown).map(([x, y]): [number, number, boolean] => [
    x0 + x,
    6 + y,
    x >= flicker * 4,
  ]);
  const on = (late: boolean) => f === 0 || !late;
  for (const [x, y, late] of lit)
    if (on(late))
      for (const [dx, dy] of [
        [-1, 0],
        [1, 0],
        [0, -1],
        [0, 1],
      ] as const)
        p.px(x + dx, y + dy, withAlpha(t, 0.35));
  for (const [x, y, late] of lit) p.px(x, y, on(late) ? shade(t, 0.55) : shade(t, -0.45));
  p.rect(6, 0, 1, 2, C.metal);
  p.rect(25, 0, 1, 2, C.metal);
}

/** The neon sign with a company's own name (or initials, when the name is too long) in its colour. */
export const neonSprite = cached(
  (text: string, frame: number, tint: string) => `${text}:${frame}:${tint}`,
  (text: string, frame: number, tint: string) =>
    bake(2 * TILE, 16, (p) => neon(p, frame, tint, text, Math.max(1, text.length - 1))),
);

function beanbag(p: Pen, _f: number, t: string): void {
  shadow(p, 2, 14, 12);
  oval(p, 8, 10, 7, 5, C.ink);
  oval(p, 8, 10, 6, 4, shade(t, -0.25));
  oval(p, 7, 9, 5, 3, t);
  oval(p, 9, 8, 3, 1, shade(t, -0.15));
  p.px(4, 8, shade(t, 0.35));
  p.px(5, 7, shade(t, 0.35));
  p.px(12, 12, shade(t, -0.4));
}

function standingDesk(p: Pen): void {
  shadow(p, 1, 26, 30);
  // Legs and feet, with the height buttons.
  p.rect(4, 16, 2, 10, C.metal);
  p.rect(26, 16, 2, 10, C.metal);
  p.rect(4, 16, 1, 10, C.metalLight);
  p.rect(26, 16, 1, 10, C.metalLight);
  p.rect(2, 26, 6, 1, C.ink);
  p.rect(24, 26, 6, 1, C.ink);
  p.rect(6, 20, 20, 1, C.metal);
  // Top.
  p.rect(0, 11, 32, 6, C.ink);
  p.rect(1, 12, 30, 3, C.woodLight);
  p.rect(1, 15, 30, 1, C.wood);
  p.px(28, 15, K.green);
  // Two monitors, code on one and a graph on the other.
  for (const x of [2, 17]) {
    box(p, x, 0, 13, 10, C.ink);
    p.rect(x + 1, 1, 11, 8, K.night);
    p.rect(x + 6, 10, 1, 2, C.metal);
    p.rect(x + 4, 11, 5, 1, C.metalLight);
  }
  for (const [y, w, c] of [
    [2, 6, K.purple],
    [3, 8, C.screen],
    [4, 5, K.green],
    [5, 9, C.screen],
    [6, 4, K.amber],
    [7, 7, C.screen],
  ] as const)
    p.rect(4 + (y % 2), y, w, 1, c);
  dots(
    p,
    [
      [19, 7],
      [20, 7],
      [21, 6],
      [22, 6],
      [23, 4],
      [24, 5],
      [25, 3],
      [26, 2],
      [27, 2],
    ],
    K.green,
  );
  p.rect(19, 8, 9, 1, K.nightLight);
  // Keyboard, mouse and a mug.
  p.rect(10, 13, 10, 2, C.metalLight);
  p.rect(10, 14, 10, 1, C.metal);
  p.px(22, 13, C.white);
  p.rect(26, 12, 2, 2, K.red);
}

function serverRack(p: Pen, f: number): void {
  shadow(p, 1, 30, 14);
  box(p, 1, 0, 14, 31, K.night);
  p.rect(2, 1, 12, 1, C.metal);
  for (let i = 0; i < 6; i++) {
    const y = 3 + i * 4;
    p.rect(2, y, 12, 3, C.metal);
    p.rect(2, y, 12, 1, C.metalLight);
    for (let x = 8; x < 13; x += 2) p.px(x, y + 1, K.night);
    // LEDs: a deterministic dance between two frames.
    for (let k = 0; k < 3; k++) {
      const on = (i * 7 + k * 3 + f * 5) % 4 !== 0;
      const c = k === 2 && i % 3 === 1 ? K.amber : K.green;
      p.px(3 + k, y + 1, on ? c : shade(c, -0.6));
    }
  }
  p.px(12, 28, f ? K.red : shade(K.red, -0.5));
  p.rect(2, 29, 12, 1, C.metal);
  p.rect(2, 31, 2, 1, C.ink);
  p.rect(12, 31, 2, 1, C.ink);
}

function pingPong(p: Pen): void {
  const top = "#3f6fb0";
  shadow(p, 2, 30, 44);
  for (const x of [4, 22, 42]) p.rect(x, 22, 2, 8, C.metal);
  p.rect(0, 4, 48, 20, C.ink);
  p.rect(1, 5, 46, 15, top);
  p.rect(1, 20, 46, 3, "#2a4f85");
  // Lines: the edges and the middle.
  p.rect(2, 6, 44, 1, C.white);
  p.rect(2, 18, 44, 1, C.white);
  p.rect(2, 6, 1, 13, C.white);
  p.rect(45, 6, 1, 13, C.white);
  p.rect(2, 12, 44, 1, withAlpha(C.white, 0.7));
  // The net, standing up across the middle.
  p.rect(23, 1, 2, 20, C.ink);
  for (let y = 2; y < 20; y++) p.px(24, y, y % 2 ? C.white : C.stoneLight);
  p.rect(23, 1, 2, 1, C.metalLight);
  p.rect(23, 20, 2, 2, C.metal);
  // Two paddles and the ball.
  p.disc(10, 10, 3, C.ink);
  p.disc(10, 10, 2, K.red);
  p.rect(12, 12, 3, 2, K.teak);
  p.disc(37, 14, 3, C.ink);
  p.disc(37, 14, 2, C.ink);
  p.disc(37, 14, 1, "#2f3444");
  p.rect(33, 15, 2, 2, K.teak);
  p.px(30, 8, C.white);
  p.px(31, 9, withAlpha(C.white, 0.4));
}

function plantWall(p: Pen): void {
  shadow(p, 1, 30, 30);
  box(p, 0, 0, 32, 31, C.woodDark);
  p.rect(1, 1, 30, 24, C.leafInk);
  // Clusters of leaves, packed and overlapping.
  let k = 0;
  for (let row = 0; row < 6; row++)
    for (let x = 3 + (row % 2) * 2, y = 3 + row * 4; x < 30; x += 5) {
      const c = [C.leafDark, C.leaf, C.leafLight, C.leaf][k++ % 4]!;
      p.disc(x, y, 2, c);
      p.px(x - 1, y - 1, shade(c, 0.2));
    }
  dots(
    p,
    [
      [7, 6],
      [21, 10],
      [13, 18],
      [27, 21],
      [4, 22],
    ],
    C.flowerWhite,
  );
  dots(
    p,
    [
      [17, 4],
      [25, 14],
      [9, 13],
    ],
    C.flowerRed,
  );
  // Trailing vines over the planter.
  for (const x of [5, 14, 24]) for (let y = 23; y < 27; y++) p.px(x + (y % 2), y, C.leaf);
  p.rect(1, 25, 30, 5, C.wood);
  p.rect(1, 25, 30, 1, C.woodLight);
  p.rect(1, 29, 30, 1, C.woodDark);
}

function trophyCase(p: Pen): void {
  shadow(p, 1, 28, 30);
  box(p, 0, 0, 32, 29, C.woodDark);
  p.rect(2, 2, 28, 22, "#4a3b44");
  for (const y of [9, 16]) p.rect(2, y, 28, 1, C.wood);
  // Top shelf: a big cup and two small ones.
  const cup = (x: number, y: number, s: number) => {
    p.rect(x, y, s * 2 + 1, s, K.brass);
    p.rect(x, y, 1, s, K.brassLight);
    p.px(x - 1, y, K.brass);
    p.px(x + s * 2 + 1, y, K.brass);
    p.rect(x + s - (s > 2 ? 0 : 0), y + s, 1, 1, K.brassDark);
    p.rect(x + s - 1, y + s + 1, 3, 1, K.brassDark);
  };
  cup(13, 3, 3);
  cup(5, 5, 2);
  cup(23, 5, 2);
  // Middle: medals on ribbons, a star.
  for (const [x, c] of [
    [5, K.red],
    [10, K.blue],
  ] as const) {
    p.rect(x, 10, 2, 3, c);
    p.disc(x + 1, 14, 1, K.brass);
  }
  p.grid(["..1..", ".111.", "11111", ".1.1."], { "1": K.brassLight }, 18, 11);
  p.rect(25, 11, 3, 5, C.stoneLight);
  p.rect(25, 11, 3, 1, C.white);
  // Bottom: a silver plate and a golden duck.
  p.disc(8, 20, 3, C.stoneLight);
  p.disc(8, 20, 2, K.chrome);
  p.disc(20, 21, 2, K.brass);
  p.disc(22, 19, 1, K.brass);
  p.px(23, 19, K.orange);
  // Glass glints, then the plinth.
  dots(
    p,
    [
      [3, 3],
      [4, 2],
      [3, 4],
      [28, 17],
      [27, 18],
    ],
    withAlpha(C.white, 0.5),
  );
  p.rect(1, 24, 30, 4, C.wood);
  p.rect(1, 24, 30, 1, C.woodLight);
  p.rect(14, 25, 4, 2, K.brass);
}

function chandelier(p: Pen, f: number): void {
  // A pool of warm light on the floor below.
  oval(p, 16, 25, 13, 2, withAlpha(C.lamp, 0.22));
  oval(p, 16, 25, 8, 1, withAlpha(C.lamp, 0.25));
  p.rect(15, 0, 2, 6, K.brassDark);
  p.rect(15, 0, 1, 6, K.brass);
  // Arms with candles.
  p.rect(3, 11, 26, 2, C.ink);
  p.rect(4, 11, 24, 1, K.brass);
  for (const x of [4, 10, 16, 22, 28]) {
    p.rect(x - 1, 7, 2, 4, C.white);
    p.rect(x - 1, 10, 2, 1, K.brassDark);
    const flick = (x + f * 3) % 2;
    p.px(x - 1 + flick, 6, C.lamp);
    p.px(x - 1 + flick, 5, f ? C.white : K.orange);
    oval(p, x - 1, 6, 2, 2, withAlpha(C.lamp, 0.18));
  }
  p.disc(16, 13, 3, K.brassDark);
  p.disc(16, 12, 3, K.brass);
  p.px(15, 11, K.brassLight);
  // Crystals.
  for (const x of [5, 8, 12, 20, 24, 27]) {
    p.px(x, 13, K.glassDark);
    p.px(x, 14, K.glass);
  }
  p.rect(16, 16, 1, 2, K.glass);
  p.px(16, 18, C.white);
}

function loungeChair(p: Pen, _f: number, t: string): void {
  shadow(p, 2, 18, 12);
  // Splayed teak legs.
  dots(
    p,
    [
      [3, 15],
      [3, 16],
      [2, 17],
      [12, 15],
      [12, 16],
      [13, 17],
    ],
    K.teakDark,
  );
  // A curved shell back and a deep cushion, framed in teak.
  oval(p, 8, 6, 6, 5, C.ink);
  oval(p, 8, 6, 5, 4, shade(t, -0.2));
  oval(p, 8, 5, 4, 3, t);
  p.px(6, 3, shade(t, 0.3));
  box(p, 2, 9, 12, 6, t);
  p.rect(3, 13, 10, 1, shade(t, -0.25));
  p.rect(3, 10, 10, 1, shade(t, 0.2));
  for (const x of [0, 13]) {
    p.rect(x, 8, 3, 6, C.ink);
    p.rect(x + 1, 8, 1, 5, K.teakLight);
    p.px(x + 1, 13, K.teak);
  }
}

function recordPlayer(p: Pen, f: number): void {
  shadow(p, 1, 18, 14);
  // A low teak sideboard: records in a cubby, a speaker.
  box(p, 0, 7, 16, 11, K.teak);
  p.rect(1, 8, 14, 1, K.teakLight);
  p.rect(2, 10, 6, 6, K.teakDark);
  for (let x = 2; x < 8; x++) p.rect(x, 11, 1, 5, [K.red, C.white, K.blue, K.amber, C.ink, K.green][x - 2]!);
  p.disc(12, 13, 2, C.ink);
  p.disc(12, 13, 1, C.metal);
  p.rect(2, 18, 1, 2, K.teakDark);
  p.rect(13, 18, 1, 2, K.teakDark);
  // The turntable on top, the record spinning.
  box(p, 1, 1, 14, 8, C.woodLight);
  oval(p, 7, 5, 4, 2, C.ink);
  oval(p, 7, 5, 3, 1, "#2f3444");
  p.px(7, 5, K.red);
  p.px(f ? 6 : 8, 5, K.amber);
  p.px(f ? 9 : 5, 4, C.metal);
  p.rect(12, 2, 1, 4, C.metalLight);
  p.px(11, 6, C.metalLight);
  p.px(12, 2, C.ink);
}

function bookshelf(p: Pen): void {
  shadow(p, 0, 28, 32);
  box(p, 0, 0, 32, 29, C.woodDark);
  const books = [C.rug, C.fabric, C.flowerYellow, C.leaf, C.white, K.purple, C.rugLight, K.teakDark];
  for (const row of [2, 10, 18]) {
    let x = 2;
    let i = row;
    while (x < 30) {
      const w = 1 + (i % 2);
      const short = i % 3 === 0 ? 1 : 0;
      p.rect(x, row + short, w, 6 - short, books[i % books.length]!);
      if (i % 5 === 0) p.px(x, row + 2 + short, K.brass);
      x += w + (i % 6 === 0 ? 2 : 0);
      i++;
    }
    p.rect(1, row + 6, 30, 2, C.wood);
  }
  p.rect(1, 26, 30, 2, C.wood);
  // A library ladder leaning on the front.
  for (const x of [21, 27]) {
    p.rect(x, 1, 1, 28, C.ink);
    p.rect(x + 1, 1, 1, 28, C.woodLight);
  }
  for (let y = 4; y < 28; y += 5) p.rect(22, y, 6, 1, C.woodLight);
  p.rect(20, 0, 10, 1, K.brass);
}

function whiteboard(p: Pen): void {
  shadow(p, 1, 26, 30);
  for (const x of [3, 28]) {
    p.rect(x, 18, 1, 8, C.metal);
    p.rect(x - 1, 26, 3, 1, C.ink);
  }
  box(p, 0, 0, 32, 20, C.metalLight);
  p.rect(1, 1, 30, 18, C.white);
  // A flow chart, a rising line and a to-do list.
  box(p, 3, 3, 6, 4, C.white);
  box(p, 3, 11, 6, 4, C.white);
  p.rect(5, 7, 1, 4, K.blue);
  p.px(4, 9, K.blue);
  p.px(6, 9, K.blue);
  dots(
    p,
    [
      [12, 13],
      [13, 12],
      [14, 12],
      [15, 10],
      [16, 11],
      [17, 8],
      [18, 6],
      [19, 4],
    ],
    K.red,
  );
  p.rect(11, 3, 1, 12, C.stoneDark);
  p.rect(11, 14, 10, 1, C.stoneDark);
  for (let y = 4; y < 15; y += 3) {
    p.px(23, y, K.green);
    p.rect(25, y, 3 + (y % 3), 1, C.metal);
  }
  p.px(24, 4, K.green);
  p.rect(23, 16, 6, 1, K.red);
  p.rect(1, 19, 30, 1, C.metal);
  for (const [x, c] of [
    [6, K.red],
    [9, K.blue],
    [12, K.green],
  ] as const)
    p.rect(x, 18, 2, 1, c);
}

function foosball(p: Pen): void {
  shadow(p, 1, 20, 30);
  for (const x of [3, 27]) p.rect(x, 15, 2, 5, C.woodDark);
  box(p, 0, 3, 32, 13, C.woodDark);
  p.rect(2, 4, 28, 8, C.leaf);
  for (let x = 2; x < 30; x += 4) p.rect(x, 4, 2, 8, C.leafDark);
  p.rect(16, 4, 1, 8, withAlpha(C.white, 0.7));
  p.rect(1, 6, 1, 4, C.ink);
  p.rect(30, 6, 1, 4, C.ink);
  p.rect(1, 12, 30, 3, C.wood);
  // Rods, with handles out the front and back; red and blue players alternate.
  [5, 10, 15, 21, 26].forEach((x, i) => {
    p.rect(x, 0, 1, 18, K.chrome);
    p.rect(x, 0, 1, 2, C.ink);
    p.rect(x, 16, 1, 2, C.ink);
    const c = i % 2 ? K.blue : K.red;
    for (let y = 5; y < 12; y += 3) {
      p.rect(x - 1, y, 3, 2, c);
      p.px(x, y - 1, C.pillow);
    }
  });
  p.px(13, 8, C.white);
}

function miniFridge(p: Pen, _f: number, t: string): void {
  shadow(p, 2, 18, 12);
  box(p, 2, 1, 12, 18, t);
  p.rect(3, 2, 10, 1, shade(t, 0.35));
  p.rect(3, 7, 10, 1, shade(t, -0.35));
  p.rect(3, 17, 10, 1, shade(t, -0.25));
  p.rect(11, 3, 1, 3, K.chrome);
  p.rect(11, 9, 1, 5, K.chrome);
  // Stickers.
  p.rect(4, 9, 3, 3, K.amber);
  p.px(5, 10, C.ink);
  p.rect(6, 13, 2, 2, K.purple);
  p.px(4, 4, K.red);
  p.px(5, 4, C.white);
  p.rect(5, 15, 3, 1, K.chrome);
  p.rect(3, 19, 2, 1, C.ink);
  p.rect(11, 19, 2, 1, C.ink);
}

function monstera(p: Pen): void {
  shadow(p, 2, 28, 12);
  // Stems from the pot.
  for (const [x0, x1] of [
    [7, 4],
    [8, 11],
    [8, 8],
    [9, 13],
  ] as const)
    for (let y = 22; y > 12; y--) p.px(Math.round(x0 + ((x1 - x0) * (22 - y)) / 10), y, C.leafDark);
  // Big split leaves: wide ovals with a midrib and the slits monsteras are named for.
  const leaf = (cx: number, cy: number, r: number, side: number) => {
    oval(p, cx, cy, r + 1, r, C.leafInk);
    oval(p, cx, cy, r, r - 1, C.leaf);
    oval(p, cx - side, cy - 1, r - 2, r - 3, C.leafLight);
    for (let i = -r + 1; i < r; i++) p.px(cx + i, cy + Math.round(i * 0.3 * side), C.leafDark);
    for (const k of [-2, 2]) {
      const x = cx + Math.sign(k) * r;
      for (let d = 0; d < r - 1; d++) p.px(x - Math.sign(k) * d, cy - 2 + (d % 2), C.leafInk);
      p.px(x, cy + 2, C.leafInk);
      p.px(x - Math.sign(k), cy + 2, C.leafInk);
    }
    p.px(cx + side * 2, cy + 1, C.leafInk);
  };
  leaf(5, 14, 4, -1);
  leaf(10, 11, 4, 1);
  leaf(7, 5, 5, 1);
  leaf(4, 20, 3, -1);
  leaf(11, 18, 3, 1);
  // A tall pot.
  box(p, 3, 21, 10, 8, K.pot);
  p.rect(4, 22, 8, 1, K.potLight);
  p.rect(4, 26, 8, 2, K.potDark);
  p.rect(2, 21, 12, 2, C.ink);
  p.rect(3, 21, 10, 1, K.potLight);
}

function rug(p: Pen, _f: number, t: string): void {
  const dark = shade(t, -0.3);
  const light = C.rugLight;
  // Fringes, then a bordered field with a medallion.
  for (let y = 3; y < 30; y += 2) {
    p.px(0, y, C.pillow);
    p.px(47, y, C.pillow);
  }
  p.rect(1, 1, 46, 30, dark);
  p.rect(3, 3, 42, 26, light);
  p.rect(4, 4, 40, 24, t);
  for (let x = 6; x < 43; x += 4) {
    p.px(x, 2, light);
    p.px(x, 29, light);
  }
  for (let i = 0; i < 9; i++) {
    p.rect(24 - i, 8 + i, i * 2 + 1, 1, i % 3 === 0 ? light : dark);
    p.rect(24 - i, 24 - i, i * 2 + 1, 1, i % 3 === 0 ? light : dark);
  }
  p.rect(16, 16, 17, 1, dark);
  p.disc(24, 16, 3, light);
  p.disc(24, 16, 1, C.pillow);
  for (const [x, y] of [
    [8, 8],
    [40, 8],
    [8, 24],
    [40, 24],
  ] as const) {
    p.rect(x - 1, y, 3, 1, light);
    p.rect(x, y - 1, 1, 3, light);
  }
}

function sofa(p: Pen, _f: number, t: string): void {
  const dark = shade(t, -0.25);
  const deep = shade(t, -0.45);
  shadow(p, 2, 20, 44);
  // Tufted back.
  box(p, 1, 0, 46, 11, dark);
  p.rect(2, 1, 44, 1, shade(t, 0.15));
  for (let x = 6; x < 44; x += 6) {
    p.px(x, 4, deep);
    p.px(x + 3, 7, deep);
  }
  // Three seat cushions, a front and two rolled arms.
  p.rect(1, 10, 46, 9, C.ink);
  for (let i = 0; i < 3; i++) {
    p.rect(6 + i * 12, 11, 11, 4, t);
    p.rect(6 + i * 12, 11, 11, 1, shade(t, 0.25));
  }
  p.rect(2, 15, 44, 3, dark);
  for (const x of [0, 42]) {
    box(p, x, 5, 6, 14, t);
    p.rect(x + 1, 6, 4, 1, shade(t, 0.25));
    p.rect(x + 1, 16, 4, 2, dark);
  }
  p.rect(16, 7, 6, 4, C.pillow);
  p.rect(16, 10, 6, 1, C.stoneLight);
  for (const x of [3, 43]) p.rect(x, 19, 2, 2, C.woodDark);
}

function coffeeTable(p: Pen): void {
  shadow(p, 3, 14, 26);
  for (const x of [5, 25]) p.rect(x, 10, 2, 5, K.teakDark);
  oval(p, 16, 7, 15, 4, C.ink);
  oval(p, 16, 8, 14, 3, K.teak);
  oval(p, 16, 7, 14, 3, K.teakLight);
  // A stack of magazines, a mug and a tiny succulent.
  p.rect(5, 5, 7, 4, C.ink);
  p.rect(6, 5, 6, 3, K.red);
  p.rect(5, 4, 6, 3, C.white);
  p.rect(6, 5, 3, 1, K.blue);
  p.rect(18, 5, 3, 3, C.white);
  p.px(21, 6, C.white);
  p.px(19, 5, K.coffee);
  p.rect(24, 6, 3, 2, K.pot);
  p.px(25, 5, C.leafLight);
  p.px(24, 5, C.leaf);
  p.px(26, 5, C.leaf);
}

function lavaLamp(p: Pen, f: number, t: string): void {
  oval(p, 8, 9, 7, 7, withAlpha(t, 0.12));
  shadow(p, 4, 20, 8);
  // Cone base and cap.
  p.rect(4, 15, 8, 6, C.ink);
  p.rect(5, 15, 6, 5, C.metal);
  p.rect(5, 15, 2, 5, C.metalLight);
  p.rect(6, 1, 4, 3, C.ink);
  p.rect(7, 1, 2, 2, C.metalLight);
  // The bottle: narrow, wide, narrow.
  const rows = [3, 4, 4, 5, 5, 5, 6, 6, 6, 6, 5];
  rows.forEach((w, i) => {
    const x = 8 - Math.ceil(w / 2);
    p.rect(x - 1, 4 + i, w + 2, 1, C.ink);
    p.rect(x, 4 + i, w, 1, shade(t, 0.55));
  });
  // Blobs, rising and falling.
  const blob = shade(t, -0.05);
  p.disc(8, f ? 12 : 13, 1, blob);
  p.rect(6, 14, 4, 1, blob);
  p.disc(f ? 9 : 7, f ? 6 : 8, 1, blob);
  p.px(f ? 7 : 9, f ? 9 : 5, blob);
  p.px(6, 6, withAlpha(C.white, 0.6));
}

function globe(p: Pen): void {
  shadow(p, 3, 20, 10);
  p.rect(4, 19, 8, 2, C.ink);
  p.rect(5, 19, 6, 1, C.woodDark);
  p.rect(7, 15, 2, 4, C.woodDark);
  // The sphere with its brass meridian.
  p.disc(8, 8, 6, C.ink);
  p.disc(8, 8, 5, C.waterDark);
  p.disc(7, 7, 4, C.water);
  p.grid(["..11....", ".1111..1", ".111..11", "..1...1.", "...1....", "...11..."], { "1": C.leaf }, 4, 4);
  p.px(5, 5, C.waterLight);
  p.px(6, 4, C.waterLight);
  for (let a = -6; a <= 6; a++) p.px(8 + Math.round(Math.sqrt(49 - a * a) * 0.95), 8 + a, K.brass);
  p.px(8, 1, K.brassDark);
  p.px(8, 15, K.brassDark);
}

function gong(p: Pen, f: number): void {
  shadow(p, 2, 28, 28);
  // A lacquered frame with upturned ends.
  for (const x of [3, 27]) {
    p.rect(x, 3, 3, 25, C.ink);
    p.rect(x + 1, 3, 1, 24, C.roofRed);
    p.rect(x - 1, 26, 5, 2, C.ink);
  }
  p.rect(0, 2, 32, 4, C.ink);
  p.rect(1, 3, 30, 2, C.roofRed);
  p.rect(1, 3, 30, 1, shade(C.roofRed, 0.25));
  p.px(0, 1, C.ink);
  p.px(31, 1, C.ink);
  p.rect(5, 6, 22, 1, C.roofRedDark);
  // Cords and the gong, still or just struck (a shimmer).
  p.px(12, 6, C.trunkDark);
  p.px(20, 6, C.trunkDark);
  p.disc(16, 16, 9, C.ink);
  p.disc(16, 16, 8, K.brassDark);
  p.disc(16, 16, 7, K.brass);
  p.disc(16, 16, 4, K.brassDark);
  p.disc(16, 16, 3, K.brass);
  p.disc(15, 15, 1, K.brassLight);
  p.px(11, 12, K.brassLight);
  p.px(12, 11, K.brassLight);
  if (f)
    for (const [x, y] of [
      [6, 9],
      [26, 10],
      [7, 22],
      [25, 21],
    ] as const)
      p.px(x, y, C.lamp);
  // The mallet leaning on the right post.
  p.rect(29, 14, 1, 13, K.teakLight);
  p.rect(28, 12, 3, 3, C.ink);
  p.rect(29, 13, 1, 1, C.pillow);
}

function duckStatue(p: Pen): void {
  shadow(p, 1, 24, 14);
  // A marble plinth with a brass plaque.
  box(p, 1, 15, 14, 10, K.marble);
  p.rect(2, 16, 12, 1, C.white);
  p.rect(2, 22, 12, 2, K.marbleDark);
  p.rect(5, 18, 6, 2, K.brass);
  p.rect(6, 18, 4, 1, K.brassLight);
  p.rect(0, 14, 16, 2, C.ink);
  p.rect(1, 14, 14, 1, K.marble);
  // The duck.
  const y = "#f5d14a";
  const yd = "#d9a92a";
  oval(p, 8, 10, 6, 4, C.ink);
  oval(p, 8, 10, 5, 3, yd);
  oval(p, 7, 9, 4, 2, y);
  p.rect(12, 6, 3, 2, C.ink);
  p.rect(3, 9, 2, 1, C.ink);
  p.px(2, 8, C.ink);
  p.disc(6, 5, 4, C.ink);
  p.disc(6, 5, 3, y);
  p.px(5, 3, C.white);
  p.px(7, 4, C.ink);
  p.rect(9, 5, 3, 2, K.orange);
  p.rect(9, 6, 3, 1, shade(K.orange, -0.2));
  p.rect(8, 9, 3, 1, yd);
}

function vending(p: Pen, f: number, t: string): void {
  shadow(p, 1, 28, 14);
  box(p, 1, 0, 14, 29, t);
  p.rect(2, 1, 12, 1, shade(t, 0.3));
  // Glass front with three rows of snacks.
  p.rect(2, 3, 8, 18, C.ink);
  p.rect(3, 4, 6, 16, "#d8eef8");
  const snacks = [K.red, K.amber, K.green, K.purple, K.blue, K.orange];
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) p.rect(3 + c * 2, 5 + r * 5, 1, 3, snacks[(r * 3 + c) % snacks.length]!);
    p.rect(3, 8 + r * 5, 6, 1, C.metal);
  }
  p.rect(3, 4, 1, 3, withAlpha(C.white, 0.8));
  // Keypad and slot.
  p.rect(11, 4, 2, 2, f ? K.green : shade(K.green, -0.5));
  for (let y = 7; y < 13; y += 2) p.rect(11, y, 2, 1, C.metalLight);
  p.rect(11, 15, 2, 3, C.ink);
  p.rect(3, 23, 10, 3, C.ink);
  p.rect(4, 24, 8, 1, C.metal);
  p.rect(2, 27, 12, 1, shade(t, -0.3));
}

function waterCooler(p: Pen, f: number): void {
  shadow(p, 3, 24, 10);
  // The jug.
  p.rect(4, 0, 8, 10, C.ink);
  p.rect(5, 1, 6, 8, K.glass);
  p.rect(5, 1, 6, 2, C.waterLight);
  p.rect(5, 4, 6, 5, K.glassDark);
  p.px(6, f ? 6 : 7, C.foam);
  p.px(8, f ? 4 : 5, C.foam);
  p.rect(6, 1, 1, 5, withAlpha(C.white, 0.6));
  p.rect(6, 9, 4, 2, C.ink);
  // The stand, its taps and a paper cup.
  box(p, 3, 10, 10, 15, C.white);
  p.rect(4, 11, 8, 1, C.stoneLight);
  p.px(5, 14, K.blue);
  p.px(10, 14, K.red);
  p.rect(4, 17, 8, 2, C.stoneLight);
  p.rect(4, 19, 8, 1, C.stoneDark);
  p.rect(8, 16, 2, 2, C.pillow);
}

function arcLamp(p: Pen): void {
  oval(p, 10, 28, 5, 1, withAlpha(C.lamp, 0.25));
  shadow(p, 0, 30, 7);
  // Marble base, the arc, a domed shade.
  p.rect(0, 28, 7, 3, C.ink);
  p.rect(1, 28, 5, 2, K.marble);
  p.rect(1, 28, 5, 1, C.white);
  for (let y = 4; y < 28; y++) p.px(3 + (y < 10 ? Math.round((10 - y) * 0.4) : 0), y, K.chrome);
  for (let x = 5; x < 11; x++) p.px(x, 3 + Math.round(Math.abs(x - 7) * 0.4), K.chrome);
  oval(p, 11, 10, 4, 3, C.ink);
  p.rect(7, 11, 9, 3, C.ink);
  p.rect(8, 9, 7, 3, C.metal);
  p.rect(9, 8, 4, 1, C.metalLight);
  p.rect(8, 12, 7, 1, C.lamp);
  p.rect(10, 13, 3, 1, withAlpha(C.lamp, 0.5));
}

function bonsai(p: Pen): void {
  shadow(p, 3, 14, 10);
  // A shallow tray.
  p.rect(2, 11, 12, 4, C.ink);
  p.rect(3, 11, 10, 2, "#3c4454");
  p.rect(3, 11, 10, 1, C.metalLight);
  p.rect(4, 15, 1, 1, C.ink);
  p.rect(11, 15, 1, 1, C.ink);
  // A twisty trunk with three pads of leaves.
  dots(
    p,
    [
      [8, 10],
      [7, 9],
      [7, 8],
      [8, 7],
      [9, 6],
      [9, 5],
      [6, 7],
      [5, 6],
      [10, 7],
      [11, 7],
    ],
    C.trunkDark,
  );
  p.px(9, 10, C.trunkDark);
  for (const [x, y, rx] of [
    [5, 5, 3],
    [11, 6, 3],
    [9, 3, 4],
  ] as const) {
    oval(p, x, y, rx, 1, C.leafInk);
    oval(p, x, y - 1, rx - 1, 1, C.leaf);
    p.px(x - 1, y - 2, C.leafLight);
  }
  p.px(12, 10, C.stoneLight);
}

// MARK: Catalog

const piece = (
  id: string,
  name: string,
  w: number,
  h: number,
  height: number,
  price: number,
  rarity: Rarity,
  draw: FancyPiece["draw"],
  extra: Partial<Pick<FancyPiece, "frames" | "frameMs" | "tint" | "placement">> = {},
): FancyPiece => ({
  id,
  name,
  w,
  h,
  height,
  price,
  rarity,
  frames: 1,
  frameMs: 500,
  tint: null,
  placement: "floor",
  draw,
  ...extra,
});

export const FANCY_FURNITURE: readonly FancyPiece[] = [
  piece("beanbag", "Beanbag", 1, 1, 16, 35, "common", beanbag, { tint: "#e25d5d" }),
  piece("bonsai", "Bonsai", 1, 1, 16, 45, "common", bonsai),
  piece("rug-persian", "Persian rug", 3, 2, 32, 60, "common", rug, { tint: C.rug, placement: "flat" }),
  piece("mini-fridge", "Retro mini fridge", 1, 1, 20, 70, "common", miniFridge, { tint: "#8fd3c7" }),
  piece("water-cooler", "Water cooler", 1, 1, 26, 55, "common", waterCooler, { frames: 2, frameMs: 900 }),
  piece("coffee-table", "Walnut coffee table", 2, 1, 16, 80, "common", coffeeTable),
  piece("monstera", "Big monstera", 1, 1, 30, 90, "uncommon", monstera),
  piece("globe", "Desk globe", 1, 1, 22, 90, "uncommon", globe),
  piece("lava-lamp", "Lava lamp", 1, 1, 22, 100, "uncommon", lavaLamp, {
    frames: 2,
    frameMs: 1200,
    tint: "#f28bb2",
  }),
  piece("whiteboard", "Whiteboard", 2, 1, 28, 110, "uncommon", whiteboard, { placement: "wall" }),
  piece("bookshelf-library", "Library bookshelf", 2, 1, 30, 140, "uncommon", bookshelf, {
    placement: "wall",
  }),
  piece("arc-lamp", "Arc floor lamp", 1, 1, 32, 120, "uncommon", arcLamp),
  piece("lounge-chair", "Danish lounge chair", 1, 1, 20, 180, "rare", loungeChair, { tint: "#c27a3a" }),
  piece("record-player", "Vinyl record player", 1, 1, 20, 200, "rare", recordPlayer, {
    frames: 2,
    frameMs: 250,
  }),
  piece("sofa-chesterfield", "Chesterfield sofa", 3, 1, 22, 240, "rare", sofa, { tint: "#3f8c50" }),
  piece("standing-desk", "Standing desk, two screens", 2, 1, 28, 260, "rare", standingDesk),
  piece("neon-sign", "Neon sign", 2, 1, 16, 220, "rare", neonSign, {
    frames: 2,
    frameMs: 700,
    tint: "#e86bd8",
    placement: "wall",
  }),
  piece("vending-machine", "Vending machine", 1, 1, 30, 240, "rare", vending, {
    frames: 2,
    frameMs: 800,
    tint: "#4f8fe0",
  }),
  piece("plant-wall", "Plant wall", 2, 1, 32, 300, "rare", plantWall, { placement: "wall" }),
  piece("foosball", "Foosball table", 2, 1, 22, 350, "epic", foosball),
  piece("espresso-bar", "Espresso bar", 2, 1, 26, 400, "epic", espressoBar, { frames: 2, frameMs: 600 }),
  piece("server-rack", "Server rack", 1, 1, 32, 420, "epic", serverRack, { frames: 2, frameMs: 400 }),
  piece("arcade-cabinet", "Arcade cabinet", 1, 1, 30, 450, "epic", arcadeCabinet, {
    frames: 2,
    frameMs: 500,
    tint: "#9b6fd6",
  }),
  piece("trophy-case", "Trophy case", 2, 1, 30, 500, "epic", trophyCase, { placement: "wall" }),
  piece("aquarium", "Aquarium", 2, 1, 24, 550, "epic", aquarium, { frames: 2, frameMs: 700 }),
  piece("ping-pong", "Ping-pong table", 3, 2, 32, 600, "epic", pingPong),
  piece("gong", "Ship-it gong", 2, 1, 30, 750, "legendary", gong, { frames: 2, frameMs: 300 }),
  piece("chandelier", "Crystal chandelier", 2, 1, 28, 900, "legendary", chandelier, {
    frames: 2,
    frameMs: 350,
    placement: "ceiling",
  }),
  piece("rubber-duck-statue", "Rubber-duck statue", 1, 1, 26, 1000, "legendary", duckStatue),
];

/** A piece by id: the company's, or a personal office's or a case's (`furniture-home.ts`). */
export const fancyPiece = (id: string): FancyPiece | undefined =>
  FANCY_FURNITURE.find((f) => f.id === id) ??
  HOME_FURNITURE.find((f) => f.id === id) ??
  CASE_FURNITURE.find((f) => f.id === id) ??
  NUSANTARA_FURNITURE.find((f) => f.id === id) ??
  RAGNAROK_FURNITURE.find((f) => f.id === id);

/** Which frame a piece shows at time `now` (ms). */
export const fancyFrame = (piece: FancyPiece, now: number): number =>
  Math.floor(now / piece.frameMs) % piece.frames;

const baked = cached(
  (id: string, frame: number, tint: string | undefined) => `${id}:${frame}:${tint ?? ""}`,
  (id: string, frame: number, tint: string | undefined) => {
    const f = fancyPiece(id);
    if (!f) throw new Error(`no fancy furniture "${id}"`);
    return bake(f.w * TILE, f.height, (p) => f.draw(p, frame % f.frames, tint ?? f.tint ?? C.fabric));
  },
);

/** One baked frame of a piece, in its colour (or its default), memoized. */
export const fancySprite = (id: string, frame = 0, tint?: string): HTMLCanvasElement =>
  baked(id, frame, tint);
