/**
 * J-dag, the first Friday of November (`holidays.ts`): at 20:59 the Christmas beer comes out. The town's own
 * brewery truck, Nissebryg's, drives in along the road under the square, parks there till 03:00 and drives
 * off; from 20:59 until Sunday is out, the Tavern's tap pours Nissebryg instead of the day's special, free
 * like it (`tavern.ts`). All from the clock, so the server keeps nothing. Nissebryg and its brewery are made
 * up, like the posters' films.
 */
import { lerp } from "hanzio";
import { minutesFrom } from "./holidays.ts";

export const JULEBRYG = {
  name: "Nissebryg",
  brewery: "Tokenhavn Bryggeri",
  /** What the tap and the chalkboards say on the J-dag weekend. */
  line: "🍺 J-dag: Nissebryg, the julebryg, is on tap",
} as const;

/**
 * The truck: its row (the road under the square), the tile its back stands on when parked, how wide it is,
 * where it drives in from and out to, and when, in minutes from J-dag's midnight (it leaves the next night).
 */
export const TRUCK = {
  y: 9,
  park: 2,
  w: 4,
  from: -14,
  to: 22,
  arrives: 20 * 60 + 59,
  leaves: 24 * 60 + 3 * 60,
  /** Minutes it takes to drive in, or out. */
  drive: 1,
} as const;

/** The tap pours Nissebryg from 20:59 on J-dag until Sunday is out. */
const POURS_UNTIL = 3 * 24 * 60;

/** Minutes from J-dag's midnight (Copenhagen) to `ms`: negative before it, past 1440 after. */
const sinceJDag = (ms: number): number => minutesFrom("jDag", ms);

/** Where the truck is at `ms` (its back's tile, fractional while it drives), or null when it isn't in town. */
export function truckAt(ms: number): { x: number; y: number; parked: boolean } | null {
  const m = sinceJDag(ms);
  const { y, park, from, to, arrives, leaves, drive } = TRUCK;
  if (m < arrives || m >= leaves + drive) return null;
  if (m < arrives + drive) return { x: lerp(from, park, (m - arrives) / drive), y, parked: false };
  if (m < leaves) return { x: park, y, parked: true };
  return { x: lerp(park, to, (m - leaves) / drive), y, parked: false };
}

/** Whether the parked truck stands on (x, y): nobody walks through it. */
export function isTruck(x: number, y: number, ms: number): boolean {
  if (y !== TRUCK.y || x < TRUCK.park || x >= TRUCK.park + TRUCK.w) return false;
  return truckAt(ms)?.parked ?? false;
}

/** Whether the Tavern pours Nissebryg at `ms`: the J-dag weekend, from 20:59 on the Friday. */
export function julebrygOn(ms: number): boolean {
  const m = sinceJDag(ms);
  return m >= TRUCK.arrives && m < POURS_UNTIL;
}
