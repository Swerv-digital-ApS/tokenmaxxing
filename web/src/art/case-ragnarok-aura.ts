import { RAGNAROK_BASE } from "@tokenmaxxing/core/case-ragnarok.ts";
import type { Pen } from "./pixels.ts";

/**
 * The Ragnarok Eve case's four legendary auras in 2D (`core/src/case-ragnarok.ts`, slot "aura"): the draws
 * `case-aura.ts` files under `RAGNAROK_BASE + n`, on the same 28×28 frame with the 16×16 character at (6, 6),
 * eight frames to a loop. Design: `docs/cases/ragnarok-eve.md`.
 */

const CX = 14;
const CY = 14;
const TAU = Math.PI * 2;
const FRAMES = 8;

type Draw = (p: Pen, f: number) => void;

// Bifröst: a rainbow ribbon on a tilted ring, a bright head and a trailing tail, curled round the shoulders.
const BIFROST = ["#ff5a5a", "#ff9a3c", "#ffe45e", "#5af0a0", "#5ac8ff", "#9a7cff"];
const bifrost: Draw = (p, f) => {
  const N = 64;
  for (let i = 0; i < N; i++) {
    const a = (f / FRAMES) * TAU - (i / N) * 4.6;
    const x = Math.round(CX + Math.cos(a) * 12);
    const y = Math.round(CY + 1 + Math.sin(a) * 5 - Math.cos(a) * 2);
    const band = Math.min(BIFROST.length - 1, Math.floor((i / N) * BIFROST.length));
    const col = BIFROST[band]!;
    p.px(x, y, col);
    // The ribbon is two thick, and brightest at its head.
    p.px(x, y - 1, i < 8 ? "#ffffff" : col);
    if (i % 11 === f) p.px(x + 1, y - 2, "#ffffff");
  }
};

// Valkyrie Lights: curtains of green and violet, rippling up behind and around.
const lights: Draw = (p, f) => {
  const t = (f / FRAMES) * TAU;
  for (let x = 2; x < 26; x++) {
    const wave = Math.sin(x * 0.55 + t) * 2.2 + Math.sin(x * 0.23 - t * 2) * 1.6;
    const top = Math.round(4 + wave + (Math.abs(x - 14) > 8 ? 5 : 0));
    const bottom = 22 - ((x * 7 + f) % 3);
    for (let y = top; y < bottom; y++) {
      const k = (y - top) / (bottom - top);
      const a = 0.08 + 0.3 * k * (1 - k) * 2.2;
      const col =
        k < 0.45 ? `rgba(154, 124, 255, ${a.toFixed(2)})` : `rgba(90, 240, 160, ${(a + 0.05).toFixed(2)})`;
      p.px(x, y, col);
    }
    // The bright hem of each curtain.
    p.px(x, bottom - 1, "rgba(180, 255, 210, 0.7)");
  }
  for (let i = 0; i < 4; i++) {
    const x = 4 + ((i * 7 + f * 3) % 20);
    const y = 5 + ((i * 5) % 11);
    p.px(x, y, "#ffffff");
  }
};

// Rune Gale: single glyphs (the safe set only: Fehu, Uruz, Raidho, Gebo, Mannaz) carried round the body by an amber
// and white wind. Never a wheel or a ring: the glyphs are loose, at their own heights, and no two are alike.
// prettier-ignore
const GLYPHS: string[][] = [
  ["..X", "XX.", "X.X", "XX.", "X.."], // Fehu
  ["XX.", "X.X", "X.X", "X.X", "X.X"], // Uruz
  ["XX.", "X.X", "XX.", "X.X", "X.X"], // Raidho
  ["X.X", "X.X", ".X.", "X.X", "X.X"], // Gebo
  ["X.X", "XXX", "X.X", "X.X", "X.X"], // Mannaz
];
const gale: Draw = (p, f) => {
  // The wind: short streaks of amber and white sweeping round the body.
  for (let i = 0; i < 14; i++) {
    const a = (f / FRAMES) * TAU * 1.5 + i * 1.7;
    const x = Math.round(CX + Math.cos(a) * (9 + (i % 3)));
    const y = Math.round(CY + 1 + Math.sin(a) * (4 + (i % 4)) + ((i * 5) % 7) - 3);
    const dir = -Math.sin(a) >= 0 ? 1 : -1;
    p.px(x, y, i % 3 ? "rgba(255, 184, 74, 0.8)" : "rgba(255, 255, 255, 0.85)");
    p.px(x - dir, y, "rgba(255, 184, 74, 0.45)");
    p.px(x - dir * 2, y, "rgba(255, 184, 74, 0.2)");
  }
  GLYPHS.forEach((g, i) => {
    const a = (f / FRAMES) * TAU + i * 1.9 + 0.4;
    const r = 10.5 + (i % 2) * 1.2;
    const gx = Math.round(CX + Math.cos(a) * r) - 1;
    const gy = Math.round(CY - 2 + Math.sin(a) * 4 + (i * 3 - 6) * 0.7) - 2;
    // The glyph in amber with a white spine, dimmed while it is round the back.
    const behind = Math.sin(a) < -0.4;
    for (const [dy, row] of g.entries())
      for (const [dx, c] of [...row].entries())
        if (c === "X")
          p.px(gx + dx, gy + dy, behind ? "rgba(255, 184, 74, 0.55)" : dx === 0 ? "#fff3d0" : "#ffb84a");
  });
};

// Ginnungagap: snow drifting down on the left, embers rising on the right, and the two curling together over the head.
const gap: Draw = (p, f) => {
  for (let i = 0; i < 9; i++) {
    const y = (i * 5 + f * 3) % 24;
    const x = 2 + ((i * 7) % 11) + (Math.sin((y + i) * 0.7) > 0 ? 1 : 0);
    p.px(x, y + 2, i % 3 ? "#e8f6ff" : "#a8d8f0");
    if (i % 4 === 0) p.px(x + 1, y + 2, "rgba(232, 246, 255, 0.5)");
  }
  for (let i = 0; i < 9; i++) {
    const y = 25 - ((i * 5 + f * 3) % 24);
    const x = 25 - ((i * 7) % 11) - (Math.sin((y + i) * 0.7) > 0 ? 1 : 0);
    p.px(x, y, i % 3 ? "#ff9a3c" : "#ffd36a");
    if (i % 4 === 0) p.px(x, y + 1, "rgba(255, 120, 40, 0.45)");
  }
  // The spiral at the head: an ice arm and an ember arm winding in towards the crown, turning slowly.
  for (let i = 0; i < 12; i++) {
    const k = i / 12;
    const a = (f / FRAMES) * TAU + k * 4.2;
    const r = 8 - k * 5;
    const sx = Math.round(CX + Math.cos(a) * r * 1.5);
    const sy = Math.round(CY - 6 + Math.sin(a) * r * 0.6);
    const ex = Math.round(CX + Math.cos(a + Math.PI) * r * 1.5);
    const ey = Math.round(CY - 6 + Math.sin(a + Math.PI) * r * 0.6);
    p.px(sx, sy, k > 0.7 ? "#ffffff" : "#bfe6ff");
    p.px(ex, ey, k > 0.7 ? "#fff1b0" : "#ff9a3c");
  }
};

/** The draws by look index, for `case-aura.ts` to file with the Night Market's. */
export const RAGNAROK_AURAS: Record<number, Draw> = {
  [RAGNAROK_BASE + 0]: bifrost,
  [RAGNAROK_BASE + 1]: lights,
  [RAGNAROK_BASE + 2]: gale,
  [RAGNAROK_BASE + 3]: gap,
};
