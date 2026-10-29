/**
 * Sprint Race in town: while a race is on, its racers leave the table and run laps of the square,
 * each as far round as they've typed (`LAP_CHARS` correct characters a lap). Only drawn: on the
 * server they stand at the table the whole time, so nobody else's movement changes.
 */
import { LAP_CHARS } from "@tokenmaxxing/core/games/sprint.ts";
import { PLAZA } from "@tokenmaxxing/core/maps.ts";
import { type Facing, TILE, type WorldGame } from "@tokenmaxxing/core/world.ts";
import { lerp } from "hanzio";
import { C } from "../art/palette.ts";
import type { Frame } from "./frame.ts";
import { gamesOf, world } from "./world.ts";

export interface Lap {
  x: number;
  y: number;
  facing: Facing;
  running: boolean;
}

/** How far round each racer is drawn, easing towards where they are. */
const shown = new Map<number, { laps: number; at: number }>();
/** Updates arrive a few times a second; this smooths the steps between them. */
const EASE_MS = 400;

export const live = (g: WorldGame) => g.game === "sprint" && g.headline !== "Over";

function raceOf(id: number): WorldGame | undefined {
  return world.room === "town" ? gamesOf(id).find(live) : undefined;
}

/** Each racer's own lane, in tiles in from the edge: the first innermost, the rest outwards. */
export function lane(g: WorldGame, id: number): number {
  const n = g.players.length;
  return 0.35 - g.players.indexOf(id) * (n > 1 ? Math.min(0.45, 1.4 / (n - 1)) : 0);
}

/** `laps` round the square, clockwise from the middle of its top edge (the start line), `o` tiles in. */
function around(laps: number, o: number): Omit<Lap, "running"> {
  const [l, r, t, b] = [PLAZA.left + o, PLAZA.right - o, PLAZA.top + o, PLAZA.bottom - o];
  const [w, h] = [r - l, b - t];
  let d = ((((laps % 1) + 1) % 1) * 2 * (w + h) + w / 2) % (2 * (w + h));
  if (d < w) return { x: l + d, y: t, facing: "right" };
  d -= w;
  if (d < h) return { x: r, y: t + d, facing: "down" };
  d -= h;
  if (d < w) return { x: r - d, y: b, facing: "left" };
  return { x: l, y: b - (d - w), facing: "up" };
}

/** Where a racer is drawn this frame, or null when they aren't in a race. */
export function racing(id: number, now: number): Lap | null {
  const g = raceOf(id);
  if (!g) {
    shown.delete(id);
    return null;
  }
  const target = (g.board?.find((r) => r.player === id)?.value ?? 0) / LAP_CHARS;
  const was = shown.get(id) ?? { laps: 0, at: now };
  const laps = lerp(was.laps, target, Math.min(1, (now - was.at) / EASE_MS));
  shown.set(id, { laps, at: now });
  return { ...around(laps, lane(g, id)), running: target - laps > 0.002 };
}

/** The start line across the lanes: a chequered strip on the paving. */
export function startLine({ g, items }: Frame, game: WorldGame) {
  if (!live(game)) return;
  const lanes = game.players.map((p) => lane(game, p));
  const x = ((PLAZA.left + PLAZA.right) / 2) * TILE + 13;
  const top = Math.round((PLAZA.top + Math.min(...lanes)) * TILE + 6);
  const bottom = Math.round((PLAZA.top + Math.max(...lanes)) * TILE + TILE);
  items.push({
    y: (PLAZA.top - 2) * TILE,
    draw: () => {
      for (let y = top; y < bottom; y += 2)
        for (const dx of [0, 2]) {
          g.fillStyle = ((y - top) / 2 + dx / 2) % 2 === 0 ? C.white : C.ink;
          g.fillRect(x + dx, y, 2, 2);
        }
    },
  });
}
