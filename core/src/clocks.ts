/**
 * The Tavern's world clocks: three in a row on the north wall by the hearth (`◷` on the map), telling the time
 * in San Francisco, New York and Copenhagen (the world's own clock). US model launches land in US working
 * hours, which is the evening here, so SF's lamp lights up while they're on (`inLaunchWindow`) and E on the
 * clocks says so, pointing at the launch stand in the square (`launch.ts`). Pure and clock-driven like
 * `street.ts`: every client reads the same time off Intl, and the server keeps nothing. Each city's daylight
 * saving is Intl's too, never a fixed offset, so the weeks the US and the EU are out of step (from the second
 * Sunday of March to the last, and from the last Sunday of October to the first of November) come out right.
 */
import { pad2, WORLD_TZ } from "./range.ts";

/** The clocks, west to east as they hang. */
export const CLOCKS = [
  { id: "sf", city: "San Francisco", short: "SF", tz: "America/Los_Angeles" },
  { id: "ny", city: "New York", short: "NY", tz: "America/New_York" },
  { id: "cph", city: "Copenhagen", short: "CPH", tz: WORLD_TZ },
] as const;

export type Clock = (typeof CLOCKS)[number];

const SF = CLOCKS[0];

/** SF's working hours (minutes since midnight there), Monday to Friday: when launches tend to land. */
export const LAUNCH_WINDOW = { from: 9 * 60, to: 17 * 60 } as const;

/** A city's wall clock at an instant; `weekday` 0 is Sunday, `offset` is minutes ahead of UTC. */
export interface CityTime {
  y: number;
  m: number;
  d: number;
  weekday: number;
  hour: number;
  minute: number;
  offset: number;
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const formats = new Map<string, Intl.DateTimeFormat>();

const formatOf = (tz: string): Intl.DateTimeFormat => {
  let f = formats.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      weekday: "short",
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      hourCycle: "h23",
    });
    formats.set(tz, f);
  }
  return f;
};

/** The wall clock in time zone `tz` at `ms`, from Intl. */
export function cityTime(tz: string, ms: number): CityTime {
  const p: Record<string, string> = {};
  for (const { type, value } of formatOf(tz).formatToParts(ms)) p[type] = value;
  const [y, m, d, hour, minute] = [p.year, p.month, p.day, p.hour, p.minute].map(Number) as number[];
  const minuteStart = Math.floor(ms / 60_000) * 60_000;
  const offset = Math.round((Date.UTC(y!, m! - 1, d!, hour!, minute!) - minuteStart) / 60_000);
  return { y: y!, m: m!, d: d!, weekday: WEEKDAYS.indexOf(p.weekday!), hour: hour!, minute: minute!, offset };
}

/** `HH:MM` on a city's clock. */
export const hhmm = (t: CityTime): string => `${pad2(t.hour)}:${pad2(t.minute)}`;

/** How many hours `tz` is behind the world's clock at `ms`: 9 for SF most of the year, 8 when the two are out of step. */
export const hoursBehind = (tz: string, ms: number): number =>
  (cityTime(WORLD_TZ, ms).offset - cityTime(tz, ms).offset) / 60;

const isWorkday = (weekday: number) => weekday >= 1 && weekday <= 5;

/** Whether it's US working hours in SF at `ms`: a weekday, 09:00 to 17:00 there. */
export function inLaunchWindow(ms: number): boolean {
  const t = cityTime(SF.tz, ms);
  const m = t.hour * 60 + t.minute;
  return isWorkday(t.weekday) && m >= LAUNCH_WINDOW.from && m < LAUNCH_WINDOW.to;
}

/** The instant a wall time in `tz` happens (none of ours falls in a daylight saving gap). */
function wallToMs(tz: string, y: number, m: number, d: number, hour: number, minute: number): number {
  const guess = Date.UTC(y, m - 1, d, hour, minute);
  // Off by the zone's offset there; a second round covers a switch between the guess and the answer.
  const first = guess - cityTime(tz, guess).offset * 60_000;
  return guess - cityTime(tz, first).offset * 60_000;
}

/** When the launch window next opens after `ms` (09:00 on SF's next weekday). */
export function nextWindow(ms: number): number {
  const sf = cityTime(SF.tz, ms);
  for (let i = 0; ; i++) {
    const day = new Date(Date.UTC(sf.y, sf.m - 1, sf.d + i));
    if (!isWorkday(day.getUTCDay())) continue;
    const at = wallToMs(
      SF.tz,
      day.getUTCFullYear(),
      day.getUTCMonth() + 1,
      day.getUTCDate(),
      LAUNCH_WINDOW.from / 60,
      LAUNCH_WINDOW.from % 60,
    );
    if (at > ms) return at;
  }
}

/** When `at` is from Copenhagen's `now`: "" the same day, " tomorrow", or " on Monday". */
function whenHere(now: number, at: number): string {
  const day = (t: CityTime) => Date.UTC(t.y, t.m - 1, t.d) / 86_400_000;
  const a = cityTime(WORLD_TZ, now);
  const b = cityTime(WORLD_TZ, at);
  const days = day(b) - day(a);
  if (days === 0) return "";
  if (days === 1) return " tomorrow";
  return ` on ${new Intl.DateTimeFormat("en-US", { weekday: "long", timeZone: WORLD_TZ }).format(at)}`;
}

/** What E on the clocks says at `ms`: the three times, and whether US launches tend to land now or when they will. */
export function clocksLine(ms: number): string {
  const times = CLOCKS.map((c) => `${c.city} ${hhmm(cityTime(c.tz, ms))}`).join(", ");
  const sf = hhmm(cityTime(SF.tz, ms));
  const behind = hoursBehind(SF.tz, ms);
  // The usual gap is 9 hours; any other means one side has changed its clocks and the other hasn't yet.
  const gap =
    behind === 9
      ? ""
      : ` SF is ${behind} hours behind this week, not 9: the US and Europe change their clocks on different Sundays.`;
  if (inLaunchWindow(ms))
    return `🕘 ${times}. It's ${sf} in SF: launches tend to land now. Keep an eye on the launch stand in the square.${gap}`;
  const next = nextWindow(ms);
  const opens = `${hhmm(cityTime(WORLD_TZ, next))}${whenHere(ms, next)}`;
  return `🕘 ${times}. It's ${sf} in SF. US launches tend to land in SF's working hours: the next window opens at ${opens}, Copenhagen time.${gap}`;
}
