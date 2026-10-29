/**
 * The barber shop's pieces: voxel heads on stands, price cards, shelves, the classic barber chair, the pole,
 * mirror stations, sinks and the people (shopkeeper, apprentice and the customers under their capes).
 * Everything faces +z with its origin on the floor at the middle of its footprint; `barber.ts` places them.
 */
import * as THREE from "three";
import { C } from "../../art/palette.ts";
import { light } from "../furniture/furniture.ts";
import { canvasTexture, glass, glow, Model, painted, seeded, ticks, tint } from "../kit/kit.ts";
import { Avatar, type Look, personLook } from "../people/avatar.ts";
import { type Look2D, lookFrom2D } from "../people/gear3d.ts";
import type { BarberRow } from "./data/barber.ts";

export const RED = "#c4352f";
export const BLUE = "#2e5fa8";
export const CREAM = "#f4efe4";
export const CHROME = "#cfd6de";
export const CHROME_DARK = "#8a93a1";
export const LEATHER = "#8e2a2a";
export const TEAL = "#6fb5a8";
const FONT = "ui-monospace, Menlo, Consolas, monospace";
const RARITY: Record<string, string> = {
  common: "#9aa3ad",
  uncommon: "#5fb85f",
  rare: "#4f8fe0",
  epic: "#9b6fd6",
  legendary: "#f0b53c",
};

// MARK: Heads

/**
 * Just the head of a 2D look, in cubes. `voxelStyle` overrides the hair the mapper picks, for the one 2D
 * style (the bun) that `lookFrom2D` draws as something else.
 */
export function bareHead(look: Look2D, voxelStyle?: number): { head: Model; avatar: Avatar } {
  const vl = lookFrom2D(look);
  if (voxelStyle !== undefined) vl.style = voxelStyle;
  const avatar = new Avatar(vl);
  const head = avatar.head;
  head.removeFromParent();
  head.position.set(0, 0, 0);
  head.rotation.set(0, 0, 0);
  return { head, avatar };
}

/** The faces that move (laser eyes) need their avatar ticked; the barber's `ticks` does it for these. */
const liveHeads: Avatar[] = [];
let lastTick = 0;
ticks.push((t) => {
  const dt = Math.min(0.1, Math.max(0, t - lastTick));
  lastTick = t;
  for (const a of liveHeads) a.update(dt, t);
});

/** A head on a little wooden stand, like a wig or a window dummy. `scale` grows the head, not the stand. */
export function headOnStand(
  look: Look2D,
  opts: { voxelStyle?: number; scale?: number; live?: boolean } = {},
): Model {
  const m = new Model();
  const { head, avatar } = bareHead(look, opts.voxelStyle);
  const s = opts.scale ?? 1.1;
  m.cyl(0.13, 0.025, C.woodDark, [0, 0, 0], 0.12, 12);
  m.cyl(0.04, 0.12, "#d9d2c5", [0, 0.02, 0], 0.05, 8);
  head.scale.setScalar(s);
  head.position.y = 0.13;
  m.add(head);
  if (opts.live) liveHeads.push(avatar);
  return m;
}

/** A look from the picker's three numbers (and a face thing). The outfit is the cap's colour on style 1. */
export const lookOf = (style: number, hair: number, skin: number, glasses = 0, outfit = 1): Look2D => ({
  style,
  hair,
  skin,
  outfit,
  glasses,
});

/** The 2D hairstyles in cubes: Short, Cap, Bun (the mapper's spiky is not what the name says), Long. */
export const wig = (style: number, hair: number, skin = 1): Model =>
  headOnStand(lookOf(style, hair, skin, 0, (hair + 1) % 8), { voxelStyle: style === 2 ? 3 : undefined });

// MARK: Cards

const coin = (g: CanvasRenderingContext2D, x: number, y: number, r: number) => {
  g.fillStyle = "#8a5f14";
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "#f5c842";
  g.beginPath();
  g.arc(x, y, r - 1, 0, Math.PI * 2);
  g.fill();
};

/** Words wrapped to `max` characters a line. */
function wrap(text: string, max: number): string[] {
  const out: string[] = [];
  let line = "";
  for (const w of text.split(" ")) {
    if (line && `${line} ${w}`.length > max) {
      out.push(line);
      line = w;
    } else line = line ? `${line} ${w}` : w;
  }
  if (line) out.push(line);
  return out;
}

/**
 * A slim price card: the name (wrapped) and the price (a coin and the number, or `Free`) on cream, under a
 * stripe in the rarity's colour. `h` is the card; it has only a thin frame, so it hides little behind it.
 */
export function priceCard(
  row: Pick<BarberRow, "name" | "price" | "level" | "rarity">,
  w = 0.86,
  h = 0.34,
  label?: string,
  font = 9,
): Model {
  const px = 100;
  const rowH = font + 1;
  const m = new Model();
  const cw = Math.round(w * px);
  const ch = Math.round(h * px);
  const tex = canvasTexture(cw, ch, (g) => {
    g.fillStyle = CREAM;
    g.fillRect(0, 0, cw, ch);
    g.fillStyle = RARITY[row.rarity ?? "common"]!;
    g.fillRect(0, 0, cw, 3);
    g.fillStyle = "#2b2433";
    g.font = `bold ${font}px ${FONT}`;
    g.textBaseline = "top";
    const price = row.level ? `Lv ${row.level}` : row.price ? String(row.price) : "Free";
    const coined = !!row.price && !row.level;
    const priceW = g.measureText(price).width + (coined ? 10 : 0);
    const lines = wrap(label ?? row.name, Math.floor((cw - 4) / (font * 0.6)));
    const maxRows = Math.max(1, Math.floor((ch - 5) / rowH));
    let shown = lines.slice(0, maxRows);
    const fits = (l: string) => g.measureText(l).width + priceW + 8 < cw;
    let inline = fits(shown[shown.length - 1]!);
    if (!inline && shown.length === maxRows) {
      shown = lines.slice(0, Math.max(1, maxRows - 1));
      inline = shown.length === 1 && maxRows === 1 && fits(shown[0]!);
    }
    g.textAlign = "left";
    for (const [i, l] of shown.entries()) g.fillText(l, 4, 5 + i * rowH);
    const y = 5 + (inline ? shown.length - 1 : shown.length) * rowH;
    g.textAlign = "right";
    g.fillStyle = row.level ? "#9b6fd6" : coined ? "#8a5f14" : "#3f8c50";
    g.fillText(price, cw - 4, y);
    if (coined) coin(g, cw - 4 - (priceW - 10) - 5, y + 4, 4);
  });
  m.box([w + 0.03, h + 0.03, 0.02], "#5b3a24", [0, 0, 0], 0.004);
  m.plane(w, h, painted(tex), [0, (h + 0.03) / 2, 0.011]);
  return m;
}

/** A card lying back on a ledge, so it can be read from above without hiding what stands behind it. */
export function leanCard(
  m: Model,
  row: Pick<BarberRow, "name" | "price" | "level" | "rarity">,
  at: [number, number, number],
  w?: number,
  h?: number,
  label?: string,
): void {
  const c = priceCard(row, w, h, label);
  c.position.set(...at);
  c.rotation.x = -1.2;
  m.add(c);
}

/** A card hung on the front lip of a shelf, upright, so nothing stands in front of it. */
export function lipCard(
  m: Model,
  row: Pick<BarberRow, "name" | "price" | "level" | "rarity">,
  at: [number, number, number],
  w = 0.9,
  h = 0.3,
): void {
  const c = priceCard(row, w, h, undefined, 8);
  c.position.set(...at);
  m.add(c);
}

// MARK: Shelves

/** A wall unit: back board, sides, `tiers` boards at the given heights and a cabinet underneath. */
export function shelfUnit(
  w: number,
  depth: number,
  tierY: number[],
  opts: { cabinet?: number; wood?: string; top?: number; back?: string } = {},
): Model {
  const m = new Model();
  const wood = opts.wood ?? C.woodLight;
  const dark = tint(wood, -0.25);
  const top = opts.top ?? tierY[tierY.length - 1]! + 0.62;
  const cab = opts.cabinet ?? 0.45;
  m.box([w - 0.02, top, 0.06], opts.back ?? tint(wood, 0.1), [0, 0, -depth / 2 + 0.026], 0.01);
  for (const s of [-1, 1]) m.box([0.06, top, depth], dark, [s * (w / 2 - 0.03), 0, 0], 0.01);
  for (const y of tierY) m.box([w - 0.08, 0.05, depth - 0.02], wood, [0, y - 0.05, 0], 0.01);
  m.box([w, 0.04, depth + 0.02], dark, [0, top, 0], 0.01);
  if (cab > 0) {
    m.box([w - 0.02, cab, depth], tint(wood, -0.1), [0, 0, 0.0], 0.02);
    const n = Math.max(1, Math.round(w / 1));
    for (let i = 0; i < n; i++) {
      const x = -w / 2 + (i + 0.5) * (w / n);
      m.box([w / n - 0.1, cab - 0.12, 0.03], wood, [x, 0.06, depth / 2 + 0.01], 0.01);
      m.box([0.12, 0.025, 0.03], CHROME, [x, cab * 0.6, depth / 2 + 0.03], 0.005);
    }
  }
  return m;
}

// MARK: The pole

/** The stripe texture of a barber pole: red, white and blue on the diagonal, wrapping round. */
function poleTexture(): THREE.CanvasTexture {
  const t = canvasTexture(32, 32, (g) => {
    for (let y = 0; y < 32; y++)
      for (let x = 0; x < 32; x++) {
        const b = (x + y) % 32;
        g.fillStyle = b < 11 ? RED : b < 22 ? "#fbf7ef" : BLUE;
        g.fillRect(x, y, 1, 1);
      }
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

/** A barber pole in a glass tube with chrome caps; the stripes climb. */
export function barberPole(h: number, r: number, lit = false): Model {
  const m = new Model();
  const tex = poleTexture();
  tex.repeat.set(1, Math.max(1, Math.round(h / (r * 3.2))));
  const body = m.cyl(r, h, lit ? glow("#fff", tex) : painted(tex), [0, 0.03 * h, 0], r, 20);
  body.castShadow = true;
  m.cyl(r * 1.25, h * 0.04, CHROME, [0, 0, 0], r * 1.2, 16);
  m.cyl(r * 1.25, h * 0.05, CHROME, [0, h * 0.95, 0], r * 1.2, 16);
  m.ball(r * 1.15, CHROME, [0, h * 1.0 + r * 0.2, 0], [1, 0.85, 1], 14);
  const speed = 0.35 + h * 0.1;
  ticks.push((time) => {
    tex.offset.y = -((time * speed) % 1);
  });
  return m;
}

// MARK: The chair

/** The classic barber chair, facing +z: chrome base and pump, red leather seat, arms, headrest, footrest. */
export function barberChair(): Model {
  const m = new Model();
  m.cyl(0.3, 0.05, "#2a2a32", [0, 0, 0], 0.28, 18);
  m.cyl(0.32, 0.03, CHROME, [0, 0.04, 0], 0.3, 18);
  m.cyl(0.09, 0.3, CHROME, [0, 0.07, 0], 0.075, 12);
  m.cyl(0.11, 0.04, CHROME_DARK, [0, 0.34, 0], 0.11, 12);
  m.box([0.62, 0.14, 0.58], LEATHER, [0, 0.38, 0.0], 0.06);
  m.box([0.6, 0.08, 0.1], tint(LEATHER, 0.1), [0, 0.5, 0.24], 0.04);
  const back = m.box([0.6, 0.66, 0.14], LEATHER, [0, 0.46, -0.3], 0.06);
  back.rotation.x = -0.14;
  m.box([0.34, 0.2, 0.1], tint(LEATHER, 0.08), [0, 1.04, -0.37], 0.05).rotation.x = -0.14;
  m.cyl(0.02, 0.1, CHROME, [0, 0.98, -0.37], 0.02, 6);
  for (const s of [-1, 1]) {
    m.box([0.1, 0.07, 0.5], tint(LEATHER, -0.12), [s * 0.36, 0.64, -0.02], 0.03);
    m.box([0.05, 0.28, 0.05], CHROME, [s * 0.36, 0.38, 0.12], 0.01);
    m.box([0.05, 0.28, 0.05], CHROME, [s * 0.36, 0.38, -0.22], 0.01);
    m.cyl(0.015, 0.34, CHROME, [s * 0.14, 0.1, 0.5], 0.015, 6).rotation.x = -0.5;
  }
  m.box([0.5, 0.05, 0.22], CHROME_DARK, [0, 0.07, 0.52], 0.02);
  m.box([0.44, 0.02, 0.18], "#2a2a32", [0, 0.12, 0.52], 0.008);
  return m;
}

// MARK: Mirrors and stations

/** A mirror: a pale pane with a streak of shine, in a frame, ringed with bulbs. `w`×`h`, bottom centre. */
export function mirror(w: number, h: number, bulbs = true): Model {
  const m = new Model();
  const tex = canvasTexture(24, 32, (g) => {
    const grad = g.createLinearGradient(0, 0, 24, 32);
    grad.addColorStop(0, "#e6f3fb");
    grad.addColorStop(1, "#a9cde0");
    g.fillStyle = grad;
    g.fillRect(0, 0, 24, 32);
    g.fillStyle = "rgba(255,255,255,0.6)";
    for (const [x, wd] of [
      [6, 3],
      [12, 1],
    ] as const)
      for (let y = 0; y < 32; y++) g.fillRect(x + Math.floor(y * 0.5), y, wd, 1);
  });
  m.box([w + 0.14, h + 0.14, 0.06], "#5b3a24", [0, 0, 0], 0.02);
  m.box([w + 0.04, h + 0.04, 0.03], CHROME, [0, 0.05, 0.03], 0.01);
  m.plane(w, h, glow("#fff", tex), [0, 0.07 + h / 2, 0.052]);
  if (bulbs) {
    const n = Math.round(w / 0.28);
    const bulb = (x: number, y: number) => {
      m.ball(0.035, glow("#fff1b8"), [x, y, 0.07], [1, 1, 0.8], 6);
    };
    for (let i = 0; i <= n; i++) {
      bulb(-w / 2 + (i * w) / n, h + 0.11);
      bulb(-w / 2 + (i * w) / n, -0.03);
    }
    for (let i = 1; i < 4; i++) {
      bulb(-w / 2 - 0.05, (i * h) / 4);
      bulb(w / 2 + 0.05, (i * h) / 4);
    }
  }
  return m;
}

/** A jar of blue disinfectant with combs standing in it (the barbicide). */
function combJar(m: Model, at: [number, number, number]): void {
  m.cyl(0.07, 0.2, glass("#7ec8ee", 0.7), at, 0.07, 12);
  for (const i of [-1, 0, 1])
    m.box([0.012, 0.22, 0.05], i % 2 ? "#2b2433" : "#e25d5d", [at[0] + i * 0.03, at[1] + 0.02, at[2]], 0.003);
  m.cyl(0.075, 0.025, "#2e5fa8", [at[0], at[1] + 0.2, at[2]], 0.075, 12);
}

function scissors(m: Model, at: [number, number, number], rot = 0): void {
  const s = m.part(at);
  s.rotation.y = rot;
  s.box([0.2, 0.012, 0.02], CHROME, [0, 0, 0], 0.003).rotation.y = 0.14;
  s.box([0.2, 0.012, 0.02], CHROME, [0, 0.002, 0], 0.003).rotation.y = -0.14;
  for (const z of [-0.025, 0.025])
    m.ball(0.02, "#e25d5d", [at[0] - 0.1, at[1] + 0.01, at[2] + z], [1, 0.4, 1], 8);
}

function clippers(m: Model, at: [number, number, number], rot = 0): void {
  const c = m.part(at, rot);
  c.box([0.07, 0.05, 0.2], "#2b2433", [0, 0, 0], 0.02);
  c.box([0.08, 0.015, 0.04], CHROME, [0, 0.02, 0.12], 0.004);
  c.box([0.02, 0.012, 0.02], "#6ad28a", [0, 0.05, -0.02], 0.004);
  // The cord.
  for (let i = 0; i < 5; i++)
    c.ball(0.008, "#2b2433", [Math.sin(i * 1.2) * 0.05, 0.005, -0.12 - i * 0.05], [1, 1, 1], 4);
}

/**
 * A mirror station on a wall (`w` wide, 0.4 deep): a counter with its pole, the comb jar, scissors, clippers,
 * a spray bottle and folded towels under a lit mirror. Faces +z, its back at z = -0.5.
 */
export function station(seed: number): Model {
  const m = new Model();
  const w = 1.9;
  m.box([w, 0.8, 0.42], "#f1ede0", [0, 0, -0.29], 0.02);
  m.box([w + 0.06, 0.05, 0.48], CHROME, [0, 0.8, -0.28], 0.015);
  for (const s of [-1, 0, 1]) m.box([0.5, 0.58, 0.03], "#cfd9e0", [s * 0.6, 0.1, -0.075], 0.01);
  const pole = barberPole(0.38, 0.055);
  pole.position.set(-0.7, 0.85, -0.3);
  m.add(pole);
  combJar(m, [-0.38, 0.85, -0.32]);
  scissors(m, [0.0, 0.862, -0.25], 0.4 + seed * 0.3);
  clippers(m, [0.3, 0.872, -0.25], -0.5);
  // Spray bottle and a folded towel stack.
  m.cyl(0.04, 0.16, glass("#9ed9f0", 0.7), [0.62, 0.85, -0.35], 0.04, 10);
  m.box([0.03, 0.04, 0.04], "#e25d5d", [0.62, 1.0, -0.35], 0.01);
  for (let i = 0; i < 3; i++)
    m.box([0.26, 0.05, 0.2], i % 2 ? CREAM : "#e8dcc4", [0.78, 0.85 + i * 0.05, -0.28], 0.015);
  const mi = mirror(1.35, 0.95, true);
  mi.position.set(0, 1.12, -0.46);
  m.add(mi);
  light(m, [0, 1.8, 0.2], "#ffe3b0", 1.4 + seed * 0.0, 4);
  return m;
}

/** Two shampoo basins in a white cabinet, taps, bottles and a rail of towels (a wall unit, 2 wide). */
export function sinks(): Model {
  const m = new Model();
  m.box([1.9, 0.78, 0.5], "#f1ede0", [0, 0, -0.25], 0.02);
  m.box([1.96, 0.06, 0.54], "#e4e8ec", [0, 0.78, -0.25], 0.02);
  for (const s of [-1, 1]) {
    m.cyl(0.24, 0.07, "#bfc9d2", [s * 0.5, 0.82, -0.22], 0.2, 16);
    m.cyl(0.19, 0.02, "#8fb4c8", [s * 0.5, 0.88, -0.22], 0.19, 16);
    m.cyl(0.02, 0.26, CHROME, [s * 0.5, 0.84, -0.46], 0.02, 8);
    m.box([0.03, 0.03, 0.16], CHROME, [s * 0.5, 1.08, -0.4], 0.008);
    m.cyl(0.05, 0.16, glass(s > 0 ? "#f0a8c8" : "#9ed9f0", 0.8), [s * 0.8, 0.84, -0.46], 0.05, 10);
  }
  m.box([1.9, 0.05, 0.07], CHROME, [0, 1.5, -0.44], 0.01);
  for (const [i, x] of [-0.6, -0.2, 0.25, 0.65].entries())
    m.box([0.26, 0.5, 0.05], i % 2 ? CREAM : "#e8dcc4", [x, 1.0, -0.4], 0.02);
  m.box([1.9, 0.8, 0.04], "#dfe9ee", [0, 0.9, -0.48], 0.01).scale.y = 0.5;
  return m;
}

/** A warm-towel cabinet: glass door, rolled towels inside, steam rising. */
export function towelWarmer(): Model {
  const m = new Model();
  m.box([0.8, 1.15, 0.5], "#f1ede0", [0, 0, -0.2], 0.03);
  m.box([0.7, 0.8, 0.03], glass("#cfe8f4", 0.5), [0, 0.2, 0.06], 0.01);
  for (const y of [0.3, 0.5, 0.7, 0.9]) {
    m.box([0.62, 0.02, 0.4], CHROME_DARK, [0, y, -0.2], 0.005);
    for (const x of [-0.2, 0, 0.2])
      m.cyl(0.07, 0.14, CREAM, [x, y + 0.02, -0.2], 0.07, 10).rotation.x = Math.PI / 2;
  }
  m.box([0.5, 0.12, 0.04], "#2b2433", [0, 1.18, 0.0], 0.01);
  m.box([0.8, 0.05, 0.56], "#5b3a24", [0, 1.15, -0.2], 0.02);
  const puffs = [0, 1, 2].map(() => m.ball(0.06, "#f1f1f1", [0, 1.25, -0.2], [1, 1, 1], 8));
  ticks.push((t) => {
    puffs.forEach((p, i) => {
      const f = (t * 0.35 + i / 3) % 1;
      p.position.set(Math.sin((t + i) * 2) * 0.1, 1.25 + f * 0.6, -0.2);
      p.scale.setScalar(0.5 + f * 1.4);
      (p.material as THREE.Material).opacity = 1;
      p.visible = f < 0.92;
    });
  });
  return m;
}

// MARK: People

/** In-scene text over a head: a name chip or a speech bubble that always faces the camera. */
export function billboardText(
  draw: (g: CanvasRenderingContext2D, w: number, h: number) => void,
  w: number,
  h: number,
  px = 64,
): { mesh: THREE.Mesh; redraw: () => void } {
  const cw = Math.round(w * px);
  const ch = Math.round(h * px);
  const tex = canvasTexture(cw, ch, (g) => draw(g, cw, ch), true);
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
  const q = new THREE.Quaternion();
  mesh.onBeforeRender = (_r, _s, camera) => {
    // Face the camera whatever the parent's turn.
    if (mesh.parent) mesh.parent.getWorldQuaternion(q).invert().multiply(camera.quaternion);
    else q.copy(camera.quaternion);
    mesh.quaternion.copy(q);
  };
  mesh.renderOrder = 6;
  return {
    mesh,
    redraw: () => {
      const g = (tex.image as HTMLCanvasElement).getContext("2d")!;
      g.clearRect(0, 0, cw, ch);
      draw(g, cw, ch);
      tex.needsUpdate = true;
    },
  };
}

/** A name chip floating over `a`. */
export function nameChip(a: Avatar, name: string, role: string): void {
  const { mesh } = billboardText(
    (g, w, h) => {
      g.fillStyle = "rgba(43,36,51,0.82)";
      g.beginPath();
      g.roundRect(0, 0, w, h, 8);
      g.fill();
      g.textAlign = "center";
      g.fillStyle = "#fbf7ef";
      g.font = `bold ${Math.round(h * 0.4)}px system-ui, sans-serif`;
      g.textBaseline = "middle";
      g.fillText(name, w / 2, h * 0.32);
      g.fillStyle = "#f5c842";
      g.font = `${Math.round(h * 0.28)}px system-ui, sans-serif`;
      g.fillText(role, w / 2, h * 0.74);
    },
    0.9,
    0.34,
    96,
  );
  mesh.position.set(0, a.height + 0.28, 0);
  a.root.add(mesh);
}

/** A speech bubble over `a` that says the next line every few seconds, for a few seconds. */
export function chatter(a: Avatar, lines: string[], lift = 0.62): void {
  let i = 0;
  const bubble = billboardText(
    (g, w, h) => {
      g.fillStyle = "#fbf7ef";
      g.strokeStyle = "#2b2433";
      g.lineWidth = 3;
      g.beginPath();
      g.roundRect(2, 2, w - 4, h - 14, 10);
      g.fill();
      g.stroke();
      g.beginPath();
      g.moveTo(w / 2 - 8, h - 13);
      g.lineTo(w / 2, h - 2);
      g.lineTo(w / 2 + 8, h - 13);
      g.fill();
      g.fillStyle = "#2b2433";
      g.font = "bold 15px system-ui, sans-serif";
      g.textAlign = "center";
      g.textBaseline = "middle";
      const words = lines[i % lines.length]!.split(" ");
      const rows: string[] = [];
      let cur = "";
      for (const wd of words) {
        if (cur && g.measureText(`${cur} ${wd}`).width > w - 24) {
          rows.push(cur);
          cur = wd;
        } else cur = cur ? `${cur} ${wd}` : wd;
      }
      rows.push(cur);
      for (const [k, r] of rows.entries())
        g.fillText(r, w / 2, (h - 14) / 2 + (k - (rows.length - 1) / 2) * 17);
    },
    1.5,
    0.62,
    96,
  );
  bubble.mesh.position.set(0, a.height + lift + 0.3, 0);
  a.root.add(bubble.mesh);
  let shownAt = -100;
  ticks.push((t) => {
    const cycle = t % 9;
    const on = cycle < 4.5;
    if (on && t - shownAt > 8) {
      shownAt = t;
      i++;
      bubble.redraw();
    }
    bubble.mesh.visible = on;
    a.talking = on && cycle < 3.2;
  });
}

/** A plain waistcoat-and-apron over the voxel torso: a bib with stripes, a bow tie, sleeve garters. */
function barberApron(a: Avatar, stripe: boolean): void {
  const b = a.body;
  b.box([0.27, 0.34, 0.025], stripe ? "#fbf7ef" : "#2b2433", [0, 0.42, 0.1], 0.008);
  if (stripe)
    for (let i = -2; i <= 2; i++)
      b.box([0.034, 0.332, 0.03], i % 2 ? RED : "#fbf7ef", [i * 0.052, 0.424, 0.1], 0.004);
  b.box([0.04, 0.03, 0.02], "#2b2433", [0, 0.72, 0.1], 0.004);
  b.box([0.05, 0.036, 0.02], RED, [-0.045, 0.72, 0.105], 0.006);
  b.box([0.05, 0.036, 0.02], RED, [0.045, 0.72, 0.105], 0.006);
  for (const s of [-1, 1]) b.box([0.03, 0.2, 0.025], "#2b2433", [s * 0.09, 0.57, 0.1], 0.004);
}

/** The shopkeeper: Figaro, with a waxed moustache, slick hair, a striped apron and scissors in his hand. */
export function makeBarber(): Avatar {
  const look: Look = personLook({
    skin: "#e9b38c",
    hair: "#2e2e3a",
    style: 0,
    outfit: ["#fbf7ef", "#d8d2c4"],
    pants: "#2b2f3a",
    hat: "none",
    beard: 1,
  });
  const a = new Avatar(look);
  barberApron(a, true);
  // The handlebar curls, a little past the cube moustache.
  const h = a.head;
  for (const s of [-1, 1]) {
    h.box([0.05, 0.016, 0.03], "#2e2e3a", [s * 0.085, 0.092, 0.172], 0.006).rotation.z = s * 0.5;
  }
  const hand = a.arms[1];
  const sc = hand.part([0.0, -0.3, 0.07]);
  const blade = (side: number) => {
    const bl = sc.part([0, 0, 0]);
    bl.box([0.012, 0.03, 0.17], CHROME, [0, 0, 0.0], 0.002);
    bl.rotation.y = side * 0.1;
    m(bl, side);
    return bl;
  };
  const m = (bl: Model, side: number) => bl.ball(0.022, "#e25d5d", [side * 0.012, 0, -0.03], [0.4, 1, 1], 8);
  const bladeA = blade(1);
  const bladeB = blade(-1);
  hand.userData.snip = [bladeA, bladeB];
  return a;
}

/** Updates Figaro: his scissors hand twirls and snips at the air while he talks. */
export function animateBarber(a: Avatar, dt: number, t: number): void {
  a.update(dt, t);
  a.arms[1].rotation.x = -0.75 + Math.sin(t * 2.6) * 0.18;
  a.arms[1].rotation.z = -0.25;
  const [x, y] = a.arms[1].userData.snip as [Model, Model];
  const open = Math.max(0, Math.sin(t * 9)) * 0.35;
  x.rotation.y = 0.05 + open;
  y.rotation.y = -0.05 - open;
  a.head.rotation.y = Math.sin(t * 0.7) * 0.15;
}

/** A nylon cape over a sitter: shoulders, a collar, and a skirt that covers the lap and the knees. */
function cape(a: Avatar, colour: string, trim: string): void {
  const b = a.body;
  b.cyl(0.3, 0.52, colour, [0, 0.2, 0], 0.15, 16).scale.set(1, 1, 0.85);
  b.cyl(0.16, 0.06, trim, [0, 0.75, 0], 0.15, 14);
  b.box([0.5, 0.05, 0.4], colour, [0, 0.46, 0.2], 0.02);
  b.box([0.5, 0.26, 0.04], colour, [0, 0.2, 0.4], 0.015);
  b.box([0.5, 0.025, 0.045], trim, [0, 0.2, 0.4], 0.008);
}

export interface Sitter {
  avatar: Avatar;
  update(dt: number, t: number): void;
}

/** A customer under a cape, in the chair; head turns a little, clippings fall. */
export function makeCustomer(
  skin: string,
  hair: string,
  style: number,
  cape1: string,
  trim: string,
  beard = 0,
  seed = 0,
): Sitter {
  const look: Look = personLook({
    skin,
    hair,
    style,
    outfit: ["#4f8fe0", "#3a6fb8"],
    pants: "#3f4a63",
    hat: "none",
    beard,
  });
  const a = new Avatar(look);
  a.pose = "sit";
  cape(a, cape1, trim);
  // Clippings falling from the cut.
  const rnd = seeded(seed + 7);
  const bits = Array.from({ length: 7 }, () => a.root.ball(0.012, hair, [0, 0, 0], [1, 1, 1], 4));
  const phase = bits.map(() => rnd());
  return {
    avatar: a,
    update(dt, t) {
      a.update(dt, t);
      a.arms[0].rotation.x = a.arms[1].rotation.x = 0.1;
      a.head.rotation.y = Math.sin(t * 0.6 + seed) * 0.18;
      a.head.rotation.x = 0.12 + Math.sin(t * 0.9 + seed) * 0.04;
      bits.forEach((p, i) => {
        const f = (t * 0.5 + phase[i]!) % 1;
        p.position.set(
          Math.sin(phase[i]! * 40) * 0.12,
          0.62 - f * 0.55,
          0.05 + Math.cos(phase[i]! * 30) * 0.1,
        );
        p.visible = f < 0.9;
      });
    },
  };
}

/** The apprentice with comb and scissors; he works the head in front of him. */
export function makeApprentice(skin: string, hair: string): Avatar {
  const look: Look = personLook({
    skin,
    hair,
    style: 1,
    outfit: ["#fbf7ef", "#d8d2c4"],
    pants: "#2b2f3a",
    hat: "none",
    beard: 0,
  });
  const a = new Avatar(look);
  barberApron(a, false);
  const r = a.arms[1];
  const sc = r.part([0, -0.3, 0.07]);
  const bl: Model[] = [1, -1].map((s) => {
    const p = sc.part();
    p.box([0.012, 0.03, 0.17], CHROME, [0, 0, 0], 0.002);
    p.rotation.y = s * 0.1;
    return p;
  });
  r.userData.snip = bl;
  const l = a.arms[0];
  l.box([0.012, 0.03, 0.16], "#2b2433", [0, -0.3, 0.08], 0.003);
  for (let i = 0; i < 6; i++) l.box([0.01, 0.025, 0.006], "#2b2433", [0, -0.3, 0.01 + i * 0.026], 0.001);
  return a;
}

/** The apprentice cuts: right arm up at the head snipping, left arm combing, a step to the side now and then. */
export function animateApprentice(a: Avatar, dt: number, t: number, phase = 0): void {
  a.update(dt, t + phase);
  const tt = t + phase;
  a.arms[1].rotation.x = -1.65 + Math.sin(tt * 1.3) * 0.12;
  a.arms[1].rotation.z = -0.2 + Math.sin(tt * 0.9) * 0.12;
  a.arms[0].rotation.x = -1.4 + Math.sin(tt * 1.3 + 1.6) * 0.14;
  a.arms[0].rotation.z = 0.2;
  const [x, y] = a.arms[1].userData.snip as [Model, Model];
  const open = Math.max(0, Math.sin(tt * 11)) * 0.38;
  x.rotation.y = 0.05 + open;
  y.rotation.y = -0.05 - open;
  a.head.rotation.x = 0.15;
  a.head.rotation.y = Math.sin(tt * 0.5) * 0.12;
}

// MARK: Little things on the floor and the wall

/** Cut hair on the floor in a few colours, scattered round a spot. */
export function clippings(m: Model, colours: string[], at: [number, number], seed = 1): void {
  const rnd = seeded(seed);
  for (let i = 0; i < 16; i++) {
    const a = rnd() * Math.PI * 2;
    const r = 0.1 + rnd() * 0.45;
    const b = m.box(
      [0.05 + rnd() * 0.04, 0.008, 0.02],
      colours[i % colours.length]!,
      [at[0] + Math.cos(a) * r, 0.003, at[1] + Math.sin(a) * r],
      0.002,
    );
    b.rotation.y = rnd() * Math.PI;
    b.castShadow = false;
  }
}

/** A push broom leaning on the wall. */
export function broom(): Model {
  const m = new Model();
  m.cyl(0.015, 1.2, C.wood, [0, 0.1, 0], 0.015, 6).rotation.z = 0.12;
  m.box([0.34, 0.07, 0.07], "#d4a93a", [0.07, 0.05, 0], 0.02);
  m.box([0.36, 0.1, 0.09], "#8c5c36", [0.07, 0.0, 0], 0.02);
  return m;
}

/** Someone waiting on the sofa with a magazine. */
export function makeReader(): { avatar: Avatar; update(dt: number, t: number): void } {
  const look: Look = personLook({
    skin: "#c68a5f",
    hair: "#b2463d",
    style: 2,
    outfit: ["#58b36a", "#3f8c50"],
    pants: "#3f4a63",
    hat: "none",
    beard: 0,
    glasses: true,
  });
  const a = new Avatar(look);
  a.pose = "sit";
  const mag = a.root.part([0, 0.55, 0.28]);
  mag.rotation.x = -0.35;
  mag.box([0.24, 0.3, 0.012], "#e25d5d", [0, 0, 0], 0.003);
  mag.box([0.18, 0.06, 0.014], "#fbf7ef", [0, 0.2, 0.002], 0.002);
  return {
    avatar: a,
    update(dt, t) {
      a.update(dt, t);
      a.arms[0].rotation.x = a.arms[1].rotation.x = -1.15;
      a.head.rotation.y = 0;
      a.head.rotation.x = 0.25 + Math.sin(t * 0.4) * 0.04;
      mag.rotation.z = Math.sin(t * 0.8) * 0.02;
    },
  };
}
