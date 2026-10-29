/**
 * The pet store's furniture: pens, the cat condo, dragon terrariums, the fish tank, the petwear rack, glass
 * domes for the crown and the orb, the counter, the toy shelf and the door. Each is a `Model` centred on the
 * middle of its footprint (x right, z towards the camera); pets in them are the real `petFrom2D` models.
 */
import type * as THREE from "three";
import { C } from "../../art/palette.ts";
import { disposeObject } from "../engine/dispose.ts";
import { light } from "../furniture/furniture.ts";
import { glass, glow, Model, painted, tint } from "../kit/kit.ts";
import { panel } from "../kit/panel.ts";
import { type Pet3D, petFrom2D } from "../pets/pets3d.ts";
import { nightGlow } from "../town/props.ts";
import {
  animate,
  ball,
  bone,
  bowl,
  crownProp,
  cushion,
  fence,
  foodBag,
  live,
  type Mood,
  postSign,
  sparkles,
  speckle,
  squeakyDuck,
  type TagKind,
  tag,
  tin,
  toyMouse,
  yarn,
} from "./pets-parts.ts";

/** One pet on display: what to build and what its card says. */
export interface Entry {
  id: string;
  species: string;
  variant: string;
  title: string;
  line: string;
  kind: TagKind;
  mood?: Mood;
  wear?: number;
  crown?: boolean;
}
/** Tells the store where an item stands (fixture-local x, z). */
/** Files item `id` at (`x`, `z`) on the fixture, and the model that shows it, for the pointer to find. */
export type Reg = (id: string, x: number, z: number, shows?: THREE.Object3D) => void;

const WOOD = C.wood;
const WOOD_D = C.woodDark;
const WOOD_L = C.woodLight;

/** Pets built ahead, a slice at a time (`prebuildPet`), for the fixture that stands them up next. */
const pool = new Map<string, Pet3D[]>();
const poolKey = (e: Entry) => `${e.species}:${e.variant}`;

/** Release sculptures prepared for an unfinished fixture. */
export function dropPrebuiltPets(): void {
  for (const pets of pool.values()) for (const pet of pets) disposeObject(pet.root);
  pool.clear();
}

/** Builds `e`'s pet now, so a fixture built later takes it instead of building it then (the shop's warm slices). */
export function prebuildPet(e: Entry): void {
  const list = pool.get(poolKey(e)) ?? [];
  list.push(petFrom2D(e.species, e.variant));
  pool.set(poolKey(e), list);
}

/** Puts the pet of `e` at (x, y, z) on `m`, alive. */
function stand(
  m: Model,
  e: Entry,
  x: number,
  y: number,
  z: number,
  seed: number,
  turn = 0,
  scale = 1,
): THREE.Object3D {
  const p = pool.get(poolKey(e))?.pop() ?? petFrom2D(e.species, e.variant);
  p.wear = e.wear ?? 0;
  p.crown = !!e.crown;
  p.root.position.set(x, y, z);
  p.root.rotation.y = turn;
  p.root.scale.setScalar(scale);
  m.add(p.root);
  animate(p, seed, e.mood ?? "lively");
  return p.root;
}

/** Row-major spots for `n` things in `cols` columns across `w`×`d`; short rows are centred. */
function layout(n: number, cols: number, w: number, d: number, top = 0.55, bottom = 0.7): [number, number][] {
  const rows = Math.ceil(n / cols);
  const out: [number, number][] = [];
  for (let r = 0; r < rows; r++) {
    const inRow = Math.min(cols, n - r * cols);
    const step = (w - 1.2) / (cols - 1);
    const z = rows === 1 ? 0 : -d / 2 + top + (r * (d - top - bottom)) / (rows - 1);
    for (let c = 0; c < inRow; c++) {
      const x = (c - (inRow - 1) / 2) * step + (r % 2 ? 0.12 : -0.12);
      out.push([x, z]);
    }
  }
  return out;
}

// MARK: Pens

export interface PenOptions {
  w: number;
  d: number;
  entries: Entry[];
  reg: Reg;
  title: string;
  sub: string;
  accent: string;
  cols: number;
  seed: number;
  floor?: [string, string];
  pond?: boolean;
  bamboo?: boolean;
}

/** A fenced pen on straw with its pets, a card in front of each, and a sign. */
export function petPen(o: PenOptions): Model {
  const { w, d } = o;
  const m = new Model();
  const [base, fleck] = o.floor ?? ["#e6cf8e", "#c9a95a"];
  const tex = speckle(base, fleck, w, d, o.seed * 77 + 5);
  m.box([w, 0.07, d], painted(tex), [0, 0, 0], 0.01);
  fence(m, w, d, WOOD_L, 0.5);
  const spots = layout(o.entries.length, o.cols, w, d);
  if (o.pond) {
    // A pond in the left half, ducks afloat in it.
    const pw = w * 0.4;
    const pd = d * 0.34;
    m.cyl(1, 0.05, "#9c7a52", [-w * 0.2, 0.07, -d * 0.04], 1, 24).scale.set(pw / 2 + 0.09, 1, pd / 2 + 0.09);
    const water = m.cyl(1, 0.04, glass("#58a9e2", 0.92), [-w * 0.2, 0.09, -d * 0.04], 1, 24);
    water.scale.set(pw / 2, 1, pd / 2);
    const water2 = m.cyl(1, 0.012, glass("#a8dcf7", 0.5), [-w * 0.2, 0.135, -d * 0.04], 1, 24);
    water2.scale.set(pw / 2 - 0.1, 1, pd / 2 - 0.1);
    live(m, (t) =>
      water2.scale.set(pw / 2 - 0.1 + Math.sin(t * 1.3) * 0.03, 1, pd / 2 - 0.1 + Math.cos(t * 1.1) * 0.02),
    );
    for (const [x, z] of [
      [-w * 0.2 - pw * 0.5 - 0.1, d * 0.1],
      [-w * 0.2 + pw * 0.46, -d * 0.2],
    ] as const)
      m.ball(0.16, C.stone, [x, 0.1, z], [1.2, 0.6, 1], 6);
  }
  if (o.bamboo) {
    const rnd = (i: number) => ((i * 9301 + 49297) % 233280) / 233280;
    for (let i = 0; i < 16; i++) {
      const x = -w / 2 + 0.3 + rnd(i) * 1.6 + (i % 2 ? w - 2.2 : 0);
      const z = -d / 2 + 0.22 + rnd(i + 20) * 0.35;
      const h = 1.1 + rnd(i + 40) * 0.8;
      m.cyl(0.035, h, "#7cc45a", [x, 0.06, z], 0.03, 6);
      for (let k = 1; k < h / 0.3; k++) m.cyl(0.04, 0.02, "#4f8f3a", [x, 0.06 + k * 0.3, z], 0.04, 6);
      m.ball(0.12, "#5fb84f", [x + 0.05, 0.06 + h, z], [1.4, 0.4, 0.7], 6).rotation.z = 0.4;
    }
    m.box([0.9, 0.16, 0.2], "#8a5a38", [w * 0.28, 0.07, -d * 0.18], 0.06);
  }
  o.entries.forEach((e, i) => {
    let [x, z] = spots[i]!;
    let y = 0.07;
    if (o.pond) {
      // Ducks in the pond: the first four afloat, the rest on the bank.
      const water = [
        [-w * 0.3, -d * 0.12],
        [-w * 0.1, -d * 0.1],
        [-w * 0.24, d * 0.04],
        [-w * 0.34, d * 0.1],
      ][i];
      const bank = [
        [w * 0.1, -d * 0.2],
        [w * 0.3, -d * 0.12],
        [w * 0.2, d * 0.12],
      ][i - 4];
      [x, z] = (water ?? bank ?? [x, z]) as [number, number];
      if (water) y = 0.1;
    }
    const turn = Math.sin(i * 2.7) * 0.7;
    const pet = stand(m, e, x, y, z, o.seed + i, turn);
    if (o.pond && i < 4) {
      live(pet, (t) => (pet.position.y = y + Math.sin(t * 1.8 + i) * 0.012));
    }
    const t = tag(e.title, e.line, e.kind, { w: 0.48, accent: o.accent, lift: 0.07, lean: -0.55 });
    t.position.set(x + 0.04, 0, z + 0.46);
    m.add(t);
    o.reg(e.id, x, z, pet);
  });
  // A bone and a ball lying about.
  if (!o.pond && !o.bamboo) {
    bone(m, w / 2 - 0.45, 0.07, d / 2 - 0.25, 0.4);
    ball(m, -w / 2 + 0.35, 0.07, d / 2 - 0.3);
  }
  if (o.pond) squeakyDuck(m, w / 2 - 0.4, 0.07, d / 2 - 0.25, 0.6);
  const sign = postSign(o.title, o.sub, o.accent, 1.5);
  sign.position.set(-w / 2 + 0.95, 0, -d / 2 - 0.02);
  m.add(sign);
  // A hanging bowl pair in a corner.
  const b1 = bowl(o.bamboo ? "kibble" : "kibble");
  b1.position.set(w / 2 - 0.4, 0.07, -d / 2 + 0.35);
  m.add(b1);
  const b2 = bowl("water");
  b2.position.set(w / 2 - 0.8, 0.07, -d / 2 + 0.35);
  m.add(b2);
  return m;
}

// MARK: Cat condo

const CUSHIONS = ["#e8a0b4", "#a0c4e8", "#c8b0e8", "#f0d080", "#a0d8b0", "#f0a888"];

/** Three tiers of cubbies against the wall, a cat in each, on cushions: 6×1 tiles. */
export function catCondo(entries: Entry[], reg: Reg): Model {
  const m = new Model();
  const W = 6;
  const H = 2.55;
  m.box([W - 0.02, H - 0.01, 0.06], WOOD, [0, 0.004, -0.466], 0.01);
  for (const s of [-1, 1]) m.box([0.1, H, 1], WOOD_D, [s * (W / 2 - 0.05), 0, 0], 0.02);
  m.box([W + 0.1, 0.12, 1.08], WOOD_D, [0, H - 0.02, 0.0], 0.02);
  const tiers = [0, 0.86, 1.72];
  tiers.forEach((y, ti) => {
    m.box([W - 0.2, 0.08, 1], WOOD_L, [0, y, 0.0], 0.015);
    for (const x of [-1, 1]) m.box([0.06, 0.74, 0.9], WOOD_D, [x, y + 0.08, 0.04], 0.01);
    // Perch rail on the front of each cubby.
    m.box([W - 0.3, 0.035, 0.035], "#c9a96a", [0, y + 0.2, 0.5], 0.01);
    [-2, 0, 2].forEach((cx, ci) => {
      m.box([1.55, 0.07, 0.72], CUSHIONS[(ti * 3 + ci) % CUSHIONS.length]!, [cx, y + 0.08, -0.05], 0.03);
    });
  });
  // Posts wrapped in rope up one side.
  m.cyl(0.08, H - 0.1, "#d8c090", [-W / 2 + 0.22, 0.05, 0.34], 0.08, 8);
  for (let y = 0.15; y < H - 0.2; y += 0.12)
    m.cyl(0.088, 0.025, "#a8905a", [-W / 2 + 0.22, y, 0.34], 0.088, 8);
  let n = 0;
  tiers.forEach((y) => {
    [-2, 0, 2].forEach((cx) => {
      const e = entries[n];
      if (!e) {
        // The last cubby holds the toys: a plush fish, a mouse and a ball of wool.
        const fish = m.part([cx, y + 0.15, 0.0], 0.3);
        fish.ball(0.12, "#f0a05a", [0, 0.1, 0], [1.8, 0.8, 0.8], 8);
        fish.box([0.012, 0.1, 0.1], "#f0a05a", [-0.28, 0.06, 0], 0.01);
        toyMouse(m, cx + 0.5, y + 0.15, 0.2, 0.5);
        yarn(m, cx - 0.55, y + 0.15, 0.1, "#6d7fc4");
        return;
      }
      const pet = stand(m, e, cx, y + 0.15, -0.03, 31 + n, Math.sin(n * 1.9) * 0.35, 1);
      const t = tag(e.title, e.line, e.kind, { w: 0.58, accent: "#e0788f", lean: -0.3, lift: 0.0 });
      t.position.set(cx + 0.62, y + 0.1, 0.46);
      m.add(t);
      reg(e.id, cx, 0, pet);
      n++;
    });
  });
  const lamp = m.ball(0.05, glow("#fff1c9"), [0, H - 0.1, 0.52], [1, 1, 1], 6);
  nightGlow(lamp, "#ffe9b0");
  light(m, [0, 1.6, 1.0], "#ffd9b0", 2.2, 6);
  return m;
}

// MARK: Dragon terrariums

interface Theme {
  floor: string;
  glow: string;
  deco: (t: Model) => void;
}
const crystals = (t: Model, c: string) => {
  for (const [x, z, h] of [
    [-0.28, -0.2, 0.34],
    [-0.18, -0.28, 0.22],
    [0.3, -0.22, 0.3],
    [0.22, 0.28, 0.16],
  ] as const)
    t.cyl(0.07, h, glass(c, 0.85), [x, 0, z], 0.01, 5);
};
const THEMES: Record<string, Theme> = {
  "": {
    floor: "#7a8a5a",
    glow: "#ffd98a",
    deco: (t) => {
      t.cyl(0.03, 0.7, "#6b4a30", [-0.3, 0, -0.3], 0.03, 5).rotation.z = -0.5;
      t.ball(0.14, "#4f9b3d", [0.3, 0.12, -0.3], [1.3, 0.8, 1], 6);
      t.ball(0.1, "#72bf52", [0.38, 0.2, -0.22], [1, 0.8, 1], 6);
    },
  },
  red: {
    floor: "#6b3a2a",
    glow: "#ff7a3a",
    deco: (t) => {
      for (const [x, z] of [
        [-0.3, -0.25],
        [0.28, -0.3],
        [0.3, 0.2],
      ] as const) {
        t.ball(0.13, "#3b2a26", [x, 0.06, z], [1.2, 0.8, 1], 6);
        t.ball(0.045, glow("#ff7a3a"), [x, 0.14, z + 0.05], [1, 0.6, 1], 5);
      }
    },
  },
  ice: { floor: "#dcefff", glow: "#bfe6ff", deco: (t) => crystals(t, "#8fd0f5") },
  gold: {
    floor: "#e8c46a",
    glow: "#ffd96a",
    deco: (t) => {
      for (let i = 0; i < 9; i++)
        t.cyl(
          0.07,
          0.03,
          "#f5c842",
          [-0.3 + (i % 3) * 0.1, i > 5 ? 0.05 : i > 2 ? 0.025 : 0, 0.25 - Math.floor(i / 3) * 0.02],
          0.07,
          8,
        );
      t.box([0.18, 0.12, 0.12], "#8c5c36", [0.3, 0, -0.3], 0.02);
    },
  },
  shadow: {
    floor: "#3b3050",
    glow: "#9b6fd6",
    deco: (t) => {
      crystals(t, "#9b6fd6");
      t.ball(0.18, glass("#6d4fc4", 0.25), [0.0, 0.25, 0.1], [1.6, 0.6, 1.2], 8);
    },
  },
  skeleton: {
    floor: "#d8d0c0",
    glow: "#e8e2d4",
    deco: (t) => {
      for (let i = 0; i < 4; i++)
        t.cyl(0.03, 0.34, "#f4ead2", [-0.3 + i * 0.08, 0, -0.3], 0.025, 5).rotation.z = 0.7 - i * 0.2;
      t.ball(0.07, "#f4ead2", [0.3, 0.07, 0.25], [1, 0.9, 1.1], 7);
    },
  },
  baby: {
    floor: "#a5d977",
    glow: "#ffe28a",
    deco: (t) => {
      t.cyl(0.3, 0.06, "#c9a95a", [0, 0, 0.0], 0.34, 12);
      for (const [x, z] of [
        [-0.32, -0.3],
        [0.3, -0.28],
      ] as const)
        t.ball(0.08, "#f4efe4", [x, 0.08, z], [1, 1.2, 1], 8);
    },
  },
};

/** Seven glass terrariums on a long cabinet, a dragon in each: 7×1 tiles. */
export function terrariums(entries: Entry[], reg: Reg): Model {
  const m = new Model();
  m.box([7, 0.42, 1], WOOD_D, [0, 0, 0], 0.02);
  m.box([7.1, 0.05, 1.06], WOOD_L, [0, 0.42, 0], 0.02);
  entries.forEach((e, i) => {
    const cx = i - 3;
    const th = THEMES[e.variant] ?? THEMES[""]!;
    const g = m.part([cx, 0.47, 0]);
    g.box([0.92, 0.05, 0.9], th.floor, [0, 0, 0], 0.01);
    th.deco(g);
    // Glass: four panes in a dark frame, a hood with the heat lamp above.
    g.box([0.94, 0.78, 0.92], glass("#cfe8f0", 0.08), [0, 0.05, 0], 0.01);
    for (const sx of [-1, 1])
      for (const sz of [-1, 1]) g.box([0.04, 0.83, 0.04], "#3c4454", [sx * 0.47, 0, sz * 0.46], 0.008);
    for (const sz of [-1, 1]) g.box([0.98, 0.04, 0.04], "#3c4454", [0, 0.83, sz * 0.46], 0.008);
    for (const sx of [-1, 1]) g.box([0.04, 0.04, 0.9], "#3c4454", [sx * 0.47, 0.83, 0], 0.008);
    g.box([0.9, 0.03, 0.04], "#3c4454", [0, 0.83, -0.3], 0.008);
    g.cyl(0.12, 0.1, "#5d6470", [0, 0.72, -0.3], 0.05, 10);
    nightGlow(g.ball(0.05, "#f4e6c0", [0, 0.7, -0.3], [1, 1, 1], 8), th.glow);
    // The glow of the lamp on the floor, lit at night.
    const pool = g.cyl(0.38, 0.01, glass(th.glow, 0.2), [0, 0.06, 0], 0.38, 14);
    live(pool, () => {});
    if (i === 1 || i === 3 || i === 5) light(g, [0, 0.8, 0.2], th.glow, 1.6, 3.4);
    const pet = stand(g, e, 0, 0.08, 0.05, 71 + i, Math.sin(i * 1.3) * 0.5, 1.1);
    const t = tag(e.title, e.line, e.kind, { w: 0.62, accent: "#d2573c", lean: 0, lift: 0.06 });
    t.position.set(cx, 0, 0.51);
    m.add(t);
    reg(e.id, cx, 0, pet);
  });
  return m;
}

// MARK: Fish tank

/** A long aquarium on a cabinet against the west wall, goldfish circling: 4×1 tiles (turned to run along z). */
export function fishTank(): Model {
  const m = new Model();
  const W = 4;
  const D = 0.9;
  m.box([W - 0.1, 0.62, D - 0.1], WOOD_D, [0, 0, 0], 0.02);
  m.box([W, 0.06, D], WOOD_L, [0, 0.62, 0], 0.02);
  const y0 = 0.68;
  const H = 1.05;
  m.box([W - 0.14, 0.1, D - 0.14], "#e8d2a0", [0, y0, 0], 0.02);
  // Water and glass.
  const water = m.box([W - 0.14, H - 0.108, D - 0.14], glass("#58a9e2", 0.38), [0, y0 + 0.1, 0], 0.01);
  water.renderOrder = 2;
  m.box([W - 0.1, H, D - 0.1], glass("#d8f0fa", 0.14), [0, y0, 0], 0.01).renderOrder = 3;
  for (const sx of [-1, 1])
    for (const sz of [-1, 1])
      m.box([0.05, H + 0.05, 0.05], "#2b2433", [sx * (W / 2 - 0.04), y0, sz * (D / 2 - 0.04)], 0.01);
  m.box([W + 0.02, 0.05, 0.1], "#2b2433", [0, y0 + H, -D / 2 + 0.05], 0.01);
  m.box([W - 0.3, 0.05, 0.08], glow("#cfe9ff"), [0, y0 + H - 0.04, 0.2], 0.01);
  nightGlow(m.box([W - 0.4, 0.044, 0.1], "#e8f4ff", [0, y0 + H - 0.04, -0.2], 0.01), "#bfe6ff");
  // Plants, a castle and rocks.
  const weeds: THREE.Object3D[] = [];
  for (const [x, c, h] of [
    [-1.6, "#4f9b3d", 0.6],
    [-1.4, "#72bf52", 0.4],
    [0.4, "#3a7b2f", 0.7],
    [1.7, "#4f9b3d", 0.5],
    [1.4, "#e0788f", 0.38],
    [-0.4, "#72bf52", 0.5],
  ] as const) {
    const w = m.part([x, y0 + 0.1, -0.22 + (x % 0.5) * 0.3]);
    w.box([0.1, h, 0.04], c, [0, 0, 0], 0.02);
    w.box([0.08, h * 0.7, 0.04], tint(c, 0.15), [0.07, 0, 0.03], 0.02);
    weeds.push(w);
  }
  const castle = m.part([1.0, y0 + 0.1, 0.05]);
  castle.box([0.34, 0.26, 0.26], "#c9a0e0", [0, 0, 0], 0.02);
  for (const sx of [-1, 1]) castle.cyl(0.07, 0.38, "#a880c8", [sx * 0.17, 0, 0.1], 0.07, 8);
  castle.box([0.1, 0.16, 0.05], "#2b2433", [0, 0, 0.14], 0.01);
  for (const [x, z, r] of [
    [-0.9, 0.1, 0.12],
    [-0.1, -0.2, 0.1],
    [0.1, 0.25, 0.09],
  ] as const)
    m.ball(r, "#8a8682", [x, y0 + 0.14, z], [1.2, 0.7, 1], 6);
  // Goldfish: the real pet, three of them circling.
  const fish = [0, 1, 2].map((i) => {
    const p = petFrom2D("goldfish");
    p.root.scale.setScalar(0.9);
    p.moving = true;
    m.add(p.root);
    return { p, i };
  });
  live(m, (t) => {
    for (const { p, i } of fish) {
      const a = t * (0.22 + i * 0.05) + i * 2.1;
      const x = Math.cos(a) * (1.5 - i * 0.2);
      const z = Math.sin(a * 1.7) * 0.2;
      p.root.position.set(x, y0 + 0.45 + i * 0.12 + Math.sin(t * 0.7 + i) * 0.05, z);
      const rate = 0.22 + i * 0.05;
      const r = 1.5 - i * 0.2;
      p.root.rotation.y = Math.atan2(-Math.sin(a) * r * rate, Math.cos(a * 1.7) * 0.34 * rate);
      p.update(t);
    }
    weeds.forEach((w, k) => {
      w.rotation.z = Math.sin(t * 1.2 + k) * 0.08;
    });
  });
  // Bubbles rise from a stone.
  const bubbles = Array.from({ length: 7 }, () =>
    m.ball(0.022, glass("#ffffff", 0.7), [0, 0, 0], [1, 1, 1], 6),
  );
  live(m, (t) =>
    bubbles.forEach((b, i) => {
      const u = (t * 0.35 + i / 7) % 1;
      b.position.set(-0.7 + Math.sin(u * 9 + i) * 0.04, y0 + 0.15 + u * (H - 0.3), 0.1);
    }),
  );
  light(m, [0, y0 + 0.7, 0.4], "#7fd0ff", 2.2, 4.5);
  // Its card: the goldfish is boss loot, never sold.
  const t = tag("Goldfish", "Context-window loot", "info", { w: 0.9, accent: "#58a9e2", lean: -0.2 });
  t.position.set(-1.0, 0, D / 2 + 0.02);
  m.add(t);
  return m;
}

// MARK: Petwear rack

/** A two-step stand against the wall with the seven pieces of pet gear, each worn by a pet: 5×1 tiles. */
export function wearRack(entries: Entry[], reg: Reg): Model {
  const m = new Model();
  const W = 5;
  m.box([W - 0.02, 2.29, 0.06], WOOD, [0, 0.004, -0.466], 0.01);
  m.box([W + 0.1, 0.1, 0.12], WOOD_D, [0, 2.2, -0.45], 0.02);
  // The steps: a high one at the back, a low one in front, both with a red felt top.
  m.box([W - 0.1, 0.6, 0.5], WOOD_D, [0, 0, -0.22], 0.02);
  m.box([W - 0.14, 0.04, 0.46], "#a3243b", [0, 0.6, -0.22], 0.01);
  m.box([W - 0.1, 0.3, 0.5], WOOD_L, [0, 0, 0.25], 0.02);
  m.box([W - 0.14, 0.04, 0.46], "#c53a52", [0, 0.3, 0.25], 0.01);
  const board = panel(
    3.2,
    0.4,
    (g, cw, ch) => {
      g.fillStyle = "#2b2433";
      g.fillRect(0, 0, cw, ch);
      g.fillStyle = "#ffe28a";
      g.font = `900 ${Math.round(ch * 0.6)}px system-ui, sans-serif`;
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.fillText("PET GEAR", cw / 2, ch / 2, cw - 20);
    },
    { frame: WOOD_D, px: 90, smooth: true, lift: 1.5 },
  );
  board.position.z = -0.4;
  m.add(board);
  // Spare collars and bows hung on pegs under the sign.
  ["#e0584f", "#4f8fe0", "#f5c842", "#3ddc84", "#e0788f", "#9b6fd6"].forEach((c, i) => {
    const x = -2.1 + i * 0.84;
    m.cyl(0.015, 0.05, WOOD_D, [x, 1.2, -0.42], 0.015, 5).rotation.x = Math.PI / 2;
    const ring = m.cyl(0.1, 0.045, c, [x, 1.0, -0.4], 0.1, 14);
    ring.rotation.x = Math.PI / 2;
  });
  const spots: [number, number, number][] = [
    [-1.8, 0.64, -0.22],
    [-0.6, 0.64, -0.22],
    [0.6, 0.64, -0.22],
    [1.8, 0.64, -0.22],
    [-1.2, 0.34, 0.27],
    [0, 0.34, 0.27],
    [1.2, 0.34, 0.27],
  ];
  entries.forEach((e, i) => {
    const [x, y, z] = spots[i]!;
    const pet = stand(m, { ...e, mood: "sit" }, x, y, z, 91 + i, Math.sin(i * 2.2) * 0.4, 0.95);
    const back = i < 4;
    const t = tag(e.title, e.line, e.kind, { w: 0.52, accent: "#6d4fc4", lean: -0.5 });
    t.position.set(x + 0.05, back ? 0.34 : 0.0, back ? 0.4 : 0.7);
    m.add(t);
    reg(e.id, x, 0, pet);
  });
  return m;
}

// MARK: Domes (the crown and the orb)

/** A pedestal under a glass dome, stood on a 1×1 tile. */
export function dome(inner: (m: Model) => void, title: string, line: string, glowColor: string): Model {
  const m = new Model();
  m.cyl(0.4, 0.1, C.stoneDark, [0, 0, 0], 0.4, 18);
  m.cyl(0.3, 0.55, C.stoneLight, [0, 0.1, 0], 0.26, 18);
  m.cyl(0.36, 0.06, "#e0a82e", [0, 0.65, 0], 0.36, 18);
  inner(m);
  const gl = m.ball(0.4, glass("#e8f6ff", 0.2), [0, 1.0, 0], [1, 1.1, 1], 16);
  gl.renderOrder = 3;
  m.cyl(0.4, 0.04, "#e0a82e", [0, 0.68, 0], 0.4, 18);
  light(m, [0, 1.5, 0.3], glowColor, 1.8, 3.5);
  const t = tag(title, line, "level", { w: 0.62, accent: glowColor, lean: -0.1, lift: 0.0 });
  t.position.set(0, 0.11, 0.42);
  m.add(t);
  return m;
}

/** The Lv50 pet crown on a velvet cushion, sparkling. */
export function crownDome(): Model {
  return dome(
    (m) => {
      const c = cushion(0.28);
      c.position.set(0, 0.68, 0);
      m.add(c);
      const cr = crownProp(1.15);
      cr.position.set(0, 0.8, 0);
      m.add(cr);
      live(cr, (t) => (cr.rotation.y = t * 0.6));
      sparkles(m, [0, 1.05, 0], 0.22, 5);
    },
    "Pet crown",
    "Lv 50",
    "#ffd96a",
  );
}

// MARK: Counter, shelf and door

/** The counter with its till, a bell and a jar of biscuits: 5×1 tiles. */
export function counter(): Model {
  const m = new Model();
  const W = 5;
  m.box([W, 0.7, 0.9], WOOD, [0, 0, 0.0], 0.03);
  m.box([W + 0.2, 0.08, 1.1], WOOD_L, [0, 0.7, 0], 0.02);
  m.box([W - 0.3, 0.04, 0.04], WOOD_D, [0, 0.12, 0.46], 0.01);
  // Painted front: a row of paw prints on teal.
  const front = panel(
    W - 0.4,
    0.5,
    (g, cw, ch) => {
      g.fillStyle = "#3fa7a0";
      g.fillRect(0, 0, cw, ch);
      g.fillStyle = "#2f8a84";
      const paw = (x: number, y: number, s: number) => {
        g.beginPath();
        g.ellipse(x, y + s * 0.35, s * 0.55, s * 0.45, 0, 0, Math.PI * 2);
        g.fill();
        for (const dx of [-0.6, -0.2, 0.2, 0.6]) {
          g.beginPath();
          g.ellipse(
            x + dx * s,
            y - s * (0.2 + (Math.abs(dx) < 0.3 ? 0.15 : 0)),
            s * 0.2,
            s * 0.27,
            0,
            0,
            Math.PI * 2,
          );
          g.fill();
        }
      };
      for (let i = 0; i < 6; i++) paw(cw * (0.1 + i * 0.16), ch * (i % 2 ? 0.62 : 0.4), ch * 0.2);
      g.fillStyle = "#fff6df";
      g.font = `900 ${Math.round(ch * 0.2)}px system-ui, sans-serif`;
      g.textAlign = "center";
      g.fillText("EVERY PET HAS A HOME", cw / 2, ch * 0.88);
    },
    { frame: WOOD_D, lift: 0.07, px: 70, smooth: true },
  );
  front.position.z = 0.46;
  m.add(front);
  // The till.
  const till = m.part([-1.4, 0.78, -0.1], 0.2);
  till.box([0.46, 0.14, 0.4], "#4a4f63", [0, 0, 0], 0.03);
  const scr = till.box([0.34, 0.2, 0.04], "#2b2433", [0, 0.1, -0.1], 0.01);
  scr.rotation.x = -0.25;
  const disp = till.plane(0.28, 0.14, glow("#8fe0a8"), [0, 0.2, -0.065]);
  disp.rotation.x = -0.25;
  for (let i = 0; i < 6; i++)
    till.box(
      [0.06, 0.02, 0.05],
      i % 2 ? "#e8e2d4" : "#c4cad4",
      [-0.15 + (i % 3) * 0.075, 0.14, 0.08 - Math.floor(i / 3) * 0.07],
      0.005,
    );
  // The bell.
  m.cyl(0.07, 0.03, "#e0a82e", [-0.5, 0.78, 0.15], 0.07, 12);
  m.cyl(0.055, 0.06, "#f5c842", [-0.5, 0.81, 0.15], 0.012, 12);
  // A jar of biscuits.
  m.cyl(0.13, 0.28, glass("#d8f0fa", 0.4), [1.4, 0.78, 0.1], 0.13, 14);
  for (let i = 0; i < 9; i++)
    bone(m, 1.4 + Math.cos(i * 2.1) * 0.05, 0.8 + (i % 4) * 0.055, 0.1 + Math.sin(i * 2.1) * 0.05, i);
  m.cyl(0.14, 0.04, "#e0584f", [1.4, 1.06, 0.1], 0.14, 14);
  // A plant and a little sign.
  m.cyl(0.09, 0.12, "#c4544b", [2.1, 0.78, 0.1], 0.07, 10);
  for (let i = 0; i < 5; i++)
    m.ball(
      0.07,
      "#5fb84f",
      [2.1 + Math.cos(i * 1.3) * 0.07, 0.96 + (i % 2) * 0.05, 0.1 + Math.sin(i * 1.3) * 0.06],
      [1, 1.3, 0.5],
      6,
    );
  const memo = panel(
    0.7,
    0.3,
    (g, cw, ch) => {
      g.fillStyle = "#fff6df";
      g.fillRect(0, 0, cw, ch);
      g.fillStyle = "#2b2433";
      g.font = `800 ${Math.round(ch * 0.3)}px system-ui, sans-serif`;
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.fillText("Please ask", cw / 2, ch * 0.32);
      g.fillText("to hold one!", cw / 2, ch * 0.72);
    },
    { frame: WOOD_D, px: 90, smooth: true },
  );
  memo.position.set(0.5, 0.78, 0.18);
  m.add(memo);
  light(m, [0, 1.8, 0.1], "#ffd9a0", 2, 5);
  return m;
}

/** A wall shelf of toys, treats and food, on the west wall: 3×1 tiles (turned to run along z). */
export function toyShelf(): Model {
  const m = new Model();
  const W = 3;
  m.box([W, 2.1, 0.06], WOOD, [0, 0, -0.47], 0.01);
  for (const s of [-1, 1]) m.box([0.08, 2.1, 0.9], WOOD_D, [s * (W / 2 - 0.04), 0, 0], 0.02);
  const ys = [0.0, 0.62, 1.24, 1.84];
  for (const y of ys) m.box([W - 0.1, 0.06, 0.9], WOOD_L, [0, y, 0.0], 0.012);
  // Bottom: bags of food.
  ["#e0584f", "#4f8fe0", "#58b36a", "#f0b53c", "#9b6fd6", "#e0788f"].forEach((c, i) => {
    foodBag(m, -1.25 + i * 0.5, 0.06, 0.0 + (i % 2) * 0.04, c);
  });
  // Treats and tins.
  ["#e0584f", "#4f8fe0", "#58b36a", "#f0b53c", "#9b6fd6", "#3fa7a0", "#f28bb2", "#e8e2d4", "#c4544b"].forEach(
    (c, i) => {
      tin(m, -1.3 + i * 0.32, ys[1]! + 0.06, -0.15 + (i % 2) * 0.22, c);
    },
  );
  // Toys.
  for (let i = 0; i < 4; i++)
    ball(m, -1.2 + i * 0.16, ys[2]! + 0.06, 0.25, ["#d6e64a", "#e0584f", "#4f8fe0", "#f5c842"][i]);
  for (let i = 0; i < 3; i++) bone(m, -0.45 + i * 0.28, ys[2]! + 0.06, 0.1 + (i % 2) * 0.12, i * 0.5);
  for (let i = 0; i < 3; i++) squeakyDuck(m, 0.5 + i * 0.22, ys[2]! + 0.06, 0.1, 0.3 * i);
  toyMouse(m, 1.2, ys[2]! + 0.06, 0.25, 0.5);
  yarn(m, -0.5, ys[2]! + 0.06, -0.2, "#e0584f");
  yarn(m, -0.3, ys[2]! + 0.06, -0.2, "#4f8fe0");
  // Top: leashes and a feather wand on hooks.
  for (let i = 0; i < 6; i++) {
    const x = -1.3 + i * 0.5;
    m.box(
      [0.02, 0.4, 0.02],
      ["#e0584f", "#4f8fe0", "#f5c842", "#3ddc84", "#9b6fd6", "#e0788f"][i]!,
      [x, ys[3]! - 0.5, -0.4],
      0.005,
    );
    m.box([0.05, 0.05, 0.05], "#5d6470", [x, ys[3]! - 0.12, -0.4], 0.005);
  }
  return m;
}
