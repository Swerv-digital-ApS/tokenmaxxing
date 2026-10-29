/**
 * Small pieces the Clothes shop is dressed with: price tags with a rarity bar and a lock, the padlock itself,
 * the shop sign, and the speech bubble over the shopkeeper.
 */
import * as THREE from "three";
import { canvasTexture, glow, Model, painted } from "../kit/kit.ts";
import { isLocked, metaOf, RARITY_HEX, type ShopItem } from "./clothes-items.ts";

export const INK = "#2a2230";
export const GOLD = "#f5c842";
export const PLUM = "#6b3f6e";
export const PINK = "#e8789a";
export const CREAM = "#fbf4ea";

const fit = (g: CanvasRenderingContext2D, text: string, max: number): string[] => {
  const words = text.split(" ");
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (g.measureText(next).width > max && line) {
      lines.push(line);
      line = w;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines.slice(0, 2);
};

function lockGlyph(g: CanvasRenderingContext2D, x: number, y: number, s: number, color: string): void {
  g.fillStyle = color;
  g.fillRect(x, y + s * 0.45, s, s * 0.55);
  g.strokeStyle = color;
  g.lineWidth = Math.max(2, s * 0.16);
  g.beginPath();
  g.arc(x + s / 2, y + s * 0.45, s * 0.28, Math.PI, 0);
  g.stroke();
  g.fillStyle = INK;
  g.fillRect(x + s * 0.44, y + s * 0.62, s * 0.12, s * 0.2);
}

/** What a tag says about how to get the item. */
export function priceLine(item: ShopItem): string {
  const m = metaOf.get(item.id);
  if (m?.boss) return `${m.boss} drop`;
  if (item.level !== undefined) return `Lv ${item.level}`;
  return item.price === 0 ? "Free" : String(item.price);
}

/** A tag `w` x `h` world units: the rarity bar, the name, the price (a coin) or the lock with its level or boss. */
export function priceTag(item: ShopItem, w = 0.8, h = 0.3): Model {
  const px = 200;
  const rarity = RARITY_HEX[metaOf.get(item.id)?.rarity ?? "common"];
  const locked = isLocked(item.id);
  const m = new Model();
  const cw = Math.round(w * px);
  const ch = Math.round(h * px);
  const tex = canvasTexture(
    cw,
    ch,
    (g) => {
      g.fillStyle = CREAM;
      g.fillRect(0, 0, cw, ch);
      g.fillStyle = rarity;
      g.fillRect(0, 0, cw, Math.round(ch * 0.2));
      g.fillStyle = INK;
      g.textBaseline = "middle";
      g.font = `800 ${Math.round(ch * 0.2)}px system-ui, sans-serif`;
      const lines = fit(g, item.name, cw - 12);
      for (const [i, l] of lines.entries()) g.fillText(l, 6, ch * (0.36 + i * 0.19), cw - 10);
      const y = ch * 0.8;
      g.font = `900 ${Math.round(ch * 0.26)}px system-ui, sans-serif`;
      if (locked) {
        lockGlyph(g, 6, y - ch * 0.15, ch * 0.28, item.level !== undefined ? GOLD : "#d23c3c");
        g.fillStyle = INK;
        g.fillText(priceLine(item), 8 + ch * 0.34, y, cw - ch * 0.4);
      } else {
        g.fillStyle = GOLD;
        g.beginPath();
        g.arc(6 + ch * 0.12, y, ch * 0.12, 0, Math.PI * 2);
        g.fill();
        g.strokeStyle = "#b8901a";
        g.lineWidth = 2;
        g.stroke();
        g.fillStyle = INK;
        g.fillText(priceLine(item), 10 + ch * 0.26, y);
      }
    },
    true,
  );
  m.box([w + 0.03, h + 0.03, 0.025], INK, [0, 0, 0], 0.006);
  m.plane(w, h, painted(tex), [0, (h + 0.03) / 2, 0.014]);
  return m;
}

/** A padlock about a tenth of a tile across: gold for a level reward, red for a boss drop. */
export function padlock(color: string): Model {
  const m = new Model();
  const arc = new THREE.Mesh(
    new THREE.TorusGeometry(0.045, 0.012, 6, 10, Math.PI),
    new THREE.MeshToonMaterial({ color: "#c9ced6" }),
  );
  arc.position.set(0, 0.09, 0);
  m.add(arc);
  m.box([0.13, 0.1, 0.05], color, [0, 0, 0], 0.012);
  m.box([0.02, 0.04, 0.012], INK, [0, 0.03, 0.03], 0.003);
  return m;
}

export function lockFor(id: string): Model {
  return padlock(metaOf.get(id)?.boss ? "#d23c3c" : GOLD);
}

/** A hanging board: a lit sign in the shop's pink and gold. */
export function signBoard(
  text: string,
  w: number,
  h: number,
  opts: { sub?: string; lit?: boolean } = {},
): Model {
  const px = 120;
  const cw = Math.round(w * px);
  const ch = Math.round(h * px);
  const tex = canvasTexture(
    cw,
    ch,
    (g) => {
      g.fillStyle = PLUM;
      g.fillRect(0, 0, cw, ch);
      g.strokeStyle = GOLD;
      g.lineWidth = Math.max(3, ch * 0.05);
      g.strokeRect(ch * 0.08, ch * 0.08, cw - ch * 0.16, ch * 0.84);
      g.fillStyle = "#ffe9b0";
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.font = `900 ${Math.round(ch * (opts.sub ? 0.4 : 0.5))}px Georgia, serif`;
      g.fillText(text, cw / 2, ch * (opts.sub ? 0.42 : 0.52), cw * 0.9);
      if (opts.sub) {
        g.fillStyle = PINK;
        g.font = `800 ${Math.round(ch * 0.2)}px system-ui, sans-serif`;
        g.fillText(opts.sub, cw / 2, ch * 0.76, cw * 0.9);
      }
    },
    true,
  );
  const m = new Model();
  m.box([w + 0.1, h + 0.1, 0.08], INK, [0, 0, 0], 0.02);
  m.plane(w, h, opts.lit ? glow("#fff", tex) : painted(tex), [0, (h + 0.1) / 2, 0.045]);
  return m;
}

/** A speech bubble that always faces the camera. */
export function bubble(lines: string[], name: string): { sprite: THREE.Sprite; say: (line: string) => void } {
  const cw = 360;
  const ch = 110;
  const canvas = document.createElement("canvas");
  canvas.width = cw;
  canvas.height = ch;
  const g = canvas.getContext("2d")!;
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const draw = (line: string) => {
    g.clearRect(0, 0, cw, ch);
    g.fillStyle = "#fffaf0";
    g.strokeStyle = INK;
    g.lineWidth = 5;
    g.beginPath();
    g.roundRect(4, 4, cw - 8, 78, 16);
    g.fill();
    g.stroke();
    g.beginPath();
    g.moveTo(cw / 2 - 12, 80);
    g.lineTo(cw / 2, 106);
    g.lineTo(cw / 2 + 12, 80);
    g.closePath();
    g.fill();
    g.stroke();
    g.fillStyle = "#fffaf0";
    g.fillRect(cw / 2 - 10, 78, 20, 6);
    g.fillStyle = PINK;
    g.font = "800 17px system-ui, sans-serif";
    g.textAlign = "center";
    g.fillText(name, cw / 2, 28);
    g.fillStyle = INK;
    g.font = "700 22px system-ui, sans-serif";
    g.fillText(line, cw / 2, 60, cw - 28);
    tex.needsUpdate = true;
  };
  draw(lines[0] ?? "Welcome!");
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }),
  );
  sprite.scale.set(1.5, 1.5 * (ch / cw), 1);
  sprite.center.set(0.5, 0);
  sprite.renderOrder = 10;
  return { sprite, say: draw };
}
