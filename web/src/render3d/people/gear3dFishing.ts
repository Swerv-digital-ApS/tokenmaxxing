/**
 * The pond treasures' hat in 3D (`core/src/fishing-loot.ts`: one hat, one rod, one tackle box, two pets, one aura, all
 * only fishing turns up). Loaded by `gear3d.ts`, it adds its builder to the shop's `HAT_BUILDERS` by item name, and pulls
 * in the body (`gear3dFishingBody.ts`: the rod and the tackle box) and aura (`gear3dFishingAura.ts`) halves. Same
 * frames as `gear3dHead.ts`: the head frame has its origin at the skull's centre, +z is the face and +y up; a voxel
 * head draws every ball as a cube.
 */
import type { Model } from "../kit/kit.ts";
import "./gear3dFishingAura.ts";
import "./gear3dFishingBody.ts";
import { COVERS_HAIR, type Ctx, HAT_BUILDERS } from "./gear3dHead.ts";
import { isVox } from "./voxgear.ts";

const OLIVE = "#7d8248";
const OLIVE_LIGHT = "#9aa05e";
const OLIVE_DARK = "#575b2f";
const KHAKI = "#c8b87c";
const KHAKI_DARK = "#9d8d55";
const CORD = "#4a3a22";
const STEEL = "#c3cad6";
const STEEL_DARK = "#7a8394";

/** A point at angle `a` round a head: on a circle for smooth models, on the square band for blocky ones. */
function roundAt(m: Model, a: number, r: number): [number, number] {
  const x = Math.sin(a);
  const z = Math.cos(a);
  if (!isVox(m)) return [x * r, z * r];
  const k = (r * 0.92) / Math.max(Math.abs(x), Math.abs(z));
  return [x * k, z * k];
}

/** The lures on the band, from the front round to the back: [angle, kind (0 fly, 1 spoon, 2 jig), three colours]. */
// A table reads best one lure a line.
// prettier-ignore
const LURES: readonly [number, number, string, string, string][] = [
  [-1.45, 0, "#e63946", "#ffd23f", "#3a86ff"],
  [-0.95, 1, "#dfe6ee", "#e63946", "#ffffff"],
  [-0.45, 2, "#ff9f1c", "#2ec4b6", "#ff4d6d"],
  [0.25, 0, "#3a86ff", "#ff9f1c", "#e63946"],
  [0.75, 1, "#f2c230", "#3a86ff", "#ffffff"],
  [1.25, 2, "#8338ec", "#ffd23f", "#3ddc84"],
  [2.9, 0, "#06d6a0", "#ff4d6d", "#ffd23f"],
];

/** One lure hanging from `p` (its pivot is the clip on the band): a loop of steel, the bait, a hook. */
function lure(p: Model, kind: number, a: string, b: string, c: string): void {
  p.box([0.014, 0.02, 0.014], STEEL, [0, -0.012, 0.006], 0.004);
  if (kind === 0) {
    // A fly: a bead head, a puff of hackle and a tail feather.
    p.ball(0.017, a, [0, -0.03, 0.012]);
    p.box([0.045, 0.028, 0.026], b, [0, -0.062, 0.006], 0.006);
    p.box([0.016, 0.03, 0.012], c, [0, -0.09, 0.006], 0.004);
  } else if (kind === 1) {
    // A spoon: a flat teardrop of metal with a stripe down it.
    p.ball(0.026, a, [0, -0.05, 0.012], [0.62, 1.3, 0.3]);
    p.box([0.01, 0.05, 0.008], b, [0, -0.075, 0.022], 0.002);
  } else {
    // A jig: a round head, a skirt and three strands.
    p.ball(0.018, a, [0, -0.034, 0.012]);
    p.box([0.036, 0.034, 0.032], b, [0, -0.07, 0.006], 0.006);
    for (const x of [-0.012, 0, 0.012]) p.box([0.006, 0.02, 0.006], c, [x, -0.09, 0.008], 0.002);
  }
  // The hook, a shank and a barb.
  p.box([0.006, 0.018, 0.006], STEEL_DARK, [0, -0.108, 0.008], 0.002);
  p.box([0.016, 0.006, 0.006], STEEL_DARK, [0.005, -0.11, 0.008], 0.002);
}

/**
 * A fisherman's bucket hat in olive canvas with a khaki brim and a cord band, and seven lures hooked into the band that
 * swing a little.
 */
function lureHat(m: Model, c: Ctx): void {
  const vox = isVox(m);
  // The crown, tapering to the top, and the brim sloping out and down from it.
  m.cyl(0.29, 0.28, OLIVE, [0, 0, 0], 0.255, 22);
  m.cyl(0.43, 0.05, KHAKI, [0, -0.01, 0], 0.3, 26);
  m.cyl(0.43, 0.012, KHAKI_DARK, [0, -0.012, 0], 0.43, 26);
  // A flat top, stitched round the rim.
  m.cyl(0.255, 0.014, OLIVE_LIGHT, [0, 0.272, 0], 0.245, 22);
  if (!vox) m.cyl(0.26, 0.006, OLIVE_DARK, [0, 0.266, 0], 0.26, 22);
  // The band, and a pair of eyelets on each side.
  m.cyl(0.292, 0.08, CORD, [0, 0.09, 0], 0.284, 22);
  for (const s of [-1, 1])
    for (const z of [0.03, 0.08]) m.ball(0.013, OLIVE_DARK, [s * 0.27, 0.2, z], [0.5, 1, 1], 6);

  const swing = LURES.map(([a, kind, c1, c2, c3]) => {
    const [x, z] = roundAt(m, a, 0.295);
    const p = m.part([x, 0.18, z], vox ? 0 : a);
    p.scale.setScalar(1.5);
    lure(p, kind, c1, c2, c3);
    return p;
  });
  c.tick((t) => {
    for (let i = 0; i < swing.length; i++) {
      const p = swing[i]!;
      p.rotation.x = Math.sin(t * 1.7 + i * 1.3) * 0.1;
      p.rotation.z = Math.sin(t * 1.3 + i * 2.1) * 0.05;
    }
  });
}

Object.assign(HAT_BUILDERS, {
  "Lucky lure hat": (m: Model, c: Ctx) => lureHat(m, c),
});
COVERS_HAIR.add("Lucky lure hat");
