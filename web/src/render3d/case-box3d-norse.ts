/**
 * The Ragnarok Eve case and its key in 3D (`case-box3d.ts` picks these by case id): an oak sea chest with iron bands,
 * dragon-head corner studs, a shield-boss clasp, frost along the lid edge, a plain knotwork band (no runes, so it can
 * never read wrong) and a carved tally with a raven hanging from it; open, ice-blue and ember-amber light spills out
 * with a breath of frost and a few sparks. The key is a pierced silver coin on a leather thong with a tiny raven stamp.
 * Same frame as the Night Market's: bottom centre at the origin, front along +z, about 0.9 x 0.8 x 0.6.
 * Design brief: docs/cases/ragnarok-eve.md.
 */
import * as THREE from "three";
import { ravenProfile } from "./furniture/norse3d.ts";
import { glow, Model, tint, toon } from "./kit/kit.ts";

const OAK = "#6b4a2e";
const OAK_DARK = "#3f2a1a";
const OAK_LIGHT = "#8a6340";
const IRON = "#4a5160";
const IRON_DARK = "#33384a";
const STEEL = "#7a8394";
const BONE = "#e8dfc8";
const FROST = "#dff3fa";
const ICE = "#9fe6ff";
const EMBER = "#ff9a3c";
const RAVEN = "#252a3a";
const LEATHER = "#6b4a2e";

const W = 0.9;
const D = 0.6;
const BODY_H = 0.46;
const LID_H = 0.2;

type Animator = (t: number) => void;
type Register = (m: Model, fn: Animator) => void;

/** A little iron dragon head on a corner, its snout turned out along (dx, dz): two horns, a glowing eye each side. */
function dragonStud(m: Model, x: number, y: number, z: number, dx: number, dz: number): void {
  const s = m.part([x, y, z], Math.atan2(dx, dz));
  s.box([0.07, 0.07, 0.07], IRON_DARK, [0, -0.035, 0], 0.012);
  s.box([0.05, 0.036, 0.06], IRON, [0, -0.04, 0.06], 0.01);
  s.box([0.03, 0.012, 0.02], STEEL, [0, -0.012, 0.09], 0.003);
  for (const sx of [-1, 1]) {
    const h = s.part([sx * 0.026, 0.0, -0.01]);
    h.rotation.z = -sx * 0.5;
    h.rotation.x = -0.5;
    h.cyl(0.014, 0.06, STEEL, [0, 0, 0], 0.003, 5);
    s.ball(0.008, glow(EMBER), [sx * 0.036, -0.02, 0.03], [1, 1, 0.6], 5);
  }
}

/** A plain braid along a face: two crossing diagonals per cell, taking turns to go over, between two rails. */
function braid(p: Model, len: number, y: number, z: number, h = 0.11): void {
  p.box([len - 0.04, h + 0.03, 0.012], "#2a1a10", [0, y - 0.015, z], 0.003);
  p.box([len - 0.04, 0.012, 0.018], "#c8a46a", [0, y + h - 0.004, z], 0.002);
  p.box([len - 0.04, 0.012, 0.018], "#c8a46a", [0, y - 0.01, z], 0.002);
  const cell = 0.06;
  const n = Math.floor((len - 0.1) / cell);
  const ang = Math.atan2(h * 0.8, cell);
  const l = Math.hypot(h * 0.8, cell) + 0.01;
  for (let i = 0; i < n; i++) {
    const x = (i - (n - 1) / 2) * cell;
    for (const k of [0, 1]) {
      const over = (i + k) % 2 === 0;
      const b = p.box(
        [l, 0.02, 0.014],
        k ? "#b08a4a" : "#d9bd86",
        [x, y + h * 0.5 - 0.01, z + 0.004 + (over ? 0.008 : 0)],
        0.004,
      );
      b.rotation.z = k ? -ang : ang;
    }
  }
}

/** A tiny raven in profile (see `ravenProfile`), stamped facing +z at (x, y, z), `s` times its natural size. */
function stampRaven(p: THREE.Object3D, x: number, y: number, z: number, color: string, s: number): void {
  const g = ravenProfile(p, { color, z: 0, scale: s });
  g.position.set(x, y, z);
}

/** A rectangular iron frame (four bars) `w` by `d`, `h` tall from `y`, `t` thick: a rim you can see into. */
function frame(m: Model, w: number, d: number, h: number, y: number, t: number): void {
  m.box([w, h, t], IRON_DARK, [0, y, (d - t) / 2], 0.008);
  m.box([w, h, t], IRON_DARK, [0, y, -(d - t) / 2], 0.008);
  m.box([t, h, d - 2 * t], IRON_DARK, [(w - t) / 2, y, 0], 0.008);
  m.box([t, h, d - 2 * t], IRON_DARK, [-(w - t) / 2, y, 0], 0.008);
}

export function buildNorseBox(open: boolean, register: Register): Model {
  const m = new Model();
  const front = D / 2;
  const side = W / 2;
  // The foot and the oak body, with plank seams on both visible faces.
  m.box([W + 0.04, 0.05, D + 0.04], OAK_DARK, [0, 0, 0], 0.012);
  m.box([W, BODY_H - 0.05, D], OAK, [0, 0.05, 0], 0.03);
  m.box([W - 0.1, 0.01, D - 0.1], OAK_DARK, [0, BODY_H - 0.005, 0], 0.003);
  for (const y of [0.1, 0.152, 0.3, 0.352, 0.405]) {
    m.box([W + 0.004, 0.007, 0.008], OAK_DARK, [0, y, front + 0.001], 0.001);
    m.box([0.008, 0.007, D + 0.004], OAK_DARK, [side + 0.001, y, 0], 0.001);
  }
  for (const [x, y] of [
    [-0.12, 0.06],
    [0.14, 0.06],
    [-0.1, 0.31],
    [0.12, 0.31],
  ] as const)
    m.box([0.006, 0.09, 0.008], OAK_DARK, [x, y, front + 0.001], 0.001);
  // The knotwork band, on the front and on the right.
  braid(m, W, 0.165, front + 0.001);
  const flank = m.part([0, 0, 0], Math.PI / 2);
  braid(flank, D, 0.165, side + 0.001);
  // Iron: two bands up the front and over the lid, a rim round the mouth, and straps up the corners.
  for (const x of [-0.3, 0.3]) {
    m.box([0.07, BODY_H - 0.02, D + 0.02], IRON, [x, 0.02, 0], 0.012);
    for (const y of [0.08, 0.2, 0.35]) m.ball(0.011, STEEL, [x, y, front + 0.013], [1, 1, 0.5], 5);
  }
  for (const sx of [-1, 1])
    for (const sz of [-1, 1])
      m.box([0.05, BODY_H - 0.02, 0.05], IRON, [sx * (side - 0.01), 0.02, sz * (front - 0.01)], 0.01);
  frame(m, W + 0.03, D + 0.03, 0.035, BODY_H - 0.03, 0.035);
  // Dragon heads on the front corners, top and bottom, and on the far right corners.
  for (const sx of [-1, 1])
    for (const y of [BODY_H - 0.08, 0.1]) dragonStud(m, sx * (side + 0.012), y, front + 0.012, sx * 0.5, 1);
  for (const y of [BODY_H - 0.08, 0.1]) dragonStud(m, side + 0.012, y, -front - 0.012, 1, -0.5);

  // The hanging tally, from an iron hook on the right band: a carved board with a raven and a few cuts.
  m.box([0.03, 0.025, 0.03], IRON, [0.3, BODY_H - 0.1, front + 0.03], 0.006);
  const tag = m.part([0.3, BODY_H - 0.1, front + 0.045]);
  tag.cyl(0.006, 0.06, LEATHER, [0, -0.06, 0], 0.006, 4);
  tag.box([0.13, 0.17, 0.018], OAK_DARK, [0, -0.255, 0], 0.006);
  tag.box([0.115, 0.155, 0.018], OAK_LIGHT, [0, -0.2475, 0.002], 0.005);
  stampRaven(tag, 0.005, -0.15, 0.014, RAVEN, 0.13);
  for (const x of [-0.04, -0.016, 0.008, 0.032])
    tag.box([0.008, 0.032, 0.006], OAK_DARK, [x, -0.3, 0.013], 0.001);
  tag.box([0.1, 0.007, 0.006], OAK_DARK, [0, -0.287, 0.014], 0.001).rotation.z = 0.35;

  // The lid, hinged along the back top edge: an oak barrel-top of stepped planks, the bands over it, and the clasp.
  const hinge = m.part([0, BODY_H + 0.03, -D / 2]);
  const lid = hinge.part([0, 0, D / 2]);
  lid.box([W + 0.04, LID_H * 0.62, D + 0.04], OAK_LIGHT, [0, 0, 0], 0.03);
  lid.box([W + 0.0, LID_H * 0.32, D - 0.04], tint(OAK_LIGHT, 0.05), [0, LID_H * 0.6, 0], 0.025);
  lid.box([W - 0.12, 0.035, D - 0.14], tint(OAK_LIGHT, 0.1), [0, LID_H * 0.88, 0], 0.015);
  frame(lid, W + 0.044, D + 0.044, 0.03, -0.015, 0.035);
  for (const x of [-0.3, 0.3]) {
    lid.box([0.07, LID_H * 0.62 + 0.01, D + 0.06], IRON, [x, 0, 0], 0.012);
    lid.box([0.07, LID_H * 0.32 + 0.01, D - 0.02], IRON, [x, LID_H * 0.6, 0], 0.012);
    lid.box([0.07, 0.04, D - 0.1], IRON, [x, LID_H * 0.87, 0], 0.01);
  }
  for (const y of [0.07, 0.115]) lid.box([W + 0.044, 0.006, 0.008], OAK_DARK, [0, y, D / 2 + 0.021], 0.001);
  // The shield boss: an iron plate down onto the body, a round boss with a dome, a spike and a ring of rivets.
  const lz = D / 2 + 0.022;
  lid.box([0.1, 0.1, 0.016], IRON_DARK, [0, -0.06, lz - 0.004], 0.006);
  const boss = lid.part([0, 0.07, lz]);
  const disc = boss.cyl(0.13, 0.016, IRON_DARK, [0, 0, 0], 0.13, 14);
  disc.rotation.x = Math.PI / 2;
  const rim = boss.cyl(0.108, 0.022, "#e9b73d", [0, 0, 0.012], 0.108, 14);
  rim.rotation.x = Math.PI / 2;
  boss.ball(0.075, "#aab3c2", [0, 0, 0.032], [1, 1, 0.7], 10);
  boss.cyl(0.02, 0.05, "#d6dde8", [0, 0, 0.05], 0.004, 6).rotation.x = Math.PI / 2;
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    boss.ball(0.009, BONE, [Math.cos(a) * 0.095, Math.sin(a) * 0.095, 0.018], [1, 1, 0.6], 4);
  }
  // Frost along the lid's edges: a rime band, icicles under the front edge and white patches on top.
  const frost = lid.box([W + 0.05, 0.03, 0.018], FROST, [0, 0.003, D / 2 + 0.028], 0.006);
  frost.castShadow = false;
  lid.box([0.014, 0.03, D + 0.04], FROST, [side + 0.027, 0.003, 0], 0.005);
  const icicles: number[][] = [
    [-0.4, 0.07],
    [-0.31, 0.045],
    [-0.17, 0.09],
    [-0.05, 0.05],
    [0.08, 0.075],
    [0.19, 0.045],
    [0.36, 0.085],
    [0.43, 0.05],
  ];
  for (const [x, len] of icicles as [number, number][])
    lid.cyl(0.003, len, ICE, [x, -len + 0.01, D / 2 + 0.03], 0.017, 5);
  for (const [x, z, w, d] of [
    [-0.2, 0.05, 0.22, 0.12],
    [0.12, -0.04, 0.3, 0.1],
    [0.3, 0.1, 0.12, 0.08],
    [-0.35, -0.08, 0.1, 0.14],
  ] as const)
    lid.box([w, 0.012, d], FROST, [x, LID_H * 0.88 + 0.03, z], 0.004);
  const sparkles = [-0.3, 0.0, 0.26].map((x, i) =>
    lid.ball(0.011, glow("#ffffff"), [x, LID_H * 0.88 + 0.055, 0.08 - i * 0.07], [1, 1, 1], 4),
  );

  const motion: Animator[] = [];
  if (open) {
    hinge.rotation.x = -1.95;
    // The mouth: ice-blue on the left, ember on the right, and the inside of the lid lit blue.
    const iceMat = glow(ICE);
    const emberMat = glow(EMBER);
    m.box([W / 2 - 0.06, 0.02, D - 0.08], iceMat, [-W / 4 + 0.01, BODY_H + 0.004, 0], 0.004);
    m.box([W / 2 - 0.06, 0.02, D - 0.08], emberMat, [W / 4 - 0.01, BODY_H + 0.004, 0], 0.004);
    lid.box([W - 0.06, 0.012, D - 0.06], "#8ec9e6", [0, -0.006, 0], 0.004);
    const beam = (color: string, x: number, lean: number) => {
      const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.26, depthWrite: false });
      const b = m.cyl(0.3, 0.75, mat, [x, BODY_H + 0.01, 0], 0.16, 4);
      b.rotation.set(0, Math.PI / 4, lean);
      b.scale.set(0.8, 1, 1.2);
      return mat;
    };
    const iceBeam = beam(ICE, -0.2, 0.08);
    const emberBeam = beam(EMBER, 0.2, -0.08);
    // The frost puff: soft white blobs that swell as they rise and fade.
    const puffMats: THREE.MeshBasicMaterial[] = [];
    const puffs = [0, 1, 2, 3].map(() => {
      const mat = new THREE.MeshBasicMaterial({
        color: "#eaf8ff",
        transparent: true,
        opacity: 0.5,
        depthWrite: false,
      });
      puffMats.push(mat);
      return m.ball(0.075, mat, [-0.2, BODY_H + 0.1, 0.0], [1, 0.8, 1], 8);
    });
    // The sparks: bright ember cubes flicking up out of the right half.
    const sparks = Array.from({ length: 9 }, (_, i) =>
      m.box([0.02, 0.02, 0.02], glow(i % 3 ? EMBER : "#ffd36a"), [0.2, BODY_H, 0], 0.003),
    );
    motion.push((t) => {
      const g = 0.5 + 0.5 * Math.sin(t * 2.6);
      iceMat.color.set(tint(ICE, -0.1 + 0.18 * g));
      emberMat.color.set(tint(EMBER, -0.1 + 0.2 * (1 - g)));
      iceBeam.opacity = 0.22 + 0.07 * g;
      emberBeam.opacity = 0.22 + 0.07 * (1 - g);
      puffs.forEach((p, i) => {
        const u = (t * 0.3 + i / puffs.length) % 1;
        p.position.set(
          -0.25 + Math.sin(u * 4 + i * 2) * 0.12,
          BODY_H + 0.08 + u * 0.55,
          Math.cos(u * 3 + i) * 0.1,
        );
        p.scale.setScalar(0.5 + u * 1.4);
        puffMats[i]!.opacity = 0.5 * Math.sin(u * Math.PI) ** 1.3;
      });
      sparks.forEach((s, i) => {
        const u = (t * (0.55 + (i % 3) * 0.12) + i * 0.37) % 1;
        s.position.set(
          0.05 + (i % 4) * 0.08 + Math.sin(u * 8 + i) * 0.04,
          BODY_H + 0.02 + u * 0.7,
          Math.cos(i * 2.1 + u * 5) * 0.12,
        );
        s.scale.setScalar(Math.max(0.01, 1 - u) * 1.2);
        s.rotation.set(u * 9, u * 7, 0);
      });
    });
  }
  register(m, (t) => {
    tag.rotation.z = 0.12 * Math.sin(t * 1.7);
    sparkles.forEach((s, i) => {
      s.scale.setScalar(Math.max(0.01, Math.sin(t * 2.3 + i * 2.1)) ** 2 * 1.4);
    });
    for (const fn of motion) fn(t);
  });
  return m;
}

/** A pierced silver coin on a leather thong: a ring through the hole, a loop above, a tiny raven stamped on each face. */
export function buildNorseKey(register: Register): Model {
  const m = new Model();
  const R = 0.3;
  const CENTRE = 0.3;
  const HOLE = 0.2;
  const spin = m.part([0, CENTRE, 0]);
  const SILVER = "#aebcd6";
  const LIGHT = "#e4edff";
  const DARK = "#5f6b86";
  const STAMP = "#1f2538";
  const extrude = (shape: THREE.Shape, depth: number, color: string, z = 0, bevel = 0.008) => {
    const g = new THREE.ExtrudeGeometry(shape, {
      depth,
      bevelEnabled: bevel > 0,
      bevelThickness: bevel,
      bevelSize: bevel,
      bevelSegments: 1,
      curveSegments: 28,
    });
    g.translate(0, 0, -depth / 2 + z);
    const o = new THREE.Mesh(g, toon(color));
    o.castShadow = o.receiveShadow = true;
    spin.add(o);
    return o;
  };
  const circle = (r: number) => {
    const s = new THREE.Shape();
    s.absarc(0, 0, r, 0, Math.PI * 2, false);
    return s;
  };
  const ring = (ro: number, ri: number, cx = 0, cy = 0) => {
    const s = new THREE.Shape();
    s.absarc(cx, cy, ro, 0, Math.PI * 2, false);
    const h = new THREE.Path();
    h.absarc(cx, cy, ri, 0, Math.PI * 2, true);
    s.holes.push(h);
    return s;
  };
  // The coin itself: a disc with a hole, a raised milled rim and a collar round the hole.
  const body = circle(R);
  const hole = new THREE.Path();
  hole.absarc(0, HOLE, 0.06, 0, Math.PI * 2, true);
  body.holes.push(hole);
  extrude(body, 0.06, SILVER);
  extrude(ring(R, R - 0.045), 0.092, LIGHT, 0, 0.006);
  extrude(ring(0.105, 0.06, 0, HOLE), 0.092, LIGHT, 0, 0.006);
  extrude(ring(R - 0.075, R - 0.088), 0.07, DARK, 0, 0.002);
  // The raven stamp on each face, in a darker silver, below the hole.
  for (const turn of [0, Math.PI]) {
    const f = spin.part([0, 0, 0], turn);
    stampRaven(f, 0.03, -0.01, 0.052, STAMP, 0.6);
    for (const a of [-0.9, 0.9]) f.ball(0.012, DARK, [Math.sin(a) * 0.19, -0.13, 0.04], [1, 1, 0.4], 4);
  }
  // The thong: through the hole, up in a loop, tied with a knot and two short tails.
  const strand = (a: [number, number], b: [number, number]) => {
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const s = spin.box(
      [len + 0.014, 0.034, 0.034],
      LEATHER,
      [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2 - 0.017, 0],
      0.01,
    );
    s.rotation.z = Math.atan2(b[1] - a[1], b[0] - a[0]);
  };
  const loop: [number, number][] = [
    [0, HOLE + 0.045],
    [-0.065, HOLE + 0.13],
    [-0.1, HOLE + 0.25],
    [-0.07, HOLE + 0.36],
    [0, HOLE + 0.41],
  ];
  for (const s of [-1, 1])
    for (let i = 0; i < loop.length - 1; i++)
      strand([s * loop[i]![0], loop[i]![1]], [s * loop[i + 1]![0], loop[i + 1]![1]]);
  spin.box([0.04, 0.034, 0.15], LEATHER, [0, HOLE + 0.03, 0], 0.008);
  spin.box([0.07, 0.07, 0.06], OAK_LIGHT, [0, HOLE + 0.38, 0], 0.012);
  for (const s of [-1, 1])
    spin.box([0.022, 0.07, 0.024], LEATHER, [s * 0.025, HOLE + 0.44, 0], 0.005).rotation.z = -s * 0.3;
  spin.box([0.055, 0.055, 0.055], BONE, [0.088, HOLE + 0.22, 0], 0.01);
  register(m, (time) => {
    spin.rotation.y = time * 0.9;
    spin.position.y = CENTRE + 0.012 * Math.sin(time * 1.6);
  });
  return m;
}
