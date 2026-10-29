/**
 * The Ragnarok Eve case's body gear in 3D (`core/src/case-ragnarok.ts`): six outfits, five things held and two worn on
 * the back, in the same cubes as the rest of the wardrobe (`gear3dBody.ts`). Loaded by `gear3dRagnarok.ts`, it adds its
 * builders to the shop's tables: outfits under their look index (`RAGNAROK_BASE + n`), held and back items under their
 * names. Outfit colours are in `data/gear.ts`. Design brief and sensitivity rules: `docs/cases/ragnarok-eve.md`
 * (Mjölnir only ever as the foam toy, no wings on the plate, no runes on anything here).
 */
import { RAGNAROK_BASE } from "@tokenmaxxing/core/case-ragnarok.ts";
import type * as THREE from "three";
import { type Model, seeded } from "../kit/kit.ts";
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
} from "./gear3dBody.ts";
import { lit, shaped, sign, star } from "./gear3dHead.ts";
import { U, type VoxModel, Vx, vpart } from "./voxgear.ts";

const OAK = "#6b4a2e";
const OAK_DARK = "#3f2a1a";
const IRON = "#4a5160";
const STEEL = "#7a8394";
const STEEL_LIGHT = "#c3cad6";
const BONE = "#e8dfc8";
const BONE_DARK = "#c9bd9c";
const FUR = "#9aa3ad";
const GOLD = "#e9b73d";
const GOLD_DARK = "#b8860b";
const RED = "#a8322e";
const WOAD = "#3b6fb8";
const NAVY = "#1f3550";
const LEATHER = "#7a5232";

/** Hangs `p` swaying (a pelt, a cloth); walking swings it harder. */
function sway(tick: BodyCtx["tick"], p: VoxModel, axis: "x" | "z" = "x", phase = 0, base = 0): void {
  tick((t, walking) => {
    p.rotation[axis] = base + Math.sin(t * (walking ? 9 : 1.6) + phase) * (walking ? 0.14 : 0.025);
  });
}

// MARK: Outfits

/** A snowflake of nine 3-pixel cells (a plus and four corner dots), centred on (cx, cy) on a 3-pixel grid. */
const flake = (g: CanvasRenderingContext2D, color: string, cx: number, cy: number) => {
  for (const [dx, dy] of [
    [0, 0],
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
    [2, 2],
    [-2, 2],
    [2, -2],
    [-2, -2],
  ] as const)
    px(g, color, cx + dx * 3, cy + dy * 3, 3, 3);
};

/** A band of colour round an arm: a cuff, a yoke. */
const armBand = (c: BodyCtx, color: string, y: number, h: number, pad = 0) =>
  c.arms.forEach((arm) => {
    new Vx(vpart(arm)).b(-1.22 - pad, y, -1.22 - pad, 2.44 + 2 * pad, h, 2.44 + 2 * pad, color);
  });

// biome-ignore format: a catalogue reads best one to a line
const OUTFITS: Record<number, (c: BodyCtx) => void> = {
  // Wool tunic: a brown-grey tunic with a laced neck, a dark belt with a brass buckle, a flared hem, wool cuffs.
  0: (c) => {
    const flecks = (g: CanvasRenderingContext2D, w: number, h: number) => {
      for (let y = 0; y < h; y += 3)
        for (let x = 0; x < w; x += 3) if ((x * 7 + y * 11) % 27 === 0) px(g, "#6a5b49", x, y, 3, 3);
    };
    marks(
      c,
      (g, w, h) => {
        flecks(g, w, h);
        px(g, "#d9c9a0", 25, 0, 7, 3);
        px(g, OAK_DARK, 27, 0, 3, 18);
        for (const y of [3, 9, 15]) px(g, "#d9c9a0", 24, y, 9, 2);
      },
      flecks,
    );
    roll(c, "#5a4d3f", 1, 0.3);
    const v = grid(c);
    v.b(-3.9, -1.7, -2.25, 7.8, 2.1, 4.5, c.main);
    v.b(-3.95, -1.7, -2.3, 7.9, 0.4, 4.6, "#5a4d3f");
    v.b(-3.75, 0.4, -2.2, 7.5, 1.2, 4.4, OAK_DARK);
    v.b(-0.9, 0.25, 2.1, 1.8, 1.5, 0.4, GOLD);
    v.b(-0.4, 0.65, 2.45, 0.8, 0.7, 0.2, OAK_DARK);
    armBand(c, "#d9c9a0", -6.4, 1.3);
    armBand(c, "#5a4d3f", -5.1, 0.45, 0.06);
  },
  // Brewer's apron: a cream apron over a linen shirt, a gold stain and a mug mark on the chest, a rope tie behind.
  1: (c) => {
    marks(
      c,
      (g, _w, h) => {
        px(g, BONE, 15, 0, 27, 12);
        px(g, BONE, 6, 12, 45, h - 12);
        px(g, BONE_DARK, 9, 33, 39, 2);
        // The mug: oak with iron bands, a foam top, a handle, and the third batch spilled down its side.
        px(g, "#fff3c0", 18, 12, 21, 6);
        px(g, "#f3e6b0", 21, 9, 15, 4);
        px(g, "#3f2a1a", 15, 18, 27, 15);
        px(g, "#8a5a32", 18, 18, 21, 12);
        px(g, "#b8814a", 18, 18, 6, 12);
        px(g, IRON, 18, 21, 21, 3);
        px(g, IRON, 18, 27, 21, 3);
        px(g, "#3f2a1a", 39, 20, 6, 3);
        px(g, "#3f2a1a", 42, 23, 3, 6);
        px(g, "#3f2a1a", 39, 29, 6, 3);
        for (const [x, y, s] of [
          [10, 5, 3],
          [44, 9, 3],
          [10, 33, 4],
          [44, 34, 3],
          [36, 36, 3],
        ] as const)
          px(g, "#d99a1c", x, y, s, s);
        px(g, "#e9b73d", 24, 33, 9, 3);
      },
      (g, w) => {
        px(g, BONE, 3, 22, w - 6, 3);
        px(g, BONE, 18, 2, 3, 10);
        px(g, BONE, 36, 2, 3, 10);
      },
    );
    const v = grid(c);
    v.b(-2.5, 0, 2, 5, 2.4, 0.3, BONE);
    v.b(-2.9, -2.6, 1.9, 5.8, 2.6, 0.45, BONE);
    v.b(-2.9, -2.6, 2.3, 5.8, 0.35, 0.1, BONE_DARK);
    v.b(-1.6, -1.9, 2.3, 3.2, 1.1, 0.25, BONE_DARK);
    for (const x of [-2.3, 1.7]) v.b(x, 8, -2, 0.6, 0.3, 4, BONE);
    // The rope tie: a coil round the waist and a knot with two tails at the back.
    v.b(-3.7, 1.2, -2.25, 7.4, 0.7, 0.25, "#c9a36a");
    v.b(-3.7, 1.2, 2.0, 7.4, 0.7, 0.25, "#c9a36a");
    v.b(-1.3, 0.5, -2.7, 1, 1.9, 0.45, "#c9a36a");
    v.b(0.3, 0.3, -2.7, 1, 2.1, 0.45, "#c9a36a");
    v.b(-0.4, 1.0, -2.8, 0.9, 0.9, 0.55, "#a8814a");
    roll(c, "#b8a47a", 0.8, 0.3);
    armBand(c, "#b8a47a", -6.4, 1.1);
  },
  // Yoke sweater: a cream jumper with a navy snowflake yoke, ribbed hem and cuffs, a navy neck roll.
  2: (c) => {
    marks(
      c,
      (g, w, h) => {
        px(g, NAVY, 0, 0, w, 24);
        px(g, "#e8dfc8", 0, 8, w, 3);
        px(g, "#e8dfc8", 0, 18, w, 3);
        px(g, "#e8dfc8", 0, 24, w, 3);
        for (const x of [9, 28, 47]) flake(g, "#e8dfc8", x, 13);
        px(g, NAVY, 0, 24, w, 3);
        void h;
      },
      (g, w) => {
        px(g, NAVY, 0, 0, w, 24);
        px(g, "#e8dfc8", 0, 8, w, 3);
        px(g, "#e8dfc8", 0, 18, w, 3);
        for (const x of [9, 28, 47]) flake(g, "#e8dfc8", x, 13);
      },
    );
    roll(c, NAVY, 1.2, 0.4);
    const v = grid(c);
    v.b(-3.75, -0.6, -2.2, 7.5, 1.4, 4.4, NAVY);
    v.b(-3.8, 0.2, -2.25, 7.6, 0.4, 4.5, "#e8dfc8");
    armBand(c, NAVY, -6.4, 1.4);
    armBand(c, NAVY, -1.9, 1.4, 0.05);
    armBand(c, "#e8dfc8", -3.2, 0.5, 0.04);
  },
  // Byrnie: a mail shirt in a fine dot hatch with a leather collar, an iron belt and a short mail skirt, mail sleeves.
  3: (c) => {
    const mail = (g: CanvasRenderingContext2D, w: number, h: number) => {
      for (let y = 0; y < h; y += 3)
        for (let x = 0; x < w; x += 3) px(g, ((x + y) / 3) % 2 ? "#9aa3b2" : "#6a7382", x, y, 3, 3);
    };
    marks(c, mail, mail);
    roll(c, LEATHER, 1.3, 0.45);
    const v = grid(c);
    v.b(-3.9, -2.6, -2.25, 7.8, 3.0, 4.5, "#7e8794");
    // A ragged hem of dangling rings.
    for (let i = 0; i < 7; i++)
      v.b(-3.9 + i * 1.1, -3.4, -2.25, 0.8, 0.9, 4.5, i % 2 ? "#6a7382" : "#9aa3b2");
    v.b(-3.8, 0.3, -2.3, 7.6, 1.3, 4.6, IRON);
    v.b(-3.85, 1.25, -2.35, 7.7, 0.3, 4.7, STEEL);
    v.b(-0.9, 0.2, 2.2, 1.8, 1.5, 0.4, STEEL_LIGHT);
    for (const x of [-3, -1.8, 1.4, 2.6]) v.b(x, 0.7, 2.2, 0.5, 0.5, 0.4, STEEL_LIGHT);
    c.arms.forEach((arm) => {
      const a = new Vx(vpart(arm));
      a.b(-1.7, -3.7, -1.65, 3.4, 3.6, 3.3, "#7e8794");
      for (let i = 0; i < 4; i++)
        a.b(-1.7 + i * 0.9, -4.3, -1.65, 0.7, 0.7, 3.3, i % 2 ? "#6a7382" : "#9aa3b2");
      a.b(-1.3, -6.4, -1.3, 2.6, 1.0, 2.6, LEATHER);
    });
  },
  // Berserker bearskin: a brown pelt over the shoulders with the bear's head on one of them, claws on the cuffs, a pelt
  // hanging down the back. The head growls now and then.
  4: (c) => {
    const rnd = seeded(504);
    const FUR_B = "#6b4a2e";
    const FUR_D = "#4a3320";
    const FUR_L = "#8a6a46";
    const flecks = (g: CanvasRenderingContext2D, w: number, h: number) => {
      for (let y = 0; y < h; y += 3)
        for (let x = 0; x < w; x += 3) {
          const r = rnd();
          if (r < 0.3) px(g, FUR_L, x, y, 3, 3);
          else if (r < 0.5) px(g, FUR_D, x, y, 3, 3);
        }
    };
    marks(c, flecks, flecks);
    const v = grid(c);
    // The mantle over both shoulders, with a ragged lower edge.
    v.b(-4.3, 5.2, -2.5, 8.6, 2.8, 5.0, FUR_B);
    v.b(-4.8, 4.6, -2.3, 9.6, 1.2, 4.6, FUR_D);
    for (let i = 0; i < 8; i++)
      v.b(-4.4 + i * 1.1, 3.6 - (i % 3) * 0.5, 1.8, 1.0, 1.6 + (i % 3) * 0.5, 0.7, i % 2 ? FUR_L : FUR_B);
    // A belt of rope, and the pelt's skirt.
    v.b(-3.8, 0.4, -2.3, 7.6, 1.0, 4.6, OAK_DARK);
    v.b(-3.9, -2.0, -2.25, 7.8, 2.4, 4.5, FUR_B);
    for (let i = 0; i < 7; i++)
      v.b(-3.9 + i * 1.1, -3.0 - (i % 2) * 0.6, -2.25, 0.8, 1.2 + (i % 2) * 0.6, 4.5, i % 2 ? FUR_L : FUR_D);
    // The pelt down the back: it swings from the shoulders.
    const pelt = vpart(c.body, [0, 7.5 * U, -2.4 * U]);
    const pv = new Vx(pelt);
    pv.b(-3.4, -9, -0.9, 6.8, 9, 0.9, FUR_B);
    for (let i = 0; i < 6; i++)
      pv.b(
        -3.4 + i * 1.15,
        -10.4 - (i % 2) * 0.8,
        -0.9,
        0.9,
        1.6 + (i % 2) * 0.8,
        0.9,
        i % 2 ? FUR_D : FUR_L,
      );
    pv.b(-1.0, -4.2, -1.3, 2.0, 2.0, 0.4, FUR_L);
    sway(c.tick, pelt, "x", 0, 0.03);
    // The bear's head on the left shoulder: a skull, a snout, a black nose, ears, small eyes, a jaw that opens.
    const head = vpart(c.body, [-4.4 * U, 8.0 * U, 0.4 * U]);
    const hv = new Vx(head);
    hv.b(-2.4, 0, -2.2, 4.8, 3.4, 4.4, FUR_B);
    hv.b(-2.2, 3.4, -1.8, 4.4, 0.7, 3.6, FUR_D);
    for (const s of [-1, 1]) {
      hv.b(s > 0 ? 1.2 : -2.4, 3.4, -1.4, 1.2, 1.4, 1.3, FUR_D);
      hv.b(s > 0 ? 1.5 : -2.1, 3.5, -1.0, 0.6, 0.8, 0.5, "#b99aa0");
      hv.b(s * 1.4 - 0.4, 1.8, 2.2, 0.8, 0.8, 0.3, "#14101c");
      hv.b(s * 1.4 - 0.15, 2.1, 2.45, 0.3, 0.3, 0.2, "#ffffff");
    }
    hv.b(-1.5, 0.3, 2.2, 3.0, 2.2, 1.9, FUR_L);
    hv.b(-0.7, 1.6, 4.1, 1.4, 0.9, 0.5, "#14101c");
    const jaw = vpart(head, [0, 0.2 * U, 1.9 * U]);
    const jv = new Vx(jaw);
    jv.b(-1.3, -1.0, 0, 2.6, 1.0, 2.2, FUR_L);
    jv.b(-0.9, -0.1, 0.5, 0.5, 0.5, 0.4, BONE);
    jv.b(0.4, -0.1, 0.5, 0.5, 0.5, 0.4, BONE);
    jv.b(-0.7, -0.8, 1.2, 1.4, 0.5, 0.9, "#8a3a3a");
    c.tick((t) => {
      const g = Math.max(0, Math.sin(t * 0.7)) ** 8;
      jaw.rotation.x = g * 0.55;
      head.rotation.x = -g * 0.12;
      head.position.x = -4.4 * U + Math.sin(t * 40) * g * 0.004;
    });
    // Claws on the cuffs, and a fur bracer under each.
    c.arms.forEach((arm) => {
      const a = new Vx(vpart(arm));
      a.b(-1.4, -6.3, -1.4, 2.8, 2.4, 2.8, FUR_D);
      a.b(-1.45, -4.3, -1.45, 2.9, 0.5, 2.9, FUR_L);
      for (let i = 0; i < 3; i++) a.b(-1.0 + i * 0.9, -6.9, 1.2, 0.5, 0.8, 0.5, BONE);
    });
  },
  // Valkyrie plate: a silver breastplate and pauldrons, a woad-blue sash across the chest, a skirt of plates and a spear on
  // the back with a pennant. No wings.
  5: (c) => {
    const SILVER = "#b8c2d0";
    const SILVER_L = "#e6ecf5";
    const BLUE = "#3b6fb8";
    marks(
      c,
      (g, w, h) => {
        px(g, SILVER, 6, 0, 45, h);
        px(g, SILVER_L, 6, 0, 45, 3);
        px(g, STEEL, 27, 3, 3, h - 3);
        px(g, "#8a96a8", 6, h - 3, 45, 3);
        void w;
      },
      (g, w, h) => {
        px(g, SILVER, 6, 0, w - 12, h);
        px(g, STEEL, 27, 0, 3, h);
      },
      false,
    );
    const v = grid(c);
    v.b(-3.3, 2.0, 2.0, 6.6, 5.6, 0.55, SILVER);
    v.b(-2.6, 7.6, 2.0, 5.2, 0.5, 0.55, SILVER_L);
    v.b(-0.4, 2.0, 2.5, 0.8, 5.4, 0.3, SILVER_L);
    v.b(-3.4, 1.9, 1.95, 6.8, 0.5, 0.65, STEEL);
    // The blue sash, a staircase from the right shoulder to the left hip, and its tail with a gold tassel.
    for (let i = 0; i < 6; i++) v.b(-2.9 + i * 1.0, 7.0 - i * 1.15, 2.5, 1.9, 1.5, 0.35, BLUE);
    for (let i = 0; i < 6; i++) v.b(-2.9 + i * 1.0, 7.0 - i * 1.15, 2.85, 1.9, 0.25, 0.1, "#274c86");
    v.b(2.0, -1.6, 2.2, 1.9, 3.6, 0.4, BLUE);
    v.b(2.3, -2.2, 2.45, 1.3, 0.6, 0.3, GOLD);
    // A belt and a skirt of plates, silver and blue in turn.
    v.b(-3.8, 0.4, -2.3, 7.6, 1.1, 4.6, "#3f2a1a");
    v.b(-0.9, 0.25, 2.2, 1.8, 1.4, 0.4, GOLD);
    for (let i = 0; i < 7; i++) v.b(-3.7 + i * 1.07, -2.8, 2.0, 0.9, 3.0, 0.4, i % 2 ? "#8aa6d0" : SILVER);
    for (let i = 0; i < 7; i++) v.b(-3.7 + i * 1.07, -2.8, -2.4, 0.9, 3.0, 0.4, i % 2 ? "#8aa6d0" : SILVER);
    // Pauldrons and vambraces.
    c.arms.forEach((arm) => {
      const a = new Vx(vpart(arm));
      a.b(-2.1, -1.5, -2.0, 4.2, 2.0, 4.0, SILVER);
      a.b(-2.15, -1.5, -2.05, 4.3, 0.4, 4.1, SILVER_L);
      a.b(-1.5, -6.4, -1.5, 3.0, 2.8, 3.0, SILVER);
      a.b(-1.55, -4.0, -1.55, 3.1, 0.4, 3.1, STEEL);
    });
    // The spear carried on the back, its leaf head high over the shoulder, a blue pennant fluttering below it.
    const spear = new Vx(vpart(c.body, [2.6 * U, 0, 0]));
    spear.b(-0.3, -6, -3.5, 0.6, 22.4, 0.6, OAK);
    spear.b(-0.5, 16.4, -3.7, 1.0, 0.8, 1.0, STEEL);
    spear.b(-0.7, 17.2, -3.9, 1.4, 1.4, 1.4, SILVER_L);
    spear.b(-0.5, 18.6, -3.7, 1.0, 1.2, 1.0, SILVER_L);
    spear.b(-0.3, 19.8, -3.5, 0.6, 1.0, 0.6, SILVER);
    spear.b(-0.15, 17.6, -3.95, 0.3, 0.6, 0.15, lit("#ffffff"));
    const flag = vpart(c.body, [2.6 * U, 15.8 * U, -3.5 * U]);
    const fv = new Vx(flag);
    fv.b(0.3, -1.4, -0.2, 3.4, 1.6, 0.4, BLUE);
    fv.b(3.7, -1.1, -0.2, 1.2, 1.0, 0.4, BLUE);
    fv.b(0.3, -0.5, -0.25, 3.4, 0.35, 0.5, "#274c86");
    c.tick((t, walking) => {
      flag.rotation.y = Math.sin(t * (walking ? 9 : 3.4)) * 0.3;
    });
    // A glint that crosses the breastplate now and then: the plate throws light.
    const glint = v.b(-3, 6.8, 2.58, 0.7, 0.7, 0.2, lit("#ffffff"));
    c.tick((t) => {
      const k = (t * 0.35) % 1;
      glint.position.set((-3 + k * 6) * U, (6.8 - k * 4.5) * U, 2.7 * U);
      glint.scale.setScalar(Math.sin(k * Math.PI) ** 2 * 1.4);
    });
  },
};
for (const [n, build] of Object.entries(OUTFITS)) OUTFIT_BUILDERS[RAGNAROK_BASE + Number(n)] = build;

// MARK: Held

/** A mesh from a canvas, standing in front of the hand: a shield face, a board. */
const face = (
  h: Model,
  w: number,
  hh: number,
  draw: Parameters<typeof sign>[3],
  at: [number, number, number],
  pxs = 160,
) => sign(h, w, hh, draw, at, pxs);

// biome-ignore format: a catalogue reads best one to a line
const HELD: Record<string, HeldBuilder> = {
  // Drinking horn: a curved bone horn with an iron tip cap and a gold rim, foam heaped over amber liquid (deliberately not
  // clearly beer). Held mouth up, the foam bobbing.
  "Drinking horn": (h, tick) => {
    const root = h.part([0, -0.045, 0.07]);
    root.rotation.z = 0.35;
    let at: Model = root;
    const N = 7;
    const len = 0.046;
    for (let i = 0; i < N; i++) {
      const r = 0.013 + i * 0.0072;
      const seg = at.part([0, i ? len : 0, 0]);
      seg.rotation.z = i ? -0.15 : 0;
      seg.cyl(r, len + 0.004, i === 0 ? IRON : i % 2 ? BONE : BONE_DARK, [0, 0, 0], r + 0.0075, 8);
      if (i === 0) seg.cyl(r + 0.004, 0.012, STEEL_LIGHT, [0, 0.0, 0], r + 0.004, 8);
      at = seg;
    }
    const rim = 0.013 + (N - 1) * 0.0072 + 0.0075;
    at.cyl(rim + 0.004, 0.016, GOLD, [0, len - 0.004, 0], rim + 0.004, 10);
    at.cyl(rim + 0.006, 0.006, GOLD_DARK, [0, len + 0.002, 0], rim + 0.006, 10);
    at.cyl(rim - 0.004, 0.012, "#c98a2a", [0, len + 0.004, 0], rim - 0.004, 10);
    const foam = [
      at.ball(0.03, "#f6e7a8", [0, len + 0.02, 0], [1.1, 0.7, 1.1], 8),
      at.ball(0.02, "#fffbe0", [0.022, len + 0.036, 0.008], [1, 0.8, 1], 6),
      at.ball(0.017, "#f6e7a8", [-0.02, len + 0.034, -0.01], [1, 0.8, 1], 6),
      at.ball(0.011, "#fffbe0", [0.0, len + 0.05, 0.016], [1, 1, 1], 5),
    ];
    tick((t) =>
      foam.forEach((f, i) => {
        f.position.y = len + 0.02 + i * 0.008 + Math.sin(t * 2.2 + i * 1.7) * 0.004;
      }),
    );
  },
  // Round shield: a painted disc in quarters (red, bone, woad, gold) with a grey iron rim and boss.
  "Round shield": (h) => {
    const s = h.part([0, 0.02, 0.1]);
    s.rotation.y = 0.2;
    face(
      s,
      0.3,
      0.3,
      (g, w, hh) => {
        const cx = w / 2;
        const cy = hh / 2;
        const R = w / 2;
        const disc = (r: number, col: string) => {
          g.fillStyle = col;
          g.beginPath();
          g.arc(cx, cy, r, 0, Math.PI * 2);
          g.fill();
        };
        disc(R, "#2b2a33");
        disc(R * 0.92, "#5d6676");
        const quarter = (a0: number, col: string) => {
          g.fillStyle = col;
          g.beginPath();
          g.moveTo(cx, cy);
          g.arc(cx, cy, R * 0.82, a0, a0 + Math.PI / 2);
          g.fill();
        };
        quarter(Math.PI, RED);
        quarter(Math.PI * 1.5, BONE);
        quarter(0, WOAD);
        quarter(Math.PI * 0.5, GOLD);
        disc(R * 0.3, "#2b2a33");
        disc(R * 0.26, "#8d97a8");
      },
      [0, 0, 0],
      120,
    );
    s.box([0.07, 0.07, 0.03], "#8d97a8", [-0.035, -0.035, 0.012], 0.01);
    s.box([0.04, 0.04, 0.012], STEEL_LIGHT, [-0.02, -0.02, 0.04], 0.004);
    s.box([0.03, 0.14, 0.02], OAK_DARK, [-0.015, -0.07, -0.02], 0.004);
  },
  // Tafl board: a small 7x7 board in oak frame, dark and light pegs and a gold king, tilted up to be shown off.
  "Tafl board": (h) => {
    const b = h.part([0, 0.07, 0.1]);
    b.rotation.x = -0.45;
    b.box([0.215, 0.215, 0.018], OAK_DARK, [0, -0.1075, -0.012], 0.004);
    face(
      b,
      0.175,
      0.175,
      (g, w, hh) => {
        const n = 7;
        const cw = w / n;
        for (let j = 0; j < n; j++)
          for (let i = 0; i < n; i++) {
            g.fillStyle = (i + j) % 2 ? "#a8814a" : "#c9a36a";
            g.fillRect(i * cw, j * cw, cw + 0.5, cw + 0.5);
          }
        const dot = (i: number, j: number, col: string, r = 0.32) => {
          g.fillStyle = col;
          g.beginPath();
          g.arc((i + 0.5) * cw, (j + 0.5) * cw, cw * r, 0, Math.PI * 2);
          g.fill();
        };
        for (const [i, j] of [
          [3, 0],
          [2, 0],
          [4, 0],
          [3, 1],
          [3, 6],
          [2, 6],
          [4, 6],
          [3, 5],
          [0, 3],
          [0, 2],
          [0, 4],
          [1, 3],
          [6, 3],
          [6, 2],
          [6, 4],
          [5, 3],
        ] as const)
          dot(i, j, "#252a3a");
        for (const [i, j] of [
          [3, 2],
          [3, 4],
          [2, 3],
          [4, 3],
          [2, 2],
          [4, 4],
        ] as const)
          dot(i, j, "#fbf3d8");
        g.fillStyle = "#b8860b";
        g.fillRect(3 * cw, 3 * cw, cw, cw);
        dot(3, 3, GOLD, 0.4);
        void hh;
      },
      [0, 0.0, 0.0],
      130,
    );
  },
  // Bearded axe: an oak shaft with leather grips and an iron head whose lower edge hangs in a beard.
  "Bearded axe": (h) => {
    const a = h.part([0, 0, 0.06]);
    a.rotation.x = -0.12;
    a.rotation.y = -1.25;
    a.rotation.z = -0.3;
    const L = -0.2;
    a.box([0.034, 0.36, 0.034], OAK, [0, L, 0], 0.006);
    for (const y of [-0.1, -0.05, 0.0]) a.box([0.04, 0.02, 0.04], LEATHER, [0, y, 0], 0.004);
    a.box([0.045, 0.034, 0.045], OAK_DARK, [0, L - 0.005, 0], 0.006);
    // The head, flat to the shaft: a socket, a blade swept out to the front with a hooked beard under it.
    a.box([0.05, 0.1, 0.05], IRON, [0, 0.12, 0], 0.006);
    a.box([0.036, 0.04, 0.036], STEEL, [0, 0.22, 0], 0.006);
    a.box([0.04, 0.12, 0.08], STEEL, [0, 0.12, 0.05], 0.004);
    a.box([0.036, 0.19, 0.06], STEEL_LIGHT, [0, 0.105, 0.11], 0.004);
    a.box([0.034, 0.1, 0.05], STEEL_LIGHT, [0, 0.03, 0.12], 0.004);
    a.box([0.03, 0.05, 0.04], STEEL_LIGHT, [0, 0.0, 0.1], 0.003);
    a.box([0.03, 0.02, 0.04], "#ffffff", [0, 0.29, 0.11], 0.002);
  },
  // Squeaky Mjölnir: a stubby foam toy hammer, grey head, leather-wrapped handle with a loop, a pale squeak star that
  // pops on every squeak. A toy, never a pendant (see the brief).
  "Squeaky Mjölnir": (h, tick) => {
    const m = h.part([0, 0, 0.07]);
    m.box([0.03, 0.2, 0.03], LEATHER, [0, -0.08, 0], 0.006);
    for (let i = 0; i < 5; i++)
      m.box([0.036, 0.014, 0.036], i % 2 ? OAK_DARK : "#9a6e42", [0, -0.07 + i * 0.026, 0], 0.003);
    m.box([0.05, 0.035, 0.02], "#9a6e42", [0, -0.125, 0.02], 0.006);
    m.box([0.032, 0.012, 0.012], OAK_DARK, [0, -0.115, 0.034], 0.003);
    const head = m.part([0, 0.12, 0]);
    head.box([0.16, 0.085, 0.085], "#9aa3ad", [0, 0, 0], 0.016);
    head.box([0.17, 0.016, 0.092], "#b8c0c9", [0, 0.077, 0], 0.01);
    head.box([0.17, 0.016, 0.092], "#6e7782", [0, -0.008, 0], 0.01);
    for (const s of [-1, 1]) head.box([0.016, 0.085, 0.095], "#6e7782", [s * 0.08, 0, 0], 0.01);
    head.box([0.15, 0.01, 0.02], "#ffffff", [0, 0.05, 0.045], 0.003);
    const squeak = shaped(
      head,
      "squeak-star",
      star(0.045, 5, 0.5),
      0.012,
      lit("#fff2a8"),
      [0.0, 0.043, 0.055],
    );
    const pop = shaped(head, "squeak-pop", star(0.03, 5, 0.5), 0.01, lit("#fff7c8"), [0.03, 0.12, 0.05]);
    tick((t) => {
      const k = (t * 0.45) % 1;
      const s = k < 0.12 ? Math.sin((k / 0.12) * Math.PI) : 0;
      head.scale.set(1 + s * 0.14, 1 - s * 0.2, 1 + s * 0.1);
      squeak.scale.setScalar(1 + s * 0.5);
      pop.visible = k < 0.3;
      pop.position.set(0.03 + k * 0.08, 0.12 + k * 0.22, 0.05);
      pop.scale.setScalar(Math.max(0.001, Math.sin((k / 0.3) * Math.PI)));
      pop.rotation.z = k * 8;
    });
  },
};
Object.assign(HELD_BUILDERS, HELD);

// MARK: Back

/** A shaggy cape: rows of fur slabs each hanging from the one above, so the lower ones swing out later, a ragged edge. */
function furCape(b: VoxModel, tick: BodyCtx["tick"]): void {
  const rnd = seeded(5000);
  const tones = [FUR, "#b3bbc4", "#838c98", "#aab2bc"];
  const rows = 6;
  const steps: VoxModel[] = [];
  let at = vpart(b, [0, -0.25 * U, -0.05 * U]);
  for (let i = 0; i < rows; i++) {
    const w = 7.6 + i * 0.5;
    const cols = 6;
    for (let k = 0; k < cols; k++) {
      const cw = w / cols;
      const drop = i === rows - 1 ? 1.2 + rnd() * 1.4 : 0;
      at.box([cw * U * 1.02, (1.5 + drop) * U, 0.9 * U], tones[Math.floor(rnd() * tones.length)]!, [
        (-w / 2 + cw * (k + 0.5)) * U,
        -(1.5 + drop) * U,
        -0.45 * U,
      ]);
    }
    const next = vpart(at, [0, -1.5 * U, 0]);
    steps.push(at);
    at = next;
  }
  tick((t, walking) => {
    steps.forEach((s, i) => {
      s.rotation.x = walking
        ? 0.1 + Math.abs(Math.sin(t * 11)) * 0.09 * (i ? 0.7 : 1.3) + Math.sin(t * 11 - i * 0.8) * 0.05 * i
        : 0.03 + (Math.sin(t * 1.6 - i * 0.6) + 1) * 0.016 * (i + 1);
    });
  });
}

// biome-ignore format: a catalogue reads best one to a line
const BACKS: Record<string, BackBuilder> = {
  // Fur mantle: a shaggy grey cape over both shoulders, a fur collar round the neck, pinned at the front with a gold brooch.
  "Fur mantle": (b, tick) => {
    furCape(b, tick);
    const v = new Vx(b);
    // Shoulder pads that run from the back over to the front, shaggy.
    for (const s of [-1, 1]) {
      v.b(s > 0 ? 3.0 : -4.8, -1.4, -0.9, 1.8, 1.7, 5.4, FUR);
      v.b(s > 0 ? 3.2 : -4.6, -0.3, -0.7, 1.4, 0.5, 5.0, "#b3bbc4");
      v.b(s > 0 ? 3.6 : -5.0, -2.3, 0.4, 1.4, 1.0, 2.0, "#838c98");
    }
    // The collar, round the front of the neck, and the brooch with its pin.
    v.b(-3.8, -1.6, 3.8, 7.6, 1.6, 1.0, "#b3bbc4");
    v.b(-3.4, -2.4, 4.0, 6.8, 0.9, 0.8, FUR);
    v.b(-3.4, -1.9, 4.8, 1.8, 1.8, 0.5, GOLD);
    v.b(-3.0, -1.5, 5.2, 0.9, 0.9, 0.3, "#d8283a");
    v.b(-1.5, -1.4, 4.9, 3.0, 0.4, 0.4, GOLD_DARK);
    v.b(-3.9, -0.6, -0.9, 7.8, 0.7, 0.9, "#838c98");
  },
  // Skíðblaðnir: the folded ship on the back. A hull with a gold prow, round shields down its side, a mast, and a striped
  // sail pleated like a handkerchief and flapping a little, fold lines showing.
  Skíðblaðnir: (b, tick) => {
    const v = new Vx(b);
    // Straps over the shoulders.
    for (const s of [-1, 1]) {
      const x = s > 0 ? 1.7 : -2.7;
      v.b(x, -7, 4, 1, 7.2, 0.5, LEATHER);
      v.b(x, -0.6, 3.9, 1, 0.6, 0.6, LEATHER);
    }
    // The hull, three stepped planks and posts at both ends; the prow a curled gold head.
    v.b(-3.2, -8.4, -4.6, 6.4, 1.0, 3.8, OAK_DARK);
    v.b(-4.4, -7.4, -4.8, 8.8, 1.1, 4.2, OAK);
    v.b(-5.2, -6.3, -5.0, 10.4, 1.0, 4.6, "#8a6240");
    v.b(-5.4, -5.5, -5.1, 10.8, 0.4, 4.8, OAK_DARK);
    v.b(5.0, -5.5, -4.0, 0.8, 3.2, 2.4, OAK_DARK);
    v.b(5.4, -2.5, -3.6, 0.8, 1.2, 1.6, OAK_DARK);
    v.b(5.8, -1.5, -3.4, 1.4, 1.4, 1.2, GOLD);
    v.b(6.4, -1.9, -3.2, 0.6, 0.5, 0.8, GOLD_DARK);
    v.b(-5.8, -5.5, -4.0, 0.8, 2.4, 2.4, OAK_DARK);
    v.b(-6.2, -3.4, -3.6, 0.8, 1.0, 1.6, OAK_DARK);
    // Round shields along the gunwale, on the outer side.
    const shields = [RED, BONE, WOAD, GOLD, RED, BONE, WOAD];
    for (let i = 0; i < 7; i++) {
      v.b(-4.8 + i * 1.4, -6.1, -5.45, 1.1, 1.1, 0.4, shields[i]!);
      v.b(-4.5 + i * 1.4, -5.8, -5.55, 0.5, 0.5, 0.25, STEEL);
    }
    // The mast, and its yard.
    v.b(-0.3, -5.1, -3.2, 0.7, 10.9, 0.7, OAK_DARK);
    v.b(-4.4, 4.7, -3.3, 8.8, 0.5, 0.5, OAK_DARK);
    v.b(-0.4, 5.7, -3.3, 0.9, 0.9, 0.9, GOLD);
    // The sail, hung from the yard: pleated into stripes of red and bone, creased across where it is folded.
    const sail = vpart(b, [0, 4.7 * U, -3.6 * U]);
    const sv = new Vx(sail);
    const pleats = 9;
    const flaps: { m: THREE.Mesh; k: number }[] = [];
    for (let i = 0; i < pleats; i++) {
      const x = -4.5 + i * 0.93;
      const col = i % 2 ? BONE : RED;
      const d = i % 2 ? -0.3 : 0.3;
      sv.b(x, -3.2, d - 0.15, 1.15, 3.2, 0.3, col);
      flaps.push({ m: sv.b(x, -7.8, d * 1.5 - 0.15, 1.15, 4.6, 0.3, col), k: i });
      // The folds: a darker crease across each pleat, where the cloth is folded up.
      for (const y of [-3.3, -5.6]) sv.b(x, y, d - 0.2, 1.15, 0.3, 0.4, i % 2 ? BONE_DARK : "#7a2a28");
    }
    tick((t, walking) => {
      sail.rotation.x = Math.sin(t * (walking ? 7 : 1.7)) * (walking ? 0.1 : 0.03);
      sail.rotation.z = Math.sin(t * (walking ? 5.5 : 1.2) + 1) * (walking ? 0.05 : 0.015);
      for (const f of flaps)
        f.m.position.z =
          (Math.sin(t * (walking ? 9 : 2.2) + f.k * 0.8) * 0.35 + (f.k % 2 ? -0.2 : 0.2)) * U +
          f.m.userData.z0;
    });
    for (const f of flaps) f.m.userData.z0 = f.m.position.z;
  },
};
Object.assign(BACK_BUILDERS, BACKS);
