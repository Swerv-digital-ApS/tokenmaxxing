/**
 * The sky over Aarhus: where the sun and moon are, and what the weather is doing. Pure maths and
 * tables, no network: the server fetches the weather (`server/src/weather.ts`), the client draws all of it.
 */
import { clamp, typedSwitch, typedSwitchGroup } from "hanzio";
import { dayKey, pad2, worldWall } from "./range.ts";

export const AARHUS = { lat: 56.1629, lon: 10.2039 } as const;

const RAD = Math.PI / 180;
const DAY_MS = 86_400_000;
const smooth = (x: number) => {
  const t = clamp(x, 0, 1);
  return t * t * (3 - 2 * t);
};

// MARK: The sun

/** Julian centuries since J2000 (NOAA's `T`). */
const centuries = (ms: number) => (ms / DAY_MS + 2440587.5 - 2451545) / 36525;

/** The sun's declination (radians) and the equation of time (minutes) at `ms`: NOAA's solar calculator. */
function solar(ms: number): { decl: number; eqTime: number } {
  const T = centuries(ms);
  const L0 = (280.46646 + T * (36000.76983 + 0.0003032 * T)) % 360;
  const M = (357.52911 + T * (35999.05029 - 0.0001537 * T)) * RAD;
  const e = 0.016708634 - T * (0.000042037 + 0.0000001267 * T);
  const C =
    Math.sin(M) * (1.914602 - T * (0.004817 + 0.000014 * T)) +
    Math.sin(2 * M) * (0.019993 - 0.000101 * T) +
    Math.sin(3 * M) * 0.000289;
  const omega = (125.04 - 1934.136 * T) * RAD;
  const lambda = (L0 + C - 0.00569 - 0.00478 * Math.sin(omega)) * RAD;
  const eps0 = 23 + (26 + (21.448 - T * (46.815 + T * (0.00059 - T * 0.001813))) / 60) / 60;
  const eps = (eps0 + 0.00256 * Math.cos(omega)) * RAD;
  const y = Math.tan(eps / 2) ** 2;
  const l0 = L0 * RAD;
  const eqTime =
    4 *
    (180 / Math.PI) *
    (y * Math.sin(2 * l0) -
      2 * e * Math.sin(M) +
      4 * e * y * Math.sin(M) * Math.cos(2 * l0) -
      0.5 * y * y * Math.sin(4 * l0) -
      1.25 * e * e * Math.sin(2 * M));
  return { decl: Math.asin(Math.sin(eps) * Math.sin(lambda)), eqTime };
}

/** The sun's height above the horizon in degrees (negative below), and whether it's still morning. */
function sunElevation(
  ms: number,
  lat = AARHUS.lat,
  lon = AARHUS.lon,
): { elevation: number; morning: boolean } {
  const { decl, eqTime } = solar(ms);
  const utcMin = (((ms / 60_000) % 1440) + 1440) % 1440;
  const hourAngle = ((((utcMin + eqTime + 4 * lon) % 1440) + 1440) % 1440) / 4 - 180;
  const sin =
    Math.sin(lat * RAD) * Math.sin(decl) + Math.cos(lat * RAD) * Math.cos(decl) * Math.cos(hourAngle * RAD);
  return { elevation: Math.asin(clamp(sin, -1, 1)) / RAD, morning: hourAngle < 0 };
}

/** The sun's centre is 0.833° below the horizon at sunrise and sunset (refraction and its radius). */
const RISE_DEG = 90.833;

/** Sunrise and sunset (ms) on the Copenhagen day `ms` falls in. */
export function sunTimes(
  ms: number,
  lat = AARHUS.lat,
  lon = AARHUS.lon,
): { sunrise: number; sunset: number } {
  const [y, m, d] = dayKey(ms).split("-").map(Number);
  const noon = Date.UTC(y!, m! - 1, d!, 12);
  let rise = noon - 6 * 3_600_000;
  let set = noon + 6 * 3_600_000;
  // One pass at the day's own noon, then refined at the times it found.
  for (let i = 0; i < 2; i++) {
    const at = (t: number, sign: 1 | -1) => {
      const { decl, eqTime } = solar(t);
      const cosH =
        Math.cos(RISE_DEG * RAD) / (Math.cos(lat * RAD) * Math.cos(decl)) -
        Math.tan(lat * RAD) * Math.tan(decl);
      const ha = Math.acos(clamp(cosH, -1, 1)) / RAD;
      const min = 720 - 4 * (lon + sign * ha) - eqTime;
      return Date.UTC(y!, m! - 1, d!) + min * 60_000;
    };
    rise = at(rise, 1);
    set = at(set, -1);
  }
  return { sunrise: rise, sunset: set };
}

type Phase = "night" | "dawn" | "day" | "dusk";

export interface Light {
  phase: Phase;
  /** Degrees above the horizon. */
  elevation: number;
  /** 0 full daylight .. 1 full night, smooth through twilight. */
  darkness: number;
  /** 0..1, how orange the light is: peaks as the sun meets the horizon. */
  warmth: number;
}

/** Full light from this elevation up; full night from `NIGHT_DEG` down; civil twilight blends between. */
const DAY_DEG = 6;
const NIGHT_DEG = -10;

/** How much lighter than full night the shortest night stays. */
const LIGHT_NIGHT = 0.28;

/**
 * How dark the night can get on `ms`'s date, 0..1. Around midsummer the sun only dips ten degrees under Aarhus's
 * horizon, so the nights stay twilight blue (the light nights): this fades in from mid-May and out by mid-August,
 * with the depth of the sun's lowest point. From the sun's declination, so it is the same for every client.
 */
export function nightDepth(ms: number, lat = AARHUS.lat): number {
  const lowest = solar(ms).decl / RAD - (90 - lat);
  return 1 - LIGHT_NIGHT * (1 - smooth((NIGHT_DEG - lowest) / 8));
}

export function lightAt(ms: number): Light {
  const { elevation, morning } = sunElevation(ms);
  const darkness = smooth((DAY_DEG - elevation) / (DAY_DEG - NIGHT_DEG)) * nightDepth(ms);
  const warmth = smooth(1 - Math.abs(elevation - 1) / 9);
  const phase: Phase = elevation > DAY_DEG ? "day" : elevation < -6 ? "night" : morning ? "dawn" : "dusk";
  return { phase, elevation, darkness, warmth };
}

// MARK: The moon

const SYNODIC = 29.530588853;
/** A known new moon: 2000-01-06 18:14 UTC. */
const NEW_MOON = Date.UTC(2000, 0, 6, 18, 14);

const MOON_NAMES = [
  "new moon",
  "waxing crescent",
  "first quarter",
  "waxing gibbous",
  "full moon",
  "waning gibbous",
  "last quarter",
  "waning crescent",
];

/** Where the moon is in its cycle: `age` 0..1 (0 new, .5 full), the lit share and a name. */
export function moonPhase(ms: number): { age: number; lit: number; waxing: boolean; name: string } {
  const days = (ms - NEW_MOON) / DAY_MS;
  const age = (((days / SYNODIC) % 1) + 1) % 1;
  return {
    age,
    lit: (1 - Math.cos(2 * Math.PI * age)) / 2,
    waxing: age < 0.5,
    name: MOON_NAMES[Math.round(age * 8) % 8]!,
  };
}

// MARK: Time

/** `HH:MM` on the Copenhagen clock (DST-correct). */
export function clockTime(ms: number): string {
  const { hour, minute } = worldWall(ms);
  return `${pad2(hour)}:${pad2(minute)}`;
}

// MARK: Weather

export type WeatherKind = "clear" | "cloudy" | "fog" | "drizzle" | "rain" | "storm" | "snow";

/** All the weather the game knows: small enough to ride along in every snapshot. */
export interface Weather {
  kind: WeatherKind;
  /** 0..1: how hard it falls (or how thick the fog is). */
  intensity: number;
  /** Wind speed in m/s. */
  windMs: number;
  /** Degrees the wind comes from (0 north, 90 east). */
  windDir: number;
  /** Cloud cover 0..1. */
  cloud: number;
  /** Air temperature 2 m up, °C. */
  tempC: number;
  /** How far you can see, in metres. */
  visibilityM: number;
  /** The pollen in the air against what counts as high (`pollenFrom`): 1 is high, 0 is none. */
  pollen: number;
}

export const CALM: Weather = {
  kind: "clear",
  intensity: 0,
  windMs: 1.5,
  windDir: 270,
  cloud: 0.1,
  tempC: 12,
  visibilityM: 30_000,
  pollen: 0,
};

const PRESETS: Record<string, Weather> = {
  clear: CALM,
  cloudy: { ...CALM, kind: "cloudy", intensity: 0.7, windMs: 4, windDir: 250, cloud: 0.8, tempC: 10 },
  fog: {
    ...CALM,
    kind: "fog",
    intensity: 0.8,
    windMs: 1,
    windDir: 200,
    cloud: 0.9,
    tempC: 4,
    visibilityM: 150,
  },
  drizzle: {
    ...CALM,
    kind: "drizzle",
    intensity: 0.35,
    windMs: 3,
    windDir: 240,
    cloud: 0.8,
    tempC: 9,
    visibilityM: 8_000,
  },
  rain: {
    ...CALM,
    kind: "rain",
    intensity: 0.7,
    windMs: 7,
    windDir: 260,
    cloud: 0.9,
    tempC: 10,
    visibilityM: 6_000,
  },
  storm: {
    ...CALM,
    kind: "storm",
    intensity: 1,
    windMs: 14,
    windDir: 250,
    cloud: 1,
    tempC: 11,
    visibilityM: 4_000,
  },
  snow: {
    ...CALM,
    kind: "snow",
    intensity: 0.7,
    windMs: 4,
    windDir: 330,
    cloud: 0.9,
    tempC: -2,
    visibilityM: 3_000,
  },
  // Not kinds of their own: a clear day's temperature or air.
  frost: { ...CALM, windMs: 1, windDir: 60, cloud: 0.05, tempC: -6 },
  pollen: { ...CALM, windMs: 3, windDir: 220, cloud: 0.2, tempC: 21, pollen: 2.5 },
};

/** Every name `presetWeather` knows: the kinds, and `frost` and `pollen` (clear days, freezing or sneezy). */
export const PRESET_NAMES: readonly string[] = Object.keys(PRESETS);

/** Presets for `SKY_WEATHER=rain` and `?weather=rain`. */
export const presetWeather = (name: string): Weather | null =>
  Object.hasOwn(PRESETS, name) ? { ...PRESETS[name]! } : null;

/** WMO weather interpretation codes → kind and how hard (https://open-meteo.com/en/docs). */
const CODES: Record<number, [WeatherKind, number]> = {
  0: ["clear", 0],
  1: ["clear", 0],
  2: ["cloudy", 0.5],
  3: ["cloudy", 0.9],
  45: ["fog", 0.6],
  48: ["fog", 0.85],
  51: ["drizzle", 0.2],
  53: ["drizzle", 0.35],
  55: ["drizzle", 0.5],
  56: ["drizzle", 0.35],
  57: ["drizzle", 0.55],
  61: ["rain", 0.35],
  63: ["rain", 0.65],
  65: ["rain", 0.95],
  66: ["rain", 0.5],
  67: ["rain", 0.85],
  71: ["snow", 0.3],
  73: ["snow", 0.6],
  75: ["snow", 0.9],
  77: ["snow", 0.3],
  80: ["rain", 0.4],
  81: ["rain", 0.7],
  82: ["rain", 1],
  85: ["snow", 0.5],
  86: ["snow", 0.9],
  95: ["storm", 0.8],
  96: ["storm", 0.9],
  99: ["storm", 1],
};

/** Fog, by the book (WMO): you can see less than a kilometre. */
const FOG_M = 1_000;

/** 0..1 how thick fog at `visibilityM` is: none from 5 km out, all of it at 100 m or less. */
const fogAt = (visibilityM: number): number =>
  1 - clamp(Math.log(Math.max(1, visibilityM) / 100) / Math.log(50), 0, 1);

/**
 * Open-Meteo's `current` block reduced to a `Weather`; null if it isn't one. A clear or cloudy code with less
 * than a kilometre to see is fog. Pollen comes from its own fetch (`pollenFrom`), so it is 0 here.
 */
export function weatherFrom(current: unknown): Weather | null {
  const c = current as Record<string, unknown> | null;
  const num = (k: string) => (typeof c?.[k] === "number" && Number.isFinite(c[k]) ? (c[k] as number) : null);
  const code = num("weather_code");
  if (code === null) return null;
  const visibilityM = Math.round(clamp(num("visibility") ?? CALM.visibilityM, 0, 100_000));
  const coded = CODES[code] ?? ["clear", 0];
  const misty = (coded[0] === "clear" || coded[0] === "cloudy") && visibilityM < FOG_M;
  const [kind, base]: [WeatherKind, number] = misty ? ["fog", Math.max(0.4, fogAt(visibilityM))] : coded;
  const precip = num("precipitation");
  const falls = kind === "rain" || kind === "drizzle" || kind === "snow";
  // Measured rain nudges the code's guess: a "light rain" code with 3 mm an hour is not light.
  const intensity =
    falls && precip !== null && precip > 0 ? clamp((base + Math.min(1, precip / 4)) / 2, 0, 1) : base;
  const cloud = clamp((num("cloud_cover") ?? 0) / 100, 0, 1);
  return {
    kind,
    intensity: Math.round(Math.max(intensity, falls ? 0.15 : 0) * 100) / 100,
    windMs: Math.round(clamp(num("wind_speed_10m") ?? 0, 0, 40) * 10) / 10,
    windDir: ((Math.round(num("wind_direction_10m") ?? 0) % 360) + 360) % 360,
    cloud: kind === "rain" || kind === "snow" || kind === "storm" ? Math.max(cloud, 0.6) : cloud,
    tempC: Math.round(clamp(num("temperature_2m") ?? CALM.tempC, -60, 60) * 10) / 10,
    visibilityM,
    pollen: 0,
  };
}

/** 0..1 how thick the fog or mist is: a fog code's own intensity, or what the visibility says, whichever is more. */
export const fogOf = (w: Weather): number =>
  Math.max(w.kind === "fog" ? w.intensity : 0, Math.round(fogAt(w.visibilityM) * 100) / 100);

// MARK: Cold

/** People's breath shows at this temperature and below. */
export const BREATH_C = 7;
/** The town's people (the bots) put scarves on at this temperature and below. */
export const SCARF_C = 4;

export const breathShows = (w: Weather): boolean => w.tempC <= BREATH_C;
export const scarvesOn = (w: Weather): boolean => w.tempC <= SCARF_C;
/** Below freezing the pond is iced over. */
export const iceOver = (w: Weather): boolean => w.tempC < 0;

// MARK: Pollen

/**
 * Counts (grains/m³) Astma-Allergi Danmark calls high, by Open-Meteo's name for the pollen
 * (https://open-meteo.com/en/docs/air-quality-api). Olive hardly reaches Denmark, ragweed is potent.
 */
export const POLLEN_HIGH = {
  alder_pollen: 50,
  birch_pollen: 100,
  grass_pollen: 50,
  mugwort_pollen: 50,
  olive_pollen: 200,
  ragweed_pollen: 20,
} as const;

/** The worst pollen in Open-Meteo's air-quality `current` block against its high mark (0 none, 1 high, at most 5); null if it has none. */
export function pollenFrom(current: unknown): number | null {
  const c = current as Record<string, unknown> | null;
  const ratios = Object.entries(POLLEN_HIGH).flatMap(([k, high]) => {
    const v = c?.[k];
    return typeof v === "number" && Number.isFinite(v) ? [Math.max(0, v) / high] : [];
  });
  return ratios.length ? Math.round(Math.min(5, Math.max(...ratios)) * 100) / 100 : null;
}

export type PollenLevel = "none" | "low" | "moderate" | "high";

export const pollenLevel = (pollen: number): PollenLevel =>
  pollen < 0.05 ? "none" : pollen < 0.4 ? "low" : pollen < 1 ? "moderate" : "high";

/** How long a sneeze shows, and the stretch of time in which each person may sneeze once. */
export const SNEEZE_MS = 1_400;
const SNEEZE_SLOT_MS = 20_000;

/** A whole number from a person and a slot of time, spread evenly (so everyone's sneezes fall differently). */
function mix32(a: number, b: number): number {
  let h = Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(b + 0x632be5ab, 0xc2b2ae35);
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
  h = Math.imul(h ^ (h >>> 12), 0x297a2d39);
  return (h ^ (h >>> 15)) >>> 0;
}

/**
 * How far into a sneeze person `id` is at `ms` (0 to `SNEEZE_MS`), or null when they aren't sneezing. Only when
 * the pollen is high, and more often the higher it is: off the clock, so every client sees the same sneeze.
 */
export function sneezeAt(id: number, ms: number, pollen: number): number | null {
  if (pollenLevel(pollen) !== "high") return null;
  const slot = Math.floor(ms / SNEEZE_SLOT_MS);
  const roll = mix32(id, slot);
  if ((roll % 1000) / 1000 >= Math.min(0.3, 0.08 * pollen)) return null;
  const start = slot * SNEEZE_SLOT_MS + ((roll >>> 10) % (SNEEZE_SLOT_MS - SNEEZE_MS));
  const into = ms - start;
  return into >= 0 && into < SNEEZE_MS ? into : null;
}

// MARK: Winter

/**
 * Winter on the Copenhagen calendar (1 is January). In these months the town is snowy by default:
 * delete this and `winterSnow` (and its one call in `web/src/game/sky.ts`) to switch it off.
 */
export const WINTER_MONTHS: readonly number[] = [12, 1, 2];

const monthOf = (ms: number) => Number(dayKey(ms).slice(5, 7));
export const isWinter = (ms: number): boolean => WINTER_MONTHS.includes(monthOf(ms));

/**
 * What the sky shows at `ms`: in winter, rain and storms fall as snow, and a dry day gets a light, gentle
 * snowfall (its cloud cover stays, so a clear day keeps its sun). Fog stays fog. Outside winter, as it is.
 */
export function winterSnow(weather: Weather, ms: number): Weather {
  if (!isWinter(ms)) return weather;
  const snow = (intensity: number): Weather => ({ ...weather, kind: "snow", intensity });
  const { kind } = weather;
  return typedSwitch(kind, {
    ...typedSwitchGroup(kind, ["drizzle", "rain", "storm"], () =>
      snow(Math.max(0.3, weather.intensity * 0.8)),
    ),
    ...typedSwitchGroup(kind, ["clear", "cloudy"], () => snow(0.25)),
    ...typedSwitchGroup(kind, ["fog", "snow"], () => weather),
  });
}

/** Whether the ground should be white: while it snows, and all winter (fog included). */
export const snowCover = (weather: Weather, ms: number): boolean => weather.kind === "snow" || isWinter(ms);

export const sameWeather = (a: Weather, b: Weather): boolean =>
  a.kind === b.kind &&
  a.intensity === b.intensity &&
  a.windMs === b.windMs &&
  a.windDir === b.windDir &&
  a.cloud === b.cloud &&
  a.tempC === b.tempC &&
  a.visibilityM === b.visibilityM &&
  a.pollen === b.pollen;

const COMPASS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
export const compass = (deg: number): string => COMPASS[Math.round(deg / 45) % 8]!;

/** `2026-10-21T22:30` read as Copenhagen wall time → ms (for `?sky=` and tests); null if it isn't one. */
export function copenhagenToMs(text: string): number | null {
  const m = /^(\d{4})-(\d\d)-(\d\d)[T ](\d\d):(\d\d)$/.exec(text);
  if (!m) return null;
  const [y, mo, d, h, mi] = m.slice(1).map(Number) as [number, number, number, number, number];
  const guess = Date.UTC(y, mo - 1, d, h, mi);
  const shown = (ms: number) => {
    const w = worldWall(ms);
    return Date.UTC(w.y, w.m - 1, w.d, w.hour, w.minute);
  };
  // Off by the zone's offset at that moment; one more round covers the DST edge.
  const first = guess - (shown(guess) - guess);
  return first - (shown(first) - guess);
}
