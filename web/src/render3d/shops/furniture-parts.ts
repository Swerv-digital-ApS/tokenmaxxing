/**
 * The furniture showroom's own pieces: price placards, wall sample panels, the small-things shelf bank, the
 * counter and till, Freja the shopkeeper (work apron, measuring tape) and the storefront. The catalogue
 * itself lives in `furniture.ts`; everything here is generic dressing.
 */
import * as THREE from "three";
import { C, HAIRS, SKINS } from "../../art/palette.ts";
import { assetById, light } from "../furniture/furniture.ts";
import { canvasTexture, glass, glow, Model, ticks, tint, type V3 } from "../kit/kit.ts";
import { Avatar, personLook } from "../people/avatar.ts";
import { nightGlow } from "../town/props.ts";
import type { FurnRow } from "./data/furniture.ts";

const INK = "#3a2a1c";
const GOLD = "#a86b00";
const PAPER = "#f6edd8";

/** Draws `text` at a font size shrunk until it fits `maxW`. */
function fit(
  g: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxW: number,
  size: number,
  weight = 700,
) {
  let s = size;
  g.font = `${weight} ${s}px system-ui, sans-serif`;
  while (g.measureText(text).width > maxW && s > 8) {
    s -= 1;
    g.font = `${weight} ${s}px system-ui, sans-serif`;
  }
  g.fillText(text, x, y);
}

/** A gold coin, `r` across, centred at (x, y). */
function coin(g: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  g.fillStyle = "#c98a00";
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "#f5c842";
  g.beginPath();
  g.arc(x, y, r * 0.8, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "#fff0a8";
  g.beginPath();
  g.arc(x - r * 0.25, y - r * 0.25, r * 0.28, 0, Math.PI * 2);
  g.fill();
}

/** What the placard says about the cost: a number, FREE, or the level / feat that earns it. */
export function costOf(row: Pick<FurnRow, "price" | "level" | "earned">): {
  text: string;
  coin: boolean;
  note?: string;
} {
  if (row.earned) return { text: "EARNED", coin: false, note: "never sold" };
  if (row.level !== undefined)
    return { text: `LV ${row.level}`, coin: false, note: row.price > 0 ? `or ${row.price}` : "free to earn" };
  if (row.price === 0) return { text: "FREE", coin: false };
  return { text: String(row.price), coin: true };
}

/** The placard art: name above, price below. */
function drawTag(
  g: CanvasRenderingContext2D,
  w: number,
  h: number,
  row: Pick<FurnRow, "name" | "price" | "level" | "earned">,
): void {
  g.fillStyle = INK;
  g.fillRect(0, 0, w, h);
  g.fillStyle = PAPER;
  g.fillRect(4, 4, w - 8, h - 8);
  g.textBaseline = "middle";
  g.textAlign = "center";
  g.fillStyle = INK;
  fit(g, row.name, w / 2, h * 0.27, w - 20, h * 0.3, 700);
  const c = costOf(row);
  g.fillStyle = GOLD;
  if (c.coin) {
    const s = h * 0.5;
    g.font = `900 ${s}px system-ui, sans-serif`;
    const tw = g.measureText(c.text).width;
    const total = tw + s * 0.95;
    coin(g, w / 2 - total / 2 + s * 0.36, h * 0.69, s * 0.36);
    g.fillStyle = GOLD;
    g.textAlign = "left";
    g.fillText(c.text, w / 2 - total / 2 + s * 0.95, h * 0.71);
  } else {
    fit(g, c.text, w / 2, h * 0.7, w * 0.5, h * 0.46, 900);
    if (c.note) {
      g.fillStyle = "#7b6a55";
      g.textAlign = "right";
      g.font = `600 ${h * 0.2}px system-ui, sans-serif`;
      g.fillText(c.note, w - 12, h * 0.8);
    }
  }
}

/** A price placard leaning back on a little stand, to stand on the floor in front of a piece. */
export function priceTag(row: Pick<FurnRow, "name" | "price" | "level" | "earned">, scale = 1): Model {
  const m = new Model();
  const [w, h] = [1.0 * scale, 0.4 * scale];
  const tex = canvasTexture(256, 102, (g) => drawTag(g, 256, 102, row), true);
  const lean = m.part([0, 0.03 * scale, 0.0]);
  lean.rotation.x = -0.5;
  lean.box([w + 0.06, h + 0.06, 0.04 * scale], INK, [0, 0, 0], 0.01);
  lean.plane(w, h, glow("#fff", tex), [0, (h + 0.06) / 2, 0.025 * scale]);
  m.box([w * 0.3, 0.06 * scale, 0.12 * scale], C.woodDark, [0, 0, -0.05 * scale], 0.01);
  return m;
}

/** A flat label for a wall, `w` wide. */
export function wallTag(row: Pick<FurnRow, "name" | "price" | "level" | "earned">, w = 1.0): Model {
  const m = new Model();
  const h = w * 0.34;
  const tex = canvasTexture(
    256,
    Math.round(256 * 0.34),
    (g) => drawTag(g, 256, Math.round(256 * 0.34), row),
    true,
  );
  m.box([w + 0.05, h + 0.05, 0.04], INK, [0, 0, 0], 0.01);
  m.plane(w, h, glow("#fff", tex), [0, (h + 0.05) / 2, 0.025]);
  return m;
}

/** A framed wall sample: a patch of wallpaper or flooring over a name-and-price strip. */
export function samplePanel(
  row: Pick<FurnRow, "name" | "price" | "level" | "earned">,
  texture: THREE.Texture,
  size: { w: number; h: number },
  thick = 0.06,
): Model {
  const m = new Model();
  const { w, h } = size;
  const strip = 0.3;
  m.box([w + 0.1, h + 0.1, thick], INK, [0, 0, 0], 0.012);
  m.box([w + 0.06, h + 0.06, thick + 0.012], C.woodLight, [0, 0.02, 0], 0.012);
  m.plane(w, h - strip, glow("#fff", texture), [0, 0.05 + strip + (h - strip) / 2, thick / 2 + 0.012]);
  const tex = canvasTexture(
    256,
    Math.round((256 * strip) / w),
    (g) => drawTag(g, 256, Math.round((256 * strip) / w), row),
    true,
  );
  m.plane(w, strip, glow("#fff", tex), [0, 0.05 + strip / 2, thick / 2 + 0.014]);
  return m;
}

/** A texture cloned to show a window of itself: `rx` x `ry` repeats starting at (`ox`, `oy`). */
export function windowOf(src: THREE.Texture, rx: number, ry: number, ox = 0, oy = 0): THREE.Texture {
  const t = src.clone();
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(rx, ry);
  t.offset.set(ox, oy);
  t.needsUpdate = true;
  return t;
}

/** A header board for a block of samples or a set of pieces. */
export function headerBoard(title: string, sub: string, w: number, h = 0.3): Model {
  const m = new Model();
  const tex = canvasTexture(
    Math.round(w * 64),
    Math.round(h * 64),
    (g) => {
      const [cw, ch] = [Math.round(w * 64), Math.round(h * 64)];
      g.fillStyle = INK;
      g.fillRect(0, 0, cw, ch);
      g.strokeStyle = "#d4a93a";
      g.lineWidth = 2;
      g.strokeRect(3, 3, cw - 6, ch - 6);
      g.textBaseline = "middle";
      g.textAlign = "left";
      g.fillStyle = "#ffe28a";
      fit(g, title, 14, ch / 2, cw * 0.5, ch * 0.5, 900);
      g.textAlign = "right";
      g.fillStyle = "#d9c9a4";
      fit(g, sub, cw - 14, ch / 2, cw * 0.42, ch * 0.34, 600);
    },
    true,
  );
  m.box([w + 0.06, h + 0.06, 0.05], C.woodDark, [0, 0, 0], 0.01);
  m.plane(w, h, glow("#fff", tex), [0, (h + 0.06) / 2, 0.03]);
  return m;
}

/** A standing sign for a staged set ("THE LOUNGE"), on two posts, readable from the front. */
export function setSign(title: string, sub: string): Model {
  const m = new Model();
  const [w, h] = [1.9, 0.52];
  for (const s of [-1, 1]) {
    m.box([0.07, 1.3, 0.07], C.woodDark, [s * (w / 2 - 0.1), 0, 0], 0.015);
    m.box([0.2, 0.05, 0.2], C.woodDark, [s * (w / 2 - 0.1), 0, 0], 0.01);
  }
  const tex = canvasTexture(
    Math.round(w * 96),
    Math.round(h * 96),
    (g) => {
      const [cw, ch] = [Math.round(w * 96), Math.round(h * 96)];
      g.fillStyle = INK;
      g.fillRect(0, 0, cw, ch);
      g.strokeStyle = "#d4a93a";
      g.lineWidth = 3;
      g.strokeRect(4, 4, cw - 8, ch - 8);
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.fillStyle = "#ffe28a";
      fit(g, title, cw / 2, ch * 0.36, cw - 24, ch * 0.4, 900);
      g.fillStyle = "#d9c9a4";
      fit(g, sub, cw / 2, ch * 0.74, cw - 24, ch * 0.24, 600);
    },
    true,
  );
  const board = m.part([0, 0.92, 0.04]);
  board.box([w + 0.06, h + 0.06, 0.05], C.woodDark, [0, 0, 0], 0.01);
  board.plane(w, h, glow("#fff", tex), [0, (h + 0.06) / 2, 0.03]);
  return m;
}

// MARK: Shelf bank

export interface BankSlot {
  id: string;
  model: Model;
  row: Pick<FurnRow, "name" | "price" | "level" | "earned">;
}

/** Scales `m` so it fits `maxH` tall and `maxW` wide, and returns its footprint size. */
export function fitTo(m: THREE.Object3D, maxH: number, maxW: number): void {
  m.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(m);
  const s = Math.min(
    1,
    maxH / Math.max(0.01, box.max.y - box.min.y),
    maxW / Math.max(0.01, box.max.x - box.min.x),
  );
  m.scale.setScalar(s);
}

/**
 * A wooden display bank, `w` wide and one tile deep: three planks on a back panel, three pieces to a plank
 * (shrunk to fit), a price placard on each plank's lip. Returns the model and where each slot sits
 * (`col` = the tile along the bank).
 */
export function shelfBank(w: number, slots: readonly BankSlot[]): { model: Model; cols: number[] } {
  const m = new Model();
  const H = 2.45;
  const levels = [0.14, 1.0, 1.86];
  const wood = C.wood;
  for (const s of [-1, 1]) m.box([0.08, H, 0.62], C.woodDark, [s * (w / 2 - 0.04), 0, 0], 0.012);
  m.box([w - 0.02, H - 0.1, 0.05], tint(C.woodLight, 0.15), [0, 0.05, -0.28], 0.008);
  m.box([w + 0.1, 0.08, 0.7], C.woodDark, [0, H, 0], 0.012);
  for (const y of levels) {
    m.box([w - 0.1, 0.07, 0.6], wood, [0, y - 0.07, 0], 0.01);
    m.box([w - 0.1, 0.2, 0.03], C.woodDark, [0, y - 0.17, 0.3], 0.006);
  }
  m.box([w - 0.12, 0.1, 0.58], C.woodDark, [0, 0, 0], 0.01);
  // A header strip with the bank's name.
  const head = headerBoard("SMALL THINGS", "lamps · plants · globe · ducks", w - 0.1, 0.3);
  head.position.set(0, H + 0.1, 0.33);
  m.add(head);
  const per = Math.ceil(slots.length / levels.length);
  const cols: number[] = [];
  const pitch = (w - 0.3) / per;
  slots.forEach((s, i) => {
    const lvl = Math.floor(i / per);
    const k = i % per;
    const x = -w / 2 + 0.15 + pitch * (k + 0.5);
    s.model.updateMatrixWorld(true);
    fitTo(s.model, 0.66, pitch - 0.2);
    const holder = m.part([x, levels[lvl]!, -0.06]);
    holder.add(s.model);
    // The price rail on the plank's lip.
    const tag = wallTag(s.row, Math.min(pitch - 0.1, 0.9));
    tag.position.set(x, levels[lvl]! - 0.1, 0.3);
    m.add(tag);
    cols.push(Math.min(Math.floor(w / 2 + x), Math.floor(w) - 1));
  });
  return { model: m, cols };
}

// MARK: Counter and till

/** A checkout counter `w` tiles long: oak front, a white top, till, tape measure, catalogues and a bell. */
export function counter(w: number): Model {
  const m = new Model();
  m.box([w, 0.9, 0.9], C.woodLight, [0, 0, 0], 0.02);
  for (let x = -w / 2 + 0.2; x < w / 2 - 0.1; x += 0.25)
    m.box([0.03, 0.78, 0.02], C.wood, [x, 0.06, 0.46], 0.005);
  m.box([w + 0.12, 0.08, 1.0], "#f3ead8", [0, 0.9, 0], 0.02);
  m.box([w - 0.1, 0.1, 0.04], C.woodDark, [0, 0.0, 0.47], 0.01);
  // The till on the right.
  const till = m.part([w / 2 - 1.0, 0.98, -0.05]);
  till.box([0.62, 0.2, 0.5], "#4a4f63", [0, 0, 0], 0.03);
  till.box([0.5, 0.16, 0.04], "#2b2433", [0, 0.14, 0.12], 0.01).rotation.x = -0.4;
  till.plane(0.44, 0.12, glow("#7ee0a0"), [0, 0.22, 0.17]).rotation.x = -0.4;
  for (let i = 0; i < 3; i++)
    for (let j = 0; j < 2; j++)
      till.box([0.09, 0.03, 0.07], "#e8e2d4", [-0.15 + i * 0.15, 0.2, 0.0 - j * 0.0 + 0.0 + j * 0.0], 0.008);
  till.box([0.5, 0.05, 0.26], "#3b3f50", [0, 0, 0.28], 0.015);
  // A big tape measure on a hook, a stack of catalogues, a brass bell and a pencil jar.
  const tape = m.part([-w / 2 + 1.3, 0.98, 0.1]);
  tape.cyl(0.17, 0.1, "#f2c230", [0, 0, 0], 0.17, 18);
  tape.cyl(0.07, 0.11, "#2b2433", [0, 0, 0], 0.07, 12);
  tape.box([0.4, 0.015, 0.05], "#f6df74", [0.3, 0.0, 0.1], 0.004);
  for (let i = 0; i < 4; i++) tape.box([0.012, 0.016, 0.052], INK, [0.14 + i * 0.1, 0.0, 0.1]);
  const books = m.part([-w / 2 + 3.0, 0.98, 0.0]);
  ["#c4544b", "#4f8fe0", "#58b36a", "#f0b53c"].forEach((c, i) => {
    books.box([0.5 - i * 0.02, 0.06, 0.38], c, [0, i * 0.06, 0], 0.01).rotation.y = i * 0.18;
  });
  m.cyl(0.09, 0.02, "#c98a00", [-w / 2 + 2.2, 0.98, 0.18], 0.09, 12);
  m.ball(0.08, "#f5c842", [-w / 2 + 2.2, 1.04, 0.18], [1, 0.8, 1], 12);
  const jar = m.part([w / 2 - 2.2, 0.98, 0.2]);
  jar.cyl(0.07, 0.15, glass("#d6ecf2", 0.8), [0, 0, 0], 0.07, 10);
  for (const [x, c] of [
    [-0.02, "#f2c230"],
    [0.02, "#e8584f"],
    [0.0, "#4f8fe0"],
  ] as const) {
    const p = jar.box([0.02, 0.28, 0.02], c, [x, 0.02, 0.0], 0.004);
    p.rotation.z = x * 3;
  }
  // A sample-fan of wallpaper chips.
  const fan = m.part([w / 2 - 3.1, 0.98, 0.15]);
  ["#f5e3bd", "#c8503c", "#9fb59a", "#a9b3bd", "#f3d983"].forEach((c, i) => {
    const chip = fan.box([0.06, 0.012, 0.36], c, [0, i * 0.013, 0], 0.003);
    chip.rotation.y = -0.5 + i * 0.25;
  });
  // A little open sign on the front.
  const tex = canvasTexture(
    192,
    48,
    (g) => {
      g.fillStyle = INK;
      g.fillRect(0, 0, 192, 48);
      g.fillStyle = "#ffe28a";
      g.font = "900 26px system-ui, sans-serif";
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.fillText("PAY HERE", 96, 26);
    },
    true,
  );
  m.plane(1.3, 0.3, glow("#fff", tex), [w / 2 - 1.1, 0.42, 0.48]);
  return m;
}

// MARK: The shopkeeper

export interface Shopkeeper {
  avatar: Avatar;
  /** The name tag and greeting sprites, on the avatar's root. */
  tag: THREE.Sprite;
  bubble: THREE.Sprite;
}

const GREETINGS = [
  "Welcome in! Measure twice, buy once.",
  "Looking for a sofa? A very good question.",
  "That rug ties the whole room together.",
  "Wallpaper samples are free to touch.",
  "Mind the tape. It bites.",
  "Everything here is real oak. Mostly.",
];

function spriteOf(
  w: number,
  h: number,
  draw: (g: CanvasRenderingContext2D, cw: number, ch: number) => void,
): THREE.Sprite {
  const cw = Math.round(w * 160);
  const ch = Math.round(h * 160);
  const tex = canvasTexture(cw, ch, (g) => draw(g, cw, ch), true);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
  s.scale.set(w, h, 1);
  s.renderOrder = 10;
  return s;
}

/** Freja, the shopkeeper: a work apron with a pencil pocket, a measuring tape round her neck and in her hand. */
export function makeShopkeeper(): Shopkeeper {
  const look = personLook({
    skin: SKINS[1]!,
    hair: HAIRS[2]!,
    style: 3,
    outfit: ["#f2f0ea", "#cfcac0"],
    pants: "#4c5a6e",
    hat: "none",
    glasses: true,
  });
  const avatar = new Avatar(look);
  const b = avatar.body;
  const apron = "#c98a3a";
  const strap = "#a86d24";
  // The apron: bib, straps, a skirt over the hips, a pocket with a pencil in it.
  b.box([0.27, 0.24, 0.02], apron, [0, 0.5, 0.1], 0.008);
  for (const s of [-1, 1]) {
    b.box([0.04, 0.03, 0.2], strap, [s * 0.09, 0.755, 0], 0.006);
    b.box([0.04, 0.2, 0.02], strap, [s * 0.09, 0.66, 0.1], 0.006);
  }
  b.box([0.29, 0.18, 0.02], apron, [0, 0.31, 0.1], 0.008);
  b.box([0.12, 0.08, 0.025], tint(apron, -0.12), [0.06, 0.34, 0.112], 0.005);
  b.box([0.015, 0.1, 0.015], "#f2c230", [0.08, 0.38, 0.114], 0.003);
  b.box([0.3, 0.015, 0.215], strap, [0, 0.4, 0], 0.003);
  // A yellow tape draped round the neck, ends hanging down the front.
  const tapeY = "#f2c230";
  b.box([0.3, 0.035, 0.22], tapeY, [0, 0.755, 0], 0.006);
  for (const s of [-1, 1]) {
    b.box([0.035, 0.2, 0.012], tapeY, [s * 0.075, 0.57, 0.115], 0.003);
    for (let i = 0; i < 4; i++) b.box([0.036, 0.008, 0.014], INK, [s * 0.075, 0.6 + i * 0.045, 0.117], 0.001);
  }
  // A tape-measure case clipped to the hip.
  const case_ = b.part([-0.16, 0.34, 0.0]);
  case_.cyl(0.05, 0.05, tapeY, [0, 0, 0], 0.05, 10);
  case_.cyl(0.02, 0.055, INK, [0, 0, 0], 0.02, 8);
  // The tape in her hand: a case, and a strip she pulls out and puts away.
  const hand = avatar.arms[1];
  hand.cyl(0.04, 0.05, tapeY, [0, -0.3, 0.08], 0.04, 10);
  hand.cyl(0.015, 0.055, INK, [0, -0.3, 0.08], 0.015, 8);
  const blade = hand.part([0.0, -0.27, 0.12]);
  const strip = blade.box([0.03, 0.012, 1], "#f6df74", [0, 0, 0.5], 0.002);
  strip.scale.z = 0.01;
  for (let i = 0; i < 12; i++) blade.box([0.031, 0.013, 0.01], INK, [0, 0, 0.04 + i * 0.06]);
  blade.visible = true;

  const tagTex = spriteOf(1.5, 0.42, (g, w, h) => {
    g.fillStyle = "rgba(43,36,51,0.92)";
    g.beginPath();
    g.roundRect(2, 2, w - 4, h - 4, 14);
    g.fill();
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillStyle = "#c98a3a";
    g.font = "700 22px system-ui, sans-serif";
    g.fillText("MØBELHUSET", w / 2, h * 0.28);
    g.fillStyle = "#fff4d6";
    g.font = "800 30px system-ui, sans-serif";
    g.fillText("Freja Lv 24", w / 2, h * 0.66);
  });
  tagTex.position.set(0, avatar.height + 0.22, 0);
  avatar.root.add(tagTex);

  let line = 0;
  const bubble = spriteOf(2.6, 0.5, () => {});
  const paint = (text: string) => {
    const mat = bubble.material;
    const tex = canvasTexture(
      416,
      80,
      (g) => {
        g.fillStyle = "#fffdf6";
        g.strokeStyle = INK;
        g.lineWidth = 4;
        g.beginPath();
        g.roundRect(3, 3, 410, 60, 16);
        g.fill();
        g.stroke();
        g.fillStyle = INK;
        g.textAlign = "center";
        g.textBaseline = "middle";
        fit(g, text, 208, 34, 390, 25, 700);
        g.fillStyle = "#fffdf6";
        g.beginPath();
        g.moveTo(190, 62);
        g.lineTo(208, 78);
        g.lineTo(224, 62);
        g.fill();
      },
      true,
    );
    mat.map = tex;
    mat.needsUpdate = true;
  };
  paint(GREETINGS[0]!);
  bubble.position.set(0, avatar.height + 0.72, 0);
  avatar.root.add(bubble);

  // Idle: she measures the air, now and then, and says something every few seconds.
  const update = avatar.update.bind(avatar);
  let shown = -1;
  avatar.update = (dt, t) => {
    update(dt, t);
    const cycle = (t % 9) / 9;
    const measuring = cycle > 0.35 && cycle < 0.75;
    const k = measuring ? Math.sin(((cycle - 0.35) / 0.4) * Math.PI) : 0;
    avatar.arms[1].rotation.x = -0.15 - k * 1.25;
    avatar.arms[1].rotation.z = -0.1 - k * 0.15;
    strip.scale.z = Math.max(0.01, k * 1.0);
    strip.position.z = strip.scale.z * 0.5;
    avatar.head.rotation.y = Math.sin(t * 0.45) * 0.3;
    const slot = Math.floor(t / 9);
    if (slot !== shown && cycle < 0.04) {
      shown = slot;
      line = (line + 1) % GREETINGS.length;
      paint(GREETINGS[line]!);
    }
    bubble.visible = cycle < 0.5;
  };
  return { avatar, tag: tagTex, bubble };
}

// MARK: Door and bits

/** A rack of rolled wallpaper in a crate: for the wall behind the counter. */
export function wallpaperRolls(): Model {
  const m = new Model();
  m.box([1.2, 0.5, 0.5], C.woodDark, [0, 0, 0], 0.02);
  const cols = ["#f5e3bd", "#c8503c", "#9fb59a", "#a9b3bd", "#f3d983", "#10151a", "#a14d3b", "#b88a58"];
  cols.forEach((c, i) => {
    const r = m.cyl(0.1, 0.9, c, [-0.45 + (i % 4) * 0.3, 0.4, i < 4 ? -0.1 : 0.1], 0.1, 10);
    r.userData.noBlock = false;
    m.cyl(0.04, 0.92, "#e8e2d4", [-0.45 + (i % 4) * 0.3, 0.4, i < 4 ? -0.1 : 0.1], 0.04, 6);
  });
  return m;
}

/**
 * The company-supplies catalogue desk: two tiles wide, a ledger open on top, a rack of poster tubes, a small
 * lamp and a sign on the front. It opens the shop's Company tab. Faces +z like the counter.
 */
export function suppliesDesk(): Model {
  const m = new Model();
  const w = 2;
  m.box([w, 0.9, 0.9], C.woodLight, [0, 0, 0], 0.02);
  m.box([w + 0.1, 0.08, 1.0], "#f3ead8", [0, 0.9, 0], 0.02);
  m.box([w - 0.1, 0.1, 0.04], C.woodDark, [0, 0.0, 0.47], 0.01);
  // The ledger: two pages, a spine, and a ribbon.
  const book = m.part([-0.4, 0.98, 0.05]);
  book.box([0.5, 0.05, 0.4], "#8a3f30", [0, 0, 0], 0.01);
  book.box([0.23, 0.02, 0.36], PAPER, [-0.125, 0.05, 0], 0.004);
  book.box([0.23, 0.02, 0.36], PAPER, [0.125, 0.05, 0], 0.004);
  for (let i = 0; i < 3; i++) book.box([0.16, 0.004, 0.012], INK, [-0.125, 0.072, -0.1 + i * 0.09]);
  book.box([0.02, 0.005, 0.3], "#c8503c", [0.02, 0.072, 0.02]);
  // A stack of order slips and a pen.
  const slips = m.part([0.1, 0.98, 0.05]);
  ["#f5e3bd", "#fff", "#f3d983"].forEach((c, i) => {
    slips.box([0.3, 0.012, 0.22], c, [0, i * 0.013, 0], 0.003).rotation.y = i * 0.2;
  });
  m.box([0.2, 0.015, 0.02], "#4f8fe0", [0.1, 1.04, 0.2], 0.004).rotation.y = 0.5;
  // Poster tubes standing in a rack at the right end.
  const rack = m.part([0.72, 0.98, -0.05]);
  rack.box([0.4, 0.04, 0.3], C.woodDark, [0, 0, 0], 0.01);
  [-0.12, 0, 0.12].forEach((x, i) => {
    rack.cyl(0.05, 0.55 + i * 0.04, ["#c8503c", "#4f8fe0", "#f0b53c"][i]!, [x, 0.03, 0], 0.05, 10);
  });
  // A small desk lamp on the left end.
  const lamp = m.part([-0.85, 0.98, -0.1]);
  lamp.cyl(0.08, 0.03, C.woodDark, [0, 0, 0], 0.08, 10);
  lamp.box([0.02, 0.3, 0.02], "#4a4f63", [0, 0.03, 0], 0.004);
  lamp.cyl(0.1, 0.1, glow("#ffe9b0"), [0.0, 0.3, 0.04], 0.04, 10);
  // The sign on the front.
  const tex = canvasTexture(
    192,
    48,
    (g) => {
      g.fillStyle = INK;
      g.fillRect(0, 0, 192, 48);
      g.strokeStyle = "#d4a93a";
      g.lineWidth = 2;
      g.strokeRect(3, 3, 186, 42);
      g.fillStyle = "#ffe28a";
      g.textAlign = "center";
      g.textBaseline = "middle";
      fit(g, "COMPANY SUPPLIES", 96, 18, 170, 22, 900);
      g.fillStyle = "#d9c9a4";
      fit(g, "order from the catalogue", 96, 36, 170, 12, 600);
    },
    true,
  );
  m.plane(1.7, 0.42, glow("#fff", tex), [0, 0.4, 0.48]);
  return m;
}

/** A pendant lamp that lights at night: a cord, a shade, a warm point light. */
export function pendant(color = "#ffd9a0", intensity = 5, distance = 8): Model {
  const m = new Model();
  const shade = m.cyl(0.32, 0.22, "#f3ead8", [0, 2.0, 0], 0.1, 14);
  nightGlow(shade, "#fff0c0");
  m.cyl(0.012, 0.4, C.metal, [0, 2.22, 0], 0.012, 6);
  light(m, [0, 1.9, 0], color, intensity, distance);
  return m;
}

// MARK: The storefront

/** A big voxel armchair for the roof: the shop's sign. */
function roofArmchair(m: Model, at: V3): void {
  const a = m.part(at);
  const cloth = "#e0a63a";
  a.box([0.9, 0.18, 0.8], tint(cloth, -0.1), [0, 0.18, 0], 0.03);
  a.box([0.9, 0.2, 0.75], cloth, [0, 0.34, 0.03], 0.05);
  a.box([0.9, 0.7, 0.18], cloth, [0, 0.28, -0.32], 0.06);
  for (const s of [-1, 1]) a.box([0.18, 0.4, 0.76], tint(cloth, -0.06), [s * 0.5, 0.2, 0], 0.05);
  for (const sx of [-1, 1])
    for (const sz of [-1, 1]) a.box([0.07, 0.2, 0.07], C.woodDark, [sx * 0.44, 0, sz * 0.34], 0.01);
  a.box([0.34, 0.3, 0.1], "#f4efe4", [0.22, 0.52, -0.2], 0.04).rotation.z = 0.15;
}

/**
 * The showroom's front: a 5x4-tile Danish shop house, cream walls, teal trim, striped awnings over two big
 * display windows (little room-sets inside), a glass door in the middle, the name on a band above, and
 * a yellow armchair on the roof. Faces +z; origin on the ground at the middle of the front wall.
 */
export function furnitureStorefront(): Model {
  const m = new Model();
  m.name = "building:furniture";
  const [w, d, h] = [4.7, 3.6, 2.2];
  const wall = "#f4ecdc";
  const trim = "#2c5f5a";
  const niche = 0.55;
  m.box([w + 0.18, 0.22, d + 0.18], C.stone, [0, 0, -d / 2], 0.02);
  // The body behind the display niches.
  m.box([w, h - 0.22, d - niche], wall, [0, 0.22, -niche - (d - niche) / 2], 0.02);
  m.box([w - 0.1, h - 0.22, 0.05], "#e8d2a6", [0, 0.22, -niche], 0.01);
  // Side walls and a back wall of the niche run.
  for (const s of [-1, 1]) m.box([0.12, h - 0.23, niche], wall, [s * (w / 2 - 0.06), 0.22, -niche / 2], 0.01);
  // Front skin: sills, piers, the band over the windows.
  const winW = 1.45;
  const winX = 1.5;
  const winY = [0.5, 1.34] as const;
  for (const s of [-1, 1]) {
    m.box([winW + 0.2, winY[0] - 0.22, 0.12], wall, [s * winX, 0.22, -0.06], 0.01);
    m.box([0.3, h - 0.23, 0.12], wall, [s * (w / 2 - 0.15), 0.22, -0.06], 0.01);
    m.box([0.34, 1.25, 0.12], wall, [s * 0.67, 0.22, -0.06], 0.01);
  }
  m.box([w, h - 1.31, 0.12], wall, [0, 1.3, -0.06], 0.01);
  m.box([w + 0.06, 0.1, 0.18], trim, [0, h - 0.1, -0.04], 0.01);
  m.box([w + 0.05, 0.085, 0.15], trim, [0, 0.215, -0.035], 0.01);
  // Windows: frame, glass, a little room-set inside.
  const set = (s: number) => {
    const win = m.part([s * winX, 0, 0]);
    win.box([winW + 0.1, 0.07, 0.15], trim, [0, winY[0] - 0.05, -0.04], 0.01);
    win.box([winW + 0.1, 0.07, 0.15], trim, [0, winY[1], -0.04], 0.01);
    for (const x of [-1, 1])
      win.box([0.06, winY[1] - winY[0], 0.15], trim, [x * (winW / 2 + 0.02), winY[0], -0.04], 0.01);
    win.box([0.04, winY[1] - winY[0], 0.12], trim, [0, winY[0], -0.04], 0.005);
    const glassPane = win.box(
      [winW - 0.02, winY[1] - winY[0] - 0.05, 0.02],
      glass("#bfe4f2", 0.28),
      [0, winY[0] + 0.02, -0.014],
      0.002,
    );
    glassPane.castShadow = false;
    // The niche floor and its warm back wall, lit at night.
    win.box([winW, 0.04, niche], tint(C.floor, 0.1), [0, winY[0] - 0.03, -niche / 2 - 0.02], 0.004);
    const back = win.box(
      [winW - 0.04, winY[1] - winY[0] - 0.05, 0.02],
      glow("#ffecc4"),
      [0, winY[0] + 0.02, -niche + 0.04],
      0.002,
    );
    nightGlow(back, "#ffe6a8");
    return win;
  };
  const left = set(-1);
  const right = set(1);
  const stage = (win: Model, id: string, at: V3, scale: number, turn = 0) => {
    const a = assetById.get(id);
    if (!a) return;
    const p = a.build();
    p.scale.setScalar(scale);
    p.position.set(at[0], winY[0] + at[1], at[2]);
    p.rotation.y = turn;
    win.add(p);
  };
  stage(left, "sofa-chesterfield", [-0.12, 0, -0.26], 0.52);
  stage(left, "arc-lamp", [0.58, 0, -0.3], 0.5);
  stage(left, "plant", [-0.6, 0, -0.34], 0.55);
  stage(left, "coffee-table", [-0.1, 0, 0.0], 0.34);
  stage(right, "lounge-chair", [-0.4, 0, -0.2], 0.58);
  stage(right, "monstera", [0.58, 0, -0.3], 0.5);
  stage(right, "bookshelf-library", [0.08, 0, -0.38], 0.44);
  // Awnings over the windows.
  for (const s of [-1, 1]) {
    const aw = m.part([s * winX, winY[1] + 0.1, 0.0]);
    for (let i = 0; i < 6; i++) {
      const x = -winW / 2 - 0.1 + (i + 0.5) * ((winW + 0.2) / 6);
      const strip = aw.part([x, 0, 0]);
      const board = strip.box(
        [(winW + 0.2) / 6, 0.04, 0.5],
        i % 2 ? "#f4efe4" : "#c4544b",
        [0, 0, 0.0],
        0.005,
      );
      board.position.set(0, -0.08, 0.24);
      board.rotation.x = 0.4;
      strip.box([(winW + 0.2) / 6, 0.1, 0.03], i % 2 ? "#f4efe4" : "#c4544b", [0, -0.21, 0.43], 0.005);
    }
  }
  // The name, on a band above windows and door.
  const bandTex = canvasTexture(
    512,
    96,
    (g) => {
      g.fillStyle = "#1f3f3c";
      g.beginPath();
      g.roundRect(0, 0, 512, 96, 14);
      g.fill();
      g.strokeStyle = "#d4a93a";
      g.lineWidth = 5;
      g.strokeRect(6, 6, 500, 84);
      g.fillStyle = "#ffe28a";
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.font = "900 54px system-ui, sans-serif";
      g.fillText("MØBELHUSET", 256, 40);
      g.fillStyle = "#d9c9a4";
      g.font = "700 22px system-ui, sans-serif";
      g.fillText("FURNITURE · WALLPAPER · FLOORS · POSTERS", 256, 74);
    },
    true,
  );
  m.box([3.7, 0.36, 0.06], "#1f3f3c", [0, h - 0.5, 0.03], 0.015);
  m.plane(3.62, 0.34, glow("#fff", bandTex), [0, h - 0.5 + 0.18, 0.07]);
  // The door: glass, teal frame, a brass handle and the open sign.
  const door = m.part([0, 0.22, 0.0]);
  door.box([1.12, 1.18, 0.1], trim, [0, 0, -0.03], 0.02);
  door.box([0.88, 0.98, 0.06], glass("#bfe4f2", 0.5), [0, 0.06, 0.0], 0.01);
  door.box([0.88, 0.04, 0.08], trim, [0, 0.62, 0.0]);
  door.box([0.04, 0.98, 0.08], trim, [0, 0.06, 0.0]);
  door.box([0.88, 0.3, 0.07], tint(trim, 0.1), [0, 0.0, 0.0], 0.01);
  door.box([0.025, 0.3, 0.05], "#e9b73d", [0.34, 0.45, 0.07], 0.008);
  door.box([1.5, 0.12, 0.5], C.stoneLight, [0, 0, 0.2], 0.02);
  // The hanging sign beside the door.
  const hang = m.part([w / 2 - 0.18, h - 0.65, 0.18]);
  hang.box([0.04, 0.04, 0.4], C.woodDark, [0, 0.1, -0.15]);
  const swing = hang.part([0, 0, 0.0]);
  swing.box([0.04, 0.3, 0.04], C.woodDark, [0, -0.3, 0.0]);
  swing.box([0.4, 0.36, 0.05], "#f4efe4", [0, -0.66, 0.0], 0.02);
  swing.box([0.3, 0.1, 0.06], "#e0a63a", [0, -0.5, 0.0], 0.02);
  swing.box([0.18, 0.16, 0.06], "#e0a63a", [0, -0.7, 0.0], 0.03);
  ticks.push((time) => (swing.rotation.z = Math.sin(time * 1.5) * 0.07));
  // The roof: a low parapet, a skylight and the big yellow armchair.
  m.box([w + 0.16, 0.1, d + 0.16], "#7b7f8c", [0, h, -d / 2], 0.02);
  for (const [sx, sz, bw, bd] of [
    [0, 0.04, w + 0.2, 0.12],
    [0, -d - 0.04, w + 0.2, 0.12],
    [w / 2 + 0.04, -d / 2, 0.12, d],
    [-w / 2 - 0.04, -d / 2, 0.12, d],
  ] as const)
    m.box([bw, 0.22, bd], wall, [sx, h + 0.06, sz], 0.01);
  m.box([w + 0.24, 0.05, 0.16], trim, [0, h + 0.26, 0.04], 0.01);
  roofArmchair(m, [0, h + 0.1, -0.9]);
  m.box([1.1, 0.14, 0.9], glass("#bfe4f2", 0.6), [-1.4, h + 0.1, -2.1], 0.02);
  m.box([0.5, 0.5, 0.5], "#a36a50", [1.6, h + 0.1, -2.6], 0.03);
  // The pavement in front: flower boxes, potted plants, a sandwich board, a rolled rug.
  for (const s of [-1, 1]) {
    const pot = m.part([s * 2.45, 0, 0.45]);
    pot.cyl(0.17, 0.3, "#c9835a", [0, 0, 0], 0.13, 10);
    pot.ball(0.28, C.leaf, [0, 0.55, 0], [1, 1.25, 1], 8);
    pot.ball(0.18, C.leafLight, [0.12, 0.8, 0.03], [1, 1, 1], 8);
  }
  const board = m.part([1.75, 0, 0.8], -0.25);
  board.box([0.7, 0.8, 0.06], INK, [0, 0, 0], 0.01);
  board.box([0.08, 0.5, 0.04], C.woodDark, [0, 0, -0.2], 0.01).rotation.x = -0.4;
  const boardTex = canvasTexture(
    120,
    140,
    (g) => {
      g.fillStyle = "#2b2433";
      g.fillRect(0, 0, 120, 140);
      g.fillStyle = "#ffe28a";
      g.textAlign = "center";
      g.font = "900 30px system-ui, sans-serif";
      g.fillText("SALE", 60, 34);
      g.fillStyle = "#fff";
      g.font = "700 15px system-ui, sans-serif";
      g.fillText("free measuring", 60, 62);
      g.fillText("posters 60+", 60, 84);
      g.fillText("walls & floors", 60, 106);
      g.fillStyle = "#ffb0a0";
      g.fillText("come on in!", 60, 128);
    },
    true,
  );
  board.plane(0.62, 0.72, glow("#fff", boardTex), [0, 0.42, 0.04]);
  const roll = m.part([-2.0, 0.0, 0.7], 0.2);
  roll.cyl(0.13, 0.9, "#c4544b", [0, 0.0, 0], 0.13, 12).rotation.z = 0.26;
  roll.cyl(0.13, 0.04, "#e0a15a", [0, 0.9, 0], 0.13, 12).rotation.z = 0.26;
  // Lanterns each side of the door.
  for (const s of [-1, 1]) {
    m.box([0.05, 0.18, 0.05], C.metal, [s * 0.78, 1.18, 0.08]);
    nightGlow(m.box([0.14, 0.2, 0.14], "#f5d98a", [s * 0.78, 0.96, 0.12], 0.04), "#ffe28a");
  }
  light(m, [0, 1.0, 0.9], "#ffcf7a", 3, 6);
  return m;
}
