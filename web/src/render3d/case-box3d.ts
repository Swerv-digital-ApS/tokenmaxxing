/**
 * The cases and their keys in 3D (voxel/low-poly, built with the furniture kit like `night3d.ts`): the Night Market's
 * lacquered crate and coin, and the Nusantara's teak sea chest and brass anchor key.
 *
 *   (each takes an optional case id last: "night-market" by default, or "nusantara" / "ragnarok-eve" for those cases' own chest and key)
 *   buildCaseBox(false)  // Model: the case, lid down, bottom centre at the origin, front along +z (~0.9 x 0.8 x 0.6)
 *   buildCaseBox(true)   // the same case, lid up, warm light spilling out (the Nusantara's: daylight and jasmine petals)
 *   buildCaseKey()       // Model: the market token on its tassel, hanging with its lowest point at y = 0
 *   buildCaseBox(open, "nusantara") / buildCaseKey("nusantara")   // the same, for the other case (`CaseDef.id`)
 *
 * Each model animates itself: the lantern glow pulses (the case), the token spins slowly (the key), the tag
 * swings (the Nusantara's sail and sun pulse, the petals drift, the key turns on its ribbon). The animation is registered in the kit's `ticks` (so the world's loop and a scene that runs
 * `ticks` drive it), and is also exposed as `animateCaseModel(model, seconds)` for a UI that has its own loop.
 * Either is idempotent in absolute time; calling both is harmless.
 *
 * Icons: `caseBoxIcon("closed" | "open" | "key", 64 | 128, caseId?)` returns { promise, cancel } like `requestIcon`
 * (it asks `render3d/icons.ts` for `{ kind: "case", what, caseId }`; use it only on the 3D tiers, after
 * `iconsAvailable()`). Remember to dispose a model you build and keep (`disposeObject` from engine/dispose.ts).
 */
import * as THREE from "three";
import { C } from "../art/palette.ts";
import { buildNorseBox, buildNorseKey } from "./case-box3d-norse.ts";
import type { IconSize } from "./icons.ts";
import { canvasTexture, glow, Model, painted, ticks, tint, toon } from "./kit/kit.ts";

export type CaseIcon = "closed" | "open" | "key";
/** `CaseDef.id` of the cases that have their own 3D box and key; anything else draws the Night Market's. */
export type CaseModelId = "night-market" | "nusantara" | "ragnarok-eve";

/** The case whose art is drawn when none is asked for (`CaseDef.id` in core/src/cases.ts). */
export const DEFAULT_CASE_ID = "night-market";

const PLUM = "#3d1a52";
const PLUM_DARK = "#2a1139";
const WINE = "#6e2260";
const CRIMSON = "#a82840";
const CRIMSON_LIGHT = "#d8402f";
const LACQUER = "#23202b";
const GOLD = "#e9b73d";
const GOLD_DARK = "#b8860b";
const GOLD_LIGHT = "#ffd36a";
const PAPER = "#fff1c9";
const ORANGE = "#f08a3c";
const RED = "#d8402f";
const RED_DARK = "#a42a22";

const W = 0.9;
const D = 0.6;
const BODY_H = 0.46;
const LID_H = 0.2;

type Animator = (t: number) => void;
const animators = new WeakMap<THREE.Object3D, Animator>();

/** Runs a case or key model's own animation at absolute time `t` (seconds). Safe to call every frame. */
export function animateCaseModel(model: THREE.Object3D, t: number): void {
  animators.get(model)?.(t);
}

const register = (m: Model, fn: Animator): void => {
  animators.set(m, fn);
  ticks.push(fn);
};

/** A lit paper lantern emblem on the front, facing +z, centred at (0, y, z). Returns the pieces that pulse. */
function lanternEmblem(m: Model, y: number, z: number, lit: THREE.MeshBasicMaterial): void {
  m.box([0.34, 0.34, 0.02], LACQUER, [0, y - 0.17, z], 0.01);
  m.box([0.34, 0.02, 0.026], GOLD, [0, y + 0.15, z], 0.004);
  const cy = y;
  m.cyl(0.05, 0.03, GOLD, [0, cy - 0.04, z + 0.03], 0.04, 8);
  m.ball(0.1, lit, [0, cy - 0.15, z + 0.045], [1, 1.15, 0.45], 14);
  for (const dy of [-0.06, 0.06])
    m.box([0.2, 0.012, 0.012], ORANGE, [0, cy - 0.15 + dy * 1.15, z + 0.082], 0.002);
  m.cyl(0.05, 0.022, GOLD, [0, cy - 0.285, z + 0.03], 0.05, 8);
  m.cyl(0.01, 0.045, RED, [0, cy - 0.33, z + 0.03], 0.01, 5);
}

/** Gold corner caps and two straps round a box of `w`x`h`x`d` whose bottom is at y0. */
function straps(m: Model, w: number, h: number, d: number, y0: number): void {
  for (const x of [-1, 1]) {
    m.box([0.07, h + 0.02, d + 0.02], GOLD, [x * (w / 2 - 0.1), y0 - 0.01, 0], 0.012);
    m.box([0.02, h + 0.02, d + 0.03], GOLD_LIGHT, [x * (w / 2 - 0.1) - 0.025, y0 - 0.01, 0], 0.004);
  }
}

function nightMarketBox(open: boolean): Model {
  const m = new Model();
  const lit = glow("#ffd36a");
  // A foot and the two-tone lacquer: plum below, crimson under the lid, a wine band between.
  m.box([W + 0.04, 0.05, D + 0.04], PLUM_DARK, [0, 0, 0], 0.012);
  m.box([W, BODY_H - 0.05, D], PLUM, [0, 0.05, 0], 0.03);
  m.box([W + 0.004, 0.14, D + 0.004], WINE, [0, 0.05 + 0.13, 0], 0.03);
  m.box([W + 0.008, 0.12, D + 0.008], CRIMSON, [0, BODY_H - 0.12, 0], 0.03);
  m.box([0.2, 0.025, 0.01], CRIMSON_LIGHT, [-0.28, BODY_H - 0.06, D / 2 + 0.006], 0.004);
  straps(m, W, BODY_H - 0.02, D, 0.02);
  lanternEmblem(m, BODY_H - 0.1, D / 2 + 0.002, lit);
  // Gold lip round the mouth.
  m.box([W + 0.05, 0.03, D + 0.05], GOLD, [0, BODY_H, 0], 0.01);
  // The hanging tag, from the right strap: swings a little.
  const tag = m.part([W / 2 - 0.1, BODY_H - 0.12, D / 2 + 0.03]);
  tag.cyl(0.006, 0.07, GOLD_DARK, [0, -0.07, 0], 0.006, 4);
  tag.box([0.1, 0.14, 0.015], PAPER, [0, -0.21, 0.004], 0.004);
  tag.ball(0.022, RED, [0, -0.17, 0.016], [1, 1, 0.3], 8);
  tag.box([0.05, 0.012, 0.004], C.ink, [0, -0.23, 0.014], 0.001);

  // The lid, hinged along the back top edge.
  const hinge = m.part([0, BODY_H + 0.03, -D / 2]);
  const lid = hinge.part([0, 0, D / 2]);
  lid.box([W + 0.06, LID_H, D + 0.06], WINE, [0, 0, 0], 0.04);
  lid.box([W + 0.062, LID_H * 0.5, D + 0.062], "#8a2450", [0, LID_H * 0.5, 0], 0.04);
  lid.box([W - 0.06, 0.03, D - 0.06], CRIMSON, [0, LID_H, 0], 0.02);
  lid.box([0.5, 0.012, 0.03], CRIMSON_LIGHT, [-0.1, LID_H + 0.03, D / 2 - 0.1], 0.004);
  lid.box([W + 0.07, 0.03, D + 0.07], GOLD, [0, 0, 0], 0.01);
  for (const x of [-1, 1]) lid.box([0.07, LID_H + 0.03, D + 0.08], GOLD, [x * (W / 2 - 0.1), 0, 0], 0.012);
  // Clasp.
  lid.box([0.1, 0.1, 0.02], GOLD, [0, 0.03, D / 2 + 0.04], 0.008);
  lid.ball(0.022, RED, [0, 0.07, D / 2 + 0.056], [1, 1, 0.5], 8);

  const pulse: Animator[] = [];
  if (open) {
    hinge.rotation.x = -1.95;
    // The mouth full of light, a beam rising out of it and motes drifting up.
    m.box([W - 0.08, 0.02, D - 0.08], lit, [0, BODY_H - 0.005, 0], 0.004);
    const beamMat = new THREE.MeshBasicMaterial({
      color: "#ffe29a",
      transparent: true,
      opacity: 0.28,
      depthWrite: false,
    });
    const beam = m.cyl(0.3, 0.7, beamMat, [0, BODY_H + 0.01, 0], 0.18, 4);
    beam.rotation.y = Math.PI / 4;
    beam.scale.set(1.35, 1, 0.95);
    const motes: THREE.Mesh[] = [];
    for (let i = 0; i < 7; i++) motes.push(m.ball(0.018, PAPER, [0, BODY_H, 0], [1, 1, 1], 6));
    // The inside of the lid, lit warm from below.
    lid.box([W - 0.06, 0.012, D - 0.06], "#e08a4a", [0, -0.006, 0], 0.004);
    pulse.push((t) => {
      beamMat.opacity = 0.24 + 0.07 * Math.sin(t * 2.4);
      motes.forEach((s, i) => {
        const u = (t * 0.28 + i / motes.length) % 1;
        const a = i * 2.4 + t * 0.6;
        s.position.set(
          Math.sin(a) * 0.28 * (0.3 + u),
          BODY_H + 0.02 + u * 0.75,
          Math.cos(a) * 0.17 * (0.3 + u),
        );
        s.scale.setScalar(Math.max(0.01, 1 - u) * 1.2);
      });
    });
  }
  register(m, (t) => {
    const g = 0.5 + 0.5 * Math.sin(t * 2.6);
    lit.color.set(tint("#ffcf5c", -0.08 + 0.2 * g));
    tag.rotation.z = 0.14 * Math.sin(t * 1.7);
    for (const fn of pulse) fn(t);
  });
  animators.get(m)?.(0);
  return m;
}

function nightMarketKey(): Model {
  const m = new Model();
  const R = 0.3;
  const CENTRE = 0.69;
  const spin = m.part([0, CENTRE, 0]);
  /** A flat disc lying along z: `h` thick from `z`. */
  const disc = (r: number, h: number, z: number, color: string) => {
    const d = spin.cyl(r, h, color, [0, 0, z], r, 28);
    d.rotation.x = Math.PI / 2;
  };
  disc(R, 0.1, -0.05, GOLD);
  // Each face: a raised rim, a darker ring and the field, the lantern stamped below the hole.
  for (const turn of [0, Math.PI]) {
    const f = spin.part([0, 0, 0], turn);
    const fdisc = (r: number, h: number, z: number, color: string) => {
      const d = f.cyl(r, h, color, [0, 0, z], r, 28);
      d.rotation.x = Math.PI / 2;
    };
    fdisc(R, 0.02, 0.05, GOLD_LIGHT);
    fdisc(R * 0.82, 0.024, 0.05, GOLD_DARK);
    fdisc(R * 0.76, 0.028, 0.05, GOLD);
    const z = 0.082;
    f.box([0.12, 0.012, 0.012], GOLD_DARK, [0, -0.215, z - 0.006], 0.002);
    f.box([0.07, 0.02, 0.012], GOLD_DARK, [0, -0.2, z - 0.006], 0.002);
    f.ball(0.06, RED, [0, -0.12, z], [0.9, 1.2, 0.25], 10);
    f.box([0.13, 0.014, 0.014], GOLD_DARK, [0, -0.09, z], 0.003);
    f.box([0.13, 0.014, 0.014], GOLD_DARK, [0, -0.155, z], 0.003);
    f.box([0.05, 0.03, 0.014], GOLD_DARK, [0, -0.06, z - 0.002], 0.003);
  }
  // The square hole through the middle, up top, and the red cord looped through it.
  spin.box([0.1, 0.1, 0.19], PLUM_DARK, [0, 0.07, 0], 0.003);
  for (const x of [-0.035, 0.035]) spin.cyl(0.012, 0.22, RED, [x, 0.12, 0], 0.012, 6);
  spin.box([0.082, 0.026, 0.026], RED, [0, 0.34, 0], 0.01);
  // The tassel under the coin: a cord, a gold bead, a knot and a skirt of red strands.
  const t = m.part([0, 0.15, 0]);
  t.cyl(0.012, 0.12, RED, [0, 0.12, 0], 0.012, 6);
  t.ball(0.035, GOLD, [0, 0.1, 0], [1, 1.2, 1], 8);
  t.cyl(0.05, 0.03, GOLD_DARK, [0, 0.03, 0], 0.035, 8);
  t.cyl(0.078, 0.18, RED, [0, -0.15, 0], 0.045, 10);
  t.cyl(0.07, 0.02, RED_DARK, [0, -0.05, 0], 0.07, 10);
  t.cyl(0.078, 0.02, RED_DARK, [0, -0.15, 0], 0.078, 10);
  t.box([0.016, 0.14, 0.016], "#f06a4a", [0.035, -0.14, 0.05], 0.004);
  register(m, (time) => {
    spin.rotation.y = time * 0.9;
    spin.position.y = CENTRE + 0.012 * Math.sin(time * 1.6);
    t.rotation.z = 0.05 * Math.sin(time * 1.6 + 1);
  });
  return m;
}

// MARK: Nusantara

const TEAK = "#8a5a2b";
const TEAK_DARK = "#5a3a1c";
const TEAK_LIGHT = "#a86f38";
const RATTAN = "#c9a265";
const RATTAN_DARK = "#9a7536";
const TURQUOISE = "#1fb5b0";
const TURQUOISE_DARK = "#0f8a8c";
const BRASS = "#d9a22e";
const BRASS_LIGHT = "#ffd76a";
const BRASS_DARK = "#8f6414";
const CREAM = "#f1e3c2";
const INDIGO = "#243a73";
const SOGA = "#6b4226";

/**
 * Batik cloth, indigo with cream kawung flowers (four overlapping petals round a dot), `cols` across, for `w` x `h`
 * texels: rows of them, every other row set half a step over.
 */
function batikTexture(w: number, h: number, cols = 3): THREE.CanvasTexture {
  return canvasTexture(
    w,
    h,
    (g) => {
      g.fillStyle = INDIGO;
      g.fillRect(0, 0, w, h);
      const step = w / cols;
      const r = step * 0.3;
      const kawung = (cx: number, cy: number) => {
        g.fillStyle = CREAM;
        for (const [dx, dy, rx, ry] of [
          [0, -r, r * 0.62, r],
          [0, r, r * 0.62, r],
          [-r, 0, r, r * 0.62],
          [r, 0, r, r * 0.62],
        ] as const) {
          g.beginPath();
          g.ellipse(cx + dx, cy + dy, rx, ry, 0, 0, Math.PI * 2);
          g.fill();
        }
        g.fillStyle = INDIGO;
        g.fillRect(cx - r * 0.3, cy - r * 0.3, r * 0.6, r * 0.6);
        g.fillStyle = SOGA;
        g.fillRect(cx - r * 0.2, cy - r * 0.2, r * 0.4, r * 0.4);
      };
      for (let j = 0, y = step / 2; y < h + step; j++, y += step * 0.9)
        for (let x = j % 2 ? step : step / 2; x < w + step; x += step) kawung(x, y);
    },
    false,
  );
}

/** A flat triangle or quad in the x-y plane, `depth` thick, centred on z = 0. */
function sailShape(
  m: Model,
  pts: [number, number][],
  depth: number,
  color: string,
  at: [number, number, number],
) {
  const shape = new THREE.Shape();
  for (const [i, [x, y]] of pts.entries()) i ? shape.lineTo(x, y) : shape.moveTo(x, y);
  shape.closePath();
  const o = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false }), toon(color));
  o.position.set(...at);
  o.castShadow = true;
  m.add(o);
  return o;
}

/** A rope handle: two posts and a bar, in turquoise rope that alternates light and dark twists, on the end `side` of a chest. */
function ropeHandle(m: Model, side: -1 | 1, y: number, x: number): void {
  const u = (c: number) => (c % 2 ? TURQUOISE : TURQUOISE_DARK);
  for (const z of [-0.12, 0.12]) {
    for (let i = 0; i < 5; i++)
      m.box([0.04, 0.04, 0.045], u(i), [side * (x + 0.02 + i * 0.0), y + i * 0.04, z], 0.008);
    m.box([0.07, 0.03, 0.05], TEAK_DARK, [side * (x - 0.01), y - 0.02, z], 0.005);
  }
  const bar = m.box([0.04, 0.045, 0.31], TURQUOISE, [side * (x + 0.02), y + 0.19, 0], 0.01);
  void bar;
  for (let i = 0; i < 6; i++)
    m.box([0.046, 0.05, 0.02], u(i), [side * (x + 0.02), y + 0.19, -0.12 + i * 0.048], 0.004);
}

/** A rattan-bound corner post of `h` high at (x, z): wraps of two tans up it. */
function rattanPost(m: Model, x: number, z: number, y0: number, h: number, w = 0.07): void {
  m.box([w, h, w], RATTAN_DARK, [x, y0, z], 0.01);
  const n = Math.round(h / 0.065);
  for (let i = 0; i < n; i++)
    m.box([w + 0.014, 0.026, w + 0.014], i % 2 ? RATTAN : "#e0c488", [x, y0 + 0.01 + i * (h / n), z], 0.006);
}

/** The teak sea chest and its sail emblem; `open` pops the lid and lets daylight and jasmine petals out. */
function nusantaraBox(open: boolean): Model {
  const m = new Model();
  const sun = glow("#fff3c4");
  // A dark foot, and the body laid up in planks: four boards, each a shade apart, with a seam between.
  m.box([W + 0.04, 0.05, D + 0.04], TEAK_DARK, [0, 0, 0], 0.012);
  const planks = [TEAK, TEAK_LIGHT, TEAK, "#9a6330"];
  const ph = (BODY_H - 0.05) / planks.length;
  planks.forEach((c, i) => {
    m.box([W, ph - 0.012, D], c, [0, 0.05 + i * ph, 0], 0.014);
    m.box([W + 0.006, 0.012, D + 0.006], TEAK_DARK, [0, 0.05 + (i + 1) * ph - 0.012, 0], 0.003);
  });
  // The grain: a few short darker dashes along the front boards.
  for (const [x, y, w] of [
    [-0.3, 0.12, 0.2],
    [0.18, 0.2, 0.26],
    [-0.1, 0.3, 0.18],
    [0.33, 0.37, 0.14],
  ] as const)
    m.box([w, 0.008, 0.01], TEAK_DARK, [x, y, D / 2 + 0.004], 0.002);
  // Rattan-wrapped corner posts on all four corners, and a rattan lip round the mouth.
  for (const sx of [-1, 1])
    for (const sz of [-1, 1]) rattanPost(m, sx * (W / 2 - 0.02), sz * (D / 2 - 0.02), 0.0, BODY_H + 0.01);
  m.box([W + 0.05, 0.035, D + 0.05], RATTAN, [0, BODY_H, 0], 0.01);
  // Turquoise rope handles on both ends.
  ropeHandle(m, -1, 0.14, W / 2 + 0.005);
  ropeHandle(m, 1, 0.14, W / 2 + 0.005);
  // The white sail emblem on the front: a dark teak plaque, a big white sail and a cream jib on a mast over a turquoise hull.
  const E = D / 2 + 0.01;
  m.box([0.34, 0.3, 0.014], TEAK_DARK, [0, 0.08, E], 0.01);
  m.box([0.3, 0.26, 0.016], "#e8d6a8", [0, 0.1, E + 0.002], 0.008);
  m.box([0.01, 0.23, 0.02], TEAK_DARK, [-0.01, 0.12, E + 0.01], 0.002);
  sailShape(
    m,
    [
      [0, 0],
      [0, 0.2],
      [0.1, 0],
    ],
    0.012,
    "#ffffff",
    [0.0, 0.14, E + 0.012],
  );
  sailShape(
    m,
    [
      [0, 0],
      [0, 0.15],
      [-0.09, 0],
    ],
    0.012,
    "#fbf0d4",
    [-0.02, 0.14, E + 0.012],
  );
  m.box([0.24, 0.04, 0.02], TURQUOISE, [0, 0.1, E + 0.012], 0.01);
  m.box([0.26, 0.012, 0.02], TEAK_DARK, [0, 0.095, E + 0.012], 0.002);
  const sail = m.part([0, 0.1, E + 0.02]);

  // The lid, hinged along the back top edge: planks with a rattan edge, and the batik band across it.
  const hinge = m.part([0, BODY_H + 0.03, -D / 2]);
  const lid = hinge.part([0, 0, D / 2]);
  lid.box([W + 0.06, LID_H, D + 0.06], TEAK, [0, 0, 0], 0.04);
  lid.box([W + 0.062, LID_H * 0.45, D + 0.062], TEAK_LIGHT, [0, LID_H * 0.52, 0], 0.04);
  lid.box([W - 0.06, 0.03, D - 0.06], "#9a6330", [0, LID_H, 0], 0.02);
  lid.box([W + 0.07, 0.03, D + 0.07], RATTAN, [0, 0, 0], 0.01);
  for (const sx of [-1, 1])
    for (const sz of [-1, 1])
      rattanPost(lid, sx * (W / 2 + 0.005), sz * (D / 2 + 0.005), 0.0, LID_H + 0.03, 0.075);
  // The kawung band: a cloth ribbon running across the lid, front to back, and down its front.
  const bandW = 0.3;
  const tex = batikTexture(45, 90);
  const top = lid.plane(bandW, D + 0.02, painted(tex), [0, LID_H + 0.034, 0]);
  top.rotation.x = -Math.PI / 2;
  const tex2 = batikTexture(45, 30);
  lid.plane(bandW, LID_H + 0.02, painted(tex2), [0, LID_H / 2 + 0.01, D / 2 + 0.034]);
  for (const sx of [-1, 1]) {
    lid.box([0.014, 0.014, D + 0.03], CREAM, [sx * (bandW / 2 + 0.004), LID_H + 0.034, 0], 0.003);
    lid.box([0.014, LID_H + 0.02, 0.014], CREAM, [sx * (bandW / 2 + 0.004), 0.0, D / 2 + 0.034], 0.003);
  }
  // A brass hasp: a plate on the lid's lip and a loop with a pin on the body.
  lid.box([0.1, 0.08, 0.018], BRASS, [0, 0.0, D / 2 + 0.052], 0.008);
  lid.box([0.06, 0.012, 0.02], BRASS_LIGHT, [0, 0.055, D / 2 + 0.054], 0.003);
  lid.ball(0.018, BRASS_DARK, [0, 0.03, D / 2 + 0.066], [1, 1, 0.5], 8);
  m.box([0.07, 0.07, 0.016], BRASS, [0, BODY_H - 0.1, D / 2 + 0.01], 0.006);

  const pulse: Animator[] = [];
  if (open) {
    hinge.rotation.x = -1.95;
    // The mouth full of daylight, a pale column rising out of it, rays fanning and jasmine petals lifting up.
    m.box([W - 0.08, 0.02, D - 0.08], sun, [0, BODY_H - 0.005, 0], 0.004);
    const beamMat = new THREE.MeshBasicMaterial({
      color: "#fff8e0",
      transparent: true,
      opacity: 0.3,
      depthWrite: false,
    });
    const beam = m.cyl(0.32, 0.8, beamMat, [0, BODY_H + 0.01, 0], 0.2, 4);
    beam.rotation.y = Math.PI / 4;
    beam.scale.set(1.35, 1, 0.95);
    const rayMat = new THREE.MeshBasicMaterial({
      color: "#ffe9a0",
      transparent: true,
      opacity: 0.32,
      depthWrite: false,
    });
    const rays = Array.from({ length: 7 }, (_, i) => {
      const r = m.part([0, BODY_H + 0.04, 0], (i / 7) * Math.PI);
      const shaft = r.box([0.02, 0.9, 0.02], rayMat, [0, 0, 0], 0.002);
      shaft.rotation.z = (i % 2 ? 1 : -1) * (0.15 + (i % 3) * 0.1);
      return r;
    });
    // The jasmine (melati): a small white five-petal flower, a gold heart, drifting up and turning.
    const petals = Array.from({ length: 11 }, (_, i) => {
      const f = m.part([0, BODY_H, 0]);
      for (let k = 0; k < 4; k++) {
        const arm = f.part([0, 0, 0], (k * Math.PI) / 2);
        arm.box([0.022, 0.012, 0.05], "#ffffff", [0, 0, 0.006], 0.004);
      }
      f.box([0.024, 0.016, 0.024], "#f2c230", [-0.012, 0.002, -0.012], 0.004);
      return { f, i };
    });
    lid.box([W - 0.06, 0.012, D - 0.06], "#fff3c4", [0, -0.006, 0], 0.004);
    pulse.push((t) => {
      beamMat.opacity = 0.26 + 0.07 * Math.sin(t * 2.2);
      rayMat.opacity = 0.24 + 0.1 * Math.sin(t * 1.7 + 1);
      rays.forEach((r, i) => {
        r.rotation.y = (i / 7) * Math.PI + t * 0.12;
      });
      petals.forEach(({ f, i }) => {
        const u = (t * 0.26 + i / petals.length) % 1;
        const a = i * 2.4 + t * 0.7;
        f.position.set(
          Math.sin(a) * 0.3 * (0.25 + u),
          BODY_H + 0.03 + u * 0.8,
          Math.cos(a) * 0.19 * (0.25 + u),
        );
        f.rotation.set(t * 1.2 + i, t * 0.9 + a, t * 0.8);
        f.scale.setScalar(Math.max(0.01, Math.sin(u * Math.PI)) * 1.7);
      });
    });
  }
  register(m, (t) => {
    const g = 0.5 + 0.5 * Math.sin(t * 2.4);
    sun.color.set(tint("#fff0b8", -0.04 + 0.1 * g));
    sail.rotation.z = 0.05 * Math.sin(t * 1.6);
    for (const fn of pulse) fn(t);
  });
  animators.get(m)?.(0);
  return m;
}

/** A brass key whose bow is an anchor, hung from a knotted batik ribbon; it turns slowly, the ribbon tails swaying. */
function nusantaraKey(): Model {
  const m = new Model();
  const hang = m.part([0, 0, 0]);
  hang.scale.setScalar(0.88);
  const spin = hang.part([0, 0, 0]);
  const T = 0.064;
  const ring = 1.0;
  // The shaft of the key and its bit: a stout round shank, a wide notched bit of two teeth to one side.
  spin.box([0.065, 0.5, 0.058], BRASS, [0, 0.0, 0], 0.014);
  spin.box([0.012, 0.46, 0.064], BRASS_LIGHT, [-0.02, 0.02, 0], 0.003);
  spin.box([0.16, 0.07, 0.058], BRASS, [0.1, 0.02, 0], 0.012);
  spin.box([0.12, 0.07, 0.058], BRASS, [0.08, 0.14, 0], 0.012);
  spin.box([0.08, 0.05, 0.062], BRASS_DARK, [0.12, 0.092, 0], 0.003);
  // The anchor that is its bow: a crown with two curved arms sweeping up and out to a fluke each, a shank, a stock
  // across it and a ring on top.
  spin.box([0.1, 0.07, T], BRASS, [0, 0.5, 0], 0.014);
  for (const s of [-1, 1] as const) {
    spin.box([0.12, 0.07, T], BRASS, [s * 0.1, 0.52, 0], 0.014);
    spin.box([0.08, 0.1, T], BRASS, [s * 0.17, 0.58, 0], 0.014);
    spin.box([0.07, 0.09, T], BRASS_LIGHT, [s * 0.2, 0.67, 0], 0.012);
    spin.box([0.035, 0.07, T], BRASS_LIGHT, [s * 0.215, 0.75, 0], 0.01);
  }
  spin.box([0.075, 0.5, T], BRASS, [0, 0.52, 0], 0.014);
  spin.box([0.013, 0.46, T + 0.008], BRASS_LIGHT, [-0.022, 0.54, 0], 0.003);
  spin.box([0.3, 0.05, T], BRASS, [0, 0.86, 0], 0.012);
  for (const [w, h, x, y] of [
    [0.2, 0.045, 0, ring + 0.05],
    [0.2, 0.045, 0, ring - 0.065],
    [0.045, 0.16, -0.075, ring - 0.065],
    [0.045, 0.16, 0.075, ring - 0.065],
  ] as const)
    spin.box([w, h, T], BRASS, [x, y, 0], 0.012);
  // The ribbon: a knot at the ring, a cord loop over it, and two batik tails swaying down either side.
  const cloth = painted(batikTexture(14, 56, 2));
  spin.box([0.1, 0.075, 0.075], INDIGO, [0, ring + 0.115, 0], 0.02);
  spin.box([0.12, 0.025, 0.08], "#4a63a8", [0, ring + 0.17, 0], 0.008);
  for (const [w, h, x, y] of [
    [0.13, 0.022, 0, ring + 0.31],
    [0.022, 0.16, -0.054, ring + 0.17],
    [0.022, 0.16, 0.054, ring + 0.17],
  ] as const)
    spin.box([w, h, 0.03], SOGA, [x, y, 0], 0.006);
  const tails = ([-1, 1] as const).map((s) => {
    const t = spin.part([s * 0.07, ring + 0.15, 0.0]);
    t.plane(0.09, 0.34, cloth, [s * 0.05, -0.17, 0.034]);
    t.plane(0.09, 0.34, cloth, [s * 0.05, -0.17, -0.034]).rotation.y = Math.PI;
    t.box([0.09, 0.016, 0.07], CREAM, [s * 0.05, -0.34, -0.035], 0.003);
    t.box([0.045, 0.045, 0.07], INDIGO, [s * 0.05 - 0.022, -0.385, -0.035], 0.003);
    t.box([0.045, 0.045, 0.07], INDIGO, [s * 0.05 + 0.022, -0.385, -0.035], 0.003);
    return { t, s };
  });
  // The key hangs with its lowest point (the foot of the shaft) at y = 0.
  register(m, (time) => {
    spin.rotation.y = time * 0.9;
    spin.position.y = 0.012 * Math.sin(time * 1.6);
    for (const { t, s } of tails) t.rotation.z = s * (0.22 + 0.07 * Math.sin(time * 2 + s));
  });
  return m;
}

/** The case's chest (closed or open), for the case `id` (`CaseDef.id`); the Night Market's unless it is "nusantara" or "ragnarok-eve". */
export function buildCaseBox(open: boolean, id: string = DEFAULT_CASE_ID): Model {
  return id === "nusantara"
    ? nusantaraBox(open)
    : id === "ragnarok-eve"
      ? buildNorseBox(open, register)
      : nightMarketBox(open);
}

/** The case's key, for the case `id`: the Night Market's market token on its tassel, the Nusantara's anchor key, or the Ragnarok Eve's. */
export function buildCaseKey(id: string = DEFAULT_CASE_ID): Model {
  return id === "nusantara"
    ? nusantaraKey()
    : id === "ragnarok-eve"
      ? buildNorseKey(register)
      : nightMarketKey();
}

/** A picture of the case (closed or open) or the key, through the shared icon renderer (3D tiers only). */
export function caseBoxIcon(
  what: CaseIcon,
  size: IconSize,
  caseId: string = DEFAULT_CASE_ID,
): { promise: Promise<HTMLCanvasElement>; cancel: () => void } {
  let cancel = () => {};
  let dead = false;
  const promise = import("./icons.ts").then((m) => {
    if (dead) throw new Error("cancelled");
    const r = m.requestIcon({ kind: "case", what, caseId }, size);
    cancel = r.cancel;
    return r.promise;
  });
  return {
    promise,
    cancel: () => {
      dead = true;
      cancel();
    },
  };
}
