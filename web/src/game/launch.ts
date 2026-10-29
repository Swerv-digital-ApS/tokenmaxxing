/**
 * The launch stand in town (`core/src/launch.ts`): up from the moment a model is listed on OpenRouter
 * until 18:00 on its edition's day (`standCloses`). `world` reads the list and sends it (the `launches` event). One provider's news is that
 * provider's stand; several providers' make it a rainbow one. Walk onto the row in front of it and the
 * presenter flicks you a pamphlet with everything that's out (again whenever something new turns up,
 * remembered in this browser); E in front of it hands you another.
 * `?launch=grok` (or `?launch=Z AI:GLM 5,claude` for several) puts it up for screenshots,
 * `?launch=off` takes it down; `?clock=` moves the clock like it does for the street.
 */
import {
  activeLaunches,
  facesStand,
  forcedLaunches,
  isStand,
  isStandFront,
  type Launch,
  STAND,
  standOf,
} from "@tokenmaxxing/core/launch.ts";
import { TILE } from "@tokenmaxxing/core/world.ts";
import { STAND_H, STAND_W, standSprite } from "../art/launch.ts";
import { paperSprite } from "../art/street.ts";
import { hud } from "../store.ts";
import type { Frame } from "./frame.ts";
import { pill } from "./labels.ts";
import { self, serverNow, world } from "./world.ts";

const forced = forcedLaunches(new URLSearchParams(location.search).get("launch"), Date.now());

let fromServer: Launch[] = [];

/** What's up, newest first, asked once a minute (or when the server says the list changed). */
let seen = { minute: Number.NaN, up: [] as Launch[] };
function launchesAt(at: number): Launch[] {
  if (forced !== undefined) return forced;
  const minute = Math.floor(at / 60_000);
  if (minute !== seen.minute) seen = { minute, up: activeLaunches(at, fromServer) };
  return seen.up;
}

export function setLaunches(list: Launch[]): void {
  fromServer = list;
  seen.minute = Number.NaN;
}

/** The launches the stand has up now, newest first: what the pamphlet is about. */
export const currentLaunches = (): Launch[] => launchesAt(serverNow());

/** Pamphlets this browser has been handed (`standOf(...).key`: which launches were on it). */
const HANDED = "tokenmaxxing.pamphlets";
const handed = new Set<string>(
  (() => {
    try {
      return JSON.parse(localStorage.getItem(HANDED) ?? "[]") as string[];
    } catch {
      return [];
    }
  })(),
);
function markHanded(key: string): void {
  handed.add(key);
  try {
    localStorage.setItem(HANDED, JSON.stringify([...handed].slice(-50)));
  } catch {
    // No storage: you'd be handed one again next visit, which is fine.
  }
}

/** The pamphlet in the air: from the stand to the tile you stood on, then the panel opens. */
const THROW_MS = 600;
let throwing: { at: number; x: number; y: number } | null = null;

/**
 * Someone walks onto the front: the presenter flicks them a pamphlet, once for each lot of news, and
 * when it lands the panel opens. Whichever renderer draws the town calls this every frame with its
 * clock (ms); it returns the pamphlet in the air (`t` 0 to 1, flying to tile `x`, `y`) to draw, or null.
 */
export function handOut(now: number): { t: number; x: number; y: number } | null {
  const up = world.room === "town" ? currentLaunches() : [];
  if (up.length === 0) {
    throwing = null;
    return null;
  }
  const key = standOf(up).key;
  const me = self();
  if (me && !throwing && !handed.has(key) && isStandFront(me.x, me.y) && !hud.get().panel) {
    markHanded(key);
    throwing = { at: now, x: me.x, y: me.y };
  }
  if (!throwing) return null;
  const t = (now - throwing.at) / THROW_MS;
  if (t < 1) return { t: Math.max(0, t), x: throwing.x, y: throwing.y };
  throwing = null;
  if (!hud.get().panel) hud.set({ panel: { kind: "pamphlet" } });
  return null;
}

/** The stand's tiles take a step off you, while it's up. */
export const blocksLaunch = (x: number, y: number): boolean =>
  world.room === "town" && isStand(x, y) && currentLaunches().length > 0;

/** E in front of the stand: another pamphlet. False when it isn't up or you're not facing it. */
export function launchInteract(me: {
  x: number;
  y: number;
  facing: Parameters<typeof facesStand>[2];
}): boolean {
  if (world.room !== "town" || !facesStand(me.x, me.y, me.facing)) return false;
  if (currentLaunches().length === 0) return false;
  hud.set({ panel: { kind: "pamphlet" } });
  return true;
}

/** The sign over a rainbow stand: dark, so every colour under it reads. */
export const RAINBOW_SIGN = "#2b2433";

export function drawLaunch({ g, items, labels, toScreen, now, dpr }: Frame): void {
  const flying = handOut(now);
  if (world.room !== "town") return;
  const up = currentLaunches();
  if (up.length === 0) return;
  const stand = standOf(up);
  const sprite = standSprite(stand.accent, Math.floor(now / 500) % 2 === 0);
  const left = STAND.x * TILE;
  const bottom = (STAND.y + STAND.h) * TILE;
  items.push({ y: bottom - 1, draw: () => g.drawImage(sprite, left, bottom - STAND_H) });
  const [sx, sy] = toScreen(left + STAND_W / 2, bottom - STAND_H);
  labels.push(() =>
    pill(g, sx, sy - 2 * dpr, stand.sign, dpr, stand.accent ?? RAINBOW_SIGN, "#fbf7ef", 240 * dpr),
  );
  if (flying) {
    const { t } = flying;
    const from = { x: left + STAND_W / 2, y: bottom - 12 };
    const to = { x: flying.x * TILE + TILE / 2, y: flying.y * TILE + 4 };
    const flyer = paperSprite();
    const px = Math.round(from.x + (to.x - from.x) * t - flyer.width / 2);
    const py = Math.round(from.y + (to.y - from.y) * t - Math.sin(t * Math.PI) * 14);
    items.push({ y: bottom + TILE, draw: () => g.drawImage(flyer, px, py) });
  }
}
