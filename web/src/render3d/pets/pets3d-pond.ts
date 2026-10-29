/**
 * The pond treasures' pets (core/src/fishing-loot.ts, pet.600 and pet.601) as voxel sculptures on the same `petvox`
 * grid as the cases': a pink axolotl and a pocket kraken. Builders are the same shape as `pets3d-night.ts`: a `body`
 * grid, a `head` joint that carries the eyes and gear, and an `fx` that moves the parts that move on their own (here
 * the axolotl's gills, tail and legs, and the kraken's tentacles).
 */
import type * as THREE from "three";
import { Model } from "../kit/kit.ts";
import { type Built, DARK, GLINT, joint, put, SIDES, speckle, U } from "./pets3d-night.ts";
import { eye, Grid, hash } from "./petvox.ts";

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

// MARK: Axolotl

/**
 * An axolotl: a chubby pink body low to the ground, a wide flat head with a wide smile and small round eyes, three
 * feathery gill fronds a side that sway, four little legs with toes, and a long flat finned tail that wiggles.
 */
export function axolotl(): Built {
  const body = new Model();
  const fore = new Model();
  const PINK = "#f6a5c0";
  const PINK_LIGHT = "#ffd2e1";
  const BELLY = "#ffe4ee";
  const SPOT = "#dc6f98";
  const FROND = "#ee5a86";
  const FROND_TIP = "#ff9fbd";
  const MOUTH = "#a8325a";
  const BLUSH = "#ff8aab";
  const bg = new Grid();
  bg.ell(0, 4.2, 0, 3.8, 3.1, 6.4, PINK, 2.3);
  bg.paint((c) => {
    if (c.t < 0.3) return BELLY;
    if (c.t > 0.5 && hash(c.x, c.y, c.z, 3) < 0.07) return SPOT;
    return speckle(c, PINK, PINK_LIGHT, 2, 0.25);
  });
  // A low frilled ridge down the back, running on into the tail.
  for (let z = -5; z <= 3; z++) {
    const top = bg.top(0, z);
    if (top !== undefined) bg.set(0, top + 1, z, z % 2 ? PINK_LIGHT : "#f08fb2");
  }
  put(body, bg, [0, 0, 0], 1);

  // Four little legs, splayed out and down, with three toes each. They paddle in diagonal pairs.
  const legs = (
    [
      [-1, 3.6],
      [1, 3.6],
      [-1, -3.2],
      [1, -3.2],
    ] as const
  ).map(([s, z], i) => {
    const j = joint(body, [s * 3.4, 3.5, z]);
    const g = new Grid();
    slab(g, 0, s * 2, -1, 0, -1, 1, PINK);
    slab(g, s * 2, s * 3, -3, -1, -1, 1, PINK);
    slab(g, s * 2, s * 4, -3, -3, -1, 1, PINK_LIGHT);
    for (const dx of [2, 3, 4]) g.set(s * dx, -3, 2, "#ffb3cc");
    put(j, g, [0, 0, 0], 3 + i);
    return j;
  });

  // The head: broad and flat, lighter underneath, a wide upturned smile, blush on the cheeks and two nostrils.
  const head = joint(body, [0, 4.6, 6]);
  const hg = new Grid();
  hg.ell(0, 0, 0, 5, 3.1, 4.2, (c) => (c.y < -1.5 ? BELLY : speckle(c, PINK, PINK_LIGHT, 6, 0.25)), 2.3);
  const paintFront = (x: number, y: number, color: string) => {
    const z = hg.front(x, y);
    if (z !== undefined) hg.set(x, y, z, color);
  };
  for (let x = -4; x <= 4; x++) paintFront(x, -2 + Math.floor(Math.abs(x) / 2), MOUTH);
  for (const s of SIDES) {
    paintFront(s * 4, 0, BLUSH);
    paintFront(s * 3, 0, BLUSH);
    paintFront(s * 4, -1, BLUSH);
    paintFront(s * 1, 1, "#d9648f");
  }
  put(head, hg, [0, 0, 0], 2);
  const eyes: THREE.Mesh[] = [];
  for (const s of SIDES) {
    const e = eye([
      [GLINT, DARK],
      [DARK, DARK],
    ]);
    // On the top of the head, facing up, out and forward: along the skull's normal there.
    e.rotation.order = "YXZ";
    e.rotation.y = s * 0.64;
    e.rotation.x = -0.67;
    const surface = hg.front(Math.round(s * 3.2), 2) ?? 2;
    e.position.set(U(s * 3.2 + s * 0.3), U(2 + 0.45), U(surface + 0.45));
    head.add(e);
    eyes.push(e);
  }

  // Gills: three feathery fronds a side, a stalk with a fringe of filaments, fanned up and swept back.
  const frond = (len: number): Grid => {
    const g = new Grid();
    for (let i = 1; i <= len; i++) {
      g.set(i, 0, 0, FROND);
      if (i < 3) g.box(i, i, -1, 1, 0, 0, FROND).box(i, i, 0, 0, -1, 1, FROND);
      if (i < 2) continue;
      // Filaments out all round the stalk, longest towards the root and pale at the tips.
      const f = Math.min(2, Math.round((len - i) * 0.5) + 1);
      for (let k = 1; k <= f; k++) {
        const c = k === f ? FROND_TIP : FROND;
        g.set(i, k, 0, c).set(i, -k, 0, c).set(i, 0, k, c).set(i, 0, -k, c);
      }
    }
    return g;
  };
  const FAN = [0.7, 0.4, 0.1] as const;
  const FRONDS = [frond(4), frond(5), frond(4)];
  const gills = SIDES.flatMap((s) =>
    FAN.map((angle, k) => {
      const j = joint(head, [s * 4.1, 1.9 - k * 1.5, -1.5]);
      put(j, s > 0 ? FRONDS[k]! : FRONDS[k]!.mirrored(), [0, 0, 0], 10 + k);
      return { j, s, angle, sweep: 0.95 - k * 0.35, phase: k * 0.9 + (s > 0 ? 0 : 1.3) };
    }),
  );

  // The tail: two flat fin sections, tall and thin, so it can wave from side to side.
  const finColor = (c: { y: number }) => (Math.abs(c.y) > 1.3 ? PINK_LIGHT : PINK);
  const section = (n: number, h0: number, h1: number): Grid => {
    const g = new Grid();
    for (let i = 0; i < n; i++) {
      const hh = Math.round(h0 + (h1 - h0) * (i / n));
      g.box(-1, 1, 0, 0, -i, -i, PINK);
      g.box(0, 0, -hh, hh, -i, -i, (c) => (Math.abs(c.y) === hh && hh > 1 ? FROND_TIP : finColor(c)));
    }
    return g;
  };
  const tail = joint(body, [0, 4.2, -5.5]);
  put(tail, section(6, 3, 2.6), [0, 0, 0], 20);
  const tip = joint(tail, [0, 0, -6]);
  put(tip, section(6, 2.6, 0.6), [0, 0, 0], 21);

  return {
    rig: {
      head,
      eyes,
      fore: [],
      hind: [],
      tails: [tail],
      neck: [0, U(-1.5), U(-2.5)],
      neckR: U(4),
      top: [0, U(3.2), U(0.5)],
      tilt: false,
      span: U(2),
      fx: (t, moving) => {
        for (let i = 0; i < gills.length; i++) {
          const g = gills[i]!;
          const w = Math.sin(t * (moving ? 7 : 2.2) + g.phase);
          g.j.rotation.z = g.s * (g.angle + w * 0.14);
          g.j.rotation.y = g.s * (g.sweep + Math.sin(t * (moving ? 6 : 1.8) + g.phase + 1) * 0.1);
        }
        tip.rotation.y = Math.sin(t * (moving ? 12 : 3) - 1.3) * 0.45;
        for (let i = 0; i < legs.length; i++)
          legs[i]!.rotation.x = moving
            ? Math.sin(t * 10 + (i % 2 ? Math.PI : 0) + (i > 1 ? 1.5 : 0)) * 0.6
            : 0;
        body.rotation.y = moving ? Math.sin(t * 10) * 0.07 : 0;
        head.rotation.y = Math.sin(t * (moving ? 5 : 0.9)) * (moving ? 0.1 : 0.12);
      },
    },
    body,
    fore,
  };
}

// MARK: Pocket kraken

/** Where each section of a tentacle points, measured from straight down, outward: it lies along the floor and curls up. */
const CURL = [0.75, 1.3, 2.0, 2.8] as const;
/** The tentacle's radius at the root, then at the end of each section. */
const TAPER = [2.4, 2.0, 1.6, 1.2, 0.7] as const;
const SECTION = [4.2, 4.2, 3.8, 3.4] as const;

/**
 * A pocket kraken: a plump purple octopus head with two big gold eyes with slit pupils and frowning brows, a small
 * toothy grin, ear fins, and six tentacles that fan out along the floor and curl up at the tips, rippling.
 */
export function kraken(): Built {
  const body = new Model();
  const fore = new Model();
  const VIOLET = "#7b4fc4";
  const VIOLET_DARK = "#4f2f8c";
  const VIOLET_LIGHT = "#a98be8";
  const PALE = "#ecdcff";
  const INK = "#2a1646";
  const GOLD = "#ffd23f";
  const AMBER = "#ff9a2a";
  // The web under the head, where the tentacles root.
  const bg = new Grid();
  bg.ell(0, 5.4, 0, 5.2, 1.8, 5.2, (c) => speckle(c, VIOLET, VIOLET_DARK, 4, 0.3), 2.2);
  put(body, bg, [0, 0, 0], 1);

  const head = joint(body, [0, 11.5, 0]);
  const hg = new Grid();
  hg.ell(0, 0, 0, 6.4, 6.6, 6.2, VIOLET, 2.2);
  hg.paint((c) => {
    if (hash(c.x, c.y, c.z, 9) < 0.05) return PALE;
    if (c.t > 0.7 && hash(c.x, c.y, c.z, 5) < 0.4) return VIOLET_DARK;
    return speckle(c, VIOLET, VIOLET_LIGHT, 5, 0.25);
  });
  for (const s of SIDES) hg.ell(s * 6.4, 2.5, -1, 1.4, 2.4, 1.8, VIOLET_LIGHT);
  const paintFront = (x: number, y: number, color: string) => {
    const z = hg.front(x, y);
    if (z !== undefined) hg.set(x, y, z, color);
  };
  // Brows that slope down to the middle, a flat grin and two fangs.
  for (const s of SIDES)
    for (let i = 0; i <= 4; i++) {
      const y = Math.round(3.4 + i * 0.55);
      paintFront(s * (1 + i), y, INK);
    }
  for (let x = -3; x <= 3; x++) paintFront(x, Math.abs(x) > 1 ? -2 : -3, INK);
  for (const s of SIDES) paintFront(s, -4, "#ffffff");
  put(head, hg, [0, 0, 0], 2);
  const eyes: THREE.Mesh[] = [];
  for (const s of SIDES) {
    const e = eye([
      ["", GOLD, GOLD, GOLD, ""],
      [GOLD, GLINT, INK, GOLD, GOLD],
      [GOLD, GOLD, INK, GOLD, GOLD],
      [AMBER, AMBER, INK, AMBER, AMBER],
      ["", AMBER, AMBER, AMBER, ""],
    ]);
    e.rotation.y = s * 0.6;
    e.position.set(U(s * 3.7), U(0.6), U((hg.front(Math.round(s * 3.7), 1) ?? 5) + 0.5));
    head.add(e);
    eyes.push(e);
  }

  // Six tentacles, each a yawed root and four sections that bend one after another, so a wave can run down them.
  // Suckers (pale dots) line the inside of the curl.
  const tentacles = Array.from({ length: 6 }, (_, i) => {
    const phi = (i / 6) * Math.PI * 2 + 0.3;
    const root = joint(body, [Math.sin(phi) * 2.6, 5.6, Math.cos(phi) * 2.6], phi);
    let at: Model = root;
    const sections = CURL.map((a, j) => {
      const s = joint(at, [0, j ? -SECTION[j - 1]! : 0, 0]);
      const g = new Grid();
      g.tube(
        [
          [0, 0, 0],
          [0, -SECTION[j]!, 0],
        ],
        TAPER[j]!,
        TAPER[j + 1]!,
        (c) =>
          c.z <= -1 && Math.abs(c.x) <= 1 && c.y % 2 === 0 ? PALE : speckle(c, VIOLET, VIOLET_DARK, 7, 0.3),
        2.1,
      );
      put(s, g, [0, 0, 0], 30 + j);
      at = s;
      return { s, rest: -(a - (j ? CURL[j - 1]! : 0)) };
    });
    return { root, phi, sections };
  });

  return {
    rig: {
      head,
      eyes,
      fore: [],
      hind: [],
      tails: [],
      neck: [0, U(-3), U(-1)],
      neckR: U(5),
      top: [0, U(6.5), 0],
      tilt: false,
      span: U(2),
      fx: (t, moving) => {
        const rate = moving ? 7 : 1.8;
        const amp = moving ? 0.34 : 0.14;
        for (let i = 0; i < tentacles.length; i++) {
          const k = tentacles[i]!;
          k.root.rotation.y = k.phi + Math.sin(t * rate * 0.5 + i * 1.7) * (moving ? 0.14 : 0.07);
          for (let j = 0; j < k.sections.length; j++) {
            const sec = k.sections[j]!;
            sec.s.rotation.x = sec.rest + Math.sin(t * rate - j * 0.9 + i * 1.1) * amp * (0.5 + j * 0.3);
          }
        }
        head.position.y = U(11.5) + (moving ? Math.abs(Math.sin(t * 7)) * U(1) : Math.sin(t * 1.6) * U(0.25));
        head.rotation.y = Math.sin(t * (moving ? 4 : 0.7)) * 0.14;
        head.rotation.z = Math.sin(t * (moving ? 7 : 1.1)) * (moving ? 0.05 : 0.03);
      },
    },
    body,
    fore,
  };
}

/** The builders by species name, for `pets3d.ts`. */
export const POND_PETS = { axolotl, kraken } as const;
