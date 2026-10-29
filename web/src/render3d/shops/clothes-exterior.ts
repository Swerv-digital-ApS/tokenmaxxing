/**
 * Thread & Token from the street: a blush-pink corner boutique 5 tiles wide and 4 deep with plum trim, a striped
 * awning, two bay shop windows dressed with real mannequins (the Gold suit, the Prompt wizard robe) and hats,
 * a gilt sign, a hanger on the roof, a garment rack and a sandwich board on the pavement. Faces +z, origin on the
 * ground at the middle of the front wall (see `town3d-houses.ts`).
 */
import { C } from "../../art/palette.ts";
import { light } from "../furniture/furniture.ts";
import { glass, glow, Model, ticks, tint } from "../kit/kit.ts";
import { nightGlow } from "../town/props.ts";
import { mannequin } from "./clothes-items.ts";
import { GOLD, INK, PINK, PLUM, signBoard } from "./clothes-parts.ts";

const WALL = "#f4d7de";
const CORNICE = PLUM;

/** One bay window: a box that stands out of the wall, glass at its front, a mannequin or two inside. */
function bay(m: Model, x: number, outfit: number, hat: number, flip: boolean): void {
  const w = 1.5;
  const sill = 0.3;
  const h = 0.82;
  const depth = 0.34;
  const bw = m.part([x, 0, 0]);
  // The shell: floor, sill, head, sides, and a backdrop on the wall.
  bw.box([w + 0.16, 0.12, depth + 0.1], PLUM, [0, sill - 0.12, depth / 2 - 0.02], 0.02);
  bw.box([w + 0.16, 0.12, depth + 0.1], PLUM, [0, sill + h, depth / 2 - 0.02], 0.02);
  for (const s of [-1, 1])
    bw.box([0.08, h, depth + 0.1], PLUM, [s * (w / 2 + 0.04), sill, depth / 2 - 0.02], 0.015);
  const back = bw.box([w, h, 0.03], "#fbe9ee", [0, sill, 0.04], 0.004);
  nightGlow(back, "#ffe6bc");
  bw.box([w, 0.03, depth], "#d98aa6", [0, sill, depth / 2 + 0.03], 0.004);
  const pane = bw.box([w, h, 0.02], glass("#d6efff", 0.16), [0, sill, depth + 0.03], 0);
  pane.castShadow = false;
  bw.box([0.04, h, 0.04], GOLD, [0, sill, depth + 0.03], 0.004);
  // The mannequin, small, turned a little to the street.
  const a = mannequin({ style: 0, skin: 0, hair: 1, outfit, hat: 0 });
  a.root.scale.setScalar(0.7);
  a.root.position.set(flip ? -0.35 : 0.35, sill + 0.035, 0.17);
  a.root.rotation.y = flip ? 0.4 : -0.4;
  bw.add(a.root);
  // A hat on a stand beside it.
  const stand = bw.part([flip ? 0.42 : -0.42, sill + 0.03, 0.17]);
  stand.cyl(0.1, 0.02, INK, [0, 0, 0], 0.1, 10);
  stand.cyl(0.02, 0.32, "#6b5a7a", [0, 0.02, 0], 0.02, 6);
  stand.ball(0.1, "#d9c4a0", [0, 0.42, 0], [1, 1.05, 1], 10);
  stand.cyl(0.14, 0.03, hat ? "#2b2433" : PINK, [0, 0.49, 0], 0.14, 12);
  stand.cyl(0.08, 0.14, hat ? "#2b2433" : PINK, [0, 0.5, 0], 0.08, 12);
  stand.box([0.16, 0.025, 0.02], GOLD, [0, 0.55, 0.075], 0.004);
  light(bw, [0, sill + 0.7, 0.3], "#ffd9a8", 1.1, 3);
}

/** The striped awning, sloping down from the wall to the front. */
function awning(m: Model, w: number, top: number, drop: number, reach: number): void {
  const n = 14;
  const sw = w / n;
  const slope = Math.atan2(drop, reach);
  const len = Math.hypot(reach, drop);
  for (let i = 0; i < n; i++) {
    const c = i % 2 ? "#fbf4ea" : PINK;
    const x = -w / 2 + (i + 0.5) * sw;
    const s = m.box([sw, 0.04, len], c, [x, top, 0], 0.006);
    s.position.set(x, top - drop / 2, reach / 2 + 0.02);
    s.rotation.x = slope;
    // The scalloped valance.
    m.box([sw * 0.9, 0.1, 0.03], c, [x, top - drop - 0.06, reach + 0.02], 0.012);
    m.ball(sw * 0.45, c, [x, top - drop - 0.07, reach + 0.03], [1, 0.55, 0.35], 8);
  }
  for (const s of [-1, 1])
    m.box([0.05, drop + 0.1, 0.05], GOLD, [s * (w / 2), top - drop - 0.1, reach], 0.008);
}

function hangerSign(m: Model, at: [number, number, number]): void {
  const g = m.part(at);
  for (const s of [-1, 1]) {
    const bar = g.box([0.5, 0.06, 0.06], GOLD, [s * 0.22, 0.12, 0], 0.012);
    bar.rotation.z = s * -0.38;
    bar.position.set(s * 0.22, 0.12, 0);
  }
  g.box([0.06, 0.2, 0.06], GOLD, [0, 0.24, 0], 0.012);
  g.cyl(0.07, 0.04, GOLD, [0, 0.42, 0], 0.07, 8);
  g.box([0.8, 0.05, 0.05], GOLD, [0, 0.0, 0], 0.01);
  nightGlow(g.box([0.06, 0.06, 0.06], PINK, [0, 0.46, 0], 0.01), "#ffe28a");
}

/** A rolling garment rack: a rail, hangers with jackets in the shop's colours. */
function garmentRack(): Model {
  const m = new Model();
  for (const s of [-1, 1]) {
    m.box([0.04, 0.04, 0.5], INK, [s * 0.4, 0, 0], 0.006);
    m.cyl(0.015, 0.8, C.metal, [s * 0.4, 0.04, 0], 0.015, 6);
    m.ball(0.035, INK, [s * 0.4, 0.035, 0.22]);
    m.ball(0.035, INK, [s * 0.4, 0.035, -0.22]);
  }
  m.cyl(0.015, 0.84, C.metal, [0, 0.84, 0], 0.015, 6).rotation.z = Math.PI / 2;
  ["#d23c3c", "#4f8fe0", "#f5c842", "#3f8c50", "#c38bff", "#fbf4ea"].forEach((c, i) => {
    const x = -0.32 + i * 0.128;
    m.box([0.1, 0.36, 0.09], c, [x, 0.5, 0], 0.02);
    m.box([0.025, 0.03, 0.025], C.metal, [x, 0.87, 0]);
  });
  return m;
}

function sandwichBoard(): Model {
  const m = new Model();
  for (const s of [-1, 1]) {
    const leg = m.box([0.52, 0.7, 0.04], PLUM, [0, 0, s * 0.1], 0.01);
    leg.rotation.x = s * 0.2;
  }
  const board = signBoard("NEW IN", 0.4, 0.4, { sub: "Aurora crown" });
  board.position.set(0, 0.12, 0.15);
  board.rotation.x = -0.2;
  m.add(board);
  return m;
}

export function clothesExterior(): Model {
  const m = new Model();
  m.name = "building:clothes";
  const [w, d, h] = [4.9, 3.6, 2.3];
  m.box([w + 0.2, 0.18, d + 0.2], C.stone, [0, 0, -d / 2], 0.02);
  m.box([w, h - 0.18, d], WALL, [0, 0.18, -d / 2], 0.02);
  // Vertical pilasters and the plum cornice.
  for (const x of [-w / 2 + 0.06, w / 2 - 0.06]) m.box([0.14, h - 0.18, 0.1], PLUM, [x, 0.18, 0.04], 0.01);
  m.box([w + 0.2, 0.2, d + 0.2], CORNICE, [0, h - 0.08, -d / 2], 0.02);
  m.box([w + 0.26, 0.05, d + 0.26], GOLD, [0, h + 0.12, -d / 2], 0.01);
  // The flat roof, a lighter deck behind a parapet, a vent and a skylight.
  m.box([w - 0.2, 0.06, d - 0.2], "#a9a39a", [0, h + 0.12, -d / 2], 0.01);
  m.box([0.7, 0.3, 0.5], "#8a8f99", [-1.4, h + 0.18, -d + 0.7], 0.02);
  const sky = m.box([1.0, 0.1, 0.8], glass("#d6efff", 0.6), [1.2, h + 0.18, -d + 0.8], 0.02);
  nightGlow(sky, "#ffd9a8");
  hangerSign(m, [0, h + 0.2, -0.05]);
  // Side windows: round-topped panes in the plum frames.
  for (const [sx, rot] of [
    [w / 2, Math.PI / 2],
    [-w / 2, -Math.PI / 2],
  ] as const) {
    const side = m.part([sx, 0, -d / 2], rot);
    for (const x of [-0.8, 0.8]) {
      side.box([0.56, 0.7, 0.05], PLUM, [x, 0.7, 0.0], 0.015);
      nightGlow(side.box([0.44, 0.58, 0.05], "#a8dcf7", [x, 0.76, 0.01], 0.005), "#ffd98a");
    }
  }
  // The sign band above the awning, gilt on plum, lit at night.
  const sign = signBoard("THREAD & TOKEN", 3.3, 0.34, { sub: "CLOTHES · HATS · GLASSES · MERCH", lit: true });
  sign.position.set(0, h - 0.62, 0.03);
  m.add(sign);
  // Bay windows either side of the door.
  bay(m, -1.58, 11, 0, true);
  bay(m, 1.58, 23, 1, false);
  // The door: glass in a plum frame, a gilt bar, a step and an OPEN sign.
  const door = m.part([0, 0.18, 0.02]);
  door.box([1.0, 1.32, 0.08], PLUM, [0, 0, 0], 0.025);
  door.box([0.78, 1.14, 0.05], glass("#d6efff", 0.55), [0, 0.05, 0.03], 0.01);
  door.box([0.03, 1.14, 0.06], PLUM, [0, 0.05, 0.035]);
  door.box([0.78, 0.04, 0.06], PLUM, [0, 0.62, 0.035]);
  for (const s of [-1, 1]) door.box([0.04, 0.4, 0.05], GOLD, [s * 0.1, 0.5, 0.075], 0.008);
  nightGlow(door.box([0.3, 0.12, 0.03], "#ffffff", [0.3, 0.52, 0.065], 0.006), "#ffe28a");
  door.box([1.3, 0.08, 0.5], C.stoneLight, [0, 0, 0.22], 0.02);
  door.box([1.0, 0.025, 0.4], PINK, [0, 0.08, 0.3], 0.006);
  // The awning over the whole front.
  const aw = m.part([0, h - 0.66, 0.03]);
  awning(aw, w - 0.3, 0, 0.25, 0.55);
  // Lanterns at the door, and the street.
  for (const x of [-0.72, 0.72]) {
    m.box([0.04, 0.14, 0.04], C.metal, [x, 1.16, 0.12]);
    nightGlow(m.box([0.12, 0.17, 0.12], "#f5d98a", [x, 0.96, 0.16], 0.03), "#ffe28a");
  }
  const rack = garmentRack();
  rack.position.set(-2.75, 0, 0.7);
  rack.rotation.y = 0.35;
  m.add(rack);
  const board = sandwichBoard();
  board.position.set(2.7, 0, 0.9);
  board.rotation.y = -0.3;
  m.add(board);
  for (const x of [-0.85, 0.85]) {
    m.cyl(0.14, 0.2, PLUM, [x, 0, 0.95], 0.11, 10);
    m.ball(0.17, C.leaf, [x, 0.36, 0.95], [1, 1.1, 1], 10);
    m.ball(0.12, C.leafLight, [x, 0.6, 0.95], [1, 1, 1], 8);
  }
  const swing = m.part([2.35, h - 0.2, 0.3]);
  swing.box([0.04, 0.04, 0.4], PLUM, [0, 0.1, -0.15]);
  const flag = swing.part([0, 0, 0.0]);
  flag.box([0.34, 0.34, 0.04], PINK, [0, -0.4, 0], 0.015);
  flag.box([0.2, 0.05, 0.05], GOLD, [0, -0.28, 0.01], 0.008);
  flag.box([0.04, 0.2, 0.05], GOLD, [0, -0.45, 0.01], 0.008);
  ticks.push((t) => (flag.rotation.z = Math.sin(t * 1.5 + 1) * 0.08));
  light(m, [0, 1.0, 1.0], "#ffd9a8", 3, 6);
  void glow;
  void tint;
  return m;
}
