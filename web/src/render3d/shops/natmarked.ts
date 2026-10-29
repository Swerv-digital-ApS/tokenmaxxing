/**
 * Natmarked ("night market"), the case shop: a small covered night-market hall. From the street: dark timber
 * under a tiled double roof, a string of red paper lanterns along the eave, an indigo noren curtain in the
 * doorway, a neon signboard and an ÅBEN blade sign, and a steaming food stall on the corner. Inside: a lacquered
 * counter with the current case on its own stand, lanterns strung across the room, a noodle bar and a tea stall
 * with stools, and along the back wall glowing shelves where the cases to come sit as locked silhouettes.
 *
 * The cases themselves are `core/src/cases.ts`; this is only the building. The shelves are the shop's displays
 * in the 2D plan (`SHOPS.natmarked`), and E on any of them opens the case page (`hud/CaseShop.tsx`).
 */
import { CASE_SHELVES, CASES } from "@tokenmaxxing/core/cases.ts";
import * as THREE from "three";
import { HAIRS, SKINS } from "../../art/palette.ts";
import { buildCaseBox } from "../case-box3d.ts";
import { type Asset, light } from "../furniture/furniture.ts";
import { Model, ticks, tint } from "../kit/kit.ts";
import { panel } from "../kit/panel.ts";
import { Avatar, personLook } from "../people/avatar.ts";
import { exitDoorway } from "../rooms/exits3d.ts";
import { Room, type Turn } from "../rooms/room.ts";
import { nightGlow } from "../town/props.ts";
import type { ShopItem, ShopSpec } from "./furniture.ts";

// MARK: Palette

const TIMBER = "#4a3226";
const TIMBER_D = "#2f2019";
const TIMBER_L = "#6e4b38";
const RED = "#d8402f";
const RED_D = "#a42a22";
const GOLD = "#e9b73d";
const PAPER = "#fff1c9";
const INDIGO = "#243a73";
const LACQUER = "#1d1822";
const ROOF = "#3b3750";
const PINK = "#ff5fa8";
const CYAN = "#58e6ff";

/** The accent of each shelf, one per `CASE_SHELVES`. */
const SHELF_GLOW = ["#ffb347", "#5fd7ff", "#ff6fb5", "#9b7bff", "#6bffb0", "#ffd36a"] as const;

const W = 18;
const D = 12;

// MARK: Pieces

/** A paper lantern hanging with its top at y = 0: lit red, a gold cap and foot, a tassel. */
function lantern(m: Model, at: [number, number, number], r = 0.1, color = RED): void {
  const [x, y, z] = at;
  const body = m.ball(r, color, [x, y - r * 1.25, z], [1, 1.25, 1], 10);
  nightGlow(body, "#ff9a52");
  m.cyl(r * 0.5, 0.025, GOLD, [x, y - 0.02, z], r * 0.5, 8);
  m.cyl(r * 0.5, 0.02, GOLD, [x, y - r * 2.5 - 0.005, z], r * 0.5, 8);
  for (const dy of [-0.5, 0, 0.5])
    m.cyl(r * 1.02, 0.012, RED_D, [x, y - r * 1.25 + dy * r * 1.2, z], r * 1.02, 10);
  m.cyl(0.006, 0.07, RED, [x, y - r * 2.5 - 0.08, z], 0.006, 4);
}

/** A thin wire between two points. */
function wire(m: Model, a: [number, number, number], b: [number, number, number], color = "#5a3a2c"): void {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const dz = b[2] - a[2];
  const len = Math.hypot(dx, dy, dz);
  const s = m.box(
    [0.014, 0.014, len],
    color,
    [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2],
    0.002,
  );
  s.rotation.order = "YXZ";
  s.rotation.y = Math.atan2(dx, dz);
  s.rotation.x = -Math.atan2(dy, Math.hypot(dx, dz));
  s.castShadow = false;
}

/** A string of `n` lanterns hung between two points, sagging by `sag` in the middle. */
function lanternString(
  m: Model,
  a: [number, number, number],
  b: [number, number, number],
  n: number,
  sag: number,
  r = 0.1,
): void {
  const at = (u: number): [number, number, number] => [
    a[0] + (b[0] - a[0]) * u,
    a[1] + (b[1] - a[1]) * u - sag * 4 * u * (1 - u),
    a[2] + (b[2] - a[2]) * u,
  ];
  const segs = n * 2;
  for (let i = 0; i < segs; i++) wire(m, at(i / segs), at((i + 1) / segs));
  for (let i = 0; i < n; i++) {
    const p = at((i + 0.5) / n);
    lantern(m, p, r, i % 4 === 3 ? "#f08a3c" : RED);
  }
}

/** A neon sign: text with a glow on a dark board, lit. */
function neon(
  w: number,
  h: number,
  lines: { text: string; color: string; size: number; y: number }[],
  frame = TIMBER_D,
): ReturnType<typeof panel> {
  return panel(
    w,
    h,
    (g, cw, ch) => {
      g.fillStyle = "#120d18";
      g.fillRect(0, 0, cw, ch);
      g.textAlign = "center";
      g.textBaseline = "middle";
      for (const l of lines) {
        g.font = `900 ${Math.round(ch * l.size)}px system-ui, sans-serif`;
        g.shadowColor = l.color;
        g.shadowBlur = ch * 0.18;
        g.fillStyle = l.color;
        g.fillText(l.text, cw / 2, ch * l.y, cw * 0.92);
        g.shadowBlur = ch * 0.04;
        g.fillStyle = tint(l.color, 0.55);
        g.fillText(l.text, cw / 2, ch * l.y, cw * 0.92);
      }
      g.shadowBlur = 0;
      g.strokeStyle = lines[0]!.color;
      g.lineWidth = Math.max(2, ch * 0.04);
      g.strokeRect(ch * 0.06, ch * 0.06, cw - ch * 0.12, ch * 0.88);
    },
    { px: 110, lit: true, smooth: true, frame },
  );
}

/** A plaque: a name on cream paper. */
function plaque(w: number, h: number, text: string, sub?: string, lit = false): ReturnType<typeof panel> {
  return panel(
    w,
    h,
    (g, cw, ch) => {
      g.fillStyle = PAPER;
      g.fillRect(0, 0, cw, ch);
      g.fillStyle = RED_D;
      g.fillRect(0, 0, cw, Math.max(2, ch * 0.09));
      g.fillStyle = "#2a1a1a";
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.font = `900 ${Math.round(ch * (sub ? 0.34 : 0.46))}px system-ui, sans-serif`;
      g.fillText(text, cw / 2, ch * (sub ? 0.42 : 0.55), cw * 0.92);
      if (sub) {
        g.fillStyle = RED_D;
        g.font = `700 ${Math.round(ch * 0.22)}px system-ui, sans-serif`;
        g.fillText(sub, cw / 2, ch * 0.76, cw * 0.92);
      }
    },
    { px: 90, smooth: true, lit, frame: TIMBER_D },
  );
}

/** Puffs of steam rising from `at` (a ticking loop). */
function steam(m: Model, at: [number, number, number], n = 4, rise = 0.7, size = 0.09): void {
  const puffs = Array.from({ length: n }, () => {
    const mat = new THREE.MeshBasicMaterial({
      color: "#ffffff",
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    return { mat, mesh: m.ball(size, mat, at, [1, 1, 1], 8) };
  });
  for (const p of puffs) p.mesh.castShadow = false;
  ticks.push((t) => {
    puffs.forEach((p, i) => {
      const u = (t * 0.42 + i / n) % 1;
      p.mesh.position.set(
        at[0] + Math.sin(u * 5 + i * 2) * 0.05,
        at[1] + u * rise,
        at[2] + Math.cos(u * 4 + i) * 0.04,
      );
      p.mesh.scale.setScalar(0.6 + u * 1.3);
      p.mat.opacity = 0.5 * Math.sin(Math.PI * Math.min(1, u * 1.1)) ** 1.2;
    });
  });
}

/** A noren: indigo cloth panels hung from a rod, each with a pale moon; they sway. */
function noren(width: number, drop: number, panels = 3): Model {
  const m = new Model();
  m.box([width + 0.2, 0.05, 0.05], TIMBER_L, [0, 0, 0], 0.01);
  const pw = (width - 0.04 * (panels - 1)) / panels;
  const cloth: Model[] = [];
  for (let i = 0; i < panels; i++) {
    const x = -width / 2 + pw / 2 + i * (pw + 0.04);
    const hang = m.part([x, 0.01, 0.03]);
    hang.box([pw, drop, 0.025], INDIGO, [0, -drop, 0], 0.006);
    hang.box([pw, 0.05, 0.03], "#f3efe2", [0, -drop, 0.002], 0.004);
    const moon = hang.ball(pw * 0.25, "#f3efe2", [0, -drop * 0.55, 0.016], [1, 1, 0.12], 12);
    nightGlow(moon, "#fff2c4");
    hang.ball(pw * 0.2, INDIGO, [pw * 0.1, -drop * 0.55 + 0.02, 0.024], [1, 1, 0.12], 12);
    cloth.push(hang);
  }
  ticks.push((t) => {
    for (const [i, c] of cloth.entries()) c.rotation.x = Math.sin(t * 1.3 + i * 0.9) * 0.04;
  });
  return m;
}

/** A stool: a round wooden seat on three legs, `h` high. */
function stool(): Model {
  const m = new Model();
  m.cyl(0.19, 0.06, TIMBER_L, [0, 0.3, 0], 0.19, 12);
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    const leg = m.cyl(0.03, 0.32, TIMBER_D, [Math.sin(a) * 0.1, 0, Math.cos(a) * 0.1], 0.025, 6);
    leg.rotation.set(Math.cos(a) * -0.14, 0, Math.sin(a) * 0.14);
  }
  m.cyl(0.17, 0.02, RED, [0, 0.36, 0], 0.17, 12);
  return m;
}

/** A small round table with a tea set and a candle lantern. */
function teaTable(): Model {
  const m = new Model();
  m.cyl(0.3, 0.04, LACQUER, [0, 0.62, 0], 0.3, 14);
  m.cyl(0.04, 0.62, TIMBER_D, [0, 0, 0], 0.04, 6);
  m.cyl(0.18, 0.03, TIMBER_D, [0, 0, 0], 0.18, 10);
  m.cyl(0.07, 0.08, "#f3efe2", [-0.1, 0.66, 0.05], 0.06, 10);
  m.cyl(0.03, 0.04, "#f3efe2", [0.12, 0.66, 0.1], 0.025, 8);
  m.cyl(0.03, 0.04, "#f3efe2", [0.14, 0.66, -0.08], 0.025, 8);
  const lamp = m.ball(0.07, RED, [0.0, 0.76, -0.1], [1, 1.2, 1], 8);
  nightGlow(lamp, "#ffae5c");
  light(m, [0, 1.0, 0], "#ff9d5c", 0.6, 2.4);
  return m;
}

/** A timber post with a red lantern on top, 1x1. */
function post(): Model {
  const m = new Model();
  m.box([0.22, 2.2, 0.22], TIMBER_D, [0, 0, 0], 0.02);
  m.box([0.3, 0.1, 0.3], TIMBER_L, [0, 0.0, 0], 0.02);
  m.box([0.3, 0.08, 0.3], TIMBER_L, [0, 2.1, 0], 0.02);
  m.box([0.04, 0.5, 0.04], TIMBER_L, [0.17, 1.75, 0], 0.008);
  m.box([0.35, 0.04, 0.04], TIMBER_L, [0.0, 2.2, 0], 0.008);
  lantern(m, [0.17, 1.72, 0.0], 0.11);
  return m;
}

/** A hand-lettered menu board. */
function menu(w: number, h: number, title: string, rows: [string, string][]): ReturnType<typeof panel> {
  return panel(
    w,
    h,
    (g, cw, ch) => {
      g.fillStyle = "#16221e";
      g.fillRect(0, 0, cw, ch);
      g.fillStyle = "#ffe28a";
      g.textAlign = "center";
      g.font = `900 ${Math.round(ch * 0.17)}px system-ui, sans-serif`;
      g.fillText(title, cw / 2, ch * 0.2, cw * 0.9);
      g.font = `600 ${Math.round(ch * 0.12)}px system-ui, sans-serif`;
      rows.forEach(([a, b], i) => {
        g.textAlign = "left";
        g.fillStyle = "#f3efe2";
        g.fillText(a, cw * 0.1, ch * (0.42 + i * 0.18), cw * 0.55);
        g.textAlign = "right";
        g.fillStyle = "#8fe3a0";
        g.fillText(b, cw * 0.9, ch * (0.42 + i * 0.18));
      });
    },
    { px: 80, smooth: true, frame: TIMBER_D },
  );
}

// MARK: The street side

/** The striped stall canopy, sloping from the back (high) to the front (low). */
function canopy(m: Model, w: number, y: number, back: number, front: number, drop: number): void {
  const n = 8;
  const sw = w / n;
  const reach = front - back;
  const len = Math.hypot(reach, drop);
  for (let i = 0; i < n; i++) {
    const x = -w / 2 + (i + 0.5) * sw;
    const c = i % 2 ? PAPER : RED;
    const s = m.box([sw, 0.035, len], c, [x, y, 0], 0.005);
    s.position.set(x, y - drop / 2, (back + front) / 2);
    s.rotation.x = Math.atan2(drop, reach);
    m.box([sw * 0.92, 0.09, 0.025], c, [x, y - drop - 0.08, front + 0.01], 0.01);
  }
}

/** A food stall on the corner: counter, canopy, a steaming pot and bowls. Faces +z. */
function streetStall(): Model {
  const m = new Model();
  for (const s of [-1, 1]) m.box([0.07, 1.5, 0.07], TIMBER_D, [s * 0.62, 0, 0.32], 0.01);
  m.box([1.3, 0.78, 0.5], TIMBER, [0, 0, 0.05], 0.02);
  m.box([1.4, 0.06, 0.6], LACQUER, [0, 0.78, 0.05], 0.015);
  m.box([1.2, 0.3, 0.03], RED_D, [0, 0.28, 0.31], 0.01);
  canopy(m, 1.45, 1.55, -0.28, 0.5, 0.26);
  // The pot with its lid ajar, the steam rising, and a ladle.
  m.cyl(0.19, 0.2, "#9aa3ad", [-0.3, 0.84, 0.05], 0.19, 14);
  m.cyl(0.2, 0.025, "#6e7681", [-0.3, 1.03, 0.05], 0.2, 14);
  steam(m, [-0.3, 1.08, 0.05], 5, 0.8, 0.1);
  m.cyl(0.012, 0.3, TIMBER_L, [-0.12, 0.84, 0.15], 0.012, 5).rotation.z = -0.6;
  // Bowls, a bamboo steamer, a jar of chopsticks.
  for (const x of [0.12, 0.28]) m.cyl(0.07, 0.06, "#f3efe2", [x, 0.84, 0.2], 0.05, 10);
  m.cyl(0.14, 0.09, "#c9a05a", [0.36, 0.84, -0.05], 0.14, 12);
  m.cyl(0.14, 0.09, "#d8b06a", [0.36, 0.93, -0.05], 0.14, 12);
  m.cyl(0.04, 0.12, "#f3efe2", [0.52, 0.84, 0.18], 0.04, 8);
  // Lanterns on the canopy's lip.
  for (const x of [-0.5, 0, 0.5]) lantern(m, [x, 1.34, 0.5], 0.07);
  light(m, [0, 1.2, 0.3], "#ff9d5c", 1.4, 4);
  return m;
}

/** Natmarked from the street: ~5 tiles wide and 4 deep, the door in the middle of the front, facing +z. */
function exterior(): Model {
  const m = new Model();
  m.name = "building:natmarked";
  const [w, d, h] = [4.9, 3.6, 2.3];
  m.box([w + 0.2, 0.16, d + 0.2], "#6b6470", [0, 0, -d / 2], 0.02);
  m.box([w, h - 0.16, d], TIMBER, [0, 0.16, -d / 2], 0.02);
  // Board-and-batten: vertical battens across the front and the sides.
  for (let i = 0; i <= 14; i++) {
    const x = -w / 2 + 0.1 + i * ((w - 0.2) / 14);
    m.box([0.05, h - 0.2, 0.03], TIMBER_D, [x, 0.18, 0.02], 0.005);
  }
  for (const [sx, rot] of [
    [w / 2, Math.PI / 2],
    [-w / 2, -Math.PI / 2],
  ] as const) {
    const side = m.part([sx, 0, -d / 2], rot);
    for (let i = 0; i <= 9; i++)
      side.box([0.05, h - 0.2, 0.03], TIMBER_D, [-d / 2 + 0.2 + i * ((d - 0.4) / 9), 0.18, 0.0], 0.005);
    // A paper-screen window on each side, glowing.
    const pane = side.box([1.1, 0.7, 0.04], "#f6e6bf", [0, 0.8, 0.01], 0.01);
    nightGlow(pane, "#ffcf86");
    for (const gx of [-0.37, 0, 0.37]) side.box([0.03, 0.74, 0.05], TIMBER_D, [gx, 0.78, 0.02], 0.004);
    side.box([1.2, 0.04, 0.06], TIMBER_D, [0, 0.78, 0.02], 0.004);
  }
  // The roof: two tiled slopes under a gold-tipped ridge, with a deep front eave over the lanterns.
  const slope = 0.3;
  const run = d / 2 + 0.4;
  const len = run / Math.cos(slope);
  const rise = Math.tan(slope) * run;
  for (const s of [1, -1]) {
    const slab = m.box([w + 0.7, 0.1, len], ROOF, [0, 0, 0], 0.01);
    slab.position.set(0, h + rise / 2, -d / 2 + (s * run) / 2);
    slab.rotation.x = s * slope;
    for (let i = 1; i < 6; i++) {
      const rib = m.box([w + 0.72, 0.03, 0.04], "#1f1d29", [0, 0, 0], 0.004);
      const u = i / 6;
      rib.position.set(0, h + rise * (1 - u) + 0.07, -d / 2 + s * run * u);
      rib.rotation.x = s * slope;
    }
  }
  m.box([w + 0.75, 0.1, 0.16], ROOF, [0, h + rise, -d / 2], 0.02);
  for (const x of [-1, 1]) m.box([0.14, 0.2, 0.2], GOLD, [x * (w / 2 + 0.38), h + rise - 0.04, -d / 2], 0.03);
  // The door: a dark opening, a lintel, and the noren across it.
  m.box([1.25, 1.65, 0.1], "#140d0b", [0, 0.16, 0.0], 0.01);
  m.box([1.5, 0.12, 0.14], TIMBER_L, [0, 1.8, 0.03], 0.015);
  for (const s of [-1, 1]) m.box([0.12, 1.8, 0.14], TIMBER_L, [s * 0.69, 0.16, 0.03], 0.015);
  const curtain = noren(1.14, 0.78);
  curtain.position.set(0, 1.72, 0.08);
  m.add(curtain);
  m.box([1.5, 0.1, 0.55], "#6b6470", [0, 0, 0.3], 0.02);
  // Two slatted shop windows with warm paper behind, either side of the door.
  for (const s of [-1, 1]) {
    const x = s * 1.75;
    m.box([1.3, 0.95, 0.07], TIMBER_L, [x, 0.55, 0.02], 0.015);
    const paper = m.box([1.12, 0.77, 0.05], "#f6e6bf", [x, 0.64, 0.05], 0.01);
    nightGlow(paper, "#ffc47a");
    for (let i = -2; i <= 2; i++) m.box([0.035, 0.8, 0.06], TIMBER_D, [x + i * 0.22, 0.62, 0.07], 0.004);
    m.box([1.2, 0.035, 0.06], TIMBER_D, [x, 1.0, 0.07], 0.004);
    m.box([1.4, 0.05, 0.22], TIMBER_L, [x, 0.5, 0.12], 0.01);
    // Silhouettes of crates and a lantern against the glow.
    m.box([0.28, 0.2, 0.12], "#241719", [x - 0.3, 0.55, 0.12], 0.015);
    m.box([0.2, 0.28, 0.12], "#241719", [x + 0.05, 0.55, 0.12], 0.015);
    m.ball(0.1, "#241719", [x + 0.35, 0.68, 0.12], [1, 1.2, 0.6], 8);
  }
  // The neon signboard stands on the roof over the door, and the ÅBEN blade sign hangs at the corner.
  const sign = neon(3.3, 0.55, [{ text: "NATMARKED", color: PINK, size: 0.6, y: 0.52 }]);
  sign.position.set(0, 2.78, -0.95);
  m.add(sign);
  for (const x of [-1.4, 1.4]) m.box([0.08, 0.5, 0.08], TIMBER_D, [x, 2.5, -1.0], 0.01);
  const blade = neon(0.42, 1.0, [
    { text: "ÅBEN", color: CYAN, size: 0.2, y: 0.3 },
    { text: "OPEN", color: PINK, size: 0.17, y: 0.7 },
  ]);
  blade.position.set(-2.62, 0.7, 0.3);
  m.add(blade);
  m.box([0.05, 0.05, 0.28], TIMBER_L, [-2.62, 1.76, 0.15], 0.008);
  // The lantern string along the front eave, and a second sagging across the street side.
  lanternString(m, [-2.5, 2.22, 0.5], [2.5, 2.22, 0.5], 9, 0.12, 0.11);
  for (const s of [-1, 1]) m.box([0.07, 0.12, 0.07], GOLD, [s * 2.5, 2.16, 0.5], 0.01);
  // The corner stall, with its own steam; crates and a lantern post on the other side.
  const stall = streetStall();
  stall.position.set(3.25, 0, 0.95);
  stall.rotation.y = -0.18;
  m.add(stall);
  for (const [x, z, r] of [
    [-3.1, 0.7, 0.2],
    [-2.9, 1.25, -0.3],
  ] as const) {
    const c = m.box([0.5, 0.4, 0.4], TIMBER_L, [x, 0, z], 0.02);
    c.rotation.y = r;
    for (const dy of [0.12, 0.28]) m.box([0.52, 0.025, 0.42], TIMBER_D, [x, dy, z], 0.005).rotation.y = r;
  }
  m.cyl(0.02, 1.5, TIMBER_D, [-3.1, 0.4, 0.7], 0.02, 6);
  lantern(m, [-3.1, 1.95, 0.7], 0.12);
  // Paper lanterns on the ground by the door.
  for (const s of [-1, 1]) {
    m.cyl(0.1, 0.02, GOLD, [s * 0.95, 0, 0.55], 0.1, 8);
    nightGlow(m.ball(0.11, RED, [s * 0.95, 0.19, 0.55], [1, 1.2, 1], 10), "#ff9a52");
    m.cyl(0.1, 0.02, GOLD, [s * 0.95, 0.32, 0.55], 0.1, 8);
  }
  light(m, [0, 1.3, 1.2], "#ff9d5c", 3, 6);
  return m;
}

// MARK: Interior pieces

const asset = (
  id: string,
  name: string,
  w: number,
  d: number,
  build: () => Model,
  extra: Partial<Asset> = {},
): Asset => ({ id, name, price: 0, w, d, build, ...extra });

/** A small padlock, gold, hanging on a plaque. */
function padlock(m: Model, at: [number, number, number]): void {
  m.box([0.09, 0.08, 0.04], GOLD, at, 0.01);
  m.box([0.012, 0.07, 0.02], GOLD, [at[0] - 0.025, at[1] + 0.08, at[2]], 0.002);
  m.box([0.012, 0.07, 0.02], GOLD, [at[0] + 0.025, at[1] + 0.08, at[2]], 0.002);
  m.box([0.062, 0.012, 0.02], GOLD, [at[0], at[1] + 0.14, at[2]], 0.002);
  m.box([0.012, 0.03, 0.045], LACQUER, [at[0], at[1] + 0.025, at[2]], 0.002);
}

/** The dark shape of a case to come: `i` picks which, all backlit by the shelf. */
function silhouette(m: Model, i: number, y: number): void {
  const dark = "#0e0a14";
  switch (i % 5) {
    case 1: // a crate with a lid
      m.box([0.72, 0.42, 0.42], dark, [0, y, 0.0], 0.04);
      m.box([0.78, 0.12, 0.46], dark, [0, y + 0.42, 0.0], 0.04);
      break;
    case 2: {
      // a round-lidded trunk
      m.box([0.78, 0.34, 0.44], dark, [0, y, 0.0], 0.04);
      const lid = m.cyl(0.22, 0.78, dark, [0.39, y + 0.34, 0], 0.22, 14);
      lid.rotation.z = Math.PI / 2;
      lid.scale.set(1, 1, 0.9);
      break;
    }
    case 3: // a tall cabinet with a knob
      m.box([0.48, 0.74, 0.4], dark, [0, y, 0.0], 0.04);
      m.ball(0.04, dark, [0.13, y + 0.4, 0.22], [1, 1, 1], 6);
      break;
    case 4: // a drum
      m.cyl(0.3, 0.5, dark, [0, y, 0], 0.3, 14);
      m.cyl(0.32, 0.05, dark, [0, y + 0.5, 0], 0.32, 14);
      break;
    default: // a long scroll case
      m.box([0.9, 0.28, 0.32], dark, [0, y, 0.0], 0.04);
      m.box([0.1, 0.34, 0.36], dark, [-0.4, y - 0.03, 0.0], 0.03);
      m.box([0.1, 0.34, 0.36], dark, [0.4, y - 0.03, 0.0], 0.03);
  }
}

/** One lit shelf unit, 2x1, facing +z against the north wall. Shelf `i` shows `CASES[i]`; a shelf with no case yet is locked. */
function shelf(i: number): Model {
  const m = new Model();
  const glowColor = SHELF_GLOW[i % SHELF_GLOW.length]!;
  const def = CASES[i];
  // Cabinet below, the glowing niche above, a cornice and lit edge strips.
  m.box([1.96, 0.62, 0.9], TIMBER, [0, 0, -0.04], 0.02);
  for (const x of [-0.49, 0.49]) m.box([0.9, 0.5, 0.03], TIMBER_D, [x, 0.06, 0.42], 0.01);
  for (const x of [-0.12, 0.12]) m.ball(0.025, GOLD, [x, 0.3, 0.45], [1, 1, 0.6], 6);
  m.box([2.0, 0.07, 0.94], TIMBER_L, [0, 0.62, -0.04], 0.015);
  const back = m.box([1.8, 1.0, 0.05], tint(glowColor, 0.1), [0, 0.69, -0.45], 0.01);
  nightGlow(back, glowColor);
  for (const x of [-0.94, 0.94]) m.box([0.12, 1.1, 0.8], TIMBER, [x, 0.62, -0.1], 0.015);
  m.box([2.0, 0.1, 0.9], TIMBER_L, [0, 1.76, -0.05], 0.015);
  m.box([2.04, 0.04, 0.94], GOLD, [0, 1.86, -0.05], 0.01);
  const strip = m.box([1.8, 0.03, 0.06], glowColor, [0, 1.7, 0.32], 0.004);
  nightGlow(strip, glowColor);
  const strip2 = m.box([1.8, 0.03, 0.06], glowColor, [0, 0.69, 0.4], 0.004);
  nightGlow(strip2, glowColor);
  if (def) {
    const c = buildCaseBox(false, def.id);
    c.scale.setScalar(0.82);
    c.position.set(0, 0.7, -0.05);
    m.add(c);
    const name = def.name.replace(/ case$/i, "").toUpperCase();
    const tag = plaque(0.9, 0.2, name, def.id === "night-market" ? "on the counter" : "a case on sale", true);
    tag.position.set(0, 0.2, 0.46);
    tag.scale.setScalar(0.9);
    m.add(tag);
  } else {
    silhouette(m, i, 0.7);
    const tag = plaque(0.82, 0.2, "COMING SOON", "a case to come");
    tag.position.set(0, 0.2, 0.46);
    tag.scale.setScalar(0.9);
    m.add(tag);
    padlock(m, [0.6, 0.14, 0.46]);
  }
  light(m, [0, 1.2, 0.4], glowColor, 0.7, 3);
  return m;
}

/** The counter: black lacquer with a red front and gold bands; the current case on its stand, an abacus and a lucky cat. */
function counter(): Model {
  const m = new Model();
  const w = 6;
  m.box([w, 0.9, 0.7], LACQUER, [0, 0, 0], 0.03);
  m.box([w - 0.2, 0.7, 0.03], RED_D, [0, 0.1, 0.36], 0.01);
  for (let i = 0; i < 7; i++)
    m.box([0.03, 0.7, 0.035], GOLD, [-w / 2 + 0.1 + i * ((w - 0.2) / 6), 0.1, 0.375], 0.004);
  m.box([w - 0.2, 0.04, 0.04], GOLD, [0, 0.1, 0.375], 0.004);
  m.box([w - 0.2, 0.04, 0.04], GOLD, [0, 0.76, 0.375], 0.004);
  m.box([w + 0.12, 0.07, 0.82], "#120e16", [0, 0.9, 0], 0.02);
  // The stand for the current case: two lacquered steps with gold edges, and a pool of warm light.
  const stand = m.part([1.55, 0.97, 0.0]);
  stand.box([1.15, 0.1, 0.62], RED_D, [0, 0, 0], 0.02);
  stand.box([1.2, 0.025, 0.66], GOLD, [0, 0.1, 0], 0.006);
  stand.box([1.0, 0.07, 0.5], LACQUER, [0, 0.125, 0], 0.015);
  const nm = buildCaseBox(false);
  nm.position.set(0, 0.2, 0.0);
  stand.add(nm);
  const name = plaque(0.9, 0.17, "NIGHT MARKET CASE", undefined, true);
  name.position.set(0, 0.02, 0.34);
  name.rotation.x = -0.4;
  name.scale.setScalar(0.9);
  stand.add(name);
  light(stand, [0, 1.0, 0.4], "#ffc27a", 1.5, 3.5);
  // The till end: an abacus, a brass bell, a stack of tokens.
  const ab = m.part([-1.9, 0.97, 0.0]);
  ab.box([0.5, 0.05, 0.3], TIMBER_L, [0, 0, 0], 0.01);
  for (const z of [-0.12, 0.12]) ab.box([0.5, 0.05, 0.03], TIMBER_L, [0, 0.05, z], 0.005);
  for (let r = 0; r < 4; r++)
    for (let c = 0; c < 6; c++)
      ab.cyl(
        0.025,
        0.02,
        c % 2 ? RED : "#f3efe2",
        [-0.2 + c * 0.08 + (r % 2) * 0.01, 0.06 + r * 0.045 * 0, -0.1 + r * 0.07],
        0.025,
        6,
      );
  m.cyl(0.07, 0.05, GOLD, [-1.2, 0.97, 0.1], 0.05, 10);
  m.ball(0.03, GOLD, [-1.2, 1.03, 0.1], [1, 1, 1], 6);
  for (let i = 0; i < 6; i++) m.cyl(0.05, 0.015, GOLD, [-0.7, 0.97 + i * 0.016, 0.12], 0.05, 10);
  // A lucky cat, paw up, at the far end.
  const cat = m.part([2.75, 0.97, 0.05]);
  cat.ball(0.14, "#f3efe2", [0, 0.14, 0], [1, 1.1, 0.9], 10);
  cat.ball(0.1, "#f3efe2", [0, 0.34, 0.02], [1.1, 1, 0.95], 10);
  for (const s of [-1, 1]) cat.box([0.04, 0.07, 0.03], "#f3efe2", [s * 0.065, 0.4, 0.0], 0.008);
  cat.box([0.06, 0.04, 0.02], RED, [0, 0.27, 0.1], 0.006);
  const paw = cat.part([0.11, 0.2, 0.08]);
  paw.box([0.05, 0.14, 0.05], "#f3efe2", [0, 0, 0], 0.012);
  ticks.push((t) => (paw.rotation.z = Math.sin(t * 2.4) * 0.35));
  light(m, [0, 1.9, 0.0], "#ffd9a8", 1.0, 5);
  return m;
}

/** A noodle bar or a tea stall: a counter facing +z (its front, towards the stools), a back wall and a canopy. */
function stall(kind: "noodles" | "tea"): Model {
  const m = new Model();
  const noodle = kind === "noodles";
  // 2 wide (x), 3 deep (z): the customers' side is z = +1.5.
  m.box([1.9, 1.8, 0.1], TIMBER_D, [0, 0, -1.4], 0.01);
  m.box([1.9, 0.78, 0.55], TIMBER, [0, 0, 0.78], 0.02);
  m.box([2.0, 0.07, 0.7], LACQUER, [0, 0.78, 0.78], 0.015);
  m.box([1.7, 0.45, 0.03], noodle ? RED_D : INDIGO, [0, 0.14, 1.07], 0.01);
  for (const s of [-1, 1]) m.box([0.07, 1.75, 0.07], TIMBER_L, [s * 0.95, 0, 1.15], 0.01);
  canopy(m, 2.1, 1.78, -1.4, 1.4, 0.3);
  // The back shelf and a cooking bench.
  m.box([1.7, 0.7, 0.5], TIMBER, [0, 0, -1.05], 0.02);
  m.box([1.8, 0.05, 0.6], LACQUER, [0, 0.7, -1.05], 0.01);
  m.box([1.7, 0.05, 0.3], TIMBER_L, [0, 1.15, -1.25], 0.01);
  for (let i = 0; i < 5; i++)
    m.cyl(0.06, 0.12, i % 2 ? "#f3efe2" : "#8aa4c8", [-0.7 + i * 0.35, 1.2, -1.25], 0.05, 8);
  if (noodle) {
    m.cyl(0.26, 0.28, "#9aa3ad", [-0.4, 0.75, -1.0], 0.26, 14);
    m.cyl(0.27, 0.03, "#6e7681", [-0.4, 1.02, -1.0], 0.27, 14);
    steam(m, [-0.4, 1.1, -1.0], 5, 0.9, 0.12);
    m.cyl(0.2, 0.2, "#6e7681", [0.35, 0.75, -1.0], 0.2, 12);
    steam(m, [0.35, 0.98, -1.0], 3, 0.7, 0.09);
    for (const x of [-0.5, -0.1, 0.4]) m.cyl(0.085, 0.07, "#f3efe2", [x, 0.85, 0.7], 0.06, 10);
    const board = menu(0.9, 0.55, "NOODLES", [
      ["Tonkotsu", "3"],
      ["Spicy miso", "3"],
      ["Cold soba", "2"],
    ]);
    board.position.set(0.1, 1.15, -1.3);
    board.scale.setScalar(0.9);
    m.add(board);
  } else {
    m.cyl(0.14, 0.2, "#3b2f2f", [-0.4, 0.85, 0.75], 0.1, 12);
    m.cyl(0.015, 0.14, "#3b2f2f", [-0.4, 1.05, 0.75], 0.015, 6);
    steam(m, [-0.4, 1.2, 0.75], 3, 0.6, 0.07);
    for (const x of [-0.1, 0.0, 0.1, 0.2]) m.cyl(0.04, 0.05, "#f3efe2", [x, 0.85, 0.7], 0.03, 8);
    m.cyl(0.17, 0.1, "#c9a05a", [0.5, 0.85, 0.7], 0.17, 12);
    m.cyl(0.17, 0.1, "#d8b06a", [0.5, 0.95, 0.7], 0.17, 12);
    steam(m, [0.5, 1.1, 0.7], 4, 0.7, 0.09);
    const board = menu(0.9, 0.55, "TEA & BUNS", [
      ["Jasmine", "1"],
      ["Red-bean bun", "2"],
      ["Sesame ball", "2"],
    ]);
    board.position.set(0.1, 1.15, -1.3);
    board.scale.setScalar(0.9);
    m.add(board);
  }
  for (const x of [-0.7, 0, 0.7]) lantern(m, [x, 1.46, 1.38], 0.075, x === 0 ? "#f08a3c" : RED);
  light(m, [0, 1.3, 0.6], "#ff9d5c", 1.0, 3.5);
  return m;
}
/** A runner from the door to the counter, flat. */
function runner(): Model {
  const m = new Model();
  m.box([0.9, 0.012, 2.9], RED_D, [0, 0, 0], 0.002);
  m.box([0.74, 0.016, 2.8], "#7c1d1c", [0, 0, 0], 0.002);
  for (const z of [-1.3, -0.65, 0, 0.65, 1.3]) m.box([0.5, 0.02, 0.06], GOLD, [0, 0, z], 0.002);
  return m;
}

// MARK: The keepers

/** Mei: a deep-blue happi coat over a white shirt, a red headband, an abacus-quick hand. */
function makeKeeper(): Avatar {
  const look = personLook({
    skin: SKINS[1]!,
    hair: HAIRS[4]!,
    style: 1,
    outfit: ["#f4efe4", "#cfc7b4"],
    pants: "#2b2f3a",
    hat: "none",
  });
  const a = new Avatar(look);
  const b = a.body;
  b.box([0.3, 0.3, 0.02], INDIGO, [0, 0.38, 0.1], 0.008);
  b.box([0.04, 0.3, 0.022], "#f3efe2", [0, 0.38, 0.105], 0.004);
  for (const s of [-1, 1]) b.box([0.05, 0.24, 0.2], INDIGO, [s * 0.16, 0.4, 0.0], 0.01);
  return a;
}

function makeCook(skin: string, hair: string, tall: boolean): Avatar {
  const a = new Avatar(
    personLook({
      skin,
      hair,
      style: 2,
      outfit: tall ? ["#f4efe4", "#cfc7b4"] : [RED, RED_D],
      pants: "#2b2f3a",
      hat: "none",
    }),
  );
  if (tall) a.head.box([0.3, 0.12, 0.3], "#fbf7ef", [0, 0.2, 0], 0.03);
  a.body.box([0.3, 0.34, 0.02], tall ? "#fbf7ef" : INDIGO, [0, 0.14, 0.1], 0.008);
  return a;
}

// MARK: The room

function buildInterior(): ReturnType<ShopSpec["buildInterior"]> {
  const room = new Room(W, D, { floor: "#33261f", wall: "#43302b", stripe: "#35241f", bare: true });
  const put = (a: Asset, x: number, z: number, turn: Turn = 0) => room.place(a, x, z, turn);

  // The back wall: one lit shelf per case on sale, locked ones for the rest, with a post between each.
  for (let i = 0; i < CASE_SHELVES; i++) {
    put(asset(`natmarked:post-${i}`, "Post", 1, 1, post), i * 3, 0);
    put(
      asset(`natmarked:shelf-${i}`, "Lantern shelf", 2, 1, () => shelf(i)),
      i * 3 + 1,
      0,
    );
  }
  const neonSign = neon(5.4, 0.5, [{ text: "NATMARKED", color: PINK, size: 0.6, y: 0.5 }], TIMBER_D);
  const sub = neon(2.6, 0.26, [{ text: "NIGHT MARKET · ÅBEN", color: CYAN, size: 0.42, y: 0.5 }], TIMBER_D);
  room.hang(neonSign, 9, 2.0);
  room.hang(sub, 14.6, 2.05);
  const glowAt = new Model();
  light(glowAt, [9, 2.1, 1.2], PINK, 1.2, 8);
  room.group.add(glowAt);

  // The noodle bar (west) and tea stall (east), each with a cook behind it and stools in front.
  put(
    asset("natmarked:noodles", "Noodle bar", 2, 3, () => stall("noodles")),
    0,
    2,
    1,
  );
  put(
    asset("natmarked:tea", "Tea stall", 2, 3, () => stall("tea")),
    15,
    2,
    3,
  );
  const stoolAsset = (id: string) => asset(id, "Stool", 1, 1, stool, { seat: { at: [0, 0.4, 0], turn: 0 } });
  for (const z of [2, 3]) {
    put(stoolAsset(`natmarked:stool-w${z}`), 3, z, 3);
    put(stoolAsset(`natmarked:stool-e${z}`), 14, z, 1);
  }
  // Two tea tables with a stool each side.
  for (const x of [5, 14]) {
    put(asset(`natmarked:table-${x}`, "Tea table", 1, 1, teaTable), x, 5);
    put(stoolAsset(`natmarked:stool-t${x}a`), x - 1, 5, 1);
    put(stoolAsset(`natmarked:stool-t${x}b`), x + 1, 5, 3);
  }
  // Posts at the corners of the front half, a runner from the door to the counter.
  for (const [x, z] of [
    [0, 7],
    [17, 7],
    [0, 10],
    [17, 10],
  ] as const)
    put(asset(`natmarked:post-${x}-${z}`, "Lantern post", 1, 1, post), x, z);
  put(asset("rug", "Runner", 1, 3, runner), 8, 9);

  // The counter, with the case on its stand; Mei behind it.
  put(asset("natmarked:counter", "Counter", 6, 1, counter), 6, 8);
  const keeper = makeKeeper();
  keeper.root.position.set(8.5, 0.02, 7.4);
  room.group.add(keeper.root);

  // The cooks.
  const cooks: { a: Avatar; face: number; at: [number, number] }[] = [
    { a: makeCook(SKINS[2]!, HAIRS[0]!, true), face: Math.PI / 2, at: [1.0, 3.0] },
    { a: makeCook(SKINS[3]!, HAIRS[1]!, false), face: -Math.PI / 2, at: [17.0, 3.0] },
  ];
  for (const c of cooks) {
    c.a.root.position.set(c.at[0], 0.02, c.at[1]);
    c.a.root.rotation.y = c.face;
    room.group.add(c.a.root);
  }

  // The door: an exit in the south wall with a noren hung inside it, and lantern strings across the hall.
  const door = exitDoorway({ outside: true, wall: "#43302b", leaf: RED_D });
  door.position.set(8.5, 0, D + 0.5);
  door.rotation.y = Math.PI;
  room.group.add(door);
  const curtain = noren(0.9, 0.7);
  curtain.position.set(8.5, 2.1, D - 0.12);
  curtain.rotation.y = Math.PI;
  room.group.add(curtain);
  const strings = new Model();
  lanternString(strings, [0.1, 2.4, 4.4], [17.9, 2.4, 4.4], 14, 0.3);
  lanternString(strings, [0.1, 2.4, 9.4], [17.9, 2.4, 9.4], 14, 0.3);
  room.group.add(strings);

  let last = 0;
  ticks.push((t) => {
    const dt = Math.min(0.1, Math.max(0, t - last));
    last = t;
    keeper.update(dt, t);
    for (const c of cooks) c.a.update(dt, t);
  });

  return { room, displays: [], shopkeeper: keeper, counter: [8, 8], door: [8, 11] };
}

const NO_ITEMS: ShopItem[] = [];

export const SHOP_NATMARKED: ShopSpec = {
  id: "natmarked",
  name: "Natmarked",
  sign: "NATMARKED",
  items: NO_ITEMS,
  exterior,
  footprint: { w: 5, d: 4 },
  buildInterior,
};
