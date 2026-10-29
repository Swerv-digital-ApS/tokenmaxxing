/**
 * Things worn on the head and face in 3D: every hat of the shop, the head pack, the wardrobe's loot and the
 * merchant's editions (`core/src/headwear.ts`, `loot.ts`, `editions.ts`; 2D art in `web/src/art/headwear.ts`,
 * `loot.ts`, `editions.ts`), and the same for glasses, visors, masks and beards.
 *
 * Builders are keyed by the item's catalogue name. They draw into the head frame (origin at the skull's
 * centre, +z the face, +y up, the skull about .25 across) and may register animations on the `Ctx`.
 */
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { glow, type Model, type Paint, tint, toon } from "../kit/kit.ts";
import {
  boxBand,
  boxRing,
  isVox,
  pixelPatch,
  place,
  squarePane,
  stepDome,
  tilt,
  voxShape,
} from "./voxgear.ts";

export interface Ctx {
  skin: string;
  /** The wearer's hair colour: beards and moustaches match it. */
  hair: string;
  outfit: [string, string];
  pants: string;
  /** Registers something that moves; called every frame with the clock in seconds. */
  tick(fn: (t: number) => void): void;
}
export type Build = (m: Model, c: Ctx) => void;

// MARK: Helpers

const geo = new Map<string, THREE.BufferGeometry>();
function cached(key: string, make: () => THREE.BufferGeometry): THREE.BufferGeometry {
  let g = geo.get(key);
  if (!g) {
    g = make();
    geo.set(key, g);
  }
  return g;
}
const mat = (p: Paint): THREE.Material => (typeof p === "string" ? toon(p) : p);

/** A see-through lit material (lenses, ribbons, glows). It's hidden from the outline pass. */
export function see(color: string, opacity = 0.5, lit = false): THREE.Material {
  return lit
    ? new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false })
    : new THREE.MeshToonMaterial({ color, transparent: true, opacity, depthWrite: false });
}
/** An emissive material that ignores lights. */
export const lit = (color: string): THREE.Material => glow(color);

export function mesh(
  m: THREE.Object3D,
  g: THREE.BufferGeometry,
  p: Paint,
  at: [number, number, number] = [0, 0, 0],
): THREE.Mesh {
  const o = new THREE.Mesh(g, mat(p));
  o.position.set(...at);
  o.castShadow = true;
  m.add(o);
  return o;
}

/** A cap of a ball: the top `cut` (0..1) of its height, open underneath. */
export function dome(m: THREE.Object3D, p: Paint, r: number, y = 0, cut = 0.5, seg = 18): THREE.Mesh {
  if (isVox(m)) return stepDome(m, p, r, y, cut);
  const o = mesh(
    m,
    cached(
      `dome${r},${cut},${seg}`,
      () => new THREE.SphereGeometry(r, seg, 12, 0, Math.PI * 2, 0, Math.PI * cut),
    ),
    p,
    [0, y, 0],
  );
  (o.material as THREE.Material).side = THREE.DoubleSide;
  return o;
}
/** A slice of a dome, `from`..`to` radians round (for panels). */
function wedge(
  m: THREE.Object3D,
  p: Paint,
  r: number,
  y: number,
  cut: number,
  from: number,
  to: number,
): THREE.Mesh {
  if (isVox(m)) return stepDome(m, p, r, y, cut, from, to);
  const o = mesh(
    m,
    cached(
      `wedge${r},${cut},${from},${to}`,
      () => new THREE.SphereGeometry(r, 16, 12, from, to - from, 0, Math.PI * cut),
    ),
    p,
    [0, y, 0],
  );
  (o.material as THREE.Material).side = THREE.DoubleSide;
  return o;
}
/** A ring (a torus), flat by default (a halo, a brim); `tilt` stands it up. */
export function ring(
  m: THREE.Object3D,
  p: Paint,
  R: number,
  tube: number,
  at: [number, number, number] = [0, 0, 0],
  flat = true,
): THREE.Mesh {
  if (isVox(m)) return boxRing(m, p, R, tube, at, flat);
  const o = mesh(
    m,
    cached(`ring${R},${tube}`, () => new THREE.TorusGeometry(R, tube, 8, 28)),
    p,
    at,
  );
  if (flat) o.rotation.x = Math.PI / 2;
  return o;
}
const shapeGeo = (key: string, shape: THREE.Shape, depth: number) =>
  cached(key, () =>
    new THREE.ExtrudeGeometry(shape, {
      depth,
      bevelEnabled: true,
      bevelSize: depth * 0.25,
      bevelThickness: depth * 0.25,
      bevelSegments: 1,
    }).center(),
  );

export function heart(s: number): THREE.Shape {
  const h = new THREE.Shape();
  h.moveTo(0, -0.5 * s);
  h.bezierCurveTo(-0.7 * s, 0, -0.5 * s, 0.6 * s, 0, 0.25 * s);
  h.bezierCurveTo(0.5 * s, 0.6 * s, 0.7 * s, 0, 0, -0.5 * s);
  return h;
}
export function star(r: number, n = 5, inner = 0.45): THREE.Shape {
  const s = new THREE.Shape();
  for (let i = 0; i < n * 2; i++) {
    const a = (i / (n * 2)) * Math.PI * 2 + Math.PI / 2;
    const rr = i % 2 ? r * inner : r;
    if (i) s.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
    else s.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  s.closePath();
  return s;
}
export const shaped = (
  m: THREE.Object3D,
  key: string,
  shape: THREE.Shape,
  depth: number,
  p: Paint,
  at: [number, number, number],
) => (isVox(m) ? voxShape(m, key, shape, depth, p, at) : mesh(m, shapeGeo(key, shape, depth), p, at));

/** A little canvas drawing on a flat plane, facing +z. */
export function sign(
  m: THREE.Object3D,
  w: number,
  h: number,
  draw: (g: CanvasRenderingContext2D, cw: number, ch: number) => void,
  at: [number, number, number],
  px = 64,
  lightIt = false,
): THREE.Mesh {
  if (isVox(m)) {
    const cell = 0.0125;
    return pixelPatch(m, {
      cols: Math.max(2, Math.round(w / cell)),
      rows: Math.max(2, Math.round(h / cell)),
      cell,
      depth: cell * 0.8,
      draw,
      at,
      lit: lightIt,
      fill: 0.3,
    });
  }
  const cw = Math.round(w * px);
  const ch = Math.round(h * px);
  const c = document.createElement("canvas");
  c.width = cw;
  c.height = ch;
  draw(c.getContext("2d")!, cw, ch);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.magFilter = t.minFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  const material = lightIt
    ? new THREE.MeshBasicMaterial({ map: t, transparent: true, alphaTest: 0.4 })
    : new THREE.MeshToonMaterial({
        map: t,
        transparent: true,
        alphaTest: 0.4,
        gradientMap: toon("#fff").gradientMap,
      });
  const o = new THREE.Mesh(new THREE.PlaneGeometry(w, h), material);
  o.position.set(...at);
  m.add(o);
  return o;
}

/** The point on the skull's front where an eye is, with the plane there tipped to follow the curve. */
export const EYE_X = 0.092;
export const EYE_Y = -0.062;
export const EYE_Z = 0.222;
export function eyeAt(m: Model, side: -1 | 1): Model {
  const e = m.part([side * EYE_X, EYE_Y, EYE_Z]);
  if (!isVox(m)) e.rotation.y = side * 0.36;
  return e;
}
/** The middle of the face, between the eyes. */
const mid = (m: Model, y = EYE_Y, z = 0.236) => m.part([0, y, z]);

/** An open band (no top or bottom), so a crown is a ring you can see the hair through. */
export function band(m: THREE.Object3D, p: Paint, r: number, h: number, y: number, top = r): THREE.Mesh {
  if (isVox(m)) return boxBand(m, p, Math.max(r, top), h, y);
  const o = mesh(
    m,
    cached(`band${r},${h},${top}`, () =>
      new THREE.CylinderGeometry(top, r, h, 20, 1, true).translate(0, h / 2, 0),
    ),
    p,
    [0, y, 0],
  );
  (o.material as THREE.Material).side = THREE.DoubleSide;
  return o;
}

/** A point at angle `a` round a head: on a circle for smooth models, on the square band for blocky ones. */
function roundAt(m: THREE.Object3D, a: number, r: number): [number, number] {
  const x = Math.sin(a);
  const z = Math.cos(a);
  if (!isVox(m)) return [x * r, z * r];
  const k = (r * 0.92) / Math.max(Math.abs(x), Math.abs(z));
  return [x * k, z * k];
}

/** Blocks on a path, as [centre x, centre y, size] (a bent tip, a horn, a curl). */
function path(m: Model, p: Paint, pts: [number, number, number][], z = 0, deep = 1): void {
  for (const [x, y, sz] of pts) m.box([sz, sz, sz * deep], p, [x, y - sz / 2, z]);
}

/** A cone-shaped hat part: base radius `r`, height `h`, resting at `y`. */
const cone = (
  m: Model,
  p: Paint,
  r: number,
  h: number,
  y: number,
  at: [number, number] = [0, 0],
  seg = 14,
  top = 0.004,
) => m.cyl(r, h, p, [at[0], y, at[1]], top, seg);

/** A flat brim ring of radius `r`. */
const brim = (m: Model, p: Paint, r: number, y: number, t = 0.03) => m.cyl(r, t, p, [0, y, 0], r, 24);

/** A hat sitting on a stalk of starry cone with the tip bent over (wizard hats). */
function wizard(m: Model, c: { cone: string; dark: string; star: string; band: string }): void {
  brim(m, c.dark, 0.36, 0.12, 0.03);
  cone(m, c.cone, 0.21, 0.3, 0.14, [0, 0], 16, 0.1);
  m.cyl(0.215, 0.046, c.band, [0, 0.153, 0], 0.21, 16);
  if (isVox(m))
    path(
      m,
      c.cone,
      [
        [0.04, 0.5, 0.17],
        [0.09, 0.56, 0.13],
        [0.15, 0.6, 0.1],
        [0.21, 0.6, 0.075],
        [0.25, 0.55, 0.05],
      ],
      0,
      1,
    );
  else {
    const tip = m.part([0, 0.43, 0]);
    tip.cyl(0.1, 0.24, c.cone, [0, 0, 0], 0.012, 12).rotation.z = 0;
    tip.rotation.z = -0.55;
    tip.rotation.x = 0.1;
  }
  const stars: [number, number, number][] = [
    [0.12, 0.26, 0.13],
    [-0.1, 0.34, 0.08],
    [0.02, 0.2, 0.19],
    [-0.14, 0.2, 0.1],
  ];
  for (const [x, y, z] of stars) {
    const s = m.ball(0.022, c.star, [x, y, z], [1, 1, 0.5], 5);
    s.rotation.z = 0.8;
  }
  if (isVox(m)) m.ball(0.024, c.star, [0.25, 0.53, 0.0], [1, 1, 1], 5);
  else m.ball(0.024, c.star, [0.0, 0.5, 0.01], [1, 1, 1], 5);
}

/** A toque: pleated puffs on a band. */
function toque(m: Model, extra?: (m: Model) => void): void {
  m.cyl(0.19, 0.1, "#fbf7ef", [0, 0.11, 0], 0.2, 18);
  m.cyl(0.204, 0.025, "#d9d3c6", [0, 0.123, 0], 0.204, 18);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    m.ball(0.1, "#fbf7ef", [Math.sin(a) * 0.11, 0.26, Math.cos(a) * 0.11], [1, 1.05, 1]);
  }
  m.ball(0.13, "#fbf7ef", [0, 0.31, 0]);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + 0.3;
    tilt(
      m,
      m.box([0.02, 0.09, 0.02], "#d9d3c6", [Math.sin(a) * 0.195, 0.12, Math.cos(a) * 0.195], 0.004),
      0,
      a,
      0,
    );
  }
  extra?.(m);
}

/** A cowboy hat: a wide curled brim and a creased crown. */
function stetson(m: Model, p: { main: string; dark: string; band: string; dent?: boolean }): void {
  const b = brim(m, p.main, 0.36, 0.13, 0.025);
  b.scale.set(1.05, 1, 0.95);
  for (const s of [-1, 1]) {
    if (isVox(m)) {
      m.box([0.1, 0.04, 0.34], p.main, [s * 0.36, 0.15, 0]);
      m.box([0.07, 0.04, 0.3], p.main, [s * 0.43, 0.18, 0]);
    } else m.box([0.14, 0.03, 0.32], p.main, [s * 0.34, 0.145, 0], 0.01).rotation.z = -s * 0.5;
  }
  m.cyl(0.19, 0.17, p.main, [0, 0.14, 0], 0.15, 18);
  m.cyl(0.192, 0.04, p.band, [0, 0.15, 0], 0.192, 18);
  if (p.dent) m.box([0.16, 0.05, 0.1], p.dark, [0, 0.3, 0], 0.025);
  else m.box([0.04, 0.1, 0.26], p.dark, [0, 0.26, 0], 0.02);
}

/** A helmet with horns (viking, force-push). */
function horned(
  m: Model,
  p: { steel: string; rim: string; horn: string; tip: string; guard: boolean },
): void {
  dome(m, p.steel, 0.265, 0.02, 0.5);
  m.cyl(0.265, 0.04, p.rim, [0, 0.03, 0], 0.265, 20);
  if (p.guard) m.box([0.04, 0.14, 0.03], p.rim, [0, -0.12, 0.25], 0.012);
  if (isVox(m)) {
    for (const s of [-1, 1]) {
      path(m, p.horn, [
        [s * 0.28, 0.12, 0.11],
        [s * 0.34, 0.15, 0.1],
        [s * 0.37, 0.22, 0.09],
        [s * 0.37, 0.3, 0.075],
        [s * 0.34, 0.37, 0.06],
        [s * 0.31, 0.42, 0.045],
      ]);
      m.box([0.03, 0.03, 0.03], p.tip, [s * 0.31, 0.42, -0.015]);
    }
    return;
  }
  for (const s of [-1, 1]) {
    const h = m.part([s * 0.25, 0.1, 0]);
    h.rotation.z = -s * 0.5;
    h.cyl(0.055, 0.11, p.horn, [0, 0, 0], 0.045, 8);
    const up = h.part([0, 0.11, 0]);
    up.rotation.z = s * 0.7;
    up.cyl(0.045, 0.14, p.horn, [0, 0, 0], 0.012, 8);
    void p.tip;
  }
}

/** A tricorn: a dark crown and three folded-up brims. */
function tricorn(m: Model, p: { main: string; trim: string; emblem: "skull" | "coin" }): void {
  dome(m, p.main, 0.255, 0.04, 0.45);
  if (isVox(m)) {
    // Three brims folded up: a front slab and one over each ear, each with a lip and a gold edge.
    m.box([0.46, 0.04, 0.16], p.main, [0, 0.1, 0.27]);
    m.box([0.46, 0.05, 0.04], p.main, [0, 0.14, 0.34]);
    m.box([0.46, 0.015, 0.02], p.trim, [0, 0.19, 0.34]);
    for (const s of [-1, 1]) {
      m.box([0.16, 0.04, 0.4], p.main, [s * 0.29, 0.1, 0]);
      m.box([0.04, 0.05, 0.4], p.main, [s * 0.36, 0.14, 0]);
      m.box([0.02, 0.015, 0.4], p.trim, [s * 0.36, 0.19, 0]);
    }
    m.box([0.4, 0.05, 0.12], p.main, [0, 0.1, -0.26]);
    m.box([0.4, 0.05, 0.04], p.main, [0, 0.14, -0.31]);
    if (p.emblem === "skull") {
      m.box([0.08, 0.07, 0.02], "#fbf7ef", [0, 0.12, 0.355]);
      m.box([0.02, 0.02, 0.01], "#1c1a24", [-0.02, 0.145, 0.366]);
      m.box([0.02, 0.02, 0.01], "#1c1a24", [0.02, 0.145, 0.366]);
      m.box([0.1, 0.015, 0.02], "#fbf7ef", [0, 0.1, 0.355]);
    } else m.box([0.07, 0.07, 0.02], "#f5c842", [0, 0.12, 0.355]);
    return;
  }
  const wing = (rot: number, w: number) => {
    const part = m.part([0, 0.1, 0], rot);
    const b = part.box([w, 0.03, 0.17], p.main, [0, 0, 0.22], 0.012);
    b.rotation.x = -0.45;
    part.box([w + 0.02, 0.012, 0.02], p.trim, [0, 0.07, 0.3], 0.004).rotation.x = -0.45;
  };
  wing(0, 0.36);
  wing(Math.PI * 0.66, 0.34);
  wing(-Math.PI * 0.66, 0.34);
  if (p.emblem === "skull") {
    m.ball(0.032, "#fbf7ef", [0, 0.16, 0.32], [1, 1, 0.5], 8);
    m.box([0.03, 0.014, 0.012], "#fbf7ef", [0, 0.118, 0.325], 0.004);
    m.box([0.07, 0.01, 0.012], "#fbf7ef", [0, 0.105, 0.322], 0.003).rotation.z = 0.5;
  } else {
    m.cyl(0.035, 0.01, "#f5c842", [0, 0.14, 0.325], 0.035, 12).rotation.x = Math.PI / 2;
  }
}

/** A headband with two springy stalks that end in glowing bobbles. */
function antennae(m: Model, p: { band: string; bobble: string; stalk: string }, c: Ctx): void {
  if (isVox(m)) band(m, p.band, 0.255, 0.045, 0.1);
  else ring(m, p.band, 0.255, 0.014, [0, 0.06, 0], false).rotation.x = Math.PI / 2.6;
  const bobbles: THREE.Mesh[] = [];
  for (const s of [-1, 1]) {
    const stalk = m.part([s * 0.12, 0.2, -0.03]);
    if (isVox(m)) {
      stalk.box([0.03, 0.12, 0.03], p.stalk, [0, -0.08, 0]);
      stalk.box([0.03, 0.12, 0.03], p.stalk, [s * 0.03, 0.04, 0]);
      stalk.box([0.03, 0.1, 0.03], p.stalk, [s * 0.06, 0.16, 0]);
      bobbles.push(stalk.ball(0.04, lit(p.bobble), [s * 0.06, 0.3, 0], [1, 1, 1], 10));
    } else {
      stalk.rotation.z = -s * 0.28;
      stalk.cyl(0.01, 0.22, p.stalk, [0, 0, 0], 0.008, 6);
      bobbles.push(stalk.ball(0.04, lit(p.bobble), [0, 0.24, 0], [1, 1, 1], 10));
    }
  }
  c.tick((t) =>
    bobbles.forEach((b, i) => {
      b.scale.setScalar(1 + Math.max(0, Math.sin(t * 5 + i * Math.PI)) * 0.3);
    }),
  );
}

/** Cat ears on a headband. */
function ears(m: Model, p: { out: string; inner: string; band: string }): void {
  if (isVox(m)) band(m, p.band, 0.25, 0.045, 0.1);
  else ring(m, p.band, 0.25, 0.014, [0, 0.07, 0], false).rotation.x = Math.PI / 2.4;
  if (isVox(m)) {
    for (const s of [-1, 1]) {
      const e = m.part([s * 0.14, 0.14, 0]);
      e.box([0.14, 0.06, 0.07], p.out, [0, 0, 0]);
      e.box([0.11, 0.06, 0.07], p.out, [0, 0.06, 0]);
      e.box([0.07, 0.06, 0.07], p.out, [0, 0.12, 0]);
      e.box([0.035, 0.05, 0.07], p.out, [0, 0.18, 0]);
      e.box([0.07, 0.07, 0.02], p.inner, [0, 0.01, 0.045]);
      e.box([0.04, 0.06, 0.02], p.inner, [0, 0.08, 0.045]);
    }
    return;
  }
  for (const s of [-1, 1]) {
    const e = m.part([s * 0.14, 0.2, 0.0]);
    e.rotation.z = -s * 0.28;
    e.cyl(0.085, 0.16, p.out, [0, 0, 0], 0.005, 4).rotation.y = Math.PI / 4;
    e.cyl(0.05, 0.1, p.inner, [0, 0, 0.04], 0.004, 4).rotation.y = Math.PI / 4;
  }
}

/** A propeller beanie: coloured panels, a brim, a spinning rotor. */
function whirly(
  m: Model,
  c: Ctx,
  p: { a: string; b: string; brim: string; blade: string; hub: string },
): void {
  wedge(m, p.a, 0.265, 0.03, 0.5, 0, Math.PI / 2);
  wedge(m, p.b, 0.265, 0.03, 0.5, Math.PI / 2, Math.PI);
  wedge(m, p.a, 0.265, 0.03, 0.5, Math.PI, Math.PI * 1.5);
  wedge(m, p.b, 0.265, 0.03, 0.5, Math.PI * 1.5, Math.PI * 2);
  m.cyl(0.27, 0.045, p.brim, [0, 0.03, 0], 0.27, 20);
  m.cyl(0.012, 0.06, p.hub, [0, 0.28, 0], 0.012, 6);
  const rotor = m.part([0, 0.34, 0]);
  rotor.box([0.34, 0.012, 0.06], p.blade, [0, 0, 0], 0.005);
  rotor.box([0.06, 0.012, 0.34], p.blade, [0, 0, 0], 0.005).rotation.y = 0;
  rotor.ball(0.025, p.hub);
  c.tick((t) => (rotor.rotation.y = t * 14));
}

/** A party hat: a striped cone with a pompom. */
function party(m: Model, p: { a: string; b: string; pom: string }): void {
  const h = m.part([0, 0.1, 0]);
  if (!isVox(m)) h.rotation.z = -0.12;
  const R = 0.2;
  const H = 0.46;
  h.cyl(R, H, p.a, [0, 0, 0], 0.008, 16);
  for (let i = 0; i < 3; i++) {
    const y = 0.1 + i * 0.11;
    h.cyl(R * (1 - y / H) + 0.003, 0.04, p.b, [0, y, 0], R * (1 - (y + 0.04) / H) + 0.003, 16);
  }
  h.ball(0.045, p.pom, [0, H + 0.01, 0], [1, 1, 1], 10);
}

/** The halo: a ring that floats a little and turns. */
function halo(m: Model, c: Ctx, p: { ring: string; glowC: string; tilt: number }): void {
  const h = m.part([0, 0.36, 0]);
  if (!isVox(m)) h.rotation.x = p.tilt;
  ring(h, lit(p.ring), 0.17, 0.022);
  ring(h, see(p.glowC, 0.25, true), 0.17, 0.05);
  c.tick((t) => {
    h.position.y = 0.36 + Math.sin(t * 2) * 0.015;
    h.rotation.y = t * 0.8;
  });
}

/** A wreath. */
function wreath(m: Model): void {
  ring(m, "#3a7b2f", 0.265, 0.018, [0, 0.07, 0]);
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * Math.PI * 2;
    if (Math.abs(a - Math.PI) < 0.35) continue;
    const [lx, lz] = roundAt(m, a, 0.268);
    const leaf = m.ball(
      0.032,
      i % 2 ? "#72bf52" : "#4f9b3d",
      [lx, 0.07 + (i % 2 ? 0.02 : -0.02), lz],
      [0.5, 0.9, 1.5],
      6,
    );
    tilt(m, leaf, 0, a, 0);
  }
  m.ball(0.035, "#f5c842", [0, 0.06, -0.27]);
  m.box([0.03, 0.12, 0.012], "#f5c842", [-0.03, -0.08, -0.265], 0.004).rotation.z = 0.2;
  m.box([0.03, 0.12, 0.012], "#f5c842", [0.03, -0.08, -0.265], 0.004).rotation.z = -0.2;
}

/** A crown with `n` points. */
function spikes(
  m: Model,
  p: { base: string; tip: string; n: number; h: number; r: number; y: number },
): void {
  band(m, p.base, p.r, 0.07, p.y, p.r * 1.05);
  for (let i = 0; i < p.n; i++) {
    const a = (i / p.n) * Math.PI * 2;
    const [x, z] = roundAt(m, a, p.r);
    m.cyl(0.035, p.h, p.tip, [x, p.y + 0.06, z], 0.004, 5);
  }
}

// MARK: Hats

const letters = (
  g: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  size: number,
  color: string,
) => {
  g.fillStyle = color;
  g.font = `700 ${size}px ui-monospace, Menlo, monospace`;
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText(text, x, y);
};

// biome-ignore format: a catalogue reads best one to a line
export const HAT_BUILDERS: Record<string, Build> = {
  Beanie: (m) => {
    m.ball(0.275, "#e25d5d", [0, 0.05, -0.01], [1, 0.75, 1]);
    m.cyl(0.275, 0.08, "#b8443f", [0, 0.02, -0.01], 0.275, 18);
    m.ball(0.06, "#fbf7ef", [0, 0.28, -0.02]);
  },
  "Top hat": (m) => {
    brim(m, "#3a3546", 0.3, 0.14, 0.03);
    m.cyl(0.17, 0.27, "#3a3546", [0, 0.16, 0], 0.165, 20);
    m.cyl(0.173, 0.06, "#c23a3a", [0, 0.17, 0], 0.173, 20);
    m.box([0.04, 0.1, 0.02], "#5a5468", [0.1, 0.3, 0.14], 0.01);
  },
  "Tinfoil hat": (m, c) => {
    const body = m.cyl(0.19, 0.3, "#c9ced6", [0, 0.1, 0], 0.012, 7);
    body.rotation.z = 0.04;
    for (let i = 0; i < 5; i++) {
      const a = i * 1.26;
      const f = m.cyl(
        0.055,
        0.22,
        i % 2 ? "#eef2f6" : "#8d95a3",
        [Math.sin(a) * 0.1, 0.13 + (i % 2) * 0.03, Math.cos(a) * 0.1],
        0.004,
        4,
      );
      f.rotation.set(Math.cos(a) * 0.3, a, Math.sin(a) * 0.3);
    }
    m.ball(0.02, "#ffffff", [0.06, 0.34, 0.03], [1, 1, 1], 6);
    c.tick((t) => (body.rotation.z = 0.04 + Math.sin(t * 40) * 0.004));
  },
  "Ship-it party hat": (m) => party(m, { a: "#e86fb0", b: "#fbf7ef", pom: "#f5d14a" }),
  "Danish flag cap": (m) => {
    dome(m, "#d8283a", 0.275, 0.03, 0.42);
    m.box([0.34, 0.025, 0.2], "#a81d2c", [0, 0.11, 0.24], 0.01).rotation.x = -0.12;
    // The white cross, set toward the back.
    m.box([0.2, 0.012, 0.03], "#fbf7ef", [0, 0.295, -0.04], 0.004);
    m.box([0.03, 0.012, 0.2], "#fbf7ef", [-0.04, 0.294, -0.03], 0.004);
    m.ball(0.022, "#a81d2c", [0, 0.305, 0]);
  },
  Cykelhjelm: (m) => {
    dome(m, "#3fb8a8", 0.28, 0.03, 0.5);
    m.cyl(0.28, 0.03, "#2a8b7f", [0, 0.045, 0], 0.28, 20);
    for (let i = 0; i < 4; i++) {
      const a = -0.55 + i * 0.37;
      m.box(
        [0.045, 0.02, 0.22],
        "#1c3b3a",
        [Math.sin(a) * 0.12, 0.26, Math.cos(a) * 0.04],
        0.008,
      ).rotation.y = a * 0.4;
    }
    m.box([0.3, 0.02, 0.14], "#2a8b7f", [0, 0.1, 0.25], 0.01).rotation.x = -0.1;
    for (const s of [-1, 1]) {
      m.box([0.012, 0.2, 0.02], "#2b2433", [s * 0.255, -0.15, 0.04], 0.004);
    }
    m.box([0.12, 0.012, 0.02], "#2b2433", [0, -0.19, 0.2], 0.004);
  },
  "Wi-Fi antennae": (m, c) => antennae(m, { band: "#3a3f4b", bobble: "#7dffb4", stalk: "#3ddc84" }, c),
  "Cat ears": (m) => ears(m, { out: "#e0904a", inner: "#f19ab8", band: "#b86a2c" }),
  "Prod hard hat": (m) => {
    dome(m, "#f5c842", 0.275, 0.03, 0.5);
    m.cyl(0.285, 0.035, "#c9971f", [0, 0.045, 0], 0.285, 20);
    m.box([0.06, 0.03, 0.46], "#c9971f", [0, 0.29, 0], 0.012);
    m.box([0.3, 0.025, 0.11], "#f5c842", [0, 0.07, 0.29], 0.01).rotation.x = -0.15;
    m.ball(0.016, "#fff0a8", [0.1, 0.22, 0.2]);
  },
  Julehue: (m) => {
    m.cyl(0.27, 0.3, "#d8283a", [0, 0.0, 0], 0.13, 18);
    if (isVox(m)) {
      path(m, "#d8283a", [
        [0.04, 0.34, 0.2],
        [0.12, 0.4, 0.17],
        [0.2, 0.4, 0.14],
        [0.27, 0.34, 0.11],
        [0.31, 0.26, 0.09],
      ]);
      m.ball(0.05, "#fbf7ef", [0.32, 0.18, 0]);
      band(m, "#fbf7ef", 0.285, 0.075, -0.015, 0.285);
      m.cyl(0.285, 0.012, "#fbf7ef", [0, 0.06, 0], 0.285, 18);
      return;
    }
    const tip = m.part([0, 0.29, 0]);
    tip.rotation.z = -0.85;
    tip.cyl(0.13, 0.2, "#d8283a", [0, 0, 0], 0.07, 14);
    const end = tip.part([0, 0.19, 0]);
    end.rotation.z = -1.0;
    end.cyl(0.07, 0.16, "#d8283a", [0, 0, 0], 0.012, 10);
    end.ball(0.05, "#fbf7ef", [0, 0.17, 0]);
    band(m, "#fbf7ef", 0.285, 0.075, -0.015, 0.285);
    m.cyl(0.285, 0.012, "#fbf7ef", [0, 0.06, 0], 0.285, 18);
  },
  "Whirlybird beanie": (m, c) =>
    whirly(m, c, { a: "#f5d14a", b: "#4f8fe0", brim: "#e0584f", blade: "#3ddc84", hub: "#e0584f" }),
  "Prompt chef toque": (m) => toque(m),
  "Cowboy coder hat": (m) => stetson(m, { main: "#9a6236", dark: "#6e4224", band: "#c23a3a" }),
  "Smørrebrød hat": (m) => {
    m.box([0.46, 0.05, 0.36], "#6b4226", [0, 0.2, 0], 0.025);
    m.box([0.44, 0.02, 0.34], "#f5d98a", [0, 0.25, 0], 0.01);
    m.ball(0.065, "#fbf7ef", [-0.05, 0.28, 0.02], [1.3, 0.35, 1.1], 10);
    m.ball(0.03, "#f5c842", [-0.05, 0.295, 0.02], [1, 0.6, 1], 8);
    for (const [x, z] of [
      [0.12, -0.06],
      [0.14, 0.07],
      [0.08, 0.02],
    ] as const)
      m.ball(0.036, "#f28c78", [x, 0.285, z], [1, 0.7, 1.4], 6);
    for (const [x, z] of [
      [-0.14, -0.1],
      [0.0, -0.1],
      [-0.1, 0.11],
    ] as const)
      m.box([0.012, 0.03, 0.012], "#4f9b3d", [x, 0.27, z], 0.004).rotation.z = 0.5;
  },
  "PhD mortarboard": (m) => {
    m.cyl(0.2, 0.09, "#1c1a24", [0, 0.1, 0], 0.2, 16);
    const board = m.box([0.5, 0.03, 0.5], "#2e2e3a", [0, 0.19, 0], 0.01);
    board.rotation.y = Math.PI / 4;
    m.ball(0.02, "#f5c842", [0, 0.225, 0]);
    // A tassel hangs from the middle over one corner.
    m.box([0.01, 0.01, 0.18], "#f5c842", [0.04, 0.23, 0.1], 0.003).rotation.y = -0.4;
    const t = m.part([0.12, 0.23, 0.2]);
    t.cyl(0.004, 0.14, "#f5c842", [0, -0.14, 0], 0.004, 4);
    t.cyl(0.02, 0.07, "#f5c842", [0, -0.21, 0], 0.016, 8);
  },
  "Viking helmet": (m) =>
    horned(m, { steel: "#8a93a1", rim: "#b0793a", horn: "#f4efe4", tip: "#cbbf9f", guard: true }),
  "Pirate tricorn": (m) => tricorn(m, { main: "#2e2e3a", trim: "#f5c842", emblem: "skull" }),
  "Jailbreak horns": (m) => {
    for (const s of [-1, 1]) {
      if (isVox(m)) {
        path(
          m,
          "#d8283a",
          [
            [s * 0.16, 0.24, 0.1],
            [s * 0.2, 0.3, 0.085],
            [s * 0.2, 0.37, 0.07],
          ],
          0.02,
        );
        path(
          m,
          "#ff6b5e",
          [
            [s * 0.17, 0.43, 0.055],
            [s * 0.14, 0.48, 0.04],
          ],
          0.02,
        );
        continue;
      }
      const h = m.part([s * 0.12, 0.2, 0.02]);
      h.rotation.z = -s * 0.35;
      h.cyl(0.05, 0.12, "#d8283a", [0, 0, 0], 0.03, 8);
      const up = h.part([0, 0.12, 0]);
      up.rotation.z = s * 0.55;
      up.cyl(0.03, 0.1, "#ff6b5e", [0, 0, 0], 0.004, 8);
    }
  },
  "Thinking cloud": (m, c) => {
    const cloud = m.part([0, 0.5, 0]);
    cloud.scale.setScalar(1.3);
    for (const [x, y, r] of [
      [0, 0, 0.1],
      [-0.12, -0.02, 0.075],
      [0.12, -0.02, 0.08],
      [-0.05, 0.06, 0.07],
      [0.06, 0.06, 0.075],
    ] as const)
      cloud.ball(r, "#fbf7ef", [x, y, 0], [1, 0.9, 0.7]);
    for (let i = 0; i < 3; i++)
      cloud.ball(0.016, lit("#6d7fc4"), [-0.05 + i * 0.05, 0, 0.07], [1, 1, 0.6], 8);
    m.ball(0.04, "#fbf7ef", [0.05, 0.33, 0.04], [1, 1, 0.8]);
    m.ball(0.025, "#fbf7ef", [0.02, 0.27, 0.05]);
    c.tick((t) => (cloud.position.y = 0.5 + Math.sin(t * 1.8) * 0.012));
  },
  "Archmage hat": (m) => wizard(m, { cone: "#5b4fc2", dark: "#3e3590", star: "#f5d14a", band: "#3e3590" }),
  "Aligned halo": (m, c) => halo(m, c, { ring: "#f5d14a", glowC: "#fff3a8", tilt: 0 }),
  "GPU crown": (m, c) => {
    band(m, "#1f6b45", 0.215, 0.08, 0.17, 0.22);
    band(m, "#f5c842", 0.222, 0.012, 0.19);
    const tips: THREE.Mesh[] = [];
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const [px, pz] = roundAt(m, a, 0.205);
      const p = [px, 0.24, pz] as [number, number, number];
      m.cyl(0.03, 0.12, "#3ddc84", p, 0.005, 5);
      tips.push(m.ball(0.03, lit("#b6ffd4"), [p[0], 0.37, p[2]], [1, 1, 1], 8));
      const [gx, gz] = roundAt(m, a + 0.5, 0.219);
      m.box([0.02, 0.02, 0.012], "#f5c842", [gx, 0.2, gz], 0.004).rotation.y = a + 0.5;
    }
    m.box([0.1, 0.05, 0.02], "#2b2433", [0, 0.2, 0.22], 0.01);
    m.box([0.07, 0.012, 0.01], lit("#7dffb4"), [0, 0.205, 0.232], 0.002);
    c.tick((t) =>
      tips.forEach((b, i) => {
        b.scale.setScalar(0.85 + (0.5 + 0.5 * Math.sin(t * 4 + i)) * 0.5);
      }),
    );
  },
  "Rubber-duck hat": (m) => {
    m.ball(0.14, "#f5d14a", [0, 0.31, -0.01], [1.1, 0.8, 1.2]);
    m.ball(0.095, "#f5d14a", [0, 0.43, 0.08]);
    m.box([0.1, 0.03, 0.08], "#f08a2b", [0, 0.41, 0.17], 0.012);
    for (const s of [-1, 1]) m.ball(0.015, "#2b2433", [s * 0.04, 0.46, 0.15], [1, 1.2, 0.6], 6);
    m.ball(0.06, "#d9a92a", [0, 0.33, -0.14], [1.3, 1, 0.7]);
  },
  "Lego brick hat": (m) => {
    m.box([0.36, 0.14, 0.26], "#d8283a", [0, 0.2, 0], 0.012);
    for (const x of [-0.11, 0, 0.11])
      for (const z of [-0.06, 0.06]) m.cyl(0.04, 0.045, "#ff7a6e", [x, 0.34, z], 0.04, 12);
  },
  "Aurora crown": (m, c) => {
    band(m, "#f5c842", 0.22, 0.06, 0.17, 0.225);
    band(m, "#c9971f", 0.226, 0.012, 0.17);
    const ribbons: THREE.Mesh[] = [];
    const cols = ["#57e3a1", "#5fd8e8", "#b28cff"];
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2;
      const r = new THREE.Mesh(
        isVox(m)
          ? cached("vribbon", () => new THREE.BoxGeometry(0.07, 0.3, 0.03).translate(0, 0.15, 0))
          : cached("ribbon", () => new THREE.PlaneGeometry(0.1, 0.3, 1, 4).translate(0, 0.15, 0)),
        see(cols[i % 3]!, 0.7, true),
      );
      r.userData.noBlock = true;
      (r.material as THREE.Material).side = THREE.DoubleSide;
      const [rx, rz] = roundAt(m, a, 0.2);
      r.position.set(rx, 0.22, rz);
      r.rotation.y = isVox(m) ? 0 : a;
      m.add(r);
      ribbons.push(r);
    }
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 + 0.3;
      const [cx, cz] = roundAt(m, a, 0.222);
      m.cyl(0.025, 0.06, "#f5c842", [cx, 0.2, cz], 0.004, 5);
    }
    c.tick((t) =>
      ribbons.forEach((r, i) => {
        r.scale.y = 0.85 + Math.sin(t * 2.2 + i * 1.3) * 0.2;
        r.rotation.z = isVox(m) ? 0 : Math.sin(t * 1.7 + i) * 0.15;
      }),
    );
  },
  // Raid loot.
  "Hourglass hat": (m, c) => {
    m.cyl(0.27, 0.035, "#8c5c36", [0, 0.1, 0], 0.27, 20);
    m.cyl(0.19, 0.05, "#b57c4b", [0, 0.13, 0], 0.18, 18);
    const g = m.part([0, 0.19, 0]);
    g.scale.setScalar(1.6);
    g.cyl(0.06, 0.012, "#b57c4b", [0, 0, 0], 0.06, 12);
    g.cyl(0.06, 0.012, "#b57c4b", [0, 0.2, 0], 0.06, 12);
    const glass = see("#cfeaf5", 0.45);
    g.cyl(0.055, 0.09, glass, [0, 0.01, 0], 0.008, 12);
    g.cyl(0.008, 0.09, glass, [0, 0.1, 0], 0.055, 12);
    const sand = g.cyl(0.04, 0.035, "#f2c46b", [0, 0.012, 0], 0.03, 10);
    const top = g.cyl(0.03, 0.04, "#f2c46b", [0, 0.12, 0], 0.008, 10);
    for (const s of [-1, 1, 0]) g.cyl(0.008, 0.2, "#8c5c36", [s * 0.06, 0, 0], 0.008, 6);
    c.tick((t) => {
      const k = (t % 6) / 6;
      sand.scale.y = 0.4 + k * 1.4;
      top.scale.y = 1.1 - k;
    });
  },
  "Infinite Context Crown": (m, c) => {
    spikes(m, { base: "#f5c842", tip: "#f5c842", n: 7, h: 0.1, r: 0.24, y: 0.16 });
    band(m, "#c9971f", 0.246, 0.014, 0.17);
    const inf = m.part([0, 0.2, 0.248]);
    ring(inf, lit("#5ff0ff"), 0.022, 0.006, [-0.022, 0, 0], false);
    ring(inf, lit("#5ff0ff"), 0.022, 0.006, [0.022, 0, 0], false);
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2 + Math.PI / 7;
      const [x, z] = roundAt(m, a, 0.24);
      m.ball(0.018, "#5ff0ff", [x, 0.31, z], [1, 1, 1], 6);
    }
    c.tick((t) => inf.scale.setScalar(1 + Math.sin(t * 3) * 0.1));
  },
  "<<<<<<< HEAD band": (m) => {
    ring(m, "#e0584f", 0.262, 0.03, [0, 0.1, 0]).scale.set(1.03, 1.03, 1.0);
    sign(
      m,
      0.2,
      0.06,
      (g, w, h) => letters(g, "<<<<<<<", w / 2, h / 2, h * 1.1, "#fbf7ef"),
      [0, 0.1, 0.285],
      80,
    );
    const knot = m.part([0, 0.1, -0.27]);
    knot.ball(0.04, "#e0584f", [0, 0, 0]);
    for (const s of [-1, 1])
      knot.box([0.035, 0.16, 0.012], "#b8443f", [s * 0.03, -0.15, -0.02], 0.004).rotation.z = s * 0.2;
  },
  "Mirage Crown": (m, c) => {
    // Clear the voxel character's taller hair, as with the other raid crowns.
    const up = isVox(m) ? 0.1 : 0;
    const violet = "#9b6fd6",
      pale = "#d9c2f5",
      dark = "#4a2a73",
      gold = "#ffd35c";
    band(m, dark, 0.245, 0.065, 0.16 + up);
    band(m, gold, 0.25, 0.016, 0.16 + up);
    band(m, gold, 0.25, 0.012, 0.22 + up);
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2;
      const [x, z] = roundAt(m, a, 0.24);
      const h = i === 0 ? 0.21 : 0.13 + (i % 2) * 0.045;
      m.cyl(0.045, h, violet, [x, 0.215 + up, z], 0.006, 5);
      m.ball(0.018, gold, [x, 0.215 + up + h, z], [1, 1, 1], 6);
    }
    // The boss's lavender swirl wraps the band; its two eyes watch from the front.
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2;
      const [x, z] = roundAt(m, a, 0.253);
      m.box([0.038, 0.018, 0.038], pale, [x, 0.178 + up + (i % 3) * 0.014, z], 0);
    }
    for (const x of [-0.085, 0.085]) {
      m.box([0.07, 0.05, 0.025], "#fffdf6", [x, 0.18 + up, 0.255], 0);
      m.box([0.025, 0.03, 0.012], dark, [x, 0.19 + up, 0.273], 0);
    }
    // The boss's golden sparkles orbit a luminous crest.
    const starGlow = lit(gold);
    const starlight = lit("#fffdf6");
    const crest = m.part([0, 0.31 + up, 0.27]);
    crest.name = "mirage-crest";
    shaped(crest, "mirage-star", star(0.09, 4, 0.33), 0.025, starGlow, [0, 0, 0]);
    shaped(crest, "mirage-core", star(0.038, 4, 0.35), 0.03, starlight, [0, 0, 0.02]);
    const orbit = m.part([0, 0.4 + up, 0]);
    orbit.name = "mirage-orbit";
    for (let i = 0; i < 4; i++) {
      const angle = (i * Math.PI) / 2;
      const sparkle = orbit.part([Math.sin(angle) * 0.34, (i % 2) * 0.055, Math.cos(angle) * 0.34]);
      sparkle.box([0.025, 0.07, 0.025], starGlow);
      sparkle.box([0.07, 0.025, 0.025], i % 2 ? starGlow : starlight, [0, 0.022, 0]);
      sparkle.userData.noBlock = true;
    }
    c.tick((t) => {
      orbit.rotation.y = t * 0.65;
      orbit.position.y = 0.4 + up + Math.sin(t * 1.8) * 0.018;
      crest.scale.setScalar(1 + Math.sin(t * 2.5) * 0.08);
    });
  },
  "Paid in Full crown": (m) => {
    // The blocky head's hair stands higher than the round head these builders are drawn for: lift the crown clear of it.
    const up = isVox(m) ? 0.1 : 0;
    spikes(m, { base: "#f5c842", tip: "#f5c842", n: 5, h: 0.1, r: 0.24, y: 0.16 + up });
    band(m, "#c9971f", 0.246, 0.014, 0.158 + up);
    band(m, "#3fae5a", 0.262, 0.04, 0.178 + up);
    sign(
      m,
      0.1,
      0.06,
      (g, w, h) => {
        g.strokeStyle = "#ffffff";
        g.lineWidth = h * 0.24;
        g.lineCap = "square";
        g.lineJoin = "miter";
        g.beginPath();
        g.moveTo(w * 0.22, h * 0.54);
        g.lineTo(w * 0.42, h * 0.78);
        g.lineTo(w * 0.78, h * 0.2);
        g.stroke();
      },
      [0, 0.198 + up, 0.268],
      80,
    );
  },
  // The traveling merchant's editions.
  "Prompt wizard hat": (m) =>
    wizard(m, { cone: "#6a4bc4", dark: "#3b2a78", star: "#f5d14a", band: "#4d3596" }),
  "Green-CI halo": (m, c) => halo(m, c, { ring: "#3ddc84", glowC: "#b6ffc6", tilt: 0.28 }),
  "Release party hat": (m) => party(m, { a: "#f5d14a", b: "#e8584f", pom: "#fbf7ef" }),
  "Propeller beanie": (m, c) =>
    whirly(m, c, { a: "#e0584f", b: "#4f8fe0", brim: "#f5d14a", blade: "#f5d14a", hub: "#5d6470" }),
  "Spaghetti chef's toque": (m) =>
    toque(m, (t) => {
      const noodle = t.cyl(0.012, 0.0001, "#f0c45a", [0, 0, 0]);
      noodle.visible = false;
      for (let i = 0; i < 8; i++)
        t.ball(0.015, "#f0c45a", [-0.12 + i * 0.034, 0.1 + Math.sin(i * 1.4) * 0.018, 0.2], [1.2, 1, 1], 6);
    }),
  "Friday deploy stetson": (m) =>
    stetson(m, { main: "#9a6a3c", dark: "#6e4a2a", band: "#c23a3a", dent: true }),
  "Force-push helm": (m) => {
    horned(m, { steel: "#cfccc7", rim: "#e9b73d", horn: "#f1e6d2", tip: "#8a93a1", guard: false });
    for (const x of [-0.12, 0, 0.12]) m.ball(0.014, "#8a93a1", [x, 0.15, 0.24], [1, 1, 1], 6);
  },
  "Cat-5 ears": (m) => ears(m, { out: "#4f8fe0", inner: "#f28bb2", band: "#3a6fb8" }),
  "Antenna headband": (m, c) => antennae(m, { band: "#3a3f4b", bobble: "#8fe3ff", stalk: "#e8584f" }, c),
  "Cache-hit mushroom": (m) => {
    dome(m, "#d9574a", 0.34, 0.0, 0.46, 20);
    m.cyl(0.3, 0.03, "#b0443a", [0, 0.1, 0], 0.3, 20);
    for (const [x, y, z, r] of [
      [0, 0.33, 0, 0.05],
      [0.15, 0.25, 0.1, 0.04],
      [-0.14, 0.26, 0.12, 0.045],
      [0.08, 0.24, -0.17, 0.04],
      [-0.12, 0.25, -0.12, 0.035],
    ] as const)
      m.ball(r, "#fbf7ef", [x, y, z], [1, 0.5, 1], 8);
  },
  "Borrowed-token tricorn": (m) => tricorn(m, { main: "#2f2a3a", trim: "#f5c842", emblem: "coin" }),
  // The Halloween costume (`core/src/costumes.ts`): a lumpy pumpkin on the crown, its face cut in the front
  // and lit from inside, a green stem on top.
  "Jack-o'-lantern": (m) => {
    m.ball(0.3, "#e8772a", [0, 0.12, 0], [1.12, 0.7, 1.05], 18);
    for (let i = 0; i < 4; i++) {
      const a = Math.PI / 4 + (i * Math.PI) / 2;
      m.ball(0.2, "#c25a1c", [Math.cos(a) * 0.14, 0.12, Math.sin(a) * 0.13], [1, 1.02, 1], 12);
    }
    m.cyl(0.035, 0.1, "#5a8a2a", [0, 0.3, 0], 0.025, 6).rotation.z = 0.25;
    for (const x of [-0.1, 0.1]) m.box([0.07, 0.06, 0.03], lit("#ffd04a"), [x, 0.17, 0.3], 0.005);
    m.box([0.2, 0.045, 0.03], lit("#ffd04a"), [0, 0.07, 0.3], 0.005);
  },
  // Fastelavn's prize (`core/src/costumes.ts`): a gold crown with a black cat's ears and a red jewel in front.
  "Kattekonge crown": (m) => {
    const up = isVox(m) ? 0.1 : 0;
    spikes(m, { base: "#f5c842", tip: "#f5c842", n: 4, h: 0.1, r: 0.24, y: 0.16 + up });
    band(m, "#c9971f", 0.246, 0.014, 0.158 + up);
    band(m, "#f5c842", 0.252, 0.05, 0.172 + up);
    for (const x of [-0.07, 0.07]) m.cyl(0.04, 0.08, "#2b2433", [x, 0.27 + up, 0.12], 0.004, 4);
    m.ball(0.03, lit("#e8584f"), [0, 0.2 + up, 0.25]);
  },
  "429 bucket hat": (m) => {
    m.cyl(0.215, 0.17, "#4fb3a9", [0, 0.07, 0], 0.2, 18);
    m.cyl(0.215, 0.05, "#3a8c84", [0, 0.07, 0], 0.34, 22).position.y = 0.08;
    m.box([0.07, 0.07, 0.012], "#e0584f", [0.19, 0.16, 0.12], 0.004).rotation.y = 0.9;
    sign(
      m,
      0.06,
      0.05,
      (g, w, h) => letters(g, "429", w / 2, h / 2, h * 0.9, "#fbf7ef"),
      [0.2, 0.16, 0.122],
      80,
    ).rotation.y = 0.9;
  },
  "Benchmark laurels": (m) => wreath(m),
  "Copenhagen ushanka": (m) => {
    dome(m, "#6b4a34", 0.285, 0.0, 0.5);
    m.cyl(0.285, 0.1, "#c9a27a", [0, 0.02, 0], 0.285, 20);
    for (const s of [-1, 1])
      m.box([0.07, 0.2, 0.13], "#6b4a34", [s * 0.275, -0.17, 0.0], 0.03).rotation.z = -s * 0.1;
    m.box([0.07, 0.05, 0.012], "#c8102e", [0, 0.1, 0.287], 0.004);
    m.box([0.012, 0.07, 0.012], "#fbf7ef", [-0.012, 0.1, 0.29], 0.002);
    m.box([0.07, 0.012, 0.012], "#fbf7ef", [0, 0.1, 0.29], 0.002);
  },
  // The Night Market case.
  "Straw kasa": (m) => {
    // A wide woven cone, ringed with darker straw, and a cord down each cheek.
    cone(m, "#e8cd7e", 0.4, 0.22, 0.14, [0, 0], 24, 0.02);
    m.cyl(0.4, 0.014, "#c29a46", [0, 0.14, 0], 0.4, 24);
    for (const [r, y] of [
      [0.31, 0.19],
      [0.22, 0.25],
      [0.12, 0.3],
    ] as const)
      m.cyl(r + 0.004, 0.012, "#c29a46", [0, y, 0], r, 24);
    m.ball(0.026, "#c29a46", [0, 0.37, 0], [1, 1, 1], 6);
    for (const s of [-1, 1]) m.box([0.012, 0.22, 0.012], "#8a5a2b", [s * 0.21, -0.02, 0.15], 0.004);
  },
  Hachimaki: (m) => {
    // A white twisted headband with the red sun, knotted at the side with two tails.
    band(m, "#fbf7ef", 0.262, 0.07, 0.03);
    band(m, "#d9d3c6", 0.266, 0.014, 0.05);
    m.ball(0.034, "#d9323a", [0, 0.066, 0.262], [1, 1, 0.25], 12);
    m.ball(0.032, "#fbf7ef", [0.255, 0.065, -0.09], [1, 1, 1], 8);
    for (const [z, lean] of [
      [-0.13, 0.25],
      [-0.17, -0.1],
    ] as const)
      tilt(m, m.box([0.014, 0.16, 0.034], "#fbf7ef", [0.27, -0.09, z], 0.004), lean, 0, 0.12);
  },
  "Paper fan visor": (m) => {
    // A headband with a folding paper fan opened into a half-circle above it: red and white pleats, gold ribs and rim.
    band(m, "#2f2a3a", 0.262, 0.05, 0.07);
    band(m, "#f0c45a", 0.266, 0.012, 0.09);
    flat(m, 0.46, 0.28, [0, 0.27, 0.252], 0.04, (g, w, h) => {
      const R = w / 2;
      g.save();
      g.translate(w / 2, h);
      g.scale(1, h / R);
      const n = 8;
      for (let i = 0; i < n; i++) {
        g.fillStyle = i % 2 ? "#fbf7ef" : "#d9323a";
        g.beginPath();
        g.moveTo(0, 0);
        g.arc(0, 0, R, Math.PI + (i * Math.PI) / n, Math.PI + ((i + 1) * Math.PI) / n);
        g.fill();
      }
      g.strokeStyle = "#f0c45a";
      g.lineWidth = 3.4;
      for (let i = 0; i <= n; i++) {
        const a = Math.PI + (i * Math.PI) / n;
        g.beginPath();
        g.moveTo(0, 0);
        g.lineTo(Math.cos(a) * R, Math.sin(a) * R);
        g.stroke();
      }
      g.beginPath();
      g.arc(0, 0, R - 1.5, Math.PI, Math.PI * 2);
      g.stroke();
      g.fillStyle = "#f0c45a";
      g.beginPath();
      g.arc(0, 0, 8, Math.PI, Math.PI * 2);
      g.fill();
      g.restore();
    });
  },
  "Fox half-mask": (m) => {
    // A white kitsune mask over the brow: pointed ears with red insides, red cheek stripes, slanted eye slits, a black
    // nose tip, a red forehead mark, tied on with a red cord.
    flat(m, 0.46, 0.5, [0, 0.18, 0.246], 0.03, (g, w, h) => {
      const X = (x: number) => (x / 111) * w;
      const Y = (y: number) => (y / 120) * h;
      const poly = (pts: [number, number][], fill: string, stroke?: string) => {
        g.beginPath();
        for (const [i, [x, y]] of pts.entries()) {
          if (i) g.lineTo(X(x), Y(y));
          else g.moveTo(X(x), Y(y));
        }
        g.closePath();
        g.fillStyle = fill;
        g.fill();
        if (stroke) {
          g.strokeStyle = stroke;
          g.lineWidth = 3.2;
          g.stroke();
        }
      };
      const line = (x1: number, y1: number, x2: number, y2: number, col: string, lw: number) => {
        g.strokeStyle = col;
        g.lineWidth = lw;
        g.beginPath();
        g.moveTo(X(x1), Y(y1));
        g.lineTo(X(x2), Y(y2));
        g.stroke();
      };
      const ink = "#2b1a20";
      for (const s of [-1, 1]) {
        const x = (v: number) => (s < 0 ? v : 111 - v);
        poly(
          [
            [x(6), 52],
            [x(15), 1],
            [x(48), 46],
          ],
          "#fbf7ef",
          ink,
        );
        poly(
          [
            [x(17), 44],
            [x(19), 12],
            [x(37), 42],
          ],
          "#d9323a",
        );
      }
      poly(
        [
          [6, 44],
          [105, 44],
          [104, 78],
          [80, 100],
          [55, 119],
          [31, 100],
          [7, 78],
        ],
        "#fbf7ef",
        ink,
      );
      for (const s of [-1, 1]) {
        const x = (v: number) => (s < 0 ? v : 111 - v);
        line(x(21), 58, x(46), 69, "#14121a", 6);
        line(x(10), 74, x(36), 80, "#d9323a", 5);
        line(x(16), 87, x(40), 90, "#d9323a", 5);
      }
      line(55.5, 46, 55.5, 66, "#d9323a", 6);
      g.fillStyle = "#14121a";
      g.beginPath();
      g.arc(X(55.5), Y(111), 7, 0, Math.PI * 2);
      g.fill();
    });
    band(m, "#d9323a", 0.262, 0.026, 0.07);
    m.ball(0.03, "#d9323a", [0.262, 0.08, -0.07], [1, 1, 1], 8);
    for (const [z, lean] of [
      [-0.1, 0.25],
      [-0.14, -0.1],
    ] as const)
      tilt(m, m.box([0.014, 0.15, 0.03], "#d9323a", [0.27, -0.06, z], 0.004), lean, 0, 0.12);
  },
  // The Nusantara case (`core/src/case-nusantara.ts`). A blocky head is taller than the builders' ball, so these ride `up` higher.
  Blangkon: (m) => {
    // A folded batik headcloth: a brown dome with a lattice of cream and indigo diamonds, a tan band and the little
    // knot (the mondolan) at the back.
    const up = isVox(m) ? 0.08 : 0;
    const BROWN = "#6b4226";
    const INDIGO = "#243a73";
    const CREAM = "#f1e3c2";
    dome(m, BROWN, 0.272, 0.03 + up, 0.47);
    band(m, "#c9a265", 0.268, 0.055, 0.0 + up);
    band(m, "#8a5a2b", 0.272, 0.014, 0.055 + up);
    // Diamonds: two rings of studs, cream set between indigo, on the cloth.
    const stud = (a: number, y: number, c: string, r: number, k = 0.026) => {
      const [x, z] = roundAt(m, a, isVox(m) ? r + 0.045 : r);
      m.box([k, k, k * 0.6], c, [x, y, z], 0.004).rotation.y = a;
    };
    for (const [y, r, n, k] of [
      [0.1, 0.262, 12, 0.036],
      [0.19, 0.22, 8, 0.03],
    ] as const)
      for (let i = 0; i < n; i++) stud(((i + 0.5) / n) * Math.PI * 2, y + up, i % 2 ? CREAM : INDIGO, r, k);
    m.ball(0.04, "#c9a265", [0, 0.29 + up, 0], [1, 0.6, 1], 8);
    m.ball(0.1, BROWN, [0, 0.03 + up, -0.28], [1, 0.9, 0.8]);
    m.ball(0.06, INDIGO, [0, 0.035 + up, -0.35], [1, 0.9, 0.7], 8);
    m.box([0.13, 0.024, 0.024], "#c9a265", [0, 0.02 + up, -0.34], 0.004);
  },
  Peci: (m) => {
    // Black velvet, flat-topped, worn straight and a touch forward: a short cylinder, a little wider at the top.
    const up = isVox(m) ? 0.09 : 0;
    const R = isVox(m) ? 0.285 : 0.222;
    const o = m.cyl(R, 0.2, "#17151c", [0, 0.06 + up, 0.01], R + 0.016, 22);
    if (!isVox(m)) o.rotation.x = 0.07;
    m.cyl(R + 0.004, 0.034, "#2a2832", [0, 0.09 + up, 0.01], R + 0.01, 22);
    m.cyl(R + 0.018, 0.012, "#25232c", [0, 0.248 + up, 0.012], R + 0.018, 22);
    m.box([0.06, 0.012, 0.012], "#3a3744", [0.09, 0.19 + up, R * 0.95], 0.003);
  },
  "Ojek helmet": (m) => {
    // An open-face half-shell in pale green, a smoked visor flipped up on the brow, stickers on the side.
    const up = isVox(m) ? 0.07 : 0;
    const SHELL = "#aee0a2";
    dome(m, SHELL, 0.29, 0.02 + up, 0.5);
    band(m, "#86c07c", 0.29, 0.045, 0.0 + up);
    m.box([0.07, 0.014, 0.4], "#8fcb85", [0, 0.31 + up, -0.02], 0.004);
    // The visor, up: a tinted pane on two little hinges.
    const v = m.box([0.36, 0.13, 0.014], see("#2c4045", 0.72), [0, 0.2 + up, 0.27], 0.004);
    if (!isVox(m)) v.rotation.x = -0.65;
    for (const s of [-1, 1]) m.box([0.02, 0.03, 0.02], "#5d8f58", [s * 0.18, 0.19 + up, 0.275], 0.004);
    // The peak's edge on the brow.
    m.box([0.34, 0.02, 0.06], "#7ab870", [0, 0.08 + up, 0.275], 0.008);
    // Stickers: a red and a yellow patch and a stripe.
    for (const s of [-1, 1] as const) {
      m.box([0.012, 0.07, 0.09], "#d6343a", [s * 0.287, 0.13 + up, 0.04], 0.003);
      m.box([0.013, 0.05, 0.05], "#f2b632", [s * 0.289, 0.19 + up, -0.08], 0.003);
      m.box([0.013, 0.014, 0.12], "#f1e3c2", [s * 0.289, 0.09 + up, -0.02], 0.003);
    }
    m.box([0.1, 0.12, 0.013], "#f2b632", [0.0, 0.15 + up, -0.288], 0.003);
    m.box([0.06, 0.06, 0.014], "#d6343a", [0.0, 0.16 + up, -0.29], 0.003);
  },
  "Little Bromo": (m, c) => {
    // A smoking volcano for a hat: a grey-brown cone, ridged, a red-hot rim round the crater and grey puffs that
    // rise and thin out.
    const up = isVox(m) ? 0.09 : 0;
    m.cyl(0.29, 0.3, "#6e6458", [0, 0.1 + up, 0], 0.11, 22);
    m.cyl(0.255, 0.05, "#5a5148", [0, 0.1 + up, 0], 0.286, 22);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 + 0.4;
      const [x, z] = roundAt(m, a, 0.2);
      m.box([0.034, 0.18, 0.034], "#4a4239", [x, 0.14 + up, z], 0.01);
    }
    m.cyl(0.12, 0.03, "#e0422a", [0, 0.395 + up, 0], 0.11, 18);
    m.cyl(0.085, 0.034, lit("#ff9a2e"), [0, 0.398 + up, 0], 0.085, 14);
    const puffs = [0, 1, 2].map((i) =>
      m.ball(0.05 + i * 0.01, see("#b9bcc4", 0.7), [0, 0.44 + up, 0], [1, 0.8, 1], 8),
    );
    c.tick((t) => {
      puffs.forEach((p, i) => {
        // Two frames of smoke, as in 2D: they step up in beats and thin out.
        const k = (t * 0.45 + i / 3) % 1;
        const step = Math.floor(k * 4) / 4;
        p.position.set(Math.sin(i * 2.1 + step * 3) * 0.04, 0.44 + up + step * 0.3, Math.cos(i * 2.1) * 0.03);
        p.scale.setScalar(0.5 + step * 1.1);
        (p.material as THREE.Material).opacity = 0.75 * (1 - step * 0.9);
      });
    });
  },
};

// MARK: Face

/** One round lens: a ring and a see-through disc. */
function roundLens(e: Model, frame: string, glass: string, r = 0.062, opacity = 0.5): void {
  ring(e, frame, r, 0.009, [0, 0, 0], false);
  if (isVox(e)) {
    squarePane(e, r * 0.95, see(glass, opacity), [0, 0, 0.002]);
    return;
  }
  const disc = new THREE.Mesh(
    cached(`disc${r}`, () => new THREE.CircleGeometry(r, 20)),
    see(glass, opacity),
  );
  disc.position.z = 0.002;
  e.add(disc);
}
/** A bridge between the two lenses and arms back round the head. */
function bridge(m: Model, color: string, y = EYE_Y, width = 0.2): void {
  m.box([width * 0.35, 0.012, 0.012], color, [0, y, 0.246], 0.004);
  for (const s of [-1, 1])
    m.box([0.012, 0.012, 0.18], color, [s * 0.255, y + 0.005, 0.1], 0.004).rotation.y = s * -0.12;
}
/** A flat painted plate facing front, `depth` thick: raised cubes on a blocky model, a plane on a smooth one. */
function flat(
  m: Model,
  w: number,
  h: number,
  at: [number, number, number],
  depth: number,
  draw: (g: CanvasRenderingContext2D, cw: number, ch: number) => void,
): THREE.Mesh {
  if (!isVox(m)) return sign(m, w, h, draw, at);
  const cell = 0.0125;
  return pixelPatch(m, {
    cols: Math.round(w / cell),
    rows: Math.round(h / cell),
    cell,
    depth,
    draw,
    at,
    fill: 0.3,
  });
}
/** A band round the head at eye height. */
function strap(m: Model, color: string, y = EYE_Y, w = 0.03): void {
  if (isVox(m)) {
    // A square band round the block head: x is stretched 1.25 on the face frame, so it is 0.2 to each side.
    const g = cached(`vstrap${w}`, () => {
      const parts = [
        new THREE.BoxGeometry(0.44, w, 0.03).translate(0, 0, 0.21),
        new THREE.BoxGeometry(0.44, w, 0.03).translate(0, 0, -0.32),
        new THREE.BoxGeometry(0.03, w, 0.5).translate(-0.215, 0, -0.055),
        new THREE.BoxGeometry(0.03, w, 0.5).translate(0.215, 0, -0.055),
      ].map((b) => b.toNonIndexed());
      const out = mergeGeometries(parts)!;
      for (const b of parts) b.dispose();
      return out;
    });
    place(m, g, color, [0, y - w / 2, 0]);
    return;
  }
  const r = m.cyl(0.262, w, color, [0, y - w / 2, 0], 0.262, 24);
  r.scale.set(1.0, 1, 0.97);
  (r.material as THREE.Material).side = THREE.DoubleSide;
}
/** A flat panel across both eyes, bent round the face. */
function visor(
  m: Model,
  p: { color: string | THREE.Material; w: number; h: number; y?: number; depth?: number },
): THREE.Mesh {
  if (isVox(m)) {
    // A flat panel across the face with a short return at each temple.
    const t = 0.03 + (p.depth ?? 0) * 0.5;
    const wrap = p.w >= 0.38;
    const g = cached(`vvisor${p.w},${p.h},${t}`, () => {
      const parts = [
        new THREE.BoxGeometry(wrap ? 0.45 : Math.min(p.w, 0.4), p.h, t).translate(0, 0, 0.2 + t / 2),
      ];
      if (wrap)
        for (const s of [-1, 1])
          parts.push(
            new THREE.BoxGeometry(t, p.h, 0.24).translate(s * (0.2 + t / 2 + 0.005), 0, 0.2 + t - 0.12),
          );
      const ng = parts.map((b) => b.toNonIndexed());
      const out = mergeGeometries(ng)!;
      for (const b of ng) b.dispose();
      return out;
    });
    const o = place(m, g, p.color, [0, p.y ?? EYE_Y, 0]);
    if (typeof p.color !== "string") (o.material as THREE.Material).side = THREE.DoubleSide;
    return o;
  }
  const geom = cached(`visor${p.w},${p.h}`, () => {
    const g = new THREE.CylinderGeometry(
      0.262,
      0.262,
      p.h,
      16,
      1,
      true,
      Math.PI - p.w / 0.262 / 2 + (Math.PI / 2) * 0,
      p.w / 0.262,
    );
    return g;
  });
  const o = new THREE.Mesh(geom, typeof p.color === "string" ? toon(p.color) : p.color);
  (o.material as THREE.Material).side = THREE.DoubleSide;
  o.position.set(0, p.y ?? EYE_Y, 0);
  o.rotation.y = Math.PI; // The cylinder's seam is at +z; turn its slice to the face.
  o.scale.set(1.02, 1, 0.99 + (p.depth ?? 0));
  o.castShadow = true;
  m.add(o);
  return o;
}

const gradientLens = (stops: [number, string][], w = 256, h = 64): THREE.Material => {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const g = c.getContext("2d")!;
  const grd = g.createLinearGradient(0, 0, w, 0);
  for (const [t, col] of stops) grd.addColorStop(t, col);
  g.fillStyle = grd;
  g.fillRect(0, 0, w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.ClampToEdgeWrapping;
  return new THREE.MeshBasicMaterial({ map: t, transparent: true, opacity: 0.92 });
};

function shades(m: Model, frame: string, lens: string, glint = true): void {
  for (const s of [-1, 1] as const) {
    const e = eyeAt(m, s);
    e.box([0.135, 0.085, 0.02], frame, [0, -0.043, 0.005], 0.014);
    e.box([0.115, 0.065, 0.02], lens, [0, -0.033, 0.012], 0.01);
    if (glint) e.box([0.03, 0.008, 0.01], "#ffffff", [-0.03 * s, 0.0, 0.025], 0.003).rotation.z = 0.5;
  }
  m.box([0.05, 0.016, 0.02], frame, [0, EYE_Y + 0.0, 0.245], 0.006);
  bridge(m, frame);
}

function monocle(m: Model, frame: string, chain: string, tag = false): void {
  const e = eyeAt(m, 1);
  ring(e, frame, 0.058, 0.008, [0, 0, 0.002], false);
  if (isVox(e)) squarePane(e, 0.054, see("#cde9f6", 0.35), [0, 0, 0.004]);
  else {
    const d = new THREE.Mesh(new THREE.CircleGeometry(0.056, 20), see("#cde9f6", 0.35));
    d.position.z = 0.004;
    e.add(d);
  }
  for (let i = 0; i < 5; i++)
    e.ball(0.008, chain, [0.02 - i * 0.005, -0.075 - i * 0.05, -0.005 - i * 0.01], [1, 1, 1], 5);
  if (tag)
    sign(
      e,
      0.1,
      0.06,
      (g, w, h) => {
        g.fillStyle = "#fbf7ef";
        g.fillRect(0, 0, w, h);
        letters(g, "$$$", w / 2, h / 2, h * 0.8, "#e0584f");
      },
      [-0.01, -0.34, -0.03],
      70,
    );
  else e.box([0.07, 0.035, 0.012], "#cde9f6", [0.0, -0.31, -0.03], 0.004);
}

function starLens(m: Model, frame: string, lens: string, tag: string): void {
  for (const s of [-1, 1] as const) {
    const e = eyeAt(m, s);
    shaped(e, `${tag}-frame`, star(0.075, 5, 0.5), 0.012, frame, [0, -0.004, 0.012]);
    shaped(e, `${tag}-lens`, star(0.052, 5, 0.5), 0.012, lens, [0, -0.004, 0.022]);
  }
  bridge(m, frame);
}

function pixelShades(m: Model): void {
  for (const s of [-1, 1] as const) {
    const e = eyeAt(m, s);
    e.box([0.13, 0.04, 0.02], "#14121a", [0, 0.002, 0.01], 0.004);
    e.box([0.1, 0.03, 0.02], "#14121a", [0, -0.03, 0.01], 0.004);
    e.box([0.06, 0.03, 0.02], "#14121a", [0, -0.058, 0.01], 0.004);
    e.box([0.018, 0.008, 0.01], "#fbf7ef", [-0.035 * s, -0.004, 0.024], 0.002);
  }
  bridge(m, "#14121a");
}

// biome-ignore format: a catalogue reads best one to a line
export const FACE_BUILDERS: Record<string, Build> = {
  "Nerd specs": (m) => {
    for (const s of [-1, 1] as const) roundLens(eyeAt(m, s), "#6b4226", "#cde9f6", 0.066, 0.35);
    m.box([0.05, 0.014, 0.014], "#6b4226", [0, EYE_Y + 0.012, 0.245], 0.004);
    bridge(m, "#6b4226");
  },
  Shades: (m) => shades(m, "#2b2433", "#1c1a24"),
  "Heart glasses": (m) => {
    for (const s of [-1, 1] as const) {
      const e = eyeAt(m, s);
      shaped(e, "heart-frame", heart(0.16), 0.016, "#c23a6b", [0, -0.012, 0.012]);
      shaped(e, "heart-lens", heart(0.12), 0.016, "#ff6fa3", [0, -0.012, 0.022]);
    }
    bridge(m, "#c23a6b");
  },
  "Hallucination nose": (m) => {
    const n = mid(m, EYE_Y - 0.065, 0.246);
    n.ball(0.05, "#e0302e", [0, 0, 0.012], [1, 1, 1], 14);
    n.ball(0.011, "#ffb3a8", [-0.016, 0.018, 0.055], [1, 0.8, 0.6], 6);
  },
  "3D glasses": (m) => {
    const cols = ["#e0302e", "#3f89e2"];
    ([-1, 1] as const).forEach((s, i) => {
      const e = eyeAt(m, s);
      e.box([0.135, 0.085, 0.016], "#fbf7ef", [0, -0.043, 0.005], 0.008);
      e.box([0.11, 0.06, 0.02], see(cols[i]!, 0.75), [0, -0.031, 0.014], 0.006);
    });
    bridge(m, "#fbf7ef");
  },
  "Hygge moustache": (m, c) => {
    // A handlebar under the nose, over the top of the mouth: a bar wider than the mouth, its wings drooping
    // to curled tips that climb the cheeks. A voxel head's front is flat; a round one's falls away to the sides.
    const vox = isVox(m);
    const bar = mid(m, -0.13, vox ? 0.25 : 0.236);
    const dark = tint(c.hair, -0.18);
    const back = (x: number) => (vox ? 0 : -2.4 * x * x);
    bar.box([0.17, 0.036, 0.05], c.hair, [0, 0, 0], 0.006);
    for (const s of [-1, 1]) {
      const wing = 0.1225;
      const out = 0.1825;
      const tip = 0.2;
      bar.box([0.075, 0.034, 0.045], c.hair, [s * wing, -0.012, back(wing)], 0.006);
      bar.box([0.045, 0.034, 0.04], dark, [s * out, -0.02, back(out) - 0.004], 0.006);
      bar.box([0.032, 0.07, 0.036], dark, [s * tip, -0.012, back(tip) - 0.008], 0.006);
    }
  },
  Eyepatch: (m) => {
    const e = eyeAt(m, -1);
    e.ball(0.07, "#1c1a24", [0, -0.003, 0.0], [1, 0.9, 0.4], 14);
    // The strap runs up from the patch across the forehead and round the back.
    if (isVox(m)) {
      strap(m, "#1c1a24", EYE_Y + 0.045, 0.024);
      return;
    }
    const strap2 = band(m, "#1c1a24", 0.262, 0.022, 0.0);
    strap2.rotation.z = 0.36;
    strap2.scale.set(1, 1, 0.97);
  },
  "Harbour swim goggles": (m) => {
    for (const s of [-1, 1] as const) {
      const e = eyeAt(m, s);
      ring(e, "#1c1a24", 0.066, 0.014, [0, 0, 0.004], false);
      if (isVox(e)) squarePane(e, 0.058, see("#2fb5c9", 0.75), [0, 0, 0.008]);
      else {
        const d = new THREE.Mesh(new THREE.CircleGeometry(0.06, 20), see("#2fb5c9", 0.75));
        d.position.z = 0.008;
        e.add(d);
      }
    }
    m.box([0.05, 0.014, 0.02], "#1c1a24", [0, EYE_Y, 0.246], 0.005);
    strap(m, "#1c1a24", EYE_Y + 0.02, 0.026);
  },
  Monocle: (m) => monocle(m, "#f5c842", "#c9971f"),
  "Rockstar glasses": (m) => starLens(m, "#f5c842", "#ff6fa3", "rock"),
  "Prompt bandit bandana": (m) => {
    // Over the nose and mouth, tied at the back.
    if (isVox(m)) {
      m.box([0.42, 0.11, 0.03], "#c23a3a", [0, -0.19, 0.205]);
      for (const s of [-1, 1]) m.box([0.03, 0.11, 0.3], "#c23a3a", [s * 0.215, -0.19, 0.05]);
      m.box([0.42, 0.035, 0.03], "#a82a2a", [0, -0.092, 0.205]);
      for (const [x, y] of [
        [-0.09, -0.15],
        [0.03, -0.19],
        [0.12, -0.14],
        [-0.14, -0.2],
      ] as const)
        m.box([0.025, 0.025, 0.01], "#fbf7ef", [x, y, 0.222]);
      m.box([0.04, 0.04, 0.04], "#c23a3a", [0.22, -0.13, -0.1]);
      m.box([0.03, 0.1, 0.03], "#a82a2a", [0.22, -0.26, -0.1]);
      return;
    }
    const b = new THREE.Mesh(
      cached("bandana", () => new THREE.CylinderGeometry(0.262, 0.232, 0.13, 20, 1, true, -1.25, 2.5)),
      toon("#c23a3a"),
    );
    (b.material as THREE.Material).side = THREE.DoubleSide;
    b.position.y = -0.13;
    b.scale.set(1.0, 1, 0.99);
    b.castShadow = true;
    m.add(b);
    for (const [x, y, z] of [
      [-0.07, -0.11, 0.222],
      [0.05, -0.15, 0.22],
      [0.11, -0.1, 0.2],
      [-0.12, -0.15, 0.19],
      [0.0, -0.09, 0.232],
    ] as const)
      m.ball(0.011, "#fbf7ef", [x, y, z], [1, 1, 0.4], 6);
    m.ball(0.04, "#c23a3a", [0.19, -0.13, -0.1], [1, 1, 1], 8);
    m.box([0.04, 0.12, 0.012], "#a82a2a", [0.19, -0.25, -0.11], 0.004).rotation.z = 0.2;
  },
  "CopenHill ski goggles": (m) => {
    visor(m, {
      color: gradientLens([
        [0, "#b04fc2"],
        [0.5, "#f5b342"],
        [1, "#b04fc2"],
      ]),
      w: 0.37,
      h: 0.11,
      y: EYE_Y - 0.005,
      depth: 0.025,
    });
    // The frame, top and bottom.
    visor(m, { color: "#2e2e3a", w: 0.37, h: 0.018, y: EYE_Y + 0.052, depth: 0.03 });
    visor(m, { color: "#2e2e3a", w: 0.37, h: 0.018, y: EYE_Y - 0.065, depth: 0.03 });
    strap(m, "#2e2e3a", EYE_Y + 0.025, 0.07);
  },
  "Rate-limit visor": (m, c) => {
    visor(m, { color: "#2e2e3a", w: 0.4, h: 0.075, y: EYE_Y, depth: 0.03 });
    const leds: THREE.Mesh[] = [];
    for (let i = 0; i < 9; i++) {
      const a = (i - 4) * 0.17;
      const led = m.box(
        [0.026, 0.026, 0.01],
        lit("#ff5a4f"),
        [Math.sin(a) * 0.272, EYE_Y - 0.013, Math.cos(a) * 0.262],
        0.004,
      );
      led.rotation.y = a;
      leds.push(led);
    }
    strap(m, "#2e2e3a", EYE_Y + 0.02, 0.05);
    c.tick((t) =>
      leds.forEach((l, i) => {
        l.scale.setScalar(Math.abs(((t * 6) % 9) - i) < 1.4 ? 1.25 : 0.7);
      }),
    );
  },
  "Viking beard": (m, c) => {
    const b = mid(m, -0.15, 0.17);
    b.ball(0.12, c.hair, [0, -0.01, 0.01], [1.1, 1.0, 0.8], 14);
    b.ball(0.075, c.hair, [0, -0.1, 0.03], [1, 1.2, 0.8], 12);
    for (const s of [-1, 1]) {
      const braid = b.part([s * 0.04, -0.15, 0.06]);
      braid.cyl(0.03, 0.1, c.hair, [0, -0.1, 0], 0.02, 8);
      braid.ball(0.017, "#f5c842", [0, -0.11, 0.0], [1, 1, 1], 8);
    }
    b.ball(0.03, tint(c.hair, -0.15), [0, 0.07, 0.06], [2.2, 0.5, 0.7], 8);
  },
  "Deal-with-it shades": (m, c) => {
    const g = m.part([0, 0, 0]);
    pixelShades(g);
    // They slide down onto the nose, slowly, and the cycle starts over.
    c.tick((t) => (g.position.y = 0.06 - Math.min(1, ((t * 0.5) % 4) / 1.2) * 0.06));
  },
  "Context window glasses": (m) => {
    for (const s of [-1, 1] as const) {
      const e = eyeAt(m, s);
      e.box([0.14, 0.095, 0.016], "#3a3f4b", [0, -0.048, 0.005], 0.006);
      e.box([0.14, 0.02, 0.018], "#fbf7ef", [0, 0.0, 0.006], 0.004);
      e.box([0.115, 0.06, 0.02], see("#cde9f6", 0.45), [0, -0.04, 0.012], 0.004);
      for (const [i, col] of ["#ff5f57", "#febc2e", "#28c840"].entries())
        e.ball(0.007, lit(col), [-0.05 + i * 0.018, 0.002, 0.018], [1, 1, 0.5], 6);
    }
    bridge(m, "#3a3f4b");
  },
  "Vision headset": (m) => {
    visor(m, { color: "#1c1a24", w: 0.4, h: 0.12, y: EYE_Y, depth: 0.05 });
    visor(m, { color: see("#8fe3ff", 0.18, true), w: 0.36, h: 0.09, y: EYE_Y, depth: 0.075 });
    m.box([0.14, 0.012, 0.01], "#ffffff", [-0.08, EYE_Y + 0.04, 0.3], 0.003).rotation.z = 0.2;
    strap(m, "#2e2e3a", EYE_Y + 0.02, 0.05);
  },
  "Bot mask": (m, c) => {
    const plate = visor(m, { color: "#8a93a1", w: 0.44, h: 0.25, y: EYE_Y - 0.04, depth: 0.04 });
    void plate;
    const eyes: THREE.Mesh[] = [];
    for (const s of [-1, 1] as const) {
      const e = eyeAt(m, s);
      e.box([0.08, 0.04, 0.02], "#3a3f4b", [0, -0.02, 0.026], 0.008);
      eyes.push(e.box([0.06, 0.025, 0.02], lit("#8fe3ff"), [0, -0.013, 0.036], 0.006));
    }
    const grille = mid(m, EYE_Y - 0.13, 0.243);
    for (let i = 0; i < 4; i++) grille.box([0.1, 0.01, 0.012], "#3a3f4b", [0, -i * 0.02, 0.0], 0.003);
    visor(m, { color: "#cfd5dd", w: 0.44, h: 0.015, y: EYE_Y + 0.085, depth: 0.045 });
    c.tick((t) => {
      for (const e of eyes) e.scale.y = Math.sin(t * 0.9) > 0.97 ? 0.2 : 1;
    });
  },
  "Laser eyes": (m, c) => {
    const beams: THREE.Mesh[] = [];
    for (const s of [-1, 1] as const) {
      const e = eyeAt(m, s);
      e.ball(0.03, lit("#fff3c4"), [0, 0, 0.03], [1, 1.2, 0.5], 10);
      e.ball(0.05, see("#ff3b30", 0.5, true), [0, 0, 0.035], [1, 1.1, 0.5], 10);
      const beam = e.cyl(0.02, 0.32, see("#ff3b30", 0.55, true), [0, 0, 0.04], 0.012, 8);
      beam.rotation.x = Math.PI / 2;
      beam.castShadow = false;
      beams.push(beam);
    }
    c.tick((t) =>
      beams.forEach((b, i) => {
        b.scale.set(
          1 + Math.sin(t * 20 + i) * 0.25,
          0.6 + Math.sin(t * 3) * 0.1 + 0.3,
          1 + Math.sin(t * 20 + i) * 0.25,
        );
      }),
    );
  },
  "Nebula visor": (m, c) => {
    const lens = gradientLens([
      [0, "#3b2a8f"],
      [0.25, "#7a6cf0"],
      [0.5, "#8fe3ff"],
      [0.75, "#7a6cf0"],
      [1, "#3b2a8f"],
    ]);
    visor(m, { color: lens, w: 0.44, h: 0.1, y: EYE_Y, depth: 0.045 });
    visor(m, { color: "#3b2a8f", w: 0.44, h: 0.014, y: EYE_Y + 0.052, depth: 0.05 });
    visor(m, { color: "#3b2a8f", w: 0.44, h: 0.014, y: EYE_Y - 0.052, depth: 0.05 });
    const glint = m.box([0.026, 0.07, 0.01], lit("#ffffff"), [0, EYE_Y - 0.004, 0.31], 0.003);
    glint.rotation.z = 0.5;
    c.tick((t) => {
      const k = (t * 0.45) % 1.6;
      glint.position.x = -0.18 + k * 0.36;
      glint.visible = k < 1.0;
    });
  },
  // Raid loot.
  "429 shades": (m) => shades(m, "#1c1a24", "#e0384f"),
  "Pane glasses": (m) => {
    for (const s of [-1, 1] as const) {
      const e = eyeAt(m, s);
      e.box([0.13, 0.085, 0.016], "#f4efe4", [0, -0.043, 0.005], 0.006);
      for (const [x, y] of [
        [-0.027, -0.02],
        [0.027, -0.02],
        [-0.027, -0.062],
        [0.027, -0.062],
      ] as const)
        e.box([0.05, 0.035, 0.02], see("#8fd3ff", 0.7), [x, y - 0.0, 0.012], 0.003);
    }
    bridge(m, "#f4efe4");
  },
  "Third eye": (m, c) => {
    const e = mid(m, 0.08, 0.246);
    e.ball(0.05, "#fbf7ef", [0, 0, -0.01], [1.4, 0.8, 0.4], 12);
    const iris = e.ball(0.026, "#b57cff", [0, 0, 0.012], [1, 1, 0.5], 10);
    e.ball(0.012, "#3a1f6b", [0, 0, 0.02], [1, 1, 0.5], 8);
    e.ball(0.006, "#ffffff", [0.008, 0.008, 0.026], [1, 1, 0.5], 6);
    c.tick((t) => (iris.position.x = Math.sin(t * 1.3) * 0.012));
  },
  "Fine-print specs": (m) => {
    const frame = "#3a3f4b";
    for (const s of [-1, 1] as const) {
      const e = eyeAt(m, s);
      // Half-moon lenses: a flat top, stepping in towards a rounded bottom.
      e.box([0.145, 0.014, 0.022], frame, [0, -0.007, 0.006], 0.004);
      e.box([0.14, 0.03, 0.018], frame, [0, -0.031, 0.005], 0.006);
      e.box([0.11, 0.024, 0.018], frame, [0, -0.058, 0.005], 0.006);
      e.box([0.07, 0.014, 0.018], frame, [0, -0.077, 0.005], 0.004);
      e.box([0.118, 0.026, 0.02], see("#fff6c9", 0.92), [0, -0.031, 0.012], 0.004);
      e.box([0.09, 0.02, 0.02], see("#fff6c9", 0.92), [0, -0.057, 0.012], 0.004);
      e.box([0.05, 0.01, 0.02], see("#fff6c9", 0.92), [0, -0.075, 0.012], 0.003);
      // A line of tiny print.
      e.box([0.056, 0.006, 0.01], "#7a7466", [0, -0.028, 0.024], 0.002);
      e.box([0.036, 0.006, 0.01], "#7a7466", [-0.01, -0.04, 0.024], 0.002);
    }
    bridge(m, frame);
  },
  // The traveling merchant's editions.
  "VR visor": (m) => {
    visor(m, { color: "#3a3546", w: 0.42, h: 0.13, y: EYE_Y, depth: 0.05 });
    visor(m, { color: "#5b3fbf", w: 0.4, h: 0.012, y: EYE_Y + 0.05, depth: 0.052 });
    m.box([0.1, 0.012, 0.01], lit("#8fe3ff"), [-0.1, EYE_Y + 0.02, 0.305], 0.003).rotation.z = 0.2;
    strap(m, "#2b2433", EYE_Y + 0.02, 0.06);
  },
  "Pricing-page monocle": (m) => monocle(m, "#f5c842", "#c9971f", true),
  "3D diff specs": (m) => {
    const cols = ["#e8584f", "#58d3e8"];
    ([-1, 1] as const).forEach((s, i) => {
      const e = eyeAt(m, s);
      e.box([0.135, 0.085, 0.016], "#fbf7ef", [0, -0.043, 0.005], 0.008);
      e.box([0.11, 0.06, 0.02], see(cols[i]!, 0.75), [0, -0.031, 0.014], 0.006);
      sign(
        e,
        0.05,
        0.05,
        (g, w, h) => letters(g, i ? "+" : "-", w / 2, h / 2, h * 1.1, "#fbf7ef"),
        [0, -0.031, 0.026],
        60,
      );
    });
    bridge(m, "#fbf7ef");
  },
  "Deal-with-it pixels": (m, c) => {
    const g = m.part([0, 0, 0]);
    pixelShades(g);
    c.tick((t) => (g.position.y = 0.05 - Math.min(1, ((t * 0.4) % 5) / 1.5) * 0.05));
  },
  "Five-star shades": (m) => starLens(m, "#14121a", "#f5c842", "five"),
  "Code-review laser visor": (m, c) => {
    visor(m, { color: "#5d6470", w: 0.4, h: 0.06, y: EYE_Y, depth: 0.03 });
    const beam = m.box([0.03, 0.05, 0.012], lit("#e0584f"), [0, EYE_Y - 0.025, 0.268], 0.004);
    const trail = m.box([0.09, 0.02, 0.01], see("#ffb3a8", 0.5, true), [0, EYE_Y - 0.015, 0.266], 0.004);
    strap(m, "#5d6470", EYE_Y + 0.02, 0.05);
    c.tick((t) => {
      const k = (t * 1.1) % 2;
      const a = ((k < 1 ? k : 2 - k) - 0.5) * 1.5;
      for (const o of [beam, trail]) {
        o.position.x = Math.sin(a) * 0.272;
        o.position.z = Math.cos(a) * 0.262;
        o.rotation.y = a;
      }
    });
  },
  // The Night Market case.
  "LED mask": (m, c) => {
    visor(m, { color: "#1b1826", w: 0.36, h: 0.11, y: EYE_Y, depth: 0.04 });
    strap(m, "#1b1826", EYE_Y + 0.02, 0.06);
    // A 24 by 6 dot screen, a grin and a wink taking turns.
    const z = isVox(m) ? 0.256 : 0.277;
    const dots = (eye: boolean) => (g: CanvasRenderingContext2D, w: number, h: number) => {
      const cell = w / 24;
      const dot = (x: number, y: number, col: string) => {
        g.fillStyle = col;
        g.fillRect(x * cell + cell * 0.1, y * cell + cell * 0.1, cell * 0.8, cell * 0.8);
      };
      for (const x of [5, 6, 17, 18])
        for (const y of [1, 2]) if (eye || x < 10 || y === 1) dot(x, y, "#4ff3ff");
      for (const x of [8, 9, 10, 11, 12, 13, 14, 15]) dot(x, 4, "#ff4fd8");
      dot(7, 3, "#ff4fd8");
      dot(16, 3, "#ff4fd8");
      void h;
    };
    const frames = [true, false].map((e) => {
      const s = sign(m, 0.3, 0.075, dots(e), [0, EYE_Y, z], 80, true);
      s.visible = e;
      return s;
    });
    c.tick((t) => {
      const wink = Math.floor(t * 0.6) % 4 === 3;
      frames[0]!.visible = !wink;
      frames[1]!.visible = wink;
    });
  },
  "Steam goggles": (m) => {
    // Chunky brass rims round amber lenses, on a leather strap, with a little filter canister each.
    strap(m, "#5a3b22", EYE_Y, 0.045);
    for (const s of [-1, 1] as const) {
      const e = eyeAt(m, s);
      roundLens(e, "#c98a3a", "#ffc24a", 0.064, 0.7);
      ring(e, "#a86e2a", 0.075, 0.016, [0, 0, 0.004], false);
      e.cyl(0.02, 0.05, "#8a5a2b", [s * 0.045, 0.06, 0.0], 0.02, 8);
      for (const a of [0.8, 2.4, 4.0, 5.5])
        e.ball(0.007, "#f0c45a", [Math.sin(a) * 0.075, Math.cos(a) * 0.075, 0.014], [1, 1, 1], 4);
    }
    m.box([0.06, 0.02, 0.02], "#c98a3a", [0, EYE_Y, 0.246], 0.006);
  },
  "Holo shades": (m, c) => {
    // Sharp wedge frames; the lenses shift from cyan to magenta across the glass, with a bright glint.
    const strips = ["#58f0ff", "#9a9cff", "#c45cff"];
    const lenses: THREE.Mesh[] = [];
    for (const s of [-1, 1] as const) {
      const e = eyeAt(m, s);
      e.box([0.145, 0.016, 0.02], "#1b1826", [0, 0.002, 0.006], 0.006);
      e.box([0.14, 0.012, 0.02], "#1b1826", [0, -0.09, 0.006], 0.004);
      for (const x of [-1, 1]) e.box([0.012, 0.09, 0.02], "#1b1826", [x * 0.07, -0.043, 0.006], 0.004);
      strips.forEach((col, i) => {
        const k = (i - 1) * s * -1;
        lenses.push(e.box([0.04, 0.076, 0.016], see(col, 0.88, true), [k * 0.046, -0.043, 0.012], 0.004));
      });
      tilt(e, e.box([0.012, 0.07, 0.01], "#ffffff", [-0.02 * s, -0.045, 0.024], 0.002), 0, 0, 0.5);
    }
    m.box([0.05, 0.014, 0.02], "#1b1826", [0, EYE_Y, 0.245], 0.006);
    bridge(m, "#1b1826");
    c.tick((t) => {
      lenses.forEach((l, i) => {
        (l.material as THREE.Material).opacity = 0.78 + Math.sin(t * 1.6 + i * 0.9) * 0.12;
      });
    });
  },
  // The Nusantara case.
  "Kawung specs": (m) => {
    // Round dark-brown frames with the kawung motif (four cream ovals round a centre) set into each rim.
    for (const s of [-1, 1] as const) {
      const e = eyeAt(m, s);
      roundLens(e, "#4a2f1c", "#f6efd9", 0.066, 0.3);
      ring(e, "#6b4226", 0.078, 0.013, [0, 0, 0.002], false);
      // Four ovals, N E S W, each standing out from the centre along its own axis.
      for (const [dx, dy, w, h] of [
        [0, 0.08, 0.02, 0.04],
        [0, -0.08, 0.02, 0.04],
        [0.08, 0, 0.04, 0.02],
        [-0.08, 0, 0.04, 0.02],
      ] as const)
        e.box([w, h, 0.014], "#f1e3c2", [dx - (w / 2) * 0, dy - h / 2, 0.008], 0.004);
    }
    m.box([0.05, 0.016, 0.02], "#4a2f1c", [0, EYE_Y, 0.246], 0.005);
    bridge(m, "#4a2f1c");
  },
  "Coconut shades": (m) => {
    // Half a coconut over each eye: hairy brown shells, a cream rim, and a dark slit to look out of.
    for (const s of [-1, 1] as const) {
      const e = eyeAt(m, s);
      const d = e.part([0, 0, 0.004]);
      d.rotation.x = Math.PI / 2;
      dome(d, "#6a4423", 0.086, 0, 0.5, 12);
      ring(e, "#f1e3c2", 0.082, 0.011, [0, 0, 0.006], false);
      e.box([0.1, 0.015, 0.012], "#15110d", [0, -0.008, 0.09], 0.003);
      // Fibres.
      for (const [x, y] of [
        [-0.04, 0.04],
        [0.03, 0.055],
        [0.05, -0.02],
        [-0.045, -0.04],
      ] as const)
        e.box([0.012, 0.028, 0.012], "#8a5c32", [x, y, 0.07], 0.003);
    }
    m.box([0.06, 0.016, 0.02], "#5a3a1c", [0, EYE_Y, 0.246], 0.006);
    bridge(m, "#5a3a1c");
  },
  "Wayang eyes": (m) => {
    // Almond eyes cut from leather: slanted black almonds with a gold outline, the pupil always looking sideways.
    for (const s of [-1, 1] as const) {
      const e = eyeAt(m, s);
      sign(
        e,
        0.21,
        0.11,
        (g, w, h) => {
          const X = (x: number) => (s > 0 ? x : 1 - x) * w;
          const almond = (inset: number) => {
            g.beginPath();
            g.moveTo(X(0.02 + inset), h * (0.66 - inset * 0.2));
            g.quadraticCurveTo(X(0.42), h * (0.0 + inset), X(0.99 - inset), h * (0.28 + inset * 0.3));
            g.quadraticCurveTo(X(0.55), h * (1.0 - inset), X(0.02 + inset), h * (0.66 - inset * 0.2));
            g.closePath();
          };
          g.fillStyle = "#e8b23a";
          almond(0);
          g.fill();
          g.fillStyle = "#0e0c10";
          almond(0.16);
          g.fill();
          // The pupil: a gold dot at the outer end, looking sideways.
          g.fillStyle = "#f2c24a";
          g.beginPath();
          g.arc(X(0.72), h * 0.45, h * 0.15, 0, Math.PI * 2);
          g.fill();
        },
        [0, -0.012, 0.012],
        120,
      );
    }
    m.box([0.05, 0.014, 0.02], "#0e0c10", [0, EYE_Y, 0.246], 0.005);
    bridge(m, "#0e0c10");
  },
};

/** Hats that cover the crown of the head: the hair's fringe, spikes and bun are tucked under them. */
export const COVERS_HAIR = new Set([
  "Beanie",
  "Top hat",
  "Tinfoil hat",
  "Ship-it party hat",
  "Danish flag cap",
  "Cykelhjelm",
  "Prod hard hat",
  "Julehue",
  "Whirlybird beanie",
  "Prompt chef toque",
  "Cowboy coder hat",
  "Smørrebrød hat",
  "PhD mortarboard",
  "Viking helmet",
  "Pirate tricorn",
  "Archmage hat",
  "Prompt wizard hat",
  "Release party hat",
  "Propeller beanie",
  "Spaghetti chef's toque",
  "Friday deploy stetson",
  "Force-push helm",
  "Cache-hit mushroom",
  "Borrowed-token tricorn",
  "Jack-o'-lantern",
  "429 bucket hat",
  "Copenhagen ushanka",
  "Rubber-duck hat",
  "Lego brick hat",
  "Hourglass hat",
  "Paid in Full crown",
  "Straw kasa",
  "Fox half-mask",
  "Blangkon",
  "Peci",
  "Ojek helmet",
  "Little Bromo",
  "Kattekonge crown",
]);
