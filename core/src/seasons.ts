/**
 * The seasons in town, on the Aarhus calendar: pure and clock-driven like `street.ts`, so every client sees the
 * same trees with no server state. The year is a set of keyframes (blossom in late April, the leaves turning in
 * October and falling into November, bare branches all winter), and a day between two of them is a smooth blend,
 * so the town changes over weeks instead of on the 1st of a month.
 */
import { clamp, lerp } from "hanzio";
import { worldWall } from "./range.ts";

export type Season = "spring" | "summer" | "fall" | "winter";

/** Days before the 1st of each month in a common year: the calendar the keyframes are on. */
const MONTH_START = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
const YEAR_DAYS = 365;

/** `MM-DD` as days since 1 January (0..364) in a common year; null for anything else. */
function monthDay(text: string): number | null {
  const m = /^(\d{2})-(\d{2})$/.exec(text);
  if (!m) return null;
  const [month, day] = [Number(m[1]), Number(m[2])];
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return Math.min(MONTH_START[month - 1]! + day - 1, (MONTH_START[month] ?? YEAR_DAYS) - 1);
}

/** Days since 1 January on the Aarhus clock, the time of day as a fraction (0 to 365; 29 February counts as 1 March). */
export function yearDay(ms: number): number {
  const { m, d, hour, minute } = worldWall(ms);
  const leapDay = m === 2 && d === 29;
  return MONTH_START[leapDay ? 2 : m - 1]! + (leapDay ? 0 : d - 1) + (hour * 60 + minute) / 1440;
}

/** Meteorological seasons on the town's Aarhus calendar. */
export const seasonOfDay = (day: number): Season =>
  day < MONTH_START[2]!
    ? "winter"
    : day < MONTH_START[5]!
      ? "spring"
      : day < MONTH_START[8]!
        ? "summer"
        : day < MONTH_START[11]!
          ? "fall"
          : "winter";

export const seasonAt = (at: number): Season => seasonOfDay(yearDay(at));

// MARK: The look

/** How the town's plants look on a day: each 0..1, every one blending smoothly between the keyframes. */
export interface SeasonLook {
  /** How much of a broadleaf tree's canopy is on it: 1 in full leaf, 0 bare branches. */
  leaf: number;
  /** How far the leaves that are left have turned from green to orange, yellow and red. */
  turn: number;
  /** Blossom on the cherry and apple trees. */
  blossom: number;
  /** The light, fresh green of new leaves and spring grass. */
  fresh: number;
  /** How many leaves are coming down right now: 1 at the peak of the fall. */
  falling: number;
  /** Fallen leaves lying on the grass. */
  litter: number;
  /** Winter rest: dull grass, the flower meadows gone to green. */
  dormant: number;
}

type Keyframe = readonly [date: string, look: SeasonLook];
const look = (
  leaf: number,
  turn: number,
  blossom: number,
  fresh: number,
  falling: number,
  litter: number,
  dormant: number,
): SeasonLook => ({ leaf, turn, blossom, fresh, falling, litter, dormant });

/**
 * A Danish year, roughly as it goes: buds in early April, cherry and apple blossom at the end of the month, beech
 * green by mid-May; the first trees turning late in September, the most colour and the most falling at the end
 * of October, bare by the end of November. The year wraps: 31 December blends into the first keyframe.
 */
const KEYFRAMES: readonly Keyframe[] = [
  ["01-01", look(0, 0, 0, 0, 0, 0, 1)],
  ["03-10", look(0, 0, 0, 0, 0, 0, 1)],
  ["04-05", look(0.15, 0, 0.3, 0.6, 0, 0, 0.4)],
  ["04-25", look(0.6, 0, 1, 1, 0, 0, 0)],
  ["05-12", look(1, 0, 0.5, 1, 0, 0, 0)],
  ["05-30", look(1, 0, 0, 0.5, 0, 0, 0)],
  ["06-20", look(1, 0, 0, 0, 0, 0, 0)],
  ["09-15", look(1, 0, 0, 0, 0, 0, 0)],
  ["10-01", look(1, 0.35, 0, 0, 0.15, 0.1, 0)],
  ["10-20", look(0.85, 0.85, 0, 0, 0.7, 0.5, 0)],
  ["11-01", look(0.55, 1, 0, 0, 1, 0.9, 0.2)],
  ["11-15", look(0.2, 1, 0, 0, 0.6, 1, 0.5)],
  ["11-30", look(0, 1, 0, 0, 0.1, 0.7, 0.9)],
  ["12-20", look(0, 0, 0, 0, 0, 0.2, 1)],
];
const FRAMES = KEYFRAMES.map(([date, l]) => [monthDay(date)!, l] as const);
const KEYS = Object.keys(KEYFRAMES[0]![1]) as (keyof SeasonLook)[];
const smooth = (t: number) => t * t * (3 - 2 * t);

/** The look on `day` (days since 1 January, as `yearDay` counts them). */
export function seasonLook(day: number): SeasonLook {
  const d = ((day % YEAR_DAYS) + YEAR_DAYS) % YEAR_DAYS;
  let i = FRAMES.length - 1;
  while (i > 0 && FRAMES[i]![0] > d) i--;
  const [from, a] = FRAMES[i]!;
  const [next, b] = FRAMES[(i + 1) % FRAMES.length]!;
  const span = (next - from + YEAR_DAYS) % YEAR_DAYS || YEAR_DAYS;
  const t = smooth(clamp((d - from) / span, 0, 1));
  return Object.fromEntries(KEYS.map((k) => [k, lerp(a[k], b[k], t)])) as unknown as SeasonLook;
}

/**
 * The look rounded to eighths, as a string: what a baked picture of it depends on. It changes every few days
 * while the town is turning, so the 2D sprites and the 3D town are made again then, and not every frame.
 */
export const lookKey = (l: SeasonLook): string =>
  KEYS.filter((k) => k !== "falling")
    .map((k) => Math.round(l[k] * 8))
    .join("");

/** The look rounded as `lookKey` rounds it: what is baked, so a tree drawn for the key is the same every time. */
export const bakedLook = (l: SeasonLook): SeasonLook =>
  Object.fromEntries(KEYS.map((k) => [k, Math.round(l[k] * 8) / 8])) as unknown as SeasonLook;

// MARK: Pinning

/** A day in each season that shows it best: blossom, full summer, peak colour with leaves falling, bare branches. */
const PINS: Record<string, string> = {
  spring: "04-28",
  summer: "07-10",
  fall: "10-27",
  autumn: "10-27",
  winter: "01-15",
};

/**
 * The day a pin means, for `SKY_SEASON=autumn` and `?season=autumn` (dev and screenshots): a season's name, or a
 * date as `MM-DD` for a stage in between (`11-12`, half bare). Null if it isn't one.
 */
export function pinnedDay(pin: string): number | null {
  const text = pin.trim().toLowerCase();
  return monthDay(PINS[text] ?? text);
}

/** The day of the year the town shows at `ms`: the pinned one if there is a pin (at `ms`'s time of day). */
export const townDay = (ms: number, pin: number | null): number =>
  pin === null ? yearDay(ms) : pin + (yearDay(ms) % 1);
