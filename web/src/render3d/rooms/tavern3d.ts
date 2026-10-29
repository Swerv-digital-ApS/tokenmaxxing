/**
 * The Tavern (`inn`) and the dorm above it (`upstairs`) as 3D props, built from the 2D art in
 * `web/src/art/tavern.ts`, `art/tiles.ts` and `art/objects.ts` and the evening pass in `game/tavern.ts`:
 * the bar and its tap, back-bar shelves, stools, tables with candles, chairs, the hearth with its flames,
 * wall sconces, the stage with its drifting notes, barrels, the jukebox, the bar tab, quest board, Hall of
 * Fame, regulars' plaques, the open-offices board, the daily-special easel, the world clocks, the stairs and the exit, the
 * tip jar on the bar, the kitchen door, coat and umbrella stands, sofas, booths, Bent the barkeep and the dorm's beds.
 *
 * Ids follow the 2D catalogue: `tile:<char>` for map tiles, `tavern:<name>` for what has no tile.
 * Hooks (all additive, none needed): a boards's `redraw` (bar tab, plaques, easel), `JukeboxModel.playing`,
 * `ClocksModel.show()`, `FountainModel.toss()` (the tip jar's coin toss), `setTavernNight()`.
 */

import * as THREE from "three";
import { C, HAIRS, SKINS } from "../../art/palette.ts";
import { bandPlaying } from "../../game/tavern-performance.ts";
import { aarhusDay, SPECIALS, STRIDE, type TabRow } from "../data/tavern.ts";
import { type Asset, assetById, light } from "../furniture/furniture.ts";
import {
  canvasTexture,
  glass,
  glow,
  Model,
  painted,
  planks,
  seeded,
  ticks,
  tint,
  type V3,
} from "../kit/kit.ts";
import { type Panel, panel } from "../kit/panel.ts";
import { Avatar, type Look, personLook } from "../people/avatar.ts";
import { stool as barStool } from "../town/props.ts";
import { exitPlate, exitStairs } from "./exits3d.ts";
import { type Placed, Room, type Turn } from "./room.ts";

const BRASS = "#c98e22";
const BRASS_LIGHT = "#fff4b8";
const BRASS_DARK = "#8a5f14";
const PAPER = "#f1e6d2";
const CHALK = "#f1ede0";
const CHALK_DIM = "#a9b0b4";
const INK = C.ink;
const FONT = "ui-monospace, Menlo, Consolas, monospace";

// ——— Night ———

/** Whether the room's lights are on. Read off the hearth's own light, or forced with `setTavernNight`. */
let lit = false;
let forced: boolean | null = null;
const isLit = () => forced ?? lit;
/** Forces the Tavern's glow (candles, notes) on or off; call it where the scene's night is switched. */
export function setTavernNight(on: boolean | null): void {
  forced = on;
}

/** A point light that flickers with a candle's or fire's wobble, on only when night turns lights on. */
function flame(
  m: Model,
  at: V3,
  color: string,
  intensity: number,
  distance: number,
  seed: number,
): THREE.PointLight {
  light(m, at, color, intensity, distance);
  const l = m.children[m.children.length - 1] as THREE.PointLight;
  ticks.push((t) => {
    if (l.intensity <= 0) return;
    const k = 0.86 + 0.09 * Math.sin(t * 9 + seed) + 0.05 * Math.sin(t * 23 + seed * 3);
    l.intensity = (l.userData.night as number) * k;
  });
  return l;
}

/** A soft round glow texture for additive halos. */
const haloTexture = (() => {
  let t: THREE.CanvasTexture | null = null;
  return () =>
    (t ??= canvasTexture(
      32,
      32,
      (g) => {
        const r = g.createRadialGradient(16, 16, 0, 16, 16, 16);
        r.addColorStop(0, "rgba(255,255,255,1)");
        r.addColorStop(0.35, "rgba(255,255,255,0.45)");
        r.addColorStop(1, "rgba(255,255,255,0)");
        g.fillStyle = r;
        g.fillRect(0, 0, 32, 32);
      },
      true,
    ));
})();

/** A flat, see-through quad that always faces the camera (a Mesh, so the outline pass leaves it out). */
function billboard(mat: THREE.Material): THREE.Mesh {
  const q = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);
  q.onBeforeRender = (_r, _s, camera) => q.quaternion.copy(camera.quaternion);
  q.renderOrder = 5;
  return q;
}

/** A glow halo (a camera-facing sprite) that swells at night; the stand-in for a light we can't afford. */
function halo(m: Model, at: V3, size: number, color: string, seed = 0): THREE.Mesh {
  const mat = new THREE.MeshBasicMaterial({
    map: haloTexture(),
    color,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    opacity: 0.1,
  });
  const s = billboard(mat);
  s.position.set(...at);
  s.scale.setScalar(size);
  m.add(s);
  ticks.push((t) => {
    const k = 0.85 + 0.15 * Math.sin(t * 8 + seed * 2.1);
    mat.opacity = (isLit() ? 0.7 : 0.12) * k;
    s.scale.setScalar(size * (0.94 + 0.06 * k));
  });
  return s;
}

/** A little flame: a squashed glowing ball that flickers. */
function littleFlame(m: Model, at: V3, size: number, seed: number): void {
  const f = m.ball(size, glow("#f8c43a"), at, [0.7, 1.5, 0.7], 8);
  m.ball(size * 0.5, glow("#fff0a8"), [at[0], at[1] - size * 0.2, at[2]], [0.7, 1.3, 0.7], 6);
  ticks.push((t) => {
    f.scale.y = 1.5 + 0.25 * Math.sin(t * 11 + seed);
    f.position.x = at[0] + Math.sin(t * 7 + seed) * size * 0.15;
  });
}

/** A candle in a brass dish; its flame and halo glow. */
function candle(m: Model, at: V3, seed: number, withHalo = true): void {
  const [x, y, z] = at;
  m.cyl(0.07, 0.02, BRASS, [x, y, z], 0.08, 10);
  m.cyl(0.028, 0.1, "#f4ead2", [x, y + 0.02, z], 0.028, 8);
  littleFlame(m, [x, y + 0.17, z], 0.03, seed);
  if (withHalo) halo(m, [x, y + 0.2, z], 0.7, "#ffce78", seed);
}

// ——— Wood and stone helpers ———

const WOOD = C.wood;
const WOOD_DARK = C.woodDark;
const WOOD_LIGHT = C.woodLight;
const TRUNK_DARK = C.trunkDark;

/** A wooden board whose planks are painted on, so it doesn't look like one flat colour. */
const plank = (base: string, seed: number, repeat = 0.25): THREE.MeshToonMaterial => {
  const t = planks(base, seed);
  t.repeat.set(repeat, repeat);
  return painted(t);
};
const STAGE_BOARDS = plank(WOOD_DARK, 7);

// ——— Panels on a wall ———

/** Wraps `p` so its back sits on the north edge of a 1×1 tile, which is how wall pieces are placed. */
function onWall(p: Panel, w: Model): Panel {
  p.position.z = -0.46;
  w.add(p);
  const out = w as Panel;
  out.redraw = p.redraw;
  return out;
}

const text = (
  g: CanvasRenderingContext2D,
  s: string,
  x: number,
  y: number,
  size: number,
  color: string,
  bold = true,
  align: CanvasTextAlign = "left",
) => {
  g.font = `${bold ? "bold " : ""}${Math.round(size)}px ${FONT}`;
  g.fillStyle = color;
  g.textAlign = align;
  g.textBaseline = "top";
  g.fillText(s, x, y);
};

// ——— The bar ———

/** One tile of the counter: a polished top over a planked front. With `tap`, a brass tap, a drip tray, a mug and a lamp. */
function barCounter(tap: boolean): Model {
  const m = new Model();
  m.box([1, 0.96, 0.7], plank(WOOD_DARK, 3, 0.5), [0, 0, 0], 0.01);
  // The front's planks: dark strips, a rail at the foot.
  for (const x of [-0.33, 0, 0.33]) m.box([0.03, 0.7, 0.012], TRUNK_DARK, [x, 0.14, 0.356], 0.004);
  m.box([1, 0.05, 0.03], TRUNK_DARK, [0, 0, 0.35], 0.006);
  m.cyl(0.022, 1, BRASS, [0.5, 0.2, 0.42], 0.022, 8).rotation.z = Math.PI / 2;
  // The top, overhanging towards the stools, with a light edge.
  m.box([1, 0.07, 0.84], WOOD_LIGHT, [0, 0.96, 0.06], 0.012);
  m.box([1, 0.012, 0.84], C.white, [0, 1.03, 0.06], 0.004).scale.set(1, 1, 0.99);
  m.box([1, 0.02, 0.012], WOOD, [0, 0.95, 0.48], 0.004);
  if (!tap) return m;
  // The tap: a brass tower, a spout, a handle and a drip tray.
  m.box([0.34, 0.02, 0.2], INK, [-0.12, 1.03, 0.2], 0.006);
  m.cyl(0.055, 0.05, BRASS_DARK, [-0.12, 1.05, 0.0], 0.065, 10);
  m.cyl(0.028, 0.26, BRASS, [-0.12, 1.1, 0.0], 0.024, 10);
  m.box([0.04, 0.04, 0.14], BRASS, [-0.12, 1.31, 0.06], 0.01);
  m.cyl(0.012, 0.05, BRASS_LIGHT, [-0.12, 1.265, 0.12], 0.012, 6);
  m.cyl(0.017, 0.12, WOOD_DARK, [-0.12, 1.36, -0.03], 0.02, 8);
  m.ball(0.028, "#c4544b", [-0.12, 1.5, -0.03]);
  // A full mug beside it, foam on top.
  m.cyl(0.07, 0.15, glass("#f5d14a", 0.9), [0.27, 1.03, 0.2], 0.065, 12);
  m.cyl(0.07, 0.025, C.white, [0.27, 1.18, 0.2], 0.07, 12);
  m.box([0.03, 0.09, 0.05], "#f5d14a", [0.35, 1.06, 0.2], 0.01);
  // The tap's lamp: a brass lantern with a warm light at night.
  m.cyl(0.055, 0.03, BRASS_DARK, [0.3, 1.03, -0.15], 0.06, 10);
  m.cyl(0.045, 0.14, glow("#ffcf7a"), [0.3, 1.06, -0.15], 0.045, 10);
  m.cyl(0.05, 0.02, BRASS_DARK, [0.3, 1.2, -0.15], 0.06, 10);
  light(m, [0.3, 1.25, -0.1], "#ffcf7a", 1.1, 3.2);
  halo(m, [0.3, 1.14, -0.15], 0.55, "#ffce78", 4);
  return m;
}

/** Back-bar shelves for `w` tiles of the north wall: a cupboard, three shelves of bottles, mugs and a little barrel. */
function backBar(w: number): Model {
  const m = new Model();
  const z = -0.38;
  m.box([w - 0.04, 0.78, 0.46], WOOD_DARK, [0, 0, z + 0.06], 0.015);
  for (let i = 0; i < w * 2; i++)
    m.box(
      [0.46, 0.62, 0.015],
      tint(WOOD_DARK, (i % 2) * 0.1 - 0.05),
      [-w / 2 + 0.27 + i * 0.5, 0.08, z + 0.3],
      0.006,
    );
  for (let i = 0; i < w * 2; i++) m.ball(0.018, BRASS_LIGHT, [-w / 2 + 0.27 + i * 0.5 + 0.17, 0.4, z + 0.31]);
  m.box([w - 0.04, 0.05, 0.54], WOOD_LIGHT, [0, 0.78, z + 0.08], 0.01);
  // The wall behind: a dark panel with three shelves.
  m.box([w - 0.04, 1.28, 0.06], "#4b3326", [0, 0.83, z - 0.1], 0.01);
  const rnd = seeded(31);
  const colours = ["#58b36a", "#c4544b", "#f0b53c", "#8fe3ff", "#9b6fd6", "#e8e2d4"];
  for (const [i, y] of [1.05, 1.5, 1.9].entries()) {
    m.box([w - 0.1, 0.045, 0.24], WOOD, [0, y - 0.045, z + 0.02], 0.01);
    for (const s of [-1, 1])
      m.box([0.04, 0.12, 0.2], WOOD_DARK, [s * (w / 2 - 0.1), y - 0.12, z + 0.02], 0.01);
    for (let b = 0; b < Math.floor(w * 3.4); b++) {
      const x = -w / 2 + 0.2 + b * 0.29 + rnd() * 0.05;
      const kind = (b + i) % 4;
      const col = colours[Math.floor(rnd() * colours.length)]!;
      if (kind === 3) {
        m.cyl(0.06, 0.11, "#f5d14a", [x, y, z + 0.02], 0.055, 10);
        continue;
      }
      const h = 0.2 + rnd() * 0.12;
      m.cyl(0.05, h, glass(col, 0.88), [x, y, z + 0.02], 0.05, 10);
      m.cyl(0.018, 0.1, glass(col, 0.88), [x, y + h, z + 0.02], 0.018, 8);
      m.cyl(0.02, 0.025, "#8a5f14", [x, y + h + 0.1, z + 0.02], 0.02, 8);
    }
  }
  m.cyl(0.18, 0.3, WOOD, [-w / 2 + 0.5, 0.78 + 0.05, z + 0.08], 0.18, 12);
  for (const y of [0.1, 0.24]) m.cyl(0.19, 0.025, C.metal, [-w / 2 + 0.5, 0.83 + y, z + 0.08], 0.19, 12);
  return m;
}

/** A free-standing shelf (`k`) of bottles, books and mugs. */
function shelfUnit(): Model {
  const m = new Model();
  m.box([0.94, 1.7, 0.36], WOOD_DARK, [0, 0, -0.3], 0.02);
  const rnd = seeded(5);
  const colours = ["#c4544b", "#4f8fe0", "#58b36a", "#f0b53c", "#9b6fd6", "#e8e2d4"];
  for (const y of [0.1, 0.55, 1.0, 1.45]) {
    m.box([0.86, 0.04, 0.3], WOOD, [0, y, -0.28], 0.008);
    if (y > 1.4) continue;
    let x = -0.4;
    while (x < 0.36) {
      if (rnd() < 0.28) {
        m.cyl(
          0.04,
          0.2,
          glass(colours[Math.floor(rnd() * colours.length)]!, 0.88),
          [x + 0.04, y + 0.04, -0.28],
          0.04,
          8,
        );
        x += 0.1;
      } else {
        const w = 0.04 + rnd() * 0.03;
        m.box(
          [w, 0.22 + rnd() * 0.12, 0.2],
          colours[Math.floor(rnd() * colours.length)]!,
          [x + w / 2, y + 0.04, -0.28],
          0.006,
        );
        x += w + 0.004;
      }
    }
  }
  return m;
}

// ——— Seats and tables ———

/** A wooden tavern chair facing +z. */
function tavernChair(): Model {
  const m = new Model();
  for (const sx of [-1, 1])
    for (const sz of [-1, 1]) m.cyl(0.025, 0.4, WOOD_DARK, [sx * 0.17, 0, sz * 0.17], 0.025, 8);
  m.box([0.42, 0.06, 0.42], WOOD_LIGHT, [0, 0.4, 0], 0.02);
  for (const sx of [-1, 1]) m.box([0.04, 0.5, 0.04], WOOD_DARK, [sx * 0.17, 0.44, -0.18], 0.012);
  for (const y of [0.62, 0.76]) m.box([0.372, 0.07, 0.03], WOOD, [0, y, -0.18], 0.01);
  return m;
}

/** A table `w` tiles long, with a candle per tile and a mug or two. */
function tavernTable(w: number): () => Model {
  return () => {
    const m = new Model();
    const len = w - 0.08;
    m.box([len, 0.07, 0.86], WOOD_LIGHT, [0, 0.67, 0], 0.015);
    m.box([len - 0.1, 0.08, 0.72], WOOD_DARK, [0, 0.6, 0], 0.01);
    for (const sx of [-1, 1])
      for (const sz of [-1, 1]) m.cyl(0.04, 0.6, WOOD_DARK, [sx * (len / 2 - 0.08), 0, sz * 0.32], 0.035, 8);
    for (let i = 0; i < w; i++) {
      const x = -w / 2 + 0.5 + i;
      candle(m, [x, 0.745, 0], i + w * 3);
    }
    m.cyl(0.05, 0.1, glass("#f5d14a", 0.9), [-len / 2 + 0.2, 0.745, 0.2], 0.047, 10);
    m.cyl(0.05, 0.02, C.white, [-len / 2 + 0.2, 0.845, 0.2], 0.05, 10);
    return m;
  };
}

/** A stool at the bar: the town's, with the Tavern's red cushion. */
function barStoolRed(): Model {
  const m = new Model();
  m.add(barStool(C.rug));
  return m;
}

/** A raised stool for the singer: the bar stool, standing on the stage's boards. */
function stageStool(): Model {
  const m = new Model();
  const s = barStool(C.rug);
  s.position.y = 0.14;
  m.add(s);
  return m;
}

/**
 * A cushioned seat one tile wide, facing +z, with its back on -z. A sofa is two of them side by side (the
 * left one has an arm at -x, the right one at +x), a booth bench the same with a taller back, an armchair has
 * both arms. One seat anchor each, so every sitter is on a cushion of their own.
 */
function seatUnit(kind: "sofa" | "booth" | "armchair", leftArm: boolean, rightArm: boolean): () => Model {
  return () => {
    const m = new Model();
    const colour = kind === "sofa" ? C.fabric : kind === "armchair" ? "#8a4a32" : C.rug;
    const frame = kind === "booth" ? WOOD_DARK : tint(colour, -0.18);
    const backH = kind === "booth" ? 0.78 : 0.42;
    // Inset the base and back so the arms have their own outer faces in both geometry styles.
    m.box([0.98, 0.24, 0.78], frame, [0, 0.05, 0], 0.05);
    m.box([0.94, 0.12, 0.64], colour, [0, 0.28, 0.07], 0.05);
    m.box(
      [0.98, backH, kind === "booth" ? 0.12 : 0.2],
      kind === "booth" ? WOOD : colour,
      [0, 0.29, kind === "booth" ? -0.33 : -0.29],
      0.07,
    );
    if (kind === "booth") m.box([0.9, 0.34, 0.06], colour, [0, 0.42, -0.27], 0.03);
    for (const [on, x] of [
      [leftArm, -0.43],
      [rightArm, 0.43],
    ] as const) {
      if (!on) continue;
      m.box(
        [0.14, kind === "booth" ? 0.84 : 0.46, 0.8],
        kind === "booth" ? WOOD : tint(colour, -0.08),
        [x, 0.05, 0],
        0.07,
      );
    }
    for (const x of [-0.42, 0.42])
      for (const z of [-0.33, 0.33]) m.cyl(0.03, 0.05, C.woodDark, [x, 0, z], 0.03, 8);
    return m;
  };
}

// ——— The hearth ———

const hearthInner = (): Model => {
  const m = new Model();
  const stone = C.stone;
  // Pillars, back wall, lintel and a hearthstone: the opening is real, so the fire sits in it.
  for (const s of [-1, 1]) m.box([0.5, 1.2, 0.74], stone, [s * 0.75, 0, 0], 0.015);
  m.box([1.0, 0.45, 0.74], stone, [0, 0.75, 0], 0.015);
  m.box([1.0, 0.77, 0.06], "#1c1620", [0, 0.02, -0.3], 0.003);
  for (const s of [-1, 1]) m.box([0.03, 0.77, 0.6], "#2a2030", [s * 0.495, 0.02, 0], 0.003);
  m.box([1.0, 0.03, 0.6], "#2a2030", [0, 0.02, 0.0], 0.003);
  m.box([1.3, 0.06, 0.18], C.stoneLight, [0, 0, 0.42], 0.01);
  // Stone courses on the face.
  for (const y of [0.3, 0.6, 0.9, 1.15])
    for (const s of [-1, 1]) m.box([0.5, 0.018, 0.012], C.stoneDark, [s * 0.75, y, 0.372], 0.003);
  m.box([1.0, 0.018, 0.012], C.stoneDark, [0, 0.95, 0.372], 0.003);
  for (const [x, y] of [
    [-0.85, 0.15],
    [-0.62, 0.45],
    [0.62, 0.15],
    [0.85, 0.45],
    [-0.3, 0.84],
    [0.3, 1.08],
  ] as const)
    m.box([0.012, 0.28, 0.012], C.stoneDark, [x, y, 0.372], 0.003);
  // Mantel and chimney breast.
  m.box([2.0, 0.07, 0.86], WOOD_DARK, [0, 1.2, 0.02], 0.015);
  m.box([2.0, 0.025, 0.86], WOOD_LIGHT, [0, 1.27, 0.02], 0.008);
  m.box([1.5, 0.9, 0.56], stone, [0, 1.3, -0.08], 0.02);
  m.box([1.2, 0.4, 0.42], stone, [0, 2.2, -0.12], 0.02);
  for (const y of [1.55, 1.85, 2.15]) m.box([1.52, 0.016, 0.012], C.stoneDark, [0, y, 0.205], 0.003);
  // Logs, and embers.
  m.cyl(0.065, 0.62, C.trunk, [0.31, 0.1, 0.1], 0.065, 8).rotation.z = Math.PI / 2;
  m.cyl(0.055, 0.5, TRUNK_DARK, [0.25, 0.19, 0.06], 0.055, 8).rotation.z = Math.PI / 2 + 0.1;
  m.cyl(0.05, 0.55, C.trunk, [0.2, 0.08, -0.12], 0.05, 8).rotation.z = Math.PI / 2 - 0.05;
  m.box([0.9, 0.02, 0.35], glow("#c0412f"), [0, 0.05, 0.05], 0.004);
  // The flames: nested cones that sway and stretch, like the 2D sprite's two frames.
  const reds = ["#c0412f", "#ee7a2c", "#f8c43a", "#fff0a8"];
  const flames: { mesh: THREE.Mesh; base: number; speed: number; x: number }[] = [];
  const tongues: [number, number, number, number][] = [
    [-0.3, 0.14, 0, 0],
    [-0.1, 0.3, 0, 0],
    [0.12, 0.34, 0, 0],
    [0.3, 0.2, 0, 0],
    [0, 0.4, -0.04, 0],
  ];
  for (const [i, [x, h, z]] of tongues.entries()) {
    for (const [layer, col] of reds.entries()) {
      const k = 1 - layer * 0.2;
      const f = m.cyl(0.12 * k, (h + 0.12) * k, glow(col), [x, 0.07, 0.04 + z + layer * 0.004], 0.003, 9);
      flames.push({ mesh: f, base: 1, speed: 6 + i * 1.7 + layer, x });
    }
  }
  ticks.push((t) => {
    for (const [i, f] of flames.entries()) {
      const w = Math.sin(t * f.speed + i);
      f.mesh.scale.set(1 + 0.12 * Math.cos(t * f.speed * 0.7 + i), 1 + 0.22 * w, 1);
      f.mesh.position.x = f.x + Math.sin(t * 3 + i) * 0.025;
      f.mesh.rotation.z = Math.sin(t * 4 + i) * 0.08;
    }
  });
  // Night: the fire's own light, a warm pool on the floor, and a halo in the opening.
  const fire = flame(m, [0, 0.5, 0.55], "#ff9a3c", 3.4, 8, 1);
  const pool = new THREE.Mesh(
    new THREE.PlaneGeometry(3.4, 2.4),
    new THREE.MeshBasicMaterial({
      map: haloTexture(),
      color: "#ff8a3a",
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      opacity: 0.2,
    }),
  );
  pool.rotation.x = -Math.PI / 2;
  pool.position.set(0, 0.02, 1.1);
  m.add(pool);
  halo(m, [0, 0.4, 0.3], 1.9, "#ff9a3c", 2);
  // Candlesticks on the mantel.
  for (const s of [-1, 1]) candle(m, [s * 0.78, 1.28, 0.08], 12 + s);
  ticks.push((t) => {
    lit = fire.intensity > 0;
    (pool.material as THREE.MeshBasicMaterial).opacity = (lit ? 0.5 : 0.14) * (0.9 + 0.1 * Math.sin(t * 7));
  });
  return m;
};

/** The hearth set into the north wall: its back (and the chimney breast) sits flush on the wall, and the flue goes up to the ceiling. */
const hearth = (): Model => {
  const m = new Model();
  const inner = hearthInner();
  inner.position.z = -0.14;
  m.add(inner);
  return m;
};

// ——— Sconce ———

/** A brass sconce with a candle, its back on the wall at z = 0 and its foot at y = 0; place it with `at`. */
function sconce(): Model {
  const m = new Model();
  m.box([0.1, 0.2, 0.025], BRASS_DARK, [0, 0, 0.013], 0.008);
  m.box([0.04, 0.04, 0.12], BRASS, [0, 0.1, 0.07], 0.01);
  m.cyl(0.07, 0.025, BRASS, [0, 0.07, 0.13], 0.08, 10);
  m.cyl(0.03, 0.14, "#f4ead2", [0, 0.095, 0.13], 0.03, 8);
  littleFlame(m, [0, 0.29, 0.13], 0.035, 5);
  flame(m, [0, 0.35, 0.3], "#ffce78", 1.2, 4.2, 6);
  halo(m, [0, 0.3, 0.13], 0.8, "#ffce78", 6);
  return m;
}

// ——— The stage ———

const NOTE_TEX = ["♪", "♫"].map((glyph) =>
  canvasTexture(
    32,
    32,
    (g) => {
      g.font = `bold 26px ${FONT}`;
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.fillStyle = "#2b2433";
      g.fillText(glyph, 17, 18);
      g.fillStyle = "#fff6d6";
      g.fillText(glyph, 16, 16);
    },
    true,
  ),
);

/** `♪` and `♫` rising from the stage, each on its own slow loop, once the lights are on (or `forced`). */
function driftingNotes(m: Model, w: number, d: number, count = 7, on: () => boolean = isLit): void {
  const rnd = seeded(33);
  const notes = Array.from({ length: count }, (_, i) => {
    const mat = new THREE.MeshBasicMaterial({
      map: NOTE_TEX[i % 3 ? 0 : 1]!,
      transparent: true,
      depthWrite: false,
      opacity: 0,
    });
    const s = billboard(mat);
    s.scale.setScalar(0.34);
    m.add(s);
    return { s, mat, x: (rnd() - 0.5) * (w - 0.8), z: (rnd() - 0.5) * (d - 0.4), phase: i / count };
  });
  let amount = 0;
  ticks.push((time) => {
    amount += ((on() ? 1 : 0) - amount) * 0.05;
    for (const [i, n] of notes.entries()) {
      const t = (time / 3.2 + n.phase) % 1;
      n.s.position.set(n.x + Math.sin(t * 6 + i) * 0.15, 0.7 + t * 1.5, n.z);
      n.mat.opacity = Math.sin(t * Math.PI) * amount * 0.95;
    }
  });
}

/** One board of the stage, a tile: raised, darker than the floor. */
const stageTile = (): Model => {
  const m = new Model();
  m.box([1, 0.14, 1], STAGE_BOARDS, [0, 0, 0], 0.004);
  return m;
};

/** The stage `w`×`d`: boards with a lit lip, a lute on a stand, a mic and footlights; notes drift up after dark. */
function stage(w: number, d: number): () => Model {
  return () => {
    const m = new Model();
    // The boards and front trim fit between the end caps instead of sharing their exposed faces.
    m.box([w - 0.1, 0.14, d - 0.02], STAGE_BOARDS, [0, 0, 0], 0.01);
    m.box([w - 0.1, 0.05, 0.1], WOOD_LIGHT, [0, 0.12, d / 2 - 0.05], 0.01);
    m.box([w - 0.1, 0.04, 0.12], TRUNK_DARK, [0, 0, d / 2 - 0.06], 0.004);
    for (const s of [-1, 1]) m.box([0.05, 0.14, d], TRUNK_DARK, [s * (w / 2 - 0.025), 0, 0], 0.004);
    // A lute leaning on a stand and a mic (the singer's stool is its own seat, `tavern:stage-stool`).
    const lute = m.part([-w / 2 + 0.9, 0.14, -d / 4], 0.3);
    lute.ball(0.17, WOOD_LIGHT, [0, 0.4, 0], [1, 1.1, 0.5], 12);
    lute.box([0.05, 0.55, 0.04], WOOD_DARK, [0, 0.55, -0.01], 0.01);
    lute.ball(0.045, INK, [0, 0.4, 0.07], [1, 1, 0.4], 8);
    for (const s of [-1, 1])
      lute.cyl(0.015, 0.4, WOOD_DARK, [s * 0.08, 0, -0.05], 0.012, 6).rotation.z = s * -0.25;
    m.cyl(0.07, 0.02, INK, [0.2, 0.14, d / 4], 0.07, 10);
    m.cyl(0.012, 1.2, C.metal, [0.2, 0.15, d / 4], 0.012, 6);
    m.ball(0.04, "#2b2433", [0.2, 1.38, d / 4]);
    // Footlights along the lip.
    for (const x of [-w / 2 + 0.6, w / 2 - 0.6]) {
      m.cyl(0.05, 0.06, BRASS_DARK, [x, 0.14, d / 2 - 0.13], 0.06, 8);
      m.ball(0.045, glow("#ffe0a0"), [x, 0.23, d / 2 - 0.13]);
      halo(m, [x, 0.25, d / 2 - 0.13], 0.7, "#ffe0a0", x);
    }
    light(m, [0, 0.8, d / 2 - 0.2], "#ffd890", 1.4, 5);
    const notes = m.part([0, 0.14, 0]);
    driftingNotes(notes, w, d, 7, bandPlaying);
    return m;
  };
}

// ——— Barrel ———

const barrel = (): Model => {
  const m = new Model();
  const staves = plank(WOOD, 2, 0.5);
  m.cyl(0.33, 0.74, staves, [0, 0, 0], 0.33, 16);
  // The belly: a squashed ball slightly wider than the ends.
  m.ball(0.38, staves, [0, 0.37, 0], [1, 1.0, 1], 16);
  for (const y of [0.1, 0.26, 0.48, 0.64]) {
    const k = 1 - 0.1 * Math.abs(y - 0.37) * 2.2;
    m.cyl(0.372 * k + 0.004, 0.035, C.metal, [0, y - 0.0175, 0], 0.372 * k + 0.004, 16);
  }
  m.cyl(0.3, 0.012, WOOD_LIGHT, [0, 0.738, 0], 0.3, 16);
  // A spigot on the front.
  m.cyl(0.02, 0.1, BRASS, [0, 0.18, 0.38], 0.02, 6).rotation.x = Math.PI / 2;
  m.box([0.05, 0.02, 0.03], BRASS_DARK, [0, 0.27, 0.43]);
  return m;
};

// ——— The jukebox ———

export interface JukeboxModel extends Model {
  /** A track is on: the record spins, the bulbs chase, notes rise and the window lights up. */
  playing: boolean;
  /** Shown on the window while playing. */
  track: string;
}

const BULBS = ["#f2a0b8", "#72bf52", "#f8c43a", "#8fe3ff", "#c9b6ff"];

const jukebox = (): Model => {
  const m = new Model() as JukeboxModel;
  m.playing = false;
  m.track = "";
  const body = C.rug;
  m.box([0.84, 1.15, 0.52], body, [0, 0.06, 0], 0.03);
  m.ball(0.42, body, [0, 1.2, 0], [1, 0.82, 0.62], 20);
  m.box([0.9, 0.06, 0.58], INK, [0, 0, 0], 0.012);
  m.box([0.86, 0.02, 0.54], C.rugLight, [0, 1.0, 0], 0.005);
  m.box([0.04, 1.0, 0.54], C.rugDark, [-0.44, 0.1, 0], 0.01);
  m.box([0.04, 1.0, 0.54], C.rugDark, [0.44, 0.1, 0], 0.01);
  // The lit window with a record in it.
  const window = canvasTexture(52, 40, () => {});
  const g = (window.image as HTMLCanvasElement).getContext("2d")!;
  const glowMat = glow("#fff", window);
  m.box([0.66, 0.56, 0.04], INK, [0, 0.64, 0.26], 0.01);
  m.plane(0.6, 0.5, glowMat, [0, 0.92, 0.285]);
  // Speaker grille and a brass coin slot.
  m.box([0.66, 0.34, 0.03], INK, [0, 0.2, 0.26], 0.008);
  for (let i = 0; i < 8; i++) m.box([0.02, 0.26, 0.012], BRASS_DARK, [-0.28 + i * 0.08, 0.24, 0.28], 0.003);
  m.box([0.1, 0.03, 0.02], BRASS_LIGHT, [0, 0.58, 0.29], 0.004);
  // A string of bulbs round the arch.
  const bulbs = Array.from({ length: 9 }, (_, i) => {
    const a = Math.PI * (0.08 + (i / 8) * 0.84);
    const mat = glow(BULBS[i % BULBS.length]!);
    const b = m.ball(0.03, mat, [Math.cos(a) * 0.38, 1.17 + Math.sin(a) * 0.3, 0.2], [1, 1, 1], 8);
    return { b, mat, color: BULBS[i % BULBS.length]! };
  });
  const draw = (t: number, on: boolean) => {
    g.fillStyle = on ? "#3a2a5a" : "#262036";
    g.fillRect(0, 0, 52, 40);
    // The record, grooves, label; the spin shows as a sweeping highlight.
    g.fillStyle = INK;
    g.beginPath();
    g.arc(26, 19, 15, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = on ? "#4c3a70" : "#322a44";
    g.lineWidth = 1;
    for (const r of [6, 9, 12]) {
      g.beginPath();
      g.arc(26, 19, r, 0, Math.PI * 2);
      g.stroke();
    }
    const a = on ? t * 6 : 0.8;
    g.strokeStyle = on ? "#a89ad0" : "#6a5c8a";
    g.lineWidth = 2;
    g.beginPath();
    g.arc(26, 19, 11, a, a + 0.9);
    g.stroke();
    g.fillStyle = on ? "#f8c43a" : "#9c8240";
    g.beginPath();
    g.arc(26, 19, 4, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = INK;
    g.fillRect(25, 18, 2, 2);
    // Corner lamps in the window, as the 2D art has.
    for (const [x, y, c] of [
      [3, 3, "#f2a0b8"],
      [47, 3, "#72bf52"],
      [3, 35, "#72bf52"],
      [47, 35, "#f2a0b8"],
    ] as const) {
      g.fillStyle = on ? c : tint(c, -0.55);
      g.fillRect(x, y, 3, 3);
    }
    if (on && m.track) {
      g.fillStyle = "rgba(20,12,36,0.7)";
      g.fillRect(0, 31, 52, 9);
      text(g, `♪ ${m.track}`.slice(0, 11), 2, 32, 7, "#ffe9a8");
    }
    window.needsUpdate = true;
  };
  let last = -1;
  let wasOn: boolean | null = null;
  const playLight = new THREE.PointLight("#e8a0ff", 0, 4, 1.6);
  playLight.position.set(0, 0.9, 0.7);
  m.add(playLight);
  halo(m, [0, 0.95, 0.4], 1.4, "#c9a0ff", 9).visible = true;
  ticks.push((t) => {
    const on = m.playing;
    const frame = Math.floor(t * 12);
    if (on === wasOn && (!on || frame === last)) return;
    wasOn = on;
    last = frame;
    draw(t, on);
    glowMat.color.set(on ? "#ffffff" : "#8a8494");
  });
  ticks.push((t) => {
    playLight.intensity = m.playing ? 1.5 + 0.3 * Math.sin(t * 8) : 0;
    for (const [i, b] of bulbs.entries()) {
      const chase = m.playing ? (Math.floor(t * 6) + i) % 3 === 0 : false;
      b.mat.color.set(m.playing ? (chase ? "#ffffff" : b.color) : tint(b.color, -0.5));
      b.b.scale.setScalar(chase ? 1.35 : 1);
    }
  });
  driftingNotes(
    (() => {
      const n = m.part([0, 0.9, 0.3]);
      return n;
    })(),
    0.9,
    0.6,
    3,
    () => m.playing,
  );
  return m;
};

// ——— Boards ———

/** Draws the bar tab: BAR TAB, five rows of `[name, hours]` best first, a chalk crown on `crown`. */
export function barTabDraw(
  rows: readonly TabRow[],
  crown = -1,
): (g: CanvasRenderingContext2D, w: number, h: number) => void {
  return (g, w, h) => {
    g.fillStyle = "#2f3b3a";
    g.fillRect(0, 0, w, h);
    g.fillStyle = "#3a4a42";
    const rnd = seeded(8);
    for (let i = 0; i < 14; i++) g.fillRect(rnd() * w, rnd() * h, 24 + rnd() * 30, 3);
    const u = h / 100;
    text(g, "BAR TAB", w * 0.04, u * 5, u * 15, CHALK);
    g.fillStyle = CHALK_DIM;
    g.fillRect(w * 0.04, u * 24, w * 0.92, Math.max(1, u * 1.2));
    for (let i = 0; i < 5; i++) {
      const y = u * (28 + i * 14.5);
      const row = rows[i];
      const [name, hours] = row ?? ["---", ""];
      if (i === crown) {
        g.fillStyle = CHALK;
        const cx = w * 0.05;
        const s = u * 1.4;
        g.beginPath();
        g.moveTo(cx, y + 9 * s);
        g.lineTo(cx, y + 3 * s);
        g.lineTo(cx + 3 * s, y + 6 * s);
        g.lineTo(cx + 5 * s, y + 2 * s);
        g.lineTo(cx + 7 * s, y + 6 * s);
        g.lineTo(cx + 10 * s, y + 3 * s);
        g.lineTo(cx + 10 * s, y + 9 * s);
        g.closePath();
        g.fill();
      }
      text(g, name, w * 0.14, y, u * 11, row ? CHALK : CHALK_DIM);
      text(g, hours, w * 0.96, y, u * 11, CHALK_DIM, true, "right");
    }
  };
}

const barTab = (): Model => {
  const p = panel(3.7, 1.35, barTabDraw([]), { frame: WOOD_DARK, lift: 0.95, px: 64, smooth: true });
  return onWall(p, new Model());
};

/** Replaces the bar tab (a `tile:J` model) with these rows; `crown` is the row of last week's winner. */
export function setBarTab(model: Model, rows: readonly TabRow[], crown = -1): void {
  (model as Panel).redraw(barTabDraw(rows, crown));
}

/** Draws a regular's plaque: a brass board with a 3-letter name a row, best first; an empty one is a dash. */
export function plaqueDraw(
  names: readonly string[],
): (g: CanvasRenderingContext2D, w: number, h: number) => void {
  return (g, w, h) => {
    g.fillStyle = BRASS;
    g.fillRect(0, 0, w, h);
    g.fillStyle = BRASS_LIGHT;
    g.fillRect(0, 0, w, Math.max(2, h * 0.04));
    const row = h / names.length;
    for (const [i, n] of names.entries())
      text(g, (n || "---").slice(0, 3), w / 2, i * row + row * 0.12, row * 0.72, BRASS_DARK, true, "center");
  };
}

const plaque = (rows: number) => (): Model => {
  const m = new Model();
  m.box([0.12, 0.9, 0.1], WOOD_DARK, [0, 0, -0.1], 0.015);
  m.box([0.14, 0.04, 0.14], INK, [0, 0, -0.1], 0.01);
  const p = panel(0.78, 0.18 + rows * 0.2, plaqueDraw(Array(rows).fill("")), {
    frame: WOOD_DARK,
    lift: 0.7,
    px: 64,
    smooth: true,
  });
  p.position.z = -0.04;
  m.add(p);
  (m as Panel).redraw = p.redraw;
  return m;
};

/** Writes names on a plaque (`tile:P`): one string per row. */
export function setPlaque(model: Model, names: readonly string[]): void {
  (model as Panel).redraw(plaqueDraw(names));
}

/** A corkboard `W` wide with notes pinned to it and a plank over it saying `label`. Notes are `[x, y, w, colour]` on a 28 by 16 grid. */
const corkBoard = (
  W: number,
  label: string,
  notes: [number, number, number, string][],
  signW: number,
  /** Pins as little balls (a few hundred triangles); false paints them on the notes, for the Tavern's triangle budget. */
  ballPins = true,
): Model => {
  const m = new Model();
  const H = 1.0;
  const lift = 0.85;
  const cork = canvasTexture(96, 56, (g) => {
    g.fillStyle = "#c89460";
    g.fillRect(0, 0, 96, 56);
    const rnd = seeded(12);
    g.fillStyle = "#a8764a";
    for (let i = 0; i < 90; i++) g.fillRect(Math.floor(rnd() * 96), Math.floor(rnd() * 56), 1, 1);
    g.fillStyle = "#dcab76";
    g.fillRect(0, 0, 96, 1);
  });
  const p = panel(W, H, (g, w, h) => g.drawImage(cork.image as HTMLCanvasElement, 0, 0, w, h), {
    frame: WOOD_DARK,
    lift,
    px: 40,
  });
  p.position.z = -0.46;
  m.add(p);
  // Notes: paper, a pin and a few scribbled lines each, as in the 2D art's six.
  const cy = lift + (H + 0.12) / 2;
  for (const [i, [x, y, w, color]] of notes.entries()) {
    const nw = (w / 28) * W;
    const nh = (6 / 16) * H;
    const tex = canvasTexture(w * 4, 24, (g) => {
      g.fillStyle = color;
      g.fillRect(0, 0, w * 4, 24);
      g.fillStyle = C.stoneDark;
      const rnd = seeded(i + 40);
      for (const ly of [6, 11, 16]) g.fillRect(3, ly, Math.floor((w * 4 - 8) * (0.55 + rnd() * 0.45)), 2);
      if (!ballPins) {
        g.fillStyle = C.rug;
        g.fillRect(w * 2 - 2, 1, 4, 4);
      }
    });
    const note = m.plane(nw, nh, painted(tex), [
      ((x + w / 2 - 14) / 28) * W,
      cy + ((8 - (y + 3)) / 16) * H,
      -0.46 + 0.056,
    ]);
    note.rotation.z = (((i * 37) % 11) - 5) * 0.012;
    if (ballPins)
      m.ball(0.022, C.rug, [note.position.x, note.position.y + nh / 2 - 0.04, -0.46 + 0.07], [1, 1, 0.6], 8);
  }
  // A plank over it: QUESTS.
  const sign = panel(
    signW,
    0.2,
    (g, w, h) => {
      g.fillStyle = WOOD;
      g.fillRect(0, 0, w, h);
      text(g, label, w / 2, h * 0.14, h * 0.72, PAPER, true, "center");
    },
    { frame: INK, lift: lift + H + 0.18, px: 64, smooth: true },
  );
  sign.position.z = -0.46;
  m.add(sign);
  return m;
};

const questBoard = (): Model =>
  corkBoard(
    1.8,
    "QUESTS",
    [
      [4, 4, 7, PAPER],
      [13, 3, 6, "#f8e3a3"],
      [21, 5, 7, PAPER],
      [8, 11, 7, "#f8e3a3"],
      [18, 11, 6, PAPER],
      [25, 11, 4, "#f2a0b8"],
    ],
    0.8,
  );

/** The request pile (`tile:?`, one tile): the same cork with fewer, bigger notes under REQUESTS. */
const requestBoard = (): Model =>
  corkBoard(
    0.9,
    "REQUESTS",
    [
      [2, 3, 12, PAPER],
      [15, 5, 11, "#f8e3a3"],
      [4, 10, 11, "#9fd3ef"],
      [17, 11, 9, "#f2a0b8"],
    ],
    0.88,
    false,
  );

/** The Hall of Fame wall, two tiles: a crest panel and a scroll of names, in gold frames. */
const hallOfFame = (): Model => {
  const m = new Model();
  const dark = (g: CanvasRenderingContext2D, w: number, h: number) => {
    g.fillStyle = "#3d2c3a";
    g.fillRect(0, 0, w, h);
    g.fillStyle = "#4d3a4a";
    g.fillRect(0, 0, w, Math.max(2, h * 0.03));
  };
  const crest = panel(
    0.82,
    1.2,
    (g, w, h) => {
      dark(g, w, h);
      g.fillStyle = INK;
      g.beginPath();
      g.moveTo(w * 0.15, h * 0.2);
      g.lineTo(w * 0.85, h * 0.2);
      g.lineTo(w * 0.85, h * 0.6);
      g.quadraticCurveTo(w * 0.85, h * 0.78, w / 2, h * 0.86);
      g.quadraticCurveTo(w * 0.15, h * 0.78, w * 0.15, h * 0.6);
      g.closePath();
      g.fill();
      g.fillStyle = C.rug;
      g.beginPath();
      g.moveTo(w * 0.22, h * 0.25);
      g.lineTo(w * 0.78, h * 0.25);
      g.lineTo(w * 0.78, h * 0.6);
      g.quadraticCurveTo(w * 0.78, h * 0.74, w / 2, h * 0.8);
      g.quadraticCurveTo(w * 0.22, h * 0.74, w * 0.22, h * 0.6);
      g.closePath();
      g.fill();
      // The star.
      g.fillStyle = BRASS_LIGHT;
      g.beginPath();
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + (i * Math.PI) / 5;
        const r = (i % 2 ? 0.1 : 0.2) * w;
        g.lineTo(w / 2 + Math.cos(a) * r, h * 0.5 + Math.sin(a) * r);
      }
      g.fill();
    },
    { frame: BRASS, lift: 0.7, px: 64, smooth: true },
  );
  crest.position.set(-0.5, 0, -0.46);
  m.add(crest);
  const scroll = panel(
    0.82,
    1.2,
    (g, w, h) => {
      dark(g, w, h);
      g.fillStyle = PAPER;
      g.fillRect(w * 0.14, h * 0.1, w * 0.72, h * 0.8);
      g.fillStyle = C.stoneLight;
      g.fillRect(w * 0.14, h * 0.1, w * 0.72, h * 0.03);
      g.fillStyle = C.stoneDark;
      for (let i = 0; i < 8; i++)
        g.fillRect(w * 0.22, h * (0.2 + i * 0.09), w * (0.3 + ((i * 3) % 3) * 0.1), h * 0.02);
    },
    { frame: BRASS, lift: 0.7, px: 64, smooth: true },
  );
  scroll.position.set(0.5, 0, -0.46);
  m.add(scroll);
  return m;
};

/** What the open-offices board paints: the names of the offices left open (null until they are known). */
export type OfficeBoardRows = readonly string[] | null;

/** Draws the open-offices sign: a little house with a lit window, and under it how many are open and the first few names. */
export function officeBoardDraw(
  open: OfficeBoardRows,
): (g: CanvasRenderingContext2D, w: number, h: number) => void {
  return (g, w, h) => {
    g.fillStyle = "#c89460";
    g.fillRect(0, 0, w, h);
    g.fillStyle = "#dcab76";
    g.fillRect(0, 0, w, h * 0.04);
    g.fillStyle = C.rug;
    g.beginPath();
    g.moveTo(w * 0.28, h * 0.3);
    g.lineTo(w / 2, h * 0.1);
    g.lineTo(w * 0.72, h * 0.3);
    g.closePath();
    g.fill();
    g.fillStyle = PAPER;
    g.fillRect(w * 0.34, h * 0.3, w * 0.32, h * 0.16);
    g.fillStyle = WOOD_DARK;
    g.fillRect(w * 0.4, h * 0.36, w * 0.08, h * 0.1);
    g.fillStyle = open && open.length > 0 ? "#f8c43a" : "#8a7a60";
    g.fillRect(w * 0.54, h * 0.34, w * 0.07, h * 0.07);
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillStyle = INK;
    g.font = `800 ${Math.round(h * 0.085)}px system-ui, sans-serif`;
    g.fillText(
      open === null ? "OPEN OFFICES" : open.length === 0 ? "NONE OPEN" : `${open.length} OPEN`,
      w / 2,
      h * 0.55,
    );
    g.font = `600 ${Math.round(h * 0.075)}px system-ui, sans-serif`;
    for (const [i, name] of (open ?? []).slice(0, 3).entries())
      g.fillText(name.length > 12 ? `${name.slice(0, 11)}…` : name, w / 2, h * (0.67 + i * 0.1));
  };
}

/** The open-offices board: a small sign with a little house and a lit window, and the offices open now. */
const officeBoard = (): Model => {
  const m = new Model();
  const p = panel(0.62, 0.78, officeBoardDraw(null), { frame: INK, lift: 0.85, px: 150 });
  p.position.z = -0.46;
  m.add(p);
  (m as Panel).redraw = p.redraw;
  // The window is lit from inside.
  m.plane(0.1, 0.1, glow("#f8c43a"), [0.1, 0.85 + 0.06 + 0.78 * 0.5 - 0.1 + 0.02, -0.46 + 0.05]);
  light(m, [0, 1.3, -0.2], "#f8c43a", 0.5, 2.5);
  return m;
};

/** Paints the offices that are open on the board (`tile:w`). */
export function setOfficeBoard(model: Model, open: OfficeBoardRows): void {
  (model as Panel).redraw(officeBoardDraw(open));
}

// ——— The easel ———

function specialToday(): string {
  const day = aarhusDay(new Date());
  return SPECIALS[(day * STRIDE) % SPECIALS.length]!;
}

/** Draws the A-frame board: TODAY'S SPECIAL, a yellow underline, the special wrapped, a pink heart. */
export function specialDraw(special: string): (g: CanvasRenderingContext2D, w: number, h: number) => void {
  return (g, w, h) => {
    g.fillStyle = "#2f3d36";
    g.fillRect(0, 0, w, h);
    g.fillStyle = "#3a4a42";
    const rnd = seeded(2);
    for (let i = 0; i < 8; i++) g.fillRect(rnd() * w, rnd() * h, 18, 4);
    text(g, "TODAY'S SPECIAL", w / 2, h * 0.06, h * 0.075, CHALK, true, "center");
    g.fillStyle = C.flowerYellow;
    g.fillRect(w * 0.12, h * 0.17, w * 0.76, Math.max(2, h * 0.012));
    g.font = `bold ${Math.round(h * 0.078)}px ${FONT}`;
    // Wrap it by words.
    const lines: string[] = [];
    let line = "";
    for (const word of special.split(" ")) {
      const next = line ? `${line} ${word}` : word;
      if (g.measureText(next).width > w * 0.84 && line) {
        lines.push(line);
        line = word;
      } else line = next;
    }
    lines.push(line);
    for (const [i, l] of lines.slice(0, 6).entries())
      text(g, l, w / 2, h * 0.24 + i * h * 0.095, h * 0.078, i ? CHALK_DIM : CHALK, true, "center");
    // A doodle in pink chalk: a heart.
    const hx = w * 0.82;
    const hy = h * 0.86;
    g.fillStyle = "#f2a0b8";
    g.beginPath();
    g.moveTo(hx, hy + h * 0.04);
    g.bezierCurveTo(hx - h * 0.07, hy - h * 0.01, hx - h * 0.04, hy - h * 0.07, hx, hy - h * 0.02);
    g.bezierCurveTo(hx + h * 0.04, hy - h * 0.07, hx + h * 0.07, hy - h * 0.01, hx, hy + h * 0.04);
    g.fill();
  };
}

const easel = (): Model => {
  const m = new Model();
  const tilt = 0.2;
  const front = m.part([0, 0, 0.06], 0);
  front.rotation.x = -tilt;
  const board = panel(0.74, 1.0, specialDraw(specialToday()), {
    frame: WOOD,
    lift: 0.25,
    px: 100,
    smooth: true,
  });
  front.add(board);
  (m as Panel).redraw = board.redraw;
  // The back leg and a pair of front feet, splayed; chalk on the tray.
  const back = m.box([0.05, 1.45, 0.04], WOOD_DARK, [0, 0, -0.34], 0.01);
  back.rotation.x = 0.28;
  m.box([0.9, 0.05, 0.1], WOOD_DARK, [0, 0.2, 0.16], 0.01);
  for (const s of [-1, 1])
    m.box([0.05, 0.45, 0.05], WOOD_DARK, [s * 0.4, 0, 0.1], 0.01).rotation.z = s * 0.06;
  m.box([0.1, 0.02, 0.02], CHALK, [0.2, 0.245, 0.2], 0.005);
  m.box([0.14, 0.04, 0.04], C.metalLight, [0, 1.46, -0.08], 0.01);
  return m;
};

/** Writes the day's special on the easel (`tile:K`). */
export function setSpecial(model: Model, special: string): void {
  (model as Panel).redraw(specialDraw(special));
}

// ——— The world clocks ———

/** The hands on the world clocks (SF, New York, Copenhagen) and whether the launch window is open. */
export interface ClocksShown {
  hands: readonly { hour: number; minute: number }[];
  lit: boolean;
}

export interface ClocksModel extends Model {
  /** Sets the hands, SF's warm face and its lamp. */
  show: (s: ClocksShown) => void;
}

const CLOCK_CITIES = ["SF", "NEW YORK", "COPENHAGEN"];
const LAMP_ON = "#ff6a4a";
const LAMP_OFF = "#6b2a2a";

/** Draws the clocks' board: three brass-rimmed dials in a row, each with its city under it. */
export function clocksDraw({
  hands,
  lit,
}: ClocksShown): (g: CanvasRenderingContext2D, w: number, h: number) => void {
  return (g, w, h) => {
    g.fillStyle = "#4b3326";
    g.fillRect(0, 0, w, h);
    g.fillStyle = "#5b4030";
    g.fillRect(0, 0, w, Math.max(2, h * 0.04));
    const r = h * 0.36;
    const cy = h * 0.42;
    for (const [i, city] of CLOCK_CITIES.entries()) {
      const cx = (w * (i * 2 + 1)) / 6;
      g.fillStyle = BRASS;
      g.beginPath();
      g.arc(cx, cy, r, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = i === 0 && lit ? BRASS_LIGHT : PAPER;
      g.beginPath();
      g.arc(cx, cy, r * 0.84, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = C.stoneDark;
      for (let k = 0; k < 12; k++) {
        const a = (k / 12) * Math.PI * 2;
        const s = k % 3 === 0 ? 2.4 : 1.4;
        g.fillRect(cx + Math.sin(a) * r * 0.7 - s / 2, cy - Math.cos(a) * r * 0.7 - s / 2, s, s);
      }
      const { hour, minute } = hands[i] ?? { hour: 0, minute: 0 };
      const hand = (turns: number, len: number, width: number, color: string) => {
        const a = turns * Math.PI * 2;
        g.strokeStyle = color;
        g.lineWidth = width;
        g.lineCap = "round";
        g.beginPath();
        g.moveTo(cx, cy);
        g.lineTo(cx + Math.sin(a) * len, cy - Math.cos(a) * len);
        g.stroke();
      };
      hand(((hour % 12) + minute / 60) / 12, r * 0.42, 3, C.rug);
      hand(minute / 60, r * 0.64, 2, INK);
      g.fillStyle = INK;
      g.beginPath();
      g.arc(cx, cy, 2, 0, Math.PI * 2);
      g.fill();
      text(g, city, cx, h * 0.84, h * 0.13, i === 0 && lit ? BRASS_LIGHT : PAPER, true, "center");
    }
  };
}

/** The world clocks (`tile:◷`, two tiles of the north wall by the hearth), and SF's lamp on a bracket over them. */
const worldClocks = (): Model => {
  const m = new Model() as ClocksModel;
  const W = 1.86;
  const p = panel(W, 0.56, clocksDraw({ hands: [], lit: false }), {
    frame: WOOD_DARK,
    lift: 1.8,
    px: 100,
    smooth: true,
  });
  p.position.z = -0.46;
  m.add(p);
  const x = -W / 3;
  m.box([0.03, 0.06, 0.08], BRASS_DARK, [x, 2.48, -0.42], 0.006);
  const lamp = glow(LAMP_OFF);
  m.ball(0.04, lamp, [x, 2.52, -0.36], [1, 1, 1], 8);
  const shine = halo(m, [x, 2.52, -0.3], 0.5, LAMP_ON, 4);
  shine.visible = false;
  m.show = (s) => {
    p.redraw(clocksDraw(s));
    lamp.color.set(s.lit ? LAMP_ON : LAMP_OFF);
    shine.visible = s.lit;
  };
  return m;
};

// ——— Stairs and the exit ———

/** The way out: a doorframe in the wall with a door ajar on warm daylight, and a red doormat on the floor. */
const exitDoor = (): Model => {
  const m = new Model();
  m.box([0.1, 2.1, 0.14], WOOD_DARK, [-0.46, 0, -0.42], 0.015);
  m.box([0.1, 2.1, 0.14], WOOD_DARK, [0.46, 0, -0.42], 0.015);
  m.box([1.02, 0.12, 0.14], WOOD_DARK, [0, 2.1, -0.42], 0.015);
  m.box([0.82, 2.0, 0.03], glow("#fff1c9"), [0, 0.02, -0.45], 0.002);
  halo(m, [0, 1.0, -0.2], 1.6, "#fff1c9", 7);
  exitPlate(m, "EXIT", "out", [0.78, 1.82, -0.345]);
  // The door leaf, opened inwards.
  const leaf = m.part([-0.41, 0, -0.38], 1.0);
  leaf.box([0.8, 2.0, 0.05], WOOD_DARK, [0.4, 0, 0], 0.012);
  for (const y of [0.18, 1.1]) leaf.box([0.58, 0.7, 0.02], WOOD, [0.4, y, 0.03], 0.012);
  leaf.ball(0.035, "#e9b73d", [0.7, 1.0, 0.06]);
  // The doormat: C.rug with a light border.
  m.box([0.8, 0.025, 0.5], C.rugLight, [0, 0, 0.1], 0.006);
  m.box([0.7, 0.03, 0.4], C.rug, [0, 0, 0.1], 0.006);
  return m;
};

// ——— The tip jar ———

export interface FountainModel extends Model {
  /** Throws a coin from the stools; it arcs into the jar on the bar and clinks. */
  toss: () => void;
  /** Throw a coin every few seconds by itself. */
  auto: boolean;
}

/** The tip jar on the bar (the indoor stand-in for the plaza's wishing fountain): coins land in it with a clink and a glint. */
const tipJar = (): Model => {
  const m = new Model() as FountainModel;
  m.auto = true;
  m.cyl(0.115, 0.3, glass("#cfe9f0", 0.5), [0, 0, 0], 0.105, 14);
  m.cyl(0.108, 0.02, BRASS_DARK, [0, 0.3, 0], 0.108, 14);
  m.cyl(0.095, 0.1, glow("#f5d14a"), [0, 0.02, 0], 0.095, 12);
  m.box([0.15, 0.07, 0.01], BRASS, [0, 0.14, 0.118], 0.004);
  const glint = halo(m, [0, 0.25, 0], 0.5, "#fff0a8", 5);
  const coinMat = glow("#f5d14a");
  const flights: { coin: THREE.Mesh; start: number; from: [number, number] }[] = [];
  let hit = -10;
  m.toss = () => {
    const coin = m.cyl(0.05, 0.012, coinMat, [0, 0, 0], 0.05, 10);
    flights.push({
      coin,
      start: performance.now() / 1000,
      from: [0.25 + Math.random() * 0.4, 0.8 + Math.random() * 0.3],
    });
  };
  let next = 3;
  ticks.push((t) => {
    if (m.auto && t > next) {
      next = t + 5 + Math.random() * 5;
      m.toss();
    }
    for (let i = flights.length - 1; i >= 0; i--) {
      const f = flights[i]!;
      const k = (t - f.start) / 0.8;
      if (k >= 1) {
        f.coin.removeFromParent();
        flights.splice(i, 1);
        hit = t;
        continue;
      }
      f.coin.position.set(
        f.from[0] * (1 - k),
        0.5 + (1 - k) * 0.35 + Math.sin(k * Math.PI) * 0.7,
        f.from[1] * (1 - k),
      );
      f.coin.rotation.set(k * 14, 0, k * 6);
    }
    // After a clink the jar glints for a moment.
    glint.visible = t - hit < 0.5;
    (glint.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 1 - (t - hit) * 2) * 0.9;
  });
  return m;
};

// ——— Door to the kitchen, coat stand, umbrella stand, pictures ———

/** The kitchen door behind the bar: a swing door in the north wall, a round porthole and a brass plate. */
const kitchenDoor = (): Model => {
  const m = new Model();
  m.box([0.1, 2.0, 0.12], WOOD_DARK, [-0.45, 0, -0.43], 0.015);
  m.box([0.1, 2.0, 0.12], WOOD_DARK, [0.45, 0, -0.43], 0.015);
  m.box([1.0, 0.1, 0.12], WOOD_DARK, [0, 2.0, -0.43], 0.015);
  for (const s of [-1, 1]) {
    m.box([0.4, 1.8, 0.04], plank(WOOD, 9, 0.5), [s * 0.2, 0.05, -0.4], 0.01);
    m.cyl(0.11, 0.02, glass("#8fe3ff", 0.7), [s * 0.2, 1.3, -0.37], 0.11, 12).rotation.x = Math.PI / 2;
  }
  m.box([0.5, 0.1, 0.02], BRASS, [0, 1.95 - 0.1, -0.36], 0.004);
  return m;
};

/** A coat stand: a pole on a foot with four hooks, a coat, a scarf and a cap. */
const coatStand = (): Model => {
  const m = new Model();
  m.cyl(0.2, 0.05, WOOD_DARK, [0, 0, 0], 0.2, 12);
  m.cyl(0.03, 1.7, WOOD_DARK, [0, 0.05, 0], 0.03, 8);
  for (const a of [0, 1, 2, 3]) {
    const arm = m.box(
      [0.04, 0.04, 0.26],
      BRASS_DARK,
      [Math.sin((a * Math.PI) / 2 + 0.7) * 0.12, 1.55, Math.cos((a * Math.PI) / 2 + 0.7) * 0.12],
      0.01,
    );
    arm.rotation.y = (a * Math.PI) / 2 + 0.7;
  }
  m.box([0.34, 0.8, 0.12], "#3d5a80", [0.1, 0.72, 0.14], 0.04);
  m.box([0.1, 0.5, 0.1], "#c4544b", [-0.14, 1.0, -0.12], 0.03);
  m.cyl(0.13, 0.08, "#58b36a", [0, 1.7, 0], 0.13, 10);
  return m;
};

/** An umbrella stand: a brass drum with three umbrellas in it. */
const umbrellaStand = (): Model => {
  const m = new Model();
  m.cyl(0.2, 0.6, BRASS_DARK, [0, 0, 0], 0.17, 14);
  m.cyl(0.2, 0.03, BRASS, [0, 0.6, 0], 0.2, 14);
  const cols = ["#c4544b", "#4f8fe0", "#2b2433"];
  for (const [i, c] of cols.entries()) {
    const u = m.part([(i - 1) * 0.07, 0.3, (i % 2) * 0.05 - 0.02]);
    u.rotation.z = (i - 1) * 0.12;
    u.cyl(0.012, 0.75, WOOD_DARK, [0, 0, 0], 0.012, 6);
    u.cyl(0.04, 0.22, c, [0, 0.58, 0], 0.012, 8);
  }
  return m;
};

/** A framed picture for a wall stretch (a harbour, a hop vine or a lone pint), hung on the north edge of its tile. */
const picture = (kind: number) => (): Model => {
  const m = new Model();
  const p = panel(
    0.8,
    0.6,
    (g, w, h) => {
      if (kind === 0) {
        const sky = g.createLinearGradient(0, 0, 0, h);
        sky.addColorStop(0, "#f6c98a");
        sky.addColorStop(0.6, "#ee8a5a");
        sky.addColorStop(1, "#3d4a7a");
        g.fillStyle = sky;
        g.fillRect(0, 0, w, h);
        g.fillStyle = "#2b3358";
        g.fillRect(0, h * 0.68, w, h * 0.32);
        g.fillStyle = "#1c1620";
        g.fillRect(w * 0.45, h * 0.5, w * 0.1, h * 0.18);
        g.beginPath();
        g.moveTo(w * 0.5, h * 0.2);
        g.lineTo(w * 0.68, h * 0.5);
        g.lineTo(w * 0.5, h * 0.5);
        g.fill();
      } else if (kind === 1) {
        g.fillStyle = "#d8c9a0";
        g.fillRect(0, 0, w, h);
        g.fillStyle = "#58b36a";
        for (let i = 0; i < 12; i++)
          g.fillRect(w * (0.1 + i * 0.07), h * 0.1 + ((i * 7) % 5) * h * 0.08, w * 0.05, h * 0.1);
        g.fillRect(w * 0.48, h * 0.05, w * 0.04, h * 0.9);
      } else {
        g.fillStyle = "#2f3d36";
        g.fillRect(0, 0, w, h);
        g.fillStyle = "#f5d14a";
        g.fillRect(w * 0.38, h * 0.3, w * 0.24, h * 0.5);
        g.fillStyle = "#fff";
        g.fillRect(w * 0.38, h * 0.2, w * 0.24, h * 0.12);
        g.fillStyle = PAPER;
        g.fillRect(w * 0.62, h * 0.4, w * 0.08, h * 0.25);
      }
    },
    { frame: WOOD_DARK, lift: 1.3, px: 64, smooth: true },
  );
  p.position.z = -0.46;
  m.add(p);
  return m;
};

// ——— The dorm ———

const BLANKETS = [
  "#6d7fc4",
  "#58b36a",
  "#e25d5d",
  "#f0b53c",
  "#9b6fd6",
  "#f28bb2",
  "#4f8fe0",
  "#c4544b",
  "#3f9a8c",
];
let bedCount = 0;

/** A dorm bed, head to -z: a timber frame, a pillow and a duvet in its own colour. */
const dormBed = (): Model => {
  const color = BLANKETS[bedCount++ % BLANKETS.length]!;
  const m = new Model();
  const [w, d] = [0.95, 1.85];
  m.box([w, 0.22, d], WOOD_DARK, [0, 0, 0], 0.03);
  m.box([w + 0.012, 0.75, 0.088], WOOD, [0, 0, -d / 2 + 0.036], 0.04);
  m.box([w + 0.012, 0.38, 0.078], WOOD, [0, 0, d / 2 - 0.031], 0.03);
  m.box([w - 0.06, 0.16, d - 0.14], C.white, [0, 0.2, 0.03], 0.05);
  m.box([0.62, 0.1, 0.32], C.pillow, [0, 0.35, -d / 2 + 0.3], 0.05);
  m.box([w - 0.02, 0.13, 1.15], color, [0, 0.35, 0.33], 0.05);
  m.box([w - 0.02, 0.14, 0.16], tint(color, 0.25), [0, 0.35, -0.24], 0.05);
  return m;
};

/** A runner rug along the dorm floor, `w` tiles long. */
const dormRug = (w: number) => (): Model => {
  const m = new Model();
  const tex = canvasTexture(w * 16, 16, (g) => {
    g.fillStyle = C.rugDark;
    g.fillRect(0, 0, w * 16, 16);
    g.fillStyle = C.rug;
    g.fillRect(1, 1, w * 16 - 2, 14);
    g.fillStyle = C.rugLight;
    g.fillRect(2, 2, w * 16 - 4, 12);
    g.fillStyle = C.rug;
    g.fillRect(3, 3, w * 16 - 6, 10);
    for (let i = 0; i < w; i++) {
      g.fillStyle = C.rugLight;
      g.fillRect(i * 16 + 7, 4, 2, 8);
      g.fillRect(i * 16 + 4, 7, 8, 2);
      g.fillStyle = C.rugDark;
      g.fillRect(i * 16 + 7, 7, 2, 2);
    }
  });
  m.box([w - 0.1, 0.025, 0.8], painted(tex), [0, 0, 0], 0.008);
  return m;
};

/** A long red runner under the barkeep's feet (the cell behind the bar is a rug, not a floor). */
const cellRug = dormRug;

// ——— Bent, the barkeep ———

export interface Barkeep {
  avatar: Avatar;
  root: THREE.Object3D;
  /** Call each frame instead of `avatar.update`: he polishes a mug between customers. */
  update: (dt: number, t: number) => void;
}

/** Bent the Barkeep: short hair, a white tee, denim overalls for an apron, and a mug in hand. */
export function makeBarkeep(): Barkeep {
  const look: Look = personLook({
    skin: SKINS[2]!,
    hair: HAIRS[3]!,
    style: 0,
    outfit: ["#f2f0ea", "#cfcac0"],
    pants: "#3f6fb0",
    hat: "none",
    beard: 1,
  });
  const avatar = new Avatar(look);
  const denim = "#3f6fb0";
  const b = avatar.body;
  // The apron: a bib over the chest and two straps over the shoulders, on the voxel torso (0.405 to 0.765 up).
  b.box([0.25, 0.22, 0.02], denim, [0, 0.55, 0.1], 0.008);
  for (const s of [-1, 1]) {
    b.box([0.04, 0.03, 0.2], denim, [s * 0.09, 0.755, 0], 0.006);
    b.box([0.04, 0.2, 0.02], denim, [s * 0.09, 0.66, 0.1], 0.006);
    b.box([0.03, 0.03, 0.01], "#f5c842", [s * 0.09, 0.62, 0.112], 0.004);
  }
  // The mug, in the right hand.
  const arms = avatar.arms;
  const hand = arms[1];
  hand.cyl(0.04, 0.09, glass("#f5d14a", 0.92), [0.0, -0.3, 0.08], 0.038, 10);
  hand.cyl(0.04, 0.02, C.white, [0.0, -0.22, 0.08], 0.04, 10);
  return {
    avatar,
    root: avatar.root,
    update(dt, t) {
      avatar.update(dt, t);
      // Polishing: the mug hand comes up and goes round.
      arms[1]!.rotation.x = -0.9 + Math.sin(t * 2.4) * 0.14;
      arms[1]!.rotation.z = -0.15 + Math.cos(t * 2.4) * 0.08;
    },
  };
}

// ——— The catalogue ———

const wide = (
  id: string,
  name: string,
  w: number,
  d: number,
  build: () => Model,
  extra: Partial<Asset> = {},
): Asset => ({
  id,
  name,
  price: 0,
  w,
  d,
  build,
  ...extra,
});

const CUSHION: V3 = [0, 0.43, 0.05];

export const TAVERN_ASSETS: readonly Asset[] = [
  wide("tile:a", "Tavern bar", 1, 1, () => barCounter(false)),
  wide("tile:y", "Beer tap", 1, 1, () => barCounter(true)),
  wide("tavern:back-bar", "Back-bar shelves", 7, 1, () => backBar(7)),
  wide("tile:k", "Tavern shelf", 1, 1, shelfUnit),
  // Seats: `seat.at` is where the sitter's hips go (model space, facing +z), `turn` adds to the way it faces.
  wide("tile:v", "Bar stool", 1, 1, barStoolRed, { seat: { at: [0, 0.66, 0], turn: 0 } }),
  wide("tavern:stage-stool", "Singer's stool", 1, 1, stageStool, { seat: { at: [0, 0.8, 0], turn: 0 } }),
  wide("tile:n", "Tavern table", 1, 1, tavernTable(1)),
  wide("tavern:table-long", "Long tavern table", 2, 1, tavernTable(2)),
  wide("tavern:chair", "Tavern chair", 1, 1, tavernChair, { seat: { at: [0, 0.46, 0.03], turn: 0 } }),
  wide("tavern:sofa-l", "Sofa seat (arm left)", 1, 1, seatUnit("sofa", true, false), {
    seat: { at: CUSHION, turn: 0 },
  }),
  wide("tavern:sofa-r", "Sofa seat (arm right)", 1, 1, seatUnit("sofa", false, true), {
    seat: { at: CUSHION, turn: 0 },
  }),
  wide("tavern:armchair", "Armchair", 1, 1, seatUnit("armchair", true, true), {
    seat: { at: CUSHION, turn: 0 },
  }),
  wide("tavern:booth-l", "Booth seat (end left)", 1, 1, seatUnit("booth", true, false), {
    seat: { at: CUSHION, turn: 0 },
  }),
  wide("tavern:booth-r", "Booth seat (end right)", 1, 1, seatUnit("booth", false, true), {
    seat: { at: CUSHION, turn: 0 },
  }),
  wide("tile:f", "Hearth", 2, 1, hearth),
  wide("tavern:sconce", "Wall sconce", 1, 1, () => {
    const m = new Model();
    m.add(sconce());
    m.children[0]!.position.set(0, 1.5, -0.5);
    return m;
  }),
  wide("tile:e", "Stage board", 1, 1, stageTile),
  wide("tavern:stage", "Stage", 5, 2, stage(5, 2)),
  wide("tile:h", "Barrel", 1, 1, barrel),
  wide("tile:z", "Jukebox", 1, 1, jukebox),
  wide("tile:J", "Bar tab", 4, 1, barTab),
  wide("tile:m", "Quest board", 2, 1, questBoard),
  wide("tile:?", "Request pile", 1, 1, requestBoard),
  wide("tile:◷", "World clocks", 2, 1, worldClocks),
  wide("tile:A", "Hall of Fame", 2, 1, hallOfFame),
  wide("tile:P", "Regulars' plaque", 1, 1, plaque(3)),
  wide("tavern:plaque-2", "Regulars' plaque (right)", 1, 1, plaque(2)),
  wide("tile:w", "Open offices board", 1, 1, officeBoard),
  wide("tile:K", "Daily special easel", 1, 1, easel),
  wide("tile:S", "Stairs down", 1, 1, () =>
    exitStairs("down", { wall: "#8a6a52", wood: WOOD_DARK, tread: WOOD_LIGHT }),
  ),
  wide("tile:u", "Stairs up", 1, 1, () =>
    exitStairs("up", { wall: "#8a6a52", wood: WOOD_DARK, tread: WOOD_LIGHT }),
  ),
  wide("tile:x", "Exit door", 1, 1, exitDoor),
  wide("tavern:tip-jar", "Tip jar", 1, 1, tipJar),
  wide("tavern:kitchen-door", "Kitchen door", 1, 1, kitchenDoor),
  wide("tile:O", "Coat stand", 1, 1, coatStand),
  wide("tavern:umbrella-stand", "Umbrella stand", 1, 1, umbrellaStand),
  wide("tavern:picture-0", "Harbour picture", 1, 1, picture(0)),
  wide("tavern:picture-1", "Hops picture", 1, 1, picture(1)),
  wide("tavern:picture-2", "Pint picture", 1, 1, picture(2)),
  wide("tile:b", "Dorm bed", 1, 2, dormBed, { bed: [0, 0.3, -0.27] }),
  wide("tavern:dorm-rug", "Dorm runner rug", 14, 1, dormRug(14)),
  wide("tavern:cell-rug", "Barkeep's cell rug", 9, 1, cellRug(9)),
];

// ——— The rooms ———

export interface TavernRoom {
  room: Room;
  barkeep: Barkeep;
  jukebox: JukeboxModel;
  /** The tip jar on the bar: `toss()` throws a coin in. */
  fountain: FountainModel | null;
  /** Models by their asset id, for the hooks (`setBarTab`, `setPlaque`, `setSpecial`). */
  by: Map<string, Model[]>;
  /** The tile character each tile of the 2D map should carry (room tiles, wall rows at -1 and `D`), for `maps.ts`. */
  layout: Map<string, string>;
}

/** The 2D tile character for an asset that is not a `tile:` one. */
const CHARS: Record<string, string> = {
  "tavern:back-bar": "k",
  "tavern:table-long": "n",
  "tavern:chair": "c",
  "tavern:sofa-l": "s",
  "tavern:sofa-r": "s",
  "tavern:armchair": "s",
  "tavern:booth-l": "B",
  "tavern:booth-r": "B",
  "tavern:stage": "e",
  "tavern:stage-stool": "v",
  "tavern:cell-rug": "=",
  "tavern:umbrella-stand": "O",
  "tavern:plaque-2": "P",
  "coffee-table": "n",
  plant: "p",
  coffee: "o",
  rug: "=",
};

export const TAVERN_W = 26;
export const TAVERN_D = 16;

/**
 * The Tavern's floor plan (`inn` in `core/src/maps.ts`), less its walls: 26 by 16 tiles, north wall at the top.
 * The bar runs along the north wall's west end with the barkeep's cell and the back-bar behind it, the boards
 * hang on clear stretches of the north and west walls, the hearth is set into the north wall with its sofa nook,
 * the stage and jukebox are on the west wall, dining tables and booths fill the floor round a two-wide aisle
 * from the door, and the stairs are in the corners.
 */
export function buildTavernRoom(): TavernRoom {
  const W = TAVERN_W;
  const D = TAVERN_D;
  const room = new Room(W, D, {
    floor: "#9c6a40",
    wall: "#8a6a52",
    stripe: "#7a5a44",
    north: [],
    door: null,
    west: [],
  });
  const by = new Map<string, Model[]>();
  const layout = new Map<string, string>();
  const find = (id: string) => TAVERN_ASSETS.find((t) => t.id === id) ?? assetById.get(id)!;
  const charOf = (id: string) => CHARS[id] ?? (id.startsWith("tile:") ? id.slice(5) : "_");
  const mark = (ch: string, x: number, z: number, keep = false) => {
    const k = `${x},${z}`;
    if (!keep || !layout.has(k)) layout.set(k, ch);
  };
  const reg = (id: string, model: Model) => by.set(id, [...(by.get(id) ?? []), model]);
  /** A piece on the floor: it blocks the tiles it stands on. */
  const put = (id: string, x: number, z: number, turn: Turn = 0, face?: [number, number]) => {
    const a = find(id);
    const p = room.place(a, x, z, turn);
    if (face) p.model.rotation.y = Math.atan2(face[0] - p.model.position.x, face[1] - p.model.position.z);
    reg(id, p.model);
    const [w, d] = Room.footprint(a, turn);
    for (let i = 0; i < w; i++) for (let j = 0; j < d; j++) mark(charOf(id), x + i, z + j, id === "rug");
    return p;
  };
  /** A piece hung on a wall (turn 0 north, 1 west, 2 south): it takes the wall's tiles, not the floor's. `ch` null: no tile. */
  const hang = (id: string, x: number, z: number, turn: 0 | 1 | 2 = 0, ch: string | null = charOf(id)) => {
    const a = find(id);
    const [w, d] = Room.footprint(a, turn);
    const model = a.build();
    model.position.set(x + w / 2, 0, z + d / 2);
    model.rotation.y = (turn * Math.PI) / 2;
    room.group.add(model);
    reg(id, model);
    if (ch)
      for (let i = 0; i < w; i++)
        for (let j = 0; j < d; j++)
          mark(ch, turn === 1 ? -1 : x + i, turn === 0 ? -1 : turn === 2 ? D : z + j);
    return model;
  };
  const sconceAt = (x: number, z: number, turn: 0 | 1 = 0) => {
    const s = find("tavern:sconce").build();
    s.position.set(x + 0.5, 0, z + 0.5);
    s.rotation.y = (turn * Math.PI) / 2;
    room.group.add(s);
  };

  // ——— The bar and the barkeep's cell (x 0-8, z 0-1), sealed by the counter and two barrels ———
  put("tavern:cell-rug", 0, 1);
  mark("=", 7, 0);
  put("tavern:back-bar", 0, 0);
  hang("tavern:kitchen-door", 7, 0, 0, null);
  put("tile:h", 8, 0);
  put("tile:h", 9, 0);
  put("tile:h", 9, 1);
  for (let x = 0; x <= 9; x++) put(x === 3 ? "tile:y" : "tile:a", x, 2);
  const jar = find("tavern:tip-jar").build();
  jar.position.set(7.5, 1.03, 2.5);
  room.group.add(jar);
  reg("tavern:tip-jar", jar);
  for (const x of [2, 4, 6, 8]) put("tile:v", x, 3, 2);

  // ——— North wall: coffee, the quest board, the specials easel, the Hall of Fame, the request pile, the world clocks, the hearth nook, books ———
  put("coffee", 10, 0);
  hang("tile:m", 11, 0);
  put("tile:K", 13, 0);
  hang("tile:A", 14, 0);
  hang("tile:A", 16, 0);
  hang("tile:?", 18, 0);
  hang("tile:◷", 19, 0);
  put("tile:P", 20, 0);
  put("tile:f", 21, 0);
  put("tavern:plaque-2", 23, 0);
  put("tile:k", 24, 0);
  put("tile:k", 25, 0);
  // The sofa nook round the hearth: rugs, a loveseat facing the fire over a coffee table, an armchair either side.
  for (const [x, z] of [
    [19, 1],
    [22, 1],
    [19, 3],
    [22, 3],
  ] as const)
    put("rug", x, z);
  put("coffee-table", 21, 3);
  put("tavern:sofa-r", 21, 4, 2);
  put("tavern:sofa-l", 22, 4, 2);
  put("tavern:armchair", 19, 2, 0, [22, 0.5]);
  put("tavern:armchair", 24, 2, 0, [22, 0.5]);

  // ——— West wall: the bar tab, the jukebox and the stage, the open-offices board, the stairs up ———
  hang("tile:J", 0, 3, 1);
  put("tile:z", 0, 7, 1);
  put("tavern:stage", 0, 8, 1);
  put("tavern:stage-stool", 0, 11, 1);
  hang("tile:w", 0, 14, 1, null);
  put("tile:u", 0, 15, 1);
  put("plant", 0, 13);

  // ——— Dining: long tables with a chair on every side facing the table ———
  const dining = (x: number, z: number) => {
    put("tavern:table-long", x, z);
    for (const i of [0, 1]) {
      put("tavern:chair", x + i, z - 1, 0);
      put("tavern:chair", x + i, z + 1, 2);
    }
    put("tavern:chair", x - 1, z, 1);
    put("tavern:chair", x + 2, z, 3);
  };
  dining(6, 7);
  dining(11, 7);
  dining(13, 4);
  dining(20, 7);
  // Booths along the south wall: benches against it, the table, and a bench facing it.
  const booth = (x: number) => {
    put("tavern:booth-r", x, 15, 2);
    put("tavern:booth-l", x + 1, 15, 2);
    put("tavern:table-long", x, 14);
    put("tavern:booth-l", x, 13, 0);
    put("tavern:booth-r", x + 1, 13, 0);
  };
  booth(3);
  booth(7);
  booth(21);

  // ——— The entrance: a coat stand and an umbrella stand beside the door ———
  hang("tile:x", 12, 15, 2);
  put("tile:O", 10, 15);
  put("tavern:umbrella-stand", 11, 15);
  put("tile:S", 25, 14, 3);
  put("plant", 24, 15);
  put("plant", 25, 1);
  put("tile:h", 25, 12);

  // ——— Wall decor and lights ———
  hang("tavern:picture-0", 8, 0, 0, null);
  hang("tavern:picture-2", 0, 2, 1, null);
  for (const x of [10, 19]) sconceAt(x, 0);
  sconceAt(0, 13, 1);

  const barkeep = makeBarkeep();
  barkeep.root.position.set(4.5, 0.02, 1.5);
  room.group.add(barkeep.root);
  return {
    room,
    barkeep,
    jukebox: by.get("tile:z")![0] as JukeboxModel,
    fountain: jar as FountainModel,
    by,
    layout,
  };
}

export interface DormRoom {
  room: Room;
  beds: Placed[];
}

/** The dorm above the Tavern (`upstairs`): two rows of nine beds, a runner rug, plants; 18 by 7 tiles. */
export function buildDormRoom(): DormRoom {
  bedCount = 0;
  const room = new Room(18, 7, { floor: "#b98855", wall: "#e6d8bd", stripe: "#d6c4a2", bare: true });
  const beds: Placed[] = [];
  put(room, "tavern:dorm-rug", 2, 2);
  for (let i = 0; i < 9; i++) {
    beds.push(put(room, "tile:b", i * 2, 0));
    beds.push(put(room, "tile:b", i * 2, 4, 2));
  }
  put(room, "plant", 17, 0);
  put(room, "plant", 0, 6);
  put(room, "plant", 16, 6);
  put(room, "tile:S", 9, 6, 2);
  return { room, beds };
}

function put(room: Room, id: string, x: number, z: number, turn: Turn = 0): Placed {
  return room.place(TAVERN_ASSETS.find((t) => t.id === id) ?? assetById.get(id)!, x, z, turn);
}
