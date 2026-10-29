/**
 * The furniture `furniture.ts` lacks, one builder per 2D piece, under the 2D catalog's ids and prices:
 * the company house's rest (`COMPANY_FURNITURE` in core/src/office.ts), touched grass (`FURNITURE`), the
 * raid's two trophies (`TROPHIES` in core/src/loot.ts), the 14 personal-office pieces (core/src/home.ts),
 * and the ten game posters (`posters3d.ts`). The shapes follow the sprites in web/src/art/furniture-fancy.ts,
 * furniture-home.ts and objects.ts. Same conventions as furniture.ts: a model stands on its footprint's
 * centre, front towards +z; a footprint is `w` by `d` tiles.
 *
 * `WALL_ASSET_IDS` are the ones that hang (`room.hang(model, x, y)`: they build on y = 0 facing +z),
 * `CEILING_ASSET_IDS` hang from the ceiling (built to reach a 2.6 high wall). Also exported here:
 * `deskTier` (desk setups, `desks3d.ts`) and the merch helpers (`merch3d.ts`).
 */
import * as THREE from "three";
import { C } from "../../art/palette.ts";
import { glyphPixels, Pen } from "../../art/pixels.ts";
import { canvasTexture, glass, glow, Model, painted, seeded, ticks, tint, type V3 } from "../kit/kit.ts";
import { panel } from "../kit/panel.ts";
import { merchColours, merchPrintTexture, merchProp, merchShirtTexture } from "../people/merch3d.ts";
import { DESK_TIERS, deskTier } from "./desks3d.ts";
import { type Asset, bed, desk, light, sofa } from "./furniture.ts";
import { NIGHT_ASSETS } from "./night3d.ts";
import { NORSE_ASSETS } from "./norse3d.ts";
import { NUSANTARA_ASSETS } from "./nusantara3d.ts";
import { POSTER_ASSETS, POSTER_TEXT } from "./posters3d.ts";

export type { MerchCompany, MerchKind } from "../people/merch3d.ts";
export { DESK_TIERS, deskTier, merchColours, merchPrintTexture, merchProp, merchShirtTexture, POSTER_TEXT };

const GOLD = "#f5c842";
const GOLD_DARK = "#c9971f";
const GOLD_LIGHT = "#fff1a8";
const BRASS = "#e9b73d";
const TEAK = "#a8683a";
const TEAK_DARK = "#7c4a28";
const TEAK_LIGHT = "#c98a55";
const CREAM = "#efe6d2";
const PLINTH = "#3a3546";

// MARK: Helpers

const BOOKS = ["#c8503c", "#3d6f9e", "#e8c14a", "#58b36a", "#9b6fd6", "#f2f0ea", "#8c5c36", "#e86bd8"];
/** A row of books between `x0` and `x1`, standing on `y`. */
function books(m: Model, x0: number, x1: number, y: number, z: number, maxH: number, seed: number): void {
  const rnd = seeded(seed);
  let x = x0;
  while (x < x1 - 0.04) {
    const w = 0.035 + rnd() * 0.035;
    if (x + w > x1) break;
    const h = maxH * (0.65 + rnd() * 0.35);
    const book = m.box([w, h, 0.17], BOOKS[Math.floor(rnd() * BOOKS.length)]!, [x + w / 2, y, z], 0.006);
    if (rnd() < 0.1 && x + 0.12 < x1) book.rotation.z = -0.25;
    x += w + 0.004;
  }
}

/** A pot with soil, its rim `h` high. */
function pot(m: Model, r: number, h: number, color = "#c2703d", at: V3 = [0, 0, 0]): number {
  const [x, y, z] = at;
  m.cyl(r * 0.78, h - 0.006, color, [x, y, z], r, 16);
  m.cyl(r + 0.015, 0.05, tint(color, -0.12), [x, y + h - 0.05, z], r + 0.015, 16);
  m.cyl(r * 0.9, 0.01, "#5e3d28", [x, y + h - 0.02, z], r * 0.9, 16);
  return y + h;
}

/** A flattened oval lying on the floor: a disc `rx` wide and `rz` deep. */
function disc(m: Model, rx: number, rz: number, y: number, h: number, color: string): void {
  const d = m.cyl(rx, h, color, [0, y, 0], rx, 32);
  d.scale.z = rz / rx;
}

/** A rubber duck standing on `at`. */
function duck(m: Model, at: V3, pirate = false): void {
  const [x, y, z] = at;
  const yellow = "#f5d14a";
  m.ball(0.05, yellow, [x, y + 0.05, z], [1.1, 0.9, 1.25]);
  m.ball(0.032, yellow, [x, y + 0.11, z + 0.03]);
  m.ball(0.022, yellow, [x, y + 0.07, z - 0.06], [1, 0.8, 1]);
  m.box([0.035, 0.012, 0.03], "#f08a2c", [x, y + 0.1, z + 0.065], 0.005);
  for (const s of [-1, 1]) m.ball(0.007, C.ink, [x + s * 0.02, y + 0.12, z + 0.05]);
  if (pirate) {
    m.cyl(0.04, 0.015, C.ink, [x, y + 0.14, z + 0.03], 0.03, 8);
    m.box([0.055, 0.02, 0.012], C.ink, [x, y + 0.13, z + 0.055]);
  }
}

// MARK: Company house pieces

const touchedGrass = (): Model => {
  const m = new Model();
  const rnd = seeded(11);
  // The sod: soil under a turf that hangs a little over the edge, and a few raised clumps so it is not flat.
  m.box([1.84, 0.12, 0.84], C.trunk, [0, 0, 0], 0.03);
  m.box([1.92, 0.07, 0.92], C.grassDark, [0, 0.11, 0], 0.03);
  m.box([1.82, 0.05, 0.8], C.leaf, [0, 0.17, 0], 0.02);
  for (let i = 0; i < 9; i++) {
    const w = 0.24 + rnd() * 0.2;
    const d = 0.16 + rnd() * 0.16;
    const x = (rnd() * 2 - 1) * (0.9 - w / 2);
    const z = (rnd() * 2 - 1) * (0.4 - d / 2);
    m.box([w, 0.045, d], i % 2 ? C.leafLight : C.grass, [x, 0.215 + i * 0.003, z], 0.015);
  }
  // Tufts of blades, tallest in the middle of each, leaning a little.
  const shades = [C.leafDark, C.leaf, C.leafLight, C.grass, C.grassLight];
  const tufts: [number, number, number][] = [
    [-0.64, 0.12, 1],
    [-0.28, 0.2, 0.8],
    [0.06, -0.15, 1.15],
    [0.42, 0.18, 0.9],
    [0.7, -0.1, 1.05],
  ];
  for (const [cx, cz, k] of tufts)
    for (let i = 0; i < 12; i++) {
      const a = rnd() * Math.PI * 2;
      const r = rnd() * 0.17;
      const h = (0.14 + (0.17 - r) * 1.3 + rnd() * 0.06) * k;
      const blade = m.cyl(
        0.024,
        h,
        shades[i % shades.length]!,
        [cx + Math.cos(a) * r, 0.22, cz + Math.sin(a) * r * 0.8],
        0.002,
        4,
      );
      blade.rotation.set((rnd() - 0.5) * 0.5, 0, (rnd() - 0.5) * 0.5);
    }
  // Tiny flowers on thin stems: daisies, a buttercup, a red bud.
  const flowers: [number, number, string, number][] = [
    [-0.45, 0.2, C.flowerWhite, 0.2],
    [-0.12, -0.25, C.flowerYellow, 0.17],
    [0.28, 0.02, C.flowerWhite, 0.22],
    [0.58, 0.27, C.flowerRed, 0.18],
    [-0.8, 0.25, C.flowerYellow, 0.15],
    [0.84, 0.2, C.flowerWhite, 0.16],
  ];
  for (const [fx, fz, colour, h] of flowers) {
    m.cyl(0.008, h, C.leafDark, [fx, 0.22, fz], 0.006, 5);
    const top = 0.22 + h;
    if (colour === C.flowerRed) m.ball(0.026, colour, [fx, top, fz], [1, 1, 1], 6);
    else {
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        m.ball(
          0.02,
          colour === C.flowerYellow ? "#fff4b8" : colour,
          [fx + Math.cos(a) * 0.032, top, fz + Math.sin(a) * 0.032],
          [1, 0.4, 1],
          6,
        );
      }
      m.ball(
        0.017,
        colour === C.flowerYellow ? C.flowerYellow : "#f5c43a",
        [fx, top + 0.006, fz],
        [1, 0.8, 1],
        6,
      );
    }
  }
  // A little stake with a plaque at the back corner.
  m.box([0.03, 0.2, 0.03], C.woodDark, [-0.66, 0.2, -0.36], 0.008);
  const sign = panel(
    0.46,
    0.2,
    (g, w, h) => {
      const p = new Pen(g);
      p.rect(0, 0, w, h, C.woodLight);
      p.rect(0, 0, w, 1, tint(C.woodLight, 0.15));
      p.text("GRASS", Math.round((w - 19) / 2), 3, C.ink);
    },
    { frame: C.woodDark, lift: 0.34, px: 24 },
  );
  sign.position.set(-0.66, 0.04, -0.34);
  m.add(sign);
  return m;
};

const rugPersian = (): Model => {
  const m = new Model();
  const t = C.rug;
  const dark = tint(t, -0.3);
  const light = C.rugLight;
  const tex = canvasTexture(48, 32, (g) => {
    const p = new Pen(g);
    for (let y = 3; y < 30; y += 2) {
      p.px(0, y, C.pillow);
      p.px(47, y, C.pillow);
    }
    p.rect(1, 1, 46, 30, dark);
    p.rect(3, 3, 42, 26, light);
    p.rect(4, 4, 40, 24, t);
    for (let x = 6; x < 43; x += 4) {
      p.px(x, 2, light);
      p.px(x, 29, light);
    }
    for (let i = 0; i < 9; i++) {
      p.rect(24 - i, 8 + i, i * 2 + 1, 1, i % 3 === 0 ? light : dark);
      p.rect(24 - i, 24 - i, i * 2 + 1, 1, i % 3 === 0 ? light : dark);
    }
    p.rect(16, 16, 17, 1, dark);
    p.disc(24, 16, 3, light);
    p.disc(24, 16, 1, C.pillow);
    for (const [x, y] of [
      [8, 8],
      [40, 8],
      [8, 24],
      [40, 24],
    ] as const) {
      p.rect(x - 1, y, 3, 1, light);
      p.rect(x, y - 1, 1, 3, light);
    }
  });
  m.box([2.9, 0.025, 1.9], painted(tex), [0, 0, 0], 0.008);
  return m;
};

const globe = (): Model => {
  const m = new Model();
  m.cyl(0.17, 0.04, C.woodDark, [0, 0, 0], 0.15, 16);
  m.cyl(0.03, 0.2, C.woodDark, [0, 0.04, 0], 0.03, 8);
  const tex = canvasTexture(64, 32, (g) => {
    const p = new Pen(g);
    p.rect(0, 0, 64, 32, C.water);
    p.rect(0, 0, 64, 3, C.foam);
    p.rect(0, 29, 64, 3, C.foam);
    p.grid(
      [
        "...11......1111...",
        "..1111...11111111.",
        "..111....1111.111.",
        "...1.....111...11.",
        "....1.....1.......",
        "....11......11....",
      ],
      { "1": C.leaf },
      4,
      9,
    );
    p.grid([".111.", "11111", ".11.."], { "1": C.leafLight }, 30, 12);
    p.grid(["..11..", ".1111.", "..11.."], { "1": C.leaf }, 46, 8);
    p.grid(["..1..", ".111."], { "1": C.leafDark }, 50, 20);
  });
  const ball = m.ball(0.17, painted(tex), [0, 0.36, 0], [1, 1, 1], 20);
  ball.rotation.z = 0.4;
  // The brass meridian.
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.19, 0.011, 6, 28),
    new THREE.MeshToonMaterial({ color: BRASS }),
  );
  ring.position.set(0, 0.36, 0);
  ring.rotation.y = Math.PI / 2;
  ring.castShadow = true;
  m.add(ring);
  m.cyl(0.012, 0.03, GOLD_DARK, [0, 0.53, 0], 0.012, 6);
  ticks.push((t) => (ball.rotation.y = t * 0.4));
  return m;
};

const plantWall = (): Model => {
  const m = new Model();
  const [w, h] = [1.9, 1.5];
  m.box([w, h, 0.1], C.woodDark, [0, 0.1, 0]);
  m.box([w - 0.1, h - 0.24, 0.03], C.leafInk, [0, 0.28, 0.06], 0.01);
  // Clusters of leaves, packed and overlapping.
  const rnd = seeded(23);
  const greens = [C.leafDark, C.leaf, C.leafLight, C.leaf];
  let k = 0;
  for (let row = 0; row < 6; row++)
    for (let x = -0.8 + (row % 2) * 0.1; x < 0.86; x += 0.21) {
      const c = greens[k++ % 4]!;
      m.ball(0.12 + rnd() * 0.03, c, [x, 0.4 + row * 0.19, 0.1 + rnd() * 0.04], [1, 0.9, 0.55], 8);
    }
  for (const [x, y] of [
    [-0.55, 1.3],
    [0.25, 1.1],
    [-0.1, 0.75],
    [0.65, 0.5],
    [-0.75, 0.45],
  ] as const)
    m.ball(0.035, C.flowerWhite, [x, y, 0.17], [1, 1, 0.5], 6);
  for (const [x, y] of [
    [0.1, 1.45],
    [0.55, 0.95],
    [-0.4, 1.0],
  ] as const)
    m.ball(0.035, C.flowerRed, [x, y, 0.17], [1, 1, 0.5], 6);
  // Trailing vines over the planter, and the planter itself.
  for (const x of [-0.7, -0.1, 0.5]) {
    const vine = m.cyl(0.012, 0.34, C.leaf, [x, 0.0, 0.2], 0.012, 5);
    vine.position.y = 0.18;
    m.ball(0.04, C.leafLight, [x, 0.18, 0.2], [1, 1, 0.6], 6);
  }
  m.box([w, 0.2, 0.34], C.wood, [0, 0, 0.1], 0.02);
  m.box([w - 0.06, 0.03, 0.3], C.woodLight, [0, 0.19, 0.1], 0.01);
  return m;
};

const chandelier = (): Model => {
  const m = new Model();
  const top = 2.6;
  m.cyl(0.015, 0.55, BRASS, [0, top - 0.55, 0], 0.015, 6);
  m.cyl(0.06, 0.02, GOLD_DARK, [0, top - 0.02, 0], 0.06, 12);
  m.ball(0.09, BRASS, [0, top - 0.6, 0], [1, 1, 1], 12);
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.72, 0.022, 6, 32),
    new THREE.MeshToonMaterial({ color: BRASS }),
  );
  ring.position.set(0, top - 0.62, 0);
  ring.rotation.x = Math.PI / 2;
  ring.scale.set(1, 0.42, 1);
  ring.castShadow = true;
  m.add(ring);
  m.cyl(0.015, 0.14, GOLD_DARK, [0, top - 0.76, 0], 0.01, 6);
  m.ball(0.04, glass("#a8dcf7", 0.7), [0, top - 0.78, 0]);
  // Five arms with candles.
  const flames: THREE.Mesh[] = [];
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const x = Math.cos(a) * 0.72;
    const z = Math.sin(a) * 0.72 * 0.42;
    m.cyl(0.024, 0.1, BRASS, [x, top - 0.6, z], 0.03, 8);
    m.cyl(0.018, 0.13, C.white, [x, top - 0.5, z], 0.018, 8);
    flames.push(m.ball(0.022, glow(C.lamp), [x, top - 0.34, z], [0.8, 1.4, 0.8], 6));
    // Crystals hanging from the ring.
    m.cyl(0.012, 0.09, glass("#a8dcf7", 0.8), [x * 0.98, top - 0.72, z * 0.98], 0.002, 5);
  }
  ticks.push((t) => {
    for (const [i, f] of flames.entries()) f.scale.setY(1.3 + Math.sin(t * 9 + i * 2.3) * 0.25);
  });
  light(m, [0, top - 0.7, 0], "#ffcf7a", 2.6, 6);
  return m;
};

const bookshelfLibrary = (): Model => {
  const m = new Model();
  const [w, h, d] = [1.88, 1.7, 0.34];
  const wood = C.woodDark;
  m.box([w - 0.01, h - 0.004, 0.026], tint(wood, -0.15), [0, 0, -d / 2 + 0.017]);
  for (const x of [-w / 2 + 0.03, w / 2 - 0.03]) m.box([0.06, h, d], wood, [x, 0, 0]);
  m.box([w, 0.05, d], wood, [0, h - 0.05, 0], 0.01);
  for (let i = 0; i < 4; i++) {
    const y = 0.03 + i * 0.5;
    m.box([w, 0.04, d], wood, [0, y, 0]);
    if (i < 3) books(m, -w / 2 + 0.07, w / 2 - 0.07, y + 0.04, 0.0, 0.36, i * 5 + 9);
  }
  // A library ladder leaning on the right half, with a brass rail along the top.
  const ladder = m.part([0.55, 0, 0.2]);
  ladder.rotation.x = -0.12;
  for (const x of [-0.12, 0.12]) ladder.box([0.03, 1.65, 0.03], C.woodLight, [x, 0, 0]);
  for (let y = 0.2; y < 1.6; y += 0.3) ladder.box([0.24, 0.025, 0.04], C.woodLight, [0, y, 0.0]);
  m.box([w - 0.1, 0.02, 0.025], BRASS, [0, h - 0.02, d / 2 - 0.01]);
  return m;
};

// MARK: Trophies

const goldenHourglass = (): Model => {
  const m = new Model();
  m.box([0.5, 0.26, 0.4], PLINTH, [0, 0, 0], 0.03);
  m.box([0.46, 0.02, 0.36], tint(PLINTH, 0.25), [0, 0.26, 0]);
  const y0 = 0.28;
  m.cyl(0.2, 0.05, GOLD, [0, y0, 0], 0.2, 20);
  m.cyl(0.2, 0.05, GOLD, [0, y0 + 0.58, 0], 0.2, 20);
  for (const a of [0, 1, 2]) {
    const t = (a / 3) * Math.PI * 2 + 0.5;
    m.cyl(0.012, 0.55, GOLD_DARK, [Math.cos(t) * 0.17, y0 + 0.05, Math.sin(t) * 0.17], 0.012, 6);
  }
  // The glass: wide, pinched, wide, with sand in it.
  const g = glass("#e9f6fb", 0.55);
  m.cyl(0.04, 0.26, g, [0, y0 + 0.05, 0], 0.15, 16);
  m.cyl(0.15, 0.26, g, [0, y0 + 0.31, 0], 0.04, 16);
  const sand = "#f2c46b";
  m.cyl(0.14, 0.01, sand, [0, y0 + 0.31, 0], 0.14, 16).position.y = y0 + 0.55;
  m.cyl(0.032, 0.14, sand, [0, y0 + 0.05, 0], 0.13, 14);
  m.cyl(0.006, 0.24, sand, [0, y0 + 0.2, 0], 0.006, 4);
  light(m, [0, 0.7, 0.4], "#ffd36a", 1.0, 2.5);
  return m;
};

const goldenRebase = (): Model => {
  const m = new Model();
  m.box([0.5, 0.26, 0.4], PLINTH, [0, 0, 0], 0.03);
  m.box([0.46, 0.02, 0.36], tint(PLINTH, 0.25), [0, 0.26, 0]);
  m.cyl(0.07, 0.04, GOLD_DARK, [0, 0.28, 0], 0.09, 12);
  m.cyl(0.025, 0.14, GOLD_DARK, [0, 0.32, 0], 0.025, 8);
  // The cup and its handles.
  m.cyl(0.07, 0.04, GOLD, [0, 0.45, 0], 0.07, 12);
  m.cyl(0.1, 0.3, GOLD, [0, 0.49, 0], 0.18, 18);
  m.cyl(0.18, 0.02, GOLD_LIGHT, [0, 0.79, 0], 0.18, 18);
  for (const s of [-1, 1]) {
    const handle = new THREE.Mesh(
      new THREE.TorusGeometry(0.075, 0.016, 6, 14, Math.PI),
      new THREE.MeshToonMaterial({ color: GOLD_DARK }),
    );
    handle.position.set(s * 0.17, 0.66, 0);
    handle.rotation.z = s > 0 ? -Math.PI / 2 : Math.PI / 2;
    handle.castShadow = true;
    m.add(handle);
  }
  // A straight history: four commits on one line.
  m.box([0.2, 0.012, 0.012], C.ink, [0, 0.64, 0.148]);
  for (const x of [-0.09, -0.03, 0.04, 0.09]) m.ball(0.017, C.ink, [x, 0.64, 0.15], [1, 1, 0.5], 8);
  m.ball(0.012, "#5aa8ff", [-0.09, 0.64, 0.163], [1, 1, 0.4], 6);
  m.ball(0.012, "#5aa8ff", [0.09, 0.64, 0.163], [1, 1, 0.4], 6);
  light(m, [0, 0.7, 0.4], "#ffd36a", 1.0, 2.5);
  return m;
};

// MARK: Personal office pieces

const cactus = (): Model => {
  const m = new Model();
  const rim = pot(m, 0.15, 0.2, "#e08e57");
  m.cyl(0.075, 0.5, C.leaf, [0, rim, 0], 0.07, 12);
  m.ball(0.075, C.leaf, [0, rim + 0.5, 0], [1, 0.9, 1], 10);
  for (const [s, y, up] of [
    [-1, 0.2, 0.2],
    [1, 0.3, 0.16],
  ] as const) {
    m.cyl(0.05, 0.14, C.leaf, [s * 0.1, rim + y, 0], 0.05, 10).rotation.z = (-s * Math.PI) / 2;
    m.cyl(0.045, up, C.leaf, [s * 0.17, rim + y - 0.04, 0], 0.045, 10);
    m.ball(0.045, C.leaf, [s * 0.17, rim + y - 0.04 + up, 0], [1, 0.9, 1], 8);
  }
  for (const [x, y] of [
    [0.03, 0.15],
    [-0.04, 0.3],
    [0.04, 0.42],
    [-0.03, 0.08],
  ] as const)
    m.ball(0.01, C.leafLight, [x, rim + y, 0.07], [1, 1, 0.6], 4);
  m.ball(0.035, "#f28bb2", [0, rim + 0.59, 0], [1, 0.8, 1], 8);
  m.ball(0.015, C.flowerRed, [0, rim + 0.62, 0], [1, 1, 1], 6);
  return m;
};

const certificate = (): Model =>
  panel(
    0.56,
    0.46,
    (g, w, h) => {
      const p = new Pen(g);
      p.rect(0, 0, w, h, "#f6efd9");
      p.rect(2, 2, w - 4, 1, C.metal);
      p.rect(3, 4, w - 6, 1, C.metalLight);
      p.rect(2, 6, w - 8, 1, C.metalLight);
      p.rect(2, 8, w - 7, 1, C.metalLight);
      p.disc(w - 4, h - 4, 2, C.flowerRed);
      p.px(w - 5, h - 1, C.flowerRed);
      p.px(w - 3, h - 1, C.flowerRed);
    },
    { frame: TEAK, px: 24 },
  );

const beanBag = (): Model => {
  const m = new Model();
  const teal = "#3fa6a0";
  m.ball(0.36, teal, [0, 0.22, 0], [1, 0.62, 1], 18);
  m.ball(0.3, tint(teal, -0.12), [0, 0.36, -0.14], [1, 0.75, 0.6], 16);
  m.ball(0.2, tint(teal, 0.2), [0, 0.32, 0.05], [1, 0.4, 1], 12);
  return m;
};

const hangingPlant = (): Model => {
  const m = new Model();
  // Hook, macrame cords, the pot, and a pothos trailing down.
  m.box([0.04, 0.04, 0.12], C.ink, [0, 1.05, 0.05]);
  for (const x of [-0.1, 0, 0.1]) {
    const cord = m.cyl(0.006, 0.4, CREAM, [x * 0.5, 0.68, 0.0], 0.006, 4);
    cord.rotation.z = -x * 0.8;
  }
  m.cyl(0.11, 0.16, "#c2703d", [0, 0.52, 0], 0.15, 14);
  m.cyl(0.14, 0.03, "#9a5530", [0, 0.66, 0], 0.15, 14);
  const rnd = seeded(31);
  for (const [x0, len] of [
    [-0.1, 0.4],
    [0.04, 0.28],
    [0.12, 0.36],
  ] as const)
    for (let i = 0; i < 8; i++) {
      const y = 0.55 - (i / 8) * len;
      m.ball(
        0.035 + rnd() * 0.015,
        i % 2 ? C.leaf : C.leafLight,
        [x0 + (rnd() - 0.5) * 0.04, y, 0.08 + rnd() * 0.04],
        [1, 0.8, 0.6],
        6,
      );
    }
  m.ball(0.06, C.leaf, [-0.15, 0.7, 0.0], [1, 0.7, 1], 8);
  m.ball(0.06, C.leafDark, [0.15, 0.7, 0.0], [1, 0.7, 1], 8);
  return m;
};

const woolRug = (): Model => {
  const m = new Model();
  const layers: [number, string][] = [
    [0.96, "#6d4c3d"],
    [0.9, CREAM],
    [0.72, "#c4544b"],
    [0.58, CREAM],
    [0.4, "#3d4a6b"],
    [0.2, CREAM],
  ];
  for (const [i, [r, c]] of layers.entries()) disc(m, r, r * 0.5, 0, 0.012 + i * 0.004, c);
  return m;
};

const floorLamp = (): Model => {
  const m = new Model();
  m.cyl(0.14, 0.04, C.ink, [0, 0, 0], 0.13, 16);
  m.cyl(0.015, 1.1, C.metalLight, [0, 0.04, 0], 0.015, 8);
  m.cyl(0.19, 0.3, "#f4e0a8", [0, 1.0, 0], 0.09, 18);
  m.cyl(0.2, 0.015, C.lamp, [0, 1.0, 0], 0.2, 18);
  m.ball(0.05, glow(C.lamp), [0, 1.06, 0]);
  light(m, [0, 0.95, 0], "#ffcf7a", 2.4);
  return m;
};

const fiddleFig = (): Model => {
  const m = new Model();
  const rim = pot(m, 0.17, 0.3, CREAM);
  m.cyl(0.025, 0.7, C.trunkDark, [0, rim, 0], 0.02, 8);
  const rnd = seeded(41);
  // Big violin-shaped leaves, glossy and dark.
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + rnd() * 0.5;
    const y = rim + 0.22 + i * 0.07;
    const r = 0.14 + (i % 3) * 0.04;
    const stem = m.cyl(0.008, r + 0.06, C.trunkDark, [0, y, 0], 0.008, 4);
    stem.rotation.set(Math.sin(a) * 1.1, 0, -Math.cos(a) * 1.1);
    const leaf = m.ball(
      0.12,
      i % 2 ? C.leaf : C.leafDark,
      [Math.cos(a) * (r + 0.1), y + 0.04, Math.sin(a) * (r + 0.1)],
      [0.75, 0.14, 1],
      10,
    );
    leaf.rotation.set(0, -a, 0.35);
  }
  m.ball(0.11, C.leafLight, [0, rim + 0.78, 0], [1, 0.4, 1], 8);
  return m;
};

const duckShelf = (): Model => {
  const m = new Model();
  const [w, h, d] = [0.7, 1.3, 0.3];
  m.box([w, h, 0.03], tint(TEAK_DARK, -0.1), [0, 0, -d / 2 + 0.015]);
  for (const x of [-w / 2 + 0.025, w / 2 - 0.025]) m.box([0.05, h, d], TEAK_DARK, [x, 0, 0]);
  for (const [i, y] of [0.03, 0.46, 0.89, 1.26].entries()) {
    m.box([w, 0.04, d], TEAK, [0, y, 0]);
    m.box([w, 0.012, 0.012], TEAK_LIGHT, [0, y + 0.03, d / 2 - 0.006]);
    if (i === 0) {
      duck(m, [-0.18, y + 0.04, 0.02]);
      duck(m, [0.15, y + 0.04, 0.03]);
    } else if (i === 1) {
      duck(m, [0, y + 0.04, 0.03], true);
    } else if (i === 2) {
      duck(m, [-0.12, y + 0.04, 0.02]);
      duck(m, [0.1, y + 0.04, 0.02]);
      m.cyl(0.03, 0.05, C.flowerRed, [0.24, y + 0.04, 0.02], 0.03, 8);
    }
  }
  return m;
};

const wallWhiteboard = (): Model =>
  panel(
    1.78,
    0.78,
    (g, w, h) => {
      const p = new Pen(g);
      p.rect(0, 0, w, h, C.white);
      const box = (x: number, y: number, c: string) => {
        p.rect(x, y, 9, 6, c);
        p.rect(x + 1, y + 1, 7, 4, C.white);
      };
      box(3, 3, "#4f8fe0");
      box(20, 3, "#9b6fd6");
      p.rect(12, 5, 8, 1, "#4f8fe0");
      p.rect(29, 5, 5, 1, "#4f8fe0");
      // The cloud.
      p.disc(37, 7, 3, "#a8dcf7");
      p.rect(34, 7, 8, 2, "#7cc0e6");
      // A rising line.
      for (let i = 0; i < 8; i++) p.px(3 + i * 2, h - 3 - i, "#e8584f");
      for (const y of [h - 8, h - 5]) {
        p.px(22, y, "#3ddc84");
        p.rect(24, y, 6 + (y % 3), 1, C.metal);
      }
      for (const x of [34, 36, 38]) p.px(x, h - 2, "#4f8fe0");
      p.rect(40, h - 2, 2, 1, "#e8584f");
    },
    { frame: C.metalLight, px: 24 },
  );

const homeFridge = (): Model => {
  const m = new Model();
  const coral = "#d96a4f";
  m.box([0.5, 0.8, 0.48], coral, [0, 0.04, 0], 0.08);
  m.box([0.46, 0.015, 0.02], tint(coral, -0.3), [0, 0.5, 0.245]);
  m.box([0.02, 0.1, 0.03], "#cfd6df", [0.2, 0.55, 0.255], 0.008);
  m.box([0.02, 0.18, 0.03], "#cfd6df", [0.2, 0.2, 0.255], 0.008);
  // A Danish flag magnet and a sticky note.
  m.box([0.1, 0.07, 0.01], C.flowerRed, [-0.1, 0.3, 0.245]);
  m.box([0.1, 0.012, 0.012], C.white, [-0.1, 0.33, 0.25]);
  m.box([0.012, 0.07, 0.012], C.white, [-0.13, 0.3, 0.25]);
  m.box([0.07, 0.06, 0.008], C.flowerYellow, [-0.05, 0.63, 0.245]);
  for (const x of [-0.2, 0.2]) for (const z of [-0.17, 0.17]) m.cyl(0.02, 0.04, C.ink, [x, 0, z], 0.02, 8);
  return m;
};

const bonsaiStand = (): Model => {
  const m = new Model();
  // A teak stand: top, legs and a shelf between them.
  m.box([0.42, 0.05, 0.3], TEAK, [0, 0.45, 0], 0.012);
  m.box([0.38, 0.012, 0.26], TEAK_LIGHT, [0, 0.5, 0]);
  for (const x of [-0.17, 0.17])
    for (const z of [-0.11, 0.11]) m.box([0.04, 0.45, 0.04], TEAK_DARK, [x, 0, z]);
  m.box([0.34, 0.025, 0.22], TEAK_DARK, [0, 0.2, 0]);
  // A glazed tray and a twisty trunk with three pads.
  m.box([0.32, 0.07, 0.22], "#3c5a6b", [0, 0.51, 0], 0.02);
  m.box([0.28, 0.01, 0.18], "#5e3d28", [0, 0.58, 0]);
  const trunk = m.cyl(0.03, 0.26, C.trunkDark, [0, 0.58, 0], 0.016, 7);
  trunk.rotation.z = 0.3;
  for (const [x, y, s] of [
    [-0.1, 0.78, 0.11],
    [0.1, 0.74, 0.1],
    [-0.01, 0.9, 0.12],
  ] as const) {
    m.ball(s, C.leaf, [x, y, 0], [1.3, 0.5, 1], 10);
    m.ball(s * 0.6, C.leafLight, [x - 0.02, y + 0.03, 0.02], [1.3, 0.4, 1], 8);
  }
  return m;
};

const bookcase = (): Model => {
  const m = new Model();
  const [w, h, d] = [1.88, 1.55, 0.34];
  m.box([w - 0.01, h - 0.004, 0.026], "#3a2a22", [0, 0, -d / 2 + 0.017]);
  for (const x of [-w / 2 + 0.03, w / 2 - 0.03]) m.box([0.06, h, d], TEAK_DARK, [x, 0, 0]);
  m.box([w, 0.05, d], TEAK_DARK, [0, h - 0.05, 0], 0.01);
  m.box([w + 0.02, 0.015, d + 0.02], TEAK_LIGHT, [0, h, 0]);
  for (let i = 0; i < 3; i++) {
    const y = 0.03 + i * 0.5;
    m.box([w, 0.04, d], TEAK, [0, y, 0]);
    // The middle shelf leaves a gap for a small plant.
    if (i === 1) {
      books(m, -w / 2 + 0.07, 0.25, y + 0.04, 0, 0.38, 77);
      books(m, 0.62, w / 2 - 0.07, y + 0.04, 0, 0.38, 78);
      const rim = pot(m, 0.06, 0.1, "#c2703d", [0.43, y + 0.04, 0]);
      m.ball(0.085, C.leaf, [0.43, rim + 0.06, 0], [1, 0.9, 1], 8);
    } else books(m, -w / 2 + 0.07, w / 2 - 0.07, y + 0.04, 0, 0.38, i * 3 + 61);
  }
  return m;
};

const wallNeon = (): Model => {
  const text = "SHIP IT";
  const draw = (flicker: boolean) => (g: CanvasRenderingContext2D, w: number, h: number) => {
    const p = new Pen(g);
    p.rect(0, 0, w, h, "#2f2838");
    p.rect(1, 1, w - 2, 1, "#3b3347");
    const x0 = Math.floor((w - (text.length * 4 - 1)) / 2);
    const y0 = Math.floor((h - 5) / 2);
    const pink = "#f28bb2";
    // The last letters flicker out.
    const lit: [number, number, boolean][] = [];
    [...text].forEach((ch, i) => {
      for (const [dx, dy] of glyphPixels(ch)) lit.push([x0 + i * 4 + dx, y0 + dy, i >= 5]);
    });
    const on = (late: boolean) => !flicker || !late;
    for (const [x, y, late] of lit)
      if (on(late))
        for (const [dx, dy] of [
          [-1, 0],
          [1, 0],
          [0, -1],
          [0, 1],
        ] as const)
          p.px(x + dx, y + dy, "rgba(242,139,178,0.35)");
    for (const [x, y, late] of lit) p.px(x, y, on(late) ? tint(pink, 0.55) : tint(pink, -0.45));
  };
  const m = panel(1.8, 0.62, draw(false), { frame: "#1b1f2a", px: 18, lit: true });
  let shown = false;
  ticks.push((t) => {
    const flick = Math.floor(t / 0.7) % 2 === 1;
    if (flick === shown) return;
    shown = flick;
    m.redraw(draw(flick));
  });
  light(m, [0, 0.35, 0.5], "#f28bb2", 1.4, 3);
  return m;
};

const keyboardCase = (): Model => {
  const m = new Model();
  // A walnut plinth with a brass plaque.
  m.box([1.84, 0.4, 0.6], TEAK_DARK, [0, 0, 0], 0.02);
  m.box([1.8, 0.015, 0.56], TEAK_LIGHT, [0, 0.4, 0]);
  m.box([0.5, 0.1, 0.012], BRASS, [0, 0.12, 0.3]);
  // The glass case over it.
  m.box([1.7, 0.95, 0.52], glass("#a8dcf7", 0.25), [0, 0.4, 0]);
  m.box([1.74, 0.03, 0.56], TEAK_DARK, [0, 1.35, 0], 0.01);
  // The keyboard on an acrylic stand, tilted: dark case, rows of keycaps.
  m.box([0.3, 0.1, 0.16], "#7cc0e6", [0, 0.415, 0.0]);
  const tilt = m.part([0, 0.55, 0.02]);
  tilt.rotation.x = -0.35;
  tilt.box([1.2, 0.05, 0.46], "#3c4454", [0, 0, 0], 0.02);
  const caps = ["#f2f0ea", "#f2f0ea", "#f2f0ea", "#e8584f", "#f2f0ea", "#4f8fe0"];
  for (let row = 0; row < 4; row++)
    for (let i = 0; i < 14; i++) {
      const accent = row === 0 && (i === 0 || i === 13);
      tilt.box(
        [0.06, 0.03, 0.06],
        accent ? "#f08a3c" : caps[(i + row * 2) % caps.length]!,
        [-0.56 + i * 0.086, 0.05, -0.15 + row * 0.09],
        0.01,
      );
    }
  tilt.box([0.6, 0.03, 0.06], "#f2f0ea", [0, 0.05, 0.19], 0.01);
  // Underglow, a different colour in each beat.
  const under = glow("#f28bb2");
  m.box([1.3, 0.012, 0.3], under, [0, 0.42, 0.1], 0.004);
  ticks.push((t) => under.color.set(Math.floor(t / 0.9) % 2 ? "#4f8fe0" : "#f28bb2"));
  light(m, [0, 0.6, 0.5], "#f28bb2", 1.2, 3);
  return m;
};

// MARK: Catalog

const asset = (
  id: string,
  name: string,
  price: number,
  w: number,
  d: number,
  build: () => Model,
  extra: Partial<Pick<Asset, "seat" | "bed">> = {},
): Asset => ({ id, name, price, w, d, build, ...extra });

/** Every piece `furniture.ts` lacks, ids and prices from the 2D catalogs. */
export const FURNITURE_EXTRA_ASSETS: readonly Asset[] = [
  // The map's own desk, sofa and bed are one tile each (`FURNITURE` has no width for them), as in 2D.
  asset("office-desk", "Desk", 75, 1, 1, desk(1, 1)),
  asset("office-sofa", "Sofa", 150, 1, 1, sofa(undefined, 1), { seat: { at: [0, 0.38, 0.05], turn: 0 } }),
  asset("office-bed", "Bed", 120, 1, 1, bed(1), { bed: [0, 0.3, -0.05] }),
  asset("touched-grass", "Touched grass", 0, 2, 1, touchedGrass),
  asset("golden-hourglass", "Golden Hourglass", 0, 1, 1, goldenHourglass),
  asset("golden-rebase", "Golden Rebase", 0, 1, 1, goldenRebase),
  asset("rug-persian", "Persian rug", 60, 3, 2, rugPersian),
  asset("globe", "Desk globe", 90, 1, 1, globe),
  asset("bookshelf-library", "Library bookshelf", 140, 2, 1, bookshelfLibrary),
  asset("plant-wall", "Plant wall", 300, 2, 1, plantWall),
  asset("chandelier", "Crystal chandelier", 900, 2, 1, chandelier),
  asset("cactus", "Cactus", 60, 1, 1, cactus),
  asset("certificate", "Framed certificate", 70, 1, 1, certificate),
  asset("bean-bag", "Bean bag", 90, 1, 1, beanBag, { seat: { at: [0, 0.32, 0.05], turn: 0 } }),
  asset("hanging-plant", "Hanging plant", 105, 1, 1, hangingPlant),
  asset("wool-rug", "Wool rug", 105, 2, 1, woolRug),
  asset("floor-lamp", "Floor lamp", 120, 1, 1, floorLamp),
  asset("fiddle-fig", "Fiddle-leaf fig", 135, 1, 1, fiddleFig),
  asset("duck-shelf", "Rubber-duck shelf", 150, 1, 1, duckShelf),
  asset("wall-whiteboard", "Office whiteboard", 165, 2, 1, wallWhiteboard),
  asset("home-fridge", "Mini fridge", 180, 1, 1, homeFridge),
  asset("bonsai-stand", "Bonsai on a stand", 195, 1, 1, bonsaiStand),
  asset("bookcase", "Bookcase", 225, 2, 1, bookcase),
  asset("wall-neon", "Pink neon sign", 300, 2, 1, wallNeon),
  asset("keyboard-case", "Mechanical keyboard display", 390, 2, 1, keyboardCase),
  ...NIGHT_ASSETS.map((a) => asset(a.id, a.name, 0, a.w, a.d, a.build)),
  ...NUSANTARA_ASSETS.map((a) => asset(a.id, a.name, 0, a.w, a.d, a.build)),
  ...NORSE_ASSETS.map((a) => asset(a.id, a.name, 0, a.w, a.d, a.build)),
  ...POSTER_ASSETS,
];

/** The pieces that hang on a wall (`room.hang(model, x, y)`): they are built on y = 0, facing +z. */
export const WALL_ASSET_IDS: ReadonlySet<string> = new Set([
  "plant-wall",
  "certificate",
  "hanging-plant",
  "wall-whiteboard",
  "wall-neon",
  "night-lanterns",
  "nus-batik-hanging",
  "norse-raven-banner",
  ...POSTER_ASSETS.map((a) => a.id),
]);

/** The pieces that hang from the ceiling: built to reach a wall 2.6 high. */
export const CEILING_ASSET_IDS: ReadonlySet<string> = new Set(["chandelier"]);

export const extraAssetById = new Map(FURNITURE_EXTRA_ASSETS.map((a) => [a.id, a]));

/** The five desk setups as catalog entries (`desk.<id>`, the 2D purchase item names), laptop to battlestation. */
export const DESK_TIER_ASSETS: readonly Asset[] = DESK_TIERS.map((t, i) => ({
  id: `desk.${t.id}`,
  name: t.name,
  price: t.price,
  w: 2,
  d: 1,
  build: () => deskTier(i),
}));
