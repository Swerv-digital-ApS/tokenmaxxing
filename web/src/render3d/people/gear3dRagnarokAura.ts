/**
 * The Ragnarok Eve case's four legendary auras in 3D (`core/src/case-ragnarok.ts`, slot "aura"): Bifröst, Valkyrie
 * Lights, Rune Gale and Ginnungagap. Like Night Market's (`gear3dAura.ts`) each builder gets a frame at the middle of
 * the body, scaled to the avatar's height (one unit is one metre of a 0.95 m person), and registers a tick that moves
 * its parts. Loaded by `gear3dRagnarok.ts`; the 2D art is in `art/case-ragnarok-aura.ts`.
 *
 * Sensitivity (docs/cases/ragnarok-eve.md): Rune Gale is a loose stream of single glyphs from the safe set only,
 * climbing in a helix at different heights and radii. It is never a wheel, never a ring of runes and never twelve of
 * them, and none of Sowilo, Othala, Tyr or Algiz is among them. The aurora is Norse-pop, nothing Sámi.
 */
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { seeded } from "../kit/kit.ts";
import { AURA_BUILDERS } from "./gear3dAura.ts";

const CUBE = new THREE.BoxGeometry(1, 1, 1);

/** Materials every wearer shares: one per colour (and opacity), never disposed with a model. */
const shared = new Map<string, THREE.Material>();
function basic(
  color: string,
  opacity = 1,
  extra: Partial<THREE.MeshBasicMaterialParameters> = {},
): THREE.Material {
  const key = `${color}/${opacity}/${Object.keys(extra).join()}`;
  let m = shared.get(key);
  if (!m) {
    m = new THREE.MeshBasicMaterial({
      color,
      transparent: opacity < 1,
      opacity,
      depthWrite: opacity >= 1,
      ...extra,
    });
    m.userData.shared = true;
    shared.set(key, m);
  }
  return m;
}

/** A cube of `w`×`h`×`d` metres that moves and scales and stays out of the blocky swap. */
function cube(
  parent: THREE.Object3D,
  size: [number, number, number],
  mat: THREE.Material,
  at?: [number, number, number],
): THREE.Mesh {
  const o = new THREE.Mesh(CUBE, mat);
  o.scale.set(...size);
  o.userData.noBlock = true;
  if (at) o.position.set(...at);
  parent.add(o);
  return o;
}

const smooth = (a: number, b: number, x: number) => {
  const k = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return k * k * (3 - 2 * k);
};

// MARK: Bifröst

const RAINBOW = ["#ff4b4b", "#ff9a3c", "#ffe14a", "#5af0a0", "#4aa8ff", "#9a7cff"];

/** One band of the rainbow: boxes along an arc of `sweep` radians at radius `r`, thinning to the ends, merged to one mesh. */
function band(r: number, sweep: number, size: number): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const n = 30;
  for (let i = 0; i < n; i++) {
    const k = i / (n - 1);
    const a = -sweep / 2 + k * sweep;
    const s = size * (0.35 + 0.65 * Math.sin(k * Math.PI) ** 0.6);
    const g = new THREE.BoxGeometry((sweep * r) / n + 0.012, s, s * 1.15).toNonIndexed();
    g.rotateY(-a);
    g.translate(Math.sin(a) * r, 0, Math.cos(a) * r);
    parts.push(g);
  }
  const out = mergeGeometries(parts)!;
  for (const p of parts) p.dispose();
  return out;
}

// Bifröst: a rainbow ribbon of six bands curls round the shoulders on a tilt, turning slowly, with embers lifting off it.
AURA_BUILDERS["Bifröst"] = (m, tick) => {
  const tilt = new THREE.Group();
  tilt.rotation.set(0.5, 0, 0.28);
  tilt.position.y = 0.12;
  m.add(tilt);
  const arc = new THREE.Group();
  tilt.add(arc);
  RAINBOW.forEach((c, i) => {
    const mesh = new THREE.Mesh(band(0.4 + i * 0.026, Math.PI * 1.35, 0.028), basic(c));
    mesh.userData.noBlock = true;
    arc.add(mesh);
  });
  // Glints that run along the ribbon.
  const glints = Array.from({ length: 5 }, () => cube(arc, [0.04, 0.04, 0.04], basic("#ffffff")));
  // Embers lifting off it (the bridge burns).
  const rnd = seeded(500);
  const embers = Array.from({ length: 8 }, () => ({
    o: cube(m, [0.026, 0.026, 0.026], basic(rnd() > 0.5 ? "#ff9a3c" : "#ffd36a")),
    a: rnd() * Math.PI * 2,
    p: rnd(),
    r: 0.38 + rnd() * 0.12,
  }));
  tick((t, walking) => {
    arc.rotation.y = t * (walking ? 0.9 : 0.55);
    tilt.position.y = 0.12 + Math.sin(t * 1.3) * 0.02;
    glints.forEach((g, i) => {
      const k = (t * 0.28 + i / glints.length) % 1;
      const a = -Math.PI * 0.675 + k * Math.PI * 1.35;
      const r = 0.4 + (i % RAINBOW.length) * 0.026;
      g.position.set(Math.sin(a) * r, 0, Math.cos(a) * r);
      g.scale.setScalar(0.03 + Math.sin(k * Math.PI) * 0.035);
    });
    for (const e of embers) {
      const k = (t * 0.22 + e.p) % 1;
      const a = e.a + arc.rotation.y;
      e.o.position.set(Math.sin(a) * e.r, 0.1 + k * 0.5, Math.cos(a) * e.r);
      e.o.scale.setScalar(Math.sin(k * Math.PI) * 0.032 + 0.001);
    }
  });
};

// MARK: Valkyrie Lights

// Valkyrie Lights: curtains of aurora, green at the foot and violet at the top, rippling up behind and round.
AURA_BUILDERS["Valkyrie Lights"] = (m, tick) => {
  const geo = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
  const pos = geo.getAttribute("position");
  const colours = new Float32Array(pos.count * 3);
  const foot = new THREE.Color("#5af0a0");
  const mid = new THREE.Color("#3fd6c8");
  const top = new THREE.Color("#9a7cff");
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    if (y < 0.5) c.copy(foot).lerp(mid, y * 2);
    else c.copy(mid).lerp(top, (y - 0.5) * 2);
    colours.set([c.r, c.g, c.b], i * 3);
  }
  geo.setAttribute("color", new THREE.BufferAttribute(colours, 3));
  const mats = [0.62, 0.42].map((o) => {
    const mt = new THREE.MeshBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: o,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    mt.userData.shared = true;
    return mt;
  });
  const sheets = [0, 1].flatMap((layer) =>
    Array.from({ length: 13 }, (_, i) => {
      const o = new THREE.Mesh(geo, mats[layer]!);
      o.userData.noBlock = true;
      m.add(o);
      return { o, i, layer };
    }),
  );
  const rnd = seeded(501);
  const specks = Array.from({ length: 9 }, () => ({
    o: cube(m, [0.022, 0.022, 0.022], basic("#e8fff3")),
    a: (rnd() - 0.5) * 3.2,
    p: rnd(),
    r: 0.5 + rnd() * 0.14,
  }));
  tick((t, walking) => {
    const speed = walking ? 1.8 : 1;
    for (const s of sheets) {
      // Spread behind (+π) and round to both sides; the second layer sits further out and a little offset.
      const a = Math.PI + ((s.i / 12) * 2 - 1) * 1.75 + (s.layer ? 0.12 : 0);
      const r = 0.5 + s.layer * 0.12 + Math.sin(t * 0.8 * speed + s.i * 0.9) * 0.03;
      const wave =
        Math.sin(t * 1.3 * speed + s.i * 0.7 + s.layer * 2) * 0.5 +
        Math.sin(t * 2.3 * speed + s.i * 1.9) * 0.2;
      const h = 0.55 + 0.32 * wave + (1 - Math.abs((s.i / 12) * 2 - 1)) * 0.18;
      s.o.position.set(Math.sin(a) * r, -0.42 + Math.max(0, wave) * 0.06, Math.cos(a) * r);
      s.o.rotation.y = a;
      s.o.scale.set(0.115, h, 0.014);
    }
    for (const sp of specks) {
      const k = (t * 0.18 * speed + sp.p) % 1;
      const a = Math.PI + sp.a;
      sp.o.position.set(Math.sin(a) * sp.r, -0.35 + k * 0.95, Math.cos(a) * sp.r);
      sp.o.scale.setScalar(Math.sin(k * Math.PI) * 0.03 + 0.001);
    }
  });
};

// MARK: Rune Gale

/** Strokes of the safe Elder Futhark glyphs on a 0..1 square (y down). Never Sowilo, Othala, Tyr or Algiz. */
const GLYPHS: Record<string, [number, number][][]> = {
  // Fehu
  fehu: [
    [
      [0.3, 0.02],
      [0.3, 0.98],
    ],
    [
      [0.3, 0.38],
      [0.76, 0.1],
    ],
    [
      [0.3, 0.64],
      [0.76, 0.36],
    ],
  ],
  // Uruz
  uruz: [
    [
      [0.26, 0.98],
      [0.26, 0.02],
      [0.72, 0.3],
      [0.72, 0.98],
    ],
  ],
  // Thurisaz
  thurisaz: [
    [
      [0.3, 0.02],
      [0.3, 0.98],
    ],
    [
      [0.3, 0.26],
      [0.74, 0.5],
      [0.3, 0.74],
    ],
  ],
  // Ansuz
  ansuz: [
    [
      [0.3, 0.02],
      [0.3, 0.98],
    ],
    [
      [0.3, 0.12],
      [0.76, 0.4],
    ],
    [
      [0.3, 0.42],
      [0.76, 0.7],
    ],
  ],
  // Raidho
  raidho: [
    [
      [0.3, 0.02],
      [0.3, 0.98],
    ],
    [
      [0.3, 0.06],
      [0.72, 0.3],
      [0.3, 0.54],
    ],
    [
      [0.3, 0.54],
      [0.76, 0.98],
    ],
  ],
  // Kaunan
  kaunan: [
    [
      [0.72, 0.14],
      [0.3, 0.5],
      [0.72, 0.86],
    ],
  ],
  // Gebo
  gebo: [
    [
      [0.18, 0.1],
      [0.82, 0.9],
    ],
    [
      [0.82, 0.1],
      [0.18, 0.9],
    ],
  ],
  // Wunjo
  wunjo: [
    [
      [0.3, 0.02],
      [0.3, 0.98],
    ],
    [
      [0.3, 0.06],
      [0.72, 0.3],
      [0.3, 0.54],
    ],
  ],
  // Laguz
  laguz: [
    [
      [0.3, 0.02],
      [0.3, 0.98],
    ],
    [
      [0.3, 0.06],
      [0.74, 0.42],
    ],
  ],
};
const GLYPH_NAMES = Object.keys(GLYPHS);
const glyphTextures = new Map<string, THREE.Texture>();
function glyphTexture(name: string): THREE.Texture {
  let t = glyphTextures.get(name);
  if (t) return t;
  const c = document.createElement("canvas");
  c.width = c.height = 32;
  const g = c.getContext("2d")!;
  g.strokeStyle = "#ffffff";
  g.lineWidth = 5;
  g.lineCap = "square";
  g.lineJoin = "miter";
  for (const stroke of GLYPHS[name]!) {
    g.beginPath();
    stroke.forEach(([x, y], i) => {
      if (i) g.lineTo(2 + x * 28, 2 + y * 28);
      else g.moveTo(2 + x * 28, 2 + y * 28);
    });
    g.stroke();
  }
  t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.magFilter = t.minFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  t.userData.shared = true;
  glyphTextures.set(name, t);
  return t;
}

// Rune Gale: nine single glyphs climb in a loose helix round the wearer in an amber and white wind, at different radii
// and heights, with streaks of wind between them. A stream, not a wheel.
AURA_BUILDERS["Rune Gale"] = (m, tick) => {
  const plane = new THREE.PlaneGeometry(1, 1);
  const rnd = seeded(502);
  const glyphs = GLYPH_NAMES.map((name, i) => {
    const mat = new THREE.MeshBasicMaterial({
      map: glyphTexture(name),
      color: i % 2 ? "#fff6dc" : "#ffb347",
      transparent: true,
      alphaTest: 0.4,
      side: THREE.DoubleSide,
    });
    mat.userData.shared = true;
    const o = new THREE.Mesh(plane, mat);
    o.userData.noBlock = true;
    m.add(o);
    return {
      o,
      p: i / GLYPH_NAMES.length + (rnd() - 0.5) * 0.04,
      r: 0.36 + rnd() * 0.16,
      s: 0.9 + rnd() * 0.3,
    };
  });
  const streaks = Array.from({ length: 9 }, (_, i) => ({
    o: cube(m, [0.2, 0.012, 0.012], basic(i % 2 ? "#fff6dc" : "#ffb347")),
    p: rnd(),
    r: 0.3 + rnd() * 0.22,
    a: rnd() * Math.PI * 2,
    s: 0.8 + rnd() * 0.6,
  }));
  tick((t, walking) => {
    const w = walking ? 1.5 : 1;
    for (const g of glyphs) {
      const k = (t * 0.085 * w + g.p) % 1;
      // Up from the feet to over the head along a helix that tightens and loosens, fading in and out at the ends.
      const a = k * Math.PI * 5.4 + g.p * 6;
      const r = g.r + Math.sin(k * 9 + g.p * 12) * 0.04;
      g.o.position.set(Math.sin(a) * r, -0.5 + k * 1.12, Math.cos(a) * r);
      g.o.rotation.y = a;
      const sz = 0.17 * g.s * Math.min(smooth(0, 0.1, k), 1 - smooth(0.88, 1, k));
      g.o.scale.setScalar(Math.max(0.001, sz));
    }
    for (const s of streaks) {
      const k = (t * 0.11 * s.s * w + s.p) % 1;
      const a = s.a + t * 1.7 * s.s * w;
      s.o.position.set(Math.sin(a) * s.r, -0.45 + k * 1.0, Math.cos(a) * s.r);
      s.o.rotation.y = a;
      s.o.scale.set(0.04 + Math.sin(k * Math.PI) * 0.1, 0.01, 0.01);
    }
  });
};

// MARK: Ginnungagap

// Ginnungagap: pale snow drifts down the left of the wearer and orange embers rise up the right; at the head the two
// meet and wind round each other in a spiral.
AURA_BUILDERS["Ginnungagap"] = (m, tick) => {
  const rnd = seeded(503);
  const snow = Array.from({ length: 22 }, (_, i) => ({
    o: cube(m, [0.03, 0.03, 0.03], basic(i % 3 ? "#f2faff" : "#cfe8f2")),
    p: i / 22 + (rnd() - 0.5) * 0.03,
    r: 0.3 + rnd() * 0.1,
    q: rnd() * 6,
  }));
  const embers = Array.from({ length: 22 }, (_, i) => ({
    o: cube(m, [0.03, 0.03, 0.03], basic(["#ff9a3c", "#ffd36a", "#ff6a2a"][i % 3]!)),
    p: i / 22 + (rnd() - 0.5) * 0.03,
    r: 0.3 + rnd() * 0.1,
    q: rnd() * 6,
  }));
  // The knot at the head where they meet.
  const knot = Array.from({ length: 6 }, (_, i) => ({
    o: cube(m, [0.026, 0.026, 0.026], basic(i % 2 ? "#ffd36a" : "#f2faff")),
    i,
  }));
  const TOP = 0.52;
  tick((t, walking) => {
    const w = walking ? 1.5 : 1;
    for (const s of snow) {
      const k = (t * 0.1 * w + s.p) % 1;
      // From the head down: a tight spiral that opens out and settles to the left.
      const open = smooth(0.05, 0.5, k);
      const a = k * 11 + s.q;
      const rr = 0.1 + (s.r - 0.1) * open;
      const x0 = Math.cos(a) * rr;
      const x = x0 + (-Math.abs(x0) - 0.02 - x0) * smooth(0.15, 0.45, k);
      s.o.position.set(x, TOP - k * 1.0 + Math.sin(a * 0.7) * 0.01, Math.sin(a) * rr);
      s.o.scale.setScalar(0.001 + Math.min(smooth(0, 0.06, k), 1 - smooth(0.9, 1, k)) * 0.046);
      s.o.rotation.set(t + s.q, t * 0.7, 0);
    }
    for (const e of embers) {
      const k = (t * 0.1 * w + e.p) % 1;
      // From the feet up: they rise on the right and wind in to the head.
      const close = smooth(0.55, 0.95, k);
      const a = k * 11 + e.q;
      const rr = e.r + (0.1 - e.r) * close;
      const x0 = Math.cos(a) * rr;
      const x = x0 + (Math.abs(x0) + 0.02 - x0) * (1 - smooth(0.6, 0.9, k));
      e.o.position.set(x, -0.5 + k * (TOP + 0.5) + Math.sin(a * 0.7) * 0.01, Math.sin(a) * rr);
      e.o.scale.setScalar(0.001 + Math.min(smooth(0, 0.06, k), 1 - smooth(0.92, 1, k)) * 0.046);
      e.o.rotation.set(t * 1.3 + e.q, t, 0);
    }
    for (const n of knot) {
      const a = t * 3.2 + (n.i / knot.length) * Math.PI * 2;
      const lift = Math.sin(t * 2 + n.i) * 0.02;
      n.o.position.set(Math.cos(a) * 0.1, TOP + lift + (n.i % 2) * 0.03, Math.sin(a) * 0.1);
      n.o.scale.setScalar(0.022 + 0.01 * Math.sin(t * 5 + n.i));
    }
  });
};
