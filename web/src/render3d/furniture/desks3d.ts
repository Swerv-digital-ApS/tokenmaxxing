/**
 * Desk setups: what sits on a desk, from a laptop up to a battlestation. Ports `DESKS` (core/src/desks.ts)
 * and `deskFrame` (web/src/art/desks.ts): the same five tiers, the same screens (a laptop, two, three, one
 * long curved one, three with a glowing tower and RGB). Cosmetic only. A desk is 2x1 like the shop's
 * `desk`, with the chair on its left tile, and every setup faces +z.
 */
import { C } from "../../art/palette.ts";
import { codeScreen, glow, Model, seeded, ticks, type V3 } from "../kit/kit.ts";
import { light } from "./furniture.ts";

/** Snapshot of `DESKS` in core/src/desks.ts. `price` is the personal one, `fleet` the company wallet's step. */
export const DESK_TIERS = [
  { id: "laptop", name: "Laptop", price: 0, fleet: 0, blurb: "One screen, covered in stickers." },
  { id: "dual", name: "Dual monitors", price: 60, fleet: 300, blurb: "Code on one, docs on the other." },
  { id: "triple", name: "Triple monitors", price: 180, fleet: 700, blurb: "Agents, logs and a dashboard." },
  {
    id: "ultrawide",
    name: "Ultrawide",
    price: 450,
    fleet: 1400,
    level: 25,
    blurb: "One long curved screen, edge to edge.",
  },
  {
    id: "battlestation",
    name: "Battlestation",
    price: 900,
    fleet: 2500,
    level: 40,
    blurb: "Three screens, a glowing tower and RGB everywhere.",
  },
] as const;

const TOP = 0.62;
const BEZEL = "#2b2433";

/** The desk itself, as the shop's: a top, a side panel, a drawer unit. */
function base(m: Model): void {
  const [w, d] = [1.7, 0.7];
  m.box([w, 0.05, d], C.woodLight, [0, TOP, 0], 0.015);
  m.box([0.05, TOP, d - 0.08], C.wood, [-w / 2 + 0.06, 0, 0]);
  m.box([0.4, TOP - 0.02, d - 0.08], C.wood, [w / 2 - 0.24, 0, 0]);
  for (let i = 0; i < 3; i++) {
    m.box([0.36, 0.17, 0.02], C.woodLight, [w / 2 - 0.24, 0.04 + i * 0.19, d / 2 - 0.045]);
    m.box([0.08, 0.015, 0.02], C.metal, [w / 2 - 0.24, 0.13 + i * 0.19, d / 2 - 0.035]);
  }
}

/** A screen on a short stand, turned `turn` about y; returns the group so a tier can tip it. */
function screen(
  m: Model,
  at: V3,
  w: number,
  h: number,
  seed: number,
  turn = 0,
  neon = false,
  stand = true,
): Model {
  const s = m.part(at, turn);
  if (stand) {
    s.box([0.16, 0.012, 0.1], C.metal, [0, 0, 0]);
    s.box([0.03, 0.12 + (h - 0.26) * 0.3, 0.03], C.metal, [0, 0, -0.02]);
  }
  const lift = stand ? 0.1 : 0;
  s.box([w, h, 0.035], BEZEL, [0, lift, 0], 0.012);
  s.plane(w - 0.04, h - 0.04, glow("#fff", codeScreen(seed, neon ? "#1b2140" : "#1b1f2a")), [
    0,
    lift + h / 2,
    0.019,
  ]);
  return s;
}

function keyboard(m: Model, x: number, color: string, z = 0.15): void {
  m.box([0.36, 0.02, 0.12], color, [x, TOP + 0.05, z], 0.008);
}

function laptop(m: Model): void {
  m.box([0.4, 0.02, 0.28], C.metalLight, [-0.3, TOP + 0.05, 0.04], 0.01);
  m.box([0.34, 0.008, 0.12], "#3c4454", [-0.3, TOP + 0.07, 0.07]);
  const lid = m.part([-0.3, TOP + 0.07, -0.09]);
  lid.rotation.x = -0.18;
  lid.box([0.4, 0.28, 0.02], C.metalLight, [0, 0, 0], 0.01);
  lid.plane(0.36, 0.24, glow("#fff", codeScreen(21)), [0, 0.14, 0.0115]);
  // Stickers on the lid's back, where the room sees them from behind a sitter.
  const rnd = seeded(5);
  for (const c of ["#e25d5d", "#f0b53c", "#4f8fe0", "#3ddc84", "#e86bd8"]) {
    const s = lid.plane(0.05 + rnd() * 0.03, 0.04 + rnd() * 0.03, c, [
      (rnd() - 0.5) * 0.28,
      0.06 + rnd() * 0.14,
      -0.0115,
    ]);
    s.rotation.y = Math.PI;
  }
  m.box([0.07, 0.025, 0.1], "#3c4454", [-0.02, TOP + 0.05, 0.15], 0.012);
}

function dual(m: Model): void {
  for (const [x, turn, seed] of [
    [-0.43, 0.14, 31],
    [0.05, -0.14, 32],
  ] as const)
    screen(m, [x, TOP + 0.05, -0.15], 0.44, 0.28, seed, turn);
  keyboard(m, -0.2, "#3c4454");
}

function triple(m: Model): void {
  screen(m, [-0.2, TOP + 0.05, -0.2], 0.46, 0.34, 41);
  screen(m, [-0.66, TOP + 0.05, -0.12], 0.4, 0.26, 42, 0.5);
  screen(m, [0.26, TOP + 0.05, -0.12], 0.4, 0.26, 43, -0.5);
  keyboard(m, -0.2, "#3c4454");
}

function ultrawide(m: Model): void {
  // Five slim segments on an arc, so it curves round the sitter.
  const n = 5;
  const seg = 0.25;
  for (let i = 0; i < n; i++) {
    const a = (i - (n - 1) / 2) * 0.2;
    const s = screen(
      m,
      [-0.2 + Math.sin(a) * 0.62, TOP + 0.05, -0.12 - (1 - Math.cos(a)) * 0.62 - 0.1],
      seg,
      0.3,
      50 + i,
      -a,
      false,
      i === 2,
    );
    if (i !== 2) s.position.y += 0.1;
  }
  keyboard(m, -0.2, "#3c4454");
}

function battlestation(m: Model): void {
  screen(m, [-0.2, TOP + 0.05, -0.2], 0.46, 0.34, 61, 0, true);
  screen(m, [-0.68, TOP + 0.05, -0.12], 0.4, 0.26, 62, 0.5, true);
  screen(m, [0.28, TOP + 0.05, -0.12], 0.4, 0.26, 63, -0.5, true);
  // The tower on the desk top at the right end, glass-sided, with its lit fans.
  m.box([0.2, 0.42, 0.34], "#1b1f2a", [0.64, TOP + 0.05, 0], 0.02);
  m.box([0.01, 0.36, 0.28], "#2b3140", [0.747, TOP + 0.08, 0], 0.004);
  const fans = [0, 1, 2].map((i) => {
    const mat = glow("#5ff2ff");
    m.cyl(0.05, 0.012, mat, [0.759, TOP + 0.13 + i * 0.11, 0.0], 0.05, 12).rotation.z = Math.PI / 2;
    return mat;
  });
  keyboard(m, -0.2, "#b58cf0");
  // An RGB strip under the desk top, two colours trading places.
  const strip = Array.from({ length: 10 }, (_, i) => {
    const mat = glow("#5ff2ff");
    m.box([0.1, 0.012, 0.012], mat, [-0.8 + i * 0.1, TOP - 0.012, 0.345], 0.002);
    return mat;
  });
  ticks.push((t) => {
    const flip = Math.floor(t * 2) % 2;
    strip.forEach((mat, i) => {
      mat.color.set((i + flip) % 2 ? "#ff6ad5" : "#5ff2ff");
    });
    fans.forEach((mat, i) => {
      mat.color.set((i + flip) % 2 ? "#ff6ad5" : "#5ff2ff");
    });
  });
  light(m, [0, TOP + 0.3, 0.3], "#b58cf0", 1.2, 2.5);
}

const BUILDERS = [laptop, dual, triple, ultrawide, battlestation] as const;

/**
 * The desk at tier `tier` (an index in `DESK_TIERS`; anything unknown is the laptop), with its screens
 * showing agents at work. Same footprint as the shop's desk (2x1); the chair goes on the left tile.
 */
export function deskTier(tier: number): Model {
  const i = Number.isInteger(tier) && tier >= 0 && tier < BUILDERS.length ? tier : 0;
  const m = new Model();
  base(m);
  BUILDERS[i]!(m);
  return m;
}
