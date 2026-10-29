/**
 * Torvehallen, the market hall: a bright, warm covered market where players sell their own things to each other,
 * like a collectibles shop. From the street: a brick-and-plaster hall with a false front carrying the sign, a pair of
 * lit window displays under striped awnings, a lit arched doorway, bunting and a chalkboard. Inside: tiled floor,
 * sixteen lit shelves along the back wall and six glass cases of four across the middle, a counter with a till where
 * Torvald stands, and festoon lights over the aisles.
 *
 * Everything here is the static shell. What is on the shelves and in the cases is other players' and arrives
 * through `hud.market` (`market-slots.ts`, a live layer the room hands the renderer). The plan is the core's
 * (`SHOPS.market.rows`): a run of `Ƙ` is a shelf unit (row 2, against the wall) or a glass case, `‡` a pilaster (on the
 * wall) or a planter (on the floor), `¢` the counter. The pieces are placed from the plan, so a tile added there is a
 * piece here, and a blocked tile in 3D is a blocked tile for the server.
 */
import { SHOP_DISPLAY_CHAR, SHOPS } from "@tokenmaxxing/core/shoprooms.ts";
import type * as THREE from "three";
import { SKINS } from "../../art/palette.ts";
import { type Asset, light } from "../furniture/furniture.ts";
import { checker, glass, glow, Model, seeded, ticks, tint } from "../kit/kit.ts";
import { panel } from "../kit/panel.ts";
import { Avatar, personLook } from "../people/avatar.ts";
import { exitDoorway } from "../rooms/exits3d.ts";
import { Room } from "../rooms/room.ts";
import { nightGlow } from "../town/props.ts";
import type { ShopItem, ShopSpec } from "./furniture.ts";
import { CASE_Y, MarketSlots, SHELF_Y } from "./market-slots.ts";

// MARK: Palette

const CREAM = "#f6ead0";
const PLASTER = "#f1dfbd";
const BRICK = "#b8603f";
const BRICK_D = "#9c4c31";
const WOOD = "#b9824a";
const WOOD_D = "#7a4f2a";
const WOOD_L = "#d6a76a";
const TEAL = "#2f8f8a";
const TEAL_D = "#1f6663";
const RED = "#d9533b";
const GOLD = "#e9b73d";
const BRASS = "#c9a24a";
const ROOF = "#3f8a7f";
const BULB = "#fff0b8";
const LEAF = ["#3f8f3a", "#4fa544", "#5fb84f", "#2f7a32"];
/** The colours of the little boxes and figures on the window shelves. */
const TOYS = ["#e8584a", "#4f8fe0", "#f0b53c", "#58b36a", "#9b6fd6", "#f28bb2", "#ffffff", "#36b9c4"];

const W = SHOPS.market.w;
const D = SHOPS.market.d;

// MARK: Pieces

/** A thin wire between two points. */
function wire(m: Model, a: [number, number, number], b: [number, number, number], color = "#5a4a3a"): void {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const dz = b[2] - a[2];
  const len = Math.hypot(dx, dy, dz);
  const s = m.box(
    [0.012, 0.012, len],
    color,
    [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2],
    0.002,
  );
  s.rotation.order = "YXZ";
  s.rotation.y = Math.atan2(dx, dz);
  s.rotation.x = -Math.atan2(dy, Math.hypot(dx, dz));
  s.castShadow = false;
}

/** A string of `n` warm bulbs hung between two points, sagging by `sag` in the middle. */
function festoon(
  m: Model,
  a: [number, number, number],
  b: [number, number, number],
  n: number,
  sag: number,
): void {
  const bulb = glow(BULB);
  const at = (u: number): [number, number, number] => [
    a[0] + (b[0] - a[0]) * u,
    a[1] + (b[1] - a[1]) * u - sag * 4 * u * (1 - u),
    a[2] + (b[2] - a[2]) * u,
  ];
  for (let i = 0; i < n * 2; i++) wire(m, at(i / (n * 2)), at((i + 1) / (n * 2)));
  for (let i = 0; i < n; i++) {
    const [x, y, z] = at((i + 0.5) / n);
    m.cyl(0.02, 0.05, BRASS, [x, y - 0.05, z], 0.02, 6).castShadow = false;
    const ball = m.ball(0.055, bulb, [x, y - 0.1, z], [1, 1.15, 1], 8);
    ball.castShadow = false;
  }
}

/** A lit sign: letters on a painted board, with a border. */
function signBoard(
  w: number,
  h: number,
  lines: { text: string; color: string; size: number; y: number }[],
  board = TEAL_D,
  edge = GOLD,
): ReturnType<typeof panel> {
  return panel(
    w,
    h,
    (g, cw, ch) => {
      g.fillStyle = board;
      g.fillRect(0, 0, cw, ch);
      g.textAlign = "center";
      g.textBaseline = "middle";
      for (const l of lines) {
        g.font = `900 ${Math.round(ch * l.size)}px system-ui, sans-serif`;
        g.fillStyle = tint(l.color, -0.35);
        g.fillText(l.text, cw / 2 + ch * 0.02, ch * l.y + ch * 0.03, cw * 0.92);
        g.fillStyle = l.color;
        g.fillText(l.text, cw / 2, ch * l.y, cw * 0.92);
      }
      g.strokeStyle = edge;
      g.lineWidth = Math.max(2, ch * 0.05);
      g.strokeRect(ch * 0.07, ch * 0.07, cw - ch * 0.14, ch * 0.86);
    },
    { px: 110, lit: true, smooth: true, frame: WOOD_D },
  );
}

/** A glass shelf of small boxes and figures (the window displays, the counter's tray): `n` of them, `seed`-coloured. */
function trinkets(m: Model, x0: number, x1: number, y: number, z: number, seed: number): void {
  const rnd = seeded(seed);
  let x = x0;
  while (x < x1 - 0.1) {
    const w = 0.1 + rnd() * 0.08;
    const h = 0.1 + rnd() * 0.12;
    const c = TOYS[Math.floor(rnd() * TOYS.length)]!;
    if (rnd() < 0.3) m.ball(w * 0.55, c, [x + w / 2, y + w * 0.55, z], [1, 1.2, 1], 8);
    else m.box([w, h, 0.08], c, [x + w / 2, y, z], 0.01);
    x += w + 0.04;
  }
}

/** A potted plant in a wooden tub, 1x1. */
function planter(): Model {
  const m = new Model();
  m.cyl(0.3, 0.42, WOOD, [0, 0, 0], 0.26, 12);
  m.cyl(0.31, 0.04, BRASS, [0, 0.12, 0], 0.31, 12);
  m.cyl(0.27, 0.04, BRASS, [0, 0.32, 0], 0.27, 12);
  m.cyl(0.24, 0.02, "#4a3322", [0, 0.42, 0], 0.24, 12);
  const rnd = seeded(7);
  for (let i = 0; i < 7; i++) {
    const a = rnd() * Math.PI * 2;
    const r = 0.05 + rnd() * 0.14;
    m.ball(
      0.13 + rnd() * 0.05,
      LEAF[i % 4]!,
      [Math.cos(a) * r, 0.62 + rnd() * 0.45, Math.sin(a) * r],
      [1, 0.8, 1],
      8,
    );
  }
  return m;
}

/** A pilaster against the back wall, 1x1: a slim timber column with brass base and capital and a small lamp. */
function pilaster(): Model {
  const m = new Model();
  const z = -0.26;
  m.box([0.46, 0.16, 0.46], BRASS, [0, 0, z], 0.02);
  m.box([0.34, 1.52, 0.34], WOOD_D, [0, 0.16, z], 0.03);
  for (const y of [0.5, 1.2]) m.box([0.38, 0.04, 0.38], BRASS, [0, y, z], 0.01);
  m.box([0.48, 0.12, 0.48], BRASS, [0, 1.68, z], 0.02);
  const lamp = m.ball(0.075, BULB, [0, 1.88, z + 0.06], [1, 1.2, 1], 8);
  nightGlow(lamp, "#ffffff");
  return m;
}

/**
 * A shelf unit of `n` slots against the back wall, facing +z. The slots' items stand on its top (`SHELF_Y`) in front
 * of a dark teal back that makes them show, under a header with a lit strip.
 */
function shelfUnit(n: number): Model {
  const m = new Model();
  const w = n - 0.04;
  m.box([w, SHELF_Y - 0.04, 0.88], WOOD, [0, 0, -0.04], 0.02);
  m.box([w + 0.04, 0.05, 0.92], WOOD_L, [0, SHELF_Y - 0.05, -0.02], 0.015);
  m.box([w, 0.06, 0.92], WOOD_D, [0, 0, -0.04], 0.01);
  // The doors in the cabinet: one panel and a brass knob under each slot.
  for (let i = 0; i < n; i++) {
    const x = -w / 2 + (i + 0.5) * (w / n);
    m.box([w / n - 0.12, SHELF_Y - 0.22, 0.03], tint(WOOD, -0.12), [x, 0.1, 0.41], 0.01);
    m.ball(0.025, BRASS, [x + 0.16, 0.28, 0.44], [1, 1, 0.6], 6);
  }
  const back = m.box([w, 1.1, 0.04], TEAL_D, [0, SHELF_Y, -0.46], 0.005);
  nightGlow(back, TEAL);
  m.box([w + 0.04, 0.12, 0.34], WOOD_D, [0, SHELF_Y + 1.1, -0.32], 0.015);
  m.box([w + 0.06, 0.03, 0.36], BRASS, [0, SHELF_Y + 1.22, -0.32], 0.008);
  // The lit strip under the header, and the slot dividers: a brass post between neighbours.
  const strip = m.box([w - 0.1, 0.03, 0.06], BULB, [0, SHELF_Y + 1.07, -0.2], 0.004);
  nightGlow(strip, "#ffffff");
  strip.castShadow = false;
  for (let i = 1; i < n; i++) m.box([0.02, 0.08, 0.5], BRASS, [-w / 2 + i * (w / n), SHELF_Y, -0.2], 0.004);
  return m;
}

/** The glass for the cases, made once (every case shares it). */
let caseGlass: THREE.Material | null = null;

/**
 * A glass case of `n` slots, facing +z: a wooden plinth with a felt tray (`CASE_Y`), a glass box over it with brass
 * corner posts, and a light strip under its lid. The slots' items stand on the tray, inside the glass.
 */
function vitrine(n: number): Model {
  const m = new Model();
  const w = n - 0.04;
  const top = 0.9;
  if (!caseGlass) {
    caseGlass = glass("#d6f2ee", 0.16);
    caseGlass.userData.shared = true;
  }
  m.box([w, CASE_Y - 0.02, 0.92], WOOD, [0, 0, 0], 0.02);
  m.box([w + 0.04, 0.05, 0.96], WOOD_D, [0, 0, 0], 0.01);
  m.box([w + 0.04, 0.035, 0.96], BRASS, [0, CASE_Y - 0.06, 0], 0.008);
  m.box([w - 0.08, 0.02, 0.84], TEAL, [0, CASE_Y - 0.02, 0], 0.004);
  m.box([0.5, 0.1, 0.02], BRASS, [0, 0.12, 0.47], 0.004);
  // The glass, the posts at its corners and mid-way, and the lid with its light under it.
  const pane = m.box([w - 0.02, top, 0.88], caseGlass, [0, CASE_Y, 0], 0.002);
  pane.castShadow = false;
  for (const sx of [-1, 1])
    for (const sz of [-1, 1])
      m.box([0.05, top, 0.05], BRASS, [sx * (w / 2 - 0.02), CASE_Y, sz * 0.43], 0.008);
  m.box([w + 0.04, 0.07, 0.96], WOOD_D, [0, CASE_Y + top, 0], 0.015);
  const strip = m.box([w - 0.2, 0.025, 0.5], BULB, [0, CASE_Y + top - 0.025, 0], 0.004);
  nightGlow(strip, "#ffffff");
  strip.castShadow = false;
  return m;
}

/** The counter, `w` wide: a wooden front with teal panels, a marble top, the till, a bell, a scale and a stack of bags. */
function counter(w: number): Model {
  const m = new Model();
  m.box([w - 0.04, 0.9, 0.7], WOOD, [0, 0, 0], 0.03);
  m.box([w - 0.2, 0.66, 0.03], TEAL, [0, 0.12, 0.36], 0.01);
  for (let i = 0; i <= 6; i++)
    m.box([0.05, 0.7, 0.04], WOOD_D, [-w / 2 + 0.1 + i * ((w - 0.2) / 6), 0.1, 0.37], 0.006);
  m.box([w - 0.2, 0.04, 0.045], BRASS, [0, 0.1, 0.385], 0.004);
  m.box([w + 0.1, 0.06, 0.84], "#efe7da", [0, 0.9, 0], 0.02);
  m.box([w + 0.12, 0.025, 0.86], BRASS, [0, 0.9, 0], 0.005);
  const y = 0.96;
  // The till: a box with a slanted screen and a drawer, and a bell next to it.
  const till = m.part([-1.0, y, -0.08]);
  till.box([0.42, 0.2, 0.34], tint(TEAL_D, 0.05), [0, 0, 0], 0.02);
  till.box([0.34, 0.1, 0.02], "#1a2b2a", [0, 0.2, -0.06], 0.005).rotation.x = -0.5;
  const screen = till.box([0.3, 0.07, 0.01], "#9be8c4", [0, 0.21, -0.07], 0.002);
  screen.rotation.x = -0.5;
  nightGlow(screen, "#e8fff4");
  for (let r = 0; r < 2; r++)
    for (let c = 0; c < 4; c++)
      till.box([0.06, 0.012, 0.05], "#f3efe2", [-0.12 + c * 0.08, 0.2, 0.06 + r * 0.06], 0.003);
  m.cyl(0.07, 0.04, BRASS, [-0.45, y, 0.12], 0.07, 12);
  m.ball(0.025, BRASS, [-0.45, y + 0.05, 0.12], [1, 1, 1], 6);
  // A balance scale for weighing the odd lot, and its pans.
  const scale = m.part([0.55, y, -0.05]);
  scale.cyl(0.1, 0.03, WOOD_D, [0, 0, 0], 0.1, 10);
  scale.cyl(0.015, 0.34, BRASS, [0, 0.03, 0], 0.015, 6);
  scale.box([0.5, 0.015, 0.015], BRASS, [0, 0.36, 0], 0.003);
  for (const s of [-1, 1]) {
    wire(scale, [s * 0.24, 0.36, 0], [s * 0.24, 0.22, 0], BRASS);
    scale.cyl(0.09, 0.012, BRASS, [s * 0.24, 0.2, 0], 0.09, 10);
  }
  // A stack of paper bags, a tray of price tags, a pencil cup.
  for (let i = 0; i < 4; i++)
    m.box([0.3, 0.012, 0.22], i % 2 ? "#c9a06a" : "#d8b27c", [1.5, y + i * 0.014, 0.05], 0.002);
  const tags = m.part([1.0, y, 0.12]);
  tags.box([0.34, 0.04, 0.2], WOOD_D, [0, 0, 0], 0.005);
  trinkets(tags, -0.14, 0.14, 0.04, 0, 91);
  m.cyl(0.04, 0.09, TEAL, [-1.55, y, 0.05], 0.04, 8);
  for (const [dx, c] of [
    [-0.015, RED],
    [0.015, GOLD],
  ] as const)
    m.box([0.01, 0.1, 0.01], c, [-1.55 + dx, y + 0.08, 0.05], 0.002).rotation.z = dx * 6;
  light(m, [0, 1.8, 0.2], "#ffe2a8", 0.9, 4);
  return m;
}

/** A runner from the door to the counter, flat. */
function runner(): Model {
  const m = new Model();
  m.box([0.9, 0.012, 4.9], TEAL_D, [0, 0, 0], 0.002);
  m.box([0.74, 0.016, 4.8], TEAL, [0, 0, 0], 0.002);
  for (const z of [-2, -1, 0, 1, 2]) m.box([0.5, 0.02, 0.08], CREAM, [0, 0, z], 0.002);
  return m;
}

// MARK: The street side

/** The striped awning over a window, sloping from the wall (high) to the front (low). */
function awning(m: Model, cx: number, w: number, y: number, front: number, drop: number): void {
  const n = 6;
  const sw = w / n;
  const len = Math.hypot(front, drop);
  for (let i = 0; i < n; i++) {
    const c = i % 2 ? CREAM : RED;
    const x = cx - w / 2 + (i + 0.5) * sw;
    const s = m.box([sw, 0.03, len], c, [x, 0, 0], 0.005);
    s.position.set(x, y - drop / 2, front / 2);
    s.rotation.x = Math.atan2(drop, front);
    m.box([sw * 0.94, 0.08, 0.025], c, [x, y - drop - 0.07, front + 0.005], 0.008);
  }
}

/** A lit window display: a framed pane with warm paper behind, two shelves of toys, a sill. */
function windowDisplay(m: Model, x: number, seed: number): void {
  m.box([1.3, 1.0, 0.08], WOOD_D, [x, 0.5, 0.0], 0.015);
  const paper = m.box([1.14, 0.84, 0.05], "#fbe7bd", [x, 0.58, 0.04], 0.01);
  nightGlow(paper, "#ffd592");
  for (const y of [0.9, 1.22]) m.box([1.14, 0.03, 0.16], WOOD_L, [x, y - 0.03, 0.1], 0.005);
  trinkets(m, x - 0.52, x + 0.52, 0.62, 0.1, seed);
  trinkets(m, x - 0.52, x + 0.52, 0.9, 0.1, seed + 1);
  trinkets(m, x - 0.52, x + 0.52, 1.22, 0.1, seed + 2);
  m.box([1.42, 0.06, 0.22], WOOD_L, [x, 0.5, 0.12], 0.01);
}

/** A chalkboard on an A-frame. */
function chalkboard(): Model {
  const m = new Model();
  for (const s of [-1, 1]) {
    const leg = m.box([0.05, 0.95, 0.05], WOOD_D, [0, 0, s * 0.18], 0.005);
    leg.rotation.x = -s * 0.2;
  }
  const board = panel(
    0.62,
    0.62,
    (g, cw, ch) => {
      g.fillStyle = "#26342f";
      g.fillRect(0, 0, cw, ch);
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.fillStyle = "#f6ead0";
      g.font = `900 ${Math.round(ch * 0.2)}px system-ui, sans-serif`;
      g.fillText("ÅBEN", cw / 2, ch * 0.2, cw * 0.9);
      g.fillStyle = "#ffd36a";
      g.font = `800 ${Math.round(ch * 0.14)}px system-ui, sans-serif`;
      g.fillText("KØB · SÆLG", cw / 2, ch * 0.5, cw * 0.9);
      g.fillStyle = "#9be8c4";
      g.fillText("BYT", cw / 2, ch * 0.76, cw * 0.9);
    },
    { px: 90, smooth: true, frame: WOOD_D },
  );
  board.position.set(0, 0.18, 0.2);
  board.rotation.x = -0.2;
  m.add(board);
  return m;
}

/** A stack of crates with toys in them. */
function crates(m: Model, x: number, z: number, turn: number): void {
  const stack = m.part([x, 0, z], turn);
  for (const [dx, dy, dz] of [
    [0, 0, 0],
    [0.04, 0.32, 0.02],
    [0.55, 0, 0.05],
  ] as const) {
    stack.box([0.5, 0.3, 0.4], WOOD_L, [dx, dy, dz], 0.015);
    for (const sy of [0.08, 0.2]) stack.box([0.52, 0.02, 0.42], WOOD_D, [dx, dy + sy, dz], 0.004);
    trinkets(stack, dx - 0.2, dx + 0.2, dy + 0.3, dz, Math.round(x * 31 + dx * 17 + dy * 13));
  }
}

/** Torvehallen from the street: ~5 tiles wide and 4 deep, the arched door in the middle of the front, facing +z. */
function exterior(): Model {
  const m = new Model();
  m.name = "building:market";
  const [w, d, h] = [4.9, 3.6, 2.3];
  m.box([w + 0.2, 0.16, d + 0.2], "#8d857c", [0, 0, -d / 2], 0.02);
  // The hall: brick below, plaster above with timber framing.
  m.box([w, 1.12, d], BRICK, [0, 0.16, -d / 2], 0.02);
  m.box([w, h - 1.28, d], PLASTER, [0, 1.28, -d / 2], 0.02);
  m.box([w + 0.06, 0.08, d + 0.06], WOOD_D, [0, 1.26, -d / 2], 0.01);
  for (let i = 0; i < 6; i++) m.box([w, 0.03, 0.02], BRICK_D, [0, 0.3 + i * 0.18, 0.012], 0.004);
  for (const x of [-2.35, -1.2, 1.2, 2.35]) m.box([0.08, h - 1.34, 0.04], WOOD_D, [x, 1.32, 0.02], 0.008);
  m.box([w + 0.06, 0.08, 0.06], WOOD_D, [0, h - 0.06, 0.02], 0.01);
  for (const s of [-1, 1]) {
    // The sides, plain plaster over brick, with a lit window each.
    const side = m.part([s * (w / 2), 0, -d / 2], (s * Math.PI) / 2);
    const pane = side.box([1.0, 0.7, 0.04], "#fbe7bd", [0, 0.75, 0.0], 0.01);
    nightGlow(pane, "#ffd592");
    side.box([1.12, 0.06, 0.07], WOOD_D, [0, 0.72, 0.0], 0.01);
    side.box([0.04, 0.74, 0.06], WOOD_D, [0, 0.74, 0.0], 0.004);
  }
  // The false front: a parapet over the whole width, a gold cap and finials, the sign on its face.
  m.box([w + 0.12, 0.8, 0.2], PLASTER, [0, h, -0.1], 0.02);
  m.box([w + 0.2, 0.08, 0.28], GOLD, [0, h + 0.8, -0.1], 0.02);
  m.box([w + 0.2, 0.06, 0.28], WOOD_D, [0, h - 0.03, -0.1], 0.015);
  for (const s of [-1, 0, 1]) {
    m.box([0.2, 0.2, 0.2], PLASTER, [s * (w / 2 + 0.02), h + 0.88, -0.1], 0.02);
    m.ball(0.1, GOLD, [s * (w / 2 + 0.02), h + 1.1, -0.1], [1, 1, 1], 8);
  }
  const sign = signBoard(3.7, 0.5, [{ text: "TORVEHALLEN", color: CREAM, size: 0.62, y: 0.52 }]);
  sign.position.set(0, h + 0.1, 0.0);
  m.add(sign);
  for (const s of [-1, 1]) {
    const lamp = m.ball(0.08, BULB, [s * 2.2, h + 0.4, 0.06], [1, 1.2, 1], 8);
    nightGlow(lamp, "#ffffff");
    m.cyl(0.02, 0.18, BRASS, [s * 2.2, h + 0.18, 0.04], 0.02, 6);
  }
  // The roof behind it: two tiled slopes under a ridge.
  const slope = 0.28;
  const run = d / 2;
  const len = run / Math.cos(slope);
  const rise = Math.tan(slope) * run;
  for (const s of [1, -1]) {
    const slab = m.box([w + 0.5, 0.1, len + (s < 0 ? 0.4 : 0)], ROOF, [0, 0, 0], 0.01);
    slab.position.set(0, h + rise / 2, -d / 2 + (s * (run + (s < 0 ? 0.4 : 0))) / 2);
    slab.rotation.x = s * slope;
  }
  m.box([w + 0.52, 0.1, 0.16], tint(ROOF, -0.15), [0, h + rise, -d / 2], 0.02);
  // The doorway: a dark arch with a lit hall behind it, a brass frame, and a threshold step.
  m.ball(0.69, WOOD_L, [0, 1.84, 0.015], [1, 0.62, 0.1], 14);
  m.box([1.38, 1.7, 0.08], WOOD_L, [0, 0.16, 0.0], 0.01);
  m.ball(0.62, "#2a1a14", [0, 1.84, 0.045], [1, 0.62, 0.1], 14);
  m.box([1.24, 1.68, 0.1], "#2a1a14", [0, 0.16, 0.03], 0.01);
  nightGlow(m.box([1.0, 1.6, 0.04], "#fbe7bd", [0, 0.16, 0.065], 0.005), "#ffd592");
  nightGlow(m.ball(0.5, "#fbe7bd", [0, 1.76, 0.07], [1, 0.62, 0.1], 14), "#ffd592");
  m.box([1.6, 0.1, 0.5], "#8d857c", [0, 0, 0.26], 0.02);
  // Two window displays with awnings; the bunting along the eave.
  for (const [s, seed] of [
    [-1, 11],
    [1, 23],
  ] as const) {
    windowDisplay(m, s * 1.75, seed);
    awning(m, s * 1.75, 1.5, 1.72, 0.55, 0.3);
  }
  const flags = new Model();
  const flagAt = (u: number): [number, number, number] => [
    -2.35 + 4.7 * u,
    2.3 - 0.14 * 4 * u * (1 - u),
    0.1,
  ];
  for (let i = 0; i < 24; i++) wire(flags, flagAt(i / 24), flagAt((i + 1) / 24));
  for (let i = 0; i < 11; i++) {
    const [fx, fy, fz] = flagAt((i + 0.5) / 11);
    const flag = flags.box([0.13, 0.13, 0.012], TOYS[[0, 2, 1, 3, 7][i % 5]!]!, [fx, fy - 0.1, fz], 0.002);
    flag.rotation.z = Math.PI / 4;
  }
  m.add(flags);
  // On the ground: crates of toys, the chalkboard, a planter either side of the door.
  crates(m, -2.7, 0.65, 0.15);
  const board = chalkboard();
  board.position.set(2.75, 0, 0.7);
  board.rotation.y = -0.25;
  m.add(board);
  for (const x of [-0.95, 0.95]) {
    const pot = planter();
    pot.position.set(x, 0, 0.55);
    pot.scale.setScalar(0.8);
    m.add(pot);
  }
  light(m, [0, 1.3, 1.2], "#ffd9a8", 2.4, 6);
  return m;
}

// MARK: The keeper

/** Torvald: shirtsleeves, a green-teal apron, rolled up cuffs, never sells a thing himself. */
function makeKeeper(): Avatar {
  const look = personLook({
    skin: SKINS[1]!,
    hair: "#8a7358",
    style: 2,
    outfit: ["#efe6d2", "#d2c5a4"],
    pants: "#4a3a2c",
    hat: "none",
  });
  const a = new Avatar(look);
  const b = a.body;
  b.box([0.32, 0.4, 0.02], TEAL, [0, 0.12, 0.1], 0.008);
  b.box([0.34, 0.03, 0.025], TEAL_D, [0, 0.5, 0.1], 0.004);
  b.box([0.14, 0.1, 0.022], "#f6ead0", [0, 0.26, 0.112], 0.004);
  return a;
}

// MARK: The room

const asset = (
  id: string,
  name: string,
  w: number,
  d: number,
  build: () => Model,
  extra: Partial<Asset> = {},
): Asset => ({ id, name, price: 0, w, d, build, ...extra });

/** The runs of `ch` in the plan, as room tiles: where each starts and how long it is. */
function runs(ch: string): { x: number; z: number; n: number }[] {
  const out: { x: number; z: number; n: number }[] = [];
  for (const [y, row] of SHOPS.market.rows.entries()) {
    let x = 0;
    while (x < row.length) {
      if (row[x] !== ch) {
        x++;
        continue;
      }
      let n = 0;
      while (row[x + n] === ch) n++;
      out.push({ x: x - 1, z: y - 2, n });
      x += n;
    }
  }
  return out;
}

function buildInterior(): ReturnType<ShopSpec["buildInterior"]> & { slots: MarketSlots } {
  const room = new Room(W, D, { floor: "#dfc99f", wall: PLASTER, stripe: "#ead2a2", bare: true });
  // Tiles for a floor: cream and sand, a square a tile.
  room.setDecor({ floor: { texture: checker("#f2e6c9", "#dfc99f", 2), span: 2, color: "#e8d6b0" } });

  // The shelf units and glass cases are the plan's runs of display tiles; the first row is the back wall.
  for (const r of runs(SHOP_DISPLAY_CHAR.market)) {
    const onWall = r.z === 0;
    room.place(
      onWall
        ? asset(`market:shelf-${r.x}`, "Shelf", r.n, 1, () => shelfUnit(r.n))
        : asset(`market:case-${r.x}-${r.z}`, "Glass case", r.n, 1, () => vitrine(r.n)),
      r.x,
      r.z,
    );
  }
  // The fixtures: a pilaster in the back wall's row, a planter on the floor.
  for (const r of runs("‡"))
    for (let x = r.x; x < r.x + r.n; x++)
      room.place(
        r.z === 0
          ? asset(`market:pilaster-${x}`, "Pilaster", 1, 1, pilaster)
          : asset(`market:planter-${x}-${r.z}`, "Planter", 1, 1, planter),
        x,
        r.z,
      );
  // The sign over the middle of the wall, above the shelves' headers.
  room.hang(signBoard(4.6, 0.46, [{ text: "TORVEHALLEN", color: CREAM, size: 0.62, y: 0.52 }]), W / 2, 1.9);

  // The counter and Torvald behind it; a runner from the door to it.
  for (const r of runs("¢"))
    room.place(
      asset(`market:counter-${r.x}`, "Counter", r.n, 1, () => counter(r.n)),
      r.x,
      r.z,
    );
  const [kx, kz] = SHOPS.market.keeper;
  const keeper = makeKeeper();
  keeper.root.position.set(kx - 1 + 0.5, 0.02, kz - 2 + 0.4);
  room.group.add(keeper.root);
  const [dx, dz] = SHOPS.market.door;
  room.place(asset("rug", "Runner", 1, 5, runner), dx - 1, dz - 2 - 4);

  // The door: an exit in the south wall, and festoon lights across the aisles.
  const door = exitDoorway({ outside: true, wall: PLASTER, leaf: WOOD_D });
  door.position.set(dx - 1 + 0.5, 0, D + 0.5);
  door.rotation.y = Math.PI;
  room.group.add(door);
  const strings = new Model();
  for (const z of [3.5, 6.5]) festoon(strings, [0.2, 2.35, z], [W - 0.2, 2.35, z], 22, 0.3);
  room.group.add(strings);
  const glowAt = new Model();
  light(glowAt, [W / 2, 2.2, 3.5], "#ffe2a8", 1.2, 9);
  light(glowAt, [W / 2, 2.2, 8.5], "#ffe2a8", 1.0, 9);
  room.group.add(glowAt);

  // What is on display arrives from the server: the live layer stands on the slots.
  const slots = new MarketSlots();
  room.group.add(slots.group);

  let last = 0;
  ticks.push((t) => {
    const dt = Math.min(0.1, Math.max(0, t - last));
    last = t;
    keeper.update(dt, t);
  });

  const [cx, cz] = SHOPS.market.counter;
  return { room, displays: [], shopkeeper: keeper, counter: [cx - 1, cz - 2], door: [dx - 1, dz - 2], slots };
}

const NO_ITEMS: ShopItem[] = [];

export const SHOP_MARKET: ShopSpec = {
  id: "market",
  name: "Torvehallen",
  sign: "TORVEHALLEN",
  items: NO_ITEMS,
  exterior,
  footprint: { w: 5, d: 4 },
  buildInterior,
};
