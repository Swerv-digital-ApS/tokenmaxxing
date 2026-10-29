/**
 * The Ragnarok Eve case's hats and glasses in 3D (`core/src/case-ragnarok.ts`: four hats, three glasses). Loaded by
 * `gear3d.ts`, it adds its builders to the shop's `HAT_BUILDERS` / `FACE_BUILDERS` by item name, and pulls in the
 * body (`gear3dRagnarokBody.ts`) and aura (`gear3dRagnarokAura.ts`) halves. Same frames as `gear3dHead.ts`: the head
 * frame has its origin at the skull's centre, +z is the face and +y up; a voxel head draws every ball as a cube.
 * Design brief and the sensitivity rules: `docs/cases/ragnarok-eve.md`. In short: the real helmet has NO horns (only
 * the Opera horns joke has them), and nothing here carries a rune.
 */
import * as THREE from "three";
import type { Model, Paint } from "../kit/kit.ts";
import { seeded, tint } from "../kit/kit.ts";
import "./gear3dRagnarokAura.ts";
import "./gear3dRagnarokBody.ts";
import {
  COVERS_HAIR,
  dome,
  EYE_Y,
  eyeAt,
  FACE_BUILDERS,
  HAT_BUILDERS,
  lit,
  ring,
  see,
} from "./gear3dHead.ts";
import { isVox, place, squarePane } from "./voxgear.ts";

const FUR = "#9aa3ad";
const FUR_LIGHT = "#cfd5db";
const FUR_DARK = "#6e7782";
const STEEL = "#7a8394";
const STEEL_DARK = "#4a5160";
const STEEL_LIGHT = "#c3cad6";
const BONE = "#e8dfc8";
const BONE_DARK = "#c9bd9c";
const OAK = "#6b4a2e";
const OAK_DARK = "#3f2a1a";
const GOLD = "#e9b73d";
const EMBER = "#ff9a3c";
const WOAD = "#3b6fb8";
const FROST = "#cfe8f2";

/** A point at angle `a` round a head: on a circle for smooth models, on the square band for blocky ones. */
function roundAt(m: THREE.Object3D, a: number, r: number): [number, number] {
  const x = Math.sin(a);
  const z = Math.cos(a);
  if (!isVox(m)) return [x * r, z * r];
  const k = (r * 0.92) / Math.max(Math.abs(x), Math.abs(z));
  return [x * k, z * k];
}

/** Blocks on a path, as [centre x, centre y, size]. */
function path(m: Model, p: Paint, pts: [number, number, number][], z = 0, deep = 1): void {
  for (const [x, y, sz] of pts) m.box([sz, sz, sz * deep], p, [x, y - sz / 2, z], 0.004);
}

// MARK: Hats

/**
 * A crown over the head: on a blocky head (which ignores a thin dome: its hair block pokes through) two stacked
 * slabs that cover the whole skull, on a smooth one a dome.
 */
function crown(m: Model, color: string, o: { y?: number; h?: number; top?: string } = {}): void {
  const y = o.y ?? 0.0;
  const h = o.h ?? 0.3;
  if (!isVox(m)) {
    dome(m, color, 0.285, y + 0.02, 0.56);
    return;
  }
  m.box([0.55, h, 0.55], color, [0, y, 0], 0.01);
  m.box([0.47, 0.06, 0.47], o.top ?? color, [0, y + h, 0], 0.01);
}

/** A shaggy wolf-grey hood: a crown, a ring of pale fringe, darker ears and a drape down the back. */
function furHood(m: Model): void {
  crown(m, FUR, { y: 0.04, h: 0.26, top: "#b3bbc4" });
  const rnd = seeded(500);
  // Fringe: a ring of pale tufts round the brow, longer at the front.
  const n = 20;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const [x, z] = roundAt(m, a, 0.3);
    const front = Math.max(0, Math.cos(a));
    const h = 0.085 + front * 0.025 + rnd() * 0.02;
    m.box([0.095, h, 0.095], i % 2 ? "#b8c0c9" : FUR, [x, 0.14 - h, z], 0.012);
  }
  // Cheek flaps and a drape down the back.
  for (const s of [-1, 1]) m.box([0.075, 0.2, 0.3], FUR, [s * 0.285, -0.2, -0.02], 0.02);
  m.box([0.56, 0.22, 0.08], FUR, [0, -0.22, -0.3], 0.02);
  for (let i = 0; i < 5; i++)
    m.box(
      [0.08, 0.05 + (i % 2) * 0.04, 0.08],
      FUR_LIGHT,
      [-0.2 + i * 0.1, -0.25 - (i % 2) * 0.04, -0.32],
      0.01,
    );
  // Ears.
  for (const s of [-1, 1]) {
    m.box([0.12, 0.12, 0.1], FUR_DARK, [s * 0.19, 0.31, -0.02], 0.02);
    m.box([0.06, 0.07, 0.03], "#b99aa0", [s * 0.19, 0.32, 0.04], 0.006);
  }
  // A few tufts on the crown, so it reads as fur and not as paint.
  for (let i = 0; i < 8; i++) {
    const a = rnd() * Math.PI * 2;
    const r = 0.04 + rnd() * 0.15;
    m.box(
      [0.06, 0.04, 0.06],
      i % 3 ? FUR_LIGHT : FUR_DARK,
      [Math.sin(a) * r, 0.34 - r * 0.2, Math.cos(a) * r],
      0.008,
    );
  }
}

/** A plain iron helm with a nose guard and a rivet band: no horns. */
function nasalHelm(m: Model): void {
  crown(m, STEEL, { y: 0.04, h: 0.24, top: STEEL });
  m.box([0.58, 0.07, 0.58], STEEL_DARK, [0, 0.04, 0], 0.008);
  m.box([0.585, 0.014, 0.585], STEEL_LIGHT, [0, 0.11, 0], 0.003);
  for (let i = 0; i < 12; i++) {
    const [x, z] = roundAt(m, (i / 12) * Math.PI * 2, 0.31);
    m.box([0.034, 0.034, 0.034], STEEL_LIGHT, [x, 0.06, z], 0.006);
  }
  // A ridge over the crown, and the nasal bar down the face.
  m.box([0.06, 0.04, 0.5], STEEL_DARK, [0, 0.33, 0], 0.008);
  m.box([0.06, 0.18, 0.04], STEEL, [0, -0.1, 0.3], 0.01);
  m.box([0.1, 0.05, 0.05], STEEL_DARK, [0, 0.0, 0.3], 0.006);
  // A short aventail of mail at the back and over the ears.
  for (const s of [-1, 1]) m.box([0.04, 0.17, 0.3], STEEL_DARK, [s * 0.285, -0.16, -0.03], 0.006);
  m.box([0.56, 0.15, 0.04], STEEL_DARK, [0, -0.15, -0.3], 0.006);
}

/** Three braids with a bead each: two to the front of the shoulders, one down the back. */
function beadedBraids(m: Model, c: { hair: string; tick(fn: (t: number) => void): void }): void {
  const beads = [EMBER, GOLD, EMBER];
  const swing: Model[] = [];
  const dark = tint(c.hair, -0.2);
  const light = tint(c.hair, 0.12);
  const braid = (x: number, z: number, i: number) => {
    const p = m.part([x, 0.1, z]);
    for (let k = 0; k < 7; k++)
      p.box([0.085, 0.07, 0.085], k % 2 ? light : dark, [k % 2 ? 0.014 : -0.014, -0.07 * (k + 1), 0], 0.014);
    // The leather tie where it starts and the bead at the tip.
    p.box([0.1, 0.025, 0.1], OAK, [0, -0.03, 0], 0.004);
    p.box([0.09, 0.09, 0.09], beads[i]!, [0, -0.58, 0], 0.014);
    p.box([0.03, 0.02, 0.03], OAK_DARK, [0, -0.5, 0], 0.003);
    swing.push(p);
  };
  braid(-0.29, 0.1, 0);
  braid(0.29, 0.1, 1);
  braid(0, -0.35, 2);
  c.tick((t) => {
    swing.forEach((p, i) => {
      p.rotation.z = Math.sin(t * 1.6 + i * 2) * 0.04;
    });
  });
}

/** Opera horns: an iron cap, a gold rim with a red stone, big curved bone horns, and Wagnerian blond pigtails. */
function operaHorns(m: Model): void {
  crown(m, STEEL, { y: 0.04, h: 0.24, top: STEEL });
  m.box([0.58, 0.07, 0.58], GOLD, [0, 0.04, 0], 0.008);
  m.box([0.585, 0.014, 0.585], "#b8860b", [0, 0.11, 0], 0.003);
  m.box([0.07, 0.07, 0.04], "#d8283a", [0, 0.04, 0.3], 0.006);
  for (const s of [-1, 1]) {
    path(m, BONE, [
      [s * 0.3, 0.12, 0.17],
      [s * 0.39, 0.15, 0.16],
      [s * 0.45, 0.22, 0.15],
      [s * 0.48, 0.31, 0.14],
      [s * 0.47, 0.4, 0.125],
      [s * 0.43, 0.49, 0.105],
      [s * 0.38, 0.56, 0.085],
    ]);
    path(m, BONE_DARK, [[s * 0.33, 0.62, 0.065]]);
    path(m, "#fbf7ef", [[s * 0.285, 0.66, 0.045]]);
    // A gold ring at the root, where it meets the cap.
    m.box([0.1, 0.07, 0.22], GOLD, [s * 0.3, 0.05, 0], 0.004);
  }
  // Two blond braids, the part of the costume that is truly accurate to the opera.
  for (const s of [-1, 1]) {
    for (let k = 0; k < 6; k++)
      m.box(
        [0.085, 0.07, 0.085],
        k % 2 ? "#f0d36a" : "#d9b24a",
        [s * (0.29 + (k % 2 ? 0.014 : -0.014)), -0.06 - k * 0.07, 0.1],
        0.014,
      );
    m.box([0.11, 0.03, 0.11], "#d8283a", [s * 0.29, -0.5, 0.1], 0.004);
  }
}

Object.assign(HAT_BUILDERS, {
  "Fur hood": (m: Model) => furHood(m),
  "Nasal helm": (m: Model) => nasalHelm(m),
  "Beaded braids": (m: Model, c: { hair: string; tick(fn: (t: number) => void): void }) => beadedBraids(m, c),
  "Opera horns": (m: Model) => operaHorns(m),
});
for (const n of ["Fur hood", "Nasal helm", "Opera horns"]) COVERS_HAIR.add(n);

// MARK: Glasses

/** A round lens (a square pane on a blocky face) in a rim. */
function roundLens(e: Model, frame: string, glass: string, r = 0.062, opacity = 0.5): THREE.Mesh | undefined {
  ring(e, frame, r, 0.009, [0, 0, 0], false);
  if (isVox(e)) return squarePane(e, r * 0.95, see(glass, opacity), [0, 0, 0.002]);
  const disc = new THREE.Mesh(new THREE.CircleGeometry(r, 20), see(glass, opacity));
  disc.position.z = 0.002;
  e.add(disc);
  return disc;
}

/** Arms back round the head from the lens rims. */
function arms(m: Model, color: string, y = EYE_Y): void {
  const x = isVox(m) ? 0.2 : 0.255;
  for (const s of [-1, 1]) {
    const o = m.box([0.012, 0.012, 0.18], color, [s * x, y + 0.005, 0.1], 0.004);
    if (!isVox(m)) o.rotation.y = s * -0.12;
  }
}

/** A band round the head at eye height (a leather strap). */
function strap(m: Model, color: string, y = EYE_Y, w = 0.03): void {
  if (isVox(m)) {
    const g = new THREE.BoxGeometry(0.44, w, 0.03).translate(0, 0, 0.21);
    const back = new THREE.BoxGeometry(0.44, w, 0.03).translate(0, 0, -0.32);
    const l = new THREE.BoxGeometry(0.03, w, 0.5).translate(-0.215, 0, -0.055);
    const r = new THREE.BoxGeometry(0.03, w, 0.5).translate(0.215, 0, -0.055);
    for (const b of [g, back, l, r]) place(m, b, color, [0, y - w / 2, 0]);
    return;
  }
  const r = m.cyl(0.262, w, color, [0, y - w / 2, 0], 0.262, 24);
  r.scale.set(1.0, 1, 0.97);
  (r.material as THREE.Material).side = THREE.DoubleSide;
}

Object.assign(FACE_BUILDERS, {
  // Three woad-blue finger stripes dragged down each cheek, just under the eyes, so the eyes themselves stay clear.
  "Warpaint stripes": (m: Model) => {
    for (const s of [-1, 1] as const) {
      const e = eyeAt(m, s);
      for (const [dx, len] of [
        [-0.036, 0.075],
        [0, 0.1],
        [0.036, 0.075],
      ] as const) {
        // Paint, not a solid: it lies on the skin and casts no shadow of its own.
        e.box([0.022, len, 0.008], WOAD, [dx, -0.05 - len / 2, 0.03], 0.002).castShadow = false;
      }
    }
  },
  // Round lenses rimed with ice, a few sparkles that blink, and an icicle hanging off each rim.
  "Frosted specs": (m: Model, c: { tick(fn: (t: number) => void): void }) => {
    const sparkles: THREE.Mesh[] = [];
    for (const s of [-1, 1] as const) {
      const e = eyeAt(m, s);
      roundLens(e, FROST, "#dff4ff", 0.066, 0.4);
      ring(e, "#ffffff", 0.074, 0.006, [0, 0, 0.006], false);
      // Frost crust on the top of each rim, and an icicle each.
      e.box([0.1, 0.014, 0.02], "#ffffff", [0, 0.064, 0.002], 0.004);
      e.box([0.02, 0.036, 0.02], FROST, [s * 0.03, -0.1, 0.002], 0.004);
      e.box([0.012, 0.024, 0.016], "#ffffff", [s * -0.02, -0.093, 0.002], 0.003);
      sparkles.push(e.box([0.016, 0.016, 0.012], lit("#ffffff"), [s * 0.04, 0.04, 0.02], 0.002));
      sparkles.push(e.box([0.01, 0.01, 0.012], lit("#bfeaff"), [s * -0.03, -0.03, 0.02], 0.002));
    }
    m.box([0.05, 0.014, 0.014], FROST, [0, EYE_Y + 0.012, 0.245], 0.004);
    m.box([0.07, 0.012, 0.012], FROST, [0, EYE_Y, 0.246], 0.004);
    arms(m, FROST);
    c.tick((t) =>
      sparkles.forEach((sp, i) => {
        sp.scale.setScalar(0.3 + Math.max(0, Math.sin(t * 2.4 + i * 1.7)) ** 3 * 1.2);
      }),
    );
  },
  // One round lens on a leather strap, with a faint blue water shimmer sliding across the glass.
  "Mimir's lens": (m: Model, c: { tick(fn: (t: number) => void): void }) => {
    strap(m, OAK, EYE_Y, 0.032);
    strap(m, OAK_DARK, EYE_Y + 0.034, 0.012);
    const e = eyeAt(m, 1);
    const lens = roundLens(e, "#b8894a", "#7fc8ff", 0.078, 0.38);
    ring(e, "#e9b73d", 0.088, 0.008, [0, 0, 0.004], false);
    e.box([0.02, 0.03, 0.024], "#b8894a", [0.09, 0.0, 0.0], 0.004);
    const wave = [0, 1].map((i) =>
      e.box([0.1, 0.012, 0.008], lit(i ? "#bfe6ff" : "#7fd0ff"), [0, 0, 0.012], 0.002),
    );
    const drops = e.box([0.014, 0.014, 0.012], lit("#bfe6ff"), [0, -0.1, 0.004], 0.002);
    c.tick((t) => {
      wave.forEach((w, i) => {
        const k = (t * 0.4 + i * 0.5) % 1;
        w.position.y = 0.07 - k * 0.14;
        w.scale.x = Math.sin(k * Math.PI) * (0.9 - i * 0.3) + 0.05;
      });
      drops.position.y = -0.1 - ((t * 0.5) % 1) * 0.05;
      drops.scale.setScalar(1 - ((t * 0.5) % 1));
      if (lens) (lens.material as THREE.MeshBasicMaterial).opacity = 0.34 + Math.sin(t * 2) * 0.06;
    });
  },
});
