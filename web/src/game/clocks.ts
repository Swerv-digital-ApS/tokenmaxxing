import { CLOCKS, cityTime, clocksLine, hhmm, inLaunchWindow } from "@tokenmaxxing/core/clocks.ts";
import { TILE } from "@tokenmaxxing/core/world.ts";
import { CLOCKS_DY, CLOCKS_W, DIALS, worldClocks } from "../art/tavern.ts";
import type { Frame } from "./frame.ts";
import { drawGlow } from "./glow.ts";
import { nearPill } from "./labels.ts";
import { skyNow } from "./sky.ts";
import { world } from "./world.ts";

/**
 * The Tavern's world clocks (`◷` on the map, `core/src/clocks.ts`): SF, New York and Copenhagen on the north
 * wall by the hearth. SF's lamp is on in the launch window, with a sign over the clocks; E says the time.
 * The 3D Tavern reads the same `clockFaces`.
 */

export interface ClockFaces {
  hands: { hour: number; minute: number }[];
  /** The launch window is open (SF's working hours). */
  lit: boolean;
  /** SF's `HH:MM`, for the sign. */
  sf: string;
}

/** The hands and the lamp, worked out once a minute (they only move on one). */
let faces: ClockFaces & { minute: number } = { minute: Number.NaN, hands: [], lit: false, sf: "" };
export function clockFaces(ms = skyNow()): ClockFaces {
  const minute = Math.floor(ms / 60_000);
  if (minute !== faces.minute) {
    const times = CLOCKS.map((c) => cityTime(c.tz, ms));
    faces = {
      minute,
      hands: times.map(({ hour, minute }) => ({ hour, minute })),
      lit: inLaunchWindow(ms),
      sf: hhmm(times[0]!),
    };
  }
  return faces;
}

/** The sign over the clocks while the window is open; null while it's shut. */
export const clocksSign = (f: ClockFaces): string | null =>
  f.lit ? `🚀 Launch window · ${f.sf} in SF` : null;

/** What E on the clocks says. */
export const clocksText = (): string => clocksLine(skyNow());

let sprite: { of: ClockFaces | null; canvas: HTMLCanvasElement | null } = { of: null, canvas: null };

/** Queues the clocks on the wall (from the run's left tile), the lamp's glow and the sign. */
export function drawClocks({ g, items, labels, toScreen, dpr }: Frame): void {
  if (world.map.id !== "inn") return;
  const at = world.map.find("◷").find(([x, y]) => world.map.at(x - 1, y) !== "◷");
  if (!at) return;
  const f = clockFaces();
  if (sprite.of !== f) sprite = { of: f, canvas: worldClocks(f.hands, f.lit) };
  const canvas = sprite.canvas!;
  const left = at[0] * TILE;
  const top = at[1] * TILE + CLOCKS_DY;
  items.push({
    y: at[1] * TILE + 4,
    draw: () => {
      g.drawImage(canvas, left, top);
      if (f.lit) drawGlow(g, left + DIALS[0] + 0.5, top + 0.5, 7, "255,106,74", 0.5);
    },
  });
  const text = clocksSign(f);
  if (!text) return;
  const [sx, sy] = toScreen(left + CLOCKS_W / 2, top);
  labels.push(() => nearPill(g, sx, sy - 2 * dpr, text, dpr, "rgba(216, 52, 60, 0.95)", "#fbf7ef"));
}
