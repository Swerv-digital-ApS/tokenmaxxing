import {
  type Co2Reading,
  co2From,
  ENERGI_DATA,
  GRID_AREA,
  type Grid,
  greenHours,
  HOUR_MS,
  NO_GRID,
  pricesFrom,
  type Quarter,
} from "@tokenmaxxing/core/grid.ts";

/**
 * One read for the whole world: the CO₂ readings every 15 minutes (they come every 5), the prices
 * once an hour (they change once a day, in the afternoon). 5 requests an hour.
 */
export const GRID_EVERY_MS = 15 * 60_000;
const PRICES_EVERY_MS = HOUR_MS;
const TIMEOUT_MS = 10_000;

const area = encodeURIComponent(JSON.stringify({ PriceArea: [GRID_AREA] }));
// The last 26 hours: a whole day of green hours, and the hour before its first.
const CO2_URL = `${ENERGI_DATA}/CO2Emis?start=now-PT26H&filter=${area}&columns=Minutes5UTC,CO2Emission&limit=0`;
// `StartOfDay` is Danish midnight: today's quarters and tomorrow's, once they're out.
const PRICES_URL = `${ENERGI_DATA}/DayAheadPrices?start=StartOfDay&end=StartOfDay%2BP2D&filter=${area}&columns=TimeUTC,DayAheadPriceDKK&limit=0`;

async function read<T>(
  url: string,
  parse: (b: unknown) => T | null,
  fetcher: typeof fetch,
): Promise<T | null> {
  try {
    const res = await fetcher(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    return res.ok ? parse(await res.json()) : null;
  } catch {
    return null;
  }
}

export const fetchCo2 = (fetcher: typeof fetch = fetch): Promise<Co2Reading[] | null> =>
  read(CO2_URL, co2From, fetcher);

export const fetchPrices = (fetcher: typeof fetch = fetch): Promise<Quarter[] | null> =>
  read(PRICES_URL, pricesFrom, fetcher);

/** What `world` keeps between reads: the grid, and when the prices were last read. */
export interface GridState {
  grid: Grid;
  pricesAt: number;
}

export const initialGrid = (): GridState => ({ grid: NO_GRID, pricesAt: 0 });

/**
 * The grid after a read at `now`. A read that fails keeps what it had: the prices are good all day,
 * and the green hours already worked out stay (the newest 26 hours of them). Nothing is ever made up.
 * `GRID_FEED=off` is the kill switch: no grid at all, so no banner, no bonus and lamps at full.
 */
export async function checkGrid(
  prev: GridState,
  now: number,
  fetcher: typeof fetch = fetch,
  env: Record<string, string | undefined> = process.env,
): Promise<GridState> {
  if (env.GRID_FEED?.trim().toLowerCase() === "off") return initialGrid();
  const wantPrices = now - prev.pricesAt >= PRICES_EVERY_MS;
  const [readings, prices] = await Promise.all([
    fetchCo2(fetcher),
    wantPrices ? fetchPrices(fetcher) : Promise.resolve(null),
  ]);
  const since = now - 26 * HOUR_MS;
  const green = [...new Set([...prev.grid.green, ...(readings ? greenHours(readings) : [])])]
    .filter((h) => h >= since && h <= now)
    .sort((a, b) => a - b);
  return {
    grid: {
      // A day's prices are out by the afternoon before, so yesterday's are the only ones to drop.
      prices: (prices?.length ? prices : prev.grid.prices).filter((q) => q.at >= since),
      green,
      co2: readings?.at(-1) ?? prev.grid.co2,
    },
    pricesAt: prices?.length ? now : prev.pricesAt,
  };
}
