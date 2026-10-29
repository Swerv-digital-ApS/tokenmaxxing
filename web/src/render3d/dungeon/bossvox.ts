/**
 * The raid's cast as true voxel sculptures: the five bosses, the robot minion and the boss trophy. Each is
 * modelled from every side (torso, head, limbs, tails, backs) out of the pets' voxel grids (`petvox.ts`),
 * baked into a few single meshes with per-corner AO, face shading and colour jitter, so they survive the
 * Voxel style's primitive swap. Cells whose colour starts with "*" glow (eyes, runes, sparks). Facing +z, the
 * bottom at y = 0, centred on x and z. A boss's `update` is handed the clock and its fight state.
 */
import * as THREE from "three";
import { C } from "../../art/palette.ts";
import type { V3 } from "../kit/kit.ts";
import { type BakeOpts, bake, darken, Grid, hash, lighten, mix, type Paint, VOX } from "../pets/petvox.ts";

export interface SculptState {
  t: number;
  /** 1 on a hit, easing to 0. */
  hurt: number;
  /** Progress of an attack, 0 to 1 (negative when idle). */
  attack: number;
  /** Death progress: 0 alive, 1 flat out. */
  fall: number;
}

export interface Sculpt {
  root: THREE.Group;
  /** World height of the model standing idle, for the HP plate. */
  height: number;
  update(s: SculptState): void;
}

const SIL = "#16121f";
const SIL_EYE = "*#c9a2ff";
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const ease = (k: number) => k * k * (3 - 2 * k);

/** The wind-up and slam of an attack: 0 idle, up to 1 drawn back, a little under 0 on the slam, then home. */
function wind(p: number): number {
  if (p < 0) return 0;
  if (p < 0.5) return ease(p / 0.5);
  if (p < 0.65) return 1 - ((p - 0.5) / 0.15) * 1.3;
  return -0.3 * Math.max(0, 1 - (p - 0.65) / 0.35);
}

// MARK: Tools

function part(
  parent: THREE.Object3D,
  g: Grid,
  pivot: V3,
  parentPivot: V3 = [0, 0, 0],
  o: BakeOpts = {},
): THREE.Group {
  const grp = new THREE.Group();
  grp.position.set(
    (pivot[0] - parentPivot[0]) * VOX,
    (pivot[1] - parentPivot[1]) * VOX,
    (pivot[2] - parentPivot[2]) * VOX,
  );
  grp.add(bake(g, { ...o, origin: pivot }));
  parent.add(grp);
  return grp;
}

/** A grid in local coordinates (its own origin is the pivot), placed at `at`. */
function local(parent: THREE.Object3D, g: Grid, at: V3, o: BakeOpts = {}): THREE.Group {
  const grp = new THREE.Group();
  grp.position.set(at[0] * VOX, at[1] * VOX, at[2] * VOX);
  grp.add(bake(g, { ...o, origin: [0, 0, 0] }));
  parent.add(grp);
  return grp;
}

/** A w x h x d block (flat shaded, for eyes and glints) centred on `at`, its front at `at` z. */
function block(
  parent: THREE.Object3D,
  w: number,
  h: number,
  d: number,
  c: string,
  at: V3,
  o: BakeOpts = {},
): THREE.Group {
  const g = new Grid().box(0, w - 1, 0, h - 1, 0, d - 1, c);
  const piv: V3 = [(w - 1) / 2, (h - 1) / 2, 0];
  const grp = new THREE.Group();
  grp.position.set(at[0] * VOX, at[1] * VOX, at[2] * VOX);
  grp.add(bake(g, { flat: true, jitter: 0, ...o, origin: piv }));
  parent.add(grp);
  return grp;
}

function lathe(
  g: Grid,
  y0: number,
  y1: number,
  rad: (y: number) => [number, number],
  p: Paint,
  cx = 0,
  cz = 0,
  pow = 2.2,
): void {
  for (let y = Math.ceil(y0); y <= Math.floor(y1); y++) {
    const [rx, rz] = rad(y);
    if (rx <= 0 || rz <= 0) continue;
    for (let x = Math.ceil(cx - rx); x <= Math.floor(cx + rx); x++)
      for (let z = Math.ceil(cz - rz); z <= Math.floor(cz + rz); z++)
        if (Math.abs((x - cx) / rx) ** pow + Math.abs((z - cz) / rz) ** pow <= 1.0001)
          g.box(x, x, y, y, z, z, p);
  }
}

/** The highest z at (x, y), or `miss`. */
function zTop(g: Grid, x: number, y: number, miss = 0): number {
  for (let z = 60; z >= -60; z--) if (g.has(x, y, z)) return z;
  return miss;
}
/** The grid flipped across the plane between x = -1 and x = 0. */
function mirror(g: Grid): Grid {
  const o = new Grid();
  g.each((x, y, z, c) => {
    o.set(-1 - x, y, z, c);
  });
  return o;
}

const WHITE = new THREE.MeshBasicMaterial({ color: "#ffffff" });
/** Flashes a sculpt white (the hit flash). */
export function flash(root: THREE.Object3D, on: boolean): void {
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    if (on) {
      m.userData.orig ??= m.material;
      m.material = WHITE;
    } else if (m.userData.orig) m.material = m.userData.orig as THREE.Material;
  });
}

type Palette = Record<string, string>;
type Build = (c: (k: string) => string) => Sculpt;

const colours = (pal: Palette, silhouette: boolean) => (k: string) =>
  silhouette ? (k === "eye" ? SIL_EYE : SIL) : (pal[k] ?? "#ff00ff");

const stripe =
  (a: string, b: string, n = 5): Paint =>
  (p) =>
    (p.x * 3 + p.z * 5 + p.y) % n === 0 ? b : a;

// MARK: The Rate Limit

const RATE = {
  wood: "#8c5c36",
  woodDark: "#6b4326",
  gold: "#f5c842",
  glass: "#bfe3f2",
  sand: "#e9b73d",
  sandDark: "#c9971f",
  stream: "*#ffd35c",
  eye: "*#fff6e0",
  pupil: "*#d83a2a",
  mouth: "#7a2a1f",
  teeth: C.white,
};

/** An hourglass with a grudge: wooden frame, glass bulbs full of sand with a face, fists on its shoulders. */
function rateLimit(c: (k: string) => string): Sculpt {
  const S = 2;
  const root = new THREE.Group();
  root.scale.setScalar(S);
  const rig = new THREE.Group();
  root.add(rig);

  // Frame.
  const frame = new Grid();
  const wood = stripe(c("wood"), c("woodDark"));
  frame.box(-13, 13, 2, 4, -9, 9, wood);
  frame.box(-12, 12, 5, 5, -8, 8, c("woodDark"));
  frame.box(-13, 13, 41, 43, -9, 9, wood);
  frame.box(-12, 12, 40, 40, -8, 8, c("woodDark"));
  for (const sx of [-1, 1])
    for (const sz of [-1, 1]) {
      frame.ell(sx * 11, 22.5, sz * 7.5, 1.7, 17.5, 1.7, wood, 5);
      frame.box(sx * 11 - 2, sx * 11 + 2, 0, 1, sz * 7.5 - 2, sz * 7.5 + 2, c("woodDark"));
    }
  frame.ell(0, 45, 0, 2.2, 2.2, 2.2, c("gold"), 2.4);
  for (const sx of [-1, 1]) {
    frame.box(sx * 13, sx * 15, 36, 42, -2, 2, c("woodDark"));
    frame.box(sx * 13, sx * 15, 41, 41, -2, 2, c("gold"));
  }
  frame.box(-6, 6, 3, 3, 9, 9, c("gold"));
  part(rig, frame, [0, 0, 0]);

  // Glass bulbs, the sand inside them, and the stream between.
  const rad = (y: number): [number, number] => {
    const k = (Math.abs(y - 22.5) / 17.5) ** 1.2;
    return [1.5 + 9.5 * k, 1 + 7 * k];
  };
  const sand = new Grid();
  const sandCol: Paint = (p) => (hash(p.x, p.y, p.z, 4) < 0.25 ? c("sandDark") : c("sand"));
  lathe(sand, 25, 39, (y) => [rad(y)[0] - 1.3, rad(y)[1] - 1.3], sandCol);
  lathe(
    sand,
    6,
    13,
    (y) => [Math.min(rad(y)[0] - 1.3, 9.8 - (y - 6) * 1.2), Math.min(rad(y)[1] - 1.3, 6.5 - (y - 6) * 0.8)],
    sandCol,
  );
  const glassG = new Grid();
  lathe(glassG, 5, 40, rad, c("glass"));
  sand.each((x, y, z) => {
    glassG.del(x, y, z);
  });
  for (let y = 13; y <= 25; y++) glassG.del(0, y, 0);
  // The face, set into the sand's front.
  const face = new Grid();
  const eyes: THREE.Group[] = [];
  for (const sx of [-1, 1]) {
    const ex = sx * 3.5;
    const z0 = zTop(sand, Math.round(ex), 35, 4);
    const eg = block(rig, 4, 3, 2, c("eye"), [ex, 35, z0]);
    block(eg, 2, 2, 1, c("pupil"), [-sx * 0.3, -0.2, 2]);
    eyes.push(eg);
    for (let i = 0; i < 5; i++) {
      const bx = sx * (2 + i);
      const by = 37 + Math.floor(i / 2);
      face.set(bx, by, zTop(sand, bx, by, 4) + 1, c("mouth"));
    }
  }
  for (let x = -3; x <= 3; x++)
    for (let y = 29; y <= 31; y++) {
      const z = zTop(sand, x, y, 3);
      sand.set(x, y, z, c("mouth"));
      if ((y === 31 && x % 2 !== 0) || (y === 29 && x % 2 === 0)) sand.set(x, y, z + 1, c("teeth"));
    }
  sand.merge(face);
  part(rig, sand, [0, 0, 0]);
  const stream = new Grid();
  for (let y = 12; y <= 26; y++) stream.set(0, y, 0, c("stream"));
  const streamPart = part(rig, stream, [0, 19, 0]);
  const glassMesh = part(rig, glassG, [0, 0, 0], [0, 0, 0], { opacity: 0.38, jitter: 0.03 });
  glassMesh.userData.glass = true;

  // Fists on wooden arms.
  const arms: THREE.Group[] = [];
  for (const sx of [-1, 1]) {
    const a = new Grid();
    a.tube(
      [
        [sx * 16, 38, 0],
        [sx * 17.5, 32, 2],
        [sx * 17.5, 26, 4],
      ],
      2,
      2,
      wood,
    );
    a.box(sx * 17.5 - 3, sx * 17.5 + 3, 19, 25, 2, 8, c("woodDark"));
    a.box(sx * 17.5 - 3, sx * 17.5 + 3, 24, 25, 3, 9, c("gold"));
    for (let i = -1; i <= 1; i++) a.box(sx * 17.5 + i * 2, sx * 17.5 + i * 2, 20, 24, 9, 9, c("wood"));
    arms.push(part(rig, a, [sx * 16, 38, 0]));
  }

  return {
    root,
    height: 47 * VOX * S,
    update({ t, hurt, attack, fall }) {
      const w = wind(attack);
      rig.rotation.z = Math.sin(t * 1.3) * 0.025 - fall * 1.45 + hurt * 0.06 * Math.sin(t * 60);
      rig.rotation.x = -w * 0.18 - hurt * 0.12;
      rig.position.y = fall * 13.5 * VOX;
      rig.position.x = fall * 6 * VOX;
      rig.scale.y = 1 + Math.sin(t * 2.2) * 0.012;
      arms[0]!.rotation.x = -w * 2.3 - Math.sin(t * 1.7) * 0.07 + fall * 0.8;
      arms[1]!.rotation.x = -w * 2.3 - Math.sin(t * 1.7 + 1.5) * 0.07 + fall * 0.8;
      arms[0]!.rotation.z = -0.1 - w * 0.2;
      arms[1]!.rotation.z = 0.1 + w * 0.2;
      streamPart.scale.set(
        0.7 + 0.5 * Math.abs(Math.sin(t * 9)),
        1 - fall,
        0.7 + 0.5 * Math.abs(Math.sin(t * 9)),
      );
      for (const [i, e] of eyes.entries()) {
        const pulse = 1 + 0.06 * Math.sin(t * 4 + i) + hurt * 0.2;
        e.scale.set(pulse, (1 - fall * 0.9) * (1 + w * 0.2) * pulse, 1);
      }
    },
  };
}

// MARK: The Context Window

const WINDOW = {
  frame: "#3f89c9",
  title: "#2f6fa8",
  screen: "#a8dcf7",
  screenDark: "#8ec6e8",
  back: "#25456c",
  line: "#3d6ea5",
  rim: "#5d8fc0",
  red: "#e06c5f",
  yellow: "#e9b73d",
  green: "#72bf52",
  eye: "*#fffdf6",
  pupil: C.ink,
  mouth: "#2b4f7a",
  teeth: C.white,
  glove: "#e8f4fd",
  gloveDark: "#b8d8ee",
};

/** A browser window that forgot everything: its bottom panes crumble away. Thick frame, a back with a scroll bar. */
function contextWindow(c: (k: string) => string): Sculpt {
  const S = 2.1;
  const root = new THREE.Group();
  root.scale.setScalar(S);
  const rig = new THREE.Group();
  root.add(rig);
  const g = new Grid();
  g.box(-16, 16, 8, 38, -5, 5, (p) =>
    hash(p.x, p.y, p.z, 2) < 0.15 ? lighten(c("frame"), 0.06) : c("frame"),
  );
  // Front: title bar, recessed screen.
  g.box(-15, 15, 34, 37, 5, 5, c("title"));
  for (let x = -14; x <= 14; x++)
    for (let y = 10; y <= 32; y++) {
      g.del(x, y, 4);
      g.del(x, y, 5);
      g.set(x, y, 3, (x + y) % 6 === 0 ? c("screenDark") : c("screen"));
    }
  for (const [i, k] of (["red", "yellow", "green"] as const).entries())
    g.box(-14 + i * 4, -13 + i * 4, 35, 36, 6, 6, c(k));
  // Mouth: recessed, with teeth.
  for (let x = -7; x <= 7; x++)
    for (let y = 15; y <= 19; y++) {
      g.del(x, y, 3);
      g.set(x, y, 2, c("mouth"));
      if (y >= 18 && x % 3 === 0) g.box(x, x + 1, y, y, 3, 3, c("teeth"));
      if (y <= 16 && (x + 2) % 3 === 0) g.box(x, x + 1, y, y, 3, 3, c("teeth"));
    }
  // Back: a dark panel, faded text lines and a scroll bar.
  for (let x = -14; x <= 14; x++)
    for (let y = 10; y <= 32; y++) {
      g.del(x, y, -5);
      g.del(x, y, -4);
      g.set(x, y, -3, c("back"));
    }
  for (let y = 31; y >= 12; y -= 3) {
    const len = 6 + Math.floor(hash(y, 3, 9, 1) * 14);
    g.box(-12, -12 + len, y, y, -4, -4, c("line"));
  }
  g.box(11, 13, 11, 31, -4, -4, c("rim"));
  g.box(11, 13, 19, 27, -5, -5, lighten(c("rim"), 0.3));
  // Crumbling bottom: holes grow towards the lower edge.
  for (let x = -17; x <= 17; x++)
    for (let y = 7; y <= 15; y++)
      for (let z = -6; z <= 7; z++)
        if (g.has(x, y, z) && hash(x, y, z, 9) < ((16 - y) / 8) ** 1.3 * 0.85) g.del(x, y, z);
  part(rig, g, [0, 24, 0]);
  const eyes: THREE.Group[] = [];
  for (const sx of [-1, 1]) {
    const e = block(rig, 5, 4, 2, c("eye"), [sx * 8, 25.5, 4]);
    block(e, 2, 2, 1, c("pupil"), [-sx * 0.2, -0.3, 2]);
    eyes.push(e);
  }
  // Gloved hands, floating either side.
  const hands: THREE.Group[] = [];
  for (const sx of [-1, 1]) {
    const h = new Grid();
    h.box(-3, 3, -3, 3, -3, 3, c("glove"));
    for (let i = -2; i <= 2; i += 2) h.box(i - 1, i, -3, 0, 4, 5, c("glove"));
    h.box(sx * 4, sx * 5, -1, 1, -1, 2, c("gloveDark"));
    h.box(-3, 3, -5, -4, -3, 3, c("frame"));
    hands.push(local(rig, h, [sx * 23, 22, 4]));
  }
  // Pixels falling off the bottom.
  const bits: { g: THREE.Group; ph: number; x: number; z: number }[] = [];
  for (let i = 0; i < 9; i++) {
    const b = new Grid();
    for (let j = 0; j < 4; j++) {
      const k = hash(i, j, 1, 5);
      b.box(
        j % 2,
        (j % 2) + 1,
        Math.floor(k * 3),
        Math.floor(k * 3) + 1,
        j >> 1,
        (j >> 1) + 1,
        hash(i, j, 2, 5) < 0.5 ? c("screen") : c("frame"),
      );
    }
    const x = (hash(i, 7, 7, 3) * 2 - 1) * 13;
    const z = (hash(i, 8, 8, 3) * 2 - 1) * 4;
    bits.push({ g: local(rig, b, [x, 8, z]), ph: i / 9, x, z });
  }

  return {
    root,
    height: 46 * VOX * S,
    update({ t, hurt, attack, fall }) {
      const w = wind(attack);
      rig.position.y = 6 * VOX + Math.sin(t * 1.9) * 1.2 * VOX - fall * 6 * VOX;
      rig.rotation.y = Math.sin(t * 0.9) * 0.08 + w * 0.5;
      rig.rotation.z = Math.sin(t * 1.3) * 0.03 + hurt * 0.1 * Math.sin(t * 50) - fall * 0.35;
      rig.rotation.x = fall * 0.5 + w * -0.12;
      rig.scale.y = 1 - fall * 0.35;
      for (const [i, h] of hands.entries()) {
        const sx = i === 0 ? -1 : 1;
        h.position.set(
          sx * (23 - w * 6) * VOX,
          (22 + Math.sin(t * 2.4 + i * 2) * 1.5 + w * 7) * VOX,
          (4 + w * 7) * VOX,
        );
        h.rotation.z = sx * (-0.2 - w * 0.5);
        h.rotation.x = -w * 0.8;
      }
      for (const e of eyes) e.scale.set(1, (1 - fall * 0.9) * (1 + 0.05 * Math.sin(t * 5)), 1);
      for (const b of bits) {
        const k = (t * 0.22 + b.ph) % 1;
        b.g.position.set((b.x + Math.sin(t + b.ph * 9) * 1.2) * VOX, (13 - k * 12) * VOX, b.z * VOX);
        b.g.rotation.y = k * 6;
        b.g.scale.setScalar(Math.max(0.01, 1 - k ** 2));
      }
    },
  };
}

// MARK: Merge Conflict

const MERGE = {
  red: "#e06c5f",
  redDark: "#b94a3f",
  redLight: "#f08a7c",
  green: "#72bf52",
  greenDark: "#53983a",
  greenLight: "#8fd86e",
  gold: "#f2c13a",
  belt: "#8a8682",
  beltDark: "#5f5c58",
  eye: "*#fffdf6",
  pupil: C.ink,
  mouth: "#5b1f1a",
  teeth: C.white,
  spark: "*#fff1a8",
  seam: "#2b2433",
};

/** Two halves that can't agree: one red, one green, each its own body, arm and head, a seam between them. */
function mergeConflict(c: (k: string) => string): Sculpt {
  const S = 1.7;
  const root = new THREE.Group();
  root.scale.setScalar(S);
  const rig = new THREE.Group();
  rig.position.x = 0.5 * VOX;
  root.add(rig);
  // The left half, then its mirror. `dark`, `base` and `light` are the half's own colours.
  const half = (base: string, dark: string, light: string, sign: "-" | "+") => {
    const body = new Grid();
    const skin: Paint = (p) => (p.y > 26 && p.y < 29 ? dark : hash(p.x, p.y, p.z, 3) < 0.1 ? light : base);
    // Floor bars, boots, legs, belt, torso.
    body.box(-11, -2, 0, 1, -5, 8, c("belt"));
    body.box(-10, -3, 2, 4, -4, 6, dark);
    body.box(-10, -3, 5, 10, -4, 4, base);
    body.box(-10, -3, 5, 6, -4, 4, dark);
    body.box(-12, -1, 11, 13, -6, 6, (p) => (p.y === 12 && p.x % 3 === 0 ? c("beltDark") : c("belt")));
    body.box(-3, -1, 11, 13, 6, 7, c("gold"));
    body.ell(-6.5, 21.5, 0, 6.1, 8.5, 7.5, skin, 5);
    body.ell(-12, 28, 0, 3.2, 3.2, 4.2, dark, 2.4);
    body.box(-9, -2, 16, 25, 7, 7, light);
    // The seam: a crack down the middle, jagged.
    for (let y = 14; y <= 29; y++) if (y % 4 < 2) body.set(-1, y, 7, c("seam"));
    // The back's diff lines.
    for (const [y, len] of [
      [18, 7],
      [20, 4],
      [26, 6],
      [28, 3],
    ] as const)
      body.box(-11, -11 + len, y, y, -8, -8, light);
    body.box(-9, -5, 22, 23, -8, -8, dark);
    // Head.
    const head = new Grid();
    head.ell(-5.5, 38, 0, 5.8, 8, 7.5, skin, 4.5);
    const hz = (x: number, y: number) => zTop(head, x, y, 7);
    for (let x = -10; x <= -1; x++)
      for (let y = 32; y <= 34; y++) {
        const z = hz(x, y);
        head.del(x, y, z);
        head.set(x, y, z - 1, c("mouth"));
        if (y === 34 && x % 2 === 0) head.set(x, y, z, c("teeth"));
        if (y === 32 && x % 2 !== 0) head.set(x, y, z, c("teeth"));
      }
    // Conflict marker hair: a gold chevron.
    for (const x0 of [-10, -7, -4]) {
      for (let z = -2; z <= 2; z++) {
        head.box(x0 + 1, x0 + 2, 49, 50, z, z, c("gold"));
        head.box(x0, x0 + 1, 47, 48, z, z, c("gold"));
        head.box(x0 + 1, x0 + 2, 45, 46, z, z, c("gold"));
      }
    }
    const brow = new Grid();
    for (let i = 0; i < 6; i++) brow.set(-9 + i, 44 - Math.floor(i / 2), hz(-9 + i, 43), c("mouth"));
    head.merge(brow);
    // Arm: shoulder to fist.
    const arm = new Grid();
    arm.tube(
      [
        [-14, 28, 0],
        [-16, 22, 2],
        [-16.5, 17, 4],
      ],
      2.8,
      2.6,
      skin,
    );
    arm.box(-19, -14, 11, 17, 2, 8, dark);
    arm.box(-19, -14, 15, 16, 3, 9, light);
    if (sign === "-") arm.box(-18, -15, 12, 12, 9, 9, c("gold"));
    return { body, head, arm };
  };
  const L = half(c("red"), c("redDark"), c("redLight"), "-");
  const Rr = half(c("green"), c("greenDark"), c("greenLight"), "+");
  // The right half's back wears a plus where the left has a minus.
  const mir = (g: Grid) => mirror(g);
  const halves = [-1, 1].map((sx) => {
    const src = sx < 0 ? L : Rr;
    const grp = new THREE.Group();
    rig.add(grp);
    const hip: V3 = [0, 11, 0];
    const body = sx < 0 ? src.body : mir(src.body);
    if (sx > 0) {
      for (let y = 20; y <= 25; y++) body.set(6, y, -8, c("greenDark"));
    }
    grp.add(bake(body, { origin: hip, seed: sx }));
    grp.position.set(0, 11 * VOX, 0);
    const headG = sx < 0 ? src.head : mir(src.head);
    const hp: V3 = [sx < 0 ? -5 : 4, 33, 0];
    const head = part(grp, headG, hp, hip, { seed: 5 + sx });
    // Eye and pupil, looking at the other half.
    const ex = sx < 0 ? -7 : 6;
    const z0 = zTop(headG, ex, 39, 7);
    const eg = block(head, 4, 4, 2, c("eye"), [ex - hp[0], 39 - hp[1], z0]);
    const pup = block(eg, 2, 2, 1, c("pupil"), [-sx * 0.5, -0.4, 2]);
    const armG = sx < 0 ? src.arm : mir(src.arm);
    const sh: V3 = [sx < 0 ? -14 : 13, 28, 0];
    const arm = part(grp, armG, sh, hip, { seed: 9 + sx });
    return { grp, head, arm, eg, pup, sx };
  });
  // Sparks at the seam.
  const sparks = Array.from({ length: 5 }, (_, i) => block(rig, 2, 2, 2, c("spark"), [0, 16 + i * 4, 8]));

  return {
    root,
    height: 51 * VOX * S,
    update({ t, hurt, attack, fall }) {
      const w = wind(attack);
      const argue = 0.5 + 0.5 * Math.sin(t * 1.1);
      const down = clamp01(fall);
      rig.position.y = -down * 4 * VOX;
      rig.rotation.x = -down * 1.2;
      rig.position.z = down * 4 * VOX;
      const breathe = Math.sin(t * 2.2);
      for (const h of halves) {
        const sx = h.sx;
        h.grp.position.x = sx * (argue * 0.5 + Math.max(0, w) * 3.5 + (w < 0 ? w * 1.5 : 0)) * VOX;
        h.grp.rotation.z =
          -sx * (0.03 + argue * 0.03 + Math.max(0, w) * 0.1) + hurt * 0.05 * Math.sin(t * 55);
        h.grp.scale.y = 1 + breathe * 0.012;
        h.head.rotation.y = sx * (0.25 * Math.sin(t * 0.9 + (sx > 0 ? 1.7 : 0)) - 0.15 - w * 0.2);
        h.head.rotation.x = 0.06 * Math.sin(t * 1.4 + sx) + down * 0.6 + hurt * -0.2;
        h.head.rotation.z = sx * 0.04 * Math.sin(t * 1.7);
        h.arm.rotation.x = -w * 2.4 + Math.sin(t * 1.5 + (sx > 0 ? 2 : 0)) * 0.12 + down * 0.5;
        h.arm.rotation.z = sx * (0.12 + 0.1 * Math.sin(t * 1.2) + (w > 0 ? w * 0.4 : 0));
        h.pup.position.x = -sx * (0.5 + 0.4 * Math.sin(t * 0.7)) * VOX;
        h.eg.scale.y = 1 - down * 0.9;
      }
      sparks.forEach((s, i) => {
        const on = hash(Math.floor(t * 9), i, 3, 1) < 0.35 + w * 0.5 + hurt * 0.4;
        s.scale.setScalar(on ? 0.5 + hash(Math.floor(t * 9), i, 8, 2) : 0.001);
        s.position.x = (hash(Math.floor(t * 9), i, 5, 1) * 2 - 1) * 1.2 * VOX;
      });
    },
  };
}

// MARK: The Hallucination

const HALLU = {
  body: "#9b6fd6",
  bodyDark: "#7a52b5",
  swirl: "#d9c2f5",
  dark: "#4a2a73",
  eye: "*#fffdf6",
  pupil: C.ink,
  mouth: "#4a2a73",
  teeth: C.white,
  star: "*#ffd35c",
  tip: "*#ffe9a0",
};

/** A swirl that is very sure of itself: a hovering purple ghost-blob, a spiral across it, a tail, gold sparkles. */
function hallucination(c: (k: string) => string): Sculpt {
  const S = 1.9;
  const root = new THREE.Group();
  root.scale.setScalar(S);
  const rig = new THREE.Group();
  root.add(rig);
  const g = new Grid();
  const skin: Paint = (p) => {
    const dx = p.x;
    const dy = p.y - 24;
    const th = Math.atan2(dy, dx);
    const r = Math.hypot(dx, dy);
    const face = p.z > 3 && Math.abs(p.x) < 10 && p.y > 13 && p.y < 31;
    const band = ((((th / (Math.PI * 2)) * 2 + r / 5.5) % 1) + 1) % 1;
    if (!face && band < 0.24) return c("swirl");
    if (p.y > 31 && hash(p.x, p.y, p.z, 8) < 0.25) return c("swirl");
    return p.y < 12 || (p.z < -4 && p.y < 20) ? c("bodyDark") : c("body");
  };
  g.ell(0, 21, 0, 13.5, 14, 11.5, skin, 2.5);
  g.ell(0, 11, 0, 12, 6, 10, skin, 2.6);
  for (const sx of [-1, 1])
    for (const sz of [-1, 1])
      g.ell(sx * 7.5, 4, sz * 5.5, 4.5, 4.5, 4.5, (p) => (p.z < 0 ? c("bodyDark") : c("body")), 2.4);
  // Mouth.
  for (let x = -5; x <= 5; x++)
    for (let y = 14; y <= 17; y++) {
      const z = zTop(g, x, y, 8);
      g.del(x, y, z);
      g.set(x, y, z - 1, c("mouth"));
      if (y === 17 && x % 2 === 0) g.set(x, y, z, c("teeth"));
    }
  const body = part(rig, g, [0, 10, 0]);
  const eyes: THREE.Group[] = [];
  const pupils: THREE.Group[] = [];
  for (const sx of [-1, 1]) {
    const ex = sx * 7;
    const zf = zTop(g, sx * 9, 27, 8);
    const e = block(body, 5, 5, 3, c("eye"), [ex, 27, zf - 1], {});
    e.position.set(ex * VOX, (27 - 10) * VOX, (zf - 1) * VOX);
    eyes.push(e);
    pupils.push(block(e, 3, 3, 1, c("pupil"), [0, 0, 3]));
  }
  for (const sx of [-1, 1]) {
    const a = new Grid();
    a.tube(
      [
        [sx * 13, 24, 0],
        [sx * 17, 19, 2],
        [sx * 19, 15, 4],
      ],
      2.6,
      2.2,
      (p) => (p.u > 0.6 ? c("swirl") : c("body")),
    );
    a.ell(sx * 19, 14, 4, 3.4, 3.4, 3.4, c("swirl"), 2.4);
    pupils.push(part(body, a, [sx * 13, 24, 0], [0, 10, 0]));
  }
  const tail = new Grid();
  tail.tube(
    [
      [0, 8, -9],
      [0, 5, -15],
      [0, 8, -21],
      [0, 16, -24],
    ],
    4,
    1.4,
    (p) => mix(c("bodyDark"), c("swirl"), p.u * 0.6),
  );
  tail.ell(0, 18, -24, 2.4, 2.4, 2.4, c("tip"), 2.2);
  const tailPart = part(rig, tail, [0, 8, -9]);
  // Sparkles drifting round it.
  const stars = Array.from({ length: 7 }, (_, i) => {
    const s = new Grid();
    s.set(0, 0, 0, c("star"));
    for (const d of [-1, 1]) {
      s.set(d, 0, 0, c("star"));
      s.set(0, d, 0, c("star"));
      s.set(0, 0, d, c("star"));
    }
    const m = part(rig, s, [0, 0, 0], [0, 0, 0], { flat: true });
    m.userData.noFlash = true;
    return { m, i };
  });

  return {
    root,
    height: 40 * VOX * S,
    update({ t, hurt, attack, fall }) {
      const w = wind(attack);
      const swell = 1 + Math.sin(t * 2.2) * 0.025 + Math.max(0, w) * 0.14;
      rig.position.y = (3 + Math.sin(t * 1.6) * 1.2) * VOX * (1 - fall);
      body.scale.set(
        swell * (1 + fall * 0.35),
        (swell + 0) * (1 - fall * 0.65) * (1 - hurt * 0.08),
        swell * (1 + fall * 0.35),
      );
      rig.rotation.z = Math.sin(t * 1.1) * 0.04 + hurt * 0.12 * Math.sin(t * 45);
      rig.rotation.y = Math.sin(t * 0.6) * 0.1 + w * 0.6;
      tailPart.rotation.y = Math.sin(t * 2.3) * 0.5;
      tailPart.rotation.x = Math.sin(t * 1.7) * 0.12;
      for (const e of eyes) e.scale.set(1, (1 - fall * 0.9) * (1 - 0.1 * hurt), 1);
      pupils.slice(0, 2).forEach((p, i) => {
        p.position.set(Math.cos(t * 1.6 + i * 2.4) * 0.9 * VOX, Math.sin(t * 2.1 + i) * 0.9 * VOX, 3 * VOX);
      });
      pupils.slice(2).forEach((p, i) => {
        p.rotation.z = (i === 0 ? 1 : -1) * (Math.sin(t * 2 + i * 3) * 0.2 + Math.max(0, w) * 0.7);
        p.rotation.x = -w * 0.8;
      });
      for (const { m, i } of stars) {
        const a = t * (0.5 + (i % 3) * 0.15) + i * 0.9;
        const r = 21 + Math.max(0, w) * 10 + (i % 2) * 3;
        m.position.set(
          Math.cos(a) * r * VOX,
          (22 + Math.sin(a * 1.7 + i) * 12 + (i % 3) * 3) * VOX,
          Math.sin(a) * r * 0.8 * VOX,
        );
        m.scale.setScalar((0.5 + 0.9 * Math.abs(Math.sin(t * 2.4 + i * 1.3))) * (1 - fall));
        m.rotation.y = t + i;
      }
    },
  };
}

// MARK: The Invoice

const INVOICE = {
  paper: "#f3e7b8",
  paperDark: "#d9c98f",
  red: "#c0392b",
  white: C.white,
  text: "#9a9486",
  eye: "*#fffdf6",
  pupil: C.ink,
  mouth: "#5b1f1a",
  teeth: C.white,
  pen: "#f5c842",
  ink: C.ink,
};

/** A bill that never stops growing: a tall receipt with a red header, a snarl, a "PAID?" stamp, a torn hem and paper fists. */
function invoice(c: (k: string) => string): Sculpt {
  const S = 1.9;
  const root = new THREE.Group();
  root.scale.setScalar(S);
  const rig = new THREE.Group();
  root.add(rig);

  // The sheet: three deep, torn along the bottom edge.
  const sheet = new Grid();
  const paper: Paint = (p) => (p.y < 40 && hash(p.x, p.y, p.z, 6) < 0.12 ? c("paperDark") : c("paper"));
  for (let x = -11; x <= 11; x++) {
    const hem = 4 + ((x + 11) % 4 < 2 ? 0 : 3);
    sheet.box(x, x, hem, 46, -1, 1, paper);
  }
  // Red header with a row of white letters.
  sheet.box(-11, 11, 40, 46, -1, 1, c("red"));
  for (let x = -9; x <= 9; x += 3) {
    sheet.box(x, x + 1, 43, 44, 2, 2, c("white"));
    sheet.box(x, x, 41, 42, 2, 2, c("white"));
  }
  // Grey lines of small print, a total line, and a stamp.
  for (const [y, w] of [
    [17, 9],
    [14, 6],
    [11, 8],
  ] as const)
    sheet.box(-9, -9 + w, y, y, 2, 2, c("text"));
  sheet.box(-9, -3, 7, 8, 2, 2, c("red"));
  for (let a = 0; a < 24; a++) {
    const th = (a / 24) * Math.PI * 2;
    sheet.box(
      Math.round(6 + Math.cos(th) * 3.6),
      Math.round(6 + Math.cos(th) * 3.6),
      Math.round(13 + Math.sin(th) * 3.6),
      Math.round(13 + Math.sin(th) * 3.6),
      2,
      3,
      c("red"),
    );
  }
  sheet.box(4, 8, 13, 13, 3, 3, c("red"));
  // Snarl: angry brows, a wide mouth of teeth.
  for (const sx of [-1, 1])
    for (let i = 0; i < 6; i++) sheet.set(sx * (3 + i), 36 + Math.round(i * 0.7) * 1, 2, c("ink"));
  for (let x = -6; x <= 6; x++)
    for (let y = 23; y <= 27; y++) {
      sheet.set(x, y, 2, c("mouth"));
      if ((y === 27 && x % 2 === 0) || (y === 23 && x % 2 !== 0)) sheet.set(x, y, 3, c("teeth"));
    }
  const body = part(rig, sheet, [0, 4, 0]);
  const eyes: THREE.Group[] = [];
  for (const sx of [-1, 1]) {
    const e = block(body, 5, 5, 2, c("eye"), [sx * 5.5, 32, 1.5]);
    e.position.set(sx * 5.5 * VOX, (32 - 4) * VOX, 2 * VOX);
    block(e, 3, 3, 1, c("pupil"), [-sx * 0.3, -0.2, 2]);
    eyes.push(e);
  }

  // Paper arms with fists, one clutching a pen.
  const arms: THREE.Group[] = [];
  for (const sx of [-1, 1]) {
    const a = new Grid();
    a.tube(
      [
        [sx * 11, 30, 0],
        [sx * 16, 26, 3],
        [sx * 17.5, 21, 6],
      ],
      2,
      1.8,
      (p) => (p.u > 0.5 ? c("paperDark") : c("paper")),
    );
    a.ell(sx * 17.5, 19, 7, 3.2, 3.2, 3.2, c("paper"), 2.4);
    if (sx === 1) {
      a.box(18, 18, 12, 25, 8, 8, c("pen"));
      a.box(18, 18, 10, 12, 8, 8, c("ink"));
    }
    arms.push(part(rig, a, [sx * 11, 30, 0]));
  }
  // A paper tail that curls out of the hem, the bill that never ends.
  const tail = new Grid();
  tail.tube(
    [
      [0, 6, -1],
      [0, 3, -6],
      [0, 5, -11],
      [0, 10, -13],
    ],
    2.2,
    1.2,
    (p) => (p.u > 0.5 ? c("paperDark") : c("paper")),
  );
  const tailPart = part(rig, tail, [0, 6, -1]);

  return {
    root,
    height: 47 * VOX * S,
    update({ t, hurt, attack, fall }) {
      const w = wind(attack);
      rig.rotation.z = Math.sin(t * 1.2) * 0.04 + hurt * 0.07 * Math.sin(t * 55);
      rig.rotation.x = -w * 0.35 - hurt * 0.1 - fall * 1.45;
      rig.position.y = (1.5 + Math.sin(t * 1.7) * 1.2) * VOX * (1 - fall);
      rig.position.z = -fall * 8 * VOX;
      arms[0]!.rotation.x = -w * 2.1 - Math.sin(t * 1.9) * 0.08 + fall * 0.8;
      arms[1]!.rotation.x = -w * 2.1 - Math.sin(t * 1.9 + 1.4) * 0.08 + fall * 0.8;
      arms[0]!.rotation.z = -0.08 - w * 0.2;
      arms[1]!.rotation.z = 0.08 + w * 0.2;
      tailPart.rotation.y = Math.sin(t * 2.1) * 0.45;
      tailPart.rotation.x = Math.sin(t * 1.5) * 0.12;
      for (const [i, e] of eyes.entries()) {
        const pulse = 1 + 0.05 * Math.sin(t * 4 + i) + hurt * 0.18;
        e.scale.set(pulse, (1 - fall * 0.9) * (1 + w * 0.15) * pulse, 1);
      }
    },
  };
}

// MARK: Public

const BUILDERS: Record<string, [Build, Palette]> = {
  "rate-limit": [rateLimit, RATE],
  "context-window": [contextWindow, WINDOW],
  "merge-conflict": [mergeConflict, MERGE],
  hallucination: [hallucination, HALLU],
  invoice: [invoice, INVOICE],
};

/** A boss sculpture by id. A silhouette is all shadow with only the eyes lit (the teaser's "???"). */
export function buildBoss(id: string, silhouette = false): Sculpt {
  const [build, pal] = BUILDERS[id] ?? BUILDERS["rate-limit"]!;
  return build(colours(pal, silhouette));
}

// MARK: The robot minion

const BOT = {
  metal: C.metal,
  metalLight: C.metalLight,
  metalDark: darken(C.metal, 0.3),
  ink: C.ink,
  screen: `*${C.screen}`,
  red: "*#e06c5f",
  gold: "*#ffd35c",
  muzzle: "*#9dff8a",
};

export interface Bot {
  root: THREE.Group;
  height: number;
  update(t: number): void;
}

/** The robot minion: legs, torso, head with a visor, a blinking antenna, a blaster arm and a backpack. */
export function buildMinion(): Bot {
  const S = 1.6;
  const root = new THREE.Group();
  root.scale.setScalar(S);
  const rig = new THREE.Group();
  root.add(rig);
  const g = new Grid();
  for (const sx of [-1, 1]) {
    g.box(sx * 2 - 1, sx * 2 + 1, 1, 4, -2, 2, BOT.metal);
    g.box(sx * 2 - 1, sx * 2 + 1, 0, 1, -2, 4, BOT.ink);
  }
  g.box(-5, 5, 5, 11, -3, 3, (p) =>
    p.z === 3 && p.y > 6 && p.y < 10 && Math.abs(p.x) < 3 ? BOT.metal : BOT.metalLight,
  );
  g.box(-4, 4, 4, 4, -2, 2, BOT.metalDark);
  g.box(-3, 3, 7, 9, 4, 4, BOT.screen);
  g.box(-1, 1, 6, 6, 4, 4, BOT.gold);
  g.box(-4, 4, 6, 10, -5, -4, BOT.metalDark);
  for (let y = 7; y <= 9; y += 2) g.box(-3, 3, y, y, -6, -6, BOT.ink);
  part(rig, g, [0, 0, 0]);
  const head = new Grid();
  head.box(-5, 5, 0, 6, -4, 4, (p) => (p.y === 0 ? BOT.metalDark : BOT.metalLight));
  head.box(-3, 3, 2, 4, 5, 5, BOT.screen);
  head.box(-6, -6, 2, 4, -1, 1, BOT.ink);
  head.box(6, 6, 2, 4, -1, 1, BOT.ink);
  head.box(0, 0, 7, 8, 0, 0, BOT.ink);
  const headPart = local(rig, head, [0, 12, 0]);
  const tip = [
    block(headPart, 2, 2, 2, BOT.red, [0, 9.5, 0]),
    block(headPart, 2, 2, 2, BOT.gold, [0, 9.5, 0]),
  ];
  const arm = new Grid();
  arm.box(-1, 1, -7, 0, -1, 1, BOT.metal);
  arm.box(-2, 2, -10, -7, -2, 2, BOT.ink);
  arm.box(-1, 1, -10, -10, -1, 1, BOT.metalLight);
  const armPart = local(rig, arm, [6.5, 10, 0]);
  const flashB = block(armPart, 3, 3, 3, BOT.muzzle, [0, -11.5, 0]);
  const other = new Grid().box(-1, 1, -7, 0, -1, 1, BOT.metal);
  const otherPart = local(rig, other, [-6.5, 10, 0]);
  return {
    root,
    height: 22 * VOX * S,
    update(t) {
      const cyc = (t % 0.9) / 0.9;
      const fire = cyc < 0.45 ? ease(Math.min(1, cyc / 0.12)) : 1 - ease(Math.min(1, (cyc - 0.45) / 0.2));
      rig.position.y = Math.abs(Math.sin(t * 3)) * 0.9 * VOX;
      armPart.rotation.x = -fire * 1.45;
      otherPart.rotation.x = Math.sin(t * 3) * 0.2;
      headPart.rotation.y = Math.sin(t * 0.8) * 0.2;
      const blink = Math.floor(t * 2.5) % 2 === 0;
      tip[0]!.visible = blink;
      tip[1]!.visible = !blink;
      flashB.visible = fire > 0.9 && cyc < 0.3;
    },
  };
}

// MARK: The trophy

/** The town's gold cup: a lathed bowl, two handles, a stem and a wooden plinth. */
export function buildTrophy(): THREE.Group {
  const S = 1.2;
  const root = new THREE.Group();
  root.scale.setScalar(S);
  const gold = "#ffd35c";
  const g = new Grid();
  g.box(-6, 6, 0, 1, -5, 5, C.woodDark);
  g.box(-5, 5, 2, 3, -4, 4, mix(C.woodDark, "#ffffff", 0.12));
  lathe(g, 4, 5, () => [4, 4], mix(gold, "#c9971f", 0.4));
  lathe(g, 6, 9, () => [1.4, 1.4], gold);
  lathe(
    g,
    10,
    22,
    (y) => [
      3.2 + 5.6 * Math.sin(((y - 10) / 12) * 1.4 + 0.2),
      3.2 + 5.6 * Math.sin(((y - 10) / 12) * 1.4 + 0.2),
    ],
    (p) => (p.x < -3 && p.y > 13 && p.y < 20 ? lighten(gold, 0.45) : gold),
  );
  for (const sx of [-1, 1])
    g.tube(
      [
        [sx * 8, 20, 0],
        [sx * 11.5, 19, 0],
        [sx * 11, 14, 0],
        [sx * 7, 12.5, 0],
      ],
      1.4,
      1.4,
      gold,
    );
  for (let x = -7; x <= 7; x++)
    for (let z = -7; z <= 7; z++)
      if (x * x + z * z < 40) {
        g.del(x, 22, z);
        g.del(x, 21, z);
        g.set(x, 20, z, darken(gold, 0.35));
      }
  g.ell(0, 17, 6.3, 2.2, 2.2, 1.5, mix(gold, "#c9971f", 0.5), 2.4);
  const grp = part(root, g, [0, 0, 0]);
  grp.rotation.y = 0;
  return root;
}
