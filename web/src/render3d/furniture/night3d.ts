/**
 * The Night Market case's furniture in 3D (`CASE_PIECES` in core/src/case-furniture.ts), the same pieces as
 * `furniture-home.ts` draws in 2D: paper lanterns, a koi rug, a tea stool, a ramen counter, a claw machine
 * and a torii gate. Built like the rest of `furniture3d.ts`: bottom centre at the origin, front along +z.
 * The lantern string hangs on a wall, so it is built on y = 0 against it.
 */
import { C } from "../../art/palette.ts";
import { glass, glow, Model, ticks, tint } from "../kit/kit.ts";
import { light } from "./furniture.ts";

const RED = "#d8402f";
const LACQUER = "#23202b";
const GOLD = "#e9b73d";
const PAPER = "#fff1c9";
const PINK = "#ff5fa2";
const NAVY = "#2b3358";
const TEAK = "#a8683a";
const TEAK_DARK = "#7c4a28";
const TEAK_LIGHT = "#c98a55";
const CREAM = "#efe6d2";
const TEAL = "#2f7f9a";

/** A flat elliptic disc lying on the floor. */
function disc(m: Model, rx: number, rz: number, y: number, h: number, color: string): void {
  const d = m.cyl(rx, h, color, [0, y, 0], rx, 32);
  d.scale.z = rz / rx;
}

/** A lit paper lantern hanging from `top`, with a gold cap, ribs and a tassel; it flickers a little. */
function lantern(m: Model, x: number, top: number, color: string, size = 1, phase = 0): void {
  const r = 0.11 * size;
  const mat = glow(color);
  m.cyl(0.02 * size, 0.06 * size, GOLD, [x, top - 0.06 * size, 0], 0.02 * size, 6);
  const body = m.ball(r, mat, [x, top - 0.06 * size - r * 1.1, 0], [1, 1.2, 1], 12);
  m.cyl(r * 0.55, 0.025 * size, GOLD, [x, top - 0.06 * size - r * 0.1, 0], r * 0.55, 10);
  m.cyl(r * 0.55, 0.025 * size, GOLD, [x, top - 0.06 * size - r * 2.2, 0], r * 0.55, 10);
  for (const dy of [-0.3, 0.3])
    m.box(
      [r * 2.05, 0.008, 0.008],
      tint(color, -0.35),
      [x, top - 0.06 * size - r * 1.1 + r * 1.2 * dy, r * 0.95],
      0.002,
    );
  m.cyl(0.006 * size, 0.1 * size, GOLD, [x, top - 0.06 * size - r * 2.2 - 0.1 * size, 0], 0.006 * size, 4);
  ticks.push((t) => body.scale.set(1, 1.2 + 0.03 * Math.sin(t * 5 + phase), 1));
}

const lanternString = (): Model => {
  const m = new Model();
  const y = 1.95;
  const sag = (x: number) => -0.16 * Math.sin(((x + 0.95) / 1.9) * Math.PI);
  // Two hooks and a cord sagging between them, in short straight runs.
  for (const x of [-0.95, 0.95]) m.cyl(0.03, 0.08, GOLD, [x, y - 0.04, 0.03], 0.03, 6);
  const n = 12;
  for (let i = 0; i < n; i++) {
    const x0 = -0.95 + (1.9 * i) / n;
    const x1 = -0.95 + (1.9 * (i + 1)) / n;
    const y0 = y + sag(x0);
    const y1 = y + sag(x1);
    const seg = m.box(
      [Math.hypot(x1 - x0, y1 - y0) + 0.01, 0.014, 0.014],
      C.ink,
      [(x0 + x1) / 2, (y0 + y1) / 2, 0.03],
      0.003,
    );
    seg.rotation.z = Math.atan2(y1 - y0, x1 - x0);
  }
  const colours = [RED, "#f08a3c", PINK, "#f5d14a", RED];
  for (const [i, x] of [-0.8, -0.4, 0, 0.4, 0.8].entries()) lantern(m, x, y + sag(x), colours[i]!, 1, i);
  light(m, [0, y - 0.3, 0.4], "#ffb347", 1.2, 3);
  return m;
};

const koiRug = (): Model => {
  const m = new Model();
  const layers: [number, string][] = [
    [0.96, LACQUER],
    [0.92, RED],
    [0.86, PAPER],
    [0.8, "#1f5470"],
    [0.68, TEAL],
  ];
  for (const [i, [r, c]] of layers.entries()) disc(m, r, r * 0.5, 0, 0.012 + i * 0.004, c);
  const top = 0.012 + 4 * 0.004 + 0.004;
  // Two lily pads and their blossoms.
  for (const [x, z, f] of [
    [-0.55, 0.12, PINK],
    [0.58, -0.08, "#f5d14a"],
  ] as const) {
    m.cyl(0.07, 0.008, "#3ddc84", [x, top, z], 0.07, 10);
    m.ball(0.02, f, [x, top + 0.02, z], [1, 0.8, 1], 6);
  }
  // A ripple.
  m.cyl(0.2, 0.004, "#5cb7c9", [-0.1, top, 0.18], 0.2, 20).scale.z = 0.5;
  m.cyl(0.16, 0.006, TEAL, [-0.1, top, 0.18], 0.16, 20).scale.z = 0.5;
  // The koi: an orange one swimming right, a white one with red patches swimming left.
  const koi = (x: number, z: number, dir: 1 | -1, body: string, patch: string) => {
    const k = m.part([x, top + 0.03, z], dir === 1 ? 0 : Math.PI);
    k.ball(0.09, body, [0, 0, 0], [1.6, 0.5, 0.65], 10);
    k.ball(0.045, patch, [0.02, 0.025, 0], [1.3, 0.4, 0.7], 8);
    const tail = k.box([0.12, 0.012, 0.07], body, [-0.17, -0.005, 0], 0.004);
    tail.rotation.y = 0.5;
    const fin = k.box([0.05, 0.01, 0.07], patch, [0.02, 0, 0.07], 0.003);
    fin.rotation.y = -0.5;
    k.ball(0.012, C.ink, [0.12, 0.02, 0.04], [1, 1, 1], 4);
    k.ball(0.012, C.ink, [0.12, 0.02, -0.04], [1, 1, 1], 4);
    ticks.push((t) => {
      tail.rotation.y = 0.5 * Math.sin(t * 4 + x * 3);
    });
  };
  koi(-0.25, -0.12, 1, "#f08a3c", RED);
  koi(0.3, 0.2, -1, "#f6f1e8", RED);
  return m;
};

const teaStool = (): Model => {
  const m = new Model();
  for (const [x, z] of [
    [0, -0.12],
    [-0.11, 0.07],
    [0.11, 0.07],
  ] as const) {
    const leg = m.cyl(0.025, 0.4, TEAK_DARK, [x * 1.1, 0, z * 1.1], 0.02, 7);
    leg.rotation.set(z === -0.12 ? 0.1 : -0.05, 0, -x * 0.5);
  }
  m.cyl(0.14, 0.02, TEAK_DARK, [0, 0.2, 0], 0.1, 12);
  m.cyl(0.2, 0.06, TEAK, [0, 0.38, 0], 0.2, 18);
  m.cyl(0.18, 0.03, RED, [0, 0.44, 0], 0.17, 18);
  // A saucer, a teacup with tea in it, and its steam.
  m.cyl(0.07, 0.008, CREAM, [0, 0.47, 0], 0.07, 12);
  m.cyl(0.045, 0.06, CREAM, [0, 0.478, 0], 0.035, 12);
  m.cyl(0.04, 0.004, "#a8682a", [0, 0.534, 0], 0.04, 12);
  m.box([0.03, 0.025, 0.012], CREAM, [0.065, 0.5, 0], 0.005);
  const steam = [0, 1, 2].map(() => m.ball(0.015, "#ffffff", [0, 0.56, 0], [1, 1, 1], 5));
  ticks.push((t) =>
    steam.forEach((s, i) => {
      const u = (t * 0.5 + i / 3) % 1;
      s.position.set(Math.sin(u * 6 + i) * 0.015, 0.545 + u * 0.14, 0);
      s.scale.setScalar(1 - u * 0.6);
    }),
  );
  return m;
};

const ramenCounter = (): Model => {
  const m = new Model();
  // The counter: a dark front with a red stripe, a plank top, a shelf of two bowls.
  m.box([1.9, 0.62, 0.44], TEAK_DARK, [0, 0, 0.05], 0.02);
  m.box([1.96, 0.05, 0.5], TEAK_LIGHT, [0, 0.62, 0.05], 0.015);
  m.box([1.82, 0.1, 0.01], RED, [0, 0.36, 0.275], 0.002);
  m.box([1.82, 0.012, 0.012], GOLD, [0, 0.35, 0.28], 0.002);
  for (const x of [-0.6, 0, 0.6]) m.box([0.012, 0.52, 0.01], C.ink, [x, 0.04, 0.275], 0.002);
  // The frame and awning: two posts, a red beam with lit bulbs, and a noren curtain of three flaps.
  for (const x of [-0.95, 0.95]) m.box([0.07, 1.5, 0.07], TEAK_DARK, [x, 0, -0.12], 0.01);
  m.box([2.0, 0.2, 0.34], RED, [0, 1.5, -0.04], 0.02);
  m.box([2.0, 0.03, 0.34], tint(RED, 0.25), [0, 1.69, -0.04], 0.01);
  const bulbs = [-0.8, -0.4, 0, 0.4, 0.8].map((x) =>
    m.ball(0.025, glow("#ffd36a"), [x, 1.5, 0.14], [1, 1, 1], 6),
  );
  ticks.push((t) => {
    for (const [i, b] of bulbs.entries()) b.scale.setScalar(Math.floor(t * 2 + i) % 2 ? 1.2 : 0.8);
  });
  for (const x of [-0.55, 0, 0.55]) {
    const flap = m.box([0.46, 0.5, 0.012], NAVY, [x, 1.0, 0.12], 0.003);
    m.box([0.08, 0.22, 0.014], CREAM, [x, 1.14, 0.13], 0.003);
    m.box([0.22, 0.04, 0.014], CREAM, [x, 1.2, 0.13], 0.003);
    ticks.push((t) => {
      flap.rotation.x = 0.04 * Math.sin(t * 1.3 + x * 4);
    });
  }
  // Two bowls of ramen with chopsticks, steaming.
  const steams: [Model, number][] = [];
  for (const x of [-0.6, 0.55]) {
    m.cyl(0.07, 0.015, LACQUER, [x, 0.67, 0.1], 0.07, 12);
    m.cyl(0.13, 0.1, CREAM, [x, 0.68, 0.1], 0.08, 14);
    m.cyl(0.12, 0.012, "#e8b04a", [x, 0.776, 0.1], 0.12, 14);
    m.ball(0.04, RED, [x - 0.04, 0.79, 0.12], [1, 0.3, 1], 6);
    m.ball(0.03, "#3ddc84", [x + 0.05, 0.79, 0.08], [1, 0.3, 1], 6);
    m.ball(0.035, "#fff7e6", [x + 0.02, 0.8, 0.14], [1, 0.4, 1], 6);
    for (const dz of [0, 0.03]) {
      const c = m.box([0.2, 0.008, 0.008], GOLD, [x + 0.07, 0.8 + dz, 0.12 - dz], 0.002);
      c.rotation.set(0, 0.25, 0.4);
    }
    const s = m.part([x, 0.82, 0.1]);
    for (const i of [0, 1, 2]) s.ball(0.015, "#ffffff", [0, i * 0.05, 0], [1, 1, 1], 5);
    steams.push([s, x]);
  }
  ticks.push((t) => {
    for (const [s, x] of steams) {
      for (const [i, c] of s.children.entries()) {
        const u = (t * 0.45 + i / 3 + x) % 1;
        c.position.set(Math.sin(u * 7 + i) * 0.02, u * 0.22, 0);
        c.scale.setScalar(1 - u * 0.6);
      }
    }
  });
  lantern(m, 0.82, 1.3, "#f08a3c", 0.9, 1);
  light(m, [0, 1.0, 0.5], "#ffb347", 1.2, 3);
  return m;
};

const clawMachine = (): Model => {
  const m = new Model();
  const W = 0.78;
  const D = 0.68;
  // The cabinet: a navy base with the chute, glass box above, pink marquee on top.
  m.box([W, 0.7, D], NAVY, [0, 0, 0], 0.02);
  m.box([0.34, 0.2, 0.02], LACQUER, [0, 0.06, D / 2 + 0.002], 0.005);
  // The slanted control panel: joystick, two buttons, coin slot.
  const panel = m.part([0, 0.72, D / 2 - 0.02]);
  panel.box([W + 0.02, 0.03, 0.2], LACQUER, [0, -0.02, 0.04], 0.005).rotation.x = -0.15;
  panel.cyl(0.008, 0.07, "#cfd6df", [-0.2, 0, 0.06], 0.008, 6);
  panel.ball(0.03, RED, [-0.2, 0.08, 0.06], [1, 1, 1], 8);
  panel.cyl(0.025, 0.015, "#f5d14a", [0.05, 0, 0.07], 0.025, 10);
  panel.cyl(0.025, 0.015, "#4f8fe0", [0.16, 0, 0.07], 0.025, 10);
  panel.box([0.04, 0.012, 0.015], GOLD, [0.26, 0.005, 0.09], 0.002);
  for (const [sx, sz] of [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
  ] as const)
    m.box([0.04, 1.1, 0.04], "#cfd6df", [sx * (W / 2 - 0.02), 0.72, sz * (D / 2 - 0.02)], 0.005);
  m.box([W - 0.06, 0.93, D - 0.06], glass("#a8dcf7", 0.28), [0, 0.76, 0], 0.01);
  m.box([W, 0.05, D], NAVY, [0, 0.72, 0], 0.01);
  m.box([W + 0.04, 0.26, D + 0.04], PINK, [0, 1.7, 0], 0.03);
  const bulbs = Array.from({ length: 7 }, (_, i) =>
    m.ball(0.022, glow("#ffd36a"), [-0.3 + i * 0.1, 1.82, D / 2 + 0.03], [1, 1, 0.6], 6),
  );
  ticks.push((t) => {
    for (const [i, b] of bulbs.entries()) b.scale.setScalar((Math.floor(t * 3) + i) % 2 ? 1.25 : 0.7);
  });
  m.box([0.5, 0.1, 0.01], LACQUER, [0, 1.74, D / 2 + 0.025], 0.003);
  for (const [x, c] of [
    [-0.18, "#f5d14a"],
    [-0.06, PINK],
    [0.06, "#3ddc84"],
    [0.18, "#4f8fe0"],
  ] as const)
    m.box([0.07, 0.05, 0.012], c, [x, 1.765, D / 2 + 0.032], 0.003);
  // The prizes: a pile of plush balls and bears at the bottom.
  const rnd = [
    [-0.25, 0.8, -0.05, "#ff5fa2"],
    [-0.1, 0.8, 0.1, "#f5d14a"],
    [0.1, 0.8, -0.1, "#3ddc84"],
    [0.25, 0.8, 0.08, "#f6f1e8"],
    [0, 0.8, 0, "#9b6fd6"],
    [-0.18, 0.95, 0.04, "#f6f1e8"],
    [0.18, 0.95, -0.02, "#ff5fa2"],
  ] as const;
  for (const [x, y, z, c] of rnd) {
    m.ball(0.1, c, [x, y + 0.06, z], [1, 0.95, 1], 10);
    m.ball(0.04, c, [x - 0.06, y + 0.15, z], [1, 1, 1], 6);
    m.ball(0.04, c, [x + 0.06, y + 0.15, z], [1, 1, 1], 6);
  }
  // The claw: a rail across the top, a carriage that slides, and the claw on its cable.
  m.box([W - 0.1, 0.03, 0.03], "#cfd6df", [0, 1.55, 0], 0.005);
  const carriage = m.part([0, 1.55, 0]);
  carriage.box([0.1, 0.06, 0.1], GOLD, [0, -0.03, 0], 0.01);
  carriage.cyl(0.006, 0.28, "#cfd6df", [0, -0.3, 0], 0.006, 5);
  const claw = carriage.part([0, -0.34, 0]);
  claw.cyl(0.03, 0.04, GOLD, [0, 0, 0], 0.03, 8);
  for (const s of [-1, 1]) {
    const arm = claw.box([0.012, 0.12, 0.012], "#cfd6df", [s * 0.045, -0.12, 0], 0.002);
    arm.rotation.z = s * 0.35;
  }
  ticks.push((t) => {
    carriage.position.x = Math.sin(t * 0.9) * 0.22;
    claw.position.y = -0.34 - 0.06 * Math.max(0, Math.sin(t * 1.8));
  });
  light(m, [0, 1.2, 0.6], PINK, 1.2, 3);
  return m;
};

const torii = (): Model => {
  const m = new Model();
  const X = 1.1;
  // Two pillars on black stone bases with gold rings, leaning in a little at the top.
  for (const s of [-1, 1]) {
    m.cyl(0.17, 0.12, LACQUER, [s * X, 0, 0], 0.15, 14);
    m.cyl(0.115, 2.0, RED, [s * X, 0.12, 0], 0.095, 14).rotation.z = -s * 0.012;
    m.cyl(0.125, 0.03, GOLD, [s * X, 0.13, 0], 0.125, 14);
    m.cyl(0.1, 0.03, LACQUER, [s * X, 0.9, 0], 0.1, 14);
  }
  // The tie beam, the plaque, then the shimaki and the black curling kasagi on top.
  m.box([2.7, 0.14, 0.14], RED, [0, 1.65, 0], 0.02);
  m.box([0.04, 0.34, 0.12], RED, [0, 1.79, 0], 0.01);
  m.box([0.34, 0.4, 0.05], LACQUER, [0, 1.65, 0.09], 0.01);
  m.box([0.28, 0.34, 0.01], GOLD, [0, 1.68, 0.118], 0.002);
  m.box([0.17, 0.035, 0.012], LACQUER, [0, 1.96, 0.124], 0.002);
  m.box([0.035, 0.2, 0.012], LACQUER, [0, 1.76, 0.124], 0.002);
  m.box([0.15, 0.03, 0.012], LACQUER, [0, 1.86, 0.124], 0.002);
  m.box([3.0, 0.1, 0.22], RED, [0, 1.98, 0], 0.02);
  m.box([3.5, 0.13, 0.3], LACQUER, [0, 2.1, 0], 0.025);
  for (const s of [-1, 1]) {
    const tip = m.box([0.42, 0.1, 0.28], LACQUER, [s * 1.77, 2.12, 0], 0.02);
    tip.rotation.z = s * 0.28;
    m.box([0.04, 0.04, 0.3], GOLD, [s * 1.63, 2.19, 0], 0.005);
  }
  m.box([3.3, 0.03, 0.28], "#3a3646", [0, 2.23, 0], 0.005);
  // Lanterns hang inside the gate from the tie beam; a pair of small ones hangs from the kasagi ends.
  lantern(m, -0.6, 1.65, RED, 1.4, 0);
  lantern(m, 0.6, 1.65, RED, 1.4, 2);
  lantern(m, -1.56, 2.08, PINK, 0.9, 1);
  lantern(m, 1.56, 2.08, PINK, 0.9, 3);
  // A pool of light on the ground between the pillars, and two stone lanterns' worth of glow.
  const pool = m.cyl(1.0, 0.004, glow("#ffd36a"), [0, 0.003, 0.2], 1.0, 24);
  pool.scale.z = 0.35;
  (pool.material as { transparent: boolean; opacity: number }).transparent = true;
  (pool.material as { opacity: number }).opacity = 0.28;
  light(m, [0, 1.4, 0.8], "#ffb347", 1.6, 4.5);
  return m;
};

export const NIGHT_ASSETS: readonly { id: string; name: string; w: number; d: number; build: () => Model }[] =
  [
    { id: "night-lanterns", name: "Lantern string", w: 2, d: 1, build: lanternString },
    { id: "night-koi-rug", name: "Koi rug", w: 2, d: 1, build: koiRug },
    { id: "night-tea-stool", name: "Tea stool", w: 1, d: 1, build: teaStool },
    { id: "night-ramen-counter", name: "Ramen counter", w: 2, d: 1, build: ramenCounter },
    { id: "night-claw-machine", name: "Arcade claw machine", w: 1, d: 1, build: clawMachine },
    { id: "night-torii", name: "Torii gate", w: 3, d: 1, build: torii },
  ];
