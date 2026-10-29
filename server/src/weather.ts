import { pinnedDay } from "@tokenmaxxing/core/seasons.ts";
import {
  AARHUS,
  CALM,
  POLLEN_HIGH,
  pollenFrom,
  presetWeather,
  type Weather,
  weatherFrom,
} from "@tokenmaxxing/core/sky.ts";

/** One fetch for the whole world: 4 requests an hour. Swap the source here (`fetchWeather`) if needed. */
export const WEATHER_EVERY_MS = 15 * 60_000;
/** Pollen is counted by the hour, so it's asked for once an hour: with the weather, 5 requests an hour. */
export const POLLEN_EVERY_MS = 60 * 60_000;
const TIMEOUT_MS = 5_000;

const WEATHER_URL =
  `https://api.open-meteo.com/v1/forecast?latitude=${AARHUS.lat}&longitude=${AARHUS.lon}` +
  "&current=weather_code,precipitation,cloud_cover,wind_speed_10m,wind_direction_10m,temperature_2m,visibility" +
  "&wind_speed_unit=ms";

const POLLEN_URL =
  `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${AARHUS.lat}&longitude=${AARHUS.lon}` +
  `&current=${Object.keys(POLLEN_HIGH).join(",")}`;

/** Open-Meteo's `current` block at `url`, or null if it can't be had. */
async function current(url: string, fetcher: typeof fetch): Promise<unknown> {
  try {
    const res = await fetcher(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!res.ok) return null;
    return ((await res.json()) as { current?: unknown }).current ?? null;
  } catch {
    return null;
  }
}

/** Aarhus's weather right now from Open-Meteo (its pollen 0: see `fetchPollen`), or null if it can't be had. */
export const fetchWeather = async (fetcher: typeof fetch = fetch): Promise<Weather | null> =>
  weatherFrom(await current(WEATHER_URL, fetcher));

/** Aarhus's pollen right now from Open-Meteo's air-quality API (`Weather.pollen`), or null if it can't be had. */
export const fetchPollen = async (fetcher: typeof fetch = fetch): Promise<number | null> =>
  pollenFrom(await current(POLLEN_URL, fetcher));

/** `SKY_WEATHER=rain` pins the weather (dev and screenshots); nothing is fetched then. */
export const pinnedWeather = (env: Record<string, string | undefined> = process.env): Weather | null =>
  env.SKY_WEATHER ? presetWeather(env.SKY_WEATHER) : null;

export const initialWeather = (): Weather => pinnedWeather() ?? CALM;

/**
 * `SKY_SEASON=autumn` (or a date, `11-12`) pins the town's season for everyone (dev and screenshots), as the day of
 * the year it shows. Null normally: the season is the date's, worked out by each client.
 */
export const pinnedSeason = (env: Record<string, string | undefined> = process.env): number | null =>
  env.SKY_SEASON ? pinnedDay(env.SKY_SEASON) : null;
