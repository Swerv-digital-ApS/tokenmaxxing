import { decemberSnow } from "@tokenmaxxing/core/december.ts";
import {
  copenhagenToMs,
  fogOf,
  type Light,
  lightAt,
  moonPhase,
  presetWeather,
  type Weather,
  winterSnow,
} from "@tokenmaxxing/core/sky.ts";
import { hash } from "../art/pixels.ts";
import { hud } from "../store.ts";
import { bakeGlow } from "./glow.ts";

/**
 * Sky and weather on the canvas. The town (and only the town) is tinted by the sun over Aarhus,
 * its lamps and windows glow at night, and the weather the server shares falls on it. Cheap by design:
 * one multiply fill for the light, a few baked glow sprites, and capped particles drawn in one path.
 *
 * Dev overrides in the page URL: `?sky=2026-10-21T22:30` (Copenhagen time, keeps ticking) and
 * `?weather=rain` (clear, cloudy, fog, drizzle, rain, storm, snow, and `frost` or `pollen` for a freezing or
 * sneezy clear day).
 */

const query = new URLSearchParams(location.search);
const skyAt = copenhagenToMs(query.get("sky") ?? "");
const skyFrom = Date.now();
const weatherOverride = presetWeather(query.get("weather") ?? "");

/** The world's time: real, unless `?sky=` moved it. */
export const skyNow = (): number => (skyAt === null ? Date.now() : skyAt + (Date.now() - skyFrom));

/** The weather last worked out, what from, and when. */
let shown: { from: Weather; minute: number; weather: Weather } | null = null;

/**
 * The weather on screen: the server's (or `?weather=`), with winter's snow rule applied (`winterSnow`), and
 * December's on top: snow all month, whatever the real weather (`decemberSnow`).
 * Worked out again only when the server's changes, or the minute does (winter starts on a day).
 */
export function weatherNow(): Weather {
  const from = weatherOverride ?? hud.get().weather;
  const at = skyNow();
  const minute = Math.floor(at / 60_000);
  if (shown?.from === from && shown.minute === minute) return shown.weather;
  shown = { from, minute, weather: decemberSnow(winterSnow(from, at), at) };
  return shown.weather;
}

// MARK: Light

let light: Light = lightAt(skyNow());
let lightCheckedAt = -Infinity;

/** The sun's light, worked out every few seconds (it changes over minutes). */
function currentLight(now: number): Light {
  if (now - lightCheckedAt > 2_000) {
    lightCheckedAt = now;
    light = lightAt(skyNow());
  }
  return light;
}

type RGB = [number, number, number];
const WHITE: RGB = [255, 255, 255];
const WARM: RGB = [255, 168, 105];
const NIGHT: RGB = [66, 80, 140];
const mix = (a: RGB, b: RGB, t: number): RGB => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];

/** What the scene is multiplied by: sun colour, then clouds greying and dimming it. */
function tint(l: Light, w: Weather): string {
  let c = mix(WHITE, WARM, l.warmth * 0.7);
  // Twilight lingers: the night tint arrives late, so dusk is orange before it is blue.
  c = mix(c, NIGHT, l.darkness ** 1.6 * (1 - l.warmth * 0.2));
  const grey = (c[0] + c[1] + c[2]) / 3;
  const murk = w.cloud * 0.35 + (w.kind === "storm" ? 0.2 : 0) + 0.1 * fogOf(w);
  c = mix(c, [grey, grey, grey], murk * 0.7 * (1 - l.warmth * 0.5));
  const dim = 1 - murk * 0.45;
  return `rgb(${Math.round(c[0] * dim)},${Math.round(c[1] * dim)},${Math.round(c[2] * dim)})`;
}

/** 0..1: how much the lamps and windows should shine (also on dim, stormy days). */
function glowOf(l: Light, w: Weather): number {
  return Math.min(1, Math.max(l.darkness, l.warmth * 0.5, w.cloud * 0.25 * (w.kind === "storm" ? 2 : 1)));
}

// MARK: Baked bits

let glow: HTMLCanvasElement | undefined;
let blob: HTMLCanvasElement | undefined;
const moons = new Map<number, HTMLCanvasElement>();

/** A pixel moon at its phase: the lit side bright with a few craters, the rest a faint disc. */
function moonSprite(age: number): HTMLCanvasElement {
  const key = Math.round(age * 32) % 32;
  let c = moons.get(key);
  if (c) return c;
  const R = 9;
  c = document.createElement("canvas");
  c.width = c.height = R * 2 + 1;
  const g = c.getContext("2d")!;
  const k = Math.cos(2 * Math.PI * (key / 32));
  for (let y = -R; y <= R; y++)
    for (let x = -R; x <= R; x++) {
      if (x * x + y * y > R * R + 1) continue;
      const half = Math.sqrt(Math.max(0, R * R - y * y));
      const lit = key < 16 ? x > k * half : x < -k * half;
      g.fillStyle = lit ? (hash(x, y, 7) < 0.12 ? "#d3d6c4" : "#f4f1dc") : "rgba(40,50,80,0.55)";
      g.fillRect(x + R, y + R, 1, 1);
    }
  moons.set(key, c);
  return c;
}

// MARK: Overlays

const STARS = Array.from({ length: 60 }, (_, i) => ({
  x: hash(i, 1, 90),
  y: hash(i, 2, 90),
  big: hash(i, 3, 90) > 0.8,
  phase: hash(i, 4, 90) * 6.28,
}));

/**
 * Tints the scene by the sun and clouds, on top of the world and under the HUD, and returns how
 * brightly lights should shine (0 in full day).
 */
export function drawLight(g: CanvasRenderingContext2D, w: number, h: number, now: number): number {
  const l = currentLight(now);
  const weather = weatherNow();
  const color = tint(l, weather);
  if (color !== "rgb(255,255,255)") {
    g.save();
    g.globalCompositeOperation = "multiply";
    g.fillStyle = color;
    g.fillRect(0, 0, w, h);
    g.restore();
  }
  return glowOf(l, weather);
}

/** 0 in daylight to 1 in the dead of night: for indoor scenes that darken with the sky (the Tavern). */
export const darknessNow = (now: number): number => currentLight(now).darkness;

/** 0 to 1: how low and orange the sun is (dusk and dawn), for the Tavern's evening. */
export const warmthNow = (now: number): number => currentLight(now).warmth;

/** How brightly lights shine right now: what `drawLight` returns, for knowing it before the sky is drawn. */
export const lightsNow = (now: number): number => glowOf(currentLight(now), weatherNow());

/** A window lit at night, in world pixels, and whoever is at home in it (drawn on the pane first). */
export interface LitWindow {
  x: number;
  y: number;
  w: number;
  h: number;
  face: (() => void) | null;
}

/**
 * The lamp heads glowing and the windows lit: in world space, after `drawLight`. Light adds up, so it's
 * all drawn "lighter", but for the faces in the windows. `lampDim` dims the street lamps alone (power
 * is expensive: `game/grid.ts`).
 */
export function drawLights(
  g: CanvasRenderingContext2D,
  lamps: readonly (readonly [number, number])[],
  windows: readonly LitWindow[],
  strength: number,
  lampDim = 1,
): void {
  if (strength < 0.05) return;
  glow ??= bakeGlow(64, "255,214,120");
  g.globalCompositeOperation = "lighter";
  for (const [x, y] of lamps) {
    g.globalAlpha = strength * 0.5 * lampDim;
    g.drawImage(glow, x - 30, y - 28, 60, 60);
    g.globalAlpha = strength * 0.9 * lampDim;
    g.drawImage(glow, x - 9, y - 9, 18, 18);
  }
  for (const { x, y, w, h, face } of windows) {
    if (face) {
      g.globalCompositeOperation = "source-over";
      g.globalAlpha = 1;
      face();
      g.globalCompositeOperation = "lighter";
    }
    // Warm light on the pane and a little spill around it.
    g.globalAlpha = strength * 0.35;
    g.drawImage(glow, x - w * 0.6, y - h * 0.6, w * 2.2, h * 2.2);
    g.globalAlpha = strength * 0.8;
    g.fillStyle = "#ffcf7a";
    g.fillRect(x, y, w, h);
  }
  g.globalCompositeOperation = "source-over";
  g.globalAlpha = 1;
}

/** Stars and the moon, in screen space, only once it's properly dark. */
export function drawNightSky(
  g: CanvasRenderingContext2D,
  w: number,
  h: number,
  dpr: number,
  now: number,
): void {
  const l = currentLight(now);
  const weather = weatherNow();
  const clear = 1 - weather.cloud * 0.9 - fogOf(weather) * 0.4;
  const a = l.darkness * l.darkness * Math.max(0, clear);
  if (a < 0.03) return;
  g.save();
  g.fillStyle = "#e8ecff";
  for (const s of STARS) {
    const tw = 0.55 + 0.45 * Math.sin(now / 700 + s.phase);
    g.globalAlpha = a * tw * 0.8;
    const size = (s.big ? 2 : 1) * Math.max(1, Math.round(dpr));
    g.fillRect(Math.floor(s.x * w), Math.floor(s.y * h), size, size);
  }
  const moon = moonSprite(moonPhase(skyNow()).age);
  const k = Math.max(2, Math.round(dpr * 2));
  g.globalAlpha = a;
  g.imageSmoothingEnabled = false;
  g.drawImage(
    moon,
    Math.round(w * 0.5 - (moon.width * k) / 2),
    Math.round(46 * dpr),
    moon.width * k,
    moon.height * k,
  );
  g.restore();
}

// MARK: Weather particles

interface Drop {
  x: number;
  y: number;
  v: number;
  len: number;
  ph: number;
}

const MAX_RAIN = 320;
const MAX_SNOW = 260;
let drops: Drop[] = [];
let ripples: { x: number; y: number; t: number }[] = [];
let lastAt = 0;
let flashAt = -1e9;
let nextFlash = 0;
let fogShift = 0;

/** Where the wind pushes things sideways, -1..1: blowing towards east is positive. */
export const windPush = (w: Weather): number =>
  -Math.sin((w.windDir * Math.PI) / 180) * Math.min(1, w.windMs / 10);

const seed = (n: number, w: number, h: number, rain: boolean): Drop[] =>
  Array.from({ length: n }, () => ({
    x: Math.random() * w,
    y: Math.random() * h,
    v: rain ? 0.8 + Math.random() * 0.5 : 0.5 + Math.random() * 0.6,
    len: 0.6 + Math.random() * 0.6,
    ph: Math.random() * 6.28,
  }));

/** Rain, snow, fog, lightning: in screen space, with the night's darkness folded into their colour. */
export function drawWeather(
  g: CanvasRenderingContext2D,
  w: number,
  h: number,
  dpr: number,
  now: number,
): void {
  const weather = weatherNow();
  const dt = Math.min(0.1, (now - lastAt) / 1000);
  lastAt = now;
  const dark = currentLight(now).darkness;
  const push = windPush(weather);
  const lit = 1 - dark * 0.6;
  // Rain and snow stay easy to see at night (street lights, lit windows).
  const bright = 1 - dark * 0.3;

  // Fog and mist (as thick as the visibility says), or a low grey overcast.
  const fog = fogOf(weather);
  if (fog > 0.05 || (weather.kind === "cloudy" && weather.cloud > 0.85)) {
    const k = Math.max(fog, weather.kind === "cloudy" ? 0.15 : 0);
    fogShift += dt * (6 + weather.windMs * 4) * dpr * (push >= 0 ? 1 : -1);
    blob ??= bakeGlow(128, "225,230,235");
    g.save();
    g.fillStyle = `rgba(${Math.round(205 * lit)},${Math.round(210 * lit)},${Math.round(216 * lit)},${0.3 * k})`;
    g.fillRect(0, 0, w, h);
    g.globalAlpha = 0.5 * k;
    for (let i = 0; i < 7; i++) {
      const bw = (520 + hash(i, 0, 5) * 300) * dpr;
      const x =
        ((((hash(i, 1, 5) * (w + bw) + fogShift * (0.6 + hash(i, 2, 5))) % (w + bw)) + (w + bw)) % (w + bw)) -
        bw;
      g.drawImage(blob, x, hash(i, 3, 5) * h - bw * 0.2, bw, bw * 0.5);
    }
    g.restore();
  }

  if (weather.kind === "snow") {
    g.fillStyle = `rgba(232,240,255,${0.16 * weather.intensity})`;
    g.fillRect(0, 0, w, h);
  }

  const falls = weather.kind === "rain" || weather.kind === "drizzle" || weather.kind === "storm";
  const snows = weather.kind === "snow";
  if (falls || snows) {
    const want = Math.round(
      weather.intensity * (snows ? MAX_SNOW : MAX_RAIN) * (weather.kind === "drizzle" ? 0.7 : 1),
    );
    // Resize gently: the field only ever grows or shrinks to what's wanted.
    if (drops.length > want) drops.length = want;
    else if (drops.length < want) drops.push(...seed(want - drops.length, w, h, falls));
    g.save();
    if (falls) {
      const slant = push * 0.55;
      const speed = (weather.kind === "drizzle" ? 520 : 820) * dpr;
      const len = (weather.kind === "drizzle" ? 8 : weather.kind === "storm" ? 18 : 13) * dpr;
      g.beginPath();
      for (const d of drops) {
        d.y += speed * d.v * dt;
        d.x += speed * d.v * dt * slant;
        if (d.y > h) {
          if (ripples.length < 28 && Math.random() < 0.25)
            ripples.push({ x: d.x, y: Math.random() * h, t: 0 });
          d.y -= h + len;
          d.x = Math.random() * (w + h * slant) - Math.max(0, h * slant);
        }
        if (d.x > w) d.x -= w;
        else if (d.x < 0) d.x += w;
        g.moveTo(d.x, d.y);
        g.lineTo(d.x - slant * len * d.len, d.y - len * d.len);
      }
      const a = weather.kind === "drizzle" ? 0.5 : 0.75;
      g.strokeStyle = `rgba(${Math.round(200 * bright)},${Math.round(220 * bright)},${Math.round(255 * bright)},${a})`;
      g.lineWidth = Math.max(1.2, dpr * 1.1);
      g.stroke();
      // Ripples where it lands: a pixel ring that opens and fades.
      g.fillStyle = `rgba(210,225,250,${0.6 * bright})`;
      for (const r of ripples) r.t += dt;
      ripples = ripples.filter((r) => r.t < 0.35);
      for (const r of ripples) {
        const rr = Math.round((1 + r.t * 14) * dpr);
        g.globalAlpha = 1 - r.t / 0.35;
        g.fillRect(Math.round(r.x - rr), Math.round(r.y), rr * 2, Math.max(1, Math.round(dpr * 0.6)));
      }
      g.globalAlpha = 1;
    } else {
      // Flakes get a faint cool shadow so they read on pale ground too.
      for (const pass of [1, 0]) {
        g.fillStyle = pass
          ? "rgba(70,90,140,0.35)"
          : `rgb(${Math.round(245 * bright)},${Math.round(248 * bright)},${Math.round(255 * bright)})`;
        for (const d of drops) {
          if (pass === 0) {
            d.y += 55 * dpr * d.v * dt * (1 + weather.intensity);
            d.x += (push * 70 + Math.sin(now / 900 + d.ph) * 14) * dpr * dt;
            if (d.y > h) {
              d.y -= h + 6;
              d.x = Math.random() * w;
            }
            if (d.x > w) d.x -= w;
            else if (d.x < 0) d.x += w;
          }
          const s = Math.max(2, Math.round(dpr * (d.len > 0.95 ? 3 : 2)));
          g.fillRect(Math.round(d.x) + pass, Math.round(d.y) + pass, s, s);
        }
      }
    }
    g.restore();
  } else if (drops.length) {
    drops = [];
    ripples = [];
  }

  // Lightning: a double flicker every so often, white over everything but the HUD.
  if (weather.kind === "storm") {
    if (now > nextFlash) {
      flashAt = now;
      nextFlash = now + 5_000 + Math.random() * 9_000;
    }
    const t = now - flashAt;
    const a = t < 70 ? 0.6 : t < 130 ? 0.12 : t < 200 ? 0.5 : t < 520 ? 0.5 * (1 - (t - 200) / 320) : 0;
    if (a > 0.01) {
      g.fillStyle = `rgba(225,232,255,${a})`;
      g.fillRect(0, 0, w, h);
    }
  }
}

// MARK: Wind

/** Bands of a sprite, top to bottom: rows [from, to) that lean by `factor` of the full lean. */
const SWAY: Record<string, [number, number, number][]> = {
  T: [
    [0, 6, 1],
    [6, 12, 0.6],
    [12, 18, 0.25],
    [18, 26, 0],
  ],
  "^": [
    [0, 6, 0.5],
    [6, 16, 0],
  ],
};

/** Draws a tree or bush leaning with `weather`'s wind in whole-pixel steps (no lean when it's calm). */
export function drawSway(
  g: CanvasRenderingContext2D,
  sprite: HTMLCanvasElement,
  ch: string,
  x: number,
  y: number,
  now: number,
  weather: Weather,
): void {
  const bands = SWAY[ch];
  const strength = Math.min(1, weather.windMs / 9);
  if (!bands || strength < 0.2) return void g.drawImage(sprite, x, y);
  const ph = hash(Math.round(x), Math.round(y), 3) * 6.28;
  const sign = windPush(weather) >= 0 ? 1 : -1;
  const lean = sign * strength * 2.6 * (0.6 + 0.4 * Math.sin(now / (420 - strength * 150) + ph));
  for (const [from, to, f] of bands) {
    const dx = Math.round(lean * f);
    g.drawImage(sprite, 0, from, sprite.width, to - from, x + dx, y + from, sprite.width, to - from);
  }
}
