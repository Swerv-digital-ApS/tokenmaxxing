import { type FishingCast, LANDED_MS, STALE_LINE_MS } from "@tokenmaxxing/core/fishing.ts";
import { hud } from "../store.ts";
import { self, serverNow, world } from "./world.ts";

let line: FishingCast | null = null;
export const setFishingLine = (cast: FishingCast | null): void => {
  line = cast;
};
/** My own line, while the panel is open and I'm still on the bank I cast from. */
export function fishingLine(): FishingCast | null {
  const me = self();
  return line &&
    world.room === "town" &&
    me?.x === line.x &&
    me.y === line.y &&
    hud.get().panel?.kind === "fishing"
    ? line
    : null;
}

/** A catch on its way out of the water: which fish, from where, and when it left (`performance.now()`, the frames' clock). */
export interface Landed {
  fish: string;
  cast: FishingCast;
  at: number;
}

let landed: Landed | null = null;
export const setLanded = (l: Landed | null): void => {
  landed = l;
};

/**
 * My catch being held up at `now` (a frame's `performance.now()`), and how far along (0 out of the water, 1 back
 * in), while I'm still on the bank I cast from.
 */
export function landedAt(now: number): { landed: Landed; t: number } | null {
  if (!landed) return null;
  const t = (now - landed.at) / LANDED_MS;
  const me = self();
  if (t >= 1 || world.room !== "town" || me?.x !== landed.cast.x || me.y !== landed.cast.y) {
    landed = null;
    return null;
  }
  return { landed, t: Math.max(0, t) };
}

/** Someone's line in the pond, as drawn: who, where they stand, where it went in, and its bite (server ms). */
export interface Line {
  id: number;
  x: number;
  y: number;
  waterX: number;
  waterY: number;
  biteAt: number;
  endsAt: number;
}

/** Someone's catch being held up: who, where they stand, where it came from, and how far along (0 to 1). */
export interface Held {
  id: number;
  fish: string;
  x: number;
  y: number;
  waterX: number;
  waterY: number;
  t: number;
}

// Reused every frame (there are only ever a few in them): the renderers read them until the next call.
const shownLines: Line[] = [];
const shownHeld: Held[] = [];

/**
 * Every line in the pond this frame: mine from the panel (it's there before the server echoes it), everyone
 * else's from what the room was told (`PlayerInfo.angling`).
 */
export function lines(): readonly Line[] {
  shownLines.length = 0;
  if (world.room !== "town") return shownLines;
  const mine = fishingLine();
  const push = (id: number, x: number, y: number, l: Omit<Line, "id" | "x" | "y">) => {
    shownLines.push({ id, x, y, waterX: l.waterX, waterY: l.waterY, biteAt: l.biteAt, endsAt: l.endsAt });
  };
  if (mine) push(world.selfId, mine.x, mine.y, mine);
  const now = serverNow();
  for (const a of world.avatars.values()) {
    const l = a.info.angling;
    if (!l || a.info.id === world.selfId || a.from || now > l.endsAt + STALE_LINE_MS) continue;
    push(a.info.id, a.x, a.y, l);
  }
  return shownLines;
}

/** Every catch being held up this frame (`now`: the frame's `performance.now()`): mine, and everyone else's. */
export function held(now: number): readonly Held[] {
  shownHeld.length = 0;
  if (world.room !== "town") return shownHeld;
  const push = (h: Held) => shownHeld.push(h);
  const mine = landedAt(now);
  if (mine) {
    const c = mine.landed.cast;
    push({
      id: world.selfId,
      fish: mine.landed.fish,
      x: c.x,
      y: c.y,
      waterX: c.waterX,
      waterY: c.waterY,
      t: mine.t,
    });
  }
  const server = serverNow();
  for (const a of world.avatars.values()) {
    const l = a.info.landing;
    if (!l || a.info.id === world.selfId || a.from) continue;
    const t = (server - l.at) / LANDED_MS;
    if (t < 0 || t >= 1) continue;
    push({ id: a.info.id, fish: l.fish, x: a.x, y: a.y, waterX: l.waterX, waterY: l.waterY, t });
  }
  return shownHeld;
}

/** Whether a line's bobber is under (the fish is biting) at server time `now`. */
export const biting = (l: Line, now: number): boolean => now >= l.biteAt && now < l.endsAt;

/**
 * Where a catch is along its leap, `t` from 0 to 1: out of the water, up over the bank in an arc, held a moment,
 * then dropped back. `k` 0 is the water, 1 the hand; `lift` is how high above the line between them, 0 to 1.
 */
export function leap(t: number): { k: number; lift: number } {
  if (t < 0.3) {
    const u = t / 0.3;
    return { k: u, lift: Math.sin(u * Math.PI) * 0.6 + u };
  }
  if (t < 0.8) return { k: 1, lift: 1 + Math.sin(((t - 0.3) / 0.5) * Math.PI * 4) * 0.04 };
  const u = (t - 0.8) / 0.2;
  return { k: 1 - u, lift: 1 - u + Math.sin(u * Math.PI) * 0.4 };
}
