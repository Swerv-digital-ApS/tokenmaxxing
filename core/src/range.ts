/** The whole world runs on one clock: "today" and daily charts are Copenhagen days. */
import { isOneOf, typedSwitch } from "hanzio";

export const WORLD_TZ = "Europe/Copenhagen";

const RANGES = ["today", "7d", "30d", "all"] as const;
export type RangeKey = (typeof RANGES)[number];

export const isRangeKey = (s: unknown): s is RangeKey => isOneOf(RANGES, s);

const HOUR = 3_600_000;

const wallFormat = new Intl.DateTimeFormat("en-US", {
  timeZone: WORLD_TZ,
  weekday: "short",
  year: "numeric",
  month: "numeric",
  day: "numeric",
  hour: "numeric",
  minute: "numeric",
  second: "numeric",
  hourCycle: "h23",
});

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Wall-clock parts of `ms` in the world, from Intl: a few µs a call. */
function intlWall(ms: number): Wall {
  const p: Record<string, string> = {};
  for (const { type, value } of wallFormat.formatToParts(ms)) p[type] = value;
  return {
    y: Number(p.year),
    m: Number(p.month),
    d: Number(p.day),
    weekday: WEEKDAYS.indexOf(p.weekday!),
    hour: Number(p.hour),
    minute: Number(p.minute),
    second: Number(p.second),
  };
}

/**
 * The world's offset from UTC (ms) per UTC hour, from Intl. The client asks for the clock many times a
 * frame and the server once per event, and Copenhagen's clocks only ever change on the hour.
 */
const offsets = new Map<number, number>();

function offsetAt(ms: number): number {
  const hour = Math.floor(ms / HOUR);
  let offset = offsets.get(hour);
  if (offset === undefined) {
    const w = intlWall(hour * HOUR);
    offset = Date.UTC(w.y, w.m - 1, w.d, w.hour, w.minute, w.second) - hour * HOUR;
    if (offsets.size >= 100_000) offsets.clear();
    offsets.set(hour, offset);
  }
  return offset;
}

/** Every hour of these years was checked against Intl. Outside them, and for what isn't a time, Intl answers. */
const CACHED_FROM = Date.UTC(1900, 0, 1);
const CACHED_TO = Date.UTC(2200, 0, 1);

/** The world's wall clock at `ms`; `weekday` 0 is Sunday. */
export interface Wall {
  y: number;
  m: number;
  d: number;
  weekday: number;
  hour: number;
  minute: number;
  second: number;
}

/** The world's wall clock at `ms`. Like Intl, it drops `ms`'s fraction and throws for what isn't a time. */
export function worldWall(ms: number): Wall {
  const t = Math.trunc(ms);
  if (!(t >= CACHED_FROM && t < CACHED_TO)) return intlWall(t);
  const at = new Date(t + offsetAt(t));
  return {
    y: at.getUTCFullYear(),
    m: at.getUTCMonth() + 1,
    d: at.getUTCDate(),
    weekday: at.getUTCDay(),
    hour: at.getUTCHours(),
    minute: at.getUTCMinutes(),
    second: at.getUTCSeconds(),
  };
}

export const pad2 = (n: number): string => String(n).padStart(2, "0");

/** Weekday (0 is Sunday) and hour of `ms` on the world's clock. */
export function worldClock(ms: number): { day: number; hour: number } {
  const { weekday, hour } = worldWall(ms);
  return { day: weekday, hour };
}

/** `YYYY-MM-DD` of the world day containing `ms`. */
export function dayKey(ms: number): string {
  const { y, m, d } = worldWall(ms);
  return `${y}-${pad2(m)}-${pad2(d)}`;
}

/** `YYYY-MM-DD` shifted by `n` days (pure calendar math, no timezone). */
export function addDays(key: string, n: number): string {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, d! + n)).toISOString().slice(0, 10);
}

/** Inclusive world-day bounds of a range; `from` is null for all time. */
export function rangeDays(key: RangeKey, now: number): { from: string | null; to: string } {
  const to = dayKey(now);
  const back = typedSwitch(key, { today: () => 0, "7d": () => 6, "30d": () => 29, all: () => null });
  return { from: back === null ? null : addDays(to, -back), to };
}
