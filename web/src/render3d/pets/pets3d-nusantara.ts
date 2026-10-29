/**
 * The Nusantara case's pets (core/src/case-nusantara.ts, pet.400 to pet.405) as voxel sculptures on the same `petvox`
 * grid as the Night Market's: a komodo dragon, a tarsier, a rhinoceros hornbill (enggang), a walking rafflesia, a
 * greater bird-of-paradise (cenderawasih) and an orangutan. Daylight colours, no glow. Builders are the same shape as
 * `pets3d-night.ts`: a `body` grid, a `head` joint that carries the eyes and gear, and an `fx` that walks the limbs.
 */
import type * as THREE from "three";
import { Model } from "../kit/kit.ts";
import { type Built, DARK, GLINT, joint, put, SIDES, speckle, U } from "./pets3d-night.ts";
import { darken, eye, Grid, hash, lighten, noise } from "./petvox.ts";

/** Swings a limb joint about x as a trot: `i` picks its phase (diagonal pairs move together). */
function trot(l: THREE.Object3D, t: number, moving: boolean, i: number, amp = 0.7, rate = 13): void {
  l.rotation.x = moving ? Math.sin(t * rate + (i % 2 ? Math.PI : 0) + (i > 1 ? 1.5 : 0)) * amp : 0;
}

/** `Grid.box` with its corners in either order (a mirrored limb has its x range reversed). */
const slab = (g: Grid, x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, p: string) =>
  g.box(
    Math.min(x0, x1),
    Math.max(x0, x1),
    Math.min(y0, y1),
    Math.max(y0, y1),
    Math.min(z0, z1),
    Math.max(z0, z1),
    p,
  );

// MARK: Komodo

/** A komodo dragon: an olive-grey lizard with banded scales, splayed legs, a long tail and a yellow forked tongue. */
export function komodo(): Built {
  const body = new Model();
  const fore = new Model();
  const OLIVE = "#7b7a4c";
  const DARK_OLIVE = "#575636";
  const BELLY = "#bdb283";
  const bg = new Grid();
  bg.ell(0, 5, 0, 4.6, 3.6, 8.5, OLIVE, 2.3);
  bg.paint((c) => {
    if (c.t < 0.3) return speckle(c, BELLY, "#a89d70", 2, 0.3);
    const band = Math.floor((c.z + 100) / 3) % 2 === 0;
    if (c.t > 0.55 && band) return speckle(c, DARK_OLIVE, "#4a492b", 3, 0.3);
    return speckle(c, OLIVE, "#97965f", 4, 0.35);
  });
  // A row of small ridged scales down the spine.
  for (let z = -8; z <= 7; z += 2) bg.set(0, 8, z, "#97965f");
  put(body, bg, [0, 0, 0], 1);
  // Splayed legs: a thigh out to the side, a shin down and a clawed foot. They trot in diagonal pairs.
  const legs = (
    [
      [-1, 5],
      [1, 5],
      [-1, -5],
      [1, -5],
    ] as const
  ).map(([s, z], i) => {
    const j = joint(body, [s * 4.6, 4, z]);
    const g = new Grid();
    slab(g, 0, s * 2, -1, 0, -1, 1, OLIVE);
    slab(g, s * 2, s * 3, -3, 0, -1, 1, OLIVE);
    slab(g, s * 2, s * 4, -3, -3, -1, 3, DARK_OLIVE);
    for (const dx of [2, 3, 4]) g.set(s * dx, -3, 4, "#2a2a1f");
    put(j, g, [0, 0, 0], 5 + i);
    return j;
  });
  // Head: a long wedge of a snout, nostrils, a heavy brow and a pale throat.
  const head = joint(body, [0, 6, 8.5]);
  const hg = new Grid();
  hg.ell(0, 0, 0, 3, 2.6, 3.2, (c) => speckle(c, OLIVE, "#97965f", 6, 0.3), 2.2);
  hg.ell(0, -0.6, 4.2, 2.1, 1.6, 4.2, (c) => (c.t < 0.4 ? BELLY : speckle(c, OLIVE, "#97965f", 7, 0.3)), 2.2);
  hg.ell(0, -1.8, 1.4, 2.2, 1.1, 2.4, BELLY);
  hg.box(-1, 1, -1, -1, 7, 8, DARK_OLIVE);
  for (const s of SIDES) {
    hg.set(s * 1, 0.6, 8, "#22221a");
    hg.ell(s * 2.6, 1.8, 1.4, 0.9, 0.9, 1.3, DARK_OLIVE);
  }
  put(head, hg, [0, 0, 0], 2);
  const eyes: THREE.Mesh[] = [];
  for (const s of SIDES) {
    const e = eye([
      ["#e3b53a", DARK],
      [DARK, DARK],
    ]);
    e.rotation.y = s * 1.1;
    e.position.set(U(s * 2.85), U(1.3), U(1.9));
    head.add(e);
    eyes.push(e);
  }
  // The tongue: a long yellow fork that shoots out and pulls back in.
  const tongue = joint(head, [0, -1.6, 8]);
  const tg = new Grid();
  tg.box(0, 0, 0, 0, 0, 3, "#f2c230");
  tg.set(-1, 0, 4, "#f2c230").set(1, 0, 4, "#f2c230").set(-1, 0, 5, "#e8a91d").set(1, 0, 5, "#e8a91d");
  put(tongue, tg, [0, 0, 0], 8).castShadow = false;
  // A long, tapering, banded tail.
  const tail = joint(body, [0, 5, -8]);
  const tl = new Grid();
  tl.tube(
    [
      [0, 0, 0],
      [0, -0.5, -7],
      [0, -1.5, -14],
      [1.5, -1.5, -19],
    ],
    2.8,
    0.6,
    (c) =>
      Math.floor((c.z + 100) / 3) % 2 === 0 && c.t > 0.4 ? DARK_OLIVE : speckle(c, OLIVE, "#97965f", 9, 0.3),
    2.1,
  );
  put(tail, tl, [0, 0, 0], 4);
  return {
    rig: {
      head,
      eyes,
      fore: [],
      hind: [],
      tails: [tail],
      neck: [0, U(-1.5), U(-2)],
      neckR: U(2.8),
      top: [0, U(2.6), 0],
      tilt: false,
      span: U(4),
      fx: (t, moving) => {
        legs.forEach((l, i) => {
          trot(l, t, moving, i, 0.6, 11);
        });
        body.rotation.y = moving ? Math.sin(t * 11) * 0.06 : 0;
        head.rotation.y = Math.sin(t * (moving ? 5.5 : 0.8)) * (moving ? 0.12 : 0.1);
        const k = (t * 1.1) % 1;
        const flick = k < 0.3 ? Math.sin((k / 0.3) * Math.PI) : 0;
        tongue.scale.set(1, 1, 0.05 + flick * 0.95);
        tongue.visible = flick > 0.04;
      },
    },
    body,
    fore,
  };
}

// MARK: Tarsier

/** A tarsier: a tiny tan primate with ears like a bat, enormous round eyes, spindly fingers and a long tufted tail. */
export function tarsier(): Built {
  const body = new Model();
  const fore = new Model();
  const TAN = "#b08a58";
  const FUR = "#9a7648";
  const PALE = "#d9bf92";
  const PAD = "#d6a38a";
  const bg = new Grid();
  bg.ell(0, 7, 0, 3.2, 4.2, 3, TAN, 2.2);
  bg.paint((c) =>
    c.t < 0.7 && c.z > 0.5 ? speckle(c, PALE, "#c9ad7f", 2, 0.3) : speckle(c, TAN, FUR, 3, 0.35),
  );
  put(body, bg, [0, 0, 0], 1);
  // Folded hind legs: a fat thigh, then the long thin foot that gives it its name, toes with sticky pads.
  const feet = SIDES.map((s) => {
    const j = joint(body, [s * 3, 4, -1]);
    const g = new Grid();
    g.ell(0, 1.4, 0, 1.9, 2.6, 2.6, TAN, 2.2);
    g.box(0, 0, -2, -1, 1, 5, FUR);
    for (const dx of [-1, 0, 1]) g.box(dx, dx, -2, -2, 5, 7, FUR).set(dx, -2, 8, PAD);
    put(j, g, [0, 0, 0], 4);
    return j;
  });
  // Arms hug the chest, fingers long and thin with a round pad at each tip.
  const arms = SIDES.map((s) => {
    const j = joint(body, [s * 3.2, 9, 1.5]);
    const g = new Grid();
    g.tube(
      [
        [0, 0, 0],
        [s * 0.5, -2.2, 1.6],
        [s * 0.2, -3.6, 3.2],
      ],
      0.95,
      0.8,
      TAN,
      2,
    );
    for (const dx of [-1, 0, 1])
      g.box(s * 0.2 + dx, s * 0.2 + dx, -4.4, -3.8, 3.2, 4.6, FUR).set(s * 0.2 + dx, -4.4, 5, PAD);
    put(j, g, [0, 0, 0], 6);
    return j;
  });
  // The long thin tail with a tuft on the end.
  const tail = joint(body, [0, 3, -3]);
  const tl = new Grid();
  tl.tube(
    [
      [0, 0, 0],
      [0, -1, -4],
      [0, 0.5, -8],
      [0, 3.5, -10.5],
    ],
    0.9,
    0.7,
    FUR,
    2,
  );
  tl.ell(0, 4.5, -11, 1.5, 2.2, 1.5, "#7a5a36");
  put(tail, tl, [0, 0, 0], 8);
  // The head: broad, with ears like bat wings, a tiny pink nose and two huge eyes that take up most of the face.
  const head = joint(body, [0, 13, 0.5]);
  const hg = new Grid();
  hg.ell(0, 0, 0, 4.6, 3.8, 3.8, (c) => speckle(c, TAN, FUR, 5, 0.3), 2.1);
  hg.ell(0, -1.5, 3, 1.6, 1.2, 1.4, PALE);
  hg.set(0, -0.8, 4.3, PAD).set(0, -1.8, 4.2, "#6a4a3a");
  for (const s of SIDES) {
    // The ear: a thin flat leaf, pink inside.
    hg.ell(s * 4.4, 3.6, -0.6, 0.9, 2.8, 1.8, (c) => (c.x * s > 4 ? PAD : FUR), 2.3);
    hg.ell(s * 3.6, 0.3, 2.4, 2.9, 2.8, 1.5, "#4a3626", 2.1);
  }
  put(head, hg, [0, 0, 0], 2);
  const eyes: THREE.Mesh[] = [];
  const W = "#fbf7ea";
  const R = "#7a5230";
  for (const s of SIDES) {
    const e = eye([
      ["", R, R, R, ""],
      [R, W, W, W, R],
      [R, W, DARK, DARK, R],
      [R, W, DARK, GLINT, R],
      ["", R, R, R, ""],
    ]);
    e.scale.set(1.15, 1.15, 0.8);
    e.position.set(U(s * 2.7), U(0.5), U(3.6));
    head.add(e);
    eyes.push(e);
  }
  return {
    rig: {
      head,
      eyes,
      fore: [],
      hind: [],
      tails: [tail],
      neck: [0, U(-3), U(0)],
      neckR: U(3.2),
      top: [0, U(4), 0],
      tilt: false,
      span: U(2),
      fx: (t, moving) => {
        feet.forEach((f, i) => {
          trot(f, t, moving, i, 0.8, 14);
        });
        arms.forEach((a, i) => {
          a.rotation.x = moving ? Math.sin(t * 14 + (i ? Math.PI : 0)) * 0.6 : Math.sin(t * 1.2 + i) * 0.04;
        });
        body.position.y = moving ? Math.abs(Math.sin(t * 14)) * 0.012 : 0;
        // It turns its head to look about.
        head.rotation.y = Math.sin(t * 0.8) * (0.35 + Math.sin(t * 0.37) * 0.15);
        tail.rotation.x = Math.sin(t * 1.6) * 0.06;
      },
    },
    body,
    fore,
  };
}

// MARK: Enggang

/** A rhinoceros hornbill: a black body, white thighs and a white tail with a black band, and the orange-red casque up on a cream bill. */
export function enggang(): Built {
  const body = new Model();
  const fore = new Model();
  const BLACK = "#1e1d26";
  const SHEEN = "#34364a";
  const WHITE = "#f6f2e6";
  const CREAM = "#f2d98e";
  const CASQUE = "#e8582a";
  const bg = new Grid();
  bg.ell(0, 10, 0, 4.2, 3.8, 6.5, BLACK, 2.3);
  bg.paint((c) => (c.t > 0.6 && hash(c.x, c.y, c.z, 2) < 0.2 ? SHEEN : speckle(c, BLACK, SHEEN, 3, 0.2)));
  for (const s of SIDES) bg.ell(s * 3.5, 7.4, -1.5, 1.8, 2.6, 3.4, WHITE);
  put(body, bg, [0, 0, 0], 1);
  // The tail: a fan of white feathers with one black band across.
  const tail = joint(body, [0, 9, -6]);
  const tg = new Grid();
  for (let z = 0; z >= -10; z--) {
    const hw = 2 + Math.round(-z * 0.18);
    const band = z === -6 || z === -7;
    for (let x = -hw; x <= hw; x++) tg.set(x, 0, z, band ? BLACK : x % 2 && z < -2 ? "#ece6d4" : WHITE);
    for (let x = -hw + 1; x <= hw - 1; x++) tg.set(x, -1, z, band ? BLACK : "#e1dbc8");
  }
  put(tail, tg, [0, 0, 0], 4);
  // Two stout legs with toes.
  const legs = SIDES.map((s) => {
    const j = joint(body, [s * 2.2, 6, 0.5]);
    const g = new Grid();
    g.box(-1, 1, -4, 0, 0, 1, "#b9aa86");
    g.box(-1, 1, -4, -4, 0, 3, "#9d8f6c");
    put(j, g, [0, 0, 0], 5);
    return j;
  });
  // Black wings, folded along the body.
  const wings = SIDES.map((s) => {
    const j = joint(body, [s * 3.8, 12, 1.5]);
    const g = new Grid();
    g.ell(
      s * 1.2,
      -3,
      -2,
      1.5,
      3.8,
      6,
      (c) => (c.u > 0.75 ? "#12111a" : speckle(c, BLACK, SHEEN, 6, 0.3)),
      2.2,
    );
    g.box(s * 1.2, s * 1.2, -3, -2, -8, -6, WHITE);
    put(j, g, [0, 0, 0], 7 + (s > 0 ? 1 : 0));
    return { j, s };
  });
  // The head: black with a pale eye ring, a stout cream bill and the big orange-red casque curling up off it.
  const head = joint(body, [0, 15.5, 4.5]);
  const hg = new Grid();
  hg.ell(0, 0, 0, 3.2, 3.1, 3.4, (c) => speckle(c, BLACK, SHEEN, 8, 0.2), 2.2);
  hg.ell(0, 1.4, -1.2, 2.8, 1.8, 2, "#2b2b36");
  // The bill: deep at the root, tapering, with a darker lower mandible.
  for (let z = 3; z <= 11; z++) {
    const k = (z - 3) / 8;
    const top = Math.round(1.6 - k * 1.7);
    const hw = k < 0.6 ? 1 : 0;
    for (let x = -hw; x <= hw; x++)
      for (let y = -1; y <= top; y++)
        hg.set(x, y, z, y < 0 && k > 0.2 ? "#d8bd72" : x === 0 && y === top ? lighten(CREAM, 0.2) : CREAM);
  }
  hg.set(0, -1, 11, "#b89a52").set(0, -1, 12, "#b89a52");
  // The casque: a thick red-orange slab along the bill's top that sweeps up at the front like a horn.
  for (let z = 1; z <= 11; z++) {
    const k = (z - 1) / 10;
    const rise = z >= 8 ? Math.round((z - 7) * 1.2) : 0;
    const base = Math.round(1.6 - Math.max(0, z - 3) * 0.21);
    for (let y = base + 1; y <= base + 2 + rise; y++)
      hg.box(-1, 1, y, y, z, z, y > base + 1 + rise ? lighten(CASQUE, 0.15) : k < 0.12 ? "#7a2a14" : CASQUE);
  }
  hg.box(0, 0, 4, 5, 4, 4, "#2a1a14");
  put(head, hg, [0, 0, 0], 2);
  const eyes: THREE.Mesh[] = [];
  for (const s of SIDES) {
    const e = eye([
      ["#e8d9a0", "#e8d9a0"],
      [DARK, "#c8322a"],
    ]);
    e.rotation.y = s * 1.2;
    e.position.set(U(s * 3.2), U(0.7), U(1.7));
    head.add(e);
    eyes.push(e);
  }
  return {
    rig: {
      head,
      eyes,
      fore: [],
      hind: [],
      tails: [],
      neck: [0, U(-3), U(-2)],
      neckR: U(3.4),
      top: [0, U(3.5), 0],
      tilt: false,
      span: U(2),
      fx: (t, moving) => {
        // A beat behind: the wings give a slow flap when it stands and a hurried one as it walks, and it bobs.
        const a = Math.sin(t * (moving ? 14 : 2.6) - 0.6) * (moving ? 0.7 : 0.1);
        for (const w of wings) w.j.rotation.z = w.s * (a + 0.05);
        legs.forEach((l, i) => {
          trot(l, t, moving, i, 0.7, 12);
        });
        body.position.y = moving ? Math.abs(Math.sin(t * 12)) * 0.016 : 0;
        body.rotation.x = moving ? -0.06 : 0;
        tail.rotation.x = Math.sin(t * (moving ? 12 : 1.8)) * (moving ? 0.1 : 0.04);
        head.rotation.y = Math.sin(t * 0.7) * 0.2;
      },
    },
    body,
    fore,
  };
}

// MARK: Rafflesia

/** A rafflesia that got up and walked off: a wide brick-red five-petal bloom, cream warts, a round face in the cup, and two tiny legs. Flies follow. */
export function rafflesia(): Built {
  const body = new Model();
  const fore = new Model();
  const RED = "#c32a30";
  const DEEP = "#8d1a22";
  const WART = "#f2e2c0";
  // Two stubby legs in a dark stem colour, with flat feet.
  const legs = SIDES.map((s, i) => {
    const j = joint(body, [s * 3, 5, 0]);
    const g = new Grid();
    g.box(-1, 1, -4, 0, -1, 1, "#6a4a2a");
    g.box(-1, 1, -4, -4, -1, 3, "#4f3520");
    put(j, g, [0, 0, 0], 3 + i);
    return j;
  });
  // The bloom is one joint (the head, so a crown or a hat sits on it), tipped up towards the front.
  const head = joint(body, [0, 12, 0]);
  const tilt = joint(head, [0, 0, 0]);
  tilt.rotation.x = -0.5;
  const petals = [0, 1, 2, 3, 4].map((i) => {
    const j = joint(tilt, [0, 0, -0.5]);
    j.rotation.z = (i / 5) * Math.PI * 2;
    const g = new Grid();
    g.ell(
      0,
      7.6,
      0,
      4.8,
      6.2,
      1.6,
      (c) => {
        const edge = Math.hypot(c.x / 4.8, (c.y - 7.6) / 6.2);
        if (hash(c.x, c.y, c.z, 11 + i) < 0.1 && edge < 0.85 && c.y > 4) return WART;
        return edge > 0.82 ? darken(RED, 0.18) : speckle(c, RED, lighten(RED, 0.1), 12 + i, 0.3);
      },
      2.2,
    );
    put(j, g, [0, 0, 0], 20 + i);
    return j;
  });
  // The cup in the middle: a thick ring, a pale boss with a face, and the rough "diaphragm" round it.
  const cg = new Grid();
  cg.ell(0, 0, 1, 5, 5, 1.8, (c) => (Math.hypot(c.x, c.y) > 3.7 ? DEEP : "#a82229"), 2.4);
  cg.ell(0, 0, 2.6, 3.4, 3.4, 1.8, (c) => (hash(c.x, c.y, c.z, 3) < 0.12 ? "#e2cf9e" : "#f1e3bf"), 2.2);
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    cg.set(Math.cos(a) * 4.4, Math.sin(a) * 4.4, 2.3, "#5a1018");
  }
  cg.set(0, -1.6, 4.4, "#b8423a").set(-1, -1.2, 4.4, "#b8423a").set(1, -1.2, 4.4, "#b8423a");
  put(tilt, cg, [0, 0, 0], 30);
  const eyes: THREE.Mesh[] = [];
  for (const s of SIDES) {
    const e = eye([
      [DARK, DARK],
      [DARK, GLINT],
    ]);
    e.position.set(U(s * 1.5), U(0.5), U(4.5));
    tilt.add(e);
    eyes.push(e);
  }
  // A couple of flies, drawn to it.
  const flies = [0, 1].map((i) => {
    const g = new Grid();
    g.set(0, 0, 0, "#16141a").set(1, 0, 0, "#c6d5e6").set(-1, 0, 0, "#c6d5e6");
    const m = put(body, g, [0, 0, 0], i);
    m.castShadow = false;
    return m;
  });
  return {
    rig: {
      head,
      eyes,
      fore: [],
      hind: [],
      tails: [],
      neck: [0, U(-6), U(0)],
      neckR: U(4.5),
      top: [0, U(9), 0],
      tilt: false,
      span: U(0),
      fx: (t, moving) => {
        legs.forEach((l, i) => {
          l.rotation.x = moving ? Math.sin(t * 14 + (i ? Math.PI : 0)) * 0.75 : 0;
        });
        // The petals bob, out of step, and lift with every stride.
        petals.forEach((p, i) => {
          p.rotation.x = Math.sin(t * (moving ? 7 : 2.2) + i * 1.3) * (moving ? 0.16 : 0.08);
        });
        head.position.y = U(12) + (moving ? Math.abs(Math.sin(t * 14)) * 0.012 : Math.sin(t * 1.6) * 0.004);
        head.rotation.z = Math.sin(t * (moving ? 7 : 1.1)) * 0.05;
        flies.forEach((f, i) => {
          const a = t * (3 + i) + i * 3;
          f.position.set(U(Math.cos(a) * 15), U(21 + Math.sin(a * 1.7) * 3 + i * 2), U(Math.sin(a) * 15));
        });
      },
    },
    body,
    fore,
  };
}

// MARK: Cenderawasih

/** A greater bird-of-paradise: a yellow-and-chestnut body, an emerald throat, golden flank plumes and two long tail wires that curl and bob. */
export function cenderawasih(): Built {
  const body = new Model();
  const fore = new Model();
  const CHEST = "#7e4a22";
  const GOLD = "#f4cc34";
  const EMERALD = "#1d9d62";
  const bg = new Grid();
  bg.ell(0, 9, 0, 3.4, 3.4, 5.4, CHEST, 2.3);
  bg.paint((c) => {
    if (c.t > 0.7 && c.u > 0.45) return speckle(c, GOLD, "#e0b020", 2, 0.3);
    if (c.t < 0.4 && c.u > 0.5) return speckle(c, "#a8682c", CHEST, 3, 0.3);
    return speckle(c, CHEST, "#6a3c1a", 4, 0.3);
  });
  put(body, bg, [0, 0, 0], 1);
  // Flank plumes: long soft gold sprays off the sides, drifting back and down.
  const plumes = SIDES.map((s) => {
    const j = joint(body, [s * 2.6, 9, -2.5]);
    const g = new Grid();
    g.tube(
      [
        [0, 1, 0],
        [s * 2.2, -1, -4],
        [s * 3.2, -3.5, -9],
        [s * 2.6, -5.5, -12],
      ],
      1.9,
      0.7,
      (c) => (c.u > 0.65 ? "#fff1a8" : speckle(c, GOLD, "#e8b92a", 5, 0.35)),
      2.2,
    );
    put(j, g, [0, 0, 0], 6 + (s > 0 ? 1 : 0)).castShadow = false;
    return { j, s };
  });
  // The two tail wires: thin dark cords that sweep back and curl up and inwards.
  const wires = SIDES.map((s) => {
    const j = joint(body, [s * 0.8, 8, -5]);
    const g = new Grid();
    g.tube(
      [
        [0, 0, 0],
        [s * 1.5, -1, -6],
        [s * 4.5, -2, -12],
        [s * 8, 0, -15],
        [s * 9.5, 3.5, -14],
        [s * 8.2, 5.5, -11.5],
        [s * 6.2, 5.2, -10.5],
      ],
      0.6,
      0.6,
      "#3a2a1c",
      2,
    );
    g.ell(s * 6, 5, -10.4, 0.9, 0.9, 0.9, "#3a2a1c");
    put(j, g, [0, 0, 0], 8 + (s > 0 ? 1 : 0)).castShadow = false;
    return { j, s };
  });
  // Legs, bluish grey, and toes.
  const legs = SIDES.map((s) => {
    const j = joint(body, [s * 1.6, 6, 0.5]);
    const g = new Grid();
    g.box(0, 0, -4, 0, 0, 0, "#8aa0b4");
    g.box(-1, 1, -4, -4, 0, 2, "#7a90a4");
    g.set(0, -4, -1, "#7a90a4");
    put(j, g, [0, 0, 0], 12);
    return j;
  });
  // The head: yellow crown, emerald mask and throat, a slim pale bill.
  const head = joint(body, [0, 13.5, 3.8]);
  const hg = new Grid();
  hg.ell(0, 0, 0, 3, 2.8, 3, (c) => (c.t < 0.38 ? EMERALD : speckle(c, GOLD, "#e0b020", 5, 0.25)), 2.2);
  hg.ell(0, -1.4, 2, 1.8, 1.3, 1.6, EMERALD);
  hg.tube(
    [
      [0, -0.3, 2.6],
      [0, -0.5, 6],
    ],
    1.1,
    0.5,
    (c) => (c.u > 0.7 ? "#7a8a96" : "#a9b8c2"),
    2.2,
  );
  put(head, hg, [0, 0, 0], 2);
  const eyes: THREE.Mesh[] = [];
  for (const s of SIDES) {
    const e = eye([
      [DARK, DARK],
      [DARK, GLINT],
    ]);
    e.rotation.y = s * 1.0;
    e.position.set(U(s * 2.7), U(0.8), U(1.2));
    head.add(e);
    eyes.push(e);
  }
  return {
    rig: {
      head,
      eyes,
      fore: [],
      hind: [],
      tails: [],
      neck: [0, U(-2.5), U(-1)],
      neckR: U(3),
      top: [0, U(3), 0],
      tilt: false,
      span: U(1),
      fx: (t, moving) => {
        legs.forEach((l, i) => {
          trot(l, t, moving, i, 0.7, 13);
        });
        wires.forEach(({ j, s }, i) => {
          j.rotation.x = Math.sin(t * (moving ? 6 : 1.8) + i * 0.9) * (moving ? 0.16 : 0.1);
          j.rotation.z = s * (0.05 + Math.sin(t * (moving ? 5 : 1.4) + i) * 0.06);
        });
        plumes.forEach(({ j, s }, i) => {
          j.rotation.z = s * (0.04 + Math.sin(t * (moving ? 7 : 1.6) + i * 2) * 0.07);
        });
        body.position.y = moving ? Math.abs(Math.sin(t * 13)) * 0.014 : 0;
        head.rotation.y = Math.sin(t * 0.9) * 0.2;
      },
    },
    body,
    fore,
  };
}

// MARK: Orangutan

/** An orangutan: a shaggy orange mass, a darker face in a round disc, long arms that reach the ground and a crest of fur. */
export function orangutan(): Built {
  const body = new Model();
  const fore = new Model();
  const ORANGE = "#d8681c";
  const LIGHT = "#ee8a2e";
  const DEEP = "#a24a14";
  const FACE = "#7a4e36";
  const MUZZLE = "#b58762";
  const fur = (c: { x: number; y: number; z: number }, seed: number) =>
    noise(c.x * 0.5, c.y * 0.5, c.z * 0.5, seed) > 0.62
      ? LIGHT
      : hash(c.x, c.y, c.z, seed) < 0.22
        ? DEEP
        : ORANGE;
  const bg = new Grid();
  bg.ell(0, 8, 0, 6.2, 5.8, 5.6, (c) => fur(c, 2), 2.2);
  bg.fluff(0.35, 3, 0.08, [
    [1, 0, 0],
    [-1, 0, 0],
    [0, 1, 0],
    [0, 0, 1],
    [0, 0, -1],
    [0, -1, 0],
  ]);
  put(body, bg, [0, 0, 0], 1);
  // Short bowed legs and broad feet, in the shaggy fur.
  const legs = SIDES.map((s, i) => {
    const j = joint(body, [s * 3, 5, -1]);
    const g = new Grid();
    g.box(-2, 2, -4, 0, -1, 2, (c) => fur(c, 4));
    g.box(-2, 2, -4, -4, -1, 4, DEEP);
    put(j, g, [0, 0, 0], 5 + i);
    return j;
  });
  // The long arms: shoulder to knuckle on the ground, a hand curled round.
  const arms = SIDES.map((s, i) => {
    const j = joint(body, [s * 6.2, 12, 0.5]);
    const g = new Grid();
    g.tube(
      [
        [0, 0, 0],
        [s * 1.5, -5, 1],
        [s * 2.2, -9, 2],
        [s * 2.4, -10.6, 3],
      ],
      2.6,
      2.0,
      (c) => fur(c, 6 + i),
      2.2,
    );
    g.ell(s * 2.4, -11.2, 3.6, 2.2, 1.3, 2.6, "#8a5a38");
    g.fluff(0.25, 7, 0.08);
    put(j, g, [0, 0, 0], 8 + i);
    return j;
  });
  // The head: big and round, a flat dark face disc with a pale muzzle, a crest of fur on top and a beard of it below.
  const head = joint(body, [0, 15.5, 2.2]);
  const hg = new Grid();
  hg.ell(0, 0, 0, 5.4, 5, 4.8, (c) => fur(c, 10), 2.1);
  hg.ell(0, -0.6, 3.6, 4, 4.2, 1.6, FACE, 2.4);
  hg.ell(0, -2.2, 4.7, 2.3, 1.8, 1.2, MUZZLE, 2.2);
  hg.set(-1, -2.8, 5.8, "#3a2418").set(1, -2.8, 5.8, "#3a2418").set(0, -3.6, 5.6, "#5a3a2a");
  for (const s of SIDES) hg.ell(s * 4.9, -0.5, 0.6, 1.2, 1.8, 1.4, "#93502a");
  hg.ell(0, 5, -0.5, 3.4, 2, 3.4, (c) => fur(c, 12));
  hg.ell(0, -3.8, 2.2, 3.2, 1.9, 1.7, (c) => fur(c, 13));
  hg.fluff(0.3, 14, 0.08);
  put(head, hg, [0, 0, 0], 2);
  const eyes: THREE.Mesh[] = [];
  for (const s of SIDES) {
    const e = eye([
      ["#e9d7b2", "#e9d7b2"],
      [DARK, GLINT],
    ]);
    e.position.set(U(s * 2.1), U(0.8), U(4.6));
    head.add(e);
    eyes.push(e);
  }
  return {
    rig: {
      head,
      eyes,
      fore: [],
      hind: [],
      tails: [],
      neck: [0, U(-4), U(1)],
      neckR: U(5),
      top: [0, U(7.5), 0],
      tilt: false,
      span: U(3),
      fx: (t, moving) => {
        arms.forEach((a, i) => {
          a.rotation.x = moving ? Math.sin(t * 9 + (i ? Math.PI : 0)) * 0.55 : Math.sin(t * 1.4 + i) * 0.03;
        });
        legs.forEach((l, i) => {
          l.rotation.x = moving ? Math.sin(t * 9 + (i ? 0 : Math.PI)) * 0.5 : 0;
        });
        body.position.y = moving ? Math.abs(Math.sin(t * 9)) * 0.012 : Math.sin(t * 1.6) * 0.003;
        body.rotation.z = moving ? Math.sin(t * 9) * 0.05 : 0;
        head.rotation.y = Math.sin(t * 0.6) * 0.18;
      },
    },
    body,
    fore,
  };
}

/** The builders by species name, for `pets3d.ts`. */
export const NUSANTARA_PETS = { komodo, tarsier, enggang, rafflesia, cenderawasih, orangutan } as const;
