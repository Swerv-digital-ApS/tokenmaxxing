/**
 * Things outside: hedges in white planters, flower beds, topiaries, cypresses, palms, trees in every
 * season, benches, lamps, the grand fountain, the arcade, a terrace lounge and the street's odds and
 * ends. Same kit as the furniture; flowers are instanced, since a bed holds hundreds.
 */
import type { SeasonLook } from "@tokenmaxxing/core/seasons.ts";
import * as THREE from "three";
import { C } from "../../art/palette.ts";
import { canvasTexture, glass, glow, Model, seeded, ticks, tint, toon, type V3 } from "../kit/kit.ts";

/**
 * Lights that come on at night: `userData.night` is their intensity then. A `street` lamp's also dims
 * while power is expensive (`Fx`'s `lampDim`).
 */
function light(m: Model, at: V3, color: string, intensity: number, distance = 5, street = false): void {
  const l = new THREE.PointLight(color, 0, distance, 1.5);
  l.position.set(...at);
  l.userData.night = intensity;
  l.visible = false;
  if (street) l.userData.street = true;
  m.add(l);
}

/** Things that glow only at night (lamp heads, windows, light pools): swapped by `setPropsNight`. */
export interface NightGlow {
  mesh: THREE.Mesh;
  day: THREE.Material;
  night: THREE.Material;
}
const nightGlows: NightGlow[] = [];
const nightListeners = new Set<(on: boolean) => void>();
let propsNight = false;
/** `night`: the glow's colour, or the material to wear at night. */
export function nightGlow(mesh: THREE.Mesh, night: string | THREE.Material): void {
  const g = {
    mesh,
    day: mesh.material as THREE.Material,
    night: typeof night === "string" ? glow(night) : night,
  };
  // The static batching builds a day and a night copy and flips between them (`onPropsNight`).
  mesh.userData.nightGlow = g;
  nightGlows.push(g);
}
/** Forgets the glows under `root`, when its room is thrown away. */
export function dropPropsNight(root: THREE.Object3D): void {
  const inside = (m: THREE.Object3D) => {
    for (let o: THREE.Object3D | null = m; o; o = o.parent) if (o === root) return true;
    return false;
  };
  for (let i = nightGlows.length - 1; i >= 0; i--) if (inside(nightGlows[i]!.mesh)) nightGlows.splice(i, 1);
}
export const isPropsNight = (): boolean => propsNight;
/** Called with the new state whenever `setPropsNight` runs. */
export function onPropsNight(fn: (on: boolean) => void): () => void {
  nightListeners.add(fn);
  return () => nightListeners.delete(fn);
}
export function setPropsNight(on: boolean): void {
  propsNight = on;
  for (const g of nightGlows) g.mesh.material = on ? g.night : g.day;
  announceNight(on);
}

/** Tells the batches that it is night (or day) without swapping any prop: the rooms' own switch calls this. */
export function announceNight(on: boolean): void {
  propsNight = on;
  for (const fn of nightListeners) fn(on);
}

export const LEAF = ["#3f8f3a", "#4fa544", "#5fb84f", "#2f7a32"];

/** A low white planter, `w`×`d`, with a hedge clipped square on top. */
export function hedge(w: number, d = 0.55, h = 0.55): Model {
  const m = new Model();
  m.box([w, 0.22, d], "#eeeae2", [0, 0, 0], 0.03);
  m.box([w - 0.06, h, d - 0.08], LEAF[1]!, [0, 0.2, 0], 0.12);
  const rnd = seeded(Math.round(w * 97 + d * 13));
  const along = w > d;
  const n = Math.round((along ? w : d) * 3.5);
  for (let i = 0; i < n; i++) {
    const f = (i + 0.5) / n - 0.5;
    const at: V3 = along
      ? [f * (w - 0.2), 0.2 + h - 0.05, (rnd() - 0.5) * 0.15]
      : [(rnd() - 0.5) * 0.15, 0.2 + h - 0.05, f * (d - 0.2)];
    m.ball(0.14 + rnd() * 0.05, LEAF[i % 4]!, at, [1, 0.7, 1], 8);
  }
  return m;
}

/** A white pot, round or square, `h` tall. */
function whitePot(m: Model, r: number, h: number, square = false): void {
  if (square) {
    m.box([r * 2, h, r * 2], "#eeeae2", [0, 0, 0], 0.03);
    m.box([r * 2 + 0.06, 0.05, r * 2 + 0.06], "#ffffff", [0, h - 0.05, 0], 0.02);
  } else {
    m.cyl(r * 0.8, h, "#eeeae2", [0, 0, 0], r, 16);
    m.cyl(r + 0.02, 0.05, "#ffffff", [0, h - 0.05, 0], r + 0.02, 16);
  }
  m.cyl(r * 0.92, 0.01, "#5e3d28", [0, h - 0.02, 0], r * 0.92, 12);
}

/** A clipped topiary in a white pot: two or three balls on a stem. */
export function topiary(tiers = 2): Model {
  const m = new Model();
  whitePot(m, 0.24, 0.42);
  m.cyl(0.03, 0.4 + tiers * 0.3, C.trunk, [0, 0.4, 0], 0.025, 6);
  for (let i = 0; i < tiers; i++)
    m.ball(0.3 - i * 0.07, LEAF[(i + 1) % 4]!, [0, 0.72 + i * 0.42, 0], [1, 0.92, 1], 14);
  return m;
}

/** A tall cypress in a square stone planter. */
export function cypress(): Model {
  const m = new Model();
  m.box([0.6, 0.42, 0.6], "#e8e0cc", [0, 0, 0], 0.03);
  m.box([0.68, 0.06, 0.68], "#f4efe4", [0, 0.42, 0], 0.02);
  m.cyl(0.2, 1.4, "#3f7a3a", [0, 0.48, 0], 0.07, 12);
  m.ball(0.21, "#3f7a3a", [0, 0.6, 0], [1, 0.8, 1], 12);
  m.cyl(0.14, 0.5, "#4f9443", [0.03, 1.1, 0.05], 0.03, 10);
  return m;
}

/** A palm in a terracotta pot, its fronds drooping all round. */
export function palm(seed = 1): Model {
  const m = new Model();
  m.cyl(0.18, 0.36, "#c8734a", [0, 0, 0], 0.24, 14);
  m.cyl(0.26, 0.05, tint("#c8734a", -0.15), [0, 0.34, 0], 0.26, 14);
  const rnd = seeded(seed);
  let top = new THREE.Vector3(0, 0.38, 0);
  for (let i = 0; i < 6; i++) {
    const seg = m.cyl(
      0.055 - i * 0.004,
      0.24,
      i % 2 ? "#9a7650" : "#8a6640",
      [top.x, top.y, top.z],
      0.05 - i * 0.004,
      8,
    );
    seg.rotation.z = 0.05 * i;
    top = top.add(new THREE.Vector3(-Math.sin(seg.rotation.z) * 0.23, 0.23, 0));
  }
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + rnd() * 0.3;
    const frond = m.part([top.x, top.y, top.z], a);
    const leaf = frond.ball(0.36, i % 2 ? "#4f9b3d" : "#3f8a35", [0, 0, 0.3], [0.32, 0.06, 1], 10);
    leaf.rotation.x = 0.45 + rnd() * 0.2;
    leaf.position.y = -0.1;
  }
  return m;
}

export type TreeKind = "round" | "pine" | "pink" | "white" | "orange" | "yellow" | "red" | "oak";
const CANOPY: Record<Exclude<TreeKind, "pine">, string[]> = {
  round: ["#4fa544", "#5fb84f", "#3f8f3a"],
  oak: ["#3f8f3a", "#57ad47", "#2f7a32"],
  pink: ["#f2a6c8", "#f7bfd8", "#e889b2"],
  white: ["#f4efe9", "#e6ddd6", "#ffffff"],
  orange: ["#f08a3c", "#f5a55a", "#d96d2a"],
  yellow: ["#f5c842", "#f9da6e", "#e0aa24"],
  red: ["#e2443a", "#f06a5a", "#c22f2a"],
};

/**
 * A few millimetres, different for every lobe of a canopy: the Voxel style draws each lobe as a block, and two lobes whose
 * blocks share a face (equal sizes, or centres a block apart) fought over it as the camera moved: leaves flickering.
 */
const nudge = (i: number): [number, number, number] => [
  ((i * 5) % 7) * 0.002 - 0.006,
  ((i * 3) % 5) * 0.002,
  ((i * 2 + 1) % 7) * 0.002 - 0.006,
];

/** A tree; `size` scales it. Canopies are clusters of balls, so they read as foliage, not a lollipop. */
export function tree(kind: TreeKind, seed: number, size = 1): Model {
  if (kind === "pine") return pine(seed, size);
  const greens = CANOPY[kind];
  const n = lobeCount(kind === "oak");
  return broadleaf(kind === "oak", seed, size, (i) => greens[shadeOf(i, n)]!, false);
}

const lobeCount = (oak: boolean) => (oak ? 11 : 7);
/** Which of a palette's three shades lobe `i` of a canopy of `n` (and the middle and top) wears. */
const shadeOf = (i: number, n: number) => (i === 0 ? 0 : i === n + 1 ? 1 : (i - 1) % 3);

function pine(seed: number, size: number): Model {
  const m = new Model();
  const rnd = seeded(seed);
  const h = (1.8 + rnd() * 0.8) * size;
  m.cyl(0.08 * size, h * 0.3, C.trunkDark, [0, 0, 0], 0.06 * size, 8);
  for (let i = 0; i < 4; i++) {
    const r = (0.62 - i * 0.12) * size;
    m.cyl(r, h * 0.32, i % 2 ? "#2f6f3a" : "#3a7f42", [0, h * (0.18 + i * 0.19), 0], 0.02, 10);
  }
  return m;
}

/**
 * A broadleaf tree: a trunk (an oak's with three boughs) and a canopy of lobes. `lobe(i)` is lobe `i`'s colour, or
 * null where its leaves are gone (the first lobe is the big one in the middle, the last the top); `bare` adds the
 * branches that show once they are.
 */
function broadleaf(
  oak: boolean,
  seed: number,
  size: number,
  lobe: (i: number) => string | null,
  bare: boolean,
): Model {
  const m = new Model();
  const rnd = seeded(seed);
  const s = size * (oak ? 1.6 : 1);
  const h = (0.9 + rnd() * 0.4) * s;
  m.cyl(0.11 * s, h, C.trunk, [0, 0, 0], 0.08 * s, 9);
  if (oak)
    for (const [k, a] of [0.5, 2.6, 4.4].entries()) {
      // Each a little different: three equal branches turned about the trunk made blocks sharing a face (flicker).
      const branch = m.cyl(
        (0.07 + k * 0.006) * s,
        (0.6 + k * 0.04) * s,
        C.trunk,
        [0, h * 0.7, 0],
        0.04 * s,
        7,
      );
      branch.rotation.set(Math.sin(a) * 0.7, 0, Math.cos(a) * 0.7);
    }
  else if (bare)
    for (const [k, a] of [0.3, 2.4, 4.3].entries()) {
      const branch = m.cyl(
        (0.05 + k * 0.005) * s,
        (0.55 + k * 0.05) * s,
        C.trunk,
        [0, h * 0.85, 0],
        0.02 * s,
        6,
      );
      branch.rotation.set(Math.sin(a) * 0.6, 0, Math.cos(a) * 0.6);
    }
  if (bare)
    // Twigs at the crown, where the canopy was.
    for (const [k, a] of [1.4, 3.5, 5.6].entries()) {
      const twig = m.cyl(0.025 * s, (0.4 + k * 0.04) * s, C.trunkDark, [0, h + 0.15 * s, 0], 0.008 * s, 5);
      twig.rotation.set(Math.sin(a) * 0.45, 0, Math.cos(a) * 0.45);
    }
  const n = lobeCount(oak);
  const firstColour = lobe(0);
  const first = firstColour && m.ball(0.55 * s, firstColour, [0, h + 0.4 * s, 0], [1.1, 0.85, 1.1], 14);
  if (first) {
    first.position.add(new THREE.Vector3(...nudge(n + 2)));
    first.userData.blockScale = 0.78;
  }
  for (let i = 0; i < n; i++) {
    // The randoms are drawn for every lobe, kept or not, so a tree's lobes stay where they are as it goes bare.
    const a = (i / n) * Math.PI * 2 + rnd();
    const r = (0.38 + rnd() * 0.2) * s;
    const radius = (0.3 + rnd() * 0.15) * s;
    const y = h + (0.3 + rnd() * 0.45) * s;
    const colour = lobe(i + 1);
    if (!colour) continue;
    const ball = m.ball(radius, colour, [Math.cos(a) * r, y, Math.sin(a) * r], [1, 0.85, 1], 8);
    ball.userData.blockScale = 0.72;
    ball.position.add(new THREE.Vector3(...nudge(i)));
  }
  const topColour = lobe(n + 1);
  if (topColour) {
    const top = m.ball(0.3 * s, topColour, [0.05 * s, h + 0.85 * s, 0.05 * s], [1, 0.85, 1], 8);
    top.userData.blockScale = 0.78;
    top.position.add(new THREE.Vector3(...nudge(n + 1)));
  }
  return m;
}

/** The town's trees: broadleaves that turn and drop their leaves, two that blossom in spring, and evergreen pines. */
export type Species = "round" | "oak" | "cherry" | "apple" | "pine";

/** Spring's new leaves, lighter than summer's. */
const FRESH = ["#7cc24a", "#8fd05a", "#69b03f"];
const AUTUMN = [CANOPY.orange, CANOPY.yellow, CANOPY.red];
const BLOOM: Partial<Record<Species, string[]>> = { cherry: CANOPY.pink, apple: CANOPY.white };

/**
 * A tree of `species` on a day of the year (`SeasonLook`, from `core/src/seasons.ts`). Its lobes change one at a
 * time, each from a few fixed palettes (summer's greens, spring's fresh green, the autumn colours, blossom), so a
 * town halfway through October draws with the same few materials as one in full colour: some lobes still green,
 * some turned, some gone to show the branches. Each tree turns its own colour, a little earlier or later than its
 * neighbours.
 */
export function seasonalTree(species: Species, seed: number, size: number, look: SeasonLook): Model {
  if (species === "pine") return pine(seed, size);
  const oak = species === "oak";
  const rnd = seeded(seed ^ 0x5ea5);
  const early = rnd();
  // Oaks turn orange or yellow; the others any of the three.
  const autumn = AUTUMN[Math.floor(rnd() * (oak ? 2 : 3))]!;
  const green = oak ? CANOPY.oak : CANOPY.round;
  const bloom = BLOOM[species];
  const n = lobeCount(oak);
  const picks = Array.from({ length: n + 2 }, (_, i) => {
    const [gone, late, fresh, blossom] = [rnd(), rnd(), rnd(), rnd()];
    if (gone * 0.94 + 0.03 >= look.leaf) return null;
    const shade = shadeOf(i, n);
    if (look.turn > late * 0.7 + early * 0.3) return autumn[shade]!;
    if (bloom && blossom < look.blossom) return bloom[shade]!;
    return fresh < look.fresh ? FRESH[shade]! : green[shade]!;
  });
  return broadleaf(oak, seed, size, (i) => picks[i] ?? null, look.leaf < 0.95);
}

export function bush(seed: number, color = LEAF[1]!): Model {
  const m = new Model();
  const rnd = seeded(seed);
  for (let i = 0; i < 4; i++) {
    const lobe = m.ball(
      0.2 + rnd() * 0.1,
      i ? tint(color, (rnd() - 0.5) * 0.2) : color,
      [(rnd() - 0.5) * 0.35, 0.18 + rnd() * 0.1, (rnd() - 0.5) * 0.35],
      [1, 0.8, 1],
      10,
    );
    lobe.position.add(new THREE.Vector3(...nudge(i)));
  }
  if (rnd() < 0.5)
    for (let i = 0; i < 5; i++)
      m.ball(
        0.035,
        C.flowerRed,
        [(rnd() - 0.5) * 0.4, 0.35 + rnd() * 0.08, (rnd() - 0.2) * 0.3],
        [1, 1, 1],
        6,
      );
  return m;
}

/** A park bench: white cast frame, purple slats, facing +z. */
export function parkBench(slats = "#9b7fe0"): Model {
  const m = new Model();
  for (const x of [-0.55, 0.55]) {
    m.box([0.08, 0.36, 0.42], "#eeeae2", [x, 0, 0], 0.03);
    m.box([0.08, 0.42, 0.08], "#eeeae2", [x, 0.3, -0.18], 0.03);
  }
  m.box([1.2, 0.07, 0.42], slats, [0, 0.33, 0.01], 0.03);
  m.box([1.2, 0.26, 0.07], slats, [0, 0.46, -0.19], 0.03).rotation.x = -0.12;
  return m;
}

let lampPoolTexture: THREE.CanvasTexture | null = null;

/** A shared radial falloff keeps each street lamp's ground light soft at every zoom level. */
function lampPool(opacity: number): THREE.MeshBasicMaterial {
  lampPoolTexture ??= canvasTexture(
    64,
    64,
    (g) => {
      const gradient = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      gradient.addColorStop(0, "rgba(255,255,255,0.55)");
      gradient.addColorStop(0.25, "rgba(255,255,255,0.42)");
      gradient.addColorStop(0.55, "rgba(255,255,255,0.15)");
      gradient.addColorStop(0.8, "rgba(255,255,255,0.035)");
      gradient.addColorStop(1, "rgba(255,255,255,0)");
      g.fillStyle = gradient;
      g.fillRect(0, 0, 64, 64);
    },
    true,
  );
  return new THREE.MeshBasicMaterial({
    map: lampPoolTexture,
    color: "#ffdda0",
    transparent: true,
    opacity,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
}

/** Every street lamp's pool at night: one material, so the batch it's baked into dims with it. */
let streetPool: THREE.MeshBasicMaterial | null = null;
const STREET_POOL = 0.5;
const streetPoolNight = () => (streetPool ??= lampPool(STREET_POOL));

/** The street lamps' pools at `k` of their brightness (1 is full). */
export function setStreetLampDim(k: number): void {
  if (streetPool) streetPool.opacity = STREET_POOL * k;
}

/** A modern street lamp with a warm, feathered pool under its head. */
export function streetLamp(): Model {
  const m = new Model();
  m.cyl(0.11, 0.1, "#3c4454", [0, 0, 0], 0.09, 12);
  m.cyl(0.04, 2.3, "#3c4454", [0, 0.1, 0], 0.035, 10);
  m.box([0.08, 0.06, 0.5], "#3c4454", [0, 2.32, 0.2], 0.02);
  m.box([0.22, 0.08, 0.32], "#2b2f3a", [0, 2.28, 0.42], 0.03);
  nightGlow(m.box([0.16, 0.02, 0.24], "#cfd8e8", [0, 2.27, 0.42], 0.005), "#fff4c8");
  m.box([0.03, 0.03, 0.03], glow("#8fe3ff"), [0, 0.15, 0.1]);
  const pool = m.plane(2.8, 2.5, lampPool(0.025), [0, 0.025, 0.42]);
  pool.rotation.x = -Math.PI / 2;
  pool.receiveShadow = false;
  nightGlow(pool, streetPoolNight());
  light(m, [0, 2.0, 0.42], "#ffe6a8", 4, 6, true);
  return m;
}

/** A stone pillar with a brass lantern on top. */
export function lanternPillar(): Model {
  const m = new Model();
  m.box([0.5, 0.12, 0.5], "#e8e0cc", [0, 0, 0], 0.02);
  m.box([0.4, 0.95, 0.4], "#f1ead8", [0, 0.12, 0], 0.02);
  for (let i = 1; i < 4; i++) m.box([0.41, 0.015, 0.41], "#d8cfb8", [0, 0.12 + i * 0.24, 0], 0.004);
  m.box([0.48, 0.08, 0.48], "#e8e0cc", [0, 1.07, 0], 0.02);
  m.box([0.2, 0.05, 0.2], "#2b2433", [0, 1.15, 0], 0.01);
  nightGlow(m.box([0.16, 0.22, 0.16], "#f5d98a", [0, 1.2, 0], 0.02), "#ffe28a");
  m.cyl(0.16, 0.14, "#2b2433", [0, 1.42, 0], 0.01, 4).rotation.y = Math.PI / 4;
  m.cyl(0.015, 0.2, "#c9a33a", [0, 1.55, 0], 0.01, 6);
  light(m, [0, 1.3, 0], "#ffd27a", 2, 4, true);
  return m;
}

/** The square's centrepiece: three tiers of water, lit from below, with the town's bolt on top. */
export function grandFountain(): Model {
  const m = new Model();
  const water = glass("#5cc8f0", 0.8);
  // A low basin: a stone floor, water nearly to the brim, a rounded rim with lights set in it. Each pool of water
  // floats a little over the stone it sits in, and inside its edge: on the same plane the two flicker.
  m.cyl(1.75, 0.14, "#e8e0cc", [0, 0, 0], 1.8, 32);
  m.cyl(1.45, 0.03, water, [0, 0.42, 0], 1.45, 32);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(1.55, 0.13, 10, 40), toon("#f4efe4"));
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 0.4;
  rim.castShadow = rim.receiveShadow = true;
  m.add(rim);
  m.cyl(1.62, 0.28, "#f4efe4", [0, 0.12, 0], 1.68, 32);
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    m.ball(0.06, glow("#8fe3ff"), [Math.cos(a) * 1.69, 0.26, Math.sin(a) * 1.69]);
  }
  m.cyl(0.32, 1.0, "#f4efe4", [0, 0.38, 0], 0.26, 16);
  m.cyl(0.95, 0.16, "#f4efe4", [0, 1.35, 0], 0.8, 24);
  m.cyl(0.75, 0.03, water, [0, 1.52, 0], 0.75, 24);
  m.cyl(0.2, 0.55, "#f4efe4", [0, 1.45, 0], 0.16, 14);
  m.cyl(0.48, 0.12, "#f4efe4", [0, 1.98, 0], 0.4, 20);
  m.cyl(0.36, 0.03, water, [0, 2.11, 0], 0.36, 20);
  // The bolt, in gold.
  const bolt = m.part([0, 2.1, 0]);
  const shape = new THREE.Shape();
  for (const [x, y] of [
    [0.06, 0.62],
    [-0.16, 0.24],
    [-0.01, 0.24],
    [-0.08, 0],
    [0.17, 0.38],
    [0.02, 0.38],
    [0.1, 0.62],
  ] as const)
    shape.lineTo(x, y);
  const boltMesh = new THREE.Mesh(
    new THREE.ExtrudeGeometry(shape, {
      depth: 0.08,
      bevelEnabled: true,
      bevelSize: 0.015,
      bevelThickness: 0.015,
    }),
    toon("#f2c23a"),
  );
  boltMesh.castShadow = true;
  boltMesh.position.z = -0.04;
  bolt.add(boltMesh);
  ticks.push((t) => (bolt.rotation.y = t * 0.6));
  // Falling water: rings of drops from each tier, all one instanced draw (they move, so they can't be batched).
  const drops: { a: number; r0: number; y0: number; drop: number }[] = [];
  for (const [r0, y0, drop, n] of [
    [0.38, 2.13, 0.6, 10],
    [0.78, 1.54, 0.98, 16],
  ] as const)
    for (let i = 0; i < n; i++) drops.push({ a: (i / n) * Math.PI * 2, r0, y0, drop });
  const drop = m.ball(0.035, glass("#e4f5fd", 0.85));
  drop.removeFromParent();
  const spray = new THREE.InstancedMesh(drop.geometry, drop.material, drops.length);
  spray.castShadow = spray.receiveShadow = true;
  // Bounds worked out once would not follow the drops.
  spray.frustumCulled = false;
  m.add(spray);
  const at = new THREE.Object3D();
  ticks.push((t) => {
    drops.forEach((d, i) => {
      const f = (t * 1.2 + d.a * 0.37) % 1;
      const r = d.r0 + f * 0.18;
      at.position.set(Math.cos(d.a) * r, d.y0 - f * f * d.drop, Math.sin(d.a) * r);
      at.updateMatrix();
      spray.setMatrixAt(i, at.matrix);
    });
    spray.instanceMatrix.needsUpdate = true;
  });
  light(m, [0, 1.0, 0], "#8fe3ff", 3, 5);
  return m;
}

/** The arcade: a neon front with its name in lights, glass doors onto the machines, a red carpet. */
export function arcadeBuilding(): Model {
  const m = new Model();
  const [w, d, h] = [6.5, 4.2, 3.2];
  m.box([w + 0.2, 0.18, d + 0.2], "#cfc6b4", [0, 0, 0], 0.02);
  m.box([w, h, d], "#efe6d6", [0, 0.18, 0], 0.03);
  m.box([w + 0.12, 0.22, d + 0.12], "#5b3fbf", [0, h + 0.1, 0], 0.03);
  m.box([w - 0.4, 0.1, d - 0.4], "#3c4454", [0, h + 0.32, 0], 0.02);
  for (const x of [-1.8, 1.6]) {
    m.box([0.8, 0.45, 0.6], "#cfd3da", [x, h + 0.42, -0.6], 0.04);
    m.cyl(0.18, 0.04, "#5d6470", [x, h + 0.87, -0.6], 0.18, 12);
  }
  // Corner columns, lit in purple.
  for (const x of [-w / 2 + 0.25, w / 2 - 0.25]) {
    m.box([0.52, h + 0.2, 0.5], "#f4efe4", [x, 0.18, d / 2 - 0.1], 0.03);
    m.box([0.08, h - 0.4, 0.04], glow("#b47cff"), [x, 0.4, d / 2 + 0.16]);
  }
  // The shopfront: windows onto the machines, and the doors.
  const inside = canvasTexture(
    192,
    64,
    (g) => {
      g.fillStyle = "#3a2a6a";
      g.fillRect(0, 0, 192, 64);
      for (let i = 0; i < 6; i++) {
        const x = 8 + i * 31;
        g.fillStyle = ["#5b3fbf", "#e25d5d", "#4f8fe0"][i % 3]!;
        g.fillRect(x, 18, 20, 46);
        g.fillStyle = ["#8fe3ff", "#ffe28a", "#ff7ab6"][i % 3]!;
        g.fillRect(x + 3, 22, 14, 12);
      }
      g.fillStyle = "rgba(255,255,255,0.18)";
      for (let i = 0; i < 4; i++) g.fillRect(i * 52, 0, 14, 64);
    },
    true,
  );
  m.plane(w - 1.4, 1.5, glow("#fff", inside), [0, 0.95, d / 2 + 0.01]);
  m.box([w - 1.3, 0.1, 0.1], "#f4efe4", [0, 0.18, d / 2], 0.02);
  for (const x of [-0.45, 0.45]) m.box([0.06, 1.55, 0.08], "#f4efe4", [x, 0.18, d / 2 + 0.02]);
  m.box([1.0, 0.08, 0.08], "#f4efe4", [0, 1.7, d / 2 + 0.02]);
  // Awning and sign.
  const awning = m.box([w - 1.1, 0.12, 0.7], "#5b3fbf", [0, 1.95, d / 2 + 0.3], 0.03);
  awning.rotation.x = 0.18;
  for (let i = 0; i < 9; i++)
    m.ball(0.04, glow(i % 2 ? "#ffe28a" : "#8fe3ff"), [-2.4 + i * 0.6, 1.9, d / 2 + 0.66]);
  const sign = canvasTexture(
    512,
    160,
    (g) => {
      const bg = g.createLinearGradient(0, 0, 0, 160);
      bg.addColorStop(0, "#2a1f5c");
      bg.addColorStop(1, "#4a2f9a");
      g.fillStyle = bg;
      g.beginPath();
      g.roundRect(6, 6, 500, 148, 34);
      g.fill();
      g.lineWidth = 8;
      g.strokeStyle = "#f2c23a";
      g.stroke();
      g.font = "900 92px system-ui, sans-serif";
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.lineWidth = 14;
      g.strokeStyle = "#2b2433";
      g.strokeText("ARCADE", 256, 88);
      const letters = g.createLinearGradient(0, 40, 0, 130);
      letters.addColorStop(0, "#ffe28a");
      letters.addColorStop(1, "#ff9a3c");
      g.fillStyle = letters;
      g.fillText("ARCADE", 256, 88);
      g.fillStyle = "#8fe3ff";
      for (let i = 0; i < 16; i++) {
        g.beginPath();
        g.arc(40 + i * 29, 22, 5, 0, Math.PI * 2);
        g.arc(40 + i * 29, 140, 5, 0, Math.PI * 2);
        g.fill();
      }
    },
    true,
  );
  m.box([4.1, 1.3, 0.12], "#2a1f5c", [0, 2.15, d / 2 + 0.1], 0.06);
  m.plane(4.0, 1.25, glow("#fff", sign), [0, 2.8, d / 2 + 0.17]);
  // A joystick over the sign.
  m.box([0.5, 0.18, 0.4], "#2b2433", [0, h + 0.25, d / 2 - 0.1], 0.05);
  m.cyl(0.04, 0.4, "#cfd3da", [0, h + 0.43, d / 2 - 0.1], 0.04, 8);
  m.ball(0.17, "#e2443a", [0, h + 0.88, d / 2 - 0.1]);
  // Red carpet and palms.
  m.box([1.2, 0.025, 1.6], "#c4283a", [0, 0, d / 2 + 0.9], 0.01);
  m.box([0.5, 0.03, 0.5], "#f2c23a", [0, 0.01, d / 2 + 1.1], 0.01).rotation.y = Math.PI / 4;
  for (const x of [-1.2, 1.2]) m.part([x, 0, d / 2 + 1.1]).add(palm(x > 0 ? 3 : 4));
  light(m, [0, 2.4, d / 2 + 1.2], "#b47cff", 6, 7);
  return m;
}

/** A pergola: timber posts and beams with a cream shade cloth, `w`×`d`. */
export function pergola(w: number, d: number): Model {
  const m = new Model();
  const wood = "#a87648";
  for (const x of [-w / 2, w / 2])
    for (const z of [-d / 2, d / 2]) m.box([0.14, 2.2, 0.14], wood, [x, 0, z], 0.02);
  for (const z of [-d / 2, d / 2]) m.box([w + 0.4, 0.14, 0.12], wood, [0, 2.15, z], 0.02);
  for (let i = 0; i <= Math.round(w / 0.5); i++)
    m.box([0.07, 0.1, d + 0.3], tint(wood, 0.1), [-w / 2 + i * 0.5, 2.28, 0], 0.01);
  const cloth = m.box([w - 0.3, 0.03, d - 0.2], "#efe4c8", [0, 2.18, 0], 0.01);
  cloth.rotation.z = 0.04;
  // Vines on the posts, string lights along the beams.
  for (const x of [-w / 2, w / 2]) m.ball(0.15, LEAF[0]!, [x, 1.95, d / 2], [1, 1.4, 1], 8);
  for (let i = 0; i < 10; i++) {
    const x = -w / 2 + (i + 0.5) * (w / 10);
    nightGlow(
      m.ball(0.04, "#f4e6c0", [x, 2.05 - Math.sin(((i + 0.5) / 10) * Math.PI) * 0.15, d / 2]),
      "#ffe28a",
    );
  }
  return m;
}

/** A bar counter, `w` long, with bottles behind and stools in front. */
export function bar(w: number): Model {
  const m = new Model();
  m.box([w, 1.0, 0.55], "#b98a52", [0, 0, 0], 0.03);
  for (let i = 0; i < Math.round(w / 0.5); i++)
    m.box([0.4, 0.8, 0.02], tint("#b98a52", (i % 2) * 0.08), [-w / 2 + 0.3 + i * 0.5, 0.1, 0.28]);
  m.box([w + 0.1, 0.07, 0.65], "#e8e0cc", [0, 1.0, 0], 0.02);
  const rnd = seeded(77);
  for (let i = 0; i < 9; i++) {
    const x = -w / 2 + 0.3 + i * ((w - 0.6) / 8);
    m.cyl(
      0.04,
      0.22,
      glass(["#58b36a", "#c4544b", "#f0b53c", "#8fe3ff"][i % 4]!, 0.85),
      [x, 1.07, -0.18],
      0.04,
      8,
    );
    m.cyl(0.015, 0.08, "#3c4454", [x, 1.29, -0.18], 0.015, 6);
    if (rnd() < 0.4) m.cyl(0.035, 0.09, "#fbf7ef", [x + 0.1, 1.07, 0.12], 0.04, 8);
  }
  return m;
}

export function stool(seat = "#e8b0a0"): Model {
  const m = new Model();
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    const leg = m.cyl(0.02, 0.62, "#a87648", [Math.cos(a) * 0.12, 0, Math.sin(a) * 0.12], 0.02, 6);
    leg.rotation.set(Math.sin(a) * 0.12, 0, -Math.cos(a) * 0.12);
  }
  m.cyl(0.11, 0.02, "#a87648", [0, 0.25, 0], 0.11, 12);
  m.cyl(0.17, 0.07, seat, [0, 0.6, 0], 0.17, 16);
  return m;
}

export function mailbox(color = "#4f8fe0"): Model {
  const m = new Model();
  m.box([0.06, 0.75, 0.06], C.woodDark, [0, 0, 0]);
  m.box([0.2, 0.2, 0.32], color, [0, 0.72, 0], 0.08);
  m.box([0.02, 0.14, 0.06], "#e2443a", [0.11, 0.86, -0.06]);
  return m;
}

/** A gingham picnic blanket with a basket. */
export function picnic(color = "#e2443a"): Model {
  const m = new Model();
  const cloth = canvasTexture(
    64,
    64,
    (g) => {
      g.fillStyle = "#fbf7ef";
      g.fillRect(0, 0, 64, 64);
      g.fillStyle = `${color}99`;
      for (let i = 0; i < 64; i += 16) {
        g.fillRect(i, 0, 8, 64);
        g.fillRect(0, i, 64, 8);
      }
    },
    true,
  );
  m.box(
    [1.6, 0.02, 1.3],
    new THREE.MeshToonMaterial({ map: cloth, gradientMap: toon("#fff").gradientMap }),
    [0, 0, 0],
    0.005,
  );
  m.box([0.4, 0.26, 0.28], "#c9a36a", [0.45, 0.02, -0.3], 0.04);
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.015, 6, 12, Math.PI), toon("#a87648"));
  handle.position.set(0.45, 0.28, -0.3);
  m.add(handle);
  m.ball(0.06, "#e2443a", [-0.3, 0.06, 0.2]);
  m.ball(0.06, "#58b36a", [-0.15, 0.06, 0.28]);
  m.cyl(0.04, 0.12, "#8fe3ff", [-0.45, 0.02, -0.2], 0.04, 8);
  return m;
}

/** A pond: an irregular stone rim, water, lily pads, reeds. */
export function pond(rx: number, rz: number): Model {
  const m = new Model();
  const rnd = seeded(12);
  for (let i = 0; i < 26; i++) {
    const a = (i / 26) * Math.PI * 2;
    m.ball(
      0.2 + rnd() * 0.08,
      i % 3 ? C.stoneLight : C.stone,
      [Math.cos(a) * rx, 0.05, Math.sin(a) * rz],
      [1.3, 0.6, 1],
      8,
    );
  }
  const water = new THREE.Mesh(new THREE.CircleGeometry(1, 40), glass("#4fb4e8", 0.85));
  water.rotation.x = -Math.PI / 2;
  water.scale.set(rx, rz, 1);
  water.position.y = 0.04;
  m.add(water);
  const bottom = new THREE.Mesh(new THREE.CircleGeometry(1, 40), toon("#2f6f9a"));
  bottom.rotation.x = -Math.PI / 2;
  bottom.scale.set(rx, rz, 1);
  bottom.position.y = 0.01;
  m.add(bottom);
  for (let i = 0; i < 6; i++) {
    const a = rnd() * Math.PI * 2;
    const r = 0.3 + rnd() * 0.5;
    const pad = m.cyl(0.16, 0.01, "#58b36a", [Math.cos(a) * rx * r, 0.05, Math.sin(a) * rz * r], 0.16, 12);
    pad.rotation.y = a;
    if (i % 2) m.ball(0.05, "#ff9ac4", [Math.cos(a) * rx * r, 0.08, Math.sin(a) * rz * r]);
  }
  for (let i = 0; i < 9; i++) {
    const a = Math.PI * 0.9 + rnd() * 0.8;
    m.cyl(0.015, 0.5 + rnd() * 0.3, "#6aa84a", [Math.cos(a) * rx * 0.9, 0, Math.sin(a) * rz * 0.9], 0.008, 4);
  }
  return m;
}

/** A little rounded car facing +x, headlights and all. */
export function car(color: string): Model {
  const m = new Model();
  m.box([1.35, 0.36, 0.72], color, [0, 0.14, 0], 0.14);
  m.box([0.78, 0.32, 0.64], tint(color, 0.15), [-0.08, 0.46, 0], 0.12);
  const win = glass("#bfe6ff", 0.85);
  m.box([0.8, 0.22, 0.66], win, [-0.08, 0.5, 0], 0.08);
  for (const x of [-0.42, 0.42])
    for (const z of [-0.34, 0.34]) {
      const wheel = m.cyl(0.15, 0.1, "#2b2433", [x, 0.15, z - 0.05 * Math.sign(z)], 0.15, 14);
      wheel.rotation.x = Math.PI / 2;
      wheel.position.y = 0.15;
    }
  for (const z of [-0.22, 0.22]) {
    m.ball(0.055, glow("#fff6d0"), [0.67, 0.32, z], [0.5, 1, 1]);
    m.ball(0.045, glow("#ff5a4a"), [-0.67, 0.32, z], [0.5, 1, 1]);
  }
  m.box([0.1, 0.06, 0.6], "#cfd3da", [0.7, 0.18, 0], 0.03);
  return m;
}
