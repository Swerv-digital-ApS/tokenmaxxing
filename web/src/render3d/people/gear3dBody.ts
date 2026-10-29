/**
 * Things worn on the body in 3D: outfit marks and patterns for every outfit that has them, company merch, the
 * ten things held in a hand and the seven worn on the back (`core/src/wardrobe.ts`, `loot.ts`; 2D art in
 * `web/src/art/wardrobe.ts`, `loot.ts`, `merch.ts`).
 *
 * All of it is cubes on the voxel body's own grid (`voxel.ts`: one cube is 0.045 m). The torso is 7 wide,
 * 8 tall and 4 deep: x from -3.5 to 3.5, y from 0 (the belt) to 8 (the neck), z from -2 (back) to 2 (front).
 * Builders place blocks in those cube units with `Vx`. Marks are painted on a small canvas and read back as
 * raised cubes a third of a body cube across, so a pattern is real relief, not a sticker.
 */
import * as THREE from "three";
import { glow, type Model, seeded, tint } from "../kit/kit.ts";
import { dome, lit, ring, see, shaped, sign } from "./gear3dHead.ts";
import { isVox, pixelPatch, squarePane, U, type VoxModel, Vx, vpart } from "./voxgear.ts";

export const NECK = 0.52;
const CHEST_COLS = 19;
const CHEST_ROWS = 14;
const CELL = U / 3;
/** Chest-local height of the middle of the marks, and where the torso's faces are. */
const CHEST_Y = 0.21;
const FRONT = 2 * U;

export interface BodyCtx {
  /** The torso's frame: origin at the belt, centred, +z the front, one unit = one metre, cubes are `U`. */
  body: VoxModel;
  /** Both arms (the second is the one that holds things), the shoulder at their origin. */
  arms: [Model, Model];
  /** The outfit's colours and trousers. */
  main: string;
  dark: string;
  pants: string;
  /** Registers something that moves. */
  tick(fn: (t: number, walking: boolean) => void): void;
  /** Changes what colour the sleeves are. */
  sleeves(color: string): void;
}

type Paint2D = (g: CanvasRenderingContext2D, w: number, h: number) => void;
export const px = (g: CanvasRenderingContext2D, c: string, x: number, y: number, w = 1, h = 1) => {
  g.fillStyle = c;
  g.fillRect(x, y, w, h);
};

/** Raised marks on the chest, and (when given) the back. `lightIt` makes them shine. */
export function marks(c: BodyCtx, front?: Paint2D, back?: Paint2D, lightIt = false): void {
  const patch = (draw: Paint2D, z: number, turn: number, lit2: boolean) => {
    const o = pixelPatch(c.body, {
      cols: CHEST_COLS,
      rows: CHEST_ROWS,
      cell: CELL,
      depth: 0.011,
      draw,
      at: [0, CHEST_Y, z],
      lit: lit2,
      fill: 0.3,
    });
    o.rotation.y = turn;
  };
  if (front) patch(front, FRONT, 0, lightIt);
  if (back) patch(back, -FRONT, Math.PI, false);
}

/** A grid of blocks over the torso, by cube coordinates. */
export const grid = (c: BodyCtx) => new Vx(c.body);

/** A band of blocks round the top of the torso: a collar, a neck roll. */
export function roll(c: BodyCtx, color: string, h = 1, pad = 0.35, y = 8 - h): void {
  const v = grid(c);
  const x = 3.5 + pad;
  const zf = 2 + pad;
  v.b(-x, y, zf - 0.6, 2 * x, h, 0.6, color);
  v.b(-x, y, -zf, 2 * x, h, 0.6, color);
  v.b(-x, y, -zf, 0.6, h, 2 * zf, color);
  v.b(x - 0.6, y, -zf, 0.6, h, 2 * zf, color);
}

/** A hood hanging down the back of the neck, a stepped pouch with a darker lining, and the roll it hangs from. */
export function hood(c: BodyCtx, color: string, inner: string): void {
  const v = grid(c);
  roll(c, color, 1.2, 0.5);
  v.b(-3, 4.8, -3.1, 6, 2.9, 1.1, color);
  v.b(-2.2, 3.9, -3.1, 4.4, 1, 1.1, color);
  v.b(-1.4, 3.2, -3.1, 2.8, 0.8, 1.1, color);
  v.b(-2.4, 6.6, -3.35, 4.8, 1, 0.3, inner);
  v.b(-1.6, 5.7, -3.35, 3.2, 1, 0.3, inner);
}

/** Jacket tails: two flaps hanging from the back of the belt, swinging a little as they walk. */
export function tails(c: BodyCtx, color: string, len = 3.2, trim?: string): void {
  const pivot = vpart(c.body, [0, 0.6 * U, -2 * U]);
  const v = new Vx(pivot);
  for (const s of [-1, 1]) {
    const x = s > 0 ? 0.5 : -3.6;
    v.b(x, -len, -0.55, 3.1, len, 0.55, color);
    if (trim) v.b(x, -len, -0.6, 3.1, 0.5, 0.6, trim);
  }
  c.tick((t, walking) => {
    pivot.rotation.x = walking ? 0.12 + Math.abs(Math.sin(t * 11)) * 0.16 : 0.03 + Math.sin(t * 1.5) * 0.02;
  });
}

/** Lapels of a jacket: stepped blocks narrowing from each shoulder to the waist. */
function lapels(c: BodyCtx, color: string, shirt: string, base = 3.5): void {
  const v = grid(c);
  v.b(-1.5, base + 0.5, FRONT / U, 3, 8 - base - 0.5, 0.3, shirt);
  v.b(-0.5, base - 1, FRONT / U, 1, 1.6, 0.3, shirt);
  const rows: [number, number][] = [
    [7, 2.5],
    [6, 2],
    [5, 1.5],
    [4, 1],
  ];
  for (const [y, x] of rows) {
    if (y < base) continue;
    v.b(-x - 0.5, y, 2, 1, 1, 0.5, color);
    v.b(x - 0.5, y, 2, 1, 1, 0.5, color);
  }
  v.b(-3.5, 7, 2, 1, 1, 0.5, color);
  v.b(2.5, 7, 2, 1, 1, 0.5, color);
}

/** Arm overlays: a long sleeve of colour over each arm, `len` cubes down from the shoulder. */
function sleevesOver(c: BodyCtx, color: string, len = 6, only?: 0 | 1): void {
  c.arms.forEach((arm, i) => {
    if (only !== undefined && only !== i) return;
    new Vx(vpart(arm)).b(-1.12, -len, -1.12, 2.24, len, 2.24, color);
  });
}

/** A stripe down the outside of each sleeve. */
export function sleeveStripes(c: BodyCtx, color: string): void {
  c.arms.forEach((arm, i) => {
    const s = i ? 1 : -1;
    const v = new Vx(vpart(arm));
    v.b(s > 0 ? 0.95 : -1.3, -7, -0.4, 0.35, 7, 0.8, color);
  });
}

/** Stepped caps over the shoulders (armour, a cape's mantle). */
function pauldrons(c: BodyCtx, color: string, trim: string): void {
  c.arms.forEach((arm, i) => {
    const s = i ? 1 : -1;
    const v = new Vx(vpart(arm));
    v.b(-1.5, -0.4, -1.5, 3, 1.4, 3, color);
    v.b(-1.2, 0.9, -1.2, 2.4, 0.6, 2.4, trim);
    v.b(s > 0 ? 0.6 : -2.2, -1.8, -1.5, 1.6, 1.4, 3, color);
  });
}

const plaid = (g: CanvasRenderingContext2D, w: number, h: number, base: string, a: string, b: string) => {
  px(g, base, 0, 0, w, h);
  for (let x = 0; x < w; x += 12) px(g, a, x, 0, 3, h);
  for (let y = 0; y < h; y += 10) px(g, a, 0, y, w, 3);
  for (let x = 6; x < w; x += 12) px(g, b, x, 0, 1, h);
  for (let y = 5; y < h; y += 10) px(g, b, 0, y, w, 1);
};

const text = (g: CanvasRenderingContext2D, s: string, x: number, y: number, size: number, color: string) => {
  g.fillStyle = color;
  g.font = `700 ${size}px ui-monospace, Menlo, monospace`;
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText(s, x, y);
};

// MARK: Capes

interface CapeLook {
  /** Cubes across at the shoulders, and how much wider each step gets. */
  w: number;
  flare: number;
  /** Steps, and each one's height in cubes. */
  steps: number;
  h: number;
  /** A colour per step and column (three columns). */
  colour: (step: number, col: number) => string;
  /** Where the top edge hangs from: cubes above the belt, and how far behind the torso's back. */
  y: number;
  thick?: number;
}

/**
 * A cape of stepped slabs hung one below the other: each step is a child of the one above, so when they walk the
 * lower steps swing out later than the upper ones and the cape ripples.
 */
function steppedCape(parent: VoxModel, o: CapeLook, tick: BodyCtx["tick"], z: number): VoxModel {
  const thick = o.thick ?? 0.7;
  const top = vpart(parent, [0, o.y * U, z * U]);
  let at: VoxModel = top;
  const steps: VoxModel[] = [];
  for (let i = 0; i < o.steps; i++) {
    const w = o.w + o.flare * i;
    const colW = [w * 0.34, w * 0.32, w * 0.34];
    let x = -w / 2;
    for (let col = 0; col < 3; col++) {
      at.box([colW[col]! * U, o.h * U, thick * U], o.colour(i, col), [
        (x + colW[col]! / 2) * U,
        -o.h * U,
        -(thick / 2) * U,
      ]);
      x += colW[col]!;
    }
    const next = vpart(at, [0, -o.h * U, 0]);
    steps.push(at);
    at = next;
  }
  tick((t, walking) => {
    steps.forEach((s, i) => {
      const lag = Math.sin(t * 11 - i * 0.8);
      s.rotation.x = walking
        ? 0.1 + Math.abs(Math.sin(t * 11)) * 0.1 * (i ? 0.7 : 1.3) + lag * 0.06 * i
        : 0.03 + (Math.sin(t * 1.6 - i * 0.6) + 1) * 0.018 * (i + 1);
      s.rotation.z = walking ? Math.sin(t * 5.5) * 0.03 * i : Math.sin(t * 0.9 + i) * 0.01 * i;
    });
  });
  return top;
}

// MARK: Outfits

type OutfitBuilder = (c: BodyCtx) => void;

// biome-ignore format: a catalogue reads best one to a line
export const OUTFIT_BUILDERS: Record<number, OutfitBuilder> = {
  // Hacker hoodie: green drawstrings, a pouch and a hood.
  8: (c) => {
    marks(c, (g) => {
      for (const x of [21, 35]) {
        px(g, "#3ddc84", x, 0, 2, 13);
        px(g, "#3ddc84", x - 1, 13, 4, 3);
      }
      text(g, "</>", 29, 31, 11, "#3ddc84");
    });
    hood(c, c.dark, "#101814");
    const v = grid(c);
    v.b(-3, 1, 2, 6, 3, 0.4, tint(c.main, -0.18));
    v.b(-3.3, 1, 1.6, 0.6, 3, 0.8, tint(c.main, -0.1));
    v.b(2.7, 1, 1.6, 0.6, 3, 0.8, tint(c.main, -0.1));
  },
  // Sharp suit: white shirt, lapels and a tie.
  9: (c) => {
    lapels(c, "#14161f", "#f4f4f0");
    const v = grid(c);
    v.b(-0.5, 3.3, 2.3, 1, 4.4, 0.35, "#c23a3a");
    v.b(-0.5, 7, 2.3, 1, 0.8, 0.35, "#a82a2a");
    v.b(-0.5, 2.8, 2.3, 1, 0.5, 0.35, "#a82a2a");
    for (const y of [1.2, 2.2]) v.b(-0.25, y, 2, 0.5, 0.5, 0.4, "#14161f");
    roll(c, "#14161f", 0.9, 0.3);
    tails(c, "#14161f");
  },
  // Galaxy jacket: stars on violet, pink trim and zip.
  10: (c) => {
    const rnd = seeded(10);
    marks(
      c,
      (g, w, h) => {
        for (let i = 0; i < 20; i++) {
          const x = Math.floor(rnd() * (w - 4)),
            y = Math.floor(rnd() * (h - 6));
          px(g, i % 3 ? "#ffd1f4" : "#ffffff", x, y, 2, 2);
        }
        px(g, "#e86bd8", 27, 0, 3, h);
        for (const [x, y] of [
          [10, 10],
          [44, 18],
          [18, 26],
        ] as const) {
          px(g, "#fff", x, y - 2, 2, 6);
          px(g, "#fff", x - 2, y, 6, 2);
        }
      },
      (g, w, h) => {
        for (let i = 0; i < 24; i++)
          px(g, i % 3 ? "#ffd1f4" : "#ffffff", Math.floor(rnd() * (w - 2)), Math.floor(rnd() * h), 2, 2);
        px(g, "#7a4fe0", 18, 10, 22, 14);
        px(g, "#a07af0", 22, 14, 14, 6);
      },
    );
    roll(c, "#e86bd8", 1, 0.3);
    const v = grid(c);
    v.b(-3.7, 0, -2.3, 7.4, 1, 4.6, "#e86bd8");
  },
  // Gold suit: a lighter shirt, dark-gold lapels, buttons and a shine.
  11: (c) => {
    lapels(c, "#b98a1f", "#fff0b0");
    const v = grid(c);
    for (const y of [1.2, 2.4]) v.b(-0.25, y, 2, 0.5, 0.5, 0.4, "#fff0b0");
    roll(c, "#b98a1f", 0.9, 0.3);
    tails(c, "#d9a521", 3.2, "#fff0b0");
  },
  // Server-rack armour: seams, rivets and blinking lights.
  12: (c) => {
    marks(
      c,
      (g, w, h) => {
        px(g, "#8a93a1", 3, 3, w - 6, 4);
        px(g, "#8a93a1", 3, 18, w - 6, 3);
        px(g, "#8a93a1", 3, 33, w - 6, 4);
        px(g, "#3a3f4b", 27, 0, 3, h);
        for (const x of [5, 50]) for (const y of [10, 25, 38]) px(g, "#c4ccd6", x, y, 3, 3);
      },
      (g, w) => {
        px(g, "#8a93a1", 3, 6, w - 6, 4);
        px(g, "#8a93a1", 3, 20, w - 6, 4);
        for (let x = 8; x < w - 8; x += 9) px(g, "#3a3f4b", x, 27, 4, 11);
      },
    );
    pauldrons(c, "#8a93a1", "#c4ccd6");
    roll(c, "#3a3f4b", 1, 0.3);
    const v = grid(c);
    const leds = [
      [-2.2, "#3ddc84"],
      [-0.7, "#f5c842"],
      [0.8, "#3ddc84"],
      [2.1, "#ff5a4f"],
    ] as const;
    const boxes = leds.map(([x, col], i) => v.b(x - 0.3, 5.3 + (i % 2) * 1.1, 2.3, 0.6, 0.6, 0.3, lit(col)));
    c.tick((t) =>
      boxes.forEach((b, i) => {
        b.visible = Math.sin(t * 4 + i * 1.7) > -0.1;
      }),
    );
  },
  // Hoodie of infinite context: a glowing infinity on the chest, hood down the back.
  13: (c) => {
    const lemniscate = (g: CanvasRenderingContext2D, w: number, h: number, lw: number, col: string) => {
      g.strokeStyle = col;
      g.lineWidth = lw;
      g.lineCap = "butt";
      g.beginPath();
      for (let i = 0; i <= 40; i++) {
        const a = (i / 40) * Math.PI * 2;
        const d = 1 + Math.sin(a) ** 2;
        const x = w / 2 + (19 * Math.cos(a)) / d;
        const y = h / 2 + 2 + (19 * Math.sin(a) * Math.cos(a)) / d;
        if (i) g.lineTo(x, y);
        else g.moveTo(x, y);
      }
      g.stroke();
    };
    marks(c, (g, w, h) => lemniscate(g, w, h, 4.5, "#7fe8ff"), undefined, true);
    marks(c, undefined, (g, w) => {
      px(g, "#4a3d82", 6, 0, w - 12, 5);
    });
    hood(c, "#4a3d82", "#2a2150");
  },
  // Rain jacket: a zip, drawstrings and a hood.
  14: (c) => {
    marks(
      c,
      (g, _w, h) => {
        px(g, "#8a6a10", 27, 0, 3, h);
        for (const x of [21, 36]) {
          px(g, "#f4efe4", x, 0, 2, 11);
          px(g, "#f4efe4", x - 1, 11, 4, 4);
        }
      },
      (g, w) => {
        px(g, "#c99a1a", 6, 0, w - 12, 4);
      },
    );
    hood(c, "#c99a1a", "#8a6a10");
    const v = grid(c);
    for (const s of [-1, 1]) v.b(s > 0 ? 0.9 : -3.1, 1.3, 2, 2.2, 1.3, 0.4, "#a87c12");
    v.b(-3.7, 0, -2.3, 7.4, 0.9, 4.6, "#a87c12");
  },
  // Lab coat: open over a blue shirt, a red pen in the pocket.
  15: (c) => {
    marks(
      c,
      (g, _w, h) => {
        px(g, "#6fa8dc", 21, 0, 16, h);
        px(g, "#cfd3d6", 18, 0, 3, h);
        px(g, "#cfd3d6", 37, 0, 3, h);
        px(g, "#e0584f", 8, 17, 3, 9);
        px(g, "#3a3f4b", 13, 18, 3, 8);
        px(g, "#cfd3d6", 5, 26, 12, 2);
      },
      (g, _w, h) => {
        px(g, "#e2e4e2", 27, 0, 3, h);
      },
    );
    roll(c, "#e8eaec", 1, 0.45);
    const v = grid(c);
    for (const s of [-1, 1]) {
      v.b(s > 0 ? 0.8 : -3.5, -3.4, 1.5, 2.7, 3.7, 0.6, "#e8eaec");
      v.b(s > 0 ? 2.3 : -4.0, 0.5, 2, 1.2, 4.6, 0.5, "#e8eaec");
    }
    tails(c, "#e8eaec", 3.4);
  },
  // Flannel shirt: red checks.
  16: (c) => {
    marks(
      c,
      (g, w, h) => {
        plaid(g, w, h, "#c43b3b", "#8a2424", "#4a1214");
        px(g, "#4a1214", 27, 0, 3, h);
        for (const y of [4, 14, 24, 34]) px(g, "#f4efe4", 27, y, 3, 3);
      },
      (g, w, h) => plaid(g, w, h, "#c43b3b", "#8a2424", "#4a1214"),
    );
    roll(c, "#8a2424", 0.9, 0.3);
  },
  // Founder vest: grey fleece over a blue shirt, a tiny logo.
  17: (c) => {
    sleevesOver(c, "#7fb0e6", 6);
    marks(
      c,
      (g, w, h) => {
        px(g, "#7fb0e6", 0, 0, 6, h);
        px(g, "#7fb0e6", w - 6, 0, 6, h);
        px(g, "#7fb0e6", 20, 0, 18, 4);
        px(g, "#3a3f46", 27, 4, 3, h);
        px(g, "#7fb0e6", 40, 8, 9, 9);
        px(g, "#f4f1ea", 43, 11, 3, 3);
      },
      (g, w) => {
        px(g, "#7fb0e6", 0, 0, 6, 42);
        px(g, "#7fb0e6", w - 6, 0, 6, 42);
      },
    );
    roll(c, "#3a3f46", 1, 0.3);
  },
  // Merge-conflict sweater: a red and white zigzag, and the markers across the chest.
  18: (c) => {
    marks(
      c,
      (g, w, _h) => {
        for (let x = 0; x < w; x += 6) px(g, x % 12 ? "#f4efe4" : "#e0584f", x, 8 + (x % 12 ? 0 : 5), 6, 6);
        text(g, "<<<", 29, 30, 13, "#f4efe4");
      },
      (g, w) => {
        for (let x = 0; x < w; x += 6) px(g, x % 12 ? "#f4efe4" : "#e0584f", x, 10 + (x % 12 ? 0 : 5), 6, 6);
      },
    );
    roll(c, "#e8e0d0", 1.8, 0.5);
    const v = grid(c);
    v.b(-3.7, 0, -2.3, 7.4, 0.9, 4.6, "#e8e0d0");
  },
  // Tuxedo: a white shirt and a bow tie.
  19: (c) => {
    lapels(c, "#3a3a44", "#f4f4f0", 3.5);
    const v = grid(c);
    for (const y of [4.3, 5.8, 3]) v.b(-0.25, y, 2.3, 0.5, 0.5, 0.35, "#14121a");
    v.b(-1.8, 6.6, 2.4, 1.3, 1, 0.5, "#e0584f");
    v.b(0.5, 6.6, 2.4, 1.3, 1, 0.5, "#e0584f");
    v.b(-0.5, 6.7, 2.55, 1, 0.8, 0.5, "#a82a2a");
    roll(c, "#3a3a44", 0.9, 0.3);
    tails(c, "#2f2f38", 4.2);
  },
  // Space suit: an orange collar ring, a chest panel of lights.
  20: (c) => {
    marks(
      c,
      (g, w, _h) => {
        px(g, "#3a3f4b", 17, 9, 24, 15);
        px(g, "#b8bec8", 4, 30, w - 8, 3);
        px(g, "#e0584f", 4, 3, 9, 6);
        px(g, "#4f8fe0", 4, 3, 4, 6);
        px(g, "#fbf7ef", 8, 6, 5, 2);
      },
      (g, w, _h) => {
        px(g, "#9aa3b0", 12, 4, w - 24, 26);
        px(g, "#6a7380", 14, 8, w - 28, 18);
      },
    );
    roll(c, "#f08a3c", 1.4, 0.55);
    const v = grid(c);
    v.b(-3.7, 0.4, -2.3, 7.4, 0.8, 4.6, "#b8bec8");
    const lights = [
      [-1.5, "#3ddc84"],
      [0, "#e0584f"],
      [1.5, "#8fe3ff"],
    ] as const;
    const boxes = lights.map(([x, col]) => v.b(x - 0.4, 5, 2.3, 0.8, 0.8, 0.3, lit(col)));
    c.tick((t) =>
      boxes.forEach((b, i) => {
        b.visible = Math.sin(t * 3 + i * 2.1) > -0.2;
      }),
    );
  },
  // Retro tracksuit: white stripes down the sleeves, a white collar and zip.
  21: (c) => {
    marks(
      c,
      (g, w, h) => {
        px(g, "#f4f4f0", 27, 0, 3, h);
        px(g, "#2fa39a", 20, 0, 18, 3);
        px(g, "#f4f4f0", 0, 0, 3, h);
        px(g, "#f4f4f0", w - 3, 0, 3, h);
      },
      (g, w, h) => {
        px(g, "#f4f4f0", 0, 0, 3, h);
        px(g, "#f4f4f0", w - 3, 0, 3, h);
        px(g, "#f4f4f0", 14, 0, w - 28, 3);
      },
    );
    roll(c, "#f4f4f0", 1.4, 0.4);
    sleeveStripes(c, "#f4f4f0");
  },
  // Denim overalls over a white tee, two brass buttons.
  22: (c) => {
    const v = grid(c);
    v.b(-3, 0.9, 2, 6, 4.2, 0.4, "#3f6fb0");
    v.b(-2.9, 5.1, 2, 1, 2.9, 0.4, "#3f6fb0");
    v.b(1.9, 5.1, 2, 1, 2.9, 0.4, "#3f6fb0");
    v.b(-2.9, 5, 2.4, 1, 1, 0.3, "#f5c842");
    v.b(1.9, 5, 2.4, 1, 1, 0.3, "#f5c842");
    v.b(-1.2, 2.2, 2.4, 2.4, 1.6, 0.3, "#2c5088");
    v.b(-2.9, 5.9, -2.4, 1, 2.1, 0.4, "#3f6fb0");
    v.b(1.9, 5.9, -2.4, 1, 2.1, 0.4, "#3f6fb0");
    v.b(-3, 0.9, -2.4, 6, 3.2, 0.4, "#3f6fb0");
  },
  // Prompt wizard robe: gold stars, and long enough to hide the trousers.
  23: (c) => {
    const rnd = seeded(23);
    const stars = (g: CanvasRenderingContext2D, w: number, h: number, n: number) => {
      for (let i = 0; i < n; i++) {
        const x = 3 + Math.floor(rnd() * (w - 8)),
          y = 3 + Math.floor(rnd() * (h - 8));
        px(g, "#f5d14a", x, y, 2, 2);
        if (i % 3 === 0) {
          px(g, "#f5d14a", x - 2, y, 6, 2);
          px(g, "#f5d14a", x, y - 2, 2, 6);
        }
      }
    };
    marks(
      c,
      (g, w, h) => {
        stars(g, w, h, 10);
        px(g, "#f5d14a", 0, 39, w, 3);
      },
      (g, w, h) => stars(g, w, h, 12),
    );
    // A skirt of stepped blocks, wider the lower it goes, down to the ankles.
    const v = grid(c);
    const layers: [number, number, number, number][] = [
      [-0.9, 1.1, 8, 4.8],
      [-3, 2.1, 8.6, 5.4],
      [-5.2, 2.2, 9.2, 6],
      [-7.4, 2.2, 9.8, 6.4],
    ];
    for (const [y, h, w, d] of layers) v.b(-w / 2, y, -d / 2, w, h, d, c.main);
    v.b(-5, -8.1, -3.4, 10, 0.7, 6.8, "#f5d14a");
    v.b(-3.9, 0, -2.4, 7.8, 0.7, 4.8, "#f5d14a");
    for (const [x, y] of [
      [-3, -2],
      [2, -4],
      [-1, -6],
      [3, -6.6],
      [-3.5, -4.6],
    ] as const)
      v.b(x, y, 3.1 - Math.abs(y) * 0.05 + 0.05, 0.7, 0.7, 0.3, "#f5d14a");
    roll(c, c.dark, 1, 0.3);
  },
  // Hazard vest: reflective strips.
  24: (c) => {
    marks(
      c,
      (g, w, h) => {
        px(g, "#e8eef2", 7, 0, 8, h);
        px(g, "#e8eef2", w - 15, 0, 8, h);
        px(g, "#e8eef2", 7, 26, w - 14, 6);
      },
      (g, w, h) => {
        g.strokeStyle = "#e8eef2";
        g.lineWidth = 6;
        g.beginPath();
        g.moveTo(10, 2);
        g.lineTo(w - 10, h - 6);
        g.moveTo(w - 10, 2);
        g.lineTo(10, h - 6);
        g.stroke();
      },
    );
    roll(c, c.dark, 0.8, 0.25);
  },
  // Golden regalia: an ermine collar, a ruby brooch and a purple sash with a gold buckle.
  25: (c) => {
    marks(
      c,
      (g, w, h) => {
        g.strokeStyle = "#7a4fb8";
        g.lineWidth = 9;
        g.beginPath();
        g.moveTo(8, -2);
        g.lineTo(w - 6, h - 6);
        g.stroke();
        px(g, "#fff1a8", 36, 24, 7, 7);
        px(g, "#b07a12", 38, 26, 3, 3);
        px(g, "#d99a16", 0, 38, w, 4);
      },
      (g, w, h) => {
        g.strokeStyle = "#7a4fb8";
        g.lineWidth = 9;
        g.beginPath();
        g.moveTo(w - 8, -2);
        g.lineTo(6, h - 6);
        g.stroke();
      },
    );
    // The ermine collar: two rings of white blocks, black spots, a ruby on the clasp.
    const v = grid(c);
    roll(c, "#fbf7ef", 1.3, 0.8);
    v.b(-4.6, 6.6, -2.8, 9.2, 0.7, 5.6, "#fbf7ef");
    for (const [x, z] of [
      [-4, 1.5],
      [-2, 2.7],
      [0.5, 2.9],
      [2.7, 2.2],
      [4, 0.5],
      [-4.2, -1.5],
      [4, -1.8],
      [-2, -2.9],
      [2, -2.9],
    ] as const)
      v.b(x - 0.25, 6.65, z - 0.25, 0.5, 0.75, 0.5, "#1c1a24");
    v.b(-0.5, 5.2, 2.7, 1, 1, 0.5, "#e0405a");
    v.b(-3.7, 0, -2.3, 7.4, 0.9, 4.6, "#d99a16");
  },
  // Compacting… scarf: a cream jumper and a striped scarf with its end hanging.
  26: (c) => {
    const v = grid(c);
    const cols = ["#e0584f", "#f4efe4"];
    for (let i = 0; i < 5; i++) {
      v.b(-3.9 + i * 1.56, 6.9, 1.9, 1.56, 1.2, 0.8, cols[i % 2]!);
      v.b(-3.9 + i * 1.56, 6.9, -2.7, 1.56, 1.2, 0.8, cols[(i + 1) % 2]!);
    }
    for (let i = 0; i < 3; i++) {
      v.b(-4.1, 6.9, -2.7 + i * 1.8, 0.9, 1.2, 1.8, cols[i % 2]!);
      v.b(3.2, 6.9, -2.7 + i * 1.8, 0.9, 1.2, 1.8, cols[(i + 1) % 2]!);
    }
    for (let i = 0; i < 5; i++) v.b(1.2, 5.8 - i * 1.2, 2.7, 1.6, 1.2, 0.6, cols[i % 2]!);
    marks(c, (g, w) => {
      for (let x = 0; x < w; x += 6) px(g, "#c9c0ad", x, 22, 2, 20);
    });
  },
  // Two-tone suit: ours on the left, theirs on the right.
  27: (c) => {
    marks(
      c,
      (g, _w, h) => {
        px(g, "#e0584f", 29, 0, 28, h);
        px(g, "#14161f", 27, 0, 3, h);
        for (const y of [12, 24]) px(g, "#f4f4f0", 23, y, 3, 3);
        g.fillStyle = "#f4f4f0";
        g.beginPath();
        g.moveTo(20, 0);
        g.lineTo(37, 0);
        g.lineTo(28, 14);
        g.fill();
      },
      (g, _w, h) => {
        px(g, "#e0584f", 29, 0, 28, h);
        px(g, "#14161f", 27, 0, 3, h);
      },
    );
    sleevesOver(c, "#e0584f", 6, 1);
    const v = grid(c);
    v.b(0, 7, 2, 3.9, 1, 0.4, "#e0584f");
    v.b(-3.9, 7, 2, 3.9, 1, 0.4, "#14161f");
    tails(c, "#14161f", 3);
  },
  // Shimmering cape: violet and teal round the shoulders and down the back, a gold clasp.
  28: (c) => {
    const rnd = seeded(28);
    const grad = ["#b57cff", "#8b5cf0", "#5b3fbf", "#4a5fd0", "#3fa8d8", "#5ff0d0"];
    steppedCape(
      c.body,
      {
        w: 7.4,
        flare: 0.5,
        steps: 6,
        h: 1.5,
        y: 7.6,
        thick: 0.7,
        colour: (i, col) => (rnd() > 0.88 ? "#ffd35c" : tint(grad[i]!, col === 1 ? 0 : -0.12)),
      },
      c.tick,
      -2.4,
    );
    const v = grid(c);
    for (const s of [-1, 1]) {
      v.b(s > 0 ? 2.9 : -5.6, 7.6, -2.4, 2.7, 1, 5, "#5b3fbf");
      v.b(s > 0 ? 3.4 : -5.1, 8.5, -1.9, 1.7, 0.5, 4, "#b57cff");
    }
    v.b(-2.6, 7, 2, 5.2, 0.6, 0.4, "#5b3fbf");
    v.b(-0.6, 6.5, 2.3, 1.2, 1.2, 0.5, "#ffd35c");
  },
  // Pinstripe suit: navy with pale stripes, a white collar and a red tie.
  29: (c) => {
    const stripes: Paint2D = (g, w, h) => {
      for (let x = 3; x < w - 2; x += 9) px(g, "#56658f", x, 0, 2, h);
    };
    marks(c, stripes, stripes);
    lapels(c, "#1f2740", "#f4f4f0");
    const v = grid(c);
    v.b(-0.5, 3.3, 2.3, 1, 4.4, 0.35, "#e0384f");
    v.b(-0.5, 7, 2.3, 1, 0.8, 0.35, "#b82a3d");
    v.b(-0.5, 2.8, 2.3, 1, 0.5, 0.35, "#b82a3d");
    roll(c, "#f4f4f0", 0.7, 0.3);
    tails(c, "#1f2740");
  },
};

// MARK: Company merch

export interface MerchLook {
  main: string;
  shade: string;
  accent: string;
  initials: string;
  /** What its people drew: rows of 4×3-to-wide pixel strings with `a` accent, `w` white, `k` ink; absent: the initials. */
  design?: string[] | null;
}

/** A tee or hoodie in the company's colours with its logo on the chest. */
export function merchTop(c: BodyCtx, m: MerchLook, hoodie: boolean): void {
  marks(
    c,
    (g, _w, _h) => {
      const logo = (cx: number, cy: number, scale: number) => {
        if (m.design?.length) {
          const rows = m.design;
          const pal: Record<string, string> = { a: m.accent, w: "#fbf7ef", k: "#2b2433" };
          rows.forEach((row, y) => {
            [...row].forEach((ch, x) => {
              if (pal[ch])
                px(
                  g,
                  pal[ch]!,
                  Math.round(cx - (row.length * scale) / 2 + x * scale),
                  Math.round(cy + y * scale),
                  scale,
                  scale,
                );
            });
          });
        } else text(g, m.initials, cx, cy + 4, hoodie ? 12 : 16, m.accent);
      };
      logo(29, hoodie ? 9 : 12, 3);
      if (hoodie) {
        px(g, m.shade, 12, 28, 34, 3);
        px(g, m.shade, 12, 28, 3, 14);
        px(g, m.shade, 43, 28, 3, 14);
        px(g, "#fbf7ef", 21, 0, 2, 11);
        px(g, "#fbf7ef", 35, 0, 2, 11);
      }
    },
    hoodie ? (g, w) => px(g, m.shade, 4, 0, w - 8, 3) : undefined,
  );
  if (hoodie) hood(c, m.main, m.shade);
  else roll(c, m.shade, 0.8, 0.25);
}

export function merchCap(h: Model, m: MerchLook): void {
  dome(h, m.main, 0.275, 0.03, 0.42);
  h.box([0.34, 0.025, 0.2], m.shade, [0, 0.11, 0.24], 0.01).rotation.x = -0.12;
  h.ball(0.025, m.shade, [0, 0.3, 0]);
  sign(
    h,
    0.1,
    0.07,
    (g, w, hh) => {
      // The badge is the print's 8×6: what its people drew, a pixel to a cell, where there is a drawing.
      if (m.design?.length) {
        const pal: Record<string, string> = { a: m.accent, w: "#fbf7ef", k: "#2b2433" };
        const [cw, ch] = [w / m.design[0]!.length, hh / m.design.length];
        g.fillStyle = m.main;
        g.fillRect(0, 0, w, hh);
        m.design.forEach((row, y) => {
          [...row].forEach((c, x) => {
            if (!pal[c]) return;
            g.fillStyle = pal[c]!;
            g.fillRect(Math.round(x * cw), Math.round(y * ch), Math.ceil(cw), Math.ceil(ch));
          });
        });
        return;
      }
      g.fillStyle = m.accent;
      g.fillRect(2, 2, w - 4, hh - 4);
      g.fillStyle = m.shade;
      g.font = `700 ${hh * 0.6}px ui-monospace, Menlo, monospace`;
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.fillText(m.initials.slice(0, 2), w / 2, hh / 2 + 1);
    },
    [0, 0.19, 0.262],
    80,
  );
}

// MARK: Held

export type HeldBuilder = (h: Model, tick: (fn: (t: number) => void) => void) => void;

/** Sits in the hand, a little in front of it. Origin: the hand; +y up; +z away from the body. */
// biome-ignore format: a catalogue reads best one to a line
export const HELD_BUILDERS: Record<string, HeldBuilder> = {
  "Coffee mug": (h, tick) => {
    h.cyl(0.04, 0.085, "#f4efe4", [0, 0.0, 0.06], 0.045, 14);
    h.cyl(0.0415, 0.025, "#e0584f", [0, 0.03, 0.06], 0.0415, 14);
    ring(h, "#f4efe4", 0.026, 0.008, [0.05, 0.04, 0.06], false);
    h.cyl(0.036, 0.004, "#5b3a24", [0, 0.083, 0.06], 0.036, 12);
    const puffs = [0, 1, 2].map(() => h.ball(0.014, see("#ffffff", 0.6, true), [0, 0.1, 0.06]));
    tick((t) =>
      puffs.forEach((p, i) => {
        const k = (t * 0.7 + i / 3) % 1;
        p.position.set(Math.sin(k * 9 + i) * 0.01, 0.1 + k * 0.12, 0.06);
        p.scale.setScalar(1 - k * 0.6);
      }),
    );
  },
  "Rubber duck": (h) => {
    h.ball(0.055, "#f5d14a", [0, 0.04, 0.06], [1, 0.85, 1.15]);
    h.ball(0.04, "#f5d14a", [0, 0.1, 0.08]);
    h.box([0.04, 0.015, 0.035], "#f08a3c", [0, 0.085, 0.12], 0.006);
    for (const s of [-1, 1]) h.ball(0.007, "#2b2433", [s * 0.02, 0.115, 0.108], [1, 1, 0.6], 5);
    h.ball(0.03, "#d9a92a", [0, 0.05, 0.02], [1.2, 1, 0.7]);
  },
  "Laptop with stickers": (h) => {
    h.box([0.2, 0.014, 0.14], "#aab3bf", [0, 0.0, 0.07], 0.005);
    const lid = h.part([0, 0.014, 0.0]);
    lid.rotation.x = -1.7;
    lid.box([0.2, 0.012, 0.14], "#aab3bf", [0, 0, 0.0], 0.005).position.z = -0.0;
    const stick = [
      ["#e0584f", -0.06, 0.04],
      ["#4f8fe0", 0.0, 0.07],
      ["#f5c842", 0.05, 0.035],
      ["#3ddc84", -0.03, 0.1],
    ] as const;
    for (const [col, x, z] of stick) lid.box([0.035, 0.004, 0.035], col, [x, 0.0075, z - 0.07], 0.004);
    h.position.z += 0;
  },
  "Bubble tea": (h) => {
    h.cyl(0.035, 0.11, see("#f6ece0", 0.55), [0, 0.0, 0.06], 0.045, 12);
    h.cyl(0.034, 0.075, "#d9a46a", [0, 0.005, 0.06], 0.041, 12);
    for (let i = 0; i < 6; i++)
      h.ball(
        0.008,
        "#3a2e24",
        [Math.sin(i * 1.3) * 0.02, 0.012 + (i % 2) * 0.008, 0.06 + Math.cos(i * 1.3) * 0.02],
        [1, 1, 1],
        5,
      );
    h.cyl(0.047, 0.012, "#e86bd8", [0, 0.11, 0.06], 0.047, 12);
    const straw = h.cyl(0.011, 0.14, "#e86bd8", [0.01, 0.06, 0.06], 0.011, 6);
    straw.rotation.z = -0.15;
  },
  "Mechanical keyboard": (h) => {
    h.box([0.22, 0.03, 0.09], "#2b2433", [0, 0.0, 0.07], 0.01);
    const cols = ["#f4efe4", "#3ddc84", "#f4efe4", "#4f8fe0", "#f4efe4", "#e0584f"];
    for (let r = 0; r < 3; r++)
      for (let i = 0; i < 6; i++)
        h.box([0.028, 0.012, 0.022], cols[(i + r) % 6]!, [-0.088 + i * 0.035, 0.03, 0.04 + r * 0.027], 0.004);
  },
  "Pizza slice": (h) => {
    const wedge2 = new THREE.Shape();
    wedge2.moveTo(0, 0.1);
    wedge2.lineTo(-0.065, -0.07);
    wedge2.lineTo(0.065, -0.07);
    wedge2.closePath();
    const cheese = shaped(h, "pizza", wedge2, 0.014, "#f5d14a", [0, 0.03, 0.09]);
    cheese.rotation.x = -Math.PI / 2;
    cheese.rotation.z = Math.PI;
    h.box([0.15, 0.022, 0.02], "#c98e3c", [0, 0.0, 0.145], 0.008).position.y = 0.02;
    for (const [x, z] of [
      [0, 0.1],
      [-0.025, 0.065],
      [0.03, 0.07],
    ] as const)
      h.cyl(0.017, 0.008, "#e0584f", [x, 0.04, z], 0.017, 10);
  },
  "Energy drink": (h) => {
    h.cyl(0.032, 0.11, "#3ddc84", [0, 0.0, 0.06], 0.032, 14);
    h.cyl(0.0325, 0.012, "#aab3bf", [0, 0.0, 0.06], 0.0325, 14);
    h.cyl(0.0325, 0.012, "#aab3bf", [0, 0.1, 0.06], 0.0325, 14);
    sign(
      h,
      0.05,
      0.07,
      (g, w, hh) => {
        g.fillStyle = "#f5f542";
        g.beginPath();
        g.moveTo(w * 0.6, 0);
        g.lineTo(w * 0.2, hh * 0.55);
        g.lineTo(w * 0.48, hh * 0.55);
        g.lineTo(w * 0.35, hh);
        g.lineTo(w * 0.85, hh * 0.4);
        g.lineTo(w * 0.55, hh * 0.4);
        g.fill();
      },
      [0, 0.055, 0.0925],
      80,
    );
  },
  "Magnifying glass": (h) => {
    const g = h.part([0, 0.0, 0.05]);
    g.rotation.x = -0.35;
    g.cyl(0.011, 0.1, "#7a4f2c", [0, -0.04, 0.0], 0.011, 6);
    ring(g, "#5a3a1e", 0.055, 0.01, [0, 0.12, 0], false);
    if (isVox(h)) squarePane(g, 0.05, see("#a8d8f0", 0.5), [0, 0.12, 0.002]);
    else {
      const lens = new THREE.Mesh(new THREE.CircleGeometry(0.052, 18), see("#a8d8f0", 0.5));
      lens.position.set(0, 0.12, 0.002);
      g.add(lens);
    }
  },
  "Fire extinguisher": (h) => {
    h.cyl(0.045, 0.16, "#e0473f", [0, -0.02, 0.06], 0.045, 14);
    h.ball(0.045, "#e0473f", [0, 0.14, 0.06], [1, 0.6, 1], 10);
    h.cyl(0.018, 0.04, "#2b2433", [0, 0.16, 0.06], 0.018, 8);
    h.box([0.1, 0.018, 0.02], "#2b2433", [0.03, 0.2, 0.06], 0.006);
    ring(h, "#2b2433", 0.04, 0.007, [0.05, 0.12, 0.06], false).rotation.y = Math.PI / 2;
    h.box([0.07, 0.05, 0.005], "#f4f4f0", [0, 0.06, 0.1075], 0.002);
  },
  Baguette: (h) => {
    const b = h.part([0, 0.0, 0.05]);
    b.rotation.z = -0.5;
    b.rotation.x = -0.2;
    b.cyl(0.03, 0.34, "#e8b464", [0, -0.1, 0.0], 0.03, 10);
    b.ball(0.03, "#e8b464", [0, 0.24, 0], [1, 0.7, 1], 8);
    for (let i = 0; i < 4; i++)
      b.box([0.052, 0.008, 0.012], "#a86e2a", [0, 0.01 + i * 0.065, 0.026], 0.003).rotation.z = 0.5;
  },
};

// MARK: Back

export type BackBuilder = (b: VoxModel, tick: (fn: (t: number, walking: boolean) => void) => void) => void;

/**
 * Origin: the top of the torso's back face (the nape), in a frame one metre = one metre, `y` up, `z` toward the
 * front, so things behind the body have negative z. Blocks are placed in cube units with `Vx`.
 */
// biome-ignore format: a catalogue reads best one to a line
export const BACK_BUILDERS: Record<string, BackBuilder> = {
  Cape: (b, tick) => {
    steppedCape(
      b,
      {
        w: 6.8,
        flare: 0.45,
        steps: 6,
        h: 1.55,
        y: -0.25,
        thick: 0.7,
        colour: (i, col) => (col === 1 ? "#962626" : i % 2 ? "#c23535" : "#d23c3c"),
      },
      tick,
      -0.05,
    );
    const v = new Vx(b);
    for (const s of [-1, 1]) {
      v.b(s > 0 ? 2.4 : -3.4, -0.9, -0.9, 1, 1, 1.5, "#f5c842");
      v.b(s > 0 ? 3.4 : -4.4, -0.3, -0.9, 1, 1.2, 4.9, "#d23c3c");
    }
    v.b(-2.6, -0.2, -1, 5.2, 0.7, 0.9, "#a82a2a");
  },
  Jetpack: (b, tick) => {
    const v = new Vx(b);
    v.b(-2.6, -6, -0.9, 5.2, 5, 0.9, "#7c8592");
    v.b(-2.1, -5.4, -1.2, 4.2, 0.6, 0.3, "#5d6470");
    const flames: THREE.Mesh[][] = [];
    for (const s of [-1, 1]) {
      const x = s > 0 ? 0.35 : -2.55;
      v.b(x, -7.3, -3, 2.2, 6.3, 2.1, "#c4ccd6");
      v.b(x - 0.05, -4.6, -3.05, 2.3, 0.6, 2.2, "#9aa3b0");
      v.b(x, -1.3, -3, 2.2, 1.1, 2.1, "#e0473f");
      v.b(x + 0.35, -8.1, -2.8, 1.5, 0.9, 1.7, "#3a3f4b");
      flames.push([
        v.b(x + 0.3, -9.4, -2.7, 1.6, 1.4, 1.5, glow("#ff8a3c")),
        v.b(x + 0.5, -10.6, -2.5, 1.2, 1.3, 1.1, glow("#ff8a3c")),
        v.b(x + 0.7, -11.6, -2.3, 0.8, 1.1, 0.7, glow("#ff5a2c")),
        v.b(x + 0.7, -9.3, -2.3, 0.8, 1.5, 0.7, glow("#ffe066")),
      ]);
    }
    for (const f of flames.flat()) f.castShadow = false;
    tick((t, walking) =>
      flames.forEach((f, i) => {
        const k = Math.sin(t * 22 + i * 2.1) > 0 ? 1 : 0;
        f[1]!.visible = walking || k === 1;
        f[2]!.visible = walking && k === 1;
        f[3]!.visible = true;
      }),
    );
  },
  Backpack: (b) => {
    const v = new Vx(b);
    v.b(-3, -7.6, -3.2, 6, 7.2, 3.2, "#4f8fe0");
    v.b(-3.2, -2.5, -3.4, 6.4, 1.3, 3.6, "#3a74c4");
    v.b(-2.1, -6.8, -4.1, 4.2, 3.4, 0.9, "#2f5aa0");
    v.b(-0.4, -3.1, -3.6, 0.8, 1, 0.3, "#f5c842");
    v.b(-1.6, -6.1, -4.3, 3.2, 0.5, 0.3, "#f5c842");
    for (const s of [-1, 1]) {
      const x = s > 0 ? 1.7 : -2.7;
      v.b(x, -7, 4, 1, 7.2, 0.5, "#2f5aa0");
      v.b(x, -0.6, 3.9, 1, 0.6, 0.6, "#2f5aa0");
    }
  },
  "Pixel wings": (b, tick) => {
    const sides: { root: VoxModel; segs: VoxModel[]; s: number }[] = [];
    const sizes: [number, number][] = [
      [2.2, 3.4],
      [2.2, 4.2],
      [2.2, 5],
      [2, 4.4],
      [1.6, 3.4],
    ];
    for (const s of [-1, 1]) {
      const root = vpart(b, [s * 1.2 * U, -1.8 * U, -0.5 * U]);
      let at: VoxModel = root;
      const segs: VoxModel[] = [];
      sizes.forEach(([w, h], i) => {
        const x0 = s > 0 ? 0 : -w;
        at.box([w * U, h * U, 0.7 * U], i % 2 ? "#ffffff" : "#f4f8fd", [(x0 + w / 2) * U, 0, 0]);
        at.box([w * U - 0.008, 0.55 * U, 0.8 * U], "#cfe0f4", [(x0 + w / 2) * U, 0, 0]);
        at.box([w * 0.55 * U, 1.2 * U, 0.7 * U], "#eaf2fb", [(x0 + w / 2) * U, -1.2 * U, 0]);
        segs.push(at);
        at = vpart(at, [s * w * U, 1.2 * U, 0]);
      });
      sides.push({ root, segs, s });
    }
    tick((t, walking) => {
      const flap = Math.sin(t * (walking ? 12 : 2.5)) * (walking ? 0.5 : 0.1);
      for (const { root, segs, s } of sides) {
        root.rotation.y = s * (0.5 + flap);
        root.rotation.z = s * (0.12 + flap * 0.3);
        segs.forEach((seg, i) => {
          seg.rotation.y = s * Math.sin(t * (walking ? 12 : 2.5) - i * 0.7) * (walking ? 0.14 : 0.04);
        });
      }
    });
  },
  Guitar: (b) => {
    const g = vpart(b, [0, -4.2 * U, -1.5 * U]);
    g.rotation.z = 0.7;
    const v = new Vx(g, U * 0.8);
    v.b(-3.2, -3, -1.2, 6.4, 3, 1.5, "#d9832e");
    v.b(-2.2, 0, -1.2, 4.4, 1.5, 1.5, "#d9832e");
    v.b(-2.8, 1.5, -1.2, 5.6, 2.6, 1.5, "#d9832e");
    v.b(-3.4, -2.6, -1.1, 0.4, 5.6, 1.3, "#a85e1c");
    v.b(3, -2.6, -1.1, 0.4, 5.6, 1.3, "#a85e1c");
    v.b(-1, -1.8, -1.45, 2, 2, 0.3, "#3a2e2a");
    v.b(-1.5, -2.8, -1.45, 3, 0.5, 0.3, "#a85e1c");
    v.b(-0.6, 4.1, -0.9, 1.2, 8, 1, "#6b4226");
    for (let i = 0; i < 5; i++) v.b(-0.65, 5 + i * 1.5, -1.0, 1.3, 0.25, 0.3, "#d8d0c0");
    v.b(-1.1, 12.1, -1.0, 2.2, 2.8, 1.2, "#6b4226");
    for (const s of [-1, 1])
      for (let i = 0; i < 2; i++) v.b(s > 0 ? 1.1 : -1.6, 12.4 + i * 1.2, -0.7, 0.5, 0.6, 0.6, "#d8d0c0");
    // The strap over the chest, a staircase of blocks.
    const f = new Vx(b);
    for (let i = 0; i < 6; i++) f.b(-3.4 + i * 1.15, -0.8 - i * 1.0, 4.0, 1.4, 1.3, 0.4, "#3a2e2a");
  },
  "Yoga mat": (b) => {
    const v = new Vx(b);
    v.b(-4, -4.8, -3.6, 8, 3.2, 3.2, "#9b6fd6");
    v.b(-4, -4.8, -3.6, 8, 0.7, 3.2, "#b48ce6");
    for (const s of [-1, 1]) {
      const x = s > 0 ? 3.8 : -4.2;
      v.b(x, -4.8, -3.6, 0.4, 3.2, 3.2, "#7852ad");
      v.b(x - (s > 0 ? -0.05 : 0.05), -3.9, -2.7, 0.4, 1.3, 1.3, "#d8c2f4");
    }
    for (const x of [-2.5, 1.7]) v.b(x, -4.9, -3.7, 0.8, 3.4, 3.4, "#5a3f8a");
    v.b(-3.3, -1.2, -0.9, 0.9, 0.6, 1, "#5a3f8a");
    v.b(2.4, -1.2, -0.9, 0.9, 0.6, 1, "#5a3f8a");
  },
  Katana: (b) => {
    const k = vpart(b, [0, -4.4 * U, -1.2 * U]);
    k.rotation.z = 0.85;
    const v = new Vx(k, U * 0.7);
    v.b(-0.6, -7, -0.6, 1.2, 12.4, 1.2, "#2a2a35");
    v.b(-0.7, -7, -0.7, 1.4, 0.7, 1.4, "#3a3a48");
    v.b(-0.7, 5.2, -0.7, 1.4, 0.6, 1.4, "#f5c842");
    v.b(-1.3, 5.8, -1.3, 2.6, 0.5, 2.6, "#f5c842");
    v.b(-0.6, 6.3, -0.6, 1.2, 4, 1.2, "#c23a3a");
    for (const y of [6.9, 7.9, 8.9]) v.b(-0.7, y, -0.7, 1.4, 0.4, 1.4, "#f4efe4");
    v.b(-0.7, 10.2, -0.7, 1.4, 0.6, 1.4, "#f5c842");
  },
};

// Helpers the entry point needs.
export { glow, tint };
