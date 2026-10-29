/**
 * The Nusantara case in 3D (`core/src/case-nusantara.ts`): its six outfits, four things held and three things worn on
 * the back, in the same cubes as the rest of the wardrobe (`gear3dBody.ts`, `gear3dCase.ts`). Loaded by `gear3d.ts`,
 * it adds its builders to the shop's tables: outfits under their look index (`NUSANTARA_BASE + n`, 400 and up),
 * held and back items under their names. Outfit colours are in `data/gear.ts`, the 2D art in `art/case-body.ts`.
 * The mood is daylight: teak, batik indigo and cream, saffron, hibiscus red and leaf green, nothing that glows.
 */
import { NUSANTARA_BASE } from "@tokenmaxxing/core/case-nusantara.ts";
import {
  BACK_BUILDERS,
  type BackBuilder,
  type BodyCtx,
  grid,
  HELD_BUILDERS,
  type HeldBuilder,
  marks,
  OUTFIT_BUILDERS,
  px,
  roll,
  sleeveStripes,
} from "./gear3dBody.ts";
import { see, sign } from "./gear3dHead.ts";
import { pixelPatch, U, type VoxModel, Vx, vpart } from "./voxgear.ts";

// The palette of the brief (docs/cases/nusantara.md).
const TEAK = "#8a5a2b";
const TEAK_DARK = "#5a3a1c";
const TURQUOISE = "#1fb5b0";
const DEEP_SEA = "#0f6e86";
const SAFFRON = "#f2b632";
const HIBISCUS = "#d6343a";
const CREAM = "#f1e3c2";
const INDIGO = "#243a73";
const RICE = "#6fbf4a";
const LEAF = "#2f7f3a";
const BAMBOO = "#d2b55a";
const BAMBOO_DARK = "#a8873a";
const RATTAN = "#c9a265";

/** A filled diamond (a rotated square) centred on (x, y), `r` across half-way. */
function diamond(g: CanvasRenderingContext2D, x: number, y: number, r: number, color: string): void {
  g.fillStyle = color;
  g.beginPath();
  g.moveTo(x, y - r);
  g.lineTo(x + r, y);
  g.lineTo(x, y + r);
  g.lineTo(x - r, y);
  g.closePath();
  g.fill();
}

/** Long sleeves down to the wrist over both arms, with a cuff band at the end. */
const longSleeves = (c: BodyCtx, color: string, cuff?: string, len = 6.6) =>
  c.arms.forEach((arm) => {
    const v = new Vx(vpart(arm));
    v.b(-1.15, -len, -1.15, 2.3, len, 2.3, color);
    if (cuff) v.b(-1.2, -len, -1.2, 2.4, 0.8, 2.4, cuff);
  });

/** Loose, wide sleeves: a flared tube from the shoulder to just above the hand. */
const looseSleeves = (c: BodyCtx, color: string, trim: string) =>
  c.arms.forEach((arm) => {
    const v = new Vx(vpart(arm));
    v.b(-1.5, -6.4, -1.5, 3, 3.4, 3, color);
    v.b(-1.65, -6.5, -1.65, 3.3, 0.7, 3.3, trim);
  });

// MARK: Outfits

// biome-ignore format: a catalogue reads best one to a line
const OUTFITS: Record<number, (c: BodyCtx) => void> = {
  // Batik shirt: soga brown with a lattice of cream diamonds, a slim placket with buttons, a stand collar.
  0: (c) => {
    const lattice = (g: CanvasRenderingContext2D, w: number, h: number) => {
      for (let j = 0, y = 4; y < h + 8; j++, y += 9)
        for (let x = j % 2 ? 5 : 0; x < w + 10; x += 10) {
          diamond(g, x, y, 5.2, CREAM);
          diamond(g, x, y, 3.0, INDIGO);
          diamond(g, x, y, 1.2, CREAM);
        }
    };
    marks(
      c,
      (g, w, h) => {
        lattice(g, w, h);
        px(g, "#4d2f1a", 26, 0, 5, h);
        for (const y of [6, 17, 28]) px(g, CREAM, 27, y, 3, 3);
      },
      lattice,
    );
    roll(c, "#4d2f1a", 0.9, 0.3);
    const v = grid(c);
    v.b(-0.6, 6, 2.3, 1.2, 1.7, 0.3, "#4d2f1a");
    for (const arm of c.arms) new Vx(vpart(arm)).b(-1.22, -3.1, -1.22, 2.44, 0.7, 2.44, "#4d2f1a");
  },
  // Deckhand stripes: a navy and cream striped tee, the cuffs rolled, a rope belt with a knot and two ends.
  1: (c) => {
    marks(
      c,
      (g, w) => {
        for (let y = 2; y < 42; y += 8) px(g, CREAM, 0, y, w, 4);
      },
      (g, w) => {
        for (let y = 2; y < 42; y += 8) px(g, CREAM, 0, y, w, 4);
      },
    );
    roll(c, CREAM, 0.8, 0.3);
    c.arms.forEach((arm) => {
      const v = new Vx(vpart(arm));
      v.b(-1.25, -3.1, -1.25, 2.5, 0.9, 2.5, CREAM);
      v.b(-1.25, -3.9, -1.25, 2.5, 0.8, 2.5, INDIGO);
    });
    const v = grid(c);
    // The belt: a coil of rope round the waist, a knot at the front and two ends hanging.
    v.b(-3.85, 0.1, -2.35, 7.7, 0.9, 4.7, "#9a6b34");
    v.b(-3.9, 0.55, -2.4, 7.8, 0.3, 4.8, "#7a5224");
    v.b(-0.9, -0.1, 2.3, 1.8, 1.5, 0.7, "#9a6b34");
    v.b(-0.4, -2.2, 2.45, 0.7, 2.2, 0.5, "#9a6b34");
    v.b(0.5, -1.7, 2.45, 0.7, 1.7, 0.5, "#7a5224");
  },
  // Kebaya: teal lace over long sleeves, a V of cream at the throat, a gold brooch, a cream lace hem.
  2: (c) => {
    marks(
      c,
      (g, w, h) => {
        for (let j = 0, y = 3; y < h - 4; j++, y += 6)
          for (let x = j % 2 ? 6 : 3; x < w - 2; x += 6) px(g, "#bfe9e4", x, y, 2, 2);
        // The V neckline and the cream hem.
        for (let i = 0; i < 8; i++) px(g, CREAM, 23 + i * 0.5 - 0, i, 11 - i, 1);
        px(g, CREAM, 0, h - 4, w, 4);
        for (let x = 0; x < w; x += 4) px(g, "#ffffff", x, h - 4, 2, 2);
      },
      (g, w, h) => {
        for (let j = 0, y = 3; y < h - 4; j++, y += 6)
          for (let x = j % 2 ? 6 : 3; x < w - 2; x += 6) px(g, "#bfe9e4", x, y, 2, 2);
        px(g, CREAM, 0, h - 4, w, 4);
      },
    );
    roll(c, CREAM, 0.8, 0.3);
    longSleeves(c, "#1f8a8a", CREAM);
    const v = grid(c);
    // The brooch: gold with a bright eye, pinned where the V closes.
    v.b(-0.7, 4.7, 2.3, 1.4, 1.4, 0.55, SAFFRON);
    v.b(-0.25, 5.15, 2.8, 0.5, 0.5, 0.2, "#fff2b0");
  },
  // Silat pangsi: loose black, a red sash with the knot at the hip, a calm grey frog-button closure.
  3: (c) => {
    marks(
      c,
      (g, _w, h) => {
        px(g, "#3a3a46", 27, 0, 2, h);
        for (const y of [3, 9, 15]) px(g, "#8a8a99", 24, y, 8, 2);
      },
      (g, w) => px(g, "#2a2a33", 0, 20, w, 2),
    );
    roll(c, "#2a2a33", 0.9, 0.3);
    looseSleeves(c, "#1c1c22", "#2d2d38");
    const v = grid(c);
    // The sash, wrapped twice, and its knot and two tails at the right hip.
    v.b(-3.9, 0.1, -2.4, 7.8, 1.7, 4.8, HIBISCUS);
    v.b(-3.95, 1.2, -2.45, 7.9, 0.4, 4.9, "#a6242a");
    v.b(3.0, -0.2, 1.0, 1.4, 1.8, 1.4, "#e24a50");
    v.b(3.3, -3.2, 1.4, 0.8, 3.2, 0.5, HIBISCUS);
    v.b(4.0, -2.4, 1.2, 0.8, 2.4, 0.5, "#a6242a");
  },
  // Songket gala: crimson silk with a lattice of gold thread, a gold hem, a gold collar and a sash over one shoulder.
  4: (c) => {
    const lattice = (g: CanvasRenderingContext2D, w: number, h: number) => {
      g.strokeStyle = SAFFRON;
      g.lineWidth = 1.6;
      for (let k = -h; k < w + h; k += 9) {
        g.beginPath();
        g.moveTo(k, 0);
        g.lineTo(k + h, h);
        g.stroke();
        g.beginPath();
        g.moveTo(k + h, 0);
        g.lineTo(k, h);
        g.stroke();
      }
      for (let y = 4; y < h; y += 9) for (let x = 4; x < w; x += 9) px(g, "#fff0b0", x, y, 2, 2);
    };
    marks(
      c,
      (g, w, h) => {
        lattice(g, w, h);
        px(g, SAFFRON, 0, h - 5, w, 5);
        px(g, "#fff0b0", 0, h - 5, w, 1);
      },
      (g, w, h) => {
        lattice(g, w, h);
        px(g, SAFFRON, 0, h - 5, w, 5);
      },
    );
    roll(c, SAFFRON, 1.0, 0.35);
    sleeveStripes(c, SAFFRON);
    const v = grid(c);
    // The selendang: a gold-edged crimson cloth from the left shoulder across the chest to the right hip.
    for (let i = 0; i < 6; i++) {
      v.b(-3.9 + i * 1.3, 6.4 - i * 1.15, 2.1, 1.6, 1.5, 0.45, i % 3 === 1 ? "#fff0b0" : SAFFRON);
    }
    v.b(-3.9, 7.2, -2.3, 1.5, 0.8, 4.6, SAFFRON);
    v.b(2.4, -1.0, 1.7, 1.1, 2.4, 0.5, SAFFRON);
  },
  // Ondel-ondel: the parade figure, friendly. A big round red face with white eyes and a grin on the chest, a
  // coconut-leaf ruff, a striped tunic and a leaf skirt that sways.
  5: (c) => {
    marks(
      c,
      (g, w, h) => {
        const cols = [SAFFRON, "#2c8cc8", HIBISCUS, LEAF];
        for (let x = 0; x < w; x += 4) px(g, cols[(x / 4) % 4]!, x, 0, 4, h);
      },
      (g, w, h) => {
        const cols = [SAFFRON, "#2c8cc8", HIBISCUS, LEAF];
        for (let x = 0; x < w; x += 4) px(g, cols[(x / 4) % 4]!, x, 0, 4, h);
        px(g, "#e8d96a", 0, h - 6, w, 6);
      },
    );
    const v = grid(c);
    // The face: a round disc of red cubes, 7 across, a little proud of the chest.
    const FACE = HIBISCUS;
    const rows: [number, number, number][] = [
      // [y, x from, width]
      [8.2, -2, 4],
      [7.2, -3, 6],
      [6.2, -3.5, 7],
      [5.2, -3.5, 7],
      [4.2, -3.5, 7],
      [3.2, -3.5, 7],
      [2.2, -3, 6],
      [1.2, -2, 4],
    ];
    for (const [y, x, w] of rows) v.b(x, y - 0.9, 2.0, w, 1.0, 0.75, FACE);
    // Cheeks, nose, brows, big white eyes with a pupil each, a moustache and a wide white grin.
    for (const s of [-1, 1]) {
      v.b(s > 0 ? 2.1 : -3.1, 3.1, 2.75, 1.0, 0.9, 0.3, "#f2848a");
      v.b(s > 0 ? 0.6 : -2.9, 6.7, 2.75, 2.3, 0.45, 0.3, "#3a1a14");
      v.b(s > 0 ? 0.55 : -2.65, 4.9, 2.75, 2.1, 1.9, 0.35, "#ffffff");
      v.b(s > 0 ? 1.1 : -1.65, 4.9, 3.05, 1.0, 1.0, 0.25, "#16120f");
    }
    v.b(-0.55, 3.9, 2.8, 1.1, 1.0, 0.45, "#e2575d");
    // A wide smile: the corners lifted, white teeth between two dark lips.
    v.b(-1.5, 1.6, 2.8, 3.0, 0.9, 0.3, "#ffffff");
    v.b(-1.5, 1.2, 2.8, 3.0, 0.4, 0.3, "#3a1a14");
    for (const s of [-1, 1]) {
      v.b(s > 0 ? 1.5 : -2.5, 2.1, 2.8, 1.0, 0.9, 0.3, "#ffffff");
      v.b(s > 0 ? 1.5 : -2.5, 1.7, 2.8, 1.0, 0.4, 0.3, "#3a1a14");
      v.b(s > 0 ? 2.5 : -2.9, 2.6, 2.8, 0.4, 0.6, 0.3, "#3a1a14");
    }
    v.b(-1.5, 2.5, 2.8, 3.0, 0.4, 0.3, "#3a1a14");
    // The ruff of coconut leaf round the neck, in two rows of points.
    roll(c, "#b8c84a", 1.6, 1.0, 6.5);
    roll(c, "#8fb02f", 0.8, 1.35, 6.2);
    for (let i = 0; i < 7; i++) v.b(-3.9 + i * 1.2, 6.0, 2.8, 0.9, 0.9, 0.45, i % 2 ? "#d8e56a" : "#8fb02f");
    // The skirt of leaves: a fringe round the hips, swaying as they walk.
    const skirt = vpart(c.body, [0, 0.6 * U, 0]);
    const sv = new Vx(skirt);
    const strips = (x: number, z: number, w: number, d: number, i: number) =>
      sv.b(x, -3.2, z, w, 3.6, d, i % 2 ? "#b8c84a" : "#8fb02f");
    for (let i = 0; i < 4; i++) {
      strips(-4.6 + i * 2.3, 2.4, 2.3, 0.7, i);
      strips(-4.6 + i * 2.3, -3.1, 2.3, 0.7, i + 1);
    }
    for (let i = 0; i < 3; i++) {
      strips(-4.5, -2.4 + i * 1.6, 0.7, 1.6, i);
      strips(3.8, -2.4 + i * 1.6, 0.7, 1.6, i + 1);
    }
    sv.b(-3.95, 0.1, -2.45, 7.9, 0.9, 4.9, "#d8e56a");
    c.tick((t, walking) => {
      skirt.rotation.z = Math.sin(t * (walking ? 9 : 1.6)) * (walking ? 0.09 : 0.02);
      skirt.rotation.x = Math.sin(t * (walking ? 7 : 1.2) + 1) * (walking ? 0.06 : 0.015);
    });
    sleeveStripes(c, SAFFRON);
    for (const arm of c.arms) new Vx(vpart(arm)).b(-1.25, -3.2, -1.25, 2.5, 0.9, 2.5, "#b8c84a");
  },
};
for (const [n, build] of Object.entries(OUTFITS)) OUTFIT_BUILDERS[NUSANTARA_BASE + Number(n)] = build;

// MARK: Held

// biome-ignore format: a catalogue reads best one to a line
const HELD: Record<string, HeldBuilder> = {
  // Es teh: sweet iced tea in a knotted plastic bag, a red and white straw standing in it, ice cubes inside. Hung from the knot.
  "Es teh": (h, tick) => {
    const bag = h.part([0, 0.01, 0.07]);
    bag.box([0.026, 0.026, 0.026], "#e4a042", [0, -0.012, 0], 0.006);
    bag.box([0.014, 0.03, 0.014], "#e4a042", [0, 0.012, 0], 0.003);
    bag.box([0.046, 0.025, 0.04], see("#f2c98a", 0.7), [0, -0.05, 0], 0.01);
    bag.box([0.085, 0.13, 0.07], see("#f4cf94", 0.5), [0, -0.19, 0], 0.02);
    bag.box([0.074, 0.1, 0.06], see("#c4681a", 0.85), [0, -0.185, 0], 0.012);
    for (const [x, y, z] of [
      [-0.015, -0.17, 0.012],
      [0.02, -0.15, -0.01],
      [-0.005, -0.12, -0.012],
    ] as const)
      bag.box([0.026, 0.026, 0.026], see("#ffffff", 0.9), [x, y, z], 0.005);
    // The straw: stripes of red and white, standing out of the top beside the knot.
    for (let i = 0; i < 7; i++)
      bag.box([0.01, 0.034, 0.01], i % 2 ? HIBISCUS : "#ffffff", [0.022, -0.16 + i * 0.034, 0.006], 0.002);
    // Don't swing it: it only sways a little, and sloshes.
    tick((t) => {
      bag.rotation.z = Math.sin(t * 1.8) * 0.06;
      bag.rotation.x = Math.sin(t * 1.3 + 1) * 0.04;
    });
  },
  // Angklung: a bamboo frame on a bar with three tuned tubes of falling length, shaken in short bursts.
  Angklung: (h, tick) => {
    const a = h.part([0, -0.02, 0.075]);
    const frame = a.part([0, 0, 0]);
    frame.box([0.17, 0.02, 0.022], BAMBOO_DARK, [0, -0.01, 0], 0.004);
    for (const x of [-0.07, 0.07]) frame.box([0.02, 0.34, 0.022], BAMBOO, [x, -0.01, 0], 0.004);
    frame.box([0.16, 0.016, 0.02], BAMBOO_DARK, [0, 0.16, 0], 0.004);
    frame.box([0.16, 0.016, 0.02], BAMBOO_DARK, [0, 0.04, 0], 0.004);
    // Three tubes standing in the frame, longest on the left and each one shorter, with nodes and a dark mouth.
    const tubes = [0.32, 0.24, 0.17].map((len, i) => {
      const x = -0.045 + i * 0.045;
      const t = frame.part([x, 0.004, 0]);
      t.cyl(0.019, len, BAMBOO, [0, 0, 0], 0.019, 8);
      t.cyl(0.0205, 0.01, BAMBOO_DARK, [0, len * 0.33, 0], 0.0205, 8);
      t.cyl(0.0205, 0.01, BAMBOO_DARK, [0, len * 0.68, 0], 0.0205, 8);
      t.cyl(0.0145, 0.008, TEAK_DARK, [0, len - 0.004, 0], 0.0145, 8);
      return t;
    });
    // A burst of shaking, then still: two beats of wiggle, as in the 2D frames.
    tick((t) => {
      const k = (t * 0.5) % 1;
      const shake = k < 0.4 ? Math.sin(t * 34) : 0;
      frame.rotation.z = shake * 0.16;
      a.rotation.z = shake * 0.05;
      tubes.forEach((tb, i) => {
        tb.rotation.z = shake * 0.1 * (i % 2 ? -1 : 1);
      });
    });
  },
  // Layang-layang: a red and yellow diamond kite flying a little above the hand, string to the wrist, stepped tail.
  "Layang-layang": (h, tick) => {
    // A loop of string on the wrist and the line up to the kite.
    h.box([0.05, 0.012, 0.05], "#f4efe4", [0, 0.0, 0.02], 0.003);
    const line = h.part([0, 0.01, 0.045]);
    line.box([0.005, 0.33, 0.005], "#f4efe4", [0, 0, 0], 0.001);
    const kite = h.part([0, 0.34, 0.06]);
    kite.rotation.y = 0.6;
    const spar = kite.part([0, 0.15, 0]);
    spar.box([0.014, 0.34, 0.01], BAMBOO_DARK, [0, -0.15, -0.012], 0.002);
    spar.box([0.25, 0.014, 0.01], BAMBOO_DARK, [0, -0.02, -0.012], 0.002);
    // The diamond: four triangles, red and yellow in turn, drawn once and set as raised cubes (or a plane).
    const body = kite.part([0, 0, 0]);
    const sheet = (g: CanvasRenderingContext2D, w: number, hh: number) => {
      const cx = w / 2;
      const cy = hh * 0.42;
      const quad = (pts: [number, number][], col: string) => {
        g.fillStyle = col;
        g.beginPath();
        for (const [i, [x, y]] of pts.entries()) i ? g.lineTo(x, y) : g.moveTo(x, y);
        g.closePath();
        g.fill();
      };
      quad(
        [
          [cx, 0],
          [0, cy],
          [cx, cy],
        ],
        HIBISCUS,
      );
      quad(
        [
          [cx, 0],
          [w, cy],
          [cx, cy],
        ],
        SAFFRON,
      );
      quad(
        [
          [0, cy],
          [cx, hh],
          [cx, cy],
        ],
        SAFFRON,
      );
      quad(
        [
          [w, cy],
          [cx, hh],
          [cx, cy],
        ],
        HIBISCUS,
      );
      g.strokeStyle = BAMBOO_DARK;
      g.lineWidth = Math.max(1, w * 0.04);
      g.beginPath();
      g.moveTo(cx, 0);
      g.lineTo(cx, hh);
      g.moveTo(0, cy);
      g.lineTo(w, cy);
      g.stroke();
    };
    sign(body, 0.24, 0.34, sheet, [0, 0, 0], 120);
    // The tail: bows of red and yellow paper down a long string, swaying with the wind.
    const tail = kite.part([0, -0.2, -0.005]);
    const bows = [0, 1, 2, 3, 4, 5].map((i) => {
      const b = tail.part([0, -0.04 - i * 0.045, 0]);
      b.box([0.03, 0.016, 0.014], i % 2 ? SAFFRON : HIBISCUS, [-0.014, 0, 0], 0.002);
      b.box([0.03, 0.016, 0.014], i % 2 ? HIBISCUS : SAFFRON, [0.014, 0, 0], 0.002);
      if (i === 0) tail.box([0.004, 0.28, 0.004], "#f4efe4", [0, -0.28, 0], 0.001);
      return b;
    });
    tick((t) => {
      kite.rotation.z = Math.sin(t * 1.3) * 0.1;
      kite.rotation.x = -0.12 + Math.sin(t * 0.9 + 1) * 0.04;
      kite.rotation.y = 0.6 + Math.sin(t * 0.7) * 0.12;
      bows.forEach((b, i) => {
        b.position.x = Math.sin(t * 2.6 - i * 0.7) * 0.012 * (i + 1) * 0.7;
        b.rotation.z = Math.sin(t * 3 - i * 0.7) * 0.25;
      });
    });
  },
  // Takraw ball: a woven rattan ball, tan with darker strands in a hex weave; it bounces a hair.
  "Takraw ball": (h, tick) => {
    const ball = h.part([0, 0.07, 0.075]);
    // A round ball of woven rattan: three crossed slabs make the chamfered round of a voxel ball, and three thin darker
    // strands wrap it, one each way, for the hex weave.
    const TAN = "#dcb56a";
    ball.box([0.11, 0.13, 0.13], TAN, [0, -0.065, 0], 0.01);
    ball.box([0.13, 0.11, 0.13], "#d3ac60", [0, -0.055, 0], 0.01);
    ball.box([0.13, 0.13, 0.11], "#e0ba72", [0, -0.065, 0], 0.01);
    const STRAND = "#8f6a30";
    ball.box([0.136, 0.012, 0.136], STRAND, [0, -0.006, 0], 0.002);
    ball.box([0.012, 0.136, 0.136], STRAND, [-0.006, -0.068, 0], 0.002);
    ball.box([0.136, 0.136, 0.012], STRAND, [0, -0.068, -0.006], 0.002);
    for (const [x, y] of [
      [-0.034, -0.034],
      [0.034, -0.1],
      [0.034, -0.034],
      [-0.034, -0.1],
    ] as const)
      ball.box([0.024, 0.024, 0.01], "#a8803f", [x, y, 0.062], 0.002);
    tick((t) => {
      ball.position.y = 0.075 + Math.abs(Math.sin(t * 5)) * 0.022;
      ball.rotation.y = t * 0.8;
    });
  },
};
Object.assign(HELD_BUILDERS, HELD);

// MARK: Back

/** A raised pixel picture on a flat plane at `at` in a body frame (the puppets, the fan). */
function picture(
  b: VoxModel,
  w: number,
  hh: number,
  draw: (g: CanvasRenderingContext2D, cw: number, ch: number) => void,
  at: [number, number, number],
  cell = 0.015,
  depth = 0.014,
  scale = 4,
) {
  return pixelPatch(b, {
    cols: Math.round(w / cell),
    rows: Math.round(hh / cell),
    cell,
    depth,
    draw,
    at,
    scale,
    fill: 0.3,
  });
}

// biome-ignore format: a catalogue reads best one to a line
const BACKS: Record<string, BackBuilder> = {
  // Fruit bakul: a rattan basket cone on the back with rambutan, mangosteen and salak piled on top, on a batik sling.
  "Fruit bakul": (b, tick) => {
    const root = vpart(b, [0, 0, 0]);
    const v = new Vx(root);
    // The basket, woven in rows: narrow at the foot, wide at the mouth, a dark rim.
    for (let i = 0; i < 7; i++) {
      const w = 3.6 + i * 0.55;
      v.b(-w / 2, -9.2 + i, -2.5 - w, w, 1, w, i % 2 ? RATTAN : "#b58a4a");
    }
    v.b(-3.2, -2.2, -2.7 - 6.4, 6.4, 0.7, 6.4, TEAK);
    // Vertical canes up the front face of the weave.
    for (const x of [-1.6, 0, 1.6]) v.b(x - 0.2, -9, -2.55, 0.4, 7, 0.2, "#a8803f");
    // The fruit, piled in the mouth: red hairy rambutan, purple mangosteen with a green cap, brown scaly salak.
    const fruit = (x: number, y: number, z: number, body: string, tip: string, s = 1.6) => {
      v.b(x, y, z, s, s, s, body);
      v.b(x + s * 0.3, y + s, z + s * 0.3, s * 0.4, s * 0.35, s * 0.4, tip);
    };
    fruit(-2.4, -1.6, -5.6, HIBISCUS, "#f08a7a");
    fruit(-0.2, -1.4, -5.2, HIBISCUS, "#f08a7a");
    fruit(1.6, -1.5, -6.0, HIBISCUS, "#f08a7a", 1.5);
    fruit(-1.4, -1.5, -7.6, "#5a2a6a", RICE);
    fruit(0.8, -1.4, -7.8, "#5a2a6a", RICE);
    fruit(-2.2, -1.5, -8.2, "#7a4a2a", "#4a2a14", 1.5);
    fruit(1.9, -1.4, -4.4, "#7a4a2a", "#4a2a14", 1.5);
    v.b(-0.4, -0.2, -6.4, 1.5, 1.5, 1.5, "#5a2a6a");
    v.b(-0.1, 1.2, -6.1, 0.8, 0.4, 0.8, RICE);
    v.b(0.6, -0.3, -5.0, 1.4, 1.4, 1.4, HIBISCUS);
    v.b(-2.0, -0.2, -7.0, 1.4, 1.4, 1.4, "#7a4a2a");
    // A leaf or two.
    v.b(1.8, -0.3, -7.4, 1.8, 0.4, 1.0, LEAF);
    // The sling: a batik cloth looped from the basket over each shoulder and down the chest.
    for (const s of [-1, 1]) {
      const x = s > 0 ? 2.1 : -3.1;
      v.b(x, -6.2, -2.7, 1, 6.6, 0.5, INDIGO);
      v.b(x, 0.0, -2.7, 1, 0.9, 5.4, INDIGO);
      v.b(x, -3.4, 2.2, 1, 4.3, 0.55, INDIGO);
      v.b(x + 0.2, -0.2, 1.9, 0.6, 0.6, 0.3, CREAM);
      v.b(x + 0.2, -4.0, 2.3, 0.6, 0.6, 0.3, CREAM);
    }
    // It rocks a little with the walk.
    tick((t, walking) => {
      root.position.y = walking ? Math.abs(Math.sin(t * 11)) * 0.01 : 0;
      root.rotation.z = Math.sin(t * (walking ? 6 : 1.4)) * (walking ? 0.03 : 0.008);
    });
  },
  // Wayang bundle: a bamboo case on the back with leather puppets standing up out of it: a gunungan and a long-nosed clown.
  "Wayang bundle": (b, tick) => {
    const root = vpart(b, [0, 0, 0]);
    const v = new Vx(root);
    // The case: bamboo canes bound together, with two cords round it.
    for (let i = 0; i < 5; i++) v.b(-3 + i * 1.2, -8.4, -4.9, 1.1, 8.6, 2.5, i % 2 ? BAMBOO : "#c4a24e");
    for (const y of [-2.2, -6.4]) v.b(-3.2, y, -5.0, 6.4, 0.6, 2.7, TEAK_DARK);
    for (const y of [-1.0, -3.6, -5.2, -7.0]) v.b(-3.1, y, -5.0, 6.2, 0.18, 2.62, BAMBOO_DARK);
    // Bamboo sticks poking up beyond the puppets.
    for (const [x, hh] of [
      [-2.4, 3.2],
      [2.6, 3.8],
      [0.3, 4.8],
    ] as const)
      v.b(x, -1.0, -4.0, 0.35, hh + 1, 0.35, BAMBOO);
    // The gunungan: a leaf-shaped leather, the tree of life cut into it, gold dots round the edge.
    const gun = (g: CanvasRenderingContext2D, w: number, hh: number) => {
      const leaf = (inset: number, col: string) => {
        g.fillStyle = col;
        g.beginPath();
        g.moveTo(w / 2, inset);
        g.bezierCurveTo(w * 1.02, hh * 0.38, w * 0.98, hh * 0.9, w / 2, hh - inset);
        g.bezierCurveTo(w * 0.02, hh * 0.9, -w * 0.02, hh * 0.38, w / 2, inset);
        g.fill();
      };
      leaf(0, "#c9972a");
      leaf(hh * 0.045, "#3a2414");
      // The tree: a trunk, three branches and a crown, in gold.
      g.fillStyle = "#e8b23a";
      g.fillRect(w / 2 - w * 0.03, hh * 0.3, w * 0.06, hh * 0.55);
      for (const [y, r] of [
        [0.4, 0.28],
        [0.54, 0.34],
        [0.68, 0.22],
      ] as const) {
        g.fillRect(w / 2 - w * r, hh * y, w * r * 2, w * 0.05);
        g.fillRect(w / 2 - w * r, hh * y - w * 0.06, w * 0.06, w * 0.08);
        g.fillRect(w / 2 + w * r - w * 0.06, hh * y - w * 0.06, w * 0.06, w * 0.08);
      }
      g.beginPath();
      g.arc(w / 2, hh * 0.28, w * 0.09, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = "#e8b23a";
      for (const y of [0.2, 0.3, 0.45, 0.6, 0.75, 0.86]) {
        g.fillRect(w * 0.16, hh * y, w * 0.07, w * 0.07);
        g.fillRect(w * 0.77, hh * y, w * 0.07, w * 0.07);
      }
    };
    picture(root, 0.26, 0.48, gun, [-0.085, 0.1, -4.2 * U], 0.012, 0.016);
    // The clown (a generic long-nosed one): a big round head, a long nose, a round belly and arms on thin sticks.
    const clown = (g: CanvasRenderingContext2D, w: number, hh: number) => {
      g.fillStyle = "#3a2414";
      g.beginPath();
      g.arc(w * 0.42, hh * 0.2, w * 0.3, 0, Math.PI * 2);
      g.fill();
      g.fillRect(w * 0.3, hh * 0.38, w * 0.22, hh * 0.1);
      g.beginPath();
      g.ellipse(w * 0.42, hh * 0.64, w * 0.4, hh * 0.22, 0, 0, Math.PI * 2);
      g.fill();
      // The long nose.
      g.beginPath();
      g.moveTo(w * 0.6, hh * 0.17);
      g.lineTo(w * 1.0, hh * 0.24);
      g.lineTo(w * 0.62, hh * 0.3);
      g.fill();
      // Gold: an eye, a cap band, a belt and belly dots.
      g.fillStyle = "#e8b23a";
      g.fillRect(w * 0.5, hh * 0.15, w * 0.1, hh * 0.05);
      g.fillRect(w * 0.14, hh * 0.08, w * 0.56, hh * 0.04);
      g.fillRect(w * 0.06, hh * 0.58, w * 0.72, hh * 0.04);
      for (const [x, y] of [
        [0.25, 0.7],
        [0.45, 0.76],
        [0.62, 0.68],
      ] as const)
        g.fillRect(w * x, hh * y, w * 0.07, w * 0.07);
      // The legs.
      g.fillStyle = "#3a2414";
      g.fillRect(w * 0.18, hh * 0.84, w * 0.16, hh * 0.16);
      g.fillRect(w * 0.5, hh * 0.84, w * 0.16, hh * 0.16);
    };
    picture(root, 0.22, 0.38, clown, [0.09, 0.07, -4.5 * U], 0.012, 0.016);
    tick((t, walking) => {
      root.rotation.z = Math.sin(t * (walking ? 6 : 1.2)) * (walking ? 0.025 : 0.007);
    });
  },
  // Dadak merak: a great fan of peacock-eye feathers rising behind, a red medallion at the hub, swaying slowly. Fabric and feather.
  "Dadak merak": (b, tick) => {
    const pivot = vpart(b, [0, -1.5 * U, -3.2 * U]);
    const W = 1.12;
    const H = 0.92;
    const fan = (back: boolean) => (g: CanvasRenderingContext2D, w: number, hh: number) => {
      const cx = w / 2;
      const cy = hh - w * 0.07;
      const R = w * 0.49 * (back ? 1 : 0.9);
      const n = back ? 17 : 15;
      for (let i = 0; i < n; i++) {
        const a = Math.PI * (-0.05 + (1.1 * (i + 0.5)) / n);
        const ux = Math.cos(a);
        const uy = -Math.sin(a);
        const half = ((R * 1.1 * Math.PI) / n) * 0.5 * (back ? 1.7 : 1.25);
        const tip = back ? R : R * 0.95;
        g.save();
        g.translate(cx, cy);
        g.rotate(Math.atan2(uy, ux));
        // The feather: a long leaf of blue-green, dark at the edge.
        g.fillStyle = back ? DEEP_SEA : i % 2 ? TURQUOISE : "#1a9a8a";
        g.beginPath();
        g.moveTo(R * 0.16, 0);
        g.quadraticCurveTo(tip * 0.5, -half * 1.15, tip, 0);
        g.quadraticCurveTo(tip * 0.5, half * 1.15, R * 0.16, 0);
        g.fill();
        if (!back) {
          g.strokeStyle = "#0b4f5e";
          g.lineWidth = Math.max(1, w * 0.012);
          g.beginPath();
          g.moveTo(R * 0.2, 0);
          g.lineTo(tip * 0.98, 0);
          g.stroke();
          // The eye: gold, then green, then deep blue.
          g.fillStyle = SAFFRON;
          g.beginPath();
          g.ellipse(tip * 0.74, 0, half * 0.95, half * 0.8, 0, 0, Math.PI * 2);
          g.fill();
          g.fillStyle = LEAF;
          g.beginPath();
          g.ellipse(tip * 0.75, 0, half * 0.55, half * 0.46, 0, 0, Math.PI * 2);
          g.fill();
          g.fillStyle = INDIGO;
          g.beginPath();
          g.ellipse(tip * 0.76, 0, half * 0.28, half * 0.24, 0, 0, Math.PI * 2);
          g.fill();
        }
        g.restore();
      }
      if (!back) {
        // The medallion: a red disc with a gold ring, cream eyes and a smile. A face of cloth, nothing more.
        const r = w * 0.115;
        g.fillStyle = SAFFRON;
        g.beginPath();
        g.arc(cx, cy, r * 1.22, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = HIBISCUS;
        g.beginPath();
        g.arc(cx, cy, r, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = CREAM;
        for (const s of [-1, 1]) {
          g.beginPath();
          g.ellipse(cx + s * r * 0.4, cy - r * 0.2, r * 0.22, r * 0.28, 0, 0, Math.PI * 2);
          g.fill();
        }
        g.fillStyle = "#3a1a14";
        for (const s of [-1, 1]) g.fillRect(cx + s * r * 0.4 - r * 0.07, cy - r * 0.18, r * 0.14, r * 0.16);
        g.strokeStyle = CREAM;
        g.lineWidth = Math.max(1.5, w * 0.012);
        g.beginPath();
        g.arc(cx, cy + r * 0.12, r * 0.4, 0.15 * Math.PI, 0.85 * Math.PI);
        g.stroke();
      }
    };
    // Two layers: the dark fan behind, the eyed fan in front of it, a hair apart.
    const hub = H / 2 - 0.07 * W;
    // The eyed side faces away from the wearer, so it turns right round: the dark fan sits behind it, against the back.
    const face = vpart(pivot, [0, 0, 0]);
    face.rotation.y = Math.PI;
    picture(face, W, H, fan(true), [0, hub, -0.013], 0.014, 0.014, 3);
    picture(face, W, H, fan(false), [0, hub, 0.0], 0.014, 0.014, 3);
    tick((t, walking) => {
      pivot.rotation.z = Math.sin(t * (walking ? 5 : 0.9)) * (walking ? 0.07 : 0.045);
      pivot.rotation.x = Math.sin(t * (walking ? 10 : 1.3) + 1) * (walking ? 0.03 : 0.012);
    });
  },
};
Object.assign(BACK_BUILDERS, BACKS);
