import * as THREE from "three";
import { seeded, type V3 } from "../kit/kit.ts";
import { bake, darken, Grid, hash, lighten, noise, VOX } from "../pets/petvox.ts";

/**
 * The pond's fish (`core/src/fishing.ts`) as voxel sculptures, baked like the pets (`petvox.ts`): a body that is
 * round in section and tapers to the tail, fins that stand off it, eyes on both sides, and a tail of its own that
 * wags while the catch thrashes. The odd catches (the duck, the boot, the bug, the spaghetti, the eel, the
 * kraken's tentacle, the empty hook) are sculpted on their own. Sculpted nose to +z, then turned so the nose is +x.
 */
export interface FishRig {
  root: THREE.Group;
  /** Swings round y at the body's back end; null for the catches without one. */
  tail: THREE.Object3D | null;
}

type Col = string;

/** One cell of a body: `u` tail (0) to nose (1), `t` belly (0) to back (1), `s` side, -1 to 1. */
interface BodyCell {
  u: number;
  t: number;
  s: number;
  x: number;
  y: number;
  z: number;
}

interface FishSpec {
  /** Length in cells, and the half height and half width at the fattest. */
  len: number;
  hi: number;
  wide: number;
  /** Where the fattest point is: above 1 moves it towards the nose. */
  k?: number;
  /** The section's size along the body, 0 to 1 (overrides `k`). */
  prof?: (u: number) => number;
  /** The centre line's height along the body, in cells (the eel's S). */
  bend?: (u: number) => number;
  back: Col;
  side: Col;
  belly: Col;
  fin: Col;
  /** Markings: a colour for a cell, or undefined for the plain one. */
  mark?: (c: BodyCell) => Col | undefined;
  tail?: "fork" | "round" | "fan";
  dorsal?: "spiny" | "soft" | "long" | "rear" | "ridge";
  pupil?: Col;
  sleepy?: boolean;
  mouth?: "small" | "big";
  barbels?: boolean;
  /** No side fins (the eel). */
  noFins?: boolean;
  /** Anything else, given the shape. */
  extra?: (g: Grid, f: Shape) => void;
  opacity?: number;
  /** The front half drops a cell (the off-by-one bass). */
  slip?: boolean;
}

/** A body's section at `u`: its centre's height and half height and width. */
interface Shape {
  len: number;
  at: (u: number) => { yc: number; hy: number; hx: number };
  /** The cells of the eye on the +x side: its centre, and how far out the surface is there. */
  eye: { y: number; z: number; x: number };
}

const SUPER = 2.2;
const FUDGE = 0.35;
const defaultProf = (k: number) => (u: number) => Math.sin(Math.PI * (0.06 + 0.9 * u ** k)) ** 0.7;
/** How far out the surface is at height `y` in a section of half sizes `hx`, `hy`. */
const surface = (hx: number, hy: number, y: number) =>
  Math.floor((hx + FUDGE) * Math.max(0, 1 - (Math.abs(y) / (hy + FUDGE)) ** SUPER) ** (1 / SUPER));

function shapeOf(s: FishSpec): Shape {
  const prof = s.prof ?? defaultProf(s.k ?? 1.15);
  const at = (u: number) => {
    const p = prof(Math.min(1, Math.max(0, u)));
    return { yc: Math.round(s.bend?.(u) ?? 0), hy: Math.max(0.6, s.hi * p), hx: Math.max(0.6, s.wide * p) };
  };
  const ez = Math.round(0.84 * (s.len - 1));
  const { hy, hx } = at(ez / (s.len - 1));
  const ey = Math.round(0.25 * hy);
  return { len: s.len, at, eye: { y: ey, z: ez, x: surface(hx, hy, ey) } };
}

/** The body: an elliptic section at every step along z, coloured back, side and belly unless `mark` says. */
function body(g: Grid, s: FishSpec, f: Shape): void {
  for (let z = 0; z < s.len; z++) {
    const u = z / (s.len - 1);
    const { yc, hy, hx } = f.at(u);
    for (let y = Math.floor(-hy - FUDGE); y <= Math.ceil(hy + FUDGE); y++)
      for (let x = Math.floor(-hx - FUDGE); x <= Math.ceil(hx + FUDGE); x++) {
        if ((Math.abs(x) / (hx + FUDGE)) ** SUPER + (Math.abs(y) / (hy + FUDGE)) ** SUPER > 1) continue;
        const c: BodyCell = { u, t: (y + hy) / (2 * hy), s: x / hx, x, y, z };
        g.set(x, yc + y, z, s.mark?.(c) ?? (c.t > 0.64 ? s.back : c.t < 0.3 ? s.belly : s.side));
      }
  }
}

/** The fins on the body: dorsal, the side pair, the pelvic pair and the anal fin, a cell thick. */
function fins(g: Grid, s: FishSpec, f: Shape): void {
  const z = (u: number) => Math.round(u * (s.len - 1));
  const top = (zz: number) => {
    const { yc, hy } = f.at(zz / (s.len - 1));
    return yc + Math.floor(hy + FUDGE);
  };
  const ray = darken(s.fin, 0.25);
  const dorsal = (from: number, to: number, height: (v: number, zz: number) => number) => {
    for (let zz = z(from); zz <= z(to); zz++) {
      const v = (zz - z(from)) / Math.max(1, z(to) - z(from));
      const h = Math.round(height(v, zz));
      for (let i = 1; i <= h; i++) g.set(0, top(zz) + i, zz, i === h && zz % 2 === 0 ? ray : s.fin);
    }
  };
  if (s.dorsal === "spiny") dorsal(0.35, 0.72, (v, zz) => (zz % 2 ? 2 : 3) + Math.sin(Math.PI * v));
  else if (s.dorsal === "soft") dorsal(0.4, 0.66, (v) => 3 * Math.sin(Math.PI * v) + 0.4);
  else if (s.dorsal === "long") dorsal(0.25, 0.8, (v) => 1.6 + 1.4 * Math.sin(Math.PI * v ** 0.7));
  else if (s.dorsal === "rear") dorsal(0.12, 0.28, (v) => 3 * Math.sin(Math.PI * v) + 0.4);
  else if (s.dorsal === "ridge") dorsal(0.15, 0.85, () => 1);
  if (s.noFins) return;
  // Side fins, just behind the gills, swept back.
  const zp = z(0.7);
  const p = f.at(0.7);
  const yp = p.yc - Math.round(p.hy * 0.3);
  const xs = surface(p.hx, p.hy, yp - p.yc);
  for (const side of [-1, 1]) {
    for (let i = 0; i < 3; i++) g.set(side * (xs + 1), yp, zp - i, s.fin);
    for (let i = 0; i < 2; i++) g.set(side * (xs + 2), yp - 1, zp - 1 - i, ray);
  }
  // The pelvic pair and the anal fin, under the belly.
  const zb = z(0.5);
  const b = f.at(0.5);
  for (const side of [-1, 1]) {
    g.set(side, b.yc - Math.floor(b.hy + FUDGE) - 1, zb, s.fin);
    g.set(side, b.yc - Math.floor(b.hy + FUDGE) - 1, zb - 1, s.fin);
    g.set(side, b.yc - Math.floor(b.hy + FUDGE) - 2, zb - 1, ray);
  }
  for (let zz = z(0.16); zz <= z(0.3); zz++) {
    const a = f.at(zz / (s.len - 1));
    const low = a.yc - Math.floor(a.hy + FUDGE);
    g.set(0, low - 1, zz, s.fin);
    if (zz % 2 === 0) g.set(0, low - 2, zz, ray);
  }
}

/** Eyes on both sides, the mouth on the nose, and whiskers if it has them. */
function face(g: Grid, s: FishSpec, f: Shape): void {
  const { y, z, x } = f.eye;
  const yc = f.at(z / (s.len - 1)).yc;
  const lid = darken(s.side, 0.3);
  for (const side of [-1, 1]) {
    g.set(side * x, yc + y + 1, z - 1, s.sleepy ? lid : "#fffdf6");
    g.set(side * x, yc + y + 1, z, s.sleepy ? lid : "#fffdf6");
    g.set(side * x, yc + y, z - 1, "#fffdf6");
    g.set(side * x, yc + y, z, s.pupil ?? "#14121a");
  }
  const nose = s.len - 1;
  const n = f.at(1);
  const my = n.yc - Math.round(n.hy * 0.25);
  const lip = "#3a1f24";
  for (const dx of [-1, 0, 1]) if (g.has(dx, my, nose)) g.set(dx, my, nose, lip);
  if (s.mouth === "big")
    for (const dx of [-1, 0, 1]) if (g.has(dx, my - 1, nose)) g.set(dx, my - 1, nose, lip);
  if (s.barbels)
    for (const side of [-1, 1]) {
      const c = darken(s.side, 0.35);
      g.set(side, my - 1, nose + 1, c);
      g.set(side, my - 2, nose + 1, c);
      g.set(side, my - 3, nose, c);
    }
}

/** The tail on its own, from z = -1 back, a cell thick: forked, round, or a koi's long fan. */
function tailOf(s: FishSpec, f: Shape): Grid {
  const g = new Grid();
  const root = f.at(0);
  const fan = s.tail === "fan";
  const T = Math.round(s.len * (fan ? 0.38 : 0.28));
  const top = s.hi * (fan ? 1.35 : 1.05);
  const ray = darken(s.fin, 0.22);
  for (let d = 1; d <= T; d++) {
    const v = d / T;
    const ht =
      s.tail === "round"
        ? root.hy +
          (top * 0.85 - root.hy) * Math.sin((Math.PI / 2) * Math.min(1, v * 1.4)) * (v > 0.85 ? 0.75 : 1)
        : root.hy + (top - root.hy) * v ** 0.8;
    const gap = s.tail === "fork" && v > 0.5 ? ((v - 0.5) / 0.5) * top * 0.75 : -1;
    for (let y = -Math.round(ht); y <= Math.round(ht); y++) {
      if (Math.abs(y) < gap) continue;
      g.set(0, root.yc + y, -d, (y + d) % 3 === 0 ? ray : s.fin);
    }
  }
  return g;
}

/** Sweeps a ball of radius `r(u)` along a polyline, colouring by how far along and the offset from the line. */
function sweep(
  g: Grid,
  pts: readonly V3[],
  r: (u: number) => number,
  col: (u: number, off: V3) => Col,
): void {
  const segs = pts
    .slice(1)
    .map((p, i) => Math.hypot(p[0] - pts[i]![0], p[1] - pts[i]![1], p[2] - pts[i]![2]));
  const total = segs.reduce((a, b) => a + b, 0);
  let walked = 0;
  segs.forEach((len, i) => {
    const a = pts[i]!;
    const b = pts[i + 1]!;
    for (let k = 0; k <= len; k += 0.4) {
      const w = len ? k / len : 0;
      const p: V3 = [a[0] + (b[0] - a[0]) * w, a[1] + (b[1] - a[1]) * w, a[2] + (b[2] - a[2]) * w];
      const u = (walked + k) / total;
      const R = r(u);
      const n = Math.ceil(R);
      for (let dx = -n; dx <= n; dx++)
        for (let dy = -n; dy <= n; dy++)
          for (let dz = -n; dz <= n; dz++) {
            const x = Math.round(p[0] + dx);
            const y = Math.round(p[1] + dy);
            const z = Math.round(p[2] + dz);
            const off: V3 = [x - p[0], y - p[1], z - p[2]];
            if (Math.hypot(...off) <= R) g.set(x, y, z, col(u, off));
          }
    }
    walked += len;
  });
}

const fishy =
  (s: FishSpec): (() => { body: Grid; tail: Grid | null; opacity?: number }) =>
  () => {
    const f = shapeOf(s);
    const g = new Grid();
    body(g, s, f);
    fins(g, s, f);
    face(g, s, f);
    s.extra?.(g, f);
    let out = g;
    if (s.slip) {
      out = new Grid();
      g.each((x, y, z, c) => out.set(x, z >= s.len / 2 ? y - 1 : y, z, c));
    }
    return { body: out, tail: s.tail ? tailOf(s, f) : null, opacity: s.opacity };
  };

const lone =
  (build: () => Grid): (() => { body: Grid; tail: null }) =>
  () => ({ body: build(), tail: null });

/** Cells that hash under `p`, for spots and flecks that stay put. */
const fleck = (c: BodyCell, p: number, seed: number) => hash(c.x, c.y, c.z, seed) < p;

// MARK: The catches

const SCULPTS: Record<string, () => { body: Grid; tail: Grid | null; opacity?: number }> = {
  perch: fishy({
    len: 22,
    hi: 6,
    wide: 3,
    back: "#4d6b38",
    side: "#8db56b",
    belly: "#e6edc4",
    fin: "#e8873a",
    mark: (c) => (c.t > 0.28 && c.u > 0.18 && c.u < 0.8 && c.z % 5 < 2 ? "#3f5a2c" : undefined),
    tail: "fork",
    dorsal: "spiny",
  }),
  carp: fishy({
    len: 24,
    hi: 7,
    wide: 4,
    back: "#a8622c",
    side: "#db9c54",
    belly: "#f3d6a4",
    fin: "#c06a2e",
    mark: (c) => (c.t > 0.3 && (c.z + c.y + Math.abs(c.x)) % 3 === 0 ? "#b8743a" : undefined),
    tail: "fork",
    dorsal: "long",
    barbels: true,
  }),
  tench: fishy({
    len: 22,
    hi: 6,
    wide: 4,
    back: "#4f5f55",
    side: "#7f9a86",
    belly: "#c8d2b8",
    fin: "#5f6f66",
    pupil: "#c94a3a",
    sleepy: true,
    tail: "round",
    dorsal: "soft",
  }),
  pike: fishy({
    len: 30,
    hi: 4,
    wide: 3,
    k: 0.9,
    back: "#41604a",
    side: "#6e9275",
    belly: "#d7e2c4",
    fin: "#577a5c",
    mark: (c) => (c.t > 0.3 && c.t < 0.85 && fleck(c, 0.16, 4) ? "#c9dca0" : undefined),
    tail: "fork",
    dorsal: "rear",
    mouth: "big",
    extra: (g, f) => {
      // A duck-bill jaw, and teeth along it.
      const n = f.at(1);
      for (let d = 1; d <= 3; d++)
        for (const x of [-1, 0, 1]) {
          g.set(x, n.yc, f.len - 1 + d, "#577a5c");
          g.set(x, n.yc - 1, f.len - 1 + d, d % 2 ? "#fffdf6" : "#d7e2c4");
        }
    },
  }),
  duck: lone(() => {
    const g = new Grid();
    const Y = "#f3ce59";
    g.ell(0, 0, 0, 5, 4, 7, (c) => (Math.abs(c.x) >= 4 && c.y > -2 && c.y < 2 && c.z < 3 ? "#d9a92e" : Y));
    g.ell(0, 3, -6, 2, 2.5, 2.5, Y);
    g.ell(0, 6, 4, 3.6, 3.6, 3.6, Y);
    g.box(-2, 2, 4, 5, 8, 10, "#f08a2c");
    g.box(-1, 1, 3, 3, 8, 9, "#d9701c");
    for (const s of [-1, 1]) {
      g.set(s * 3, 7, 6, "#14121a");
      g.set(s * 3, 8, 6, "#fffdf6");
    }
    // Floats: flat underneath.
    const under: V3[] = [];
    g.each((x, y, z) => {
      if (y < -3) under.push([x, y, z]);
    });
    for (const [x, y, z] of under) g.del(x, y, z);
    return g;
  }),
  golden: fishy({
    len: 24,
    hi: 6,
    wide: 4,
    back: "#f0b840",
    side: "#f6cc6c",
    belly: "#fbe6ae",
    fin: "#f0a830",
    mark: (c) =>
      fleck(c, 0.03, 9) && c.t > 0.5
        ? "*#fff3b0"
        : noise(c.x / 3, c.y / 3, c.z / 3, 7) > 0.62
          ? "#fffdf6"
          : undefined,
    tail: "fan",
    dorsal: "long",
    barbels: true,
  }),
  bug: lone(() => {
    const g = new Grid();
    const shell = "#4f6b3a";
    const dark = "#2f3d25";
    g.ell(0, 0, 0, 5, 3, 7, (c) =>
      c.x === 0 && c.y > 0 ? dark : hash(c.x, c.y, c.z, 2) < 0.08 && c.y > 1 ? "#9cc27a" : shell,
    );
    g.ell(0, 0, 8, 3, 2, 2, dark);
    for (const s of [-1, 1]) {
      g.set(s * 2, 1, 9, "#14121a");
      for (const z of [-3, 0, 3])
        sweep(
          g,
          [
            [s * 4, -1, z],
            [s * 7, -1, z + Math.sign(z)],
            [s * 8, -3, z + 2 * Math.sign(z || 1)],
          ],
          () => 0.8,
          () => dark,
        );
      sweep(
        g,
        [
          [s, 1, 9],
          [s * 3, 3, 13],
        ],
        () => 0.7,
        () => dark,
      );
    }
    return g;
  }),
  boot: lone(() => {
    const g = new Grid();
    const leather = "#7a5236";
    g.box(-3, 3, 0, 10, -3, 2, (c) => (c.y >= 10 ? lighten(leather, 0.15) : leather));
    g.box(-3, 3, 0, 4, -3, 8, leather);
    g.ell(0, 2, 8, 3, 2.5, 2.5, leather);
    g.box(-3, 3, -1, -1, -4, 10, "#3d2a1e");
    // Laces up the front.
    for (let y = 4; y <= 9; y++) for (const x of y % 2 ? [-2, 1] : [-1, 2]) g.set(x, y, 2, "#e8dcc4");
    // Still dripping.
    for (const [x, y, z] of [
      [1, -3, 9],
      [-1, -5, 6],
      [0, -7, 9],
    ] as V3[])
      g.set(x, y, z, "#7fc4ea");
    return g;
  }),
  herring: fishy({
    len: 22,
    hi: 4.5,
    wide: 2.5,
    back: "#d9534a",
    side: "#e9e4e0",
    belly: "#f6f2ee",
    fin: "#b53a33",
    mark: (c) => (c.t > 0.55 ? "#d9534a" : undefined),
    tail: "fork",
    dorsal: "soft",
  }),
  spaghetti: lone(() => {
    const g = new Grid();
    const rand = seeded(42);
    for (let i = 0; i < 6; i++) {
      const R = 5 + rand() * 1.6;
      const tilt = rand() * Math.PI;
      const yaw = rand() * Math.PI * 2;
      const pts: V3[] = [];
      for (let a = 0; a <= Math.PI * 2 + 0.01; a += Math.PI / 8) {
        const x0 = R * Math.cos(a);
        const y0 = R * Math.sin(a) * Math.cos(tilt);
        const z0 = R * Math.sin(a) * Math.sin(tilt);
        pts.push([x0 * Math.cos(yaw) - z0 * Math.sin(yaw), y0, x0 * Math.sin(yaw) + z0 * Math.cos(yaw)]);
      }
      sweep(
        g,
        pts,
        () => 0.6,
        (u) => (hash(i, Math.round(u * 20), 0, 5) < 0.5 ? "#f0d27a" : "#e3bf5c"),
      );
    }
    for (const [x, z] of [
      [-2, 1],
      [2, -1],
      [0, 3],
    ])
      sweep(
        g,
        [
          [x!, -4, z!],
          [x! + 1, -8, z! + 1],
          [x!, -11, z! - 1],
        ],
        () => 0.6,
        () => "#f0d27a",
      );
    // The meatball, big enough to see through the noodles.
    g.ell(0, 0, 0, 4.6, 4.6, 4.6, (c) =>
      noise(c.x / 2, c.y / 2, c.z / 2, 3) > 0.6
        ? "#6e3a20"
        : hash(c.x, c.y, c.z, 1) < 0.15
          ? "#a85a34"
          : "#8a4a2a",
    );
    return g;
  }),
  offbyone: fishy({
    len: 22,
    hi: 6.5,
    wide: 3.5,
    back: "#2f5f80",
    side: "#5f8fb0",
    belly: "#cfe0ea",
    fin: "#3f6f90",
    mark: (c) => (c.t > 0.44 && c.t < 0.56 && c.u < 0.8 ? "#2f4f6a" : undefined),
    tail: "fork",
    dorsal: "spiny",
    mouth: "big",
    slip: true,
  }),
  eel: fishy({
    len: 38,
    hi: 2.4,
    wide: 2.2,
    prof: (u) => (0.35 + 0.65 * Math.min(1, u / 0.7)) * (u > 0.93 ? 0.8 : 1),
    bend: (u) => 3.2 * Math.sin(u * Math.PI * 2.4),
    back: "#4a4f6a",
    side: "#5a5f7a",
    belly: "#9a9fb8",
    fin: "#7a7f9a",
    dorsal: "ridge",
    noFins: true,
  }),
  float: fishy({
    len: 20,
    hi: 5.5,
    wide: 3,
    back: "#5fa8ad",
    side: "#9ad1d4",
    belly: "#e1f3f2",
    fin: "#5fa8ad",
    mark: (c) => (c.t > 0.4 && fleck(c, 0.12, 6) ? "#5fa8ad" : undefined),
    tail: "fork",
    dorsal: "soft",
    // One cell came loose and drifted off behind it.
    extra: (g) => g.set(0, 4, -10, "#9ad1d4"),
  }),
  kraken: lone(() => {
    const g = new Grid();
    const pts: V3[] = [];
    for (let i = 0; i <= 40; i++) {
      const s = i / 40;
      const ang = -Math.PI / 2 + s * Math.PI * 2.3;
      const R = 10 * (1 - s * 0.82);
      pts.push([0, 10 + R * Math.sin(ang), R * Math.cos(ang)]);
    }
    sweep(
      g,
      pts,
      (u) => 3.4 - 2.5 * u,
      (u, off) => {
        const i = Math.min(39, Math.floor(u * 40));
        const p = pts[i]!;
        // The suckers face the curl's middle.
        const inward = -(off[1] * (p[1] - 10) + off[2] * p[2]) / (Math.hypot(p[1] - 10, p[2]) || 1);
        if (inward > 0.6 && Math.round(u * 40) % 3 === 0) return "#e0b8f0";
        return off[0] * off[0] > 4 ? "#7a42aa" : inward < -1.2 ? "#6a3a99" : "#8a4fbf";
      },
    );
    return g;
  }),
  trout: fishy({
    len: 24,
    hi: 5.5,
    wide: 3,
    back: "#6f8fa8",
    side: "#b9cad6",
    belly: "#eef3f6",
    fin: "#7f9fb8",
    mark: (c) =>
      c.t > 0.4 && c.t < 0.55 ? "#e88aa8" : c.t > 0.55 && fleck(c, 0.12, 8) ? "#3f4f60" : undefined,
    tail: "fork",
    dorsal: "soft",
  }),
  ghost: fishy({
    len: 24,
    hi: 7,
    wide: 4,
    back: "#c8d6e6",
    side: "#dfe7ef",
    belly: "#f0f6fc",
    fin: "#c8d6e6",
    pupil: "#28324a",
    tail: "fork",
    dorsal: "long",
    barbels: true,
    opacity: 0.55,
  }),
  puffer: fishy({
    len: 16,
    hi: 6.5,
    wide: 5.5,
    prof: (u) => Math.max(0.12, Math.sqrt(Math.max(0, 1 - (2 * u - 1) ** 2))) ** 0.8,
    back: "#d9a03a",
    side: "#e8b04a",
    belly: "#f6e2a8",
    fin: "#c98a2a",
    mark: (c) => (c.t > 0.55 && fleck(c, 0.08, 3) ? "#8a6420" : undefined),
    tail: "round",
    extra: (g, f) => {
      // Spines out of the surface, all over.
      const mid = f.len / 2;
      const spines: [number, number, number][] = [];
      g.each((x, y, z) => {
        if (hash(x, y, z, 12) > 0.09) return;
        const d = Math.hypot(x, y, z - mid) || 1;
        const o: V3 = [Math.round(x / d), Math.round(y / d), Math.round((z - mid) / d)];
        if (!g.has(x + o[0], y + o[1], z + o[2])) spines.push([x + o[0], y + o[1], z + o[2]]);
      });
      for (const [x, y, z] of spines) g.set(x, y, z, "#8a6420");
    },
  }),
  leet: fishy({
    len: 22,
    hi: 6.5,
    wide: 3.5,
    back: "#1f8a50",
    side: "#3ddc84",
    belly: "#c8f5dc",
    fin: "#1f8a50",
    mark: (c) => (c.t > 0.44 && c.t < 0.56 && c.u < 0.8 ? "#1f6a40" : undefined),
    tail: "fork",
    dorsal: "spiny",
    mouth: "big",
    extra: (g, f) => {
      // Shades: a black lens over each eye and a bridge over the snout.
      const { y, z, x } = f.eye;
      for (const s of [-1, 1])
        for (let dy = -1; dy <= 2; dy++)
          for (let dz = -2; dz <= 1; dz++)
            g.set(s * (x + 1), y + dy, z + dz, dy === 2 && dz === -2 ? "*#3ddc84" : "#14121a");
      for (let dx = -x; dx <= x; dx++) g.set(dx, y + 2, z + 2, "#14121a");
    },
  }),
  notfound: lone(() => {
    const g = new Grid();
    const steel = (u: number) => (u > 0.92 ? "#e6e9ee" : "#c9ced6");
    const hook: V3[] = [
      [0, 11, 0],
      [0, -2, 0],
    ];
    for (let a = Math.PI; a <= Math.PI * 2 + 0.01; a += Math.PI / 10)
      hook.push([0, -2 + 3 * Math.sin(a), 3 - 3 * Math.cos(a)]);
    hook.push([0, 0, 6], [0, -1, 5]);
    sweep(g, hook, () => 0.8, steel);
    g.ell(0, 12, 0, 1, 1.4, 1.4, "#8e95a3");
    // The question mark where a fish should be.
    const q: V3[] = [];
    for (let a = (Math.PI * 5) / 6; a >= -Math.PI / 3; a -= Math.PI / 10)
      q.push([0, 7 + 3 * Math.sin(a), -8 + 3 * Math.cos(a)]);
    q.push([0, 2.5, -8]);
    sweep(
      g,
      q,
      () => 0.9,
      () => "*#ffb347",
    );
    g.ell(0, -0.5, -8, 1, 1, 1, "*#ffb347");
    return g;
  }),
};

/** Some catches are small things: they're held up a bit bigger so they read. */
const SCALE: Record<string, number> = { bug: 1.5, duck: 1.25, notfound: 1.1 };

/** Builds a catch: the body (and tail) baked, centred, nose to +x. */
export function buildFish(id: string): FishRig {
  const root = new THREE.Group();
  root.name = `fish:${id}`;
  root.userData.nopick = true;
  root.userData.noBlock = true;
  const sculpt = SCULPTS[id];
  if (!sculpt) return { root, tail: null };
  const { body: g, tail: t, opacity } = sculpt();
  const b = g.bounds();
  const turned = new THREE.Group();
  turned.rotation.y = Math.PI / 2;
  turned.scale.setScalar(SCALE[id] ?? 1);
  root.add(turned);
  const cx = (b.x0 + b.x1) / 2;
  const cy = (b.y0 + b.y1) / 2;
  const cz = (b.z0 + b.z1) / 2;
  const mesh = bake(g, { origin: [cx, cy, cz], seed: 3, ...(opacity !== undefined && { opacity }) });
  turned.add(mesh);
  let tail: THREE.Object3D | null = null;
  if (t) {
    const tm = bake(t, { origin: [0, cy, -0.5], seed: 4, ...(opacity !== undefined && { opacity }) });
    tm.position.set(-cx * VOX, 0, (-0.5 - cz) * VOX);
    turned.add(tm);
    tail = tm;
  }
  return { root, tail };
}

/** The ids that have a sculpture: every fish in the pond. */
export const sculpted = (): string[] => Object.keys(SCULPTS);
