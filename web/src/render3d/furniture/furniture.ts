/**
 * Furniture, one builder per piece, named after the shop's (`core/src/office.ts`). Each model stands
 * on its footprint's centre with its front towards +z; a footprint is `w`×`d` tiles.
 */
import * as THREE from "three";
import { C } from "../../art/palette.ts";
import {
  canvasTexture,
  codeScreen,
  glass,
  glow,
  Model,
  painted,
  seeded,
  ticks,
  tint,
  type V3,
} from "../kit/kit.ts";

export interface Asset {
  id: string;
  name: string;
  price: number;
  w: number;
  d: number;
  build: () => Model;
  /** Where a sitter's hips go, from the footprint's centre, and which way they face (radians about y). */
  seat?: { at: V3; turn: number };
  /** Where a sleeper lies. */
  bed?: V3;
}

/** A lamp's light: off by day, `intensity` at night. */
export function light(m: Model, at: V3, color: string, intensity: number, distance = 4): void {
  const l = new THREE.PointLight(color, 0, distance, 1.6);
  l.position.set(...at);
  l.userData.night = intensity;
  l.visible = false;
  m.add(l);
}

/** Four legs under a `w`×`d` top, `h` tall. */
function legs(m: Model, w: number, d: number, h: number, color: string, inset = 0.06, r = 0.025): void {
  for (const sx of [-1, 1])
    for (const sz of [-1, 1]) m.cyl(r, h, color, [sx * (w / 2 - inset), 0, sz * (d / 2 - inset)], r, 8);
}

const BOOKS = ["#c4544b", "#4f8fe0", "#58b36a", "#f0b53c", "#9b6fd6", "#e8e2d4", "#3c4454", "#f28bb2"];
/** A row of books between `x0` and `x1`, standing on `y`. */
function books(m: Model, x0: number, x1: number, y: number, z: number, maxH: number, seed: number): void {
  const rnd = seeded(seed);
  let x = x0;
  while (x < x1 - 0.04) {
    const w = 0.035 + rnd() * 0.035;
    if (x + w > x1) break;
    const h = maxH * (0.65 + rnd() * 0.35);
    const book = m.box([w, h, 0.17], BOOKS[Math.floor(rnd() * BOOKS.length)]!, [x + w / 2, y, z], 0.006);
    if (rnd() < 0.12 && x + 0.12 < x1) book.rotation.z = -0.25;
    x += w + 0.004;
  }
}

/** A pot with soil, its rim `h` high. */
function pot(m: Model, r: number, h: number, color = "#c8734a"): number {
  m.cyl(r * 0.78, h - 0.006, color, [0, 0, 0], r, 16);
  m.cyl(r + 0.015, 0.05, tint(color, -0.12), [0, h - 0.05, 0], r + 0.015, 16);
  m.cyl(r * 0.9, 0.01, "#5e3d28", [0, h - 0.02, 0], r * 0.9, 16);
  return h;
}

/** A tuft of leaves: balls in three greens round `at`. */
function foliage(m: Model, at: V3, size: number, seed: number, count = 7): void {
  const rnd = seeded(seed);
  const greens = [C.leaf, C.leafLight, C.leafDark];
  m.ball(size, C.leaf, at, [1, 0.85, 1], 10);
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2 + rnd();
    const r = size * (0.55 + rnd() * 0.3);
    m.ball(
      size * (0.45 + rnd() * 0.25),
      greens[i % 3]!,
      [at[0] + Math.cos(a) * r, at[1] + (rnd() - 0.3) * size * 0.7, at[2] + Math.sin(a) * r],
      [1, 0.8, 1],
      8,
    );
  }
}

/** A screen on a stand facing +z, showing an agent at work. */
function monitor(m: Model, at: V3, seed: number, w = 0.42): void {
  const [x, y, z] = at;
  m.box([0.16, 0.012, 0.1], C.metal, [x, y, z]);
  m.box([0.03, 0.14, 0.03], C.metal, [x, y, z - 0.02]);
  m.box([w, w * 0.62, 0.035], "#2b2433", [x, y + 0.11, z]);
  m.plane(w - 0.04, w * 0.62 - 0.04, glow("#fff", codeScreen(seed)), [x, y + 0.11 + w * 0.31, z + 0.019]);
}

const rug = (): Model => {
  const m = new Model();
  const tex = canvasTexture(52, 34, (g) => {
    g.fillStyle = C.rugDark;
    g.fillRect(0, 0, 52, 34);
    g.fillStyle = C.rug;
    g.fillRect(2, 2, 48, 30);
    g.fillStyle = C.rugLight;
    g.fillRect(4, 4, 44, 26);
    g.fillStyle = C.rug;
    g.fillRect(6, 6, 40, 22);
    g.fillStyle = C.rugLight;
    for (let i = 0; i < 5; i++) {
      g.fillRect(24 - i * 3, 9 + i * 2, 4 + i * 6, 2);
      g.fillRect(24 - i * 3, 23 - i * 2, 4 + i * 6, 2);
    }
    g.fillStyle = C.rugDark;
    for (let x = 8; x < 46; x += 6) {
      g.fillRect(x, 8, 2, 2);
      g.fillRect(x, 24, 2, 2);
    }
  });
  m.box([2.6, 0.025, 1.7], painted(tex), [0, 0, 0], 0.008);
  return m;
};

const plant = (): Model => {
  const m = new Model();
  const h = pot(m, 0.17, 0.3);
  m.cyl(0.02, 0.2, C.trunk, [0, h, 0], 0.015, 6);
  foliage(m, [0, h + 0.3, 0], 0.2, 3);
  return m;
};

const lamp = (): Model => {
  const m = new Model();
  m.cyl(0.15, 0.05, C.metal, [0, 0, 0], 0.13);
  m.cyl(0.03, 1.02, C.metal, [0, 0.05, 0], 0.03, 8);
  m.cyl(0.2, 0.24, "#f4e3b8", [0, 1.02, 0], 0.11, 16);
  m.ball(0.06, glow(C.lamp), [0, 1.04, 0]);
  light(m, [0, 0.95, 0], "#ffcf7a", 2.2);
  return m;
};

const chair = (): Model => {
  const m = new Model();
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const leg = m.box([0.035, 0.03, 0.2], "#2b2433", [Math.sin(a) * 0.1, 0.02, Math.cos(a) * 0.1]);
    leg.rotation.y = a;
    m.ball(0.025, "#2b2433", [Math.sin(a) * 0.19, 0.025, Math.cos(a) * 0.19]);
  }
  m.cyl(0.025, 0.25, C.metalLight, [0, 0.03, 0], 0.025, 8);
  m.box([0.4, 0.07, 0.38], C.fabric, [0, 0.28, 0], 0.03);
  m.box([0.38, 0.4, 0.07], C.fabric, [0, 0.36, -0.17], 0.035);
  m.box([0.04, 0.15, 0.04], "#2b2433", [-0.19, 0.3, -0.02]);
  m.box([0.04, 0.15, 0.04], "#2b2433", [0.19, 0.3, -0.02]);
  m.box([0.05, 0.03, 0.22], "#2b2433", [-0.19, 0.44, -0.02]);
  m.box([0.05, 0.03, 0.22], "#2b2433", [0.19, 0.44, -0.02]);
  return m;
};

const shelf = (): Model => {
  const m = new Model();
  const [w, h, d] = [0.86, 1.5, 0.32];
  const wood = C.woodDark;
  m.box([w, h, 0.03], tint(wood, -0.15), [0, 0, -d / 2 + 0.015]);
  m.box([0.05, h, d], wood, [-w / 2 + 0.025, 0, 0]);
  m.box([0.05, h, d], wood, [w / 2 - 0.025, 0, 0]);
  for (let i = 0; i < 4; i++) {
    const y = 0.04 + i * 0.47;
    m.box([w, 0.04, d], wood, [0, Math.min(y, h - 0.04), 0]);
    if (i < 3) books(m, -w / 2 + 0.06, w / 2 - 0.06, y + 0.04, 0.02, 0.36, i * 7 + 2);
  }
  return m;
};

const bench = (): Model => {
  const m = new Model();
  for (const x of [-0.32, 0.32]) {
    m.box([0.05, 0.3, 0.05], "#2e2e3a", [x, 0, -0.1]);
    m.box([0.05, 0.3, 0.05], "#2e2e3a", [x, 0, 0.1]);
    m.box([0.05, 0.45, 0.05], "#2e2e3a", [x, 0.3, -0.16]);
  }
  for (let i = 0; i < 3; i++) m.box([0.86, 0.035, 0.09], C.wood, [0, 0.3, -0.11 + i * 0.105], 0.01);
  for (let i = 0; i < 2; i++) m.box([0.86, 0.08, 0.03], C.wood, [0, 0.48 + i * 0.13, -0.17], 0.01);
  return m;
};

export const desk =
  (seed = 1, tiles = 2) =>
  (): Model => {
    const m = new Model();
    const h = 0.62;
    if (tiles === 1) {
      // One tile, as the map and the 2D desk have it: a top on two side panels, the screen in the middle.
      const [w, d] = [0.9, 0.7];
      m.box([w, 0.05, d], C.woodLight, [0, h, 0], 0.015);
      for (const x of [-1, 1]) m.box([0.05, h, d - 0.08], C.wood, [x * (w / 2 - 0.06), 0, 0]);
      monitor(m, [0, h + 0.05, -0.15], seed);
      m.box([0.36, 0.02, 0.12], "#3c4454", [0, h + 0.05, 0.14], 0.008);
      m.cyl(0.045, 0.1, "#e25d5d", [0.3, h + 0.05, 0.05], 0.045, 10);
      return m;
    }
    const [w, d] = [1.7, 0.7];
    m.box([w, 0.05, d], C.woodLight, [0, h, 0], 0.015);
    m.box([0.05, h, d - 0.08], C.wood, [-w / 2 + 0.06, 0, 0]);
    m.box([0.4, h - 0.02, d - 0.08], C.wood, [w / 2 - 0.24, 0, 0]);
    for (let i = 0; i < 3; i++) {
      m.box([0.36, 0.17, 0.02], C.woodLight, [w / 2 - 0.24, 0.04 + i * 0.19, d / 2 - 0.045]);
      m.box([0.08, 0.015, 0.02], C.metal, [w / 2 - 0.24, 0.13 + i * 0.19, d / 2 - 0.035]);
    }
    // The screen is over the left tile, where the chair goes.
    monitor(m, [-0.45, h + 0.05, -0.15], seed);
    m.box([0.36, 0.02, 0.12], "#3c4454", [-0.45, h + 0.05, 0.14], 0.008);
    m.box([0.07, 0.025, 0.1], "#3c4454", [-0.12, h + 0.05, 0.15], 0.012);
    m.cyl(0.045, 0.1, "#e25d5d", [0.25, h + 0.05, 0.05], 0.045, 10);
    m.ball(0.06, C.leaf, [0.62, h + 0.17, -0.12]);
    m.cyl(0.05, 0.1, "#c8734a", [0.62, h + 0.05, -0.12], 0.05);
    return m;
  };

const coffee = (): Model => {
  const m = new Model();
  m.box([0.75, 0.75, 0.55], C.wood, [0, 0, 0], 0.02);
  m.box([0.7, 0.01, 0.5], C.woodDark, [0, 0.75, 0], 0.004);
  m.box([0.4, 0.48, 0.34], "#3c4454", [0, 0.76, -0.04], 0.05);
  m.box([0.3, 0.12, 0.05], "#2b2433", [0, 1.07, 0.13], 0.01);
  m.plane(0.12, 0.05, glow("#3ddc84"), [-0.05, 1.13, 0.157]);
  m.box([0.14, 0.06, 0.04], C.metalLight, [0, 0.98, 0.15]);
  m.cyl(0.05, 0.08, C.white, [0, 0.79, 0.07], 0.055, 10);
  m.ball(0.04, "#5e3d28", [0.15, 0.78, 0.17], [1, 0.4, 1]);
  return m;
};

/** `deep` tiles long: the shop's is two, the office's (one row on the map) is one. */
export const bed =
  (deep = 2) =>
  (): Model => {
    const m = new Model();
    const [w, d] = deep === 1 ? [0.85, 0.95] : [0.95, 1.85];
    m.box([w, 0.22, d], C.woodDark, [0, 0, 0], 0.03);
    m.box([w - 0.01, 0.75, 0.076], C.wood, [0, 0, -d / 2 + 0.042], 0.04);
    m.box([w - 0.06, 0.16, d - 0.14], C.white, [0, 0.2, 0.03], 0.05);
    m.box([0.62, 0.1, 0.32], C.pillow, [0, 0.35, -d / 2 + 0.3], 0.05);
    // A thick duvet, so a sleeper is tucked in under it.
    const [len, z, fold] = deep === 1 ? [0.5, 0.12, -0.05] : [1.15, 0.33, -0.24];
    m.box([w - 0.02, 0.13, len], C.fabric, [0, 0.35, z], 0.05);
    m.box([w - 0.02, 0.14, 0.16], tint(C.fabric, 0.25), [0, 0.35, fold], 0.05);
    return m;
  };

/** `tiles` wide, a seat cushion to each: the shop's is two, the map's own sofa is one run of tiles. */
export const sofa =
  (color: string = C.fabric, tiles = 2) =>
  (): Model => {
    const m = new Model();
    const w = 0.9 * tiles;
    const inner = w - 0.36;
    m.box([w, 0.24, 0.8], tint(color, -0.18), [0, 0.05, 0], 0.05);
    for (let i = 0; i < tiles; i++)
      m.box(
        [inner / tiles - 0.02, 0.12, 0.62],
        color,
        [-inner / 2 + (i + 0.5) * (inner / tiles), 0.28, 0.07],
        0.05,
      );
    m.box([w - 0.2, 0.42, 0.2], color, [0, 0.29, -0.3], 0.07);
    for (const x of [-w / 2 + 0.09, w / 2 - 0.09])
      m.box([0.17, 0.46, 0.78], tint(color, -0.08), [x + (x < 0 ? 0.005 : -0.005), 0.05, 0], 0.07);
    for (const x of [-w / 2 + 0.07, w / 2 - 0.07])
      for (const z of [-0.33, 0.33]) m.cyl(0.03, 0.05, C.woodDark, [x, 0, z], 0.03, 8);
    return m;
  };

const tv = (): Model => {
  const m = new Model();
  m.box([1.7, 0.42, 0.45], C.woodDark, [0, 0, -0.1], 0.03);
  for (const x of [-0.42, 0.42]) m.box([0.78, 0.32, 0.01], C.wood, [x, 0.05, 0.13]);
  m.box([0.3, 0.03, 0.18], "#2b2433", [0, 0.42, -0.12]);
  m.box([0.06, 0.12, 0.04], "#2b2433", [0, 0.45, -0.14]);
  m.box([1.4, 0.78, 0.05], "#1b1f2a", [0, 0.55, -0.14], 0.02);
  const screen = canvasTexture(56, 30, (g) => {
    const sky = g.createLinearGradient(0, 0, 0, 30);
    sky.addColorStop(0, "#4f8fe0");
    sky.addColorStop(1, "#a8dcf7");
    g.fillStyle = sky;
    g.fillRect(0, 0, 56, 30);
    g.fillStyle = "#86c35e";
    g.fillRect(0, 22, 56, 8);
    g.fillStyle = "#ffe28a";
    g.fillRect(40, 4, 6, 6);
    g.fillStyle = C.white;
    g.fillRect(8, 6, 10, 3);
    g.fillRect(22, 10, 8, 2);
    g.fillStyle = "#e25d5d";
    g.fillRect(14, 16, 4, 6);
    g.fillStyle = "#f6d3b3";
    g.fillRect(14, 13, 4, 3);
  });
  m.plane(1.32, 0.7, glow("#fff", screen), [0, 0.94, -0.114]);
  return m;
};

const beanbag = (): Model => {
  const m = new Model();
  m.ball(0.36, "#e25d5d", [0, 0.22, 0], [1, 0.62, 1], 18);
  m.ball(0.3, "#e25d5d", [0, 0.36, -0.14], [1, 0.75, 0.6], 16);
  m.ball(0.2, tint("#e25d5d", 0.15), [0, 0.32, 0.05], [1, 0.4, 1], 12);
  return m;
};

const bonsai = (): Model => {
  const m = new Model();
  m.box([0.42, 0.12, 0.28], "#3c4454", [0, 0, 0], 0.02);
  m.box([0.38, 0.01, 0.24], "#5e3d28", [0, 0.12, 0], 0.004);
  const trunk = m.cyl(0.035, 0.3, C.trunkDark, [0, 0.12, 0], 0.02, 8);
  trunk.rotation.z = 0.35;
  m.ball(0.14, C.leaf, [-0.12, 0.4, 0], [1.4, 0.55, 1]);
  m.ball(0.11, C.leafLight, [0.08, 0.48, 0.02], [1.4, 0.55, 1]);
  m.ball(0.1, C.leafDark, [-0.03, 0.34, 0.06], [1.4, 0.5, 1]);
  return m;
};

const waterCooler = (): Model => {
  const m = new Model();
  m.box([0.36, 0.85, 0.36], C.white, [0, 0, 0], 0.04);
  m.box([0.2, 0.2, 0.02], "#2b2433", [0, 0.52, 0.18], 0.01);
  m.box([0.04, 0.05, 0.05], "#4f8fe0", [-0.05, 0.62, 0.2]);
  m.box([0.04, 0.05, 0.05], "#e25d5d", [0.05, 0.62, 0.2]);
  m.cyl(0.15, 0.36, glass("#58a9e2", 0.6), [0, 0.86, 0], 0.15, 16);
  m.cyl(0.05, 0.06, glass("#58a9e2", 0.6), [0, 1.22, 0], 0.05, 10);
  m.cyl(0.03, 0.08, C.white, [0.14, 0.4, 0.16], 0.035, 8);
  return m;
};

const fridge = (): Model => {
  const m = new Model();
  const mint = "#8fd1c4";
  m.box([0.55, 0.85, 0.5], mint, [0, 0.05, 0], 0.09);
  m.box([0.5, 0.02, 0.02], tint(mint, -0.2), [0, 0.6, 0.25]);
  m.box([0.04, 0.22, 0.04], C.metalLight, [0.19, 0.3, 0.27], 0.015);
  m.box([0.2, 0.06, 0.02], C.metalLight, [-0.08, 0.7, 0.25], 0.01);
  for (const x of [-0.2, 0.2]) for (const z of [-0.17, 0.17]) m.cyl(0.025, 0.05, C.metal, [x, 0, z], 0.02, 8);
  return m;
};

const coffeeTable = (): Model => {
  const m = new Model();
  const walnut = "#6b4226";
  m.box([1.2, 0.06, 0.6], walnut, [0, 0.3, 0], 0.025);
  m.box([1.05, 0.03, 0.48], tint(walnut, -0.12), [0, 0.1, 0], 0.01);
  legs(m, 1.12, 0.52, 0.3, tint(walnut, -0.2), 0.04, 0.025);
  m.box([0.24, 0.03, 0.18], "#4f8fe0", [-0.3, 0.36, 0]);
  m.box([0.22, 0.03, 0.17], "#f0b53c", [-0.3, 0.39, 0.01]);
  m.cyl(0.045, 0.08, C.white, [0.28, 0.36, 0.05], 0.05, 10);
  return m;
};

const monstera = (): Model => {
  const m = new Model();
  const h = pot(m, 0.2, 0.36, "#e8e2d4");
  const rnd = seeded(9);
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2 + rnd() * 0.4;
    const len = 0.5 + rnd() * 0.3;
    const stem = m.cyl(0.012, len, C.leafDark, [0, h - 0.02, 0], 0.01, 5);
    stem.rotation.set(Math.sin(a) * 0.45, 0, -Math.cos(a) * 0.45);
    const tip = new THREE.Vector3(0, len, 0).applyEuler(stem.rotation);
    const leaf = m.ball(
      0.2,
      i % 2 ? C.leaf : C.leafDark,
      [tip.x * 1.05, h + tip.y, tip.z * 1.05],
      [1, 0.12, 0.75],
    );
    leaf.rotation.set(Math.sin(a) * 0.6, -a, -Math.cos(a) * 0.6);
  }
  return m;
};

const lavaLamp = (): Model => {
  const m = new Model();
  m.cyl(0.1, 0.16, "#9b6fd6", [0, 0, 0], 0.06, 12);
  m.cyl(0.06, 0.32, glass("#f28bb2", 0.55), [0, 0.16, 0], 0.045, 12);
  m.cyl(0.045, 0.08, "#9b6fd6", [0, 0.48, 0], 0.025, 12);
  const blobs = [0, 1, 2].map((i) => m.ball(0.032 - i * 0.006, glow("#ff7ab6"), [0, 0.22, 0]));
  ticks.push((t) => {
    blobs.forEach((b, i) => {
      b.position.y = 0.24 + (Math.sin(t * 0.7 + i * 2.1) * 0.5 + 0.5) * 0.18;
    });
  });
  light(m, [0, 0.35, 0.1], "#ff7ab6", 1.2, 2.5);
  return m;
};

const whiteboard = (): Model => {
  const m = new Model();
  for (const x of [-0.75, 0.75]) {
    m.box([0.04, 1.4, 0.04], C.metal, [x, 0, 0]);
    m.box([0.06, 0.03, 0.4], C.metal, [x, 0, 0]);
  }
  m.box([1.55, 0.9, 0.04], C.metalLight, [0, 0.55, 0], 0.01);
  const board = canvasTexture(60, 34, (g) => {
    g.fillStyle = "#fbf7ef";
    g.fillRect(0, 0, 60, 34);
    g.strokeStyle = "#4f8fe0";
    g.lineWidth = 1;
    g.strokeRect(4.5, 4.5, 14, 8);
    g.strokeRect(26.5, 4.5, 14, 8);
    g.strokeRect(15.5, 20.5, 14, 8);
    g.strokeStyle = "#e25d5d";
    g.beginPath();
    g.moveTo(19, 9);
    g.lineTo(26, 9);
    g.moveTo(33, 13);
    g.lineTo(25, 20);
    g.stroke();
    g.fillStyle = "#3ddc84";
    g.fillRect(44, 6, 12, 1);
    g.fillRect(44, 9, 9, 1);
    g.fillRect(44, 12, 11, 1);
    g.fillStyle = "#2b2433";
    g.fillRect(36, 24, 18, 1);
    g.fillRect(36, 27, 14, 1);
  });
  m.plane(1.48, 0.83, painted(board), [0, 1.0, 0.021]);
  m.box([0.5, 0.03, 0.06], C.metal, [0, 0.54, 0.04]);
  return m;
};

const arcLamp = (): Model => {
  const m = new Model();
  m.box([0.3, 0.06, 0.3], "#e8e2d4", [0, 0, -0.2], 0.03);
  const curve = new THREE.QuadraticBezierCurve3(
    new THREE.Vector3(0, 0.06, -0.2),
    new THREE.Vector3(0, 2.0, -0.25),
    new THREE.Vector3(0, 1.5, 0.55),
  );
  const arc = new THREE.Mesh(
    new THREE.TubeGeometry(curve, 16, 0.018, 6),
    new THREE.MeshToonMaterial({ color: C.metalLight }),
  );
  arc.castShadow = true;
  m.add(arc);
  m.ball(0.17, "#e8e2d4", [0, 1.44, 0.55], [1, 0.6, 1]);
  m.ball(0.06, glow(C.lamp), [0, 1.36, 0.55]);
  light(m, [0, 1.2, 0.55], "#ffcf7a", 2, 4);
  return m;
};

const loungeChair = (): Model => {
  const m = new Model();
  const leather = "#8c5c36";
  const shell = m.part([0, 0.22, 0]);
  shell.rotation.x = -0.2;
  shell.box([0.62, 0.1, 0.6], "#3a2418", [0, 0, 0.04], 0.04);
  shell.box([0.52, 0.09, 0.52], leather, [0, 0.08, 0.06], 0.04);
  shell.box([0.62, 0.55, 0.1], "#3a2418", [0, 0.05, -0.25], 0.04);
  shell.box([0.52, 0.5, 0.08], leather, [0, 0.1, -0.19], 0.04);
  for (const x of [-0.3, 0.3]) shell.box([0.06, 0.24, 0.5], "#3a2418", [x, 0.06, 0.04], 0.025);
  m.cyl(0.03, 0.22, C.metal, [0, 0, 0], 0.03, 8);
  for (let i = 0; i < 4; i++) {
    const leg = m.box([0.03, 0.02, 0.36], C.metal, [0, 0, 0]);
    leg.rotation.y = (i * Math.PI) / 2 + Math.PI / 4;
  }
  return m;
};

const recordPlayer = (): Model => {
  const m = new Model();
  m.box([0.6, 0.48, 0.42], C.wood, [0, 0, 0], 0.02);
  m.box([0.52, 0.32, 0.02], C.woodDark, [0, 0.06, 0.205]);
  for (let i = 0; i < 6; i++) m.box([0.03, 0.28, 0.24], BOOKS[i]!, [-0.2 + i * 0.04, 0.08, 0.04], 0.004);
  m.box([0.5, 0.08, 0.36], "#2b2433", [0, 0.48, 0], 0.02);
  const disc = m.cyl(0.15, 0.012, "#1b1f2a", [-0.06, 0.56, 0], 0.15, 20);
  m.cyl(0.05, 0.014, "#e25d5d", [-0.06, 0.56, 0], 0.05, 12);
  const arm = m.box([0.02, 0.02, 0.22], C.metalLight, [0.14, 0.58, 0]);
  arm.rotation.y = 0.35;
  ticks.push((t) => (disc.rotation.y = -t * 3.5));
  return m;
};

const vending = (): Model => {
  const m = new Model();
  m.box([0.8, 1.8, 0.65], "#4f8fe0", [0, 0, 0], 0.04);
  m.box([0.5, 1.3, 0.02], glass("#a8dcf7", 0.35), [-0.1, 0.38, 0.33]);
  m.box([0.52, 1.32, 0.01], "#e4f5fd", [-0.1, 0.37, 0.27]);
  const snacks = ["#f0b53c", "#4f8fe0", "#58b36a", "#9b6fd6", "#f28bb2", "#ff7ab6"];
  for (let row = 0; row < 5; row++) {
    m.box([0.5, 0.02, 0.4], C.metalLight, [-0.1, 0.42 + row * 0.25, 0.1]);
    for (let i = 0; i < 4; i++)
      m.box([0.09, 0.15, 0.08], snacks[(row + i) % 6]!, [-0.28 + i * 0.12, 0.44 + row * 0.25, 0.18], 0.015);
  }
  m.box([0.16, 0.5, 0.02], "#2b2433", [0.27, 0.95, 0.33], 0.01);
  for (let i = 0; i < 3; i++) m.box([0.1, 0.05, 0.02], C.metalLight, [0.27, 1.25 - i * 0.08, 0.34]);
  m.plane(0.1, 0.05, glow("#3ddc84"), [0.27, 1.38, 0.345]);
  m.box([0.5, 0.16, 0.02], "#2b2433", [-0.1, 0.12, 0.33], 0.01);
  m.box([0.81, 0.16, 0.66], tint("#e25d5d", 0.2), [0, 1.66, 0], 0.04);
  m.plane(0.6, 0.08, glow("#ffe28a"), [0, 1.74, 0.335]);
  light(m, [0, 1.0, 0.6], "#ffd2d2", 1.4, 3);
  return m;
};

const standingDesk = (): Model => {
  const m = new Model();
  for (const x of [-0.7, 0.7]) {
    m.box([0.08, 0.04, 0.6], "#2b2433", [x, 0, 0]);
    m.box([0.07, 0.95, 0.07], C.metalLight, [x, 0.04, 0]);
  }
  m.box([1.75, 0.05, 0.7], "#e8e2d4", [0, 1.0, 0], 0.015);
  monitor(m, [-0.3, 1.05, -0.17], 11, 0.48);
  monitor(m, [0.3, 1.05, -0.17], 12, 0.48);
  m.box([0.4, 0.02, 0.13], "#2b2433", [0, 1.05, 0.15], 0.008);
  m.ball(0.06, C.leaf, [0.72, 1.14, -0.15]);
  m.cyl(0.05, 0.08, "#c8734a", [0.72, 1.05, -0.15], 0.05);
  return m;
};

const serverRack = (): Model => {
  const m = new Model();
  m.box([0.72, 1.9, 0.75], "#262c38", [0, 0, 0], 0.03);
  const leds: THREE.MeshBasicMaterial[] = [];
  for (let i = 0; i < 9; i++) {
    m.box([0.62, 0.15, 0.02], "#3c4454", [0, 0.12 + i * 0.19, 0.37], 0.01);
    for (let j = 0; j < 4; j++) {
      const mat = glow(j === 0 ? "#3ddc84" : "#8fe3ff");
      leds.push(mat);
      m.plane(0.025, 0.025, mat, [-0.25 + j * 0.05, 0.2 + i * 0.19, 0.381]);
    }
    for (let k = 0; k < 6; k++)
      m.box([0.05, 0.08, 0.005], "#1b1f2a", [0.04 + k * 0.045, 0.155 + i * 0.19, 0.382], 0.002);
  }
  ticks.push((t) => {
    leds.forEach((mat, i) => {
      const on = Math.sin(t * (3 + (i % 5)) + i * 7.3) > 0.2;
      mat.color.set(on ? (i % 4 ? "#8fe3ff" : "#3ddc84") : "#1b3a2a");
    });
  });
  light(m, [0, 1.0, 0.6], "#8fe3ff", 1.2, 2.5);
  return m;
};

const arcade = (): Model => {
  const m = new Model();
  const body = "#5b3fbf";
  m.box([0.68, 0.85, 0.68], body, [0, 0, 0], 0.02);
  m.box([0.7, 0.18, 0.4], "#2b2433", [0, 0.85, 0.13], 0.02).rotation.x = 0.25;
  m.box([0.68, 0.95, 0.42], body, [0, 0.85, -0.13], 0.02);
  m.box([0.68, 0.22, 0.6], body, [0, 1.8, -0.04], 0.02);
  m.plane(0.6, 0.14, glow("#ff7ab6"), [0, 1.91, 0.261]);
  const screen = canvasTexture(24, 20, (g) => {
    g.fillStyle = "#1b1f2a";
    g.fillRect(0, 0, 24, 20);
    g.fillStyle = "#ffe28a";
    for (let x = 2; x < 22; x += 3) g.fillRect(x, 3, 1, 1);
    g.fillStyle = "#3ddc84";
    g.fillRect(4, 6, 3, 2);
    g.fillRect(10, 6, 3, 2);
    g.fillRect(16, 6, 3, 2);
    g.fillStyle = "#e86bd8";
    g.fillRect(11, 15, 3, 2);
    g.fillStyle = "#8fe3ff";
    g.fillRect(12, 11, 1, 2);
  });
  const s = m.plane(0.5, 0.42, glow("#fff", screen), [0, 1.3, 0.1]);
  s.rotation.x = -0.18;
  m.cyl(0.015, 0.08, "#2b2433", [-0.15, 0.95, 0.2], 0.015, 6);
  m.ball(0.03, "#e25d5d", [-0.15, 1.04, 0.2]);
  for (let i = 0; i < 3; i++)
    m.cyl(
      0.025,
      0.02,
      ["#f0b53c", "#4f8fe0", "#3ddc84"][i]!,
      [0.05 + i * 0.08, 0.97, 0.18 - i * 0.01],
      0.025,
      8,
    );
  light(m, [0, 1.3, 0.6], "#e86bd8", 1.6, 3);
  return m;
};

const aquarium = (): Model => {
  const m = new Model();
  m.box([1.6, 0.6, 0.55], "#2e2e3a", [0, 0, 0], 0.02);
  m.box([1.56, 0.62, 0.5], glass("#58a9e2", 0.35), [0, 0.6, 0]);
  m.box([1.5, 0.08, 0.44], "#e6cc98", [0, 0.6, 0]);
  m.box([1.6, 0.06, 0.55], "#2e2e3a", [0, 1.22, 0], 0.01);
  for (const [x, h] of [
    [-0.6, 0.4],
    [-0.45, 0.28],
    [0.5, 0.45],
    [0.62, 0.3],
  ] as const) {
    const weed = m.cyl(0.03, h, C.leafLight, [x, 0.66, -0.1], 0.005, 5);
    ticks.push((t) => (weed.rotation.z = Math.sin(t * 1.5 + x * 4) * 0.12));
  }
  m.ball(0.08, C.stone, [0.2, 0.7, -0.08], [1.4, 0.7, 1]);
  const fish = (["#f0b53c", "#e25d5d", "#8fe3ff"] as const).map((c, i) => {
    const f = m.part([0, 0.9 + i * 0.1, 0]);
    f.ball(0.06, c, [0, 0, 0], [1.4, 0.8, 0.45]);
    f.cyl(0.035, 0.06, c, [-0.1, -0.03, 0], 0.001, 6).rotation.z = Math.PI / 2;
    return f;
  });
  ticks.push((t) =>
    fish.forEach((f, i) => {
      const a = t * (0.45 + i * 0.12) + i * 2;
      f.position.x = Math.sin(a) * 0.55;
      f.position.z = Math.cos(a * 1.7) * 0.1;
      f.rotation.y = Math.cos(a) > 0 ? 0 : Math.PI;
    }),
  );
  light(m, [0, 1.0, 0.6], "#8fe3ff", 1.0, 2.5);
  return m;
};

const pingPong = (): Model => {
  const m = new Model();
  const top = canvasTexture(54, 30, (g) => {
    g.fillStyle = "#2f7a5a";
    g.fillRect(0, 0, 54, 30);
    g.fillStyle = C.white;
    g.fillRect(0, 0, 54, 1);
    g.fillRect(0, 29, 54, 1);
    g.fillRect(0, 0, 1, 30);
    g.fillRect(53, 0, 1, 30);
    g.fillRect(0, 15, 54, 1);
  });
  m.box([2.6, 0.05, 1.45], painted(top), [0, 0.72, 0], 0.01);
  legs(m, 2.4, 1.3, 0.72, "#2b2433", 0.08, 0.03);
  m.box([0.02, 0.15, 1.55], glass(C.white, 0.7), [0, 0.77, 0]);
  m.box([0.03, 0.03, 1.6], C.metal, [0, 0.91, 0]);
  m.ball(0.025, C.white, [0.5, 0.95, 0.2]);
  m.cyl(0.08, 0.01, "#e25d5d", [-0.8, 0.77, 0.4], 0.08, 12);
  return m;
};

const gong = (): Model => {
  const m = new Model();
  for (const x of [-0.6, 0.6]) {
    m.box([0.08, 1.5, 0.08], C.woodDark, [x, 0, 0]);
    m.box([0.2, 0.06, 0.4], C.woodDark, [x, 0, 0]);
  }
  m.box([1.4, 0.1, 0.1], C.woodDark, [0, 1.5, 0], 0.03);
  for (const x of [-0.25, 0.25]) m.cyl(0.006, 0.25, C.ink, [x, 1.25, 0], 0.006, 4);
  const disc = m.part([0, 0.95, 0]);
  const plate = disc.cyl(0.42, 0.04, "#e9b73d", [0, 0, 0], 0.42, 24);
  plate.rotation.x = Math.PI / 2;
  const boss = disc.cyl(0.12, 0.05, "#f5d14a", [0, 0, 0.02], 0.12, 16);
  boss.rotation.x = Math.PI / 2;
  ticks.push((t) => (disc.rotation.x = Math.sin(t * 2) * 0.05));
  const mallet = m.cyl(0.015, 0.4, C.wood, [0.75, 0.2, 0.25], 0.015, 6);
  mallet.rotation.z = -0.4;
  return m;
};

const duckStatue = (): Model => {
  const m = new Model();
  m.box([0.6, 0.35, 0.6], C.stoneLight, [0, 0, 0], 0.03);
  m.box([0.66, 0.06, 0.66], C.stone, [0, 0.35, 0], 0.02);
  m.ball(0.28, "#f5d14a", [0, 0.62, -0.02], [1.15, 0.85, 1]);
  m.ball(0.18, "#f5d14a", [0, 0.92, 0.12]);
  m.box([0.16, 0.05, 0.12], "#f08a2c", [0, 0.88, 0.32], 0.02);
  for (const x of [-0.08, 0.08]) m.ball(0.025, C.ink, [x, 0.97, 0.27]);
  m.ball(0.12, "#f5d14a", [0, 0.72, -0.28], [1, 0.6, 1.2]).rotation.x = -0.6;
  return m;
};

const trophyCase = (): Model => {
  const m = new Model();
  m.box([1.6, 0.4, 0.5], C.woodDark, [0, 0, 0], 0.02);
  m.box([1.6, 1.1, 0.5], glass("#e4f5fd", 0.25), [0, 0.4, 0]);
  m.box([1.6, 0.05, 0.5], C.woodDark, [0, 1.5, 0], 0.02);
  m.box([1.55, 0.02, 0.45], glass("#e4f5fd", 0.4), [0, 0.95, 0]);
  const cups = [
    [-0.5, 0.4, "#e9b73d"],
    [0, 0.4, "#cfccc7"],
    [0.5, 0.4, "#c8734a"],
    [-0.3, 0.97, "#e9b73d"],
    [0.35, 0.97, "#8fe3ff"],
  ] as const;
  for (const [x, y, c] of cups) {
    m.box([0.14, 0.04, 0.14], C.ink, [x, y, 0]);
    m.cyl(0.02, 0.1, c, [x, y + 0.04, 0], 0.02, 6);
    m.cyl(0.05, 0.12, c, [x, y + 0.14, 0], 0.09, 12);
    for (const s of [-1, 1]) m.ball(0.035, c, [x + s * 0.09, y + 0.21, 0], [0.6, 1, 0.4]);
  }
  return m;
};

const foosball = (): Model => {
  const m = new Model();
  m.box([1.5, 0.3, 0.8], C.woodDark, [0, 0.55, 0], 0.03);
  m.box([1.4, 0.01, 0.7], "#58b36a", [0, 0.85, 0]);
  legs(m, 1.4, 0.7, 0.55, C.woodDark, 0.06, 0.04);
  for (let i = 0; i < 4; i++) {
    const x = -0.52 + i * 0.35;
    const rod = m.cyl(0.012, 1.2, C.metalLight, [x, 0.92, 0], 0.012, 6);
    rod.rotation.x = Math.PI / 2;
    rod.position.z = -0.6;
    m.cyl(0.035, 0.08, C.ink, [x, 0.92, 0.6], 0.035, 8).rotation.x = Math.PI / 2;
    for (const z of [-0.2, 0.2])
      m.box([0.05, 0.14, 0.05], i % 2 ? "#e25d5d" : "#4f8fe0", [x, 0.84, z], 0.015);
  }
  return m;
};

const espressoBar = (): Model => {
  const m = new Model();
  m.box([1.7, 0.95, 0.6], "#2e2e3a", [0, 0, 0], 0.02);
  for (let i = 0; i < 6; i++)
    m.box([0.24, 0.85, 0.02], tint(C.wood, (i % 2) * 0.08), [-0.68 + i * 0.27, 0.04, 0.3]);
  m.box([1.76, 0.05, 0.66], "#cfccc7", [0, 0.95, 0], 0.015);
  m.box([0.6, 0.4, 0.4], C.metalLight, [-0.35, 1.0, -0.05], 0.05);
  m.box([0.5, 0.06, 0.3], "#c4544b", [-0.35, 1.4, -0.05], 0.02);
  for (const x of [-0.5, -0.2]) {
    m.box([0.05, 0.05, 0.12], C.ink, [x, 1.15, 0.18]);
    m.cyl(0.035, 0.05, C.white, [x, 1.0, 0.2], 0.04, 8);
  }
  m.cyl(0.08, 0.3, "#5d6470", [0.35, 1.0, -0.05], 0.06, 12);
  m.cyl(0.07, 0.12, glass("#5e3d28", 0.75), [0.35, 1.3, -0.05], 0.08, 12);
  for (let i = 0; i < 3; i++)
    m.cyl(
      0.045,
      0.08,
      ["#e25d5d", "#4f8fe0", "#fbf7ef"][i]!,
      [0.6 + (i % 2) * 0.06, 1.0, 0.15 - i * 0.1],
      0.05,
      10,
    );
  return m;
};

const neonSign = (): Model => {
  const m = new Model();
  // The town's bolt, big enough to read at any pixel size.
  const bolt = canvasTexture(40, 16, (g) => {
    g.fillStyle = "#1b1f2a";
    g.fillRect(0, 0, 40, 16);
    g.fillStyle = "#ffe28a";
    g.beginPath();
    for (const [x, y] of [
      [22, 1],
      [14, 9],
      [19, 9],
      [16, 15],
      [26, 6],
      [21, 6],
      [24, 1],
    ] as const)
      g.lineTo(x, y);
    g.fill();
    g.fillStyle = "#e86bd8";
    g.fillRect(2, 2, 36, 1);
    g.fillRect(2, 13, 36, 1);
    g.fillRect(2, 2, 1, 12);
    g.fillRect(37, 2, 1, 12);
  });
  m.box([1.3, 0.52, 0.04], "#1b1f2a", [0, 0, 0], 0.02);
  m.plane(1.25, 0.5, glow("#fff", bolt), [0, 0.26, 0.021]);
  light(m, [0, 0.25, 0.4], "#e86bd8", 1.4, 3);
  return m;
};

export const ASSETS: readonly Asset[] = [
  { id: "rug", name: "Rug", price: 15, w: 3, d: 2, build: rug },
  { id: "plant", name: "Plant", price: 30, w: 1, d: 1, build: plant },
  { id: "lamp", name: "Lamp", price: 40, w: 1, d: 1, build: lamp },
  { id: "chair", name: "Chair", price: 45, w: 1, d: 1, build: chair, seat: { at: [0, 0.35, 0.02], turn: 0 } },
  { id: "shelf", name: "Shelf", price: 60, w: 1, d: 1, build: shelf },
  { id: "bench", name: "Bench", price: 60, w: 1, d: 1, build: bench, seat: { at: [0, 0.33, 0], turn: 0 } },
  { id: "desk", name: "Desk", price: 75, w: 2, d: 1, build: desk(1) },
  { id: "coffee", name: "Coffee machine", price: 90, w: 1, d: 1, build: coffee },
  { id: "bed", name: "Bed", price: 120, w: 1, d: 2, build: bed(), bed: [0, 0.3, -0.15] },
  {
    id: "sofa",
    name: "Sofa",
    price: 100,
    w: 2,
    d: 1,
    build: sofa(),
    seat: { at: [-0.4, 0.38, 0.05], turn: 0 },
  },
  { id: "tv", name: "TV", price: 180, w: 2, d: 1, build: tv },
  {
    id: "beanbag",
    name: "Beanbag",
    price: 35,
    w: 1,
    d: 1,
    build: beanbag,
    seat: { at: [0, 0.32, 0.05], turn: 0 },
  },
  { id: "bonsai", name: "Bonsai", price: 45, w: 1, d: 1, build: bonsai },
  { id: "water-cooler", name: "Water cooler", price: 55, w: 1, d: 1, build: waterCooler },
  { id: "mini-fridge", name: "Retro mini fridge", price: 70, w: 1, d: 1, build: fridge },
  { id: "coffee-table", name: "Walnut coffee table", price: 80, w: 2, d: 1, build: coffeeTable },
  { id: "monstera", name: "Big monstera", price: 90, w: 1, d: 1, build: monstera },
  { id: "lava-lamp", name: "Lava lamp", price: 100, w: 1, d: 1, build: lavaLamp },
  { id: "whiteboard", name: "Whiteboard", price: 110, w: 2, d: 1, build: whiteboard },
  { id: "arc-lamp", name: "Arc floor lamp", price: 120, w: 1, d: 1, build: arcLamp },
  { id: "bookshelf", name: "Library bookshelf", price: 140, w: 1, d: 1, build: shelf },
  {
    id: "lounge-chair",
    name: "Danish lounge chair",
    price: 180,
    w: 1,
    d: 1,
    build: loungeChair,
    seat: { at: [0, 0.4, 0.04], turn: 0 },
  },
  { id: "record-player", name: "Vinyl record player", price: 200, w: 1, d: 1, build: recordPlayer },
  { id: "neon-sign", name: "Neon sign", price: 220, w: 2, d: 1, build: neonSign },
  {
    id: "sofa-chesterfield",
    name: "Chesterfield sofa",
    price: 240,
    w: 3,
    d: 1,
    build: sofa("#3f8c50", 3),
    seat: { at: [0.78, 0.38, 0.05], turn: 0 },
  },
  { id: "vending-machine", name: "Vending machine", price: 240, w: 1, d: 1, build: vending },
  { id: "standing-desk", name: "Standing desk, two screens", price: 260, w: 2, d: 1, build: standingDesk },
  { id: "foosball", name: "Foosball table", price: 350, w: 2, d: 1, build: foosball },
  { id: "espresso-bar", name: "Espresso bar", price: 400, w: 2, d: 1, build: espressoBar },
  { id: "server-rack", name: "Server rack", price: 420, w: 1, d: 1, build: serverRack },
  { id: "arcade-cabinet", name: "Arcade cabinet", price: 450, w: 1, d: 1, build: arcade },
  { id: "trophy-case", name: "Trophy case", price: 500, w: 2, d: 1, build: trophyCase },
  { id: "aquarium", name: "Aquarium", price: 550, w: 2, d: 1, build: aquarium },
  { id: "ping-pong", name: "Ping-pong table", price: 600, w: 3, d: 2, build: pingPong },
  { id: "gong", name: "Ship-it gong", price: 750, w: 2, d: 1, build: gong },
  { id: "rubber-duck-statue", name: "Rubber-duck statue", price: 1000, w: 1, d: 1, build: duckStatue },
];

export const assetById = new Map(ASSETS.map((a) => [a.id, a]));
