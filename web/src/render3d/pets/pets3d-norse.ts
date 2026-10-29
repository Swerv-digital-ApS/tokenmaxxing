/**
 * The Ragnarok Eve case's pets (core/src/case-ragnarok.ts, pet.500 to pet.505) as voxel sculptures on the same
 * `petvox` grid as the Night Market's: Huginn and Muninn (a pair of ravens that hop in turn), Ratatoskr (the
 * squirrel with a scroll), Tanngrisnir (Thor's goat, gnashing), Hildisvíni (Freyja's boar with golden bristles),
 * a Sleipnir foal with EIGHT legs and a Fenrir pup on a thread too thin to hold anything (Gleipnir).
 * Cells whose colour starts with "*" glow. Nothing on any of them is a mark: coats are plain colour and noise.
 */
import type * as THREE from "three";
import { Model, type V3 } from "../kit/kit.ts";
import { bake, type Cell, eye, Grid, hash, mix, type Rig, VOX } from "./petvox.ts";

const SIDES = [-1, 1] as const;
const U = (n: number) => n * VOX;
const DARK = "#14101c";
const GLINT = "#f4f6ff";
type Built = { rig: Rig; body: Model; fore: Model };

/** A mesh from a grid, placed at `at` (cells). Its origin is the grid's own (0, 0, 0). */
function put(parent: THREE.Object3D, g: Grid, at: V3 = [0, 0, 0], seed = 0): THREE.Mesh {
  const m = bake(g, { seed });
  m.position.set(U(at[0]), U(at[1]), U(at[2]));
  parent.add(m);
  return m;
}

/** An empty group at `at` (cells), for a part that swings from its own joint. */
function joint(parent: THREE.Object3D, at: V3, rotY = 0): Model {
  const m = new Model();
  m.position.set(U(at[0]), U(at[1]), U(at[2]));
  m.rotation.y = rotY;
  parent.add(m);
  return m;
}

const speckle = (c: Cell, a: string, b: string, seed: number, k = 0.3) =>
  hash(c.x, c.y, c.z, seed) < k * 0.8 ? mix(a, b, 0.55) : a;

/** A leg that hangs from its hip joint (cells), `len` long, `w` wide, with a hoof or paw on the end. */
function leg(
  parent: THREE.Object3D,
  at: V3,
  len: number,
  w: number,
  coat: (c: Cell) => string,
  hoof: string,
  toe = false,
  seed = 5,
): Model {
  const j = joint(parent, at);
  const g = new Grid();
  const lo = -Math.floor(w / 2);
  const hi = lo + w - 1;
  g.box(lo, hi, -len + 2, -1, lo, hi, (c) => coat({ ...c, t: (c.y + len) / len }));
  g.box(lo, hi, -len, -len + 1, lo, hi, hoof);
  if (toe) g.box(lo, hi, -len, -len, hi + 1, hi + 1, hoof);
  put(j, g, [0, 0, 0], seed);
  return j;
}

/** Strides a set of legs: `phase` each, `amp` radians, a trot when moving and (optionally) a fidget at rest. */
function stride(legs: { j: Model; phase: number }[], t: number, moving: boolean, amp = 0.7, fidget = 0) {
  for (const l of legs)
    l.j.rotation.x = moving ? Math.sin(t * 13 + l.phase) * amp : Math.sin(t * 9 + l.phase) * fidget;
}

// MARK: Huginn and Muninn

/** One raven, facing +z, feet on y = 0: black with a violet sheen on the back and wings, a pale eye. */
function raven(parent: Model, at: V3, k: number, seed: number) {
  const root = joint(parent, at);
  const BLACK = "#252a3a";
  const SHEEN = "#4a4366";
  const bg = new Grid();
  bg.ell(0, 7, 0, 3.5, 3.3, 5.2, BLACK, 2.3);
  bg.ell(0, 8.2, 3.4, 3, 3, 2.6, BLACK, 2.3);
  bg.ell(0, 8.5, 2, 2, 2, 2, BLACK, 2.3);
  // Folded wings along the sides, their tips trailing over the tail.
  for (const s of SIDES)
    for (let z = 4; z >= -10; z--) {
      const top = z > -2 ? 9.2 : 9.2 - (-2 - z) * 0.3;
      const bot = z > -2 ? 5 : 5 + (-2 - z) * 0.22;
      const w = z > -5 ? 1 : 0;
      bg.box(s * 3.1, s * (3.9 + w), Math.round(bot), Math.round(top), z, z, BLACK);
    }
  // Tail: a wedge of long feathers trailing back and a little down.
  for (let z = -6; z >= -13; z--) {
    const w = z < -10 ? 2 : 1;
    const y = 6 - Math.floor((-6 - z) * 0.18);
    bg.box(-w, w, y - 1, y, z, z, BLACK);
  }
  bg.paint((c) => {
    if (c.t > 0.7 && hash(c.x, c.y, c.z, seed) < 0.75) return SHEEN;
    if (c.t < 0.3) return "#1c1f2e";
    return BLACK;
  });
  put(root, bg, [0, 0, 0], seed);
  // Legs: two thin sticks and three toes forward.
  const feet: Model[] = [];
  for (const s of SIDES) {
    const lg = new Grid();
    lg.box(0, 0, 0, 3, 0, 0, "#3a3446");
    lg.box(-1, 1, 0, 0, 1, 2, "#3a3446");
    feet.push(joint(root, [s * 1.3, 3, 0]));
    put(feet.at(-1)!, lg, [0, -3, 0], seed + 1);
  }
  // The head: round, a heavy beak, a pale eye on each side.
  const head = joint(root, [0, 10.4, 5]);
  const hg = new Grid();
  hg.ell(0, 0, 0, 2.6, 2.5, 2.7, BLACK, 2.2);
  hg.paint((c) => (c.t > 0.7 ? SHEEN : BLACK));
  // Shaggy throat.
  hg.ell(0, -2, 0.5, 1.8, 1.2, 1.8, "#1c1f2e");
  // The beak: deep at the root, a hooked tip, pale enough to read against the feathers.
  hg.box(-1, 1, -1, 0, 2, 5, "#5a5766");
  hg.box(-1, 1, -2, -2, 3, 4, "#3a3846");
  hg.box(0, 0, 0, 0, 5, 7, "#5a5766");
  hg.set(0, -1, 7, "#3a3846");
  put(head, hg, [0, 0, 0], seed + 3);
  const eyes: THREE.Mesh[] = [];
  for (const s of SIDES) {
    const e = eye([["#e6dcff"]]);
    e.rotation.y = s * 1.2;
    e.position.set(U(s * 2.65), U(0.3), U(1.4));
    head.add(e);
    eyes.push(e);
  }
  root.scale.setScalar(k);
  return { root, head, eyes, feet };
}

/** Thought and Memory: a pair of ravens that hop in turn, one pecking while the other looks about. */
export function huginn(): Built {
  const body = new Model();
  const fore = new Model();
  const a = raven(body, [-6.2, 0, 1.5], 1.12, 1);
  const b = raven(body, [6, 0, -2.5], 1, 6);
  b.root.rotation.y = -0.35;
  a.root.rotation.y = 0.2;
  const base = { a: [-6.2, 1.5], b: [6, -2.5] };
  return {
    rig: {
      head: a.head,
      eyes: [...a.eyes, ...b.eyes],
      fore: [],
      hind: [],
      tails: [],
      neck: [0, U(-2), U(0.5)],
      neckR: U(2.6),
      top: [0, U(2.6), 0],
      tilt: false,
      span: 0,
      fx: (t, moving) => {
        const rate = moving ? 9 : 2.6;
        for (const [r, off, [bx, bz]] of [
          [a, 0, base.a],
          [b, Math.PI, base.b],
        ] as const) {
          // A hop in turn: the other waits on the ground, pecking.
          const h = Math.max(0, Math.sin(t * rate + off));
          r.root.position.y = U(h * (moving ? 3.4 : 2.6));
          r.root.position.x = U(bx!);
          r.root.position.z = U(bz! + h * (moving ? 1.2 : 0.5));
          r.root.rotation.x = -h * 0.22;
          const peck = h < 0.001 ? Math.max(0, Math.sin(t * 7 + off * 2)) ** 3 * 0.55 : -0.1;
          if (r !== a) r.head.rotation.x = peck;
          else r.head.rotation.x = 0;
          r.feet.forEach((f, i) => {
            f.rotation.x = h > 0 ? -0.5 : Math.sin(t * 3 + i) * 0.02;
          });
        }
        // Huginn looks about while Muninn pecks.
        a.head.rotation.y = Math.sin(t * 1.4) * 0.5;
        b.head.rotation.y = Math.sin(t * 1.1 + 2) * 0.2;
      },
    },
    body,
    fore,
  };
}

// MARK: Ratatoskr

/** A red-brown squirrel with an enormous tail, standing up on its haunches with a tiny scroll of gossip. */
export function ratatoskr(): Built {
  const body = new Model();
  const fore = new Model();
  const RUST = "#b4552a";
  const RUST_D = "#8a3c1c";
  const CREAM = "#f0dcb8";
  const bg = new Grid();
  bg.ell(0, 8, -0.5, 3.8, 4.6, 5, RUST, 2.3);
  for (const s of SIDES) bg.ell(s * 3.2, 5, -2.5, 2, 3.4, 3.4, RUST, 2.2);
  bg.paint((c) => {
    if (c.t < 0.7 && c.u > 0.35 && Math.abs(c.s) < 0.6) return speckle(c, CREAM, "#e0c698", 3, 0.2);
    if (c.t > 0.8) return speckle(c, RUST_D, RUST, 4, 0.3);
    return speckle(c, RUST, "#9c4720", 5, 0.3);
  });
  put(body, bg, [0, 0, 0], 1);
  // Four legs; the front two reach up and hold the scroll.
  const hinds: { j: Model; phase: number }[] = [];
  for (const [i, s] of SIDES.entries()) {
    hinds.push({
      j: leg(body, [s * 3.4, 4, -2.5], 4, 3, (c) => speckle(c, RUST, RUST_D, 6, 0.3), "#5a2c14", true),
      phase: i * Math.PI,
    });
  }
  const arms: Model[] = [];
  for (const s of SIDES) {
    const j = joint(body, [s * 2.4, 8.5, 3.6]);
    const g = new Grid();
    g.box(-1, 0, -5, 0, -1, 0, RUST);
    g.box(-1, 0, -6, -5, -1, 1, "#5a2c14");
    put(j, g, [0, 0, 0], 7);
    j.rotation.x = -1.25;
    j.rotation.y = -s * 0.22;
    arms.push(j);
  }
  // The scroll, held at the chest: a cream roll with brown ends and a red ribbon.
  const scroll = joint(body, [0, 8.8, 7.4]);
  const sg = new Grid();
  sg.box(-3, 3, 0, 1, 0, 1, "#f0e2b8");
  sg.box(-4, -4, -0.5, 1.5, -0.5, 1.5, "#8a5a2b");
  sg.box(4, 4, -0.5, 1.5, -0.5, 1.5, "#8a5a2b");
  sg.box(0, 0, -1, 2, -1, 2, "#a8322e");
  sg.box(-3, 3, 1, 1, 0, 0, "#d9c89a");
  put(scroll, sg, [0, 0, 0], 8);
  // The head.
  const head = joint(body, [0, 13.4, 3.6]);
  const hg = new Grid();
  hg.ell(0, 0, 0, 3.3, 3.1, 3.3, RUST, 2.2);
  hg.ell(0, -1.2, 3.1, 1.7, 1.5, 1.5, CREAM);
  for (const s of SIDES) hg.ell(s * 2.2, -1.2, 1.7, 1.6, 1.5, 1.6, CREAM);
  hg.set(0, -0.2, 4.7, "#3a1f14");
  hg.set(0, -2, 4.5, "#c47a5a");
  for (const s of SIDES) {
    // Tufted ears: a rust base with a dark tip.
    hg.box(s * 2, s * 2.9, 3, 5, -1, 0, RUST);
    hg.box(s * 2.2, s * 2.7, 5, 6, -1, -1, "#3a1f14");
    hg.set(s * 2.5, 4.5, 0, "#e0a888");
  }
  hg.paint((c) => (c.t > 0.5 && c.c === RUST ? speckle(c, RUST, RUST_D, 9, 0.35) : c.c));
  put(head, hg, [0, 0, 0], 2);
  const eyes: THREE.Mesh[] = [];
  for (const s of SIDES) {
    const e = eye([
      [DARK, DARK],
      [DARK, GLINT],
    ]);
    e.rotation.y = s * 0.5;
    e.position.set(U(s * 2.3), U(0.8), U(2.7));
    head.add(e);
    eyes.push(e);
  }
  // The great tail: an S of rust fluff, ringed, curling up over the back.
  const tail = joint(body, [0, 5, -4]);
  const tg = new Grid();
  tg.tube(
    [
      [0, 0, 0],
      [0, 3, -5],
      [0, 9, -6.5],
      [0, 14, -4.5],
      [0, 16.5, -1],
    ],
    2.2,
    3.7,
    (c) => (c.u > 0.985 ? CREAM : Math.floor(c.u * 7) % 2 ? RUST_D : RUST),
    2.2,
  );
  tg.fluff(0.22, 5, 0.12);
  put(tail, tg, [0, 0, 0], 4);
  return {
    rig: {
      head,
      eyes,
      fore: [],
      hind: [],
      tails: [],
      neck: [0, U(-3), U(0.5)],
      neckR: U(3),
      top: [0, U(3.4), 0],
      tilt: false,
      span: U(2),
      fx: (t, moving) => {
        // The tail flicks: a quick lash now and then, a gentle curl between.
        const lash = Math.max(0, Math.sin(t * 1.6)) ** 6;
        tail.rotation.x = -0.12 + Math.sin(t * (moving ? 11 : 2.2)) * 0.1 - lash * 0.35;
        tail.rotation.z = Math.sin(t * (moving ? 9 : 1.7) + 1) * 0.16 + lash * 0.3;
        stride(hinds, t, moving, 0.7, 0);
        arms.forEach((a, i) => {
          a.rotation.x = -1.25 + (moving ? Math.sin(t * 13 + i * Math.PI) * 0.2 : Math.sin(t * 2) * 0.04);
        });
        scroll.position.y = U(8.8 + (moving ? Math.abs(Math.sin(t * 13)) * 0.6 : Math.sin(t * 2) * 0.15));
        scroll.rotation.z = Math.sin(t * 3) * 0.05;
        head.rotation.y = Math.sin(t * 0.8) * 0.2;
        head.rotation.z = Math.sin(t * 1.3) * 0.05;
      },
    },
    body,
    fore,
  };
}

// MARK: Tanngrisnir

/** One of Thor's goats: cream, big swept horns, a beard, and a grin of teeth it keeps gnashing. */
export function tanngrisnir(): Built {
  const body = new Model();
  const fore = new Model();
  const CREAM = "#f1e8d4";
  const SHADE = "#d9ccb0";
  const BONE = "#e4d8b4";
  const bg = new Grid();
  bg.ell(0, 11, -0.5, 4, 4.4, 7.2, CREAM, 2.5);
  bg.tube(
    [
      [0, 12, 5],
      [0, 16, 8],
    ],
    2.9,
    2.6,
    CREAM,
  );
  bg.paint((c) => (c.t < 0.3 ? SHADE : speckle(c, CREAM, "#e3d6bc", 2, 0.3)));
  // A stub of a tail, cocked up.
  bg.box(-1, 0, 13, 14, -9, -8, CREAM);
  bg.set(0, 15, -8, SHADE);
  put(body, bg, [0, 0, 0], 1);
  const legs: { j: Model; phase: number }[] = [];
  for (const [zi, z] of [4.6, -4.6].entries())
    for (const [si, s] of SIDES.entries())
      legs.push({
        j: leg(body, [s * 2.7, 9, z], 9, 2, (c) => (c.t > 0.55 ? CREAM : SHADE), "#3b2f2a", false, 5 + zi),
        phase: (zi + si) * Math.PI,
      });
  // The head: a long skull, a pale muzzle and a lower jaw that works.
  const head = joint(body, [0, 17.5, 9]);
  const hg = new Grid();
  hg.ell(0, 0, 0, 2.9, 3.1, 3.2, CREAM, 2.3);
  hg.ell(0, -1.7, 3.6, 2.2, 1.9, 3.1, "#fbf4e2", 2.4);
  hg.set(-1, -0.6, 6.6, "#8a6a5a").set(1, -0.6, 6.6, "#8a6a5a");
  // Upper teeth: a row of white across the front of the muzzle, over a dark lip.
  hg.box(-2, 2, -3.6, -3.6, 4, 6, DARK);
  for (let x = -2; x <= 2; x++) hg.set(x, -3, 6, x % 2 ? "#ffffff" : "#e8e4d8");
  for (const s of SIDES) {
    // Horns: ridged bone, thick at the root, sweeping out and back in a long curve.
    hg.tube(
      [
        [s * 1.7, 2.6, -0.6],
        [s * 3, 5.2, -2.4],
        [s * 3.7, 6.6, -5.4],
        [s * 3.2, 6.2, -8.8],
      ],
      2.3,
      0.7,
      (c) => (Math.floor(c.u * 12) % 3 === 0 ? mix(BONE, "#8a7a58", 0.5) : BONE),
      2.2,
    );
    // Ears: long, out to the sides and a little down.
    hg.box(s * 3, s * 5.4, -0.6, 0.4, -2, -1, CREAM);
    hg.box(s * 3.4, s * 5, -0.6, 0, -1.6, -1.2, "#e8b8a0");
  }
  put(head, hg, [0, 0, 0], 2);
  const jaw = joint(head, [0, -2.8, 1.6]);
  const jg = new Grid();
  jg.ell(0, -0.5, 2.5, 1.9, 0.9, 2.5, "#fbf4e2", 2.4);
  for (let x = -2; x <= 2; x++) jg.set(x, 0.6, 4.6, "#ffffff");
  jg.set(0, 0.6, 4.6, "#ffffff");
  // The beard.
  jg.box(-1, 0, -2.4, -0.6, 3, 4, "#cbbd9c");
  jg.box(0, 0, -3.6, -2.4, 3, 3, "#cbbd9c");
  put(jaw, jg, [0, 0, 0], 3);
  const eyes: THREE.Mesh[] = [];
  for (const s of SIDES) {
    const e = eye([
      ["#e8b840", "#e8b840"],
      [DARK, "#e8b840"],
    ]);
    e.rotation.y = s * 0.65;
    e.position.set(U(s * 2.6), U(0.9), U(2.6));
    head.add(e);
    eyes.push(e);
  }
  const tail = joint(body, [0, 14, -8.5]);
  return {
    rig: {
      head,
      eyes,
      fore: [],
      hind: [],
      tails: [tail],
      neck: [0, U(-2.5), U(-1)],
      neckR: U(3),
      top: [0, U(3), 0],
      tilt: false,
      span: U(9),
      fx: (t, moving) => {
        stride(legs, t, moving, 0.6, 0);
        // It gnashes in bursts: a rattle of teeth, a pause, a rattle.
        const burst = Math.sin(t * 1.3) > 0.2 ? 1 : 0.12;
        jaw.rotation.x = Math.abs(Math.sin(t * (moving ? 20 : 17))) * 0.34 * burst;
        head.rotation.x = Math.sin(t * 1.1) * 0.05 + (moving ? Math.sin(t * 13) * 0.04 : 0);
      },
    },
    body,
    fore,
  };
}

// MARK: Hildisvíni

/** Freyja's boar as a round pink-brown piglet with tusk nubs and a crest of golden bristles it is proud of. */
export function hildisvini(): Built {
  const body = new Model();
  const fore = new Model();
  const SKIN = "#c98a78";
  const DEEP = "#9a6252";
  const BELLY = "#e2b09a";
  const GOLD = "#f2c230";
  const bg = new Grid();
  bg.ell(0, 7.5, 0, 5.4, 5, 6.4, SKIN, 2.2);
  bg.paint((c) =>
    c.t > 0.72
      ? speckle(c, "#b87a68", DEEP, 3, 0.2)
      : c.t < 0.3
        ? BELLY
        : speckle(c, SKIN, "#bf8270", 4, 0.15),
  );
  // The golden crest along the spine: a comb of bristles, taller towards the shoulders, tips that gleam.
  for (let z = 6; z >= -6; z--) {
    const top = bg.top(0, z);
    if (top === undefined) continue;
    const h = z % 2 === 0 ? 3 + (z > -2 && z < 5 ? 1 : 0) : 1;
    for (let y = 1; y <= h; y++) bg.set(0, top + y, z, y === h && h > 1 ? "*#ffe27a" : GOLD);
    if (z % 2 === 0 && z > -5) for (const x of [-1, 1]) bg.set(x, top + h - 2, z, GOLD);
  }
  put(body, bg, [0, 0, 0], 1);
  const legs: { j: Model; phase: number }[] = [];
  for (const [zi, z] of [4, -4].entries())
    for (const [si, s] of SIDES.entries())
      legs.push({
        j: leg(body, [s * 3.5, 4, z], 4, 3, (c) => (c.t > 0.5 ? SKIN : DEEP), "#4a2c26", false, 5 + zi),
        phase: (zi + si) * Math.PI,
      });
  const head = joint(body, [0, 8.5, 6.2]);
  const hg = new Grid();
  hg.ell(0, 0, 0, 4, 3.8, 3.5, SKIN, 2.2);
  hg.paint((c) => speckle(c, SKIN, "#bf8270", 6, 0.12));
  // A flat snout disc with nostrils, and a tusk nub up from each side of the jaw.
  hg.box(-2, 2, -2, 1, 3, 5, BELLY);
  hg.box(-1, 1, -1, 0, 6, 6, "#d89a86");
  hg.set(-1, -0.5, 6, "#5a2c26").set(1, -0.5, 6, "#5a2c26");
  for (const s of SIDES) {
    hg.box(s * 2.5, s * 2.5, -2.6, -0.8, 4, 4, "#f4ecd2");
    hg.set(s * 2.5, -0.2, 4, "#fffbe8");
    // Pointed ears, set back and swept out.
    hg.box(s * 2, s * 3.2, 3, 4, -1, -1, DEEP);
    hg.box(s * 2.4, s * 3.4, 4, 5, -1, -1, DEEP);
    hg.set(s * 3, 5.5, -1, DEEP);
    hg.set(s * 2.6, 3.5, 0, "#e0a898");
  }
  put(head, hg, [0, 0, 0], 2);
  const eyes: THREE.Mesh[] = [];
  for (const s of SIDES) {
    const e = eye([[DARK, GLINT]]);
    e.rotation.y = s * 0.2;
    e.position.set(U(s * 2.5), U(1.2), U(3.4));
    head.add(e);
    eyes.push(e);
  }
  const tail = joint(body, [0, 9, -6.2]);
  const tg = new Grid();
  for (const [x, y, z] of [
    [0, 0, 0],
    [0, 1, -1],
    [1, 2, -1],
    [1, 3, 0],
    [0, 3, 1],
  ] as const)
    tg.set(x, y, z, DEEP);
  put(tail, tg, [0, 0, 0], 4);
  return {
    rig: {
      head,
      eyes,
      fore: [],
      hind: [],
      tails: [tail],
      neck: [0, U(-3), U(-0.5)],
      neckR: U(4),
      top: [0, U(4), -U(0.5)],
      tilt: false,
      span: U(4),
      fx: (t, moving) => {
        stride(legs, t, moving, 0.75, 0);
        // Chin up, proud of the bristles, and a snuffle.
        head.rotation.x = -0.14 + Math.sin(t * (moving ? 13 : 2.4)) * 0.05;
        head.rotation.y = Math.sin(t * 0.7) * 0.12;
      },
    },
    body,
    fore,
  };
}

// MARK: Sleipnir foal

/** A grey foal with eight legs, four a side, all of them in a hurry. */
export function sleipnir(): Built {
  const body = new Model();
  const fore = new Model();
  const GREY = "#a4acb7";
  const LIGHT = "#cfd5dc";
  const MANE = "#4b5262";
  const bg = new Grid();
  bg.ell(0, 11, 0, 3.9, 4.2, 9, GREY, 2.5);
  bg.ell(0, 12.5, 6, 3.4, 4.4, 3.5, GREY, 2.3);
  bg.tube(
    [
      [0, 13.5, 7],
      [0, 17, 9.5],
      [0, 19, 10.5],
    ],
    3.4,
    2.9,
    GREY,
  );
  bg.paint((c) => (c.t < 0.3 ? mix(GREY, LIGHT, 0.6) : speckle(c, GREY, "#8e97a3", 2, 0.25)));
  // The mane down the back of the neck, a dark crest.
  for (let i = 0; i < 7; i++) {
    const z = 5 + i * 0.9;
    const y = 15.5 + i * 0.8;
    bg.box(0, 0, Math.round(y), Math.round(y) + 1, Math.round(z), Math.round(z), MANE);
  }
  put(body, bg, [0, 0, 0], 1);
  // Eight legs: two pairs fore, two pairs aft, on each side, working in turn.
  const legs: { j: Model; phase: number }[] = [];
  let n = 0;
  for (const z of [7, 4.2, -4.2, -7]) {
    for (const s of SIDES) {
      const back = z < 0;
      legs.push({
        j: leg(
          body,
          [s * 2.5, 9, z],
          9,
          2,
          (c) => (c.t < 0.45 ? mix(GREY, LIGHT, 0.7) : mix(GREY, "#8e97a3", back ? 0.5 : 0.2)),
          "#3b4050",
          false,
          5 + n,
        ),
        phase: n * 1.1 + (s > 0 ? Math.PI : 0),
      });
      n++;
    }
  }
  const head = joint(body, [0, 20.5, 11.5]);
  const hg = new Grid();
  hg.ell(0, 0, 0, 3.3, 3.4, 3.4, GREY, 2.3);
  hg.ell(0, -2, 3.2, 2.5, 2.2, 2.8, LIGHT, 2.3);
  hg.set(-1, -1.5, 6, "#4a3f4a").set(1, -1.5, 6, "#4a3f4a");
  for (const s of SIDES) {
    hg.box(s * 1.8, s * 2.6, 3.4, 6, -1.6, -0.6, GREY);
    hg.set(s * 2.2, 4.6, -0.8, "#e8b8c0");
  }
  // A forelock, falling over the brow.
  hg.box(-1, 1, 3, 4.2, 0.4, 2.2, MANE);
  hg.box(0, 0, 2.4, 3, 1.2, 3.2, MANE);
  put(head, hg, [0, 0, 0], 2);
  const eyes: THREE.Mesh[] = [];
  for (const s of SIDES) {
    const e = eye([
      [DARK, DARK],
      [DARK, GLINT],
    ]);
    e.rotation.y = s * 0.5;
    e.position.set(U(s * 3.1), U(0.8), U(1.6));
    head.add(e);
    eyes.push(e);
  }
  const tail = joint(body, [0, 12.5, -8.5]);
  const tg = new Grid();
  tg.tube(
    [
      [0, 0, 0],
      [0, -1, -4],
      [0, -5, -6],
      [0, -8, -6.5],
    ],
    1.6,
    1.1,
    (c) => (c.u > 0.8 ? "#c8cfd8" : MANE),
    2.2,
  );
  put(tail, tg, [0, 0, 0], 4);
  return {
    rig: {
      head,
      eyes,
      fore: [],
      hind: [],
      tails: [tail],
      neck: [0, U(-2.5), U(-0.5)],
      neckR: U(3.2),
      top: [0, U(3.4), 0],
      tilt: false,
      span: U(2),
      fx: (t, moving) => {
        // The legs are the joke: a trot of eight, and even standing still they shuffle in a hurry.
        stride(legs, t, moving, 0.8, 0.12);
        head.rotation.x = Math.sin(t * 2.1) * 0.06 + (moving ? Math.sin(t * 13) * 0.05 : 0);
      },
    },
    body,
    fore,
  };
}

// MARK: Fenrir pup

/** A grey-black wolf pup with a white chest, big paws, and Gleipnir: a thread of silver, trailing behind. */
export function fenrir(): Built {
  const body = new Model();
  const fore = new Model();
  const COAT = "#555a67";
  const BACK = "#383b46";
  const CHEST = "#f0f3f8";
  const AMBER = "#f2c14a";
  const bg = new Grid();
  bg.ell(0, 9, 0, 4, 4.3, 6.2, COAT, 2.3);
  bg.ell(0, 9.8, 4.6, 3.5, 4, 2.6, COAT, 2.2);
  bg.paint((c) => {
    if (c.u > 0.6 && c.t < 0.68 && Math.abs(c.s) < 0.62) return speckle(c, CHEST, "#d6dbe3", 3, 0.2);
    if (c.t > 0.74) return speckle(c, BACK, COAT, 4, 0.35);
    if (c.t < 0.3) return "#454854";
    return speckle(c, COAT, "#646a78", 5, 0.25);
  });
  bg.fluff(0.12, 3, 0.08);
  put(body, bg, [0, 0, 0], 1);
  const legs: { j: Model; phase: number }[] = [];
  for (const [zi, z] of [4.4, -3.8].entries())
    for (const [si, s] of SIDES.entries())
      legs.push({
        j: leg(body, [s * 2.7, 5, z], 5, 2, (c) => (c.t > 0.6 ? COAT : "#454854"), "#2a2c35", true, 5 + zi),
        phase: (zi + si) * Math.PI,
      });
  const head = joint(body, [0, 12.4, 7.2]);
  const hg = new Grid();
  hg.ell(0, 0, 0, 3.9, 3.5, 3.6, COAT, 2.2);
  hg.ell(0, -1.3, 3.8, 2.2, 1.8, 2.7, "#767c8a", 2.3);
  hg.box(-1, 1, -0.4, 0.2, 6, 6, "#0e0c14");
  hg.set(0, 0.6, 5, "#0e0c14");
  hg.paint((c) => (c.c === COAT ? speckle(c, COAT, "#646a78", 7, 0.25) : c.c));
  for (const s of SIDES) {
    // Upright, pointed ears with a pale inside, and fur on the cheeks.
    hg.box(s * 1.8, s * 3.4, 3, 4, -1.4, -0.4, COAT);
    hg.box(s * 2.1, s * 3.1, 5, 6, -1.4, -0.4, COAT);
    hg.box(s * 2.4, s * 2.8, 4, 5, -0.6, -0.6, "#a8909a");
    hg.set(s * 4, -1, 1.6, "#7a808c");
  }
  put(head, hg, [0, 0, 0], 2);
  const eyes: THREE.Mesh[] = [];
  for (const s of SIDES) {
    const e = eye([
      [AMBER, AMBER],
      [DARK, AMBER],
    ]);
    e.rotation.y = s * 0.3;
    e.position.set(U(s * 2.3), U(1), U(3.4));
    head.add(e);
    eyes.push(e);
  }
  // Gleipnir: a thread of light round the neck and out behind along the ground, much too thin to hold anything.
  const thread = joint(body, [0, 0, 0]);
  const th = new Grid();
  const T = "*#e6eefa";
  for (let i = 0; i < 28; i++) {
    const a = (i / 28) * Math.PI * 2;
    th.set(Math.cos(a) * 3.9, 9.8, 5.4 + Math.sin(a) * 3.9, T);
  }
  for (let i = 0; i <= 9; i++) th.set(0, 9 - i, 9.2 + i * 0.25, T);
  put(thread, th, [0, 0, 0], 9).castShadow = false;
  const tail = joint(body, [0, 9, -6]);
  const tg = new Grid();
  tg.tube(
    [
      [0, 0, 0],
      [0, 1.5, -4],
      [0, 4, -6.5],
      [0, 7.5, -7],
    ],
    1.7,
    2.2,
    (c) => (c.u > 0.9 ? "#8a909c" : speckle(c, COAT, "#646a78", 8, 0.3)),
    2.2,
  );
  tg.fluff(0.2, 4, 0.06);
  put(tail, tg, [0, 0, 0], 4);
  // The other end of the thread runs on along the floor ahead, towards whoever holds it, rippling.
  const trail = joint(body, [0, 0, 11]);
  const tr = new Grid();
  for (let z = 0; z < 20; z++) tr.set(Math.round(Math.sin(z * 0.5) * (0.6 + z * 0.12)), 0, z, T);
  put(trail, tr, [0, 0, 0], 10).castShadow = false;
  return {
    rig: {
      head,
      eyes,
      fore: [],
      hind: [],
      tails: [tail],
      neck: [0, U(-2.5), U(0.5)],
      neckR: U(3.6),
      top: [0, U(3.5), 0],
      tilt: false,
      span: U(2),
      fx: (t, moving) => {
        stride(legs, t, moving, 0.7, 0);
        head.rotation.z = Math.sin(t * 0.9) * 0.08;
        head.rotation.x = Math.sin(t * 1.7) * 0.04;
        trail.rotation.y = Math.sin(t * (moving ? 7 : 1.4)) * (moving ? 0.14 : 0.05);
      },
    },
    body,
    fore,
  };
}
