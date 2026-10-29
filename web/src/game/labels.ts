import { SNEEZE_MS } from "@tokenmaxxing/core/sky.ts";
import { type Peek, TILE } from "@tokenmaxxing/core/world.ts";
import { clamp, sumBy } from "hanzio";
import { C } from "../art/palette.ts";
import { camera } from "./camera.ts";
import { SNEEZE_TEXT, sneezeOf } from "./cold.ts";
import { BURST_MS } from "./emoji.ts";
import { hover, hoverStrength, labelAlpha } from "./near.ts";
import { polseTag } from "./street.ts";
import { type Avatar, gameTag, world } from "./world.ts";

/** Name chips under house signs this frame, in canvas (device) pixels. */
export const chipHits: { x: number; y: number; w: number; h: number; id: number }[] = [];
/** Company signs this frame (canvas pixels): a click opens the company's page. */
export const signHits: { x: number; y: number; w: number; h: number; id: number }[] = [];

/** At most this many names show under a house's sign; the rest are a "+N". */
const CHIPS_MAX = 4;

export const FONT = "ui-monospace, SFMono-Regular, Menlo, monospace";

/** Where the labels over things are judged from this frame: the player's tile (NaN: all show) and the hover's reveal. */
const focus = { x: NaN, y: NaN, hover: 0 };

/** Once a frame, before any label: who the labels are near to (`null`, or `all`, shows every one). */
export function focusLabels(me: { x: number; y: number } | null, all: boolean, now: number): void {
  focus.x = all || !me ? NaN : me.x + 0.5;
  focus.y = all || !me ? NaN : me.y + 0.5;
  focus.hover = hoverStrength(now);
}

/** A label's alpha for its spot on screen (canvas pixels): fainter the farther away the player is, unless hovered. */
export function alphaAt(sx: number, sy: number): number {
  if (Number.isNaN(focus.x)) return 1;
  const tx = (sx / camera.scale + camera.x) / TILE;
  const ty = (sy / camera.scale + camera.y) / TILE;
  const dist = Math.hypot(tx - focus.x, ty - focus.y);
  return labelAlpha(dist, Math.hypot(tx - hover.x - 0.5, ty - hover.y - 0.5), focus.hover);
}

/** The labels' fonts at `dpr`, made once rather than for every label (dpr only changes with the screen). */
const fonts = { dpr: 0, pill: "", chip: "", pet: "", bubble: "" };
function fontsAt(dpr: number) {
  if (fonts.dpr !== dpr)
    Object.assign(fonts, {
      dpr,
      pill: `600 ${11 * dpr}px ${FONT}`,
      chip: `600 ${10 * dpr}px ${FONT}`,
      pet: `600 ${9 * dpr}px ${FONT}`,
      bubble: `500 ${12 * dpr}px ${FONT}`,
    });
  return fonts;
}

/** A house's row of chips: texts and widths, measured once per list (`world.houses` is replaced, never edited). */
const chipRows = new WeakMap<Peek[], { dpr: number; texts: string[]; widths: number[]; w: number }>();
function chipRow(g: CanvasRenderingContext2D, people: Peek[], dpr: number) {
  const hit = chipRows.get(people);
  if (hit?.dpr === dpr) return hit;
  g.font = fontsAt(dpr).chip;
  const texts = people
    .slice(0, CHIPS_MAX)
    .map((p) => `${p.state === "away" ? "💤 " : p.state === "working" ? "💻 " : ""}${p.name} Lv${p.level}`);
  if (people.length > CHIPS_MAX) texts.push(`+${people.length - CHIPS_MAX}`);
  const pad = 5 * dpr;
  const gap = 3 * dpr;
  const widths = texts.map((t) => g.measureText(t).width + pad * 2);
  const row = { dpr, texts, widths, w: sumBy(widths, (w) => w) + gap * (widths.length - 1) };
  chipRows.set(people, row);
  return row;
}

/** How wide a house's row of chips is, in canvas pixels. */
export const chipsWidth = (g: CanvasRenderingContext2D, people: Peek[], dpr: number): number =>
  chipRow(g, people, dpr).w;

/** One row of `💤 name Lv5` chips centred under a house's sign; clicking one opens their card. */
export function chips(g: CanvasRenderingContext2D, cx: number, y: number, people: Peek[], dpr: number): void {
  const alpha = alphaAt(cx, y);
  if (alpha <= 0) return;
  g.globalAlpha = alpha;
  const { texts, widths, w: total } = chipRow(g, people, dpr);
  g.font = fontsAt(dpr).chip;
  const pad = 5 * dpr;
  const gap = 3 * dpr;
  const h = 14 * dpr;
  let x = cx - total / 2;
  g.textAlign = "left";
  g.textBaseline = "middle";
  for (const [i, text] of texts.entries()) {
    const w = widths[i]!;
    g.fillStyle = "rgba(27, 31, 42, 0.82)";
    g.beginPath();
    g.roundRect(x, y, w, h, 4 * dpr);
    g.fill();
    g.fillStyle = C.white;
    g.fillText(text, x + pad, y + h / 2 + 0.5 * dpr);
    const p = i < CHIPS_MAX ? people[i] : undefined;
    if (p) chipHits.push({ x, y, w, h, id: p.id });
    x += w + gap;
  }
  g.globalAlpha = 1;
}

/** A pill's text, cut to fit, and its width: measured once per font, width and text, not every frame. */
const fits = new Map<string, { text: string; w: number }>();
function fit(g: CanvasRenderingContext2D, font: string, text: string, pad: number, maxW: number) {
  const key = `${font}\0${maxW}\0${text}`;
  const hit = fits.get(key);
  if (hit) return hit;
  // Too wide (next door's sign is right there): cut it short.
  while (text.length > 2 && g.measureText(text).width + pad > maxW) text = `${text.slice(0, -2)}…`;
  const out = { text, w: g.measureText(text).width + pad };
  if (fits.size > 1000) fits.clear();
  fits.set(key, out);
  return out;
}

export function pill(
  g: CanvasRenderingContext2D,
  cx: number,
  y: number,
  text: string,
  dpr: number,
  bg: string,
  fg: string,
  maxW = Infinity,
) {
  const font = fontsAt(dpr).pill;
  g.font = font;
  const { text: shown, w } = fit(g, font, text, 10 * dpr, maxW);
  const h = 15 * dpr;
  g.fillStyle = bg;
  g.beginPath();
  g.roundRect(cx - w / 2, y - h, w, h, 4 * dpr);
  g.fill();
  g.fillStyle = fg;
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText(shown, cx, y - h / 2 + 0.5 * dpr);
  return { w, h };
}

/** A pet's name, small and plain (no pill) under it: mine, or one close to me, so a crowd isn't a wall of names. */
export function petLabel(
  g: CanvasRenderingContext2D,
  cx: number,
  y: number,
  name: string,
  dpr: number,
): void {
  const alpha = alphaAt(cx, y);
  if (alpha <= 0) return;
  g.globalAlpha = alpha;
  g.font = fontsAt(dpr).pet;
  g.textAlign = "center";
  g.textBaseline = "top";
  g.lineJoin = "round";
  g.lineWidth = 3 * dpr;
  g.strokeStyle = "rgba(27, 31, 42, 0.75)";
  g.strokeText(name, cx, y);
  g.fillStyle = C.white;
  g.fillText(name, cx, y);
  g.globalAlpha = 1;
}

/** A `pill` over a thing (not a person): faded by how far the player is from it, gone past `LABEL_FAR`. */
export function nearPill(
  g: CanvasRenderingContext2D,
  cx: number,
  y: number,
  text: string,
  dpr: number,
  bg: string,
  fg: string,
  maxW?: number,
): { w: number; h: number } {
  const alpha = alphaAt(cx, y);
  if (alpha <= 0) return { w: 0, h: 0 };
  const was = g.globalAlpha;
  g.globalAlpha = was * alpha;
  const out = pill(g, cx, y, text, dpr, bg, fg, maxW);
  g.globalAlpha = was;
  return out;
}

export function sign(
  g: CanvasRenderingContext2D,
  cx: number,
  y: number,
  text: string,
  dpr: number,
  owned: boolean,
  maxW?: number,
) {
  return nearPill(
    g,
    cx,
    y,
    text,
    dpr,
    owned ? "rgba(251, 247, 239, 0.95)" : "rgba(43, 36, 51, 0.7)",
    owned ? C.ink : C.white,
    maxW,
  );
}

export function avatarLabels(
  g: CanvasRenderingContext2D,
  a: Avatar,
  cx: number,
  top: number,
  tile: string,
  now: number,
  dpr: number,
  /** Dancing near another dancer (`battlers` in dance.ts). */
  battle = false,
): void {
  if (a.warp?.out) return;
  const resting = a.state === "away" || a.state === "working";
  let y = top - (a.state === "away" || tile === "b" ? -2 : 4) * dpr;
  // Everyone else's name and level; you know your own.
  if (a.info.id !== world.selfId) {
    const tag = `${a.info.name} · Lv${a.info.level}`;
    const bg = a.info.online ? "rgba(27, 31, 42, 0.78)" : "rgba(27, 31, 42, 0.45)";
    y -= pill(g, cx, y, tag, dpr, bg, C.white).h + 2 * dpr;
  }
  if (a.state === "away" || a.info.dozing) {
    const t = (now / 900) % 1;
    g.font = `700 ${(10 + t * 4) * dpr}px ${FONT}`;
    g.fillStyle = `rgba(255, 255, 255, ${1 - t})`;
    g.textAlign = "center";
    g.fillText("z", cx + (8 + t * 8) * dpr, y - t * 12 * dpr);
  } else if (a.state === "working") {
    y -=
      pill(g, cx, y, `💻 ×${Math.max(1, a.info.liveAgents)}`, dpr, "rgba(143, 227, 255, 0.95)", C.ink).h +
      2 * dpr;
  }
  if (battle) y -= pill(g, cx, y, "⚔️ Aura battle", dpr, "rgba(179, 107, 255, 0.95)", C.white).h + 2 * dpr;
  const inGame = gameTag(a.info.id);
  if (inGame) y -= pill(g, cx, y, inGame, dpr, "rgba(233, 183, 61, 0.95)", C.ink).h + 2 * dpr;
  if (!resting) y = polseTag(g, a.info, cx, y, now);
  const sneeze = sneezeOf(a);
  if (a.bubble && now < a.bubble.until && !resting)
    bubble(g, cx, y, a.bubble.text, dpr, a.bubble.until - now);
  else if (sneeze !== null) bubble(g, cx, y, SNEEZE_TEXT, dpr, (1 - sneeze) * SNEEZE_MS);
  if (a.burst && now - a.burst.at < BURST_MS) burst(g, cx, top, a.burst.emojis, now - a.burst.at, dpr);
}

const BURST_COUNT = 10;
const easeOut = (t: number) => 1 - (1 - t) ** 3;

/**
 * Emoji popping out around someone's head and floating up: `BURST_COUNT` copies
 * (taking turns when there are several) fanned over the top half, a little
 * staggered, fading out at the end.
 */
export function burst(
  g: CanvasRenderingContext2D,
  cx: number,
  top: number,
  emojis: string[],
  elapsed: number,
  dpr: number,
) {
  g.textAlign = "center";
  g.textBaseline = "middle";
  for (let i = 0; i < BURST_COUNT; i++) {
    const delay = (i % 4) * 80;
    const t = clamp((elapsed - delay) / (BURST_MS - 320), 0, 1);
    if (t === 0) continue;
    const angle = -Math.PI / 2 + ((i + 0.5) / BURST_COUNT - 0.5) * Math.PI * 1.5;
    const reach = (14 + 38 * easeOut(t) + (i % 3) * 6) * dpr;
    const x = cx + Math.cos(angle) * reach;
    const y = top + 4 * dpr + Math.sin(angle) * reach * 0.8 - 22 * t * dpr;
    const pop = t < 0.15 ? t / 0.15 : 1;
    g.globalAlpha = t < 0.7 ? 1 : 1 - (t - 0.7) / 0.3;
    g.font = `${(12 + 8 * pop + (i % 2) * 3) * dpr}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;
    g.fillText(emojis[i % emojis.length]!, x, y);
  }
  g.globalAlpha = 1;
}

/** Bubble text wrapped into at most 3 lines, and its width; measured once per text, not every frame. */
const wraps = new Map<string, { shown: string[]; w: number }>();
function wrapped(g: CanvasRenderingContext2D, text: string, dpr: number) {
  const key = `${dpr}\0${text}`;
  const hit = wraps.get(key);
  if (hit) return hit;
  const maxW = 190 * dpr;
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(" ")) {
    const next = line ? `${line} ${word}` : word;
    if (g.measureText(next).width > maxW && line) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  lines.push(line);
  const shown = lines.slice(0, 3);
  if (lines.length > 3) shown[2] = `${shown[2]!.slice(0, -1)}…`;
  const w = Math.min(maxW, Math.max(...shown.map((l) => g.measureText(l).width))) + 14 * dpr;
  if (wraps.size > 500) wraps.clear();
  wraps.set(key, { shown, w });
  return { shown, w };
}

export function bubble(
  g: CanvasRenderingContext2D,
  cx: number,
  bottom: number,
  text: string,
  dpr: number,
  left: number,
) {
  g.font = fontsAt(dpr).bubble;
  const { shown, w } = wrapped(g, text, dpr);
  const lh = 15 * dpr;
  const h = shown.length * lh + 8 * dpr;
  const y = bottom - h - 6 * dpr;
  g.globalAlpha = Math.min(1, left / 400);
  g.fillStyle = C.white;
  g.strokeStyle = C.ink;
  g.lineWidth = 2 * dpr;
  g.beginPath();
  g.roundRect(cx - w / 2, y, w, h, 6 * dpr);
  g.fill();
  g.stroke();
  g.beginPath();
  g.moveTo(cx - 5 * dpr, y + h);
  g.lineTo(cx, y + h + 6 * dpr);
  g.lineTo(cx + 5 * dpr, y + h);
  g.fill();
  g.fillStyle = C.ink;
  g.textAlign = "center";
  g.textBaseline = "top";
  for (const [i, l] of shown.entries()) g.fillText(l, cx, y + 5 * dpr + i * lh);
  g.globalAlpha = 1;
}
