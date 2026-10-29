/**
 * The windmill by the Tavern: its sails turn as fast as the wind over Aarhus blows (the `Weather` the server
 * fetches every 15 minutes, `server/src/weather.ts`), and its cap winds them round to face where the wind comes
 * from. The server keeps nothing for it: each client eases its own mill towards what the weather says, so a
 * change of wind spins the sails up or down and turns the cap, rather than jumping.
 */
import { clamp } from "hanzio";
import { compass, type Weather } from "./sky.ts";

/** The windmill's tile in the town map (`LEGEND` and `CORE` in `maps.ts`): it stands on 2×2 of them. */
export const WINDMILL = "Ŵ";

export const SAILS = {
  /** Below this wind (m/s) the sails stand still: a light air won't turn them. */
  cutIn: 2,
  /** From this wind (m/s) up they turn no faster: in a gale the miller reefs the sails. */
  full: 14,
  /** Turns a second at `full` and above (42 a minute). */
  maxRps: 0.7,
  /** Seconds the sails take to get about two thirds of the way to a new speed: they are heavy. */
  spinUp: 4,
  /** Degrees a second the cap winds round to face a new wind. */
  winding: 15,
} as const;

/** Turns a second for `windMs`: still in calm air, then in step with the wind, up to `SAILS.maxRps`. */
export const sailRps = (windMs: number): number =>
  windMs < SAILS.cutIn ? 0 : (SAILS.maxRps * Math.min(windMs, SAILS.full)) / SAILS.full;

/** A windmill as one client shows it. */
export interface Mill {
  /** How far round the sails are, in turns (0 to 1), anticlockwise as seen from the front. */
  turn: number;
  /** Turns a second right now. */
  rps: number;
  /** Compass degrees the sails face (0 north, 90 east): into the wind, once the cap has wound round. */
  facing: number;
}

type Wind = Pick<Weather, "windMs" | "windDir">;

/** A mill already turning with `wind`, facing into it (a page that opens in a storm finds it spinning). */
export const newMill = (wind: Wind): Mill => ({ turn: 0, rps: sailRps(wind.windMs), facing: wind.windDir });

/**
 * Moves `mill` on by `dt` seconds of `wind`, in place (it runs every frame): the sails ease towards their
 * speed for it and turn, and the cap winds the shorter way round towards where the wind comes from.
 */
export function turnMill(mill: Mill, wind: Wind, dt: number): Mill {
  const rps = sailRps(wind.windMs);
  mill.rps += (rps - mill.rps) * (1 - Math.exp(-dt / SAILS.spinUp));
  // Coming to rest takes forever on a curve: stop once it's too slow to see.
  if (rps === 0 && mill.rps < 0.005) mill.rps = 0;
  mill.turn = (mill.turn + mill.rps * dt) % 1;
  const off = ((((wind.windDir - mill.facing) % 360) + 540) % 360) - 180;
  const step = SAILS.winding * dt;
  mill.facing = (((mill.facing + clamp(off, -step, step)) % 360) + 360) % 360;
  return mill;
}

/** What E on the windmill says: the wind right now, and what it does to the sails. */
export function millSays(wind: Wind): string {
  const at = `${wind.windMs} m/s from the ${compass(wind.windDir)}`;
  const perMinute = Math.round(sailRps(wind.windMs) * 60);
  if (wind.windMs < SAILS.cutIn)
    return `🌬 The windmill stands still: ${wind.windMs} m/s over Aarhus, and its sails need ${SAILS.cutIn} to turn.`;
  if (wind.windMs >= SAILS.full)
    return `🌬 ${at} over Aarhus: the sails are flat out at ${perMinute} turns a minute. The miller has reefed them.`;
  return `🌬 The wind over Aarhus is ${at}: the sails turn ${perMinute} times a minute.`;
}
