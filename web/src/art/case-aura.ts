import { CASE_BASE } from "@tokenmaxxing/core/case.ts";
import { NUSANTARA_BASE } from "@tokenmaxxing/core/case-nusantara.ts";
import { RAGNAROK_AURAS } from "./case-ragnarok-aura.ts";
import { FISHING_AURAS } from "./fishing-loot-aura.ts";
import { bake, cached, type Pen } from "./pixels.ts";

/**
 * The cases' legendary auras in 2D, four apiece (`core/src/case.ts` and `core/src/case-nusantara.ts`, slot "aura";
 * 3D in `render3d/people/gear3dAura.ts`). Like the level aura (`aura.ts`) each is a frame drawn behind the character:
 * `CA_W`×`CA_H` with the 16×16 character at (`CA_X`, `CA_Y`) inside it. Eight frames loop, `CA_MS` apiece.
 */
export const CA_X = 6;
export const CA_Y = 6;
export const CA_W = 28;
export const CA_H = 28;
const FRAMES = 8;
export const CA_MS = 170;
const CX = CA_X + 8;
const CY = CA_Y + 8;
const TAU = Math.PI * 2;

type Draw = (p: Pen, f: number) => void;

// Lantern Sky: four paper lanterns on a slow ring, glowing.
// prettier-ignore
const LANTERN = [
  ".d.",
  "ooo",
  "oyo",
  "ooo",
  ".d.",
];
const LANTERN_PAL = { d: "#6b2418", o: "#ff8a3c", y: "#ffe7a8" };
const lanterns: Draw = (p, f) => {
  for (let i = 0; i < 4; i++) {
    const a = (f / FRAMES) * TAU + (i * TAU) / 4;
    const x = Math.round(CX + Math.cos(a) * 11) - 1;
    const y = Math.round(CY - 1 + Math.sin(a) * 3.5 + (i % 2 ? -5 : 3)) - 2;
    p.disc(x + 1, y + 2, 4, "rgba(255, 170, 70, 0.22)");
    p.grid(LANTERN, LANTERN_PAL, x, y);
  }
};

// Sakura Storm: petals whirl up round the body and fall away.
const petals: Draw = (p, f) => {
  const cols = ["#ffb3cf", "#ff8fb8", "#ffd1e2", "#f77aa6"];
  for (let i = 0; i < 10; i++) {
    const k = (f / FRAMES + i / 10) % 1;
    const lift = k < 0.5 ? Math.sin((k / 0.5) * (Math.PI / 2)) : 1 - ((k - 0.5) / 0.5) ** 1.5;
    const a = k * 8 + i * 1.9;
    const r = 8 + (i % 3) * 1.6;
    const x = Math.round(CX + Math.cos(a) * r);
    const y = Math.round(CA_Y + 16 - lift * 18);
    p.px(x, y, cols[i % 4]!);
    if (i % 2 === 0) p.px(x + (Math.sin(a) > 0 ? 1 : -1), y, cols[(i + 1) % 4]!);
  }
};

// Firefly Swarm: green-gold specks that wander and blink.
const fireflies: Draw = (p, f) => {
  for (let i = 0; i < 11; i++) {
    const u = f / FRAMES + i * 0.37;
    const x = Math.round(CX + Math.sin(u * TAU * 0.5 + i * 2.1) * (7 + (i % 4)));
    const y = Math.round(CY + 1 + Math.cos(u * TAU * 0.5 + i * 1.3) * (8 + (i % 3)));
    const on = (f + i * 3) % 5 < 3;
    if (!on) continue;
    const col = i % 3 ? "#d8ff5a" : "#ffe45e";
    if ((f + i * 3) % 5 === 1) {
      p.px(x - 1, y, "rgba(190, 255, 90, 0.4)");
      p.px(x + 1, y, "rgba(190, 255, 90, 0.4)");
      p.px(x, y - 1, "rgba(190, 255, 90, 0.4)");
      p.px(x, y + 1, "rgba(190, 255, 90, 0.4)");
    }
    p.px(x, y, col);
  }
};

// Koi Current: a ribbon of koi circling on a tilted ring, tails flicking.
const koi: Draw = (p, f) => {
  const skins = [
    ["#ff7a2a", "#fff1e0"],
    ["#fff4e8", "#e8452a"],
    ["#ffb03a", "#fff4e8"],
  ] as const;
  for (let i = 0; i < 7; i++) {
    const a = (f / FRAMES) * TAU - i * 0.55;
    const x = Math.round(CX + Math.cos(a) * 11.5);
    const y = Math.round(CY + 1 + Math.sin(a) * 5 + Math.sin(a * 2) * 2);
    const [main, patch] = skins[i % 3]!;
    const dir = -Math.sin(a) >= 0 ? 1 : -1;
    p.px(x, y, main);
    p.px(x - dir, y, patch);
    p.px(x + dir, y, main);
    p.px(x - dir * 2, y + ((f + i) % 2 ? 1 : -1), patch);
    p.px(x + dir, y - 1, "rgba(159, 233, 255, 0.5)");
  }
};

// MARK: Nusantara

/** A pixel ring round (`cx`, `cy`), `rx` wide and `ry` tall. */
const ring = (p: Pen, cx: number, cy: number, rx: number, ry: number, color: string, steps = 64) => {
  for (let i = 0; i < steps; i++) {
    const a = (i / steps) * TAU;
    p.px(Math.round(cx + Math.cos(a) * rx), Math.round(cy + Math.sin(a) * ry), color);
  }
};

// Mega Mendung: four batik clouds, each four bands from deep indigo to pale blue, circling slowly and dripping.
const CLOUD_BANDS = ["#1b2a5e", "#243a73", "#4f78b8", "#cfe3f5"] as const;
const cloud = (p: Pen, x: number, y: number) => {
  const [d, i, b, l] = CLOUD_BANDS;
  p.disc(x, y, 3, d);
  p.disc(x - 4, y + 1, 2, d);
  p.disc(x + 4, y + 1, 2, d);
  p.rect(x - 6, y + 3, 13, 1, d);
  p.disc(x, y, 2, i);
  p.disc(x - 4, y + 1, 1, i);
  p.disc(x + 4, y + 1, 1, i);
  p.disc(x, y, 1, b);
  p.px(x - 4, y + 1, b);
  p.px(x + 4, y + 1, b);
  p.px(x, y, l);
  p.px(x - 1, y - 1, l);
};
const clouds: Draw = (p, f) => {
  for (let i = 0; i < 4; i++) {
    const a = (f / FRAMES) * TAU + (i * TAU) / 4;
    const x = Math.round(CX + Math.cos(a) * 9);
    const y = Math.round(CY + Math.sin(a) * 3.5 + (i % 2 ? -7 : 3));
    cloud(p, x, y);
    // Two drops fall from each cloud, fading as they go.
    for (let k = 0; k < 2; k++) {
      const t = ((f + i * 3 + k * 4) % FRAMES) / FRAMES;
      p.px(x - 2 + k * 4, y + 5 + Math.round(t * 7), `rgba(150, 200, 255, ${(1 - t).toFixed(2)})`);
    }
  }
};

// Gamelan Echo: gold ripples spread from the feet like a struck gong, four bronze discs on a ring ring out in turn.
const GONG = ["..ooo..", ".obbbo.", "obbyybo", "obbyybo", ".obbbo.", "..ooo.."];
const GONG_PAL = { o: "#6b4226", b: "#b9803a", y: "#ffd36a" };
const echo: Draw = (p, f) => {
  for (let k = 0; k < 3; k++) {
    const t = ((f + (k * FRAMES) / 3) % FRAMES) / FRAMES;
    const r = 3 + t * 11;
    ring(p, CX, CY + 6, r, r * 0.4, `rgba(233, 183, 61, ${(0.85 * (1 - t)).toFixed(2)})`);
  }
  for (let i = 0; i < 4; i++) {
    const a = (i * TAU) / 4 + TAU / 8;
    const x = Math.round(CX + Math.cos(a) * 11);
    const y = Math.round(CY + 4 + Math.sin(a) * 6);
    const lit = Math.floor(f / 2) % 4 === i;
    if (lit) p.disc(x, y, 4, "rgba(255, 211, 106, 0.35)");
    p.grid(GONG, lit ? { ...GONG_PAL, b: "#e0a548" } : GONG_PAL, x - 3, y - 3);
  }
};

// Wayang Shadows: a warm lamp glow and four black cut-out silhouettes edged in gold, orbiting.
const SHADOWS = [
  // leaf
  ["..g..", ".gkg.", "gkkkg", "gkkkg", ".gkg.", "..k..", "..g.."],
  // bird
  ["g.....g", "gkg.gkg", ".gkkkg.", "..gkg..", "...g..."],
  // tree
  ["..g..", ".gkg.", "gkkkg", ".gkg.", "gkkkg", "..k..", "..k.."],
  // a tall figure in a cone hat
  ["..g..", ".gkg.", "gkkkg", ".gkg.", ".gkg.", ".kkk.", ".gkg.", ".k.k."],
];
const SHADOW_PAL = { g: "#f2b632", k: "#14101a" };
const shadows: Draw = (p, f) => {
  ring(p, CX, CY + 1, 11, 9, "rgba(255, 170, 60, 0.22)");
  ring(p, CX, CY + 1, 10, 8, "rgba(255, 190, 80, 0.32)");
  ring(p, CX, CY + 1, 12, 10, "rgba(255, 150, 40, 0.14)");
  for (let i = 0; i < 4; i++) {
    const a = (f / FRAMES) * TAU + (i * TAU) / 4;
    const rows = SHADOWS[i]!;
    const w = rows[0]!.length;
    const x = Math.round(CX + Math.cos(a) * 10.5) - Math.floor(w / 2);
    const y = Math.round(CY + 1 + Math.sin(a) * 5) - Math.floor(rows.length / 2);
    p.disc(x + Math.floor(w / 2), y + Math.floor(rows.length / 2), 5, "rgba(255, 190, 80, 0.2)");
    p.grid(rows, SHADOW_PAL, x, y);
  }
};

// Padi Gold: green stalks with golden heads sway round the feet, grains drift up and fade.
const padi: Draw = (p, f) => {
  ring(p, CX, CY + 7, 11, 4.5, "rgba(255, 215, 90, 0.18)");
  const stalks = 11;
  const order = Array.from({ length: stalks }, (_, i) => i).sort(
    (a, b) => Math.sin((a / stalks) * TAU) - Math.sin((b / stalks) * TAU),
  );
  for (const i of order) {
    const a = (i / stalks) * TAU + 0.3;
    const x = Math.round(CX + Math.cos(a) * 10.5);
    const y = Math.round(CY + 8 + Math.sin(a) * 4);
    const h = 6 + (i % 3);
    const sway = Math.round(Math.sin((f / FRAMES) * TAU + i * 1.3) * 1.2);
    for (let k = 0; k < h; k++)
      p.px(x + Math.round((sway * k) / h), y - k, k % 3 === 1 ? "#6fbf4a" : "#2f7f3a");
    const hx = x + sway;
    p.px(hx, y - h, "#ffd36a");
    p.px(hx + 1, y - h + 1, "#f2b632");
    p.px(hx, y - h + 1, "#f2b632");
    p.px(hx + 1, y - h + 2, "#e0a020");
    p.px(hx - 1, y - h + 1, "#ffd36a");
  }
  for (let i = 0; i < 9; i++) {
    const t = (f / FRAMES + i / 9) % 1;
    const x = Math.round(CX + Math.sin(t * 5 + i * 2.3) * (6 + (i % 3) * 2));
    const y = Math.round(CY + 9 - t * 20);
    p.px(x, y, `rgba(255, 226, 110, ${(1 - t * 0.9).toFixed(2)})`);
  }
};

const DRAWS: Record<number, Draw> = {
  [CASE_BASE + 0]: lanterns,
  [CASE_BASE + 1]: petals,
  [CASE_BASE + 2]: fireflies,
  [CASE_BASE + 3]: koi,
  [NUSANTARA_BASE + 0]: clouds,
  [NUSANTARA_BASE + 1]: echo,
  [NUSANTARA_BASE + 2]: shadows,
  [NUSANTARA_BASE + 3]: padi,
  // Ragnarok Eve's (`case-ragnarok-aura.ts`, 500 to 503).
  ...RAGNAROK_AURAS,
  // The pond treasures' (`fishing-loot-aura.ts`, 600).
  ...FISHING_AURAS,
};

const frame = cached(
  (index: number, f: number) => `${index}:${f}`,
  (index: number, f: number) => bake(CA_W, CA_H, (p) => DRAWS[index]?.(p, f)),
);

/** The case aura `index` (`look.aura`) at time `now`, to draw behind a character at (x − `CA_X`, y − `CA_Y`); null if it isn't one. */
export const caseAuraFrame = (index: number, now: number): HTMLCanvasElement | null =>
  DRAWS[index] ? frame(index, Math.floor(now / CA_MS) % FRAMES) : null;

/** One aura on its own, for the bag and the shelf when the 3D icon isn't there. */
export const caseAuraIcon = (index: number): HTMLCanvasElement | null =>
  DRAWS[index] ? frame(index, 3) : null;
