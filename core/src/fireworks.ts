/**
 * Fireworks over the town: a show is a start time, a length, a patch of ground and a seed, and every
 * rocket in it follows from those, so every client draws the same rockets at the same moment without
 * the server sending more than the show. The star counter sets one off at a milestone (`stars.ts`);
 * anything else on the clock (New Year's at midnight) can make its own. Both renderers draw what
 * `rocketsAt` and `sparkAt` say: the 2D one flat on the canvas, the 3D one in the air over the square.
 */
import { clamp } from "hanzio";
import { random } from "./games/random.ts";

export interface Fireworks {
  /** When the first rocket goes up (ms, the world's clock). */
  at: number;
  /** How long rockets keep going up (ms). The last ones burst a little after. */
  ms: number;
  /** The middle of the ground they go up from (town tiles), and how far either side, across and down. */
  x: number;
  y: number;
  w: number;
  h: number;
  seed: number;
  /** The sparks' colours; `COLOURS` when not given. */
  colours?: readonly string[];
}

/** One rocket at a moment: still going up (`rise` 0 to 1), or burst (`burst` 0 to 1, fading as it ends). */
export interface Rocket {
  /** Where it went up from (town tiles, fractional). */
  x: number;
  y: number;
  /** How high it bursts, and how far its sparks fly (tiles). */
  height: number;
  radius: number;
  rise: number;
  burst: number | null;
  colour: string;
  sparks: number;
  /** Its own number in the show, for anything else per rocket (a spin, a sound). */
  id: number;
}

export const COLOURS: readonly string[] = [
  "#ff5d73",
  "#ffd23f",
  "#5ee0ff",
  "#b18cff",
  "#7dff8a",
  "#fff4d6",
  "#ff9f43",
];

/** A rocket goes up every `EVERY_MS` (two at once in the last `FINALE_MS`), climbs for `RISE_MS` and burns for `BURST_MS`. */
export const EVERY_MS = 420;
export const RISE_MS = 950;
export const BURST_MS = 1_600;
const FINALE_MS = 6_000;
/** Each rocket goes up up to this much after its slot (ms), so they don't tick like a clock. */
const JITTER_MS = 300;
const LIFE_MS = JITTER_MS + RISE_MS + BURST_MS;
/** How far a spark falls by the end of its burst (tiles). */
const DROOP = 1.2;

/** Whether the show still has something in the air at `now`. */
export const fireworksOn = (show: Fireworks, now: number): boolean =>
  now >= show.at && now < show.at + show.ms + LIFE_MS;

const rocketOf = (show: Fireworks, id: number, now: number): Rocket | null => {
  const r = random(show.seed * 7919 + id * 104_729);
  const slot = Math.floor(id / 2);
  const launched = show.at + slot * EVERY_MS + r() * JITTER_MS;
  const age = now - launched;
  if (age < 0 || age >= RISE_MS + BURST_MS) return null;
  const colours = show.colours?.length ? show.colours : COLOURS;
  const x = show.x + (r() - 0.5) * 2 * show.w;
  const y = show.y + (r() - 0.5) * 2 * show.h;
  const height = 4.5 + r() * 2.5;
  const radius = 1.4 + r() * 1.2;
  const colour = colours[Math.floor(r() * colours.length)]!;
  const sparks = 16 + Math.floor(r() * 12);
  const rise = clamp(age / RISE_MS, 0, 1);
  const burst = age < RISE_MS ? null : (age - RISE_MS) / BURST_MS;
  return { x, y, height, radius, rise, burst, colour, sparks, id };
};

/** Every rocket in the air at `now`, oldest first. */
export function rocketsAt(show: Fireworks, now: number): Rocket[] {
  if (!fireworksOn(show, now)) return [];
  const elapsed = now - show.at;
  const first = Math.max(0, Math.floor((elapsed - LIFE_MS) / EVERY_MS));
  const last = Math.min(Math.floor(elapsed / EVERY_MS), Math.floor((show.ms - 1) / EVERY_MS));
  const out: Rocket[] = [];
  for (let slot = first; slot <= last; slot++) {
    // The finale: a second rocket in each slot.
    const pair = slot * EVERY_MS >= show.ms - FINALE_MS ? 2 : 1;
    for (let j = 0; j < pair; j++) {
      const rocket = rocketOf(show, slot * 2 + j, now);
      if (rocket) out.push(rocket);
    }
  }
  return out;
}

/** Where a rocket is while it climbs: its height (tiles), slowing as it nears the top. */
export const climbOf = (r: Rocket): number => r.height * (1 - (1 - r.rise) ** 2);

/**
 * Where spark `i` of a burst rocket is, from the burst's middle (tiles): `[across, up, depth]`. The sparks
 * are spread evenly over a ball and fly out fast, then slow and fall. The 2D renderer draws `across` and
 * `up`; the 3D one all three.
 */
export function sparkAt(r: Rocket, i: number): [number, number, number] {
  const t = r.burst ?? 0;
  const reach = r.radius * (1 - (1 - t) ** 3);
  // A Fibonacci sphere, turned per rocket so no two bursts look alike.
  const up = 1 - (2 * (i + 0.5)) / r.sparks;
  const ring = Math.sqrt(1 - up * up);
  const angle = i * 2.399963 + r.id;
  return [Math.cos(angle) * ring * reach, up * reach - DROOP * t * t, Math.sin(angle) * ring * reach];
}

/** How bright a burst's sparks still are: full, then fading out over its second half. */
export const sparkFade = (r: Rocket): number => clamp(2 - 2 * (r.burst ?? 0), 0, 1);
