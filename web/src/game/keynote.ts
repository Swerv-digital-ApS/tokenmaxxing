/**
 * The keynote watch party in the page (`core/src/keynote.ts`): `world`'s schedule (the `keynotes` event), or
 * `?keynote=live|soon|off` (`live:Google I/O` names it) to force it for screenshots; only here, since the
 * bots and the badge follow the server. While one is on, the Tavern's west wall has the projector screen
 * down beside the stage, a beam from the projector over the crowd and a sign with the event; before it, a
 * poster in the same spot. E on it from the stage, or the banner, opens the keynote panel.
 */
import {
  facesScreen,
  forcedKeynotes,
  hostAccent,
  type Keynote,
  SCREEN,
  screenOf,
  signOf,
} from "@tokenmaxxing/core/keynote.ts";
import { type Facing, TILE } from "@tokenmaxxing/core/world.ts";
import { useSyncExternalStore } from "react";
import { POSTER_H, posterSide, projector, SCREEN_H, screenSide } from "../art/keynote.ts";
import { hud } from "../store.ts";
import type { Frame } from "./frame.ts";
import { drawGlow } from "./glow.ts";
import { pill } from "./labels.ts";
import { self, serverNow, world } from "./world.ts";

const forced = forcedKeynotes(new URLSearchParams(location.search).get("keynote"), Date.now());
let fromServer: Keynote[] = [];
const listeners = new Set<() => void>();

/** The schedule: still to come or on, soonest first. */
export const keynotesNow = (): Keynote[] => forced ?? fromServer;

export function setKeynotes(list: Keynote[]): void {
  fromServer = list;
  for (const l of listeners) l();
}

/** The schedule, for React; what's live is the clock's, so pair it with a ticker. */
export const useKeynotes = (): Keynote[] =>
  useSyncExternalStore((l) => {
    listeners.add(l);
    return () => listeners.delete(l);
  }, keynotesNow);

/** What the Tavern's wall shows now: the screen while one is on, a poster for the next, or nothing. */
export const keynoteScreen = () => screenOf(keynotesNow(), serverNow());

/** E facing the screen (or its poster): the keynote panel. False when there's nothing there. */
export function keynoteInteract(me: { x: number; y: number; facing: Facing }): boolean {
  if (world.room !== "inn" || !facesScreen(me.x, me.y, me.facing) || !keynoteScreen()) return false;
  hud.set({ panel: { kind: "keynote" } });
  return true;
}

/** The poster's sign shows only this close (in tiles from the stage): it's a poster, not a billboard. */
const POSTER_NEAR = 6;
/** Where the projector hangs, in Tavern tiles: over the crowd, aimed at the screen. */
const PROJECTOR: readonly [number, number] = [7, 12];

/** The screen or the poster on the west wall, and the sign over it. Tavern only. */
export function drawKeynote({ g, items, labels, toScreen, now, dpr }: Frame): void {
  if (world.room !== "inn") return;
  const s = keynoteScreen();
  if (!s) return;
  const accent = hostAccent(s.keynote.host);
  const x = SCREEN.x * TILE;
  const top = SCREEN.y * TILE;
  const mid = top + (SCREEN.h * TILE) / 2;
  if (s.live) {
    const sprite = screenSide(accent, Math.floor(now / 600) % 2 === 0);
    items.push({ y: top + SCREEN_H - 1, draw: () => g.drawImage(sprite, x, top) });
  } else {
    const sprite = posterSide(accent);
    const py = Math.round(mid - POSTER_H / 2);
    items.push({ y: py + POSTER_H - 1, draw: () => g.drawImage(sprite, x, py) });
    const me = self();
    if (!me || Math.hypot(me.x - (SCREEN.x + 2), me.y - (SCREEN.y + SCREEN.h / 2)) > POSTER_NEAR) return;
  }
  // Over the stage in front of it: the wall is the room's edge, where a sign centred on it would be cut off.
  const [sx, sy] = toScreen((SCREEN.x + 3) * TILE, s.live ? top : Math.round(mid - POSTER_H / 2));
  const sign = signOf(s, serverNow());
  labels.push(() => pill(g, sx, sy - 2 * dpr, sign, dpr, accent, "#fbf7ef", 260 * dpr));
}

/**
 * Over the room's light (`lightTavern`): while one is on, the projector on the ceiling, its beam across to
 * the screen, and the screen's glow on the stage.
 */
export function lightKeynote({ g, now }: Frame): void {
  if (world.room !== "inn") return;
  const s = keynoteScreen();
  if (!s?.live) return;
  const [px, py] = PROJECTOR;
  const lens = { x: px * TILE, y: py * TILE + 4 };
  const left = (SCREEN.x + 1) * TILE - 2;
  const top = SCREEN.y * TILE + 5;
  const bottom = (SCREEN.y + SCREEN.h) * TILE - 6;
  // The beam: faint, flickering a little with the picture.
  const k = 0.07 + 0.02 * Math.sin(now / 170) * Math.sin(now / 410);
  const beam = g.createLinearGradient(lens.x, 0, left, 0);
  beam.addColorStop(0, `rgba(255, 250, 230, ${(k * 2.2).toFixed(3)})`);
  beam.addColorStop(1, `rgba(220, 232, 255, ${k.toFixed(3)})`);
  g.fillStyle = beam;
  g.beginPath();
  g.moveTo(lens.x, lens.y - 1);
  g.lineTo(left, top);
  g.lineTo(left, bottom);
  g.lineTo(lens.x, lens.y + 1);
  g.closePath();
  g.fill();
  drawGlow(g, left + 4, (top + bottom) / 2, 54, "220,232,255", 0.35);
  g.drawImage(projector(true), lens.x - 1, lens.y - 5);
}
