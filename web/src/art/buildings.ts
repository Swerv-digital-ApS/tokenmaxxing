import { PLOT_H, PLOT_W } from "@tokenmaxxing/core/maps.ts";
import { type Brand, HOUSE_TIERS, TILE } from "@tokenmaxxing/core/world.ts";
import { clamp } from "hanzio";
import { C, shade } from "./palette.ts";
import { bake, once, type Pen } from "./pixels.ts";

/**
 * Houses are drawn from rectangles on a 7×5-tile lot, door in the middle of the
 * bottom row. A company's house shows how hard its people push (tokens per
 * member): a cellar hatch in a fenced yard, a shack, a cottage, a two-storey
 * house, a villa, and a mansion with a tower that rises above its lot.
 * A company with a website gets its brand's colours and a plaque for its logo.
 */

/** A window in a building sprite, relative to its top-left corner. */
export interface Pane {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface Style {
  wall: string;
  wallDark: string;
  roof: string;
  roofDark: string;
  trim: string;
}

const LOT_W = PLOT_W * TILE;
const LOT_H = PLOT_H * TILE;
const MID = LOT_W / 2;

const COTTAGE: Style = {
  wall: "#f3e7cf",
  wallDark: "#dccbab",
  roof: C.roofRed,
  roofDark: C.roofRedDark,
  trim: C.woodDark,
};
const HOUSE: Style = {
  wall: C.white,
  wallDark: "#dcd6ca",
  roof: "#4f7fd0",
  roofDark: "#3b62a8",
  trim: "#3b62a8",
};
const VILLA: Style = {
  wall: "#fbf4e6",
  wallDark: "#e6dac2",
  roof: "#4a4f63",
  roofDark: "#363a4a",
  trim: "#8a6d3b",
};
const MANSION: Style = {
  wall: "#f6ecd6",
  wallDark: "#e2d2ae",
  roof: "#3f7a78",
  roofDark: "#2f5c5a",
  trim: "#d4a93a",
};
const SHACK: Style = {
  wall: C.woodLight,
  wallDark: C.wood,
  roof: "#7a5a44",
  roofDark: "#5e4433",
  trim: C.woodDark,
};
/** The basement's only colour is its hatch doors: wood, or the brand's roof colour. */
const BASEMENT: Style = { ...SHACK, roof: C.wood, roofDark: C.woodDark };
const STYLES = [BASEMENT, SHACK, COTTAGE, HOUSE, VILLA, MANSION];

const branded = (b: Brand): Style => ({
  wall: b.wall,
  wallDark: shade(b.wall, -0.1),
  roof: b.roof,
  roofDark: shade(b.roof, -0.25),
  trim: b.trim,
});

function window_(p: Pen, x: number, y: number, w = 12, h = 10): void {
  p.rect(x - 1, y - 1, w + 2, h + 2, C.ink);
  p.rect(x, y, w, h, "#9fd3ef");
  p.rect(x, y, w, 2, C.white);
  p.rect(x + Math.floor(w / 2), y, 1, h, C.ink);
  p.rect(x, y + Math.floor(h / 2), w, 1, C.ink);
  p.rect(x - 1, y + h + 1, w + 2, 1, C.woodDark);
}

function door(p: Pen, cx: number, bottom: number, color: string = C.woodDark): void {
  p.rect(cx - 7, bottom - 17, 14, 17, C.ink);
  p.rect(cx - 6, bottom - 16, 12, 16, color);
  p.rect(cx - 5, bottom - 14, 4, 5, C.wood);
  p.rect(cx + 1, bottom - 14, 4, 5, C.wood);
  p.px(cx + 3, bottom - 7, C.flowerYellow);
  p.rect(cx - 8, bottom - 1, 16, 1, C.stoneDark);
}

/** A gabled roof over `[x0, x0 + w)`, from `top` down to `bottom`, with shingle rows. */
function roof(p: Pen, x0: number, w: number, top: number, bottom: number, s: Style): void {
  const h = bottom - top;
  for (let y = 0; y < h; y++) {
    const inset = Math.max(0, Math.floor((h - y) * 0.9) - Math.floor(h * 0.45));
    p.rect(x0 + inset, top + y, w - inset * 2, 1, y % 4 === 3 ? s.roofDark : s.roof);
    p.px(x0 + inset, top + y, C.ink);
    p.px(x0 + w - inset - 1, top + y, C.ink);
  }
  p.rect(x0, bottom, w, 2, C.ink);
  p.rect(x0 + 1, bottom, w - 2, 1, s.roofDark);
}

/** A low picket fence around the lot, open at the bottom middle for the path to the door. */
function yard(p: Pen, H: number): void {
  const top = H - LOT_H + 3;
  const rail = (x: number, y: number, w: number) => {
    p.rect(x, y, w, 3, C.ink);
    p.rect(x, y + 1, w, 1, C.woodLight);
  };
  rail(2, top + 2, LOT_W - 4);
  rail(2, H - 6, MID - 12);
  rail(MID + 10, H - 6, MID - 12);
  for (let y = top; y < H - 4; y += 2) {
    p.rect(2, y, 3, 2, C.ink);
    p.rect(3, y, 1, 2, C.woodLight);
    p.rect(LOT_W - 5, y, 3, 2, C.ink);
    p.rect(LOT_W - 4, y, 1, 2, C.woodLight);
  }
  for (let x = 2; x < LOT_W - 2; x += 8) {
    if (x > MID - 12 && x < MID + 10) continue;
    for (const y of [top, H - 8]) {
      p.rect(x, y, 3, 6, C.ink);
      p.rect(x + 1, y + 1, 1, 4, C.woodLight);
    }
  }
}

/** Two columns and a lintel framing the front door. */
function portico(p: Pen, H: number, trim: string): void {
  p.rect(MID - 13, H - 30, 26, 3, C.ink);
  p.rect(MID - 12, H - 29, 24, 1, trim);
  for (const x of [MID - 12, MID + 8]) {
    p.rect(x, H - 27, 5, 26, C.ink);
    p.rect(x + 1, H - 27, 3, 26, C.white);
  }
}

function bush(p: Pen, cx: number, cy: number, r = 5): void {
  p.disc(cx, cy, r + 1, C.leafInk);
  p.disc(cx, cy, r, C.leafDark);
  p.disc(cx - 1, cy - 1, r - 1, C.leaf);
  p.px(cx - 2, cy - 3, C.leafLight);
}

/**
 * A gabled house `floors` storeys high, `w` wide from `x0`, standing on the lot's
 * bottom edge. Windows are spread evenly and skip the door. Returns the roof's top.
 */
function gabledHouse(
  p: Pen,
  H: number,
  opts: { x0: number; w: number; floors: number; style: Style; gap?: number },
  pane: (x: number, y: number) => void,
): number {
  const { x0, w, floors, style } = opts;
  const gap = opts.gap ?? 10;
  const wallTop = H - (floors * 18 + 10);
  const roofTop = wallTop - Math.round(w * 0.3);
  roof(p, x0, w, roofTop, wallTop, style);
  p.rect(x0 + 4, wallTop + 2, w - 8, H - wallTop - 2, C.ink);
  p.rect(x0 + 5, wallTop + 2, w - 10, H - wallTop - 3, style.wall);
  for (let y = wallTop + 5; y < H - 2; y += 8) p.rect(x0 + 5, y, w - 10, 1, style.wallDark);
  // The most windows that fit, always an odd number so the middle one sits over the door.
  let n = 1;
  while ((n + 2) * 12 + (n + 1) * gap <= w - 12) n += 2;
  const start = x0 + (w - (n * 12 + (n - 1) * gap)) / 2;
  for (let f = 0; f < floors; f++)
    for (let i = 0; i < n; i++) {
      if (f === 0 && i === (n - 1) / 2) continue;
      pane(start + i * (12 + gap), H - 26 - f * 18);
    }
  door(p, MID, H - 1, style.trim);
  return roofTop;
}

interface Plan {
  canvas: HTMLCanvasElement;
  /** Ground floor first, left to right: where people show when seen from outside. */
  panes: Pane[];
  /** Where the logo goes, if the company has one. */
  plaque: Pane | null;
}

interface Draw {
  p: Pen;
  H: number;
  s: Style;
  /** Whether there's a logo to hang; `plaque` is a no-op without one. */
  logo: boolean;
  pane: (x: number, y: number, w?: number, h?: number) => void;
  plaque: (x: number, y: number, w: number, h: number) => void;
}

/** Bakes a building on the lot (plus `above` pixels over it) and records its windows and plaque. */
function plan(above: number, draw: (d: Draw) => void): (s: Style, brand: Brand | null) => Plan {
  return (s, brand) => {
    const H = LOT_H + above;
    const panes: Pane[] = [];
    let plaque: Pane | null = null;
    const canvas = bake(LOT_W, H, (p) =>
      draw({
        p,
        H,
        s,
        logo: brand?.logo != null,
        pane: (x, y, w = 12, h = 10) => {
          window_(p, x, y, w, h);
          panes.push({ x, y, w, h });
        },
        plaque: (x, y, w, h) => {
          if (!brand?.logo) return;
          p.rect(x - 2, y - 2, w + 4, h + 4, C.ink);
          p.rect(x - 1, y - 1, w + 2, h + 2, brand.plaque);
          plaque = { x, y, w, h };
        },
      }),
    );
    panes.sort((a, b) => b.y - a.y || a.x - b.x);
    return { canvas, panes, plaque };
  };
}

const PLANS = [
  // Basement: a cellar hatch in a fenced yard, and one barred window at ground level.
  plan(0, ({ p, H, s, pane, plaque, logo }) => {
    yard(p, H);
    bush(p, 14, H - 20);
    if (!logo) bush(p, LOT_W - 14, H - 22, 4);
    p.rect(MID - 20, H - 26, 40, 25, C.ink);
    p.rect(MID - 19, H - 25, 38, 23, C.stoneDark);
    p.rect(MID - 15, H - 21, 30, 20, C.ink);
    for (let i = 0; i < 5; i++)
      p.rect(MID - 14, H - 20 + i * 4, 28, 3, ["#5a5048", "#4a423c", "#3a3430", "#2c2724", "#1f1b19"][i]!);
    // The hatch doors, swung open.
    p.rect(MID - 30, H - 34, 12, 20, C.ink);
    p.rect(MID - 29, H - 33, 10, 18, s.roof);
    p.rect(MID - 29, H - 27, 10, 1, s.roofDark);
    p.rect(MID + 18, H - 34, 12, 20, C.ink);
    p.rect(MID + 19, H - 33, 10, 18, s.roof);
    p.rect(MID + 19, H - 27, 10, 1, s.roofDark);
    p.rect(MID - 36, H - 16, 16, 12, C.stoneDark);
    pane(MID - 34, H - 14, 12, 8);
    p.rect(MID - 30, H - 14, 1, 8, C.ink);
    p.rect(MID - 26, H - 14, 1, 8, C.ink);
    // A lantern by the steps.
    p.rect(MID + 24, H - 12, 5, 7, C.ink);
    p.rect(MID + 25, H - 11, 3, 4, C.lamp);
    // A signpost for the logo.
    if (logo) {
      p.rect(MID + 39, H - 34, 3, 28, C.ink);
      p.rect(MID + 40, H - 34, 1, 28, C.woodDark);
    }
    plaque(MID + 30, H - 46, 20, 10);
  }),
  // Shack: three tiles of planks under a crooked roof.
  plan(0, ({ p, H, s, pane, plaque }) => {
    yard(p, H);
    bush(p, 14, H - 20);
    bush(p, LOT_W - 14, H - 20);
    const x0 = MID - 24;
    const top = H - 34;
    p.rect(x0 - 2, top - 12, 52, 14, C.ink);
    for (let y = 0; y < 12; y++)
      p.rect(
        x0 - 1 + Math.floor(y / 3),
        top - 11 + y,
        50 - Math.floor(y / 3),
        1,
        y % 4 === 3 ? s.roofDark : s.roof,
      );
    p.rect(x0, top, 48, 34, C.ink);
    p.rect(x0 + 1, top + 1, 46, 32, s.wall);
    for (let x = x0 + 5; x < x0 + 47; x += 6) p.rect(x, top + 1, 1, 32, s.wallDark);
    p.rect(x0 + 36, top - 20, 5, 10, C.ink);
    p.rect(x0 + 37, top - 19, 3, 9, C.metalLight);
    pane(x0 + 5, H - 24);
    door(p, MID, H - 1, s.trim);
    plaque(MID - 9, H - 31, 18, 9);
    p.rect(x0 + 50, H - 12, 9, 11, C.ink);
    p.rect(x0 + 51, H - 11, 7, 9, C.woodDark);
    p.rect(x0 + 51, H - 8, 7, 1, C.metal);
  }),
  // Cottage: red roof, chimney, flower boxes.
  plan(0, ({ p, H, s, pane, plaque }) => {
    yard(p, H);
    bush(p, 8, H - 18, 4);
    bush(p, LOT_W - 8, H - 18, 4);
    const roofTop = gabledHouse(p, H, { x0: 16, w: 80, floors: 1, style: s }, pane);
    plaque(MID - 11, roofTop + 7, 22, 12);
    p.rect(78, roofTop + 4, 8, 14, C.ink);
    p.rect(79, roofTop + 5, 6, 13, C.stoneDark);
    for (const x of [28, 72]) {
      p.rect(x - 1, H - 15, 14, 3, C.woodDark);
      for (let i = 0; i < 4; i++) p.px(x + 1 + i * 3, H - 16, [C.flowerRed, C.flowerYellow][i % 2]!);
    }
  }),
  // House: two storeys.
  plan(0, ({ p, H, s, pane, plaque }) => {
    yard(p, H);
    const roofTop = gabledHouse(p, H, { x0: 16, w: 80, floors: 2, style: s }, pane);
    p.rect(MID - 14, H - 21, 28, 3, s.trim);
    plaque(MID - 11, roofTop + 7, 22, 12);
  }),
  // Villa: the whole lot, a portico and a balcony ledge, hedges instead of a fence.
  plan(0, ({ p, H, s, pane, plaque }) => {
    const roofTop = gabledHouse(p, H, { x0: 0, w: LOT_W, floors: 2, style: s }, pane);
    plaque(MID - 12, roofTop + 12, 24, 13);
    portico(p, H, s.trim);
    p.rect(4, H - 33, LOT_W - 8, 3, C.ink);
    p.rect(5, H - 32, LOT_W - 10, 1, s.trim);
    bush(p, 6, H - 6, 5);
    bush(p, LOT_W - 7, H - 6, 5);
  }),
  // Mansion: three storeys, gold trim, and a tower with a flag above the lot.
  plan(40, ({ p, H, s, pane, plaque, logo }) => {
    const roofTop = gabledHouse(p, H, { x0: 0, w: LOT_W, floors: 3, style: s }, pane);
    const towerTop = 12;
    p.rect(MID - 16, towerTop, 32, roofTop - towerTop + 12, C.ink);
    p.rect(MID - 15, towerTop + 1, 30, roofTop - towerTop + 10, s.wall);
    roof(p, MID - 20, 40, 0, towerTop, s);
    // The logo takes the tower's top window.
    if (logo) plaque(MID - 11, towerTop + 6, 22, 12);
    else pane(MID - 6, towerTop + 8);
    pane(MID - 6, towerTop + 26);
    p.rect(MID, -2, 1, 2, C.ink);
    p.rect(0, H - (3 * 18 + 10), LOT_W, 2, s.trim);
    portico(p, H, s.trim);
    bush(p, 6, H - 6, 5);
    bush(p, LOT_W - 7, H - 6, 5);
  }),
];

const plans = new Map<string, Plan>();

/** A company's house by tier (0 basement … 5 mansion) and brand, bottom edge on the lot's bottom. */
export function house(tier: number, brand: Brand | null): Plan {
  const t = clamp(tier, 0, HOUSE_TIERS - 1);
  const key = brand
    ? `${t}:${brand.roof}${brand.wall}${brand.trim}${brand.plaque}:${brand.logo !== null}`
    : `${t}`;
  const plan = plans.get(key) ?? PLANS[t]!(brand ? branded(brand) : STYLES[t]!, brand);
  plans.set(key, plan);
  return plan;
}

export const inn = once(() => {
  const W = 7 * TILE;
  const H = 4 * TILE + 14;
  const s: Style = {
    wall: "#e9d7b5",
    wallDark: "#d3bd96",
    roof: "#4f9b6a",
    roofDark: "#3b7a52",
    trim: C.woodDark,
  };
  return bake(W, H, (p) => {
    p.rect(2, H - 3, W - 4, 3, C.shadow);
    roof(p, 0, W, 0, H - 38, s);
    p.rect(4, H - 36, W - 8, 36, C.ink);
    p.rect(5, H - 36, W - 10, 35, s.wall);
    for (let x = 5; x < W - 5; x += 6) p.rect(x, H - 36, 1, 35, s.wallDark);
    window_(p, 12, H - 26);
    window_(p, 30, H - 26);
    window_(p, W - 44, H - 26);
    window_(p, W - 24, H - 26);
    door(p, W / 2, H - 1);
    // Hanging sign.
    p.rect(W / 2 + 10, H - 34, 1, 4, C.ink);
    p.rect(W / 2 + 6, H - 30, 12, 7, C.ink);
    p.rect(W / 2 + 7, H - 29, 10, 5, C.flowerYellow);
  });
});
