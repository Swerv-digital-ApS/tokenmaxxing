/**
 * The ducks, the dragons and the loot pets (sand golem, goldfish, ghost, piggy bank, Singularity orb) as voxel
 * sculptures, on the same `petvox` grid as the four-legged ones.
 */
import type * as THREE from "three";
import { light } from "../furniture/furniture.ts";
import { Model, type V3 } from "../kit/kit.ts";
import { bake, type Cell, darken, eye, Grid, hash, lighten, mix, type Rig, VOX } from "./petvox.ts";

const SIDES = [-1, 1] as const;
const U = (n: number) => n * VOX;
const DARK = "#14101c";
const GLINT = "#f4f6ff";
const mixed = (a: string, b: string, p: Cell, seed: number, k = 0.3) =>
  hash(p.x, p.y, p.z, seed) < k * 0.8 ? mix(a, b, 0.55) : a;

/** A mesh from a grid, placed at `at` (cells), its origin on `origin` (cells). */
function put(
  parent: THREE.Object3D,
  g: Grid,
  at: V3,
  origin: V3 = [0, 0, 0],
  seed = 0,
  opacity = 1,
): THREE.Mesh {
  const m = bake(g, { origin, seed, opacity });
  m.position.set(U(at[0]), U(at[1]), U(at[2]));
  parent.add(m);
  return m;
}

// MARK: Duck

type DuckPart = "body" | "wing" | "head" | "neck" | "tail" | "bill";
interface DuckSpec {
  coat: (part: DuckPart, c: Cell) => string;
  /** The whole bird's size, and its head's on top of that. */
  k: number;
  hk: number;
  eyes: string[][];
  feet: string;
  ghost?: boolean;
  extra?: (g: { body: Grid; head: Grid; k: number }) => void;
  fluff?: number;
}

const duckBase = (): DuckSpec => ({
  k: 1,
  hk: 1,
  eyes: [
    [DARK, GLINT],
    [DARK, DARK],
  ],
  feet: "#f08a3c",
  coat: (part, c) => {
    const y = "#f5d14a";
    if (part === "bill") return c.t < 0.42 ? "#e07a2c" : "#f59a42";
    if (part === "wing") return c.u > 0.55 ? "#d8aa30" : mixed("#e8bf3c", "#d8aa30", c, 4, 0.5);
    if (part === "tail") return "#e0b83a";
    if (part === "head" || part === "neck") return mixed(y, "#ffe27a", c, 2, 0.25);
    return c.t < 0.3 ? mixed("#fbe28a", y, c, 3, 0.3) : mixed(y, "#ffe27a", c, 3, 0.3);
  },
});

const ducks: Record<string, () => DuckSpec> = {
  "": duckBase,
  mallard: () => ({
    ...duckBase(),
    feet: "#e8932f",
    coat: (part, c) => {
      const g = "#8c8077";
      const green = "#3f8a57";
      if (part === "bill") return c.t < 0.42 ? "#d9a02a" : "#f2b13b";
      if (part === "head") return c.u < 0.15 ? "#2f6e44" : mixed(green, "#4aa068", c, 2, 0.3);
      if (part === "neck") return c.t > 0.5 ? "#fbf7ef" : mixed(green, "#4aa068", c, 2, 0.3);
      if (part === "tail") return c.t > 0.5 ? "#2a2832" : "#6f655d";
      if (part === "wing") {
        // The blue speculum, edged in white.
        if (c.u > 0.45 && c.u < 0.7 && c.t > 0.3 && c.t < 0.75)
          return c.u < 0.5 || c.u > 0.65 ? "#fbf7ef" : "#3a5fc0";
        return mixed("#6f655d", "#8c8077", c, 5, 0.4);
      }
      if (c.u > 0.65 && c.t > 0.3) return mixed("#7a4a2e", "#8a5a3a", c, 6, 0.3);
      return c.t < 0.3 ? mixed("#b3a99f", g, c, 7, 0.3) : mixed(g, "#9a8e84", c, 7, 0.4);
    },
  }),
  rubber: () => ({
    ...duckBase(),
    hk: 1.15,
    feet: "#ff6a00",
    coat: (part, c) => {
      if (part === "bill") return c.t < 0.42 ? "#ff5a00" : "#ff7a10";
      if (part === "wing") return "#f2b400";
      return "#ffd000";
    },
    extra: ({ body, head }) => {
      // A white glint on the head and the back.
      head.set(-2, 6, 0, "#fff6c0");
      head.set(-2, 5, 0, "#fff6c0");
      body.set(-4, 10, -3, "#fff6c0");
      body.set(-4, 9, -3, "#fff6c0");
    },
  }),
  pekin: () => ({
    ...duckBase(),
    coat: (part, c) => {
      if (part === "bill") return c.t < 0.42 ? "#e9782a" : "#f58f3c";
      if (part === "wing") return mixed("#d9d3c8", "#bfb8ad", c, 4, 0.5);
      if (part === "tail") return "#efe8da";
      return mixed("#f7f2e6", "#ece5d6", c, 3, 0.3);
    },
  }),
  swedish: () => ({
    ...duckBase(),
    eyes: [
      ["#ffffff", "#ffffff"],
      ["#ffffff", DARK],
    ],
    coat: (part, c) => {
      const b = "#3b4762";
      if (part === "bill") return c.t < 0.42 ? "#6a7488" : "#8a94a8";
      if (part === "wing") return mixed("#2e384e", "#3b4762", c, 4, 0.4);
      if (part === "head") return c.t > 0.65 ? "#7f93bd" : mixed(b, "#46547a", c, 2, 0.3);
      if (part === "neck") return mixed(b, "#46547a", c, 2, 0.3);
      if (part === "tail") return "#2e384e";
      // The white bib.
      if (c.u > 0.62 && c.t > 0.25 && c.t < 0.75 && Math.abs(c.s) < 0.7)
        return mixed("#fbf7ef", "#e9e4dc", c, 6, 0.3);
      return mixed(b, "#46547a", c, 3, 0.35);
    },
  }),
  duckling: () => ({
    ...duckBase(),
    k: 0.72,
    hk: 1.28,
    fluff: 0.18,
    coat: (part, c) => {
      const y = "#f7e08a";
      if (part === "bill") return c.t < 0.42 ? "#e9a04a" : "#f5b35a";
      if (part === "wing") return mixed("#e8c862", "#f0d474", c, 4, 0.5);
      return mixed(y, "#fff0b0", c, 3, 0.35);
    },
    extra: ({ head }) => {
      head.tube(
        [
          [0, 7, 0],
          [0, 9, -0.5],
        ],
        0.6,
        0.4,
        "#f7e08a",
      );
    },
  }),
  ghost: () => ({
    ...duckBase(),
    ghost: true,
    eyes: [
      ["#3a3540", "#3a3540"],
      ["#3a3540", "#3a3540"],
      ["#3a3540", "#3a3540"],
    ],
    coat: (part, c) =>
      part === "bill"
        ? "#fdf5e6"
        : part === "wing"
          ? mixed("#d8d4e0", "#e8e4f0", c, 4, 0.5)
          : mixed("#fbf7ef", "#eeeaf6", c, 3, 0.3),
  }),
};

export function duck(variant: string): { rig: Rig; body: Model; fore: Model } {
  const s = (ducks[variant] ?? ducks[""]!)();
  const k = s.k;
  const hk = s.hk;
  const body = new Model();
  const fore = new Model();
  const bg = new Grid();
  const cy = 6.6 * k + 1.5;
  bg.ell(0, cy, 0, 6.2 * k, 4.6 * k, 7.6 * k, "#fff", 2.4);
  bg.ell(0, cy + 0.8 * k, 4.5 * k, 4.6 * k, 4.2 * k, 3.6 * k, "#fff", 2.4);
  const neckTop = cy + 4.2 * k;
  bg.tube(
    [
      [0, cy + 2 * k, 5.2 * k],
      [0, neckTop, 6.2 * k],
    ],
    2.9 * k,
    2.5 * k,
    "#fff",
  );
  // Wings: a feathered oval at each side, pointed at the back.
  for (const sd of SIDES) {
    bg.ell(sd * 6.3 * k, cy + 0.4 * k, -0.8 * k, 1.1 * k, 3.4 * k, 5.2 * k, "#fff", 2.4);
    bg.ell(sd * 6.1 * k, cy - 0.6 * k, -5.4 * k, 0.9 * k, 1.6 * k, 2.6 * k, "#fff", 2.2);
  }
  bg.paint((c) => {
    const wing = Math.abs(c.x) >= 6 * k - 0.5 && c.z < 4 * k;
    const part: DuckPart = wing ? "wing" : c.y > neckTop - 2.5 * k && c.z > 4 * k ? "neck" : "body";
    // Within the wing, u runs along the bird; remap it so the feather tips fall to the rear.
    return s.coat(part, wing ? { ...c, u: 1 - c.u } : c);
  });
  if (s.fluff) bg.fluff(s.fluff, 5, 0.1);
  s.extra?.({ body: bg, head: new Grid(), k });
  // Head on its neck: pivot where the neck ends.
  const head = new Model();
  const hg = new Grid();
  const hr = 3.7 * k * hk;
  hg.ell(0, hr * 0.6, hr * 0.2, hr, hr * 0.92, hr * 1.05, "#fff", 2.3);
  hg.paint((c) => s.coat("head", c));
  const bw = Math.max(2, Math.round(2.3 * k * hk));
  const bl = Math.round(4 * k * hk);
  const by = Math.round(hr * 0.45);
  const bz = Math.round(hr * 1.0);
  const bill = new Grid();
  bill.box(-bw, bw, 0, 0, 0, bl, "#fff");
  bill.box(-bw + 1, bw - 1, 1, 1, 0, bl - 1, "#fff");
  bill.set(-1, 2, bl - 2, "#fff");
  bill.set(1, 2, bl - 2, "#fff");
  bill.paint((c) =>
    Math.abs(c.x) < 1 && c.y === 1 && c.z > bl - 3
      ? mix(s.coat("bill", c), "#14101c", 0.5)
      : s.coat("bill", c),
  );
  hg.merge(bill, 0, by - 1, bz);
  s.extra?.({ body: new Grid(), head: hg, k });
  put(head, hg, [0, 0, 0], [0, 0, 0], 2, s.ghost ? 0.6 : 1);
  const hy = neckTop - 0.5 * k;
  const hz = 6.2 * k;
  head.position.set(U(0), U(hy), U(hz));
  body.add(head);
  put(body, bg, [0, 0, 0], [0, 0, 0], 1, s.ghost ? 0.6 : 1);
  // Eyes at the sides of the head.
  const eyes: THREE.Mesh[] = [];
  const eh = s.eyes.length;
  for (const sd of SIDES) {
    const e = eye(s.eyes);
    const ey = hr * 0.8;
    // Flush against the side of the skull.
    let sx = 0;
    hg.each((cx, cy2, cz) => {
      if (cz === Math.round(hr * 0.5) && cy2 === Math.round(ey) && cx * sd > sx * sd) sx = cx;
    });
    e.rotation.y = sd * (Math.PI / 2);
    e.position.set(U(sd * (Math.abs(sx) + 0.55)), U(ey - (eh - 1) / 2 + 0.5), U(hr * 0.5));
    head.add(e);
    eyes.push(e);
  }
  // Tail tuft and feet.
  const tail = new Model();
  const tg = new Grid();
  tg.tube(
    [
      [0, 0, 0],
      [0, 1.2 * k, -2.5 * k],
      [0, 3 * k, -3.6 * k],
    ],
    2.2 * k,
    1.1 * k,
    "#fff",
  );
  tg.paint((c) => s.coat("tail", c));
  put(tail, tg, [0, 0, 0], [0, 0, 0], 3, s.ghost ? 0.6 : 1);
  tail.position.set(0, U(cy + 0.3 * k), U(-7 * k));
  body.add(tail);
  const feet: THREE.Mesh[] = [];
  if (!s.ghost)
    for (const sd of SIDES) {
      const fg = new Grid();
      const fw = Math.max(1, Math.round(1.5 * k));
      fg.box(-fw, fw, 0, 0, -1, 3, s.feet);
      for (const t of [-fw, 0, fw]) fg.set(t, 0, 4, darken(s.feet, 0.1));
      const m = put(fore, fg, [sd * 3.2 * k, 0, 1.5 * k], [0, -0.5, 0], 4);
      feet.push(m);
      // A short shank up into the body.
      const sg = new Grid();
      sg.box(0, 0, 0, Math.round(cy - 1), 0, 0, s.feet);
      put(body, sg, [sd * 3.2 * k, 1, 1.5 * k], [0, 0, 0], 5);
    }
  else {
    // A ghost has no feet: a wavy hem.
    const hem = new Grid();
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      hem.ell(Math.cos(a) * 4.8, 1.5, Math.sin(a) * 6.2, 1.6, 1.6, 1.6, "#fbf7ef", 2.2);
    }
    put(body, hem, [0, 0, 0], [0, 0, 0], 6, 0.6);
  }
  const rig: Rig = {
    head,
    eyes,
    fore: feet,
    hind: [],
    tails: [tail],
    neck: [0, U(-1), U(0.5)],
    neckR: U(hr * 0.85),
    top: [0, U(hr * 1.5), U(hr * 0.1)],
    tilt: false,
    float: s.ghost ? 0.1 : undefined,
    span: U(15.5 * k),
  };
  if (variant === "ghost")
    rig.fx = (t) => {
      head.rotation.z = Math.sin(t * 2) * 0.05;
    };
  else
    rig.fx = (t, moving) => {
      // A little beak-dip every so often, and a waddle of the head when it walks.
      head.rotation.z = moving ? Math.sin(t * 12) * 0.08 : Math.sin(t * 1.1) * 0.02;
    };
  return { rig, body, fore };
}

// MARK: Dragon

interface DragonSpec {
  g: string;
  g2: string;
  w: string;
  y: string;
  e: string;
  n: string;
  bone?: boolean;
  baby?: boolean;
  glowEyes?: boolean;
}

const dragons: Record<string, Partial<DragonSpec>> = {
  "": { g: "#4fb36a", g2: "#3f9a58", w: "#8fd6a0", y: "#f5d98a", n: "#ff8a3c", e: DARK },
  red: { g: "#c94a3f", g2: "#a83a32", w: "#f19a8a", y: "#f7e6c2", n: "#f5d14a" },
  ice: { g: "#9fd8ee", g2: "#82c2dc", w: "#dff3ff", y: "#fbf7ef", n: "#7fd4ff" },
  gold: { g: "#e0b23a", g2: "#c99a28", w: "#f7eaa0", y: "#fbf0d0", n: "#f08a3c" },
  shadow: {
    g: "#463f86",
    g2: "#383270",
    w: "#7d4fb0",
    y: "#5b5680",
    e: "*#ff4fd2",
    n: "#b070ff",
    glowEyes: true,
  },
  skeleton: {
    g: "#f1ead6",
    g2: "#d6cdb4",
    w: "#4a4158",
    y: "#d6cdb4",
    e: "#14101c",
    n: "#fffaf0",
    bone: true,
  },
  baby: { g: "#8ccf86", g2: "#74b86e", w: "#f0a58a", y: "#f5e2a8", n: "#f5d14a", baby: true },
};

export function dragon(variant: string): { rig: Rig; body: Model; fore: Model } {
  const d = { ...dragons[""], ...dragons[variant] } as DragonSpec;
  const baby = !!d.baby;
  const k = baby ? 0.78 : 1;
  const hk = baby ? 1.3 : 1;
  const body = new Model();
  const fore = new Model();
  const lh = Math.round(6 * k);
  const zF = Math.round(11 * k);
  const by = lh + 4;
  const bone = !!d.bone;
  const scale = (c: Cell, a: string, b: string) =>
    (c.x + c.z + c.y) % 3 === 0 ? mix(a, b, 0.6) : mixed(a, b, c, 3, 0.2);
  const bg = new Grid();
  bg.ell(0, by, zF / 2, 6.2 * k, 5.4 * k, zF / 2 + 4 * k, "#fff", 2.4);
  bg.ell(0, by + 1 * k, zF - 0.5, 4.8 * k, 4.8 * k, 4 * k, "#fff", 2.4);
  // Haunches.
  for (const sd of SIDES) bg.ell(sd * 4.4 * k, lh + 3, -0.5, 2.6 * k, 3.6 * k, 3.4 * k, "#fff", 2.3);
  const hx = 0;
  const hy = Math.round(by + 11 * k);
  const hz = Math.round(zF + 5.5 * k);
  bg.tube(
    [
      [0, by + 1, zF],
      [0, by + 5.5 * k, zF + 2 * k],
      [hx, hy - 1, hz - 1],
    ],
    3.5 * k,
    2.6 * k,
    "#fff",
  );
  const belly = !bone;
  bg.paint((c) => {
    if (bone) {
      // Dark hollows with white ribs across them; a bone spine on top.
      if (c.t > 0.86) return mixed(d.g, d.g2, c, 2, 0.4);
      return c.z % 3 === 0 ? mixed(d.g, d.g2, c, 2, 0.3) : "#4a4258";
    }
    if (belly && c.t < 0.4 && Math.abs(c.s) < 0.85) return (c.z + 100) % 2 === 0 ? mix(d.y, d.g, 0.12) : d.y;
    return scale(c, d.g, d.g2);
  });
  // Spines down the back: little pyramids.
  const spine = new Grid();
  for (let i = 0; i < 6; i++) {
    const z = Math.round(2 + i * (zF / 5.5));
    const top = bg.top(0, z);
    if (top === undefined) continue;
    const h = i === 2 || i === 3 ? 3 : 2;
    for (let j = 0; j < h; j++)
      spine.box(0, 0, top + 1 + j, top + 1 + j, z - (h - 1 - j > 0 ? 0 : 0), z, bone ? d.g : d.y);
  }
  bg.merge(spine);
  // The head.
  const head = new Model();
  const hg = new Grid();
  const hw = 7 * hk;
  hg.ell(0, 1.5 * hk, 2.2 * hk, hw / 2 + 0.3, 3.4 * hk, 4.4 * hk, "#fff", 2.5);
  hg.ell(0, 0.4 * hk, 6.4 * hk, 2.9 * hk, 2.2 * hk, 3.2 * hk, "#fff", 2.8);
  hg.paint((c) => {
    if (c.z > 5 * hk && c.t < 0.7 && !bone) return c.t < 0.35 ? d.y : mixed(d.g, d.g2, c, 3, 0.25);
    if (bone && c.z > 5 * hk) return "#e4dcc4";
    return scale(c, d.g, d.g2);
  });
  const nose = Math.round(9.4 * hk);
  // Nostrils with a glowing ember.
  for (const sd of SIDES) hg.set(sd, Math.round(1.1 * hk), nose, "*" + d.n);
  // Horns and ear fins.
  const horn = new Grid();
  horn.tube(
    [
      [0, 0, 0],
      [0.8, 3, -1.5],
      [1.2, 5.5, -4],
    ],
    1.5 * hk,
    0.5,
    bone ? d.g : d.y,
  );
  for (const sd of SIDES) hg.merge(sd > 0 ? horn : horn.mirrored(), sd * 2.6 * hk, 3.6 * hk, 0.5 * hk);
  const fin = new Grid();
  fin.tube(
    [
      [0, 0, 0],
      [2.5, 1.5, -1.5],
    ],
    1.2,
    0.5,
    bone ? d.g : d.w,
  );
  for (const sd of SIDES) hg.merge(sd > 0 ? fin : fin.mirrored(), sd * 3.4 * hk, 1.5 * hk, -0.5 * hk);
  put(head, hg, [0, 0, 0], [0, 0, 0], 2);
  head.position.set(U(hx), U(hy), U(hz));
  body.add(head);
  const eyeRows = [
    [d.e, d.glowEyes ? d.e : GLINT],
    [d.e, d.e],
  ];
  const eyes: THREE.Mesh[] = [];
  for (const sd of SIDES) {
    const e = eye(eyeRows);
    const ex = Math.round(2.6 * hk);
    const ey = Math.round(2.4 * hk);
    const zf = hg.front(sd * ex, ey) ?? Math.round(5 * hk);
    e.position.set(U(sd * (ex + 0.5)), U(ey - 0.5), U(zf + 0.55));
    head.add(e);
    eyes.push(e);
  }
  // An ember flame in the nostrils.
  const flameG = new Grid();
  flameG.set(0, 0, 0, "*" + d.n);
  flameG.set(0, 1, 0, "*#fff2a8");
  const flame = bake(flameG, { flat: true });
  flame.position.set(0, U(1.6 * hk), U(nose + 1));
  head.add(flame);
  put(body, bg, [0, 0, 0], [0, 0, 0], 1);

  // Legs.
  const fores: THREE.Mesh[] = [];
  const hinds: THREE.Mesh[] = [];
  for (const sd of SIDES)
    for (const [parent, list, z0] of [
      [body, hinds, 0],
      [fore, fores, zF],
    ] as const) {
      const lg = new Grid();
      lg.box(-1, 1, 1, lh + 2, -1, 1, (c) =>
        c.y < 2 ? (bone ? "#e4dcc4" : d.g2) : bone ? d.g : scale(c, d.g, d.g2),
      );
      lg.box(-1, 1, 0, 0, -1, 2, bone ? "#e4dcc4" : d.g2);
      // Claws.
      for (const x of [-1, 0, 1]) lg.set(x, 0, 3, bone ? "#fffaf0" : d.y);
      const m = put(parent, lg, [sd * 4.2 * k, 0.5, z0], [0, 0.5, 0], 7);
      list.push(m);
    }

  // Wings: arm, three finger bones and a membrane.
  const wings: THREE.Object3D[] = [];
  const wg = new Grid();
  const poly: [number, number][] = [
    [0, 0],
    [9 * k, -1],
    [15 * k, -6 * k],
    [13 * k, -11 * k],
    [8 * k, -13 * k],
    [1, -9 * k],
  ];
  const inside = (x: number, z: number) => {
    let c = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const [xi, zi] = poly[i]!;
      const [xj, zj] = poly[j]!;
      if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) c = !c;
    }
    return c;
  };
  for (let x = 0; x <= 16 * k; x++)
    for (let z = -14 * k; z <= 1; z++)
      if (inside(x, z) && (!bone || hash(x, 0, z, 9) < 0.5))
        wg.set(x, 0, z, mixed(d.w, lighten(d.w, 0.18), { x, y: 0, z, u: 0, t: 0, s: 0, c: "" }, 3, 0.3));
  wg.tube(
    [
      [0, 0.5, 0],
      [9 * k, 0.5, -1],
    ],
    1.2,
    0.8,
    d.g,
  );
  for (const [x, z] of [
    [15 * k, -6 * k],
    [13 * k, -11 * k],
    [8 * k, -13 * k],
  ] as const) {
    wg.tube(
      [
        [9 * k, 0.5, -1],
        [x, 0.5, z],
      ],
      0.8,
      0.4,
      d.g,
    );
  }
  for (const sd of SIDES) {
    const wing = new Model();
    put(wing, sd > 0 ? wg : wg.mirrored(), [0, 0, 0], [0, 0, 0], 11 + sd);
    wing.position.set(U(sd * 3.6 * k), U(by + 4 * k), U(zF * 0.55));
    body.add(wing);
    wings.push(wing);
  }

  // Tail: a long taper with a spade (or an ember, for the baby).
  const tail = new Model();
  const tg = new Grid();
  const tl = 18 * k;
  tg.tube(
    [
      [0, 0, 0],
      [0, -1, -tl * 0.4],
      [0, -0.5, -tl * 0.8],
      [0, 1, -tl],
    ],
    3 * k,
    0.8,
    (c) => (bone ? ((c.z | 0) % 3 === 0 ? d.g : "#4a4258") : scale(c, d.g, d.g2)),
  );
  for (let i = 1; i < 5; i++) {
    const z = -Math.round((tl * i) / 5.4);
    tg.set(0, Math.round(2.6 * k - i * 0.4), z, bone ? d.g : d.y);
  }
  const ty = 1;
  const tz = -tl - 0.5;
  if (baby) tg.ell(0, ty, tz - 1, 1.5, 1.5, 2.2, "*" + d.n, 2);
  else {
    for (let i = 0; i < 4; i++) tg.box(-i, i, ty, ty, tz - 2 - i * 1.0, tz - 2 - i * 1.0, bone ? d.g : d.y);
    tg.box(-1, 1, ty, ty, tz - 6, tz - 6, bone ? d.g : d.y);
  }
  put(tail, tg, [0, 0, 0], [0, 0, 0], 12);
  tail.position.set(0, U(by - 0.5), U(-4 * k));
  body.add(tail);

  const rig: Rig = {
    head,
    eyes,
    fore: fores,
    hind: hinds,
    tails: [tail],
    neck: [0, U(-2.5 * hk), U(0)],
    neckR: U(3.2 * hk),
    top: [0, U(4.2 * hk), U(1.5 * hk)],
    tilt: true,
    sitStretch: (0.62 * zF) / (lh + 2),
    span: U(zF + 10 * k + 9 * hk),
  };
  rig.fx = (t, moving) => {
    wings.forEach((w, i) => {
      const flap = Math.sin(t * (moving ? 9 : 2)) * (moving ? 0.35 : 0.1);
      w.rotation.z = (i ? -1 : 1) * (0.75 + flap);
      w.rotation.y = (i ? -1 : 1) * -0.3;
    });
    flame.scale.setScalar(0.9 + Math.sin(t * 14) * 0.25);
  };
  if (d.glowEyes || bone) light(head, [0, 0.1, 0.2], bone ? "#bfe6ff" : "#b070ff", 0.9, 2.2);
  return { rig, body, fore };
}

// MARK: Loot and special pets

/** Sand golem: a block of every second you waited, eyes glowing. */
export function golem(): { rig: Rig; body: Model; fore: Model } {
  const body = new Model();
  const fore = new Model();
  const sand = (c: Cell, a: string, b: string, row = 3) => {
    // Strata: bands of two sands, with grit.
    const band = Math.floor((c.y + 100) / row) % 2 === 0;
    return mixed(band ? a : b, band ? b : a, c, 7, 0.3);
  };
  const S = "#e3c07a";
  const D = "#b8934e";
  const torso = new Grid();
  torso.ell(0, 14, 2, 7.2, 6.2, 5.6, "#fff", 4);
  torso.paint((c) => sand(c, S, "#d6b068"));
  for (const [x, y, z] of [
    [-3, 21, 5],
    [3, 21, 6],
    [0, 21, -1],
    [-5, 20, 0],
  ] as const)
    torso.ell(x, y, z, 1.8, 1.4, 1.8, D, 3);
  torso.box(-7, 7, 11, 11, -3, 7, D);
  const fores: THREE.Mesh[] = [];
  const hinds: THREE.Mesh[] = [];
  for (const sd of SIDES) {
    for (const [parent, list, z0] of [
      [body, hinds, -1],
      [fore, fores, 2],
    ] as const) {
      const lg = new Grid();
      lg.box(-2, 2, 0, 8, -2, 2, (c) => (c.y < 3 ? D : sand(c, D, "#a8843f", 2)));
      list.push(put(parent, lg, [sd * 3.6, 0, z0], [0, 0, 0], 2));
    }
    const arm = new Grid();
    arm.box(-2, 2, 0, 11, -2, 2, (c) => sand(c, S, D, 3));
    arm.box(-3, 3, 0, 3, -3, 3, D);
    const m = put(body, arm, [sd * 9.2, 6, 2], [0, 11, 0], 3);
    m.rotation.z = sd * 0.1;
    body.userData.arms = [...((body.userData.arms as THREE.Object3D[] | undefined) ?? []), m];
  }
  put(body, torso, [0, 0, 0], [0, 0, 0], 1);
  const head = new Model();
  const hg = new Grid();
  hg.box(-4, 4, 0, 7, -3, 4, (c) => sand(c, S, "#d6b068", 4));
  hg.box(-4, 4, 5, 5, -3, 4, D);
  for (const x of [-3, 3]) hg.box(x, x, 8, 8, 0, 0, D);
  hg.box(-2, 2, 2, 2, 5, 5, D);
  const hl = "*#ff9a3c";
  put(head, hg, [0, 0, 0], [0, 0, 0], 4);
  head.position.set(0, U(20), U(2.5));
  body.add(head);
  const eyes: THREE.Mesh[] = [];
  for (const sd of SIDES) {
    const e = eye([
      [hl, hl],
      [hl, hl],
    ]);
    e.position.set(U(sd * 2.5), U(6), U(5.4));
    head.add(e);
    eyes.push(e);
  }
  light(head, [0, 0, 0.15], "#ff9a3c", 0.5, 1.6);
  // Sand trickling off it.
  const grain = new Grid();
  grain.set(0, 0, 0, S);
  const grains = Array.from({ length: 5 }, (_, i) => {
    const m = bake(grain, { seed: i });
    body.add(m);
    return { m, i };
  });
  return {
    rig: {
      head,
      eyes,
      fore: fores,
      hind: hinds,
      tails: [],
      neck: [0, U(-1), U(0)],
      neckR: U(4.2),
      top: [0, U(8), U(0)],
      tilt: false,
      span: U(12),
      fx: (t) => {
        for (const { m, i } of grains) {
          const u = (t * 0.7 + i * 0.2) % 1;
          m.position.set(U(-8 + i * 4), U(24 - u * 20), U(-2 + (i % 2) * 6));
          m.visible = u < 0.9;
        }
      },
    },
    body,
    fore,
  };
}

/** Goldfish: floating along, a bubble at a time. It forgot already. */
export function goldfish(): { rig: Rig; body: Model; fore: Model } {
  const body = new Model();
  const fore = new Model();
  const g = "#ff8a3c";
  const G = "#d9622b";
  const bg = new Grid();
  bg.ell(0, 0, 0, 5.2, 6.4, 8, "#fff", 2.3);
  bg.paint((c) => {
    if (c.t < 0.28) return mixed("#ffb070", g, c, 2, 0.3);
    // Scales: a checker of two oranges.
    return (c.x + c.y + c.z + 100) % 2 === 0 ? mix(g, "#ffa050", 0.5) : mixed(g, "#ee7a30", c, 3, 0.2);
  });
  // The dorsal fin and side fins.
  for (let z = -4; z <= 3; z++) bg.box(0, 0, 6 + (z < -1 ? 0 : -1), 9 - Math.abs(z + 1) * 0.5, z, z, G);
  for (const sd of SIDES) {
    bg.box(sd * 5, sd * 6, -2, -1, 1, 4, G);
    bg.box(sd * 5, sd * 7, -3, -2, 2, 3, mix(G, g, 0.3));
  }
  put(body, bg, [0, 0, 0], [0, 0, 0], 1);
  const head = new Model();
  head.position.set(0, 0, U(5));
  body.add(head);
  const eyes: THREE.Mesh[] = [];
  for (const sd of SIDES) {
    const e = eye([
      ["#ffffff", "#ffffff"],
      ["#ffffff", DARK],
      ["#ffffff", DARK],
    ]);
    e.rotation.y = sd * 0.6;
    e.position.set(U(sd * 4.4), U(1.5), U(1.6));
    head.add(e);
    eyes.push(e);
  }
  const mouth = new Grid();
  mouth.set(0, 0, 0, "#c24a1c");
  mouth.set(-1, 0, 0, "#c24a1c");
  mouth.set(1, 0, 0, "#c24a1c");
  put(head, mouth, [0, -1.5, 3.1], [0, 0, 0], 0);
  const tail = new Model();
  const tg = new Grid();
  for (let i = 0; i < 9; i++) {
    const w = 1 + Math.floor(i * 0.9);
    tg.box(
      -w,
      w,
      -1 - Math.floor(i * 0.3),
      1 + Math.floor(i * 0.5),
      -i,
      -i,
      hash(i, 0, 0, 1) < 0.4 ? mix(G, g, 0.4) : G,
    );
  }
  put(tail, tg, [0, 0, 0], [0, 0, 0], 2);
  tail.position.set(0, 0, U(-7.5));
  body.add(tail);
  const bubbles = Array.from({ length: 3 }, (_, i) => {
    const bgg = new Grid();
    bgg.box(0, i > 0 ? 1 : 0, 0, i > 0 ? 1 : 0, 0, i > 0 ? 1 : 0, "#bfe6ff");
    const m = bake(bgg, { opacity: 0.7, flat: true });
    body.add(m);
    return m;
  });
  return {
    rig: {
      head,
      eyes,
      fore: [],
      hind: [],
      tails: [tail],
      neck: [0, 0, 0],
      neckR: U(5.2),
      top: [0, U(7), 0],
      tilt: false,
      float: 0.25,
      span: U(17),
      fx: (t, moving) => {
        body.rotation.z = Math.sin(t * 3) * 0.05;
        tail.rotation.y = Math.sin(t * (moving ? 14 : 6)) * 0.5;
        bubbles.forEach((m, i) => {
          const u = (t * 0.45 + i / 3) % 1;
          m.position.set(U(1 + Math.sin(u * 8) * 1), U(7 + u * 16), U(9));
          m.scale.setScalar(u > 0.95 ? 0.01 : 1 - u * 0.3);
        });
      },
    },
    body,
    fore,
  };
}

/** A ghost: it says it exists. A sheet with a face and a wavy hem. */
export function ghost(): { rig: Rig; body: Model; fore: Model } {
  const body = new Model();
  const fore = new Model();
  const sheet = (c: Cell) => mixed("#f4f6ff", "#e3e8fb", c, 5, 0.3);
  const bg = new Grid();
  bg.ell(0, 13, 0, 7.2, 7.8, 7, sheet, 2.3);
  bg.box(-7, 7, 4, 12, -6, 6, sheet);
  bg.ell(0, 8, 0, 7.4, 5, 6.8, sheet, 2.6);
  for (const sd of SIDES) bg.ell(sd * 9, 9, 1, 1.6, 4, 2.4, sheet, 2.3);
  bg.paint((c) => sheet(c));
  put(body, bg, [0, 0, 0], [0, 0, 0], 1, 0.82);
  const hem: THREE.Mesh[] = [];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const hg = new Grid();
    hg.ell(0, 0, 0, 2.6, 2.2, 2.6, sheet, 2.2);
    const m = put(body, hg, [Math.cos(a) * 5.6, 3, Math.sin(a) * 5.2], [0, 0, 0], 2 + i, 0.82);
    hem.push(m);
  }
  const head = new Model();
  head.position.set(0, U(13), 0);
  body.add(head);
  const eyes: THREE.Mesh[] = [];
  for (const sd of SIDES) {
    const e = eye([
      [DARK, DARK],
      [DARK, GLINT],
      [DARK, DARK],
    ]);
    e.position.set(U(sd * 3), U(1.5), U(7.35));
    head.add(e);
    eyes.push(e);
  }
  const mouth = new Grid();
  mouth.box(-1, 1, 0, 1, 0, 0, DARK);
  mouth.del(0, 0, 0);
  put(head, mouth, [0, -2.5, 7.35], [0, 0, 0], 0);
  light(head, [0, 0, 0.2], "#cfe0ff", 0.8, 2.6);
  return {
    rig: {
      head,
      eyes,
      fore: [],
      hind: [],
      tails: [],
      neck: [0, U(-5), 0],
      neckR: U(7),
      top: [0, U(8), 0],
      tilt: false,
      float: 0.12,
      span: U(14),
      fx: (t) => {
        hem.forEach((m, i) => {
          m.position.y = U(3 + Math.sin(t * 4 + i) * 1.3);
        });
        body.rotation.z = Math.sin(t * 1.5) * 0.04;
      },
    },
    body,
    fore,
  };
}

/** Piggy bank: a pink pig with a coin slot on its back and a gold coin bobbing above it, every one you owe. */
export function piggy(): { rig: Rig; body: Model; fore: Model } {
  const body = new Model();
  const fore = new Model();
  const P = "#f0a0b8";
  const L = "#f7c0d0";
  const D = "#c05070";
  const SLOT = "#7a2a3f";
  const skin = (c: Cell, k = 0.3) => (c.t < 0.3 ? mixed(L, P, c, 4, k) : mixed(P, "#e890aa", c, 5, k));
  const bg = new Grid();
  bg.ell(0, 9.5, 0, 6.6, 5.6, 8.2, "#fff", 2.3);
  bg.paint((c) => skin(c));
  // The coin slot, a dark groove along its back.
  bg.box(-0.5, 0.5, 14, 15, -2.5, 2.5, SLOT);
  bg.box(-0.5, 0.5, 13, 13, -2.5, 2.5, SLOT);
  put(body, bg, [0, 0, 0], [0, 0, 0], 1);
  const hinds: THREE.Mesh[] = [];
  const fores: THREE.Mesh[] = [];
  for (const sd of SIDES) {
    for (const [parent, list, z0] of [
      [body, hinds, -4.8],
      [fore, fores, 4.2],
    ] as const) {
      const lg = new Grid();
      lg.box(-1.5, 1.5, 0, 5, -1.5, 1.5, (c) => (c.y < 1 ? D : mixed(P, "#e890aa", c, 6, 0.3)));
      list.push(put(parent, lg, [sd * 3.8, 0, z0], [0, 0, 0], 2));
    }
  }
  const head = new Model();
  const hg = new Grid();
  hg.ell(0, 0, 0, 4.6, 4.2, 4.2, "#fff", 2.3);
  hg.paint((c) => skin(c, 0.25));
  // Snout: a flat disc, lighter, with two nostrils.
  hg.box(-2, 2, -2, 1, 3, 5, L);
  hg.set(-1, -0.5, 5, D);
  hg.set(1, -0.5, 5, D);
  // Floppy ears.
  for (const sd of SIDES) {
    hg.box(sd * 3, sd * 4, 3, 5, -1, 1, mix(D, P, 0.45));
    hg.box(sd * 4, sd * 5, 2, 3, -1, 1, mix(D, P, 0.6));
  }
  put(head, hg, [0, 0, 0], [0, 0, 0], 3);
  head.position.set(0, U(11), U(8));
  body.add(head);
  const eyes: THREE.Mesh[] = [];
  for (const sd of SIDES) {
    const e = eye([
      [DARK, DARK],
      [DARK, GLINT],
    ]);
    e.position.set(U(sd * 2.6), U(1.2), U(4.05));
    head.add(e);
    eyes.push(e);
  }
  // A curly tail.
  const tail = new Model();
  const tg = new Grid();
  for (const [x, y, z] of [
    [0, 0, 0],
    [0, 1, -1],
    [1, 2, -1],
    [1, 3, 0],
    [0, 3, 1],
  ] as const)
    tg.set(x, y, z, D);
  put(tail, tg, [0, 0, 0], [0, 0, 0], 4);
  tail.position.set(0, U(11), U(-8.2));
  body.add(tail);
  // The coin, edge on, above the slot.
  const cg = new Grid();
  cg.ell(0, 0, 0, 0.9, 2.8, 2.8, "#f5c842", 2.4);
  cg.box(0, 0, -1, 1, -1, 1, "*#fff0a0");
  const coin = bake(cg, { seed: 5 });
  coin.position.set(0, U(18), 0);
  body.add(coin);
  return {
    rig: {
      head,
      eyes,
      fore: fores,
      hind: hinds,
      tails: [tail],
      neck: [0, U(-3), 0],
      neckR: U(4.8),
      top: [0, U(5), 0],
      tilt: false,
      span: U(16),
      fx: (t) => {
        coin.position.y = U(18 + Math.sin(t * 2.4) * 1.4);
        coin.rotation.y = t * 1.6;
      },
    },
    body,
    fore,
  };
}

/** The Singularity orb: a tiny black hole with a glowing ring, floating off the ground. */
export function orb(): { rig: Rig; body: Model; fore: Model } {
  const body = new Model();
  const fore = new Model();
  const cg = new Grid();
  cg.ell(0, 0, 0, 6.5, 6.5, 6.5, (c) => (hash(c.x, c.y, c.z, 2) < 0.1 ? "#2a1f40" : "#14101f"), 2);
  // A thin violet halo on the lit side.
  cg.each((x, y, z) => {
    if (x + y * 0.6 + z > 8.5) cg.set(x, y, z, "#2b2050");
  });
  put(body, cg, [0, 0, 0], [0, 0, 0], 1);
  const ring = new Model();
  const rg = new Grid();
  const ringTone = (r: number, y: number, col: string, th: number, soft = 0) => {
    for (let a = 0; a < 90; a++) {
      const t = (a / 90) * Math.PI * 2;
      const x = Math.round(Math.cos(t) * r);
      const z = Math.round(Math.sin(t) * r);
      for (let j = 0; j < th; j++)
        rg.set(
          x,
          y + j,
          z,
          hash(x, 0, z, soft) < 0.2 ? lighten(col.replace("*", ""), 0.25).replace("#", "*#") : col,
        );
    }
  };
  ringTone(10, 0, "*#9b6fd6", 2);
  ringTone(11, 0, "*#7a55b8", 1, 3);
  ringTone(12, 0, "*#ffd27a", 1, 5);
  ring.add(bake(rg, { flat: true }));
  ring.rotation.z = 0.35;
  body.add(ring);
  const head = new Model();
  body.add(head);
  light(head, [0, 0.1, 0.2], "#9b6fd6", 1.1, 3);
  return {
    rig: {
      head,
      eyes: [],
      fore: [],
      hind: [],
      tails: [],
      neck: [0, U(-7), 0],
      neckR: U(7),
      top: [0, U(9), 0],
      tilt: false,
      float: 0.3,
      span: U(16),
      fx: (t) => {
        ring.rotation.y = t * 1.6;
        ring.rotation.x = Math.sin(t * 0.8) * 0.2;
      },
    },
    body,
    fore,
  };
}
