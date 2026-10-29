/**
 * The Night Market case's pets (core/src/case.ts, pet.200 to pet.205) as voxel sculptures on the same `petvox`
 * grid as the others: a koi, a paper crane, a tanuki pup, a maneki cat, the nine-tailed kitsune with a lantern
 * on every tail, and the tengu. Cells whose colour starts with "*" glow (the lanterns, the neon sparks).
 */
import type * as THREE from "three";
import { light } from "../furniture/furniture.ts";
import { Model, type V3 } from "../kit/kit.ts";
import { bake, type Cell, eye, Grid, hash, mix, noise, type Rig, VOX } from "./petvox.ts";

export const SIDES = [-1, 1] as const;
export const U = (n: number) => n * VOX;
export const DARK = "#14101c";
export const GLINT = "#f4f6ff";
export type Built = { rig: Rig; body: Model; fore: Model };

/** A mesh from a grid, placed at `at` (cells). Its origin is the grid's own (0, 0, 0). */
export function put(
  parent: THREE.Object3D,
  g: Grid,
  at: V3 = [0, 0, 0],
  seed = 0,
  opacity = 1,
  flat = false,
): THREE.Mesh {
  const m = bake(g, { seed, opacity, flat });
  m.position.set(U(at[0]), U(at[1]), U(at[2]));
  parent.add(m);
  return m;
}

/** An empty group at `at` (cells), for a part that swings from its own joint. */
export function joint(parent: THREE.Object3D, at: V3, rotY = 0): Model {
  const m = new Model();
  m.position.set(U(at[0]), U(at[1]), U(at[2]));
  m.rotation.y = rotY;
  parent.add(m);
  return m;
}

export const speckle = (c: Cell, a: string, b: string, seed: number, k = 0.3) =>
  hash(c.x, c.y, c.z, seed) < k * 0.8 ? mix(a, b, 0.55) : a;

// MARK: Koi

/** A koi, white with orange and black patches, swimming through the air with a gentle wave in its tail. */
export function koi(): Built {
  const body = new Model();
  const fore = new Model();
  const WHITE = "#fbf6ee";
  const ORANGE = "#ff7a2a";
  const INK = "#241f2b";
  const bg = new Grid();
  bg.ell(0, 0, 0, 3.6, 4, 10, WHITE, 2.3);
  bg.paint((c) => {
    if (c.u > 0.8 && c.t > 0.55) return "#ff5a1f";
    const m = noise(c.x * 0.5 + 9, c.y * 0.5, c.z * 0.4, 8);
    if (m > 0.72 && c.t > 0.4 && c.u < 0.85) return INK;
    if (noise(c.x * 0.28, c.y * 0.28, c.z * 0.22, 4) > 0.56 && c.t > 0.2)
      return hash(c.x, c.y, c.z, 5) < 0.18 ? "#ff9244" : ORANGE;
    return hash(c.x, c.y, c.z, 6) < 0.1 ? "#f1e8dc" : WHITE;
  });
  // Dorsal fin, whiskers, mouth.
  for (let z = -5; z <= 3; z++) bg.box(0, 0, 5, 5 + Math.max(1, 3 - Math.abs(z + 1) * 0.5), z, z, "#ff9244");
  for (const s of SIDES) {
    bg.set(s, -1, 9, "#ffb36b")
      .set(s * 2, -2, 10, "#ffb36b")
      .set(s * 3, -3, 11, "#ffb36b");
  }
  bg.box(-1, 1, -2, -2, 8, 8, "#d84a1c");
  put(body, bg, [0, 0, 0], 1);
  // Pectoral fins: they paddle.
  const fins = SIDES.map((s) => {
    const j = joint(body, [s * 4, -2, 3]);
    const g = new Grid();
    for (let i = 1; i <= 4; i++)
      g.box(s * i, s * i, 0, 0, -i * 0.5, i * 0.5 + 1, i > 2 ? "#ffd1a8" : "#fff6ea");
    put(j, g, [0, 0, 0], 2);
    return { j, s };
  });
  const head = joint(body, [0, 0, 6]);
  const eyes: THREE.Mesh[] = [];
  for (const s of SIDES) {
    const e = eye([
      [DARK, DARK],
      [DARK, GLINT],
    ]);
    e.rotation.y = s * 1.15;
    e.position.set(U(s * 3.3), U(1.6), U(1.2));
    head.add(e);
    eyes.push(e);
  }
  // The tail: a fan of fin, white at the root and orange at the edge.
  const tail = joint(body, [0, 0, -9.5]);
  const tg = new Grid();
  for (let i = 0; i < 10; i++) {
    const h = 1 + Math.floor(i * 0.55);
    tg.box(-1, 0, -h, h, -i, -i, (c) =>
      i < 3 ? "#fff6ea" : hash(c.x, c.y, c.z, 1) < 0.5 ? "#ff9244" : "#ffd1a8",
    );
    if (i > 6) tg.del(0, 0, -i).del(-1, 0, -i);
  }
  put(tail, tg, [0, 0, 0], 3);
  return {
    rig: {
      head,
      eyes,
      fore: [],
      hind: [],
      tails: [tail],
      neck: [0, U(-2), U(-2)],
      neckR: U(4),
      top: [0, U(5), 0],
      tilt: false,
      float: 0.5,
      span: U(2),
      fx: (t, moving) => {
        body.rotation.y = Math.sin(t * (moving ? 5 : 1.8)) * 0.14;
        body.rotation.x = Math.sin(t * 1.3) * 0.04;
        for (const f of fins) f.j.rotation.z = f.s * (0.4 + Math.sin(t * 3 + f.s) * 0.3);
        tail.rotation.y = Math.sin(t * (moving ? 9 : 3.2) - 1) * 0.45;
      },
    },
    body,
    fore,
  };
}

// MARK: Paper crane

/** A folded paper crane: white with a red beak and tail tip. Its wings flap when the owner walks. */
export function crane(): Built {
  const body = new Model();
  const fore = new Model();
  const W = "#fbf8f2";
  const SH = "#d6dbe8";
  const RED = "#e0405a";
  const bg = new Grid();
  bg.ell(0, 0, 0, 3.4, 3.2, 6.4, (c) => (c.x > 0 ? W : SH), 1.35);
  bg.paint((c) => (c.t > 0.85 ? "#c3c9d9" : c.x === 0 ? "#eef1f8" : c.x > 0 ? W : SH));
  bg.tube(
    [
      [0, 1, 5],
      [0, 6, 7],
      [0, 10, 8],
    ],
    1.5,
    1,
    (c) => (c.x >= 0 ? W : SH),
  );
  bg.tube(
    [
      [0, 0, -5],
      [0, 1, -9],
      [0, 4, -13],
    ],
    2,
    0.6,
    (c) => (c.u > 0.8 ? RED : c.x >= 0 ? W : SH),
  );
  put(body, bg, [0, 0, 0], 1);
  const head = joint(body, [0, 11, 9]);
  const hg = new Grid();
  hg.ell(0, 0, 0, 1.7, 1.7, 1.8, W);
  hg.box(0, 0, -1, 0, 2, 4, RED);
  hg.set(0, 0, 5, "#a82a3c");
  put(head, hg, [0, 0, 0], 2);
  const eyes: THREE.Mesh[] = [];
  for (const s of SIDES) {
    const e = eye([[DARK]]);
    e.rotation.y = s * (Math.PI / 2);
    e.position.set(U(s * 1.75), U(0.6), U(0.6));
    head.add(e);
    eyes.push(e);
  }
  // Wings: a folded triangle each, a crease down the middle and a red edge on the tip.
  const wings = SIDES.map((s) => {
    const j = joint(body, [s * 2, 2, 0]);
    const g = new Grid();
    for (let x = 1; x <= 11; x++) {
      const zb = -6 + Math.round(x * 0.45);
      const zf = 4 - Math.round(x * 0.35);
      if (zb > zf) break;
      const mid = Math.round((zb + zf) / 2);
      for (let z = zb; z <= zf; z++) {
        g.set(s * x, 0, z, x >= 10 ? RED : z === mid ? "#c3c9d9" : z > mid ? W : "#eef1f8");
        if (x <= 8 && z > zb && z < zf) g.set(s * x, -1, z, SH);
      }
    }
    put(j, g, [0, 0, 0], 4);
    return { j, s };
  });
  return {
    rig: {
      head,
      eyes,
      fore: [],
      hind: [],
      tails: [],
      neck: [0, U(-6), U(-1)],
      neckR: U(1.7),
      top: [0, U(2), 0],
      tilt: false,
      float: 0.5,
      span: U(2),
      fx: (t, moving) => {
        const a = Math.sin(t * (moving ? 15 : 3.4)) * (moving ? 0.8 : 0.28);
        for (const w of wings) w.j.rotation.z = w.s * (a + 0.12);
        body.rotation.x = moving ? -0.12 : Math.sin(t * 1.7) * 0.03;
        head.rotation.y = Math.sin(t * 0.9) * 0.15;
      },
    },
    body,
    fore,
  };
}

// MARK: Tanuki pup

/** A round brown-grey pup with a leaf on its head, a dark mask over its eyes and a ringed tail. */
export function tanuki(): Built {
  const body = new Model();
  const fore = new Model();
  const BROWN = "#8d7a68";
  const DK = "#4a3b33";
  const CREAM = "#e6d5b5";
  const bg = new Grid();
  bg.ell(0, 7, 0, 6.8, 6.2, 7.8, BROWN, 2.2);
  bg.paint((c) => {
    if (c.t < 0.42 && c.u > 0.3) return speckle(c, CREAM, "#d4c19c", 2, 0.25);
    if (c.t > 0.82) return "#76655a";
    return speckle(c, BROWN, "#7a6858", 3, 0.3);
  });
  put(body, bg, [0, 0, 0], 1);
  // Four short dark legs.
  const legs: THREE.Mesh[] = [];
  for (const [x, z] of [
    [-3.8, 4.5],
    [3.8, 4.5],
    [-3.8, -4.5],
    [3.8, -4.5],
  ] as const) {
    const lg = new Grid();
    lg.box(-1, 1, -3, 0, -1, 1, "#3b2f2a");
    legs.push(put(body, lg, [x, 4, z], 5));
  }
  const head = joint(body, [0, 13, 5]);
  const hg = new Grid();
  hg.ell(0, 0, 0, 6.6, 5.6, 6, (c) => speckle(c, BROWN, "#7a6858", 6, 0.25), 2.2);
  hg.ell(0, -1.6, 4.4, 3.2, 2.4, 2.4, CREAM);
  hg.box(-1, 0, 0, 0, 7, 7, DARK);
  hg.set(1, 0, 7, DARK);
  for (const s of SIDES) {
    hg.ell(s * 3.4, 1.2, 3.8, 2.5, 2.1, 2.1, DK);
    hg.ell(s * 4.9, 5.2, -0.8, 1.9, 1.9, 1.4, "#3b2f2a");
    hg.set(s * 4.9, 5.2, 0.6, "#c9a98a");
  }
  put(head, hg, [0, 0, 0], 2);
  const eyes: THREE.Mesh[] = [];
  for (const s of SIDES) {
    const e = eye([
      [DARK, DARK],
      [DARK, GLINT],
    ]);
    e.position.set(U(s * 3.2), U(1.3), U(5.8));
    head.add(e);
    eyes.push(e);
  }
  // The leaf, a little askew.
  const leaf = joint(head, [0.5, 6.4, 0.5]);
  const lg = new Grid();
  for (let z = -5; z <= 5; z++) {
    const hw = Math.round(3.4 * Math.sin(((z + 5.5) / 11) * Math.PI));
    for (let x = -hw; x <= hw; x++)
      lg.set(x, 0, z, x === 0 ? "#2f7d3a" : hash(x, 0, z, 9) < 0.15 ? "#74d482" : "#5cc16a");
    if (hw >= 1 && z % 2 === 0) lg.set(hw > 2 ? 1 : 0, 0, z, "#3f9a4c");
  }
  lg.box(0, 0, 0, 0, -7, -6, "#2f7d3a");
  put(leaf, lg, [0, 0, 0], 3);
  leaf.rotation.set(-0.22, 0.4, 0.3);
  // Tail: ringed, round.
  const tail = joint(body, [0, 6, -8]);
  const tg = new Grid();
  tg.ell(0, 2, -3, 3, 3.2, 5, (c) => (Math.floor((c.z + 100) / 2) % 2 ? "#5a4a40" : BROWN), 2.2);
  put(tail, tg, [0, 0, 0], 4);
  const idle = legs.map((l) => l.position.z);
  return {
    rig: {
      head,
      eyes,
      fore: [],
      hind: [],
      tails: [tail],
      neck: [0, U(-4), U(1)],
      neckR: U(5),
      top: [0, U(6), 0],
      tilt: false,
      span: U(2),
      fx: (t, moving) => {
        legs.forEach((l, i) => {
          l.rotation.x = moving ? Math.sin(t * 13 + (i % 2 ? Math.PI : 0) + (i > 1 ? 1.5 : 0)) * 0.7 : 0;
          l.position.z = idle[i]!;
        });
        leaf.rotation.z = 0.3 + Math.sin(t * 2) * 0.05;
      },
    },
    body,
    fore,
  };
}

// MARK: Maneki cat

/** A white lucky cat: one paw up and waving, a gold bell on a red collar, a coin held in the other paw. */
export function maneki(): Built {
  const body = new Model();
  const fore = new Model();
  const W = "#fbf8f2";
  const GOLD = "#f5c842";
  const RED = "#d6303a";
  const bg = new Grid();
  bg.ell(0, 6, -1, 5.8, 6.4, 5.2, W, 2.3);
  for (const s of SIDES) {
    bg.ell(s * 4, 3, 0, 2.4, 3, 3.6, W);
    bg.ell(s * 2.4, 1.2, 4, 1.8, 1.2, 2.2, W);
  }
  bg.paint((c) =>
    noise(c.x * 0.4, c.y * 0.4, c.z * 0.4, 3) > 0.7 && c.t > 0.5 && c.x < 0
      ? "#2a2630"
      : speckle(c, W, "#ece7de", 4, 0.2),
  );
  // Collar, bell and the coin held at the belly (the left arm).
  for (let i = 0; i < 40; i++) {
    const a = (i / 40) * Math.PI * 2;
    for (const y of [11, 12]) bg.set(Math.cos(a) * 5.4, y, -1 + Math.sin(a) * 4.9, RED);
  }
  bg.ell(0, 9.2, 4.6, 1.9, 1.9, 1.6, GOLD);
  bg.set(0, 8, 6, "#8c6a12");
  bg.set(-1, 10, 6, "#fff2a8");
  bg.tube(
    [
      [-4, 9, 1],
      [-4.2, 6, 3],
      [-2, 5, 5],
    ],
    1.7,
    1.6,
    W,
  );
  bg.ell(-2.2, 5.5, 6, 2.8, 3.6, 1, GOLD);
  bg.box(-2, -2, 4, 7, 7, 7, "#c9971f");
  bg.box(-4, -1, 5, 5, 7, 7, "#c9971f");
  put(body, bg, [0, 0, 0], 1);
  const head = joint(body, [0, 15.5, 1]);
  const hg = new Grid();
  hg.ell(0, 0, 0, 7, 5.6, 5.2, W, 2.2);
  hg.paint((c) => (c.x < -1 && c.y > 1.5 ? "#f0a040" : speckle(c, W, "#ece7de", 7, 0.15)));
  for (const s of SIDES)
    for (let j = 0; j < 4; j++) {
      const w = Math.round(2 - j * 0.5);
      hg.box(s * 4.5 - w, s * 4.5 + w, 4 + j, 4 + j, -1, 0, s < 0 && j < 3 ? "#f0a040" : W);
      if (j < 3)
        hg.box(s * 4.5 - Math.max(0, w - 1), s * 4.5 + Math.max(0, w - 1), 4 + j, 4 + j, 1, 1, "#f2a0b0");
    }
  hg.set(0, 0, 5, "#f2a0b0");
  hg.set(-1, -1, 5, DARK).set(1, -1, 5, DARK).set(0, -2, 5, DARK);
  for (const s of SIDES)
    for (const [dx, dy] of [
      [0, 1],
      [0, 0],
      [0, -1],
    ] as const)
      hg.set(s * (7 + dx), dy - 1, 2, DARK).set(s * 8, dy * 2 - 1, 2, DARK);
  put(head, hg, [0, 0, 0], 2);
  const eyes: THREE.Mesh[] = [];
  for (const s of SIDES) {
    const e = eye([
      ["", DARK, DARK, ""],
      [DARK, "", "", DARK],
    ]);
    e.position.set(U(s * 2.7), U(1), U(5.2));
    head.add(e);
    eyes.push(e);
  }
  // The raised paw.
  const arm = joint(body, [5, 9, 1.5]);
  const ag = new Grid();
  ag.tube(
    [
      [0, 0, 0],
      [1.5, 5, 0.5],
      [2, 9, 1],
    ],
    1.9,
    1.8,
    W,
  );
  ag.ell(2, 11, 1.2, 2.5, 2.7, 2.2, W);
  ag.set(2, 10, 3.4, "#f2a0b0")
    .set(1, 11, 3.4, "#f2a0b0")
    .set(3, 11, 3.4, "#f2a0b0")
    .set(2, 11, 3.4, "#f2a0b0");
  ag.set(1, 12, 3.4, "#e5dfd3").set(3, 12, 3.4, "#e5dfd3");
  put(arm, ag, [0, 0, 0], 3);
  const tail = joint(body, [0, 2, -5]);
  const tg = new Grid();
  tg.tube(
    [
      [0, 0, 0],
      [0, 1, -4],
      [0, 5, -5],
    ],
    1.5,
    1.3,
    (c) => (c.u > 0.75 ? "#f0a040" : W),
  );
  put(tail, tg, [0, 0, 0], 5);
  return {
    rig: {
      head,
      eyes,
      fore: [],
      hind: [],
      tails: [tail],
      neck: [0, U(-5), U(1)],
      neckR: U(5.5),
      top: [0, U(6), 0],
      tilt: false,
      span: U(0),
      fx: (t, moving) => {
        arm.rotation.z = -0.25 + Math.sin(t * (moving ? 9 : 4.5)) * 0.4;
        arm.rotation.x = 0.05;
        head.rotation.z = Math.sin(t * 1.4) * 0.04;
        body.position.y += Math.abs(Math.sin(t * 9)) * (moving ? 0.01 : 0);
      },
    },
    body,
    fore,
  };
}

// MARK: Kitsune

/** A nine-tailed fox, each tail tipped with a small glowing paper lantern, a soft glow round it. */
export function kitsune(): Built {
  const body = new Model();
  const fore = new Model();
  const ORANGE = "#ff9a3c";
  const CREAM = "#fff3dc";
  const SOCK = "#3a2a2a";
  const bg = new Grid();
  bg.ell(0, 9, 0, 4.2, 4.2, 8, ORANGE, 2.3);
  bg.paint((c) => (c.t < 0.32 || (c.u > 0.8 && c.t < 0.7) ? CREAM : speckle(c, ORANGE, "#ffb35c", 2, 0.25)));
  // A red rope collar with a gold bell.
  for (let i = 0; i < 32; i++) {
    const a = (i / 32) * Math.PI * 2;
    bg.set(Math.cos(a) * 3.6, 10.4 + Math.sin(a) * 3.2, 7.6, "#d8362f");
  }
  put(body, bg, [0, 0, 0], 1);
  const fores: THREE.Mesh[] = [];
  const hinds: THREE.Mesh[] = [];
  for (const [x, z, arr] of [
    [-2.6, 5, fores],
    [2.6, 5, fores],
    [-2.6, -4.5, hinds],
    [2.6, -4.5, hinds],
  ] as const) {
    const lg = new Grid();
    lg.box(-1, 1, -5, 0, -1, 1, (c) => (c.y < -2 ? SOCK : ORANGE));
    arr.push(put(body, lg, [x, 6, z], 3));
  }
  const head = joint(body, [0, 12.5, 7.5]);
  const hg = new Grid();
  hg.ell(0, 0, 0, 4, 3.6, 4, ORANGE, 2.2);
  hg.ell(0, -1.2, 4.2, 1.9, 1.5, 2.6, CREAM);
  hg.set(0, -0.4, 7, DARK).set(1, -0.4, 7, DARK).set(-1, -0.4, 7, DARK);
  for (const s of SIDES) {
    hg.ell(s * 3.2, -1.2, 1.6, 1.7, 1.4, 2.2, CREAM);
    for (let j = 0; j < 6; j++) {
      const w = Math.max(0, Math.round(1.7 - j * 0.3));
      hg.box(s * 2.6 - w, s * 2.6 + w, 3 + j, 3 + j, -1, 0, j >= 4 ? SOCK : ORANGE);
      if (j >= 1 && j <= 3) hg.set(s * 2.6, 3 + j, 1, CREAM);
    }
    // Red face stripes, like a kabuki fox.
    hg.set(s * 3.4, -0.2, 3, "#d8362f").set(s * 3.6, -1.2, 2.6, "#d8362f");
  }
  hg.box(0, 0, 3, 3, 3, 3, "#d8362f");
  put(head, hg, [0, 0, 0], 2);
  const eyes: THREE.Mesh[] = [];
  for (const s of SIDES) {
    const e = eye([
      [DARK, DARK],
      [DARK, GLINT],
    ]);
    e.rotation.z = -s * 0.25;
    e.position.set(U(s * 2.2), U(0.9), U(3.55));
    head.add(e);
    eyes.push(e);
  }
  // Nine tails in a fan, a lantern on each tip.
  const tailsAt = joint(body, [0, 10, -7]);
  const tails: Model[] = [];
  for (let i = 0; i < 9; i++) {
    const a = ((i - 4) / 4) * 1.3;
    const sa = Math.sin(a);
    const ca = Math.cos(a);
    const end: V3 = [sa * 15, ca * 12 + 2, -6 - ca * 3];
    const mid: V3 = [sa * 6.5, ca * 5.5 + 1.5, -4.5];
    const pivot = joint(tailsAt, [sa * 1.2, 0, 0]);
    const tg = new Grid();
    tg.tube(
      [[0, 0, 0], mid, end],
      1.7,
      1.1,
      (c) => (c.u > 0.7 ? CREAM : speckle(c, ORANGE, "#ffb35c", 4 + i, 0.3)),
      2.2,
    );
    put(pivot, tg, [0, 0, 0], 6 + i);
    // The lantern: lit paper between a red cap and a red base, hung off the tip.
    const lg = new Grid();
    lg.box(-1, 1, -2, 2, -1, 1, (c) => (c.y % 3 === 0 ? "*#ff8a2a" : "*#ffd166"));
    lg.box(-2, 2, 3, 3, -2, 2, "#c8322a");
    lg.box(-2, 2, -3, -3, -2, 2, "#c8322a");
    lg.box(0, 0, 4, 4, 0, 0, "#7a1d18");
    const tip: V3 = [end[0], end[1] + 3.5, end[2]];
    put(pivot, lg, tip, 2, 1, true).castShadow = false;
    const halo = new Grid();
    halo.ell(0, 0, 0, 4.5, 5, 4.5, "#ffb347", 2);
    const hm = put(pivot, halo, tip, 0, 0.16, true);
    hm.castShadow = hm.receiveShadow = false;
    tails.push(pivot);
  }
  light(body, [0, 0.35, -0.25], "#ffb347", 1.1, 3.2);
  return {
    rig: {
      head,
      eyes,
      fore: fores,
      hind: hinds,
      tails: [],
      neck: [0, U(-3), U(-1)],
      neckR: U(4),
      top: [0, U(6), 0],
      tilt: false,
      span: U(0),
      fx: (t, moving) => {
        tails.forEach((p, i) => {
          p.rotation.z = Math.sin(t * (moving ? 6 : 1.7) + i * 0.7) * (moving ? 0.1 : 0.05);
          p.rotation.x = Math.sin(t * (moving ? 5 : 1.3) + i * 0.5) * 0.05;
        });
        for (const [i, l] of [...fores, ...hinds].entries())
          l.rotation.x = moving ? Math.sin(t * 13 + (i % 2 ? Math.PI : 0) + (i > 1 ? 1.4 : 0)) * 0.7 : 0;
        head.rotation.y = Math.sin(t * 0.8) * 0.1;
      },
    },
    body,
    fore,
  };
}

// MARK: Tengu

/**
 * A small mountain spirit: red face, long nose, black wings, a little tokin hat, a feather fan, geta clogs and a
 * ring of neon sparks. It rides at shoulder height behind its owner (a pet is placed on the ground, so it hovers).
 */
export function tengu(): Built {
  const body = new Model();
  const fore = new Model();
  const ROBE = "#2b2b3a";
  const RED = "#d8362f";
  const bg = new Grid();
  bg.ell(0, 0, 0, 4.2, 5, 3.8, ROBE, 2.2);
  bg.paint((c) => (c.y === -1 ? "#f5c842" : c.t > 0.8 ? "#3a3a52" : speckle(c, ROBE, "#363650", 2, 0.2)));
  // The suzukake pom-poms down the chest.
  for (const y of [2.6, 0.2]) bg.ell(0, y, 3.4, 1.7, 1.5, 1.2, "#f2efe6");
  // Legs and geta clogs.
  for (const s of SIDES) {
    bg.box(s * 1.8, s * 1.8, -7, -5, 0, 0, "#c9a07a");
    bg.box(s * 1.8 - 1, s * 1.8 + 1, -8, -8, -1, 3, "#8b5a2b");
    bg.box(s * 1.8 - 1, s * 1.8 + 1, -9, -9, -1, -1, "#6a4220");
    bg.box(s * 1.8 - 1, s * 1.8 + 1, -9, -9, 3, 3, "#6a4220");
  }
  // The left arm, down at its side.
  bg.tube(
    [
      [-4, 3, 0],
      [-5, 0, 1],
    ],
    1.5,
    1.3,
    ROBE,
  );
  bg.ell(-5, -1.6, 1.4, 1.4, 1.4, 1.4, RED);
  put(body, bg, [0, 0, 0], 1);
  const head = joint(body, [0, 8.5, 0.5]);
  const hg = new Grid();
  hg.ell(0, 0, 0, 4.7, 4.4, 4.5, (c) => speckle(c, RED, "#e8493f", 3, 0.2), 2.2);
  hg.tube(
    [
      [0, -0.6, 3.6],
      [0, -0.4, 8],
      [0, -0.2, 11],
    ],
    1.7,
    1.1,
    (c) => (c.u > 0.82 ? "#a82a24" : speckle(c, RED, "#e8493f", 5, 0.2)),
    2.4,
  );
  hg.box(-1, 1, -2, -2, 4, 4, "#5a1612");
  for (const s of SIDES) {
    hg.ell(s * 4.8, 0, -0.5, 1, 1.7, 1.2, RED);
    // Bushy white brows slanting down towards the nose.
    for (let k = 0; k < 4; k++)
      hg.box(s * (1 + k), s * (1 + k), 2 + (k > 1 ? 1 : 0), 3 + (k > 1 ? 1 : 0), 3, 4, "#f4f4f0");
  }
  // The tokin hat on its cord.
  hg.box(-2, 2, 4, 6, -1, 2, "#16141c");
  hg.box(-1, 1, 7, 7, 0, 1, "#16141c");
  hg.box(-2, 2, 4, 4, 3, 3, "#16141c").set(0, 4, 3, "#e0405a");
  hg.box(-4, -3, 0, 3, -1, -1, "#e0405a");
  put(head, hg, [0, 0, 0], 2);
  const eyes: THREE.Mesh[] = [];
  for (const s of SIDES) {
    const e = eye([
      ["#ffffff", "#ffffff"],
      ["#ffffff", DARK],
    ]);
    e.rotation.z = s * 0.2;
    e.position.set(U(s * 2.3), U(0.8), U(4.35));
    head.add(e);
    eyes.push(e);
  }
  // Black wings: a fan of feathers each, flapping.
  const wings = SIDES.map((s) => {
    const j = joint(body, [s * 3.2, 2.5, -3]);
    const g = new Grid();
    g.ell(s * 1.5, 0.5, 0, 2.6, 3, 1.8, "#232536");
    for (let k = 0; k < 5; k++) {
      const th = (-0.2 + k * 0.34) * 1;
      const len = 9 + (k === 2 ? 3 : k === 1 || k === 3 ? 1.5 : 0);
      const to: V3 = [s * Math.cos(th) * len, Math.sin(th) * len + 1, -Math.cos(th) * len * 0.3];
      g.tube(
        [[s * 1.5, 0.5, 0], to],
        1.8,
        0.7,
        (c) => (hash(c.x, c.y, c.z, k) < 0.2 ? "#3a4a6e" : c.u > 0.8 ? "#14151f" : "#1c1e2c"),
        2,
      );
    }
    put(j, g, [0, 0, 0], 4 + (s > 0 ? 1 : 0));
    return { j, s };
  });
  // The feather fan in its right hand.
  const hand = joint(body, [7.5, -0.5, 2.5]);
  const rg = new Grid();
  rg.tube(
    [
      [-2.5, 2, -3.5],
      [0, 0.6, -1.4],
    ],
    1.5,
    1.3,
    ROBE,
  );
  rg.ell(0, 0, 0, 1.5, 1.5, 1.5, RED);
  put(hand, rg, [0, 0, 0], 6);
  const fan = joint(hand, [0, 1, 0]);
  const fg = new Grid();
  fg.box(0, 0, 0, 3, 0, 0, "#8b5a2b");
  fg.ell(
    0,
    7,
    0,
    3.4,
    4.6,
    0.8,
    (c) => (c.x === 0 ? "#2f8f4c" : hash(c.x, c.y, c.z, 8) < 0.18 ? "#7ee09a" : "#4cb86a"),
    2.4,
  );
  put(fan, fg, [0, 0, 0], 7);
  // Neon sparks circling it.
  const sparks = ["#7ae7ff", "#ff6ad5", "#fff06a"].map((c, i) => {
    const sg = new Grid();
    sg.box(0, 1, 0, 1, 0, 1, `*${c}`);
    const m = put(body, sg, [0, 0, 0], i, 1, true);
    m.castShadow = false;
    return m;
  });
  light(head, [0, 0, 0.5], "#ff6ad5", 0.9, 3);
  return {
    rig: {
      head,
      eyes,
      fore: [],
      hind: [],
      tails: [],
      neck: [0, U(-4), U(1)],
      neckR: U(4.2),
      top: [0, U(7), 0],
      tilt: false,
      float: 0.8,
      span: U(4),
      fx: (t, moving) => {
        const a = Math.sin(t * (moving ? 12 : 3.6)) * (moving ? 0.55 : 0.3);
        for (const w of wings) w.j.rotation.z = w.s * (a + 0.1);
        body.rotation.x = moving ? 0.12 : Math.sin(t * 1.6) * 0.03;
        fan.rotation.z = Math.sin(t * (moving ? 7 : 2.4)) * 0.4;
        head.rotation.y = Math.sin(t * 0.7) * 0.18;
        sparks.forEach((m, i) => {
          const k = t * 1.8 + (i * Math.PI * 2) / 3;
          m.position.set(
            U(Math.cos(k) * 11),
            U(2 + Math.sin(t * 2.4 + i) * 3 + i * 1.5),
            U(Math.sin(k) * 9 - 2),
          );
        });
      },
    },
    body,
    fore,
  };
}
