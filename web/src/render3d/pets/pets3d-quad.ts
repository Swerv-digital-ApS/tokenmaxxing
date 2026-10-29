/**
 * The four-legged pets as voxel sculptures: cats, the 13 dog breeds (plus the plain dog), pandas and the
 * forked cat. One parametric builder (`buildQuad`) turns a `QSpec` into a body, legs, head, ears and tails;
 * each breed is a spec of its own (proportions, snout, ears, tail, coat), so they differ in silhouette
 * as well as colour. Colouring is a function of the part and of where the cell is on it.
 */
import * as THREE from "three";
import type { Species } from "../data/pets.ts";
import { light } from "../furniture/furniture.ts";
import { Model, type V3 } from "../kit/kit.ts";
import { bake, type Cell, darken, eye, Grid, hash, lighten, mix, noise, type Rig, VOX } from "./petvox.ts";

export type Part = "body" | "neck" | "leg" | "paw" | "head" | "snout" | "ear" | "earIn" | "tail";
export type Coat = (part: Part, c: Cell) => string;

type EarKind = "point" | "bat" | "floppy" | "round" | "rose";
interface EarSpec {
  kind: EarKind;
  /** Base width, height and thickness in cells. */
  w: number;
  h: number;
  th: number;
  /** Where the base sits: x from the middle, z along the skull, and how far below its top. */
  x: number;
  z: number;
  drop?: number;
  /** Leans outwards by this many cells over its height. */
  lean?: number;
}

interface TailSpec {
  /** Points from the base (back is -z), in cells. */
  pts: V3[];
  r0: number;
  r1: number;
  pow?: number;
  /** Where it joins, as a height fraction of the body. */
  at?: number;
  /** Fuzz on the tail. */
  fluff?: number;
  /** Colour override by t along the tail. */
  col?: (t: number, base: string) => string;
}

export interface QSpec {
  /** Hip-to-shoulder distance between leg axes, body width, height, leg height and width, all in cells. */
  zF: number;
  W: number;
  H: number;
  lh: number;
  lw: number;
  /** Body overhang behind the hind legs and ahead of the fore legs. */
  ov?: [number, number];
  /** Extra depth at the chest; belly tuck-up at the rear (0 to 1). */
  chest?: number;
  tuck?: number;
  /** A longer neck: cells of rise and of reach. */
  neckUp?: number;
  neckFwd?: number;
  /** The skull and the snout. */
  hw: number;
  hh: number;
  hl: number;
  sn: { l: number; w: number; h: number; up?: number } | null;
  /** The nose: width in cells and its colour; whether it sticks out past the snout. */
  nose: string;
  noseW?: number;
  noseH?: number;
  /** Eyes: spread from the middle, height on the head, colour rows, wide and tall. */
  eyeGap: number;
  eyeY: number;
  eyeRows: string[][];
  ear: EarSpec | null;
  tail: TailSpec | TailSpec[];
  coat: Coat;
  /** Fuzz (0 to 1) on the body, legs and head. */
  fluff?: { body?: number; leg?: number; head?: number; seed?: number };
  tongue?: string;
  pawH?: number;
  /** Own touches: gets the grids to paint more into. */
  extra?: (c: Extras) => void;
  /** A custom head instead of the usual skull and snout (the pumpkin). */
  pumpkin?: boolean;
}

export interface Extras {
  body: Grid;
  head: Grid;
  s: QSpec;
  /** Body ellipsoid: centre y, half height, centre z, half length. */
  cy: number;
  ry: number;
  cz: number;
  rz: number;
  skull: { cy: number; top: number };
  snoutFront: number;
  headGroup: Model;
  bodyGroup: Model;
  /** Own light, if the pet glows. */
  lit?: typeof light;
}

const SIDES = [-1, 1] as const;
const DARK = "#14101c";
const GLINT = "#f4f6ff";
export const dogEye = (c = DARK): string[][] => [
  [c, GLINT],
  [c, c],
];

// MARK: Ears and tails

function earGrid(e: EarSpec, outer: (c: Cell) => string, inner: (c: Cell) => string): Grid {
  const g = new Grid();
  const lean = e.lean ?? 1;
  const paint = (x: number, y: number, z: number, front: boolean, k: number, w: number) => {
    const cell = { x, y, z, u: z / Math.max(1, e.th), t: k, s: x, c: "" };
    g.set(x, y, z, front && w >= 3 ? inner(cell) : outer(cell));
  };
  if (e.kind === "point" || e.kind === "bat") {
    for (let k = 0; k < e.h; k++) {
      const f = k / e.h;
      const w = Math.max(
        1,
        Math.round(e.w * (e.kind === "bat" ? Math.sqrt(1 - f * f * 0.85) : 1 - f * 0.92)),
      );
      const cx = (lean * k) / e.h;
      const th = Math.max(1, e.th - Math.floor(f * e.th * 0.6));
      for (let i = 0; i < w; i++)
        for (let z = 0; z < th; z++)
          paint(Math.round(cx - (w - 1) / 2 + i), k, z, z === th - 1 && th > 1, k, w);
    }
  } else if (e.kind === "floppy" || e.kind === "rose") {
    const flare = e.kind === "rose" ? 0.5 : (lean * e.h) / 3;
    for (let k = 0; k < e.h; k++) {
      const f = k / e.h;
      const w = Math.max(2, Math.round(e.w * (1 - f * 0.35)));
      const th = Math.max(2, Math.round(e.th * (1 - f * 0.35)));
      const cx = Math.round(flare * f);
      for (let i = 0; i < w; i++)
        for (let z = 0; z < th; z++)
          paint(cx + i, -k, z - (e.kind === "rose" ? 0 : Math.round(f * 1.5)), false, k, w);
    }
  } else {
    const r = e.w / 2;
    g.ell(0, e.h / 2, 0, r, e.h / 2, e.th / 2, (c) => outer({ ...c, u: 0.5 }), 2.2);
  }
  return g;
}

function tailGrid(t: TailSpec, coat: Coat): Grid {
  const g = new Grid();
  g.tube(
    t.pts,
    t.r0,
    t.r1,
    (c) => {
      const base = coat("tail", { ...c, u: c.u });
      return t.col ? t.col(c.u, base) : base;
    },
    t.pow ?? 2.2,
  );
  if (t.fluff) g.fluff(t.fluff, 31, 0.08);
  return g;
}

// MARK: The builder

/** Cells to units. */
const U = (n: number) => n * VOX;

export function buildQuad(
  s: QSpec,
  species: Species,
  special?: Extras["lit"],
): { rig: Rig; body: Model; fore: Model } {
  const [ovB, ovF] = s.ov ?? [3, 3];
  const pawH = s.pawH ?? Math.min(2, Math.max(1, Math.floor(s.lh / 3)));
  const body = new Model();
  const fore = new Model();
  const bg = new Grid();
  const cy = s.lh + s.H / 2 - 1;
  const cz = s.zF / 2;
  const rz = s.zF / 2 + (ovB + ovF) / 2;
  const czC = cz + (ovF - ovB) / 2;
  const ry = s.H / 2;
  bg.ell(0, cy, czC, s.W / 2, ry, rz, "#b0b0b0", 2.5);
  if (s.chest)
    bg.ell(
      0,
      cy - s.chest / 2,
      s.zF - 1,
      s.W / 2 - 0.5,
      ry + s.chest / 2,
      s.zF * 0.28 + ovF - 1,
      "#b0b0b0",
      2.6,
    );
  const tuck = s.tuck ?? 0;
  if (tuck)
    bg.each((x, y, z) => {
      if (z < s.zF * 0.55 && y < cy - ry * (1 - tuck) + (z / (s.zF * 0.55)) * ry * tuck * 0.6)
        bg.del(x, y, z);
    });
  // Haunches and shoulders: a plump bump above each leg.
  const lx = Math.max(1, Math.round(s.W / 2 - s.lw / 2));
  for (const sd of SIDES) {
    bg.ell(sd * (s.W / 2 - 1.2), s.lh + ry * 0.55, 0, 2.4, ry * 0.75, 3.4, "#b0b0b0", 2.4);
    bg.ell(sd * (s.W / 2 - 1.5), s.lh + ry * 0.45, s.zF, 2.2, ry * 0.7, 2.8, "#b0b0b0", 2.4);
  }
  // Head pivot and neck.
  const hy = Math.round(cy + ry * 0.45 + (s.neckUp ?? 0));
  const hz = Math.round(s.zF + ovF - 3 + (s.neckFwd ?? 0));
  const neckR = Math.max(2, Math.min(s.W / 2 - 0.5, s.hh / 2));
  bg.tube(
    [
      [0, cy + ry * 0.1, s.zF + ovF - 5],
      [0, hy - 1, hz],
    ],
    neckR,
    Math.max(2, neckR - 0.7),
    "#b0b0b0",
  );
  bg.paint((c) => (c.z > s.zF + ovF - 6 && c.y > cy + ry * 0.2 ? s.coat("neck", c) : s.coat("body", c)));
  if (s.fluff?.body) bg.fluff(s.fluff.body, s.fluff.seed ?? 3, 0.07);

  // The head, in its own space: pivot at the neck, +z forward.
  const hg = new Grid();
  const scy = s.hh * 0.3;
  const scz = s.hl / 2 - 1;
  hg.ell(0, scy, scz, s.hw / 2, s.hh / 2, s.hl / 2, "#b0b0b0", 2.5);
  const skullTop = Math.round(scy + s.hh / 2);
  let snoutFront = Math.round(scz + s.hl / 2);
  if (s.sn && !s.pumpkin) {
    const sy = scy - s.hh / 2 + s.sn.h / 2 + 0.4 + (s.sn.up ?? 0);
    const sz = scz + s.hl / 2 - 1 + s.sn.l / 2 - 0.5;
    hg.ell(0, sy, sz, s.sn.w / 2, s.sn.h / 2, s.sn.l / 2 + 0.5, "#b0b0b0", 3.4);
    snoutFront = Math.round(sz + s.sn.l / 2);
  }
  hg.paint((c) => s.coat(s.sn && c.z >= scz + s.hl / 2 - 0.5 ? "snout" : "head", c));
  if (s.fluff?.head) hg.fluff(s.fluff.head, (s.fluff.seed ?? 3) + 5, 0.08);
  // The nose sticks out a cell.
  if (s.sn && !s.pumpkin) {
    const ty = Math.round(scy - s.hh / 2 + s.sn.h + 0.4 + (s.sn.up ?? 0)) - 1;
    const nw = s.noseW ?? Math.max(1, Math.round(s.sn.w / 2));
    for (let x = -Math.floor((nw - 1) / 2); x <= Math.ceil((nw - 1) / 2); x++)
      for (let y = ty - (s.noseH ?? 1) + 1; y <= ty; y++) hg.set(x, y, snoutFront + 1, s.nose);
    if (s.tongue) {
      const by = Math.round(scy - s.hh / 2 + 0.4 + (s.sn.up ?? 0));
      hg.set(0, by - 1, snoutFront - 1, s.tongue);
      hg.set(0, by - 1, snoutFront, s.tongue);
      hg.set(0, by - 2, snoutFront, mix(s.tongue, "#7a1d2a", 0.25));
    }
  } else if (!s.pumpkin) {
    // Flat faces: a nose right on the front.
    const f = hg.front(0, Math.round(scy - 1));
    if (f !== undefined) hg.set(0, Math.round(scy - 1), f + 1, s.nose);
  }
  const ctx: Extras = {
    body: bg,
    head: hg,
    s,
    cy,
    ry,
    cz: czC,
    rz,
    skull: { cy: scy, top: skullTop },
    snoutFront,
    headGroup: new Model(),
    bodyGroup: body,
    lit: special,
  };
  s.extra?.(ctx);
  const headMesh = bake(hg, { seed: 2 });
  const head = ctx.headGroup;
  head.add(headMesh);
  head.position.set(0, U(hy), U(hz));
  body.add(head);
  const bodyMesh = bake(bg, { seed: 1 });
  body.add(bodyMesh);

  // Eyes, flush on the face.
  const eyes: THREE.Mesh[] = [];
  const rows = s.eyeRows;
  const eh = rows.length;
  for (const sd of rows.flat().some(Boolean) ? SIDES : []) {
    const ex = sd * s.eyeGap;
    const ey = Math.round(scy + s.eyeY);
    let zf: number | undefined;
    const ew = Math.max(...rows.map((r) => r.length));
    for (let j = 0; j < eh; j++)
      for (let i = 0; i < ew; i++) {
        const f = hg.front(ex + sd * i, ey - j);
        if (f !== undefined) zf = zf === undefined ? f : Math.min(zf, f);
      }
    const e = eye(rows);
    e.position.set(U(ex + (sd * (ew - 1)) / 2), U(ey - (eh - 1) / 2), U((zf ?? snoutFront - 2) + 0.55));
    head.add(e);
    eyes.push(e);
  }

  // Ears.
  const ears: THREE.Object3D[] = [];
  if (s.ear) {
    const e = s.ear;
    const grid = earGrid(
      e,
      (c) => s.coat("ear", { ...c, y: c.y }),
      (c) => s.coat("earIn", c),
    );
    if (s.fluff?.head)
      grid.fluff(s.fluff.head * 0.7, 9, 0.08, [
        [1, 0, 0],
        [0, 1, 0],
        [0, 0, 1],
        [0, 0, -1],
      ]);
    for (const sd of SIDES) {
      const g = sd > 0 ? grid : grid.mirrored();
      const m = bake(g, { seed: 5 + sd });
      const pivot = new THREE.Group();
      pivot.add(m);
      const ex = sd * e.x;
      const ez = Math.round(e.z);
      const topY = hg.top(Math.round(ex), ez);
      pivot.position.set(U(ex), U((topY ?? skullTop) - (e.drop ?? 1)), U(ez));
      pivot.userData.base = sd;
      head.add(pivot);
      ears.push(pivot);
    }
  }

  // Legs: a shaft that stretches and a paw that doesn't.
  const foreLegs: THREE.Mesh[] = [];
  const hindLegs: THREE.Mesh[] = [];
  for (const sd of SIDES)
    for (const [parent, list, z0] of [
      [body, hindLegs, 0],
      [fore, foreLegs, s.zF],
    ] as const) {
      const x0 = sd * lx;
      const shaft = new Grid();
      const paw = new Grid();
      const half = Math.floor(s.lw / 2);
      const hi = s.lw % 2 ? half : half - 1;
      for (let x = -half; x <= hi; x++)
        for (let z = -half; z <= hi; z++) {
          for (let y = 0; y <= s.lh + 1; y++) {
            const cell: Cell = {
              x,
              y,
              z,
              u: (z + half) / s.lw,
              t: y / (s.lh + 1),
              s: (sd * (x - 0)) / half,
              c: "",
            };
            const corner = Math.abs(x) === half && Math.abs(z) === half && s.lw > 3 && y >= pawH;
            if (corner && (y + z) % 3 === 0) continue;
            (y < pawH ? paw : shaft).set(x, y, z, s.coat(y < pawH ? "paw" : "leg", cell));
          }
        }
      // A toe cell out the front.
      for (let x = -half + (s.lw > 3 ? 1 : 0); x <= hi - (s.lw > 3 ? 1 : 0); x++)
        paw.set(x, 0, hi + 1, s.coat("paw", { x, y: 0, z: hi + 1, u: 1, t: 0, s: 0, c: "" }));
      if (s.fluff?.leg)
        shaft.fluff(s.fluff.leg, 17, 0.07, [
          [1, 0, 0],
          [-1, 0, 0],
          [0, 0, -1],
          [0, 0, 1],
        ]);
      const m = bake(shaft, { origin: [0, pawH - 0.5, 0], seed: 7 });
      m.position.set(U(x0), U(pawH - 0.5), U(z0));
      m.userData.leg = true;
      const pm = bake(paw, { origin: [0, -0.5, 0], seed: 8 });
      pm.position.set(U(x0), 0, U(z0));
      pm.userData.paw = true;
      parent.add(m, pm);
      list.push(m, pm);
    }

  // Tails.
  const tails: THREE.Object3D[] = [];
  for (const t of Array.isArray(s.tail) ? s.tail : [s.tail]) {
    const grid = tailGrid(t, s.coat);
    const m = bake(grid, { seed: 9 });
    const pivot = new THREE.Group();
    pivot.add(m);
    pivot.position.set(0, U(cy + ry * ((t.at ?? 0.55) * 2 - 1)), U(-ovB + 1.5));
    body.add(pivot);
    tails.push(pivot);
  }

  const noseZ = hz + snoutFront + 1;
  const topY = skullTop;
  const rig: Rig = {
    head,
    eyes,
    fore: foreLegs,
    hind: hindLegs,
    tails,
    neck: [0, U(-1.5), U(s.hl * 0.2)],
    neckR: U(Math.max(3, s.hw / 2 - 0.5)),
    top: [0, U(topY - 1), U(s.hl * 0.35)],
    tilt: true,
    sitStretch: (0.62 * s.zF) / (s.lh + 2),
    span: U(noseZ + ovB),
  };
  // Ears twitch, now and then.
  rig.fx = (t) => {
    ears.forEach((p, i) => {
      const sd = p.userData.base as number;
      const k = Math.max(0, Math.sin(t * 1.3 + i * 2.1 + species.length) - 0.82) * 5;
      p.rotation.z = -sd * (0.03 + k * 0.45);
      p.rotation.x = Math.sin(t * 0.9 + i) * 0.03;
    });
  };
  return { rig, body, fore };
}

// MARK: Colour helpers

/** Alternating light/dark flecks, a coarse fur texture. */
const flecks = (a: string, b: string, p: Cell, seed = 1, k = 0.3) =>
  hash(p.x, p.y, p.z, seed) < k * 0.8 ? mix(a, b, 0.55) : a;

const stripesAcross = (p: Cell, period: number, width: number) =>
  (p.z * 1 + p.y * 0.4 + 400) % period < width;

// MARK: Dogs

const dogBase = (): QSpec => ({
  zF: 14,
  W: 11,
  H: 11,
  lh: 7,
  lw: 4,
  hw: 10,
  hh: 9,
  hl: 8,
  sn: { l: 5, w: 6, h: 4 },
  nose: "#1c1920",
  noseW: 3,
  eyeGap: 3,
  eyeY: 0.6,
  eyeRows: dogEye(),
  ear: { kind: "floppy", w: 4, h: 6, th: 5, x: 5, z: 2, lean: 1.5, drop: 2 },
  tail: {
    pts: [
      [0, 0, 0],
      [0, 1, -3],
      [0, 3, -5],
      [0, 6, -6],
    ],
    r0: 1.6,
    r1: 1.0,
  },
  tongue: "#e0584f",
  coat: (part, c) => {
    const body = "#c9925a";
    switch (part) {
      case "ear":
      case "earIn":
        return flecks("#7a4f2c", "#6a4326", c, 4);
      case "snout":
        return c.t < 0.3 ? "#ecd8b2" : "#d9b387";
      case "paw":
        return "#ecd8b2";
      case "leg":
        return c.t < 0.35 ? "#e0bd8a" : flecks(body, "#bd8650", c, 5);
      default:
        if (part !== "tail" && c.t < 0.3) return "#e0bd8a";
        return c.t > 0.8 && part === "body"
          ? flecks("#b4804a", "#c9925a", c, 6, 0.5)
          : flecks(body, "#d3a06a", c, 6, 0.25);
    }
  },
});

const WHITE = "#f7f2ea";
const INKC = "#2b2730";

const dogs: Record<string, () => QSpec> = {
  "": dogBase,
  dalmatian: () => ({
    ...dogBase(),
    zF: 15,
    W: 10,
    H: 10,
    lh: 9,
    lw: 3,
    hw: 8,
    hh: 8,
    hl: 8,
    sn: { l: 5, w: 5, h: 4 },
    nose: INKC,
    ear: { kind: "floppy", w: 3, h: 6, th: 4, x: 4, z: 2, lean: 1, drop: 2 },
    tail: {
      pts: [
        [0, 0, 0],
        [0, 1, -4],
        [0, 3, -7],
        [0, 6, -8],
      ],
      r0: 1.4,
      r1: 0.7,
    },
    chest: 2,
    coat: (part, c) => {
      const sp = (p: Cell, sc: number, thr: number) =>
        noise(p.x / sc + 5, p.y / sc + 9, p.z / sc + 2, 3) > thr;
      if (part === "ear" || part === "earIn") return flecks("#34303a", "#4a4452", c, 2);
      if (part === "paw") return WHITE;
      if (part === "snout") return sp(c, 1.6, 0.8) ? INKC : "#fbf7f0";
      if (part === "head") return sp(c, 2, 0.74) ? INKC : WHITE;
      if (part === "tail") return c.u > 0.75 ? INKC : sp(c, 1.8, 0.75) ? INKC : WHITE;
      return sp(c, 2.4, 0.71) ? INKC : flecks(WHITE, "#efe9df", c, 2, 0.2);
    },
  }),
  husky: () => ({
    ...dogBase(),
    W: 12,
    H: 11,
    lh: 8,
    hw: 10,
    sn: { l: 5, w: 5, h: 4 },
    ear: { kind: "point", w: 5, h: 6, th: 3, x: 3, z: 2, lean: 0, drop: 1 },
    eyeRows: [
      ["#bfe6ff", "#bfe6ff"],
      ["#bfe6ff", "#2a3a5a"],
    ],
    eyeGap: 3,
    tail: {
      pts: [
        [0, 0, 0],
        [0, 2, -3],
        [0, 5, -3],
        [0, 7, -1],
        [0, 7, 1],
      ],
      r0: 2,
      r1: 1.7,
      fluff: 0.1,
    },
    fluff: { body: 0.072, head: 0.056, leg: 0.04 },
    coat: (part, c) => {
      const g = "#8d96a3";
      const dk = "#5f6874";
      const lg = flecks(g, "#9aa3af", c, 3, 0.3);
      if (part === "ear") return c.t < 0.3 ? "#7b8490" : "#5f6874";
      if (part === "earIn") return WHITE;
      if (part === "paw") return WHITE;
      if (part === "snout") return c.t < 0.7 ? WHITE : Math.abs(c.s) < 0.25 ? WHITE : "#cfd5dc";
      if (part === "head") {
        // The mask: dark cap, white blaze and cheeks.
        if (c.t > 0.62) return Math.abs(c.s) < 0.17 && c.u > 0.4 ? WHITE : flecks(dk, "#6f7885", c, 5);
        if (c.u > 0.45 || Math.abs(c.s) > 0.7) return c.t < 0.5 ? WHITE : flecks(dk, g, c, 5);
        return flecks(dk, g, c, 5);
      }
      if (part === "leg") return c.t < 0.55 ? WHITE : lg;
      if (part === "tail") return c.t < 0.3 ? WHITE : flecks(dk, g, c, 8);
      if (c.t < 0.32 || (part === "neck" && c.t < 0.7 && c.u > 0.9))
        return flecks(WHITE, "#e6e9ee", c, 4, 0.25);
      if (c.u > 0.8 && c.t < 0.62) return WHITE;
      return c.t > 0.78 ? flecks(dk, "#6f7885", c, 3, 0.4) : lg;
    },
    extra: ({ head, skull }) => {
      // Little white eyebrows over the blue.
      for (const sd of SIDES) {
        const f = head.front(sd * 3, Math.round(skull.cy + 2.6));
        if (f !== undefined) head.set(sd * 3, Math.round(skull.cy + 2.6), f, WHITE);
      }
    },
  }),
  shiba: () => ({
    ...dogBase(),
    zF: 13,
    W: 11,
    H: 10,
    lh: 7,
    hw: 10,
    hh: 8,
    sn: { l: 4, w: 5, h: 4 },
    ear: { kind: "point", w: 4, h: 5, th: 3, x: 3.5, z: 2.5, lean: 0, drop: 1 },
    tail: {
      pts: [
        [0, 0, 0],
        [0, 2, -2],
        [0, 5, -2],
        [0, 7, 0],
        [0, 7, 3],
      ],
      r0: 1.9,
      r1: 1.6,
      fluff: 0.08,
      col: (t, b) => (t > 0.3 ? mix(b, "#f6e7c8", 0.3) : b),
    },
    fluff: { body: 0.04, head: 0.04 },
    tongue: undefined,
    coat: (part, c) => {
      const o = "#d9713c";
      const cream = "#f6e7c8";
      if (part === "ear") return flecks("#c35c2a", o, c, 1);
      if (part === "earIn") return "#f0c9a0";
      if (part === "paw") return cream;
      if (part === "snout") return c.t < 0.55 ? cream : flecks(o, "#e08045", c, 2);
      if (part === "head") return c.t < 0.45 && c.u > 0.15 ? cream : flecks(o, "#e08045", c, 2, 0.3);
      if (part === "leg") return c.t < 0.45 ? cream : flecks(o, "#c8622f", c, 4);
      if (part === "tail") return flecks(o, "#e08045", c, 3, 0.3);
      if (c.t < 0.32 || (c.u > 0.82 && c.t < 0.7)) return cream;
      return c.t > 0.75 ? flecks("#c8622f", o, c, 6, 0.5) : flecks(o, "#e08045", c, 7, 0.25);
    },
    extra: ({ head, skull }) => {
      for (const sd of SIDES) {
        const f = head.front(sd * 3, Math.round(skull.cy + 2.5));
        if (f !== undefined) head.set(sd * 3, Math.round(skull.cy + 2.5), f, "#f6e7c8");
      }
    },
  }),
  golden: () => ({
    ...dogBase(),
    zF: 15,
    W: 11,
    H: 11,
    lh: 8,
    lw: 4,
    hw: 10,
    hh: 9,
    sn: { l: 6, w: 5, h: 4 },
    ear: { kind: "floppy", w: 4, h: 7, th: 5, x: 5, z: 2, lean: 1.5, drop: 2 },
    tail: {
      pts: [
        [0, 0, 0],
        [0, 1, -3],
        [0, 2, -6],
        [0, 2, -9],
      ],
      r0: 2.2,
      r1: 1.4,
      fluff: 0.06,
    },
    fluff: { body: 0.05, leg: 0.05, head: 0.02, seed: 11 },
    coat: (part, c) => {
      const g = "#f2bd36";
      const dk = "#d08e1e";
      const pale = "#fff0c4";
      if (part === "ear" || part === "earIn") return flecks("#b87a1e", "#a8691a", c, 2);
      if (part === "snout") return flecks("#f8d56c", "#f2c850", c, 3, 0.2);
      if (part === "paw") return "#f6d77a";
      if (part === "leg") return c.t < 0.5 ? flecks("#f6d77a", g, c, 4) : flecks(g, dk, c, 4, 0.3);
      if (part === "tail") return flecks(g, "#fadc7e", c, 6, 0.4);
      if (part === "head") return c.t > 0.7 ? flecks(dk, g, c, 5, 0.3) : flecks(g, "#f8d56c", c, 5, 0.3);
      if (c.t < 0.3 || (c.u > 0.8 && c.t < 0.6)) return flecks(pale, "#fadc7e", c, 7, 0.3);
      return c.t > 0.7 ? flecks(dk, g, c, 8, 0.45) : flecks(g, "#f7c94a", c, 9, 0.3);
    },
  }),
  pug: () => ({
    ...dogBase(),
    zF: 10,
    W: 12,
    H: 11,
    lh: 5,
    lw: 4,
    hw: 12,
    hh: 11,
    hl: 8,
    sn: { l: 2, w: 8, h: 5, up: 1 },
    noseW: 3,
    nose: "#0e0c12",
    eyeGap: 3,
    eyeY: 1.6,
    eyeRows: [
      ["#14101c", GLINT],
      ["#14101c", "#14101c"],
    ],
    ear: { kind: "rose", w: 4, h: 3, th: 3, x: 4.5, z: 2.5, drop: 2, lean: 1 },
    tail: {
      pts: [
        [0, 0, 0],
        [0, 2, -1],
        [0, 4, 0],
        [0, 4, 2],
      ],
      r0: 1.8,
      r1: 1.4,
    },
    tongue: "#e0584f",
    coat: (part, c) => {
      const tan = "#d9b27c";
      const dark = "#34303a";
      if (part === "ear" || part === "earIn") return dark;
      if (part === "paw") return "#ead3a6";
      if (part === "snout") return dark;
      if (part === "head") {
        // The black mask, and the wrinkles over the brow.
        if (c.u > 0.52 && c.t < 0.5) return dark;
        if (c.u > 0.5 && c.t >= 0.5 && c.t < 0.58 && Math.abs(c.s) < 0.6) return "#c99a62";
        if (c.u > 0.55 && c.t >= 0.78 && c.t < 0.84) return "#a8794a";
        if (c.u > 0.4 && Math.abs(c.s) < 0.2 && c.t > 0.7) return "#a8794a";
        return flecks(tan, "#e2c08c", c, 3, 0.3);
      }
      if (part === "leg") return c.t < 0.4 ? "#ead3a6" : tan;
      if (part === "tail") return dark;
      if (c.t < 0.3) return "#ead3a6";
      return c.t > 0.8 ? flecks("#bf9660", tan, c, 5, 0.4) : flecks(tan, "#e2c08c", c, 5, 0.3);
    },
  }),
  corgi: () => ({
    ...dogBase(),
    zF: 15,
    W: 11,
    H: 9,
    lh: 3,
    lw: 4,
    ov: [3, 3],
    hw: 10,
    hh: 8,
    hl: 8,
    sn: { l: 6, w: 4, h: 3 },
    ear: { kind: "point", w: 5, h: 8, th: 3, x: 3.5, z: 2, lean: 1, drop: 1 },
    eyeY: 0.8,
    tail: {
      pts: [
        [0, 0, 0],
        [0, 1, -1.5],
      ],
      r0: 1.5,
      r1: 1.3,
    },
    fluff: { body: 0.1, leg: 0.048, head: 0.04 },
    tongue: "#e0584f",
    coat: (part, c) => {
      const o = "#e0954f";
      const cream = "#f6ecd9";
      if (part === "ear") return flecks("#d2823c", o, c, 1);
      if (part === "earIn") return cream;
      if (part === "paw") return cream;
      if (part === "snout") return cream;
      if (part === "head")
        return c.u > 0.4 && (c.t < 0.5 || Math.abs(c.s) < 0.12) ? cream : flecks(o, "#e8a05e", c, 2, 0.3);
      if (part === "leg") return cream;
      if (part === "tail") return o;
      // A saddle of orange over the back, cream chest, belly and rump fluff.
      if (c.t < 0.45 || (c.u > 0.78 && c.t < 0.8) || c.u < 0.1) return flecks(cream, "#efe3cc", c, 3, 0.25);
      return flecks(o, "#e8a05e", c, 4, 0.3);
    },
  }),
  dachshund: () => ({
    ...dogBase(),
    zF: 26,
    W: 8,
    H: 8,
    lh: 3,
    lw: 3,
    hw: 7,
    hh: 7,
    hl: 7,
    ov: [3, 2],
    sn: { l: 7, w: 4, h: 3 },
    noseW: 2,
    ear: { kind: "floppy", w: 3, h: 8, th: 4, x: 3.5, z: 2.5, lean: 1, drop: 2 },
    eyeGap: 2,
    eyeY: 0.8,
    tail: {
      pts: [
        [0, 0, 0],
        [0, 1, -4],
        [0, 3, -7],
        [0, 5, -8],
      ],
      r0: 1.3,
      r1: 0.6,
    },
    neckUp: 1,
    coat: (part, c) => {
      const b = "#a4552f";
      const dk = "#6e3519";
      if (part === "ear" || part === "earIn") return flecks(dk, "#7e4220", c, 2);
      if (part === "paw") return "#7e4220";
      if (part === "snout") return c.t < 0.3 ? "#d98a5c" : flecks("#b96338", "#c46a40", c, 4);
      if (part === "head") return flecks(b, "#b3603a", c, 3, 0.3);
      if (part === "leg") return flecks("#8f4726", b, c, 2, 0.3);
      if (part === "tail") return dk;
      return c.t < 0.28
        ? flecks("#c46a40", "#b3603a", c, 3, 0.3)
        : c.t > 0.75
          ? flecks(dk, b, c, 6, 0.55)
          : flecks(b, "#b3603a", c, 5, 0.3);
    },
  }),
  poodle: () => ({
    ...dogBase(),
    zF: 12,
    W: 9,
    H: 9,
    lh: 9,
    lw: 2,
    hw: 8,
    hh: 8,
    hl: 7,
    sn: { l: 6, w: 4, h: 3 },
    noseW: 2,
    ear: { kind: "round", w: 5, h: 8, th: 5, x: 4.5, z: 2, drop: 5 },
    tongue: undefined,
    eyeGap: 2,
    eyeY: 0.8,
    tail: {
      pts: [
        [0, 0, 0],
        [0, 2, -2],
        [0, 5, -3],
      ],
      r0: 0.9,
      r1: 0.9,
      pow: 2,
    },
    fluff: { body: 0.03, head: 0.02, leg: 0.02, seed: 21 },
    coat: (part, c) => {
      const cr = "#f8e2bc";
      const curl = flecks(cr, "#ecd0a0", c, 5, 0.35);
      if (part === "paw") return curl;
      if (part === "snout") return flecks("#f1d7a8", cr, c, 2, 0.2);
      if (part === "leg") return c.t > 0.28 && c.t < 0.7 ? curl : "#e9ceA0".toLowerCase();
      if (part === "tail") return curl;
      return curl;
    },
    extra: ({ body, head, skull, cy, ry, s, bodyGroup }) => {
      const cr = "#f8e2bc";
      const pom = (g: Grid, x: number, y: number, z: number, r: number) =>
        g.ell(x, y, z, r, r, r, (c) => flecks(cr, "#ecd0a0", c, 12, 0.3), 2.1).fluff(0.1, 14, 0.04);
      // Topknot, a fringe of face fluff, leg cuffs and a mane on the chest.
      pom(head, 0, skull.top + 1, 2, 3.2);
      pom(head, 0, skull.cy + 1, 1, 3.8);
      for (const sd of SIDES) {
        pom(body, sd * (s.W / 2 - 1), 3, 0, 2.4);
        pom(body, sd * (s.W / 2 - 1), 3, s.zF, 2.4);
      }
      pom(body, 0, cy + ry * 0.2, s.zF + 2, 4);
      void bodyGroup;
    },
  }),
  frenchie: () => ({
    ...dogBase(),
    zF: 11,
    W: 11,
    H: 10,
    lh: 5,
    lw: 4,
    hw: 11,
    hh: 9,
    hl: 8,
    sn: { l: 2, w: 7, h: 4, up: 1 },
    noseW: 3,
    nose: "#0e0c12",
    eyeY: 1.2,
    eyeGap: 3,
    ear: { kind: "bat", w: 6, h: 9, th: 3, x: 4.5, z: 2, lean: 0.5, drop: 1 },
    tail: {
      pts: [
        [0, 0, 0],
        [0, 1, -1.5],
      ],
      r0: 1.4,
      r1: 1.2,
    },
    tongue: undefined,
    coat: (part, c) => {
      const g = "#b3a79b";
      const dk = "#7d7068";
      const stripe = (p: Cell) =>
        Math.floor((p.z + p.y * 0.6) / 2) % 3 === 0 && hash(p.x, p.y, p.z, 2) < 0.8
          ? dk
          : flecks(g, "#c1b6aa", p, 3, 0.3);
      if (part === "ear") return flecks(g, "#a09488", c, 2);
      if (part === "earIn") return "#e0aaa0";
      if (part === "paw") return "#cfc4b8";
      if (part === "snout") return dk;
      if (part === "head")
        return c.u > 0.55 && c.t < 0.75 ? dk : c.t > 0.7 ? stripe(c) : flecks(g, "#a69a8e", c, 3);
      if (part === "leg") return c.t < 0.4 ? "#cfc4b8" : g;
      if (part === "tail") return dk;
      if (c.u > 0.85 && c.t < 0.6) return "#efe9e2";
      return c.t < 0.3 ? "#cfc4b8" : stripe(c);
    },
  }),
  chowchow: () => ({
    ...dogBase(),
    zF: 13,
    W: 13,
    H: 12,
    lh: 6,
    lw: 5,
    hw: 11,
    hh: 9,
    hl: 8,
    sn: { l: 3, w: 7, h: 4 },
    noseW: 3,
    eyeGap: 3,
    eyeY: 0.8,
    ear: { kind: "round", w: 4, h: 4, th: 3, x: 4.5, z: 2, drop: 1 },
    tail: {
      pts: [
        [0, 0, 0],
        [0, 2, -2],
        [0, 6, -2],
        [0, 8, 0],
        [0, 7, 3],
      ],
      r0: 2.6,
      r1: 2.2,
      fluff: 0.16,
    },
    tongue: "#3d4a82",
    fluff: { body: 0.2, head: 0.16, leg: 0.14, seed: 31 },
    coat: (part, c) => {
      const r = "#b8663a";
      const mane = "#d98f55";
      if (part === "ear" || part === "earIn") return flecks("#9b5330", r, c, 2);
      if (part === "paw") return flecks("#a35a32", r, c, 2);
      if (part === "snout") return flecks("#d98f55", "#c97d45", c, 2, 0.3);
      if (part === "tail") return flecks(r, mane, c, 3, 0.4);
      if (part === "leg") return flecks(r, "#c97d45", c, 3, 0.3);
      if (part === "head")
        return c.u < 0.55 || c.t > 0.7 ? flecks(mane, "#c97d45", c, 4, 0.35) : flecks(r, mane, c, 4, 0.3);
      if (c.u > 0.7) return flecks(mane, "#e3a066", c, 5, 0.4);
      return flecks(r, "#c97d45", c, 6, 0.35);
    },
    extra: ({ head, body, skull, cy, ry, s }) => {
      // The lion's mane: a ruff round the head and the shoulders.
      const mane = (c: Cell) => flecks("#d98f55", "#e3a066", c, 14, 0.4);
      head.ell(0, skull.cy - 0.5, 0.5, s.hw / 2 + 1.6, s.hh / 2 + 1.2, 3.2, mane, 2.1);
      body.ell(0, cy + ry * 0.1, s.zF + 1.5, s.W / 2 - 0.2, ry + 0.8, 4, mane, 2.2);
      head.fluff(0.45, 15, 0.08);
    },
  }),
  chihuahua: () => ({
    ...dogBase(),
    zF: 9,
    W: 7,
    H: 7,
    lh: 6,
    lw: 2,
    hw: 10,
    hh: 9,
    hl: 8,
    sn: { l: 3, w: 4, h: 3 },
    noseW: 2,
    ear: { kind: "point", w: 6, h: 9, th: 2, x: 4.5, z: 2, lean: 3, drop: 1 },
    eyeGap: 3,
    eyeY: 0.8,
    eyeRows: [
      ["#14101c", "#14101c"],
      ["#14101c", GLINT],
      ["#14101c", "#14101c"],
    ],
    tail: {
      pts: [
        [0, 0, 0],
        [0, 1, -3],
        [0, 3, -4],
        [0, 5, -3],
      ],
      r0: 1,
      r1: 0.5,
    },
    tongue: undefined,
    coat: (part, c) => {
      const b = "#dcae74";
      if (part === "ear") return flecks(b, "#cf9f64", c, 2);
      if (part === "earIn") return "#eec0aa";
      if (part === "paw") return "#f1d6a8";
      if (part === "snout") return "#e8c28c";
      if (part === "head") return flecks(b, "#e5b97f", c, 3, 0.3);
      if (part === "leg") return c.t < 0.4 ? "#f1d6a8" : b;
      if (part === "tail") return b;
      if (c.u > 0.8 && c.t < 0.7) return WHITE;
      return c.t < 0.3 ? "#f1d6a8" : flecks(b, "#e5b97f", c, 4, 0.3);
    },
  }),
  greyhound: () => ({
    ...dogBase(),
    zF: 19,
    W: 8,
    H: 9,
    lh: 13,
    lw: 3,
    hw: 6,
    hh: 7,
    hl: 8,
    sn: { l: 9, w: 3, h: 3 },
    noseW: 2,
    eyeGap: 2,
    eyeY: 0.9,
    ear: { kind: "rose", w: 3, h: 4, th: 4, x: 3, z: 1.5, drop: 1, lean: 0 },
    chest: 3,
    tuck: 0.5,
    neckUp: 3,
    neckFwd: 1,
    tail: {
      pts: [
        [0, 0, 0],
        [0, -1, -5],
        [0, -1, -9],
        [0, 1, -12],
      ],
      r0: 1.3,
      r1: 0.5,
    },
    tongue: undefined,
    coat: (part, c) => {
      const g = "#8d9bb2";
      const white = "#f1eee8";
      if (part === "ear" || part === "earIn") return "#66738c";
      if (part === "paw") return white;
      if (part === "snout") return c.t < 0.3 ? "#c2cbd8" : "#a7b3c6";
      if (part === "head") return flecks("#7d8ba3", g, c, 3, 0.3);
      if (part === "leg") return c.t < 0.35 ? white : flecks(g, "#7f8ea6", c, 4, 0.3);
      if (part === "tail") return "#7f8ea6";
      if (c.u > 0.85 && c.t < 0.7) return white;
      return c.t < 0.25
        ? "#a7b3c6"
        : c.t > 0.75
          ? flecks("#6f7e96", g, c, 5, 0.4)
          : flecks(g, "#7f8ea6", c, 5, 0.3);
    },
  }),
  jackolantern: () => {
    const b = dogBase();
    return {
      ...b,
      pumpkin: true,
      sn: null,
      hw: 16,
      hh: 14,
      hl: 14,
      eyeRows: [[""]],
      eyeGap: 99,
      ear: null,
      tongue: undefined,
      coat: (part, c) => {
        if (part === "ear" || part === "earIn") return "#e8832e";
        if (part === "head" || part === "snout") {
          const rib = Math.abs(c.x) % 4 === 3 ? "#d0701f" : "#e8832e";
          return flecks(rib, "#f19240", c, 3, 0.2);
        }
        const r = "#3a3034";
        if (part === "paw") return "#4a3e44";
        return c.t < 0.3 ? "#4a3e44" : flecks(r, "#463a40", c, 2, 0.3);
      },
      tail: {
        pts: [
          [0, 0, 0],
          [0, 1, -3],
          [0, 3, -5],
        ],
        r0: 1.4,
        r1: 0.8,
      },
      extra: ({ head, skull, s, lit, headGroup }) => {
        // A pumpkin for a head, lit from inside: ribs, a stem, a carved face.
        head.ell(
          0,
          skull.cy,
          3,
          s.hw / 2,
          s.hh / 2,
          s.hl / 2,
          (c) => {
            const rib = Math.abs(c.x) % 4 === 3 || Math.abs(c.x) % 4 === 0 ? "#d97424" : "#e8832e";
            return flecks(rib, "#f29845", c, 3, 0.2);
          },
          2.4,
        );
        head.ell(0, skull.cy - 3, 3, 3, 3, 2, "#d97424", 2.4);
        head.tube(
          [
            [0, skull.top, 3],
            [0, skull.top + 2, 3],
            [1, skull.top + 3, 2],
          ],
          1.1,
          0.8,
          "#5fa85a",
        );
        head.set(0, skull.top + 1, 3, "#4a8c47");
        const lit1 = "*#ffd84a";
        const lit2 = "*#ff9a2a";
        const put = (x: number, y: number, c: string) => {
          const z = head.front(x, y);
          if (z !== undefined) head.set(x, y, z, c);
        };
        const ey = skull.cy + 2;
        for (const sd of SIDES)
          // Triangle eyes, point up.
          for (let k = 0; k < 4; k++)
            for (let i = 0; i < 4 - k; i++)
              put(sd * (3 + i + Math.floor(k / 2)), ey + k, k > 1 ? lit1 : lit2);
        put(0, ey - 1, lit2);
        put(0, ey - 2, lit2);
        // Jagged grin.
        for (let x = -6; x <= 6; x++) {
          const y = skull.cy - 3 - (Math.abs(x) % 2 === 0 ? 0 : 1);
          put(x, y, lit1);
          put(x, y - 1, lit2);
          if (Math.abs(x) < 5) put(x, y + 1, lit2);
        }
        if (lit) lit(headGroup, [0, 0.1, 0.25], "#ffb347", 1.4, 3);
      },
    };
  },
};

// MARK: Cats

const tabby = (c: Cell, a: string, b: string) => ((c.z + 40) % 4 < 2 && c.t > 0.35 ? b : a);

const catBase = (): QSpec => ({
  zF: 11,
  W: 8,
  H: 8,
  lh: 5,
  lw: 3,
  hw: 9,
  hh: 8,
  hl: 7,
  sn: { l: 1, w: 4, h: 2, up: 0.3 },
  nose: "#e0707a",
  noseW: 1,
  eyeGap: 2,
  eyeY: 0.8,
  eyeRows: [
    ["#7ac943", "#14101c"],
    ["#7ac943", "#7ac943"],
  ],
  ear: { kind: "point", w: 5, h: 5, th: 2, x: 3, z: 1.5, lean: 0.5, drop: 1 },
  tail: {
    pts: [
      [0, 0, 0],
      [0, 1, -3],
      [0, 4, -6],
      [0, 8, -7],
      [0, 11, -6],
    ],
    r0: 1.5,
    r1: 1.1,
    col: (t, b) => (t > 0.88 ? lighten(b, 0.1) : b),
  },
  tongue: undefined,
  coat: (part, c) => {
    const o = "#f0a04b";
    const d = "#c97a2a";
    const cream = "#fbe7c8";
    if (part === "ear") return flecks(o, d, c, 1, 0.3);
    if (part === "earIn") return "#f28bb2";
    if (part === "paw") return cream;
    if (part === "snout") return cream;
    if (part === "head") {
      // The tabby's forehead "M" and cheek stripes.
      if (c.t > 0.72 && Math.abs(c.s) < 0.6 && Math.round(c.s * 5) % 2 === 0) return d;
      return c.u > 0.5 && c.t < 0.5 ? cream : flecks(o, "#f4b46a", c, 2, 0.3);
    }
    if (part === "leg") return c.t < 0.3 ? cream : stripesAcross(c, 4, 1.4) ? d : o;
    if (part === "tail") return (c.z + 40) % 3 < 1 ? d : o;
    if (c.t < 0.3 || (c.u > 0.85 && c.t < 0.65)) return flecks(cream, "#f5d9b0", c, 3, 0.2);
    return tabby(c, flecks(o, "#f4b46a", c, 4, 0.3), d);
  },
});

const cats: Record<string, () => QSpec> = {
  "": catBase,
  black: () => ({
    ...catBase(),
    eyeRows: [
      ["#f5d14a", "#14101c"],
      ["#f5d14a", "#f5d14a"],
    ],
    coat: (part, c) => {
      const b = "#4a4353";
      if (part === "earIn") return "#6e6680";
      if (part === "snout") return flecks("#554d62", b, c, 2, 0.3);
      return flecks(b, c.t > 0.7 ? "#5a5266" : "#403a49", c, 3, 0.3);
    },
  }),
  tuxedo: () => ({
    ...catBase(),
    coat: (part, c) => {
      const b = "#2f2a38";
      if (part === "earIn") return "#c87a96";
      if (part === "paw") return WHITE;
      if (part === "snout") return WHITE;
      if (part === "head")
        return c.u > 0.55 && c.t < 0.7 && Math.abs(c.s) < 0.55 ? WHITE : flecks(b, "#3b3546", c, 2, 0.3);
      if (part === "leg") return c.t < 0.35 ? WHITE : b;
      if (part === "tail") return b;
      if (c.u > 0.8 && c.t < 0.78 && Math.abs(c.s) < 0.7) return WHITE;
      if (c.t < 0.15) return WHITE;
      return flecks(b, "#3b3546", c, 4, 0.3);
    },
  }),
  siamese: () => ({
    ...catBase(),
    eyeRows: [
      ["#4fa3d9", "#14101c"],
      ["#4fa3d9", "#4fa3d9"],
    ],
    coat: (part, c) => {
      const cr = "#f1e4c8";
      const pt = "#5b3d2b";
      if (part === "ear") return pt;
      if (part === "earIn") return "#8a6a58";
      if (part === "paw" || part === "tail") return pt;
      if (part === "snout") return pt;
      if (part === "head")
        return c.u > 0.45 && c.t < 0.75 ? pt : c.t > 0.8 ? "#8a6a58" : flecks(cr, "#e8d8b8", c, 2, 0.3);
      if (part === "leg") return c.t < 0.55 ? pt : cr;
      return c.t > 0.8 && c.u < 0.2 ? "#d6c3a0" : flecks(cr, "#e8d8b8", c, 3, 0.3);
    },
  }),
  calico: () => ({
    ...catBase(),
    coat: (part, c) => {
      const w = "#fbf7ef";
      const o = "#f0a04b";
      const k = "#3a3442";
      const patch = (p: Cell) => {
        const n = noise(p.x / 3.2 + 1, p.y / 3.2 + 4, p.z / 3.2 + 7, 5);
        return n > 0.62 ? k : n < 0.34 ? o : w;
      };
      if (part === "ear") return c.s > 0 ? k : o;
      if (part === "earIn") return "#f5a0b8";
      if (part === "paw") return w;
      if (part === "snout") return w;
      if (part === "tail") return c.u > 0.5 ? o : k;
      if (part === "head") return c.u > 0.5 && c.t < 0.6 ? w : c.s > 0 ? o : k;
      if (c.t < 0.25) return w;
      return patch(c);
    },
  }),
  greytabby: () => ({
    ...catBase(),
    coat: (part, c) => {
      const g = "#a7a2a0";
      const d = "#5e5a63";
      if (part === "ear") return "#7d7880";
      if (part === "earIn") return "#d79aa8";
      if (part === "paw") return "#cfcac8";
      if (part === "snout") return "#d8d3d1";
      if (part === "head")
        return c.t > 0.72 && Math.round(c.s * 6) % 2 === 0
          ? d
          : c.u > 0.5 && c.t < 0.5
            ? "#d8d3d1"
            : flecks(g, "#b3aeac", c, 2, 0.3);
      if (part === "leg") return stripesAcross(c, 4, 1) ? d : g;
      if (part === "tail") return (c.z + 40) % 3 < 1 ? d : "#7d7880";
      if (c.t < 0.25) return "#cfcac8";
      return (c.z + 40) % 4 < 1.6 && c.t > 0.3 ? d : flecks(g, "#b3aeac", c, 4, 0.3);
    },
  }),
  sphynx: () => ({
    ...catBase(),
    W: 7,
    eyeRows: [
      ["#3b9e6a", "#14101c"],
      ["#3b9e6a", "#3b9e6a"],
    ],
    ear: { kind: "point", w: 6, h: 8, th: 2, x: 3, z: 1.5, lean: 1, drop: 1 },
    nose: "#d9787a",
    tail: {
      pts: [
        [0, 0, 0],
        [0, 0, -4],
        [0, 2, -8],
        [0, 5, -10],
      ],
      r0: 1,
      r1: 0.5,
    },
    coat: (part, c) => {
      const s = "#e2b49a";
      const wr = "#b46c58";
      if (part === "earIn") return "#ee8c8c";
      if (part === "paw") return "#d8a48a";
      if (part === "head") return c.t > 0.58 && c.t < 0.7 && c.u > 0.5 ? wr : flecks(s, "#eac0a8", c, 2, 0.3);
      if (part === "snout") return "#e8bda4";
      if (c.z % 4 === 0 && c.t > 0.3 && c.t < 0.9) return wr;
      return flecks(s, "#eac0a8", c, 3, 0.3);
    },
  }),
  witch: () => ({
    ...catBase(),
    eyeRows: [
      ["#f5d14a", "#14101c"],
      ["#f5d14a", "#f5d14a"],
    ],
    coat: (part, c) => {
      const b = "#4a4358";
      if (part === "earIn") return "#7a6f90";
      return flecks(b, "#554d66", c, 3, 0.3);
    },
    extra: ({ head, skull, s }) => {
      // A pointed purple hat with a yellow band and buckle, tilted a touch.
      const top = skull.top;
      const purple = (c: Cell) => flecks("#7a55b8", "#6c4aa6", c, 9, 0.3);
      head.ell(0, top, 1.5, s.hw / 2 + 1.5, 0.8, s.hl / 2 + 1.5, purple, 2.2);
      for (let k = 0; k < 8; k++) {
        const r = 3.6 - k * 0.42;
        head.ell(k * 0.15, top + 1 + k, 1.5 - k * 0.2, r, 0.6, r, purple, 2.1);
      }
      head.ell(0, top + 1, 1.5, 3.9, 0.6, 3.9, "#f5d14a", 2.1);
      head.box(-1, 1, top + 1, top + 1, 5, 5, "#fff2a8");
    },
  }),
};

// MARK: Pandas

const pandaBase = (): QSpec => ({
  zF: 11,
  W: 14,
  H: 12,
  lh: 5,
  lw: 5,
  hw: 13,
  hh: 11,
  hl: 8,
  sn: { l: 2, w: 6, h: 4, up: 0.5 },
  nose: "#14101c",
  noseW: 2,
  eyeGap: 3.5,
  eyeY: 1,
  eyeRows: [
    ["#14101c", GLINT],
    ["#14101c", "#14101c"],
  ],
  ear: { kind: "round", w: 4, h: 4, th: 3, x: 5, z: 1.5, drop: 1 },
  tail: {
    pts: [
      [0, 0, 0],
      [0, 0.5, -2],
    ],
    r0: 1.8,
    r1: 1.6,
  },
  tongue: undefined,
  fluff: { body: 0.04, head: 0.032, leg: 0.032 },
  coat: pandaCoat("#f4f1ea", "#3a3540", "#3a3540"),
});

function pandaCoat(white: string, black: string, patch: string, noseless = false): Coat {
  void noseless;
  return (part, c) => {
    if (part === "ear") return black;
    if (part === "earIn") return black;
    if (part === "paw" || part === "leg") return flecks(black, darken(black, 0.1), c, 2, 0.3);
    if (part === "snout") return white;
    if (part === "head") {
      // The eye patches: slanted ovals, the muzzle left pale.
      const ex = Math.abs(c.x);
      const dx = ex - 3.5;
      if (c.u > 0.55 && c.u < 0.95 && Math.abs(dx) < 1.9 && Math.abs(c.t - 0.58 - dx * 0.12) < 0.14)
        return patch;
      return flecks(white, lighten(white, 0.05), c, 3, 0.3);
    }
    if (part === "tail") return white;
    // The black band over the shoulders, legs shadow.
    if (c.u > 0.6 && c.u < 0.92) return flecks(black, darken(black, 0.1), c, 4, 0.3);
    return flecks(white, lighten(white, 0.04), c, 5, 0.3);
  };
}

const pandas: Record<string, () => QSpec> = {
  "": pandaBase,
  qinling: () => ({ ...pandaBase(), coat: pandaCoat("#f3e2c4", "#8a5a3a", "#8a5a3a") }),
  polar: () => ({ ...pandaBase(), coat: pandaCoat("#f7fbfd", "#9fb4c7", "#2b2433") }),
  albino: () => ({
    ...pandaBase(),
    nose: "#ff7fa8",
    eyeRows: [
      ["#ff2f68", "#ff9ab2"],
      ["#ff2f68", "#ff2f68"],
    ],
    coat: (part, c) => (part === "earIn" ? "#ffa6c4" : pandaCoat("#fffafc", "#e4c6ee", "#f1d9f4")(part, c)),
  }),
  red: () => ({
    ...pandaBase(),
    zF: 14,
    W: 10,
    H: 9,
    lh: 6,
    lw: 4,
    hw: 10,
    hh: 8,
    hl: 7,
    sn: { l: 3, w: 5, h: 3 },
    ear: { kind: "point", w: 5, h: 5, th: 2, x: 4, z: 1.5, lean: 0.5, drop: 1 },
    tail: {
      pts: [
        [0, 0, 0],
        [0, 1, -4],
        [0, 3, -8],
        [0, 4, -12],
      ],
      r0: 3,
      r1: 2.5,
      fluff: 0.08,
    },
    fluff: { body: 0.08, head: 0.072, leg: 0.04 },
    coat: (part, c) => {
      const r = "#c8643a";
      const dk = "#3a3540";
      const cream = "#f4f1ea";
      if (part === "ear") return c.t > 0.8 ? cream : r;
      if (part === "earIn") return cream;
      if (part === "paw" || part === "leg") return flecks(dk, "#2a2630", c, 2, 0.3);
      if (part === "snout") return cream;
      if (part === "head") {
        // A cream face with rust tear lines down from the eyes.
        const tear = Math.abs(Math.abs(c.x) - 2.5) < 0.9 && c.u > 0.6 && c.t < 0.7 && c.t > 0.3;
        if (tear) return "#8a3a1e";
        return c.t > 0.75 && Math.abs(c.s) < 0.5
          ? flecks(r, "#d6764a", c, 2)
          : c.u > 0.45
            ? "#ecd0a2"
            : flecks(r, "#d6764a", c, 2, 0.3);
      }
      if (part === "tail")
        return Math.floor((c.z + 80) / 2) % 2 === 0 ? "#6e2a18" : flecks(r, "#d6764a", c, 3, 0.3);
      return c.t < 0.3 ? dk : flecks(r, "#d6764a", c, 4, 0.3);
    },
  }),
};

// MARK: Costumes (Penny's sweater, Nemo's Wookiee coat)

const OUTFITS: Record<string, (e: Extras) => void> = {
  "penny-sweater": ({ body }) => {
    const knit = "#5e3a26";
    const pink = "#f0adbd";
    body.paint((c) => {
      // Dark chocolate knit over the barrel, ribbed; a pink hem and a pink roll neck.
      if (c.u > 0.1 && c.u < 0.78 && c.t > 0.06) {
        if (c.u < 0.16) return pink;
        return (c.z + 100) % 3 === 0 ? "#432718" : flecks(knit, "#6a4430", c, 3, 0.3);
      }
      if (c.u >= 0.78 && c.t > 0.5) return pink;
      return undefined;
    });
  },
  "nemo-wookiee": ({ body, head, s, skull }) => {
    const fur = (c: Cell) => flecks("#5a3822", "#3b2314", c, 21, 0.45);
    body.paint((c) => (c.t > 0.32 ? fur(c) : undefined));
    body.fluff(0.5, 22, 0.0);
    body.paint((c) => (c.c === "#b0b0b0" ? "#5a3822" : undefined));
    // A hood of fur round the head, and the bandolier.
    head.ell(0, skull.cy + 1, -0.5, s.hw / 2 + 0.8, s.hh / 2 + 0.5, 3, fur, 2.2);
    head.fluff(0.3, 23, 0);
    const z0 = s.zF / 2;
    body.each((x, y, z) => {
      if (Math.abs(z - z0 - x * 1.1) < 0.9)
        body.set(x, y, z, hash(x, y, z, 3) < 0.25 ? "#9a9eb0" : "#1f1e27");
    });
  },
};

// MARK: Public

export function quadSpec(species: Species, variant: string, outfit: string | null): QSpec {
  let s: QSpec;
  if (species === "dog") s = (dogs[variant] ?? dogs[""]!)();
  else if (species === "panda") s = (pandas[variant] ?? pandas[""]!)();
  else if (species === "forkedcat") {
    s = catBase();
    const grey = "#8a93a1";
    const base = s.coat;
    s.coat = (part, c) =>
      part === "tail" && c.u > 0.5
        ? "#f0a04b"
        : part === "earIn"
          ? "#f28bb2"
          : part === "tail"
            ? grey
            : mix(grey, base("body", { ...c, t: 0.5, u: 0.5 }), 0.0);
    const t0 = s.tail as TailSpec;
    s.tail = [
      { ...t0, pts: t0.pts.map(([x, y, z]) => [x - 0.5, y, z] as V3), r0: 1.3, r1: 0.9 },
      { ...t0, pts: t0.pts.map(([x, y, z]) => [x + 1.5, y, z - 1] as V3), r0: 1.3, r1: 0.9 },
    ];
  } else s = (cats[variant] ?? cats[""]!)();
  if (species !== "panda" && !s.pumpkin) {
    // Big heads read cuter and give the faces room.
    const k = species === "dog" ? 1.18 : 1.25;
    const r = (n: number) => Math.max(1, Math.round(n * k));
    s.hw = r(s.hw);
    s.hh = r(s.hh);
    s.hl = r(s.hl);
    if (s.sn)
      s.sn = {
        ...s.sn,
        l: Math.max(1, Math.round(s.sn.l * (1 + (k - 1) * 0.5))),
        w: r(s.sn.w),
        h: r(s.sn.h),
      };
    if (s.ear)
      s.ear = { ...s.ear, w: r(s.ear.w), h: Math.round(s.ear.h * k), x: s.ear.x * k, z: s.ear.z * k };
  }
  if (species === "cat" || species === "forkedcat") {
    const prev = s.extra;
    s.extra = (e) => {
      prev?.(e);
      // Whiskers: a few pale cells out from each cheek.
      const w = e.s.sn ? e.s.sn.w / 2 : 2;
      for (const sd of SIDES)
        for (const dy of [0, -1])
          for (let i = 1; i <= 3; i++)
            e.head.set(sd * (w + i), e.skull.cy - 2 + dy, e.snoutFront - 1 - i, "#f4f1ea");
    };
  }
  if (outfit && OUTFITS[outfit]) {
    const prev = s.extra;
    const fit = OUTFITS[outfit]!;
    s.extra = (e) => {
      prev?.(e);
      fit(e);
    };
  }
  return s;
}

export function quad(species: Species, variant: string, outfit: string | null) {
  return buildQuad(quadSpec(species, variant, outfit), species, light);
}
