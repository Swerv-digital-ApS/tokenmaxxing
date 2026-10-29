/**
 * The Ragnarok Eve case's furniture in 3D (`RAGNAROK_PIECES` in core/src/case-ragnarok-furniture.ts), the same
 * pieces as `furniture-home.ts` draws in 2D: a raven banner, a bearskin rug, a mead stump, a feast table, a
 * painted runestone and an Yggdrasil sapling. Built like `night3d.ts`: bottom centre at the origin, front along
 * +z; the banner hangs on a wall, so it is built against y = 0 facing +z (its cloth hangs from a pole near 2.1).
 *
 * Care (docs/cases/ragnarok-eve.md): the runestone only ever carries the safe Elder Futhark glyphs (never
 * Sowilo, Othala, Tyr or Algiz), none paired like the SS sig-rune, and nothing here is a valknut, a wolf's hook
 * or a Vegvisir.
 */
import type * as THREE from "three";
import { canvasTexture, glow, Model, painted, seeded, ticks, tint } from "../kit/kit.ts";
import { light } from "./furniture.ts";

const OAK = "#6b4a2e";
const OAK_DARK = "#3f2a1a";
const OAK_LIGHT = "#8a6340";
const IRON = "#4a5160";
const STEEL = "#7a8394";
const BONE = "#e8dfc8";
const GOLD = "#e9b73d";
const RAVEN = "#252a3a";
const SHEEN = "#4a4366";
const RED = "#b3382f";
const WOAD = "#3b6fb8";
const STONE = "#8d949c";

/** A flat elliptic disc lying on the floor. */
function disc(m: Model, rx: number, rz: number, y: number, h: number, color: string, x = 0, z = 0): void {
  const d = m.cyl(rx, h, color, [x, y, z], rx, 24);
  d.scale.z = rz / rx;
}

/** A segment of a thing that curves, `len` long from `at` (bottom to top radius), lying along `turn` about y. */
function lie(
  m: Model,
  at: [number, number, number],
  turn: number,
  len: number,
  r0: number,
  r1: number,
  c: string,
) {
  const s = m.part(at, turn);
  s.cyl(r0, len, c, [0, 0, 0], r1, 8).rotation.z = -Math.PI / 2;
  return s;
}

// MARK: Raven banner

/**
 * A raven in profile, flying side-on and facing left: a horizontal body, a head with a long beak, a fanned tail and one wing
 * swept up and back. Thin boxes only, so it reads the same smooth or blocky; about 0.75 wide at scale 1. It is a bird
 * silhouette (a horizontal body and one swept wing), never a stem with arms. `z` lifts it off the surface it sits on.
 */
export function ravenProfile(
  parent: THREE.Object3D,
  o: { color: string; sheen?: string; eye?: string; z?: number; scale?: number },
): Model {
  const g = new Model();
  const z = o.z ?? 0;
  g.scale.setScalar(o.scale ?? 1);
  parent.add(g);
  // The body and the tail.
  g.box([0.34, 0.15, 0.04], o.color, [0.02, -0.085, z], 0.04).rotation.z = -0.08;
  g.box([0.14, 0.16, 0.04], o.color, [-0.1, -0.08, z], 0.04);
  for (const [x, y, a, len] of [
    [0.16, -0.05, 0.3, 0.22],
    [0.17, -0.08, 0.08, 0.26],
    [0.16, -0.11, -0.12, 0.22],
  ] as const) {
    const t = g.part([x, y, z]);
    t.rotation.z = a;
    t.box([len, 0.07, 0.02], o.color, [len / 2, -0.035, 0], 0.01);
  }
  // The head with a heavy, hooked beak.
  g.box([0.15, 0.14, 0.04], o.color, [-0.2, -0.045, z], 0.045);
  g.box([0.15, 0.06, 0.036], o.color, [-0.31, -0.035, z], 0.015).rotation.z = 0.05;
  g.box([0.05, 0.04, 0.036], o.color, [-0.38, -0.07, z], 0.012);
  if (o.eye) g.box([0.03, 0.03, 0.01], o.eye, [-0.215, -0.02, z + 0.022], 0.004);
  // One wing, swept back and slightly up: long, broad feathers laid nearly on top of each other.
  for (const [a, len, dy] of [
    [0.1, 0.46, 0],
    [0.26, 0.46, 0.015],
    [0.42, 0.42, 0.03],
    [0.58, 0.36, 0.045],
    [0.74, 0.28, 0.06],
  ] as const) {
    const f = g.part([-0.06, -0.015 + dy, z + 0.012]);
    f.rotation.z = a;
    f.box([len, 0.095, 0.02], o.color, [len / 2, -0.0475, 0], 0.01);
    if (o.sheen) f.box([len * 0.8, 0.014, 0.022], o.sheen, [len * 0.45, 0.0, 0.002], 0.002);
  }
  // A tucked foot.
  g.box([0.02, 0.07, 0.02], o.color, [-0.04, -0.18, z], 0.004);
  return g;
}

function raven(parent: Model): Model {
  return ravenProfile(parent, { color: RAVEN, sheen: SHEEN, eye: BONE, z: 0.006, scale: 1.45 });
}

const ravenBanner = (): Model => {
  const m = new Model();
  const top = 2.15;
  const W = 1.4;
  const H = 1.4;
  const N = 10;
  // The pole across the top with a bone finial at each end, and a gold collar.
  m.box([1.84, 0.06, 0.06], OAK_DARK, [0, top, -0.02], 0.012);
  for (const s of [-1, 1]) {
    m.ball(0.07, BONE, [s * 0.95, top + 0.03, -0.02], [1, 1, 1], 8);
    m.cyl(0.05, 0.05, GOLD, [s * 0.88, top - 0.005, -0.02], 0.05, 8).scale.set(0.5, 1, 1);
    m.cyl(0.03, 0.14, STEEL, [s * 0.95, top + 0.08, -0.02], 0.004, 6);
  }
  // Two iron hooks on the wall hold the pole.
  for (const s of [-1, 1]) m.box([0.04, 0.12, 0.06], IRON, [s * 0.6, top - 0.1, -0.06], 0.008);
  // The cloth: ten strips with a swallowtail notch, red with a gold hem, each fluttering on its own phase.
  const strips: { p: Model; x: number }[] = [];
  for (let i = 0; i < N; i++) {
    const u = (i + 0.5) / N;
    const x = (u - 0.5) * W;
    const notch = 0.34 * (1 - Math.abs(u - 0.5) * 2) ** 1.1;
    const h = H - notch;
    const p = m.part([x, top - 0.01, 0.0]);
    const shade = i % 2 ? RED : tint(RED, -0.07);
    p.box([W / N + 0.004, h, 0.024], shade, [0, -h, 0], 0.004);
    p.box([W / N + 0.004, 0.035, 0.03], GOLD, [0, -h, 0], 0.004);
    if (i === 0 || i === N - 1)
      p.box([0.02, h, 0.03], GOLD, [(i ? 1 : -1) * (W / N / 2 - 0.006), -h, 0], 0.003);
    strips.push({ p, x });
  }
  m.box([W + 0.02, 0.07, 0.034], GOLD, [0, top - 0.075, 0.002], 0.006);
  for (let i = 0; i < 5; i++)
    m.box([0.05, 0.08, 0.04], tint(RED, -0.2), [(i - 2) * 0.3, top - 0.06, 0.0], 0.005);
  // The raven on the cloth.
  const bird = raven(m);
  bird.position.set(0, top - 0.75, 0.016);
  // A row of gold studs under the hem edge of the notch.
  for (const s of [-1, 1]) m.ball(0.022, GOLD, [s * 0.5, top - 1.12, 0.02], [1, 1, 0.5], 6);
  const wave = (x: number, t: number) => 0.03 * Math.sin(x * 3.4 - t * 2.1) * (1 + 0.4 * Math.sin(t * 0.7));
  ticks.push((t) => {
    for (const s of strips) {
      s.p.position.z = wave(s.x, t) + 0.03;
      s.p.rotation.y = -(wave(s.x + 0.05, t) - wave(s.x - 0.05, t)) * 3.2;
      s.p.rotation.x = 0.03 * Math.sin(t * 1.3 + s.x * 2);
    }
    bird.position.z = wave(0, t) + 0.05;
    bird.rotation.y = -(wave(0.05, t) - wave(-0.05, t)) * 3.2;
  });
  return m;
};

// MARK: Bearskin rug

const bearRug = (): Model => {
  const m = new Model();
  const BROWN = "#6a4528";
  const DARK = "#4a2f1b";
  const LIGHT = "#8a5d38";
  const TAN = "#c9a47a";
  // The pelt: a dark rim, the brown body, a lighter saddle of fur on top, and four splayed legs.
  disc(m, 0.7, 0.46, 0, 0.034, DARK, -0.22);
  disc(m, 0.67, 0.43, 0.0, 0.05, BROWN, -0.22);
  disc(m, 0.45, 0.26, 0.05, 0.012, LIGHT, -0.26);
  disc(m, 0.28, 0.14, 0.062, 0.01, tint(LIGHT, 0.12), -0.3);
  for (const [x, z, a] of [
    [0.34, 0.4, 0.5],
    [0.34, -0.4, -0.5],
    [-0.76, 0.34, -0.45],
    [-0.76, -0.34, 0.45],
  ] as const) {
    const leg = m.part([x, 0, z], a);
    leg.ball(0.17, DARK, [0, 0.012, 0], [1.1, 0.16, 0.9], 10);
    leg.ball(0.16, BROWN, [0, 0.026, 0], [1.05, 0.15, 0.85], 10);
    // The claws.
    for (const dz of [-0.07, 0, 0.07]) leg.box([0.09, 0.02, 0.03], BONE, [0.16, 0.02, dz], 0.006);
  }
  // A stubby tail.
  m.ball(0.07, DARK, [-1.0, 0.025, 0], [1, 0.4, 1], 8);
  // The head, looking up from the rug: skull, ears, a tan muzzle, a nose, sleepy eyes and a faint grin.
  m.box([0.52, 0.07, 0.6], DARK, [0.6, 0.0, 0], 0.03);
  m.box([0.5, 0.075, 0.57], BROWN, [0.6, 0.02, 0], 0.03);
  for (const s of [-1, 1]) {
    m.box([0.16, 0.07, 0.16], DARK, [0.42, 0.06, s * 0.3], 0.04);
    m.box([0.09, 0.05, 0.09], "#a86f4a", [0.44, 0.1, s * 0.3], 0.025);
  }
  m.box([0.34, 0.06, 0.34], TAN, [0.9, 0.04, 0], 0.03);
  m.box([0.12, 0.05, 0.15], "#1b1a22", [1.08, 0.09, 0], 0.03);
  m.box([0.03, 0.02, 0.04], "#fff", [1.1, 0.145, -0.03], 0.005);
  for (const s of [-1, 1]) {
    m.box([0.08, 0.04, 0.07], "#14101c", [0.68, 0.095, s * 0.15], 0.02);
    m.box([0.02, 0.02, 0.02], "#fff", [0.7, 0.135, s * 0.15 - 0.02], 0.004);
    // A heavy lid over each eye, tilted a little: it has seen things.
    m.box([0.1, 0.03, 0.09], tint(BROWN, -0.05), [0.67, 0.12, s * 0.15], 0.01).rotation.y = s * 0.35;
  }
  // The grin: a thin dark line across the muzzle with its ends turned up, and two teeth.
  m.box([0.02, 0.012, 0.15], "#2b1b14", [1.0, 0.105, 0], 0.002);
  for (const s of [-1, 1]) {
    m.box([0.05, 0.012, 0.02], "#2b1b14", [0.98, 0.105, s * 0.09], 0.002).rotation.y = s * 0.6;
    m.box([0.016, 0.016, 0.02], BONE, [1.015, 0.106, s * 0.04], 0.003);
  }
  return m;
};

// MARK: Mead stump

/** The horn, lying on its side on `at`: a curved bone-white taper with a gold rim and an iron tip. */
function horn(m: Model, at: [number, number, number], scale = 1): Model {
  const h = m.part(at);
  h.scale.setScalar(scale);
  const pts: [number, number, number][] = [
    [-0.16, 0.12, 0.09],
    [-0.09, 0.1, 0.0],
    [0.0, 0.08, -0.04],
    [0.09, 0.06, -0.03],
    [0.16, 0.02, 0.02],
  ];
  pts.forEach((p, i) => {
    const q = pts[i + 1];
    if (!q) return;
    const turn = Math.atan2(-(q[2] - p[2]), q[0] - p[0]);
    const len = Math.hypot(q[0] - p[0], q[2] - p[2]);
    const r0 = 0.05 - i * 0.009;
    const r1 = 0.05 - (i + 1) * 0.009;
    lie(h, [p[0], 0.005, p[2]], turn, len + 0.012, r0, r1, i % 2 ? BONE : tint(BONE, -0.06));
  });
  return h;
}

const meadStump = (): Model => {
  const m = new Model();
  const BARK = "#6e4a2c";
  // The stump: bark, a pale cut top with growth rings, roots at the foot.
  m.cyl(0.3, 0.1, tint(OAK_DARK, 0.12), [0, 0, 0], 0.27, 10);
  m.cyl(0.27, 0.32, BARK, [0, 0.08, 0], 0.255, 10);
  for (const [i, c] of [OAK_DARK, BARK, OAK_DARK].entries())
    m.box([0.02, 0.28, 0.02], c, [Math.cos(i * 2.2) * 0.265, 0.1, Math.sin(i * 2.2) * 0.265], 0.004);
  for (const [i, a] of [0.4, 1.7, 3.1, 4.4, 5.5].entries()) {
    const r = m.part([Math.cos(a) * 0.22, 0.04, Math.sin(a) * 0.22], -a);
    r.box([0.2, 0.07, 0.07], i % 2 ? BARK : OAK_DARK, [0.08, -0.02, 0], 0.02).rotation.z = -0.25;
  }
  const topY = 0.4;
  m.cyl(0.255, 0.02, OAK_LIGHT, [0, topY - 0.01, 0], 0.255, 20);
  for (const [r, c] of [
    [0.2, OAK],
    [0.17, OAK_LIGHT],
    [0.12, OAK],
    [0.09, OAK_LIGHT],
    [0.05, OAK],
  ] as const)
    m.cyl(r, 0.004, c, [0.01, topY + 0.008, -0.005], r, 20);
  // A foam ring where a mug stood: a pale ring on the wood, and a couple of bubbles.
  m.cyl(0.13, 0.006, "#f4ecd2", [0.08, topY + 0.01, 0.09], 0.13, 18);
  m.cyl(0.095, 0.007, OAK_LIGHT, [0.08, topY + 0.0105, 0.09], 0.095, 18);
  for (const [x, z] of [
    [0.19, 0.05],
    [0.18, 0.17],
    [-0.02, 0.15],
  ] as const)
    m.ball(0.016, "#fff7e0", [x, topY + 0.022, z], [1, 0.7, 1], 6);
  // The horn lying on its side, its mouth foaming over the rim.
  const h = horn(m, [-0.02, topY + 0.05, -0.1], 1.0);
  h.rotation.y = 0.15;
  const lip = h.part([-0.165, 0.005, 0.09], 0.91);
  lip.cyl(0.062, 0.03, GOLD, [0, 0, 0], 0.06, 10).rotation.z = -Math.PI / 2;
  const foam = [0, 1, 2, 3].map((i) =>
    h.ball(0.03 - i * 0.003, "#fff7e0", [-0.2 - i * 0.012, 0.045 + i * 0.016, 0.1 + i * 0.012], [1, 1, 1], 7),
  );
  ticks.push((t) => {
    foam.forEach((f, i) => {
      f.scale.setScalar(1 + 0.12 * Math.sin(t * 2 + i * 1.7));
    });
  });
  return m;
};

// MARK: Feast table

const feastTable = (): Model => {
  const m = new Model();
  const L = 1.9;
  const T = 0.62;
  // Trestles under three planks, and a stretcher pegged through them.
  for (const s of [-1, 1]) {
    m.box([0.08, 0.58, 0.66], OAK_DARK, [s * 0.72, 0, 0], 0.012);
    m.box([0.14, 0.05, 0.7], OAK, [s * 0.72, 0.0, 0], 0.012);
    for (const z of [-0.28, 0.28])
      m.box([0.12, 0.2, 0.06], OAK_DARK, [s * 0.72, 0.0, z], 0.008).rotation.x = 0;
  }
  m.box([1.5, 0.05, 0.05], OAK, [0, 0.2, 0], 0.01);
  for (const s of [-1, 1]) m.box([0.03, 0.04, 0.07], OAK_LIGHT, [s * 0.72 + 0.08, 0.2, 0], 0.005);
  for (const [i, z] of [-0.27, 0, 0.27].entries()) {
    m.box([L, 0.06, 0.26], i === 1 ? tint(OAK, 0.08) : OAK, [0, T - 0.06, z], 0.015);
  }
  m.box([L + 0.02, 0.015, 0.012], OAK_DARK, [0, T - 0.012, 0.135], 0.002);
  m.box([L + 0.02, 0.015, 0.012], OAK_DARK, [0, T - 0.012, -0.135], 0.002);
  // A pewter platter with the roast boar on it, built of blocks so it reads as a boar either way.
  const y = T;
  m.box([1.0, 0.03, 0.5], "#a9a79c", [0.0, y, 0], 0.012);
  m.box([0.9, 0.012, 0.42], "#c9c7bb", [0.0, y + 0.03, 0], 0.006);
  const GL = "#a85a24";
  const GL2 = "#c97a34";
  const CR = "#7a3d16";
  // Greens and apples round the edge.
  for (const [x, z] of [
    [-0.4, 0.2],
    [-0.15, 0.23],
    [0.15, 0.23],
    [0.42, 0.2],
    [-0.42, -0.14],
    [-0.12, -0.23],
    [0.2, -0.23],
  ] as const)
    m.box([0.09, 0.035, 0.07], "#4f8a4a", [x, y + 0.04, z], 0.012).rotation.y = x * 4;
  for (const [x, z] of [
    [-0.28, 0.2],
    [0.3, -0.2],
    [0.0, 0.24],
  ] as const)
    m.ball(0.035, "#c23a2e", [x, y + 0.075, z], [1, 1, 1], 8);
  const boar = m.part([0, y + 0.04, 0]);
  // Body: a long barrel, a glazed back, crackling stripes, and the ham.
  boar.box([0.64, 0.25, 0.32], GL, [-0.04, 0.05, 0], 0.07);
  boar.box([0.54, 0.1, 0.27], GL2, [-0.05, 0.27, 0], 0.045);
  boar.box([0.2, 0.2, 0.34], tint(GL, -0.08), [-0.3, 0.07, 0], 0.07);
  for (const x of [-0.25, -0.12, 0.01, 0.14]) boar.box([0.018, 0.02, 0.24], CR, [x, 0.365, 0], 0.003);
  for (const x of [-0.19, -0.06, 0.07]) boar.box([0.07, 0.018, 0.27], "#e8a85a", [x, 0.37, 0], 0.004);
  // Head: a block with a snout, tusks, ears and shut eyes; an apple in its mouth.
  boar.box([0.26, 0.24, 0.26], tint(GL, 0.05), [0.36, 0.07, 0], 0.06);
  boar.box([0.16, 0.14, 0.2], tint(GL, 0.16), [0.53, 0.07, 0], 0.045);
  boar.box([0.03, 0.06, 0.1], "#2a1a10", [0.625, 0.11, 0], 0.01);
  for (const s of [-1, 1]) {
    boar.box([0.03, 0.09, 0.03], BONE, [0.56, 0.1, s * 0.105], 0.006).rotation.x = s * 0.25;
    boar.box([0.08, 0.1, 0.06], tint(GL, -0.12), [0.31, 0.27, s * 0.11], 0.02);
    boar.box([0.07, 0.016, 0.03], "#2a1a10", [0.42, 0.22, s * 0.08], 0.003);
  }
  boar.ball(0.045, "#c23a2e", [0.6, 0.06, 0], [1, 1, 1], 8);
  boar.box([0.01, 0.025, 0.01], "#4a2f1b", [0.6, 0.1, 0], 0.002);
  // Trotters tucked under, a curly tail.
  for (const [x, z] of [
    [0.3, 0.14],
    [0.3, -0.14],
    [-0.3, 0.16],
    [-0.3, -0.16],
  ] as const) {
    boar.box([0.09, 0.05, 0.06], CR, [x, -0.01, z], 0.012);
    boar.box([0.05, 0.03, 0.05], "#2a1a10", [x + 0.06, -0.01, z], 0.008);
  }
  boar.box([0.04, 0.05, 0.04], GL2, [-0.43, 0.2, 0], 0.012);
  boar.box([0.04, 0.04, 0.04], GL2, [-0.46, 0.25, 0], 0.012);
  // Bread, mugs and a horn on the board.
  for (const [x, z, r] of [
    [-0.72, 0.2, 0.2],
    [-0.62, -0.15, -0.4],
  ] as const) {
    const loaf = m.ball(0.085, "#c98a4b", [x, T + 0.04, z], [1.5, 0.75, 0.8], 10);
    loaf.rotation.y = r;
    m.box([0.1, 0.01, 0.012], "#a8672e", [x, T + 0.088, z], 0.002).rotation.y = r;
  }
  m.ball(0.08, "#d6a063", [-0.5, T + 0.035, 0.0], [1, 0.55, 1], 10);
  for (const [x, z] of [
    [0.68, 0.18],
    [0.62, -0.2],
    [0.82, -0.02],
  ] as const) {
    m.cyl(0.05, 0.11, OAK_LIGHT, [x, T, z], 0.055, 10);
    m.cyl(0.056, 0.014, IRON, [x, T + 0.025, z], 0.056, 10);
    m.cyl(0.056, 0.014, IRON, [x, T + 0.075, z], 0.056, 10);
    m.cyl(0.048, 0.012, "#f4ecd2", [x, T + 0.11, z], 0.048, 10);
    m.ball(0.02, "#fff7e0", [x - 0.01, T + 0.128, z + 0.01], [1, 0.7, 1], 5);
    m.box([0.03, 0.07, 0.016], OAK_DARK, [x + 0.07, T + 0.02, z], 0.006);
  }
  horn(m, [-0.92, T + 0.045, -0.1], 0.9);
  // Steam over the boar, and a warm glow from the fire it came off.
  const steam = [0, 1, 2, 3].map(() => m.ball(0.03, "#ffffff", [0, T + 0.5, 0], [1, 1, 1], 6));
  ticks.push((t) =>
    steam.forEach((s, i) => {
      const u = (t * 0.4 + i / 4) % 1;
      s.position.set(0.0 + Math.sin(u * 7 + i * 2) * 0.05, T + 0.5 + u * 0.4, Math.cos(u * 5 + i) * 0.06);
      s.scale.setScalar((1 - u) * 1.3);
    }),
  );
  light(m, [0, 1.0, 0.5], "#ff9a3c", 1.2, 3.5);
  return m;
};

// MARK: Painted runestone

type Stroke = readonly [number, number, number, number];
/** The glyphs on the stone, as strokes in a 4 by 8 cell. Only the safe set: Gebo, Raidho, Mannaz, Ansuz, Kaunan, Thurisaz, Isa. */
const GLYPH: Record<string, readonly Stroke[]> = {
  // ᚷ Gebo
  G: [
    [0, 0, 4, 8],
    [4, 0, 0, 8],
  ],
  // ᚱ Raidho
  R: [
    [0, 0, 0, 8],
    [0, 0, 4, 2.5],
    [4, 2.5, 0, 5],
    [0.3, 4.4, 4, 8],
  ],
  // ᛗ Mannaz
  M: [
    [0, 0, 0, 8],
    [4, 0, 4, 8],
    [0, 0, 4, 4.5],
    [4, 0, 0, 4.5],
  ],
  // ᚨ Ansuz
  A: [
    [0, 0, 0, 8],
    [0, 1, 4, 3.4],
    [0, 4, 4, 6.4],
  ],
  // ᚲ Kaunan
  K: [
    [4, 1, 0, 4],
    [0, 4, 4, 7],
  ],
  // ᚦ Thurisaz
  T: [
    [0, 0, 0, 8],
    [0, 1.5, 4, 4],
    [4, 4, 0, 6.5],
  ],
  // ᛁ Isa
  I: [[2, 0, 2, 8]],
};
/** "Gorm made this", as the safe glyphs allow: G R M / M A K / T I (three lines, loose, never a ring). */
const INSCRIPTION = ["GRM", "MAK", "TI"] as const;

const runestone = (): Model => {
  const m = new Model();
  // A rough standing slab: a heavy foot, the body, a rounded shoulder.
  m.box([0.62, 0.12, 0.34], tint(STONE, -0.15), [0, 0, 0], 0.04);
  m.box([0.5, 0.5, 0.26], STONE, [0.0, 0.1, 0], 0.04);
  m.box([0.46, 0.52, 0.23], tint(STONE, 0.04), [0.01, 0.55, 0], 0.045);
  const crown = m.cyl(0.25, 0.14, tint(STONE, 0.1), [0.0, 0.98, 0], 0.13, 6);
  crown.scale.z = 0.42;
  // A lean to it: chips and moss at the foot.
  m.ball(0.06, "#6b8f4a", [-0.26, 0.1, 0.14], [1.3, 0.5, 1], 6);
  m.ball(0.045, "#5a7d3e", [0.27, 0.08, 0.15], [1.2, 0.5, 1], 6);
  m.box([0.1, 0.06, 0.06], tint(STONE, -0.1), [0.34, 0, 0.12], 0.02).rotation.y = 0.5;
  // The painted face: a red border, a woad panel, and the inscription in bone with a dark edge.
  const tex = canvasTexture(64, 112, (g) => {
    const rnd = seeded(5);
    g.fillStyle = STONE;
    g.fillRect(0, 0, 64, 112);
    for (let i = 0; i < 40; i++) {
      g.fillStyle = rnd() < 0.5 ? tint(STONE, 0.07) : tint(STONE, -0.08);
      g.fillRect(Math.floor(rnd() * 64), Math.floor(rnd() * 112), 2 + Math.floor(rnd() * 3), 1);
    }
    // The red border, with a plain wave at top and bottom (no knot, no ring).
    g.fillStyle = RED;
    g.fillRect(3, 6, 58, 100);
    g.fillStyle = WOAD;
    g.fillRect(7, 10, 50, 92);
    g.fillStyle = "#e9b73d";
    for (let x = 8; x < 56; x += 6) {
      g.fillRect(x, 13 + ((x / 6) % 2) * 2, 3, 2);
      g.fillRect(x, 96 - ((x / 6) % 2) * 2, 3, 2);
    }
    const rows = INSCRIPTION;
    rows.forEach((row, ri) => {
      const y0 = 24 + ri * 25;
      const total = row.length * 9 + (row.length - 1) * 3;
      let x = 32 - total / 2 + 1;
      for (const ch of row) {
        for (const pass of [0, 1]) {
          g.strokeStyle = pass ? "#f4ecd2" : "#1a2a4a";
          g.lineWidth = pass ? 1.6 : 3;
          g.lineCap = "square";
          g.beginPath();
          for (const [x1, y1, x2, y2] of GLYPH[ch]!) {
            g.moveTo(x + x1 * 1.9, y0 + y1 * 1.9 * 0.9);
            g.lineTo(x + x2 * 1.9, y0 + y2 * 1.9 * 0.9);
          }
          g.stroke();
        }
        x += 12;
      }
    });
    // A little painted dot in the corners.
    g.fillStyle = "#e9b73d";
    for (const [x, y] of [
      [5, 8],
      [58, 8],
      [5, 104],
      [58, 104],
    ] as const)
      g.fillRect(x - 1, y - 1, 2, 2);
  });
  const face = m.plane(0.38, 0.665, painted(tex), [0.01, 0.65, 0.118]);
  face.castShadow = false;
  // The painted panel is a flat decal on the box face; a raised rim of paint keeps it visible when blocky.
  return m;
};

// MARK: Yggdrasil sapling

const BARK = "#6f5a45";
const BARK_DARK = "#4b3b2c";

const yggdrasil = (): Model => {
  const m = new Model();
  const trunkR = (y: number) => 0.21 - 0.1 * Math.min(1, y / 1.9);
  // A mossy mound and a pool of gold light under the leaves.
  disc(m, 1.0, 0.7, 0, 0.012, "#4f6b3a");
  disc(m, 0.75, 0.52, 0.012, 0.01, "#5a7d3e");
  const pool = m.cyl(1.1, 0.004, glow("#ffd36a"), [0, 0.02, 0.05], 1.1, 24);
  pool.scale.z = 0.55;
  (pool.material as { transparent: boolean; opacity: number }).transparent = true;
  (pool.material as { opacity: number }).opacity = 0.2;
  // The trunk, in four slightly leaning drums with darker knots and bands.
  const drums: [number, number, number, number, number][] = [
    [0, 0.21, 0.17, 0.55, 0],
    [0.5, 0.17, 0.14, 0.5, 0.025],
    [1.0, 0.14, 0.11, 0.5, -0.015],
    [1.5, 0.11, 0.08, 0.45, 0.02],
  ];
  for (const [y, r0, r1, h, dx] of drums) {
    m.cyl(r0, h, BARK, [dx, y, 0], r1, 10);
    m.cyl(r0 + 0.006, 0.03, BARK_DARK, [dx, y + 0.02, 0], r0 + 0.006, 10);
  }
  for (const [y, z, r] of [
    [0.35, 0.15, 0.03],
    [1.1, 0.1, 0.022],
    [0.7, -0.12, 0.025],
  ] as const)
    m.ball(r, BARK_DARK, [0.01, y, z], [1, 1.2, 0.5], 6);
  // Roots: five spreading over the mound; the one at the front has been nibbled.
  const root = (a: number, len: number, nib = false) => {
    const r = m.part([0, 0.22, 0], a);
    r.cyl(0.06, len, BARK, [0, 0, 0], 0.025, 7).rotation.z = -(Math.PI / 2 + 0.38);
    if (nib) {
      const end = r.part([
        Math.sin(Math.PI / 2 + 0.38) * len,
        -Math.cos(0.38 + Math.PI / 2 - Math.PI / 2) * 0,
        0,
      ]);
      void end;
    }
  };
  root(0.5, 0.75);
  root(1.9, 0.62);
  root(3.4, 0.7);
  root(4.5, 0.6);
  root(5.5, 0.55);
  // The nibbled root, front and centre: a pale gnawed stub with tooth marks and chips.
  const stub = m.part([0.12, 0.2, 0.12], -0.9);
  stub.cyl(0.055, 0.45, BARK, [0, 0, 0], 0.045, 7).rotation.z = -(Math.PI / 2 + 0.5);
  const tipX = Math.sin(Math.PI / 2 + 0.5) * 0.45;
  const tipY = Math.cos(Math.PI / 2 + 0.5) * 0.45;
  stub.cyl(0.046, 0.05, "#d9c19a", [tipX, tipY - 0.012, 0], 0.03, 7).rotation.z = -(Math.PI / 2 + 0.5);
  for (const dz of [-0.02, 0.02])
    stub.box([0.02, 0.012, 0.008], BARK_DARK, [tipX - 0.035, tipY + 0.0, dz * 2], 0.002);
  for (const [x, z] of [
    [0.5, 0.35],
    [0.58, 0.28],
    [0.42, 0.42],
  ] as const)
    m.box([0.03, 0.012, 0.015], "#d9c19a", [x, 0.014, z], 0.004).rotation.y = x * 5;
  // The boughs, each ending in a cluster of gold leaves.
  const rnd = seeded(33);
  const leaves: { o: THREE.Mesh; base: number; p: number }[] = [];
  const GOLDS = ["#f5c842", "#e9b73d", "#ffe27a", "#f0a830"];
  const cluster = (parent: Model, at: [number, number, number], size: number, n: number) => {
    const g = parent.part(at);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + rnd();
      const rr = i === 0 ? 0 : size * (0.5 + rnd() * 0.6);
      const lc = GOLDS[Math.floor(rnd() * GOLDS.length)]!;
      const o = g.ball(
        size * (0.3 + rnd() * 0.18),
        i % 3 === 0 ? glow(lc) : lc,
        [Math.cos(a) * rr, (rnd() - 0.45) * size * 0.9, Math.sin(a) * rr],
        [1, 0.8, 1],
        6,
      );
      leaves.push({ o, base: 1, p: rnd() * 6 });
    }
  };
  const bough = (y: number, a: number, len: number, lean: number, size: number) => {
    const b = m.part([drums[Math.min(3, Math.floor(y / 0.5))]![4], y, 0], a);
    b.cyl(0.04, len, BARK, [0, 0, 0], 0.014, 7).rotation.z = -lean;
    const tip: [number, number, number] = [Math.sin(lean) * len, Math.cos(lean) * len, 0];
    cluster(b, tip, size, 7);
    // A twig partway along.
    const tw = b.part([Math.sin(lean) * len * 0.5, Math.cos(lean) * len * 0.5, 0]);
    tw.cyl(0.02, len * 0.4, BARK, [0, 0, 0], 0.008, 6).rotation.z = -(lean + 0.7);
    cluster(tw, [Math.sin(lean + 0.7) * len * 0.4, Math.cos(lean + 0.7) * len * 0.4, 0], size * 0.75, 4);
  };
  bough(0.8, 0.3, 0.95, 1.15, 0.3);
  bough(0.95, 1.55, 1.0, 1.2, 0.3);
  bough(1.05, 2.8, 0.95, 1.15, 0.3);
  bough(1.2, 4.1, 1.05, 1.2, 0.3);
  bough(1.35, 5.3, 0.9, 1.1, 0.28);
  bough(1.55, 2.0, 0.75, 0.85, 0.26);
  bough(1.6, 0.9, 0.7, 0.8, 0.26);
  bough(1.7, 3.6, 0.7, 0.8, 0.26);
  // The crown.
  const top = m.part([0.04, 1.92, 0]);
  top.cyl(0.05, 0.4, BARK, [0, 0, 0], 0.02, 7);
  cluster(top, [0, 0.38, 0], 0.4, 10);
  cluster(top, [0, 0.12, 0], 0.5, 10);
  // The eagle on the top bough.
  const eagle = m.part([0.04, 2.38, 0]);
  eagle.scale.setScalar(2.1);
  eagle.ball(0.07, "#5a3d22", [0, 0.07, 0], [0.9, 1.15, 0.9], 8);
  eagle.ball(0.05, "#8a6340", [0, 0.06, 0.032], [0.8, 1, 0.5], 6);
  eagle.box([0.05, 0.13, 0.016], "#4b3220", [-0.06, 0.02, 0], 0.004);
  eagle.box([0.05, 0.13, 0.016], "#4b3220", [0.06, 0.02, 0], 0.004);
  eagle.box([0.05, 0.09, 0.02], "#4b3220", [0, -0.05, -0.04], 0.004).rotation.x = -0.4;
  const head = eagle.part([0, 0.16, 0.01]);
  head.ball(0.042, "#f6f1e6", [0, 0.015, 0], [1, 1, 1], 8);
  head.box([0.026, 0.026, 0.045], GOLD, [0, 0.0, 0.04], 0.006);
  head.box([0.012, 0.016, 0.02], GOLD, [0, -0.014, 0.065], 0.003);
  head.ball(0.008, "#14101c", [0.026, 0.025, 0.028], [1, 1, 1], 4);
  head.ball(0.008, "#14101c", [-0.026, 0.025, 0.028], [1, 1, 1], 4);
  for (const s of [-1, 1]) eagle.box([0.012, 0.03, 0.012], GOLD, [s * 0.025, -0.01, 0.01], 0.002);
  // The squirrel, climbing the trunk head first and back down again.
  const orbit = m.part([0, 0, 0]);
  const sq = orbit.part([0, 0, 0]);
  sq.scale.setScalar(2.2);
  const SQ = "#b4602e";
  sq.ball(0.04, SQ, [0, 0.0, 0.0], [0.8, 1.35, 0.8], 8);
  sq.ball(0.026, "#f3d9b0", [0, -0.005, -0.025], [0.9, 1, 0.4], 6);
  sq.ball(0.032, SQ, [0, 0.07, 0.008], [1, 1, 1], 8);
  sq.box([0.01, 0.026, 0.01], SQ, [0.018, 0.088, 0.0], 0.002);
  sq.box([0.01, 0.026, 0.01], SQ, [-0.018, 0.088, 0.0], 0.002);
  sq.ball(0.007, "#14101c", [0.016, 0.075, 0.034], [1, 1, 1], 4);
  sq.ball(0.007, "#14101c", [-0.016, 0.075, 0.034], [1, 1, 1], 4);
  sq.ball(0.011, "#14101c", [0, 0.065, 0.04], [1, 1, 1], 4);
  const tail = sq.part([0, -0.04, 0.02]);
  tail.ball(0.034, tint(SQ, 0.12), [0, 0.02, 0.04], [0.9, 1.6, 0.9], 8);
  tail.ball(0.03, SQ, [0, 0.09, 0.06], [0.9, 1.5, 0.9], 8);
  tail.ball(0.02, "#f3d9b0", [0, 0.14, 0.05], [1, 1, 1], 6);
  // The little scroll of gossip it carries.
  sq.box([0.012, 0.03, 0.012], "#f4ecd2", [0.03, 0.0, 0.01], 0.003);
  // A few leaves drift down.
  const fall = [0, 1, 2, 3, 4].map((i) =>
    m.box([0.035, 0.006, 0.025], GOLDS[i % GOLDS.length]!, [0, 1, 0], 0.001),
  );
  ticks.push((t) => {
    for (const l of leaves) l.o.scale.setScalar(1 + 0.06 * Math.sin(t * 1.6 + l.p));
    const k = (t / 10) % 1;
    const down = k >= 0.5;
    const e = (x: number) => x * x * (3 - 2 * x);
    let y = 0.32;
    if (k < 0.45) y = 0.32 + 1.1 * e(k / 0.45);
    else if (k < 0.5) y = 1.42 + 0.01 * Math.sin((k - 0.45) * 100);
    else if (k < 0.95) y = 1.42 - 1.1 * e((k - 0.5) / 0.45);
    const a = 0.75 + Math.sin(k * Math.PI * 2) * 0.55;
    const r = trunkR(y) + 0.03;
    orbit.position.set(Math.sin(a) * r, y, Math.cos(a) * r);
    orbit.rotation.y = a;
    sq.rotation.z = down ? Math.PI : 0;
    sq.rotation.x = Math.sin(t * 16) * 0.06;
    tail.rotation.x = Math.sin(t * 5) * 0.2;
    head.rotation.y = Math.sin(t * 0.7) * 0.8;
    fall.forEach((f, i) => {
      const u = (t * 0.12 + i / fall.length) % 1;
      f.position.set(
        Math.sin(i * 2.1) * 0.8 + Math.sin(u * 9 + i) * 0.1,
        2.0 - u * 2.0,
        Math.cos(i * 2.7) * 0.5,
      );
      f.rotation.set(t * 2 + i, t + i, 0);
      f.scale.setScalar(Math.sin(u * Math.PI));
    });
  });
  light(m, [0, 1.9, 0.5], "#ffd36a", 1.4, 4.5);
  return m;
};

export const NORSE_ASSETS: readonly { id: string; name: string; w: number; d: number; build: () => Model }[] =
  [
    { id: "norse-raven-banner", name: "Raven banner", w: 2, d: 1, build: ravenBanner },
    { id: "norse-bearskin-rug", name: "Bearskin rug", w: 2, d: 1, build: bearRug },
    { id: "norse-mead-stump", name: "Mead stump", w: 1, d: 1, build: meadStump },
    { id: "norse-feast-table", name: "Feast table", w: 2, d: 1, build: feastTable },
    { id: "norse-runestone", name: "Painted runestone", w: 1, d: 1, build: runestone },
    { id: "norse-yggdrasil", name: "Yggdrasil sapling", w: 3, d: 1, build: yggdrasil },
  ];
