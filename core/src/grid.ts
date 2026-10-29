/**
 * The power grid under the town: Energinet's open data for price area DK1 (west Denmark, Aarhus), from
 * Energi Data Service (`api.energidataservice.dk`, free, no key). `world` reads it every 15 minutes
 * (server/src/grid.ts) and sends everyone a `Grid`; the client works out what it means right now from
 * the clock, like the street. Two things come of it:
 * - **Green hours.** An hour is green when the grid's CO₂ intensity was low the hour before it
 *   (`GREEN_CO2`). Tokens burned in a green hour pay a small bonus (`greenCoins`), so `town` stores the
 *   green hours it is told about (`green_hours`), once each, and wallets work the bonus out from them.
 * - **Expensive power.** A quarter hour priced in the dearest part of its day (`isExpensive`) dims the
 *   street lamps. It is only drawn, so nothing about it is stored.
 */
import { sumBy } from "hanzio";
import { dayKey, worldClock } from "./range.ts";
import { legacyTokenCoins } from "./shop.ts";

export const GRID_AREA = "DK1";
export const ENERGI_DATA = "https://api.energidataservice.dk/dataset";

export const HOUR_MS = 3_600_000;
const QUARTER_MS = 15 * 60_000;

/**
 * At or under this many grams of CO₂ per kWh, an hour is green. Picked from DK1's 5-minute `CO2Emis`
 * readings over Sep–Oct 2026 (1,440 hourly means): the median hour is 97 g, the windiest tenth under
 * 46 g, the calmest tenth over 173 g. At 75 g about a third of hours are green (35%) and a typical day has
 * 7 of them, in runs that follow the wind; about one day in six has none. A fixed number, not one relative
 * to the day, because green hours pay: an hour has to be green or not as it starts, for the banner and
 * the coins to agree, and a day's own spread isn't known until it's over.
 */
export const GREEN_CO2 = 75;

/**
 * Power is expensive in a quarter hour priced at the day's 75th percentile or above (its dearest
 * quarter), and at least this many kroner per kWh. Relative to the day, since unlike CO₂ the whole day's
 * day-ahead prices are known the afternoon before, and they swing a lot from season to season (Sep–Oct
 * 2026: the 5th percentile 0.02 kr, the median 1.13 kr, the 95th 1.87 kr). The floor keeps a cheap, windy
 * day from dimming anything: with it about 23% of quarters are expensive, almost all of them in the
 * morning (06–09) and evening (17–22) peaks, when the lamps are lit.
 */
export const EXPENSIVE_DKK = 1;

/** How bright the street lamps burn while power is expensive. */
export const DIM_LAMPS = 0.45;

/** The first world day green hours pay, so wallets don't move at deploy. */
export const GREEN_FROM = "2026-10-27";

/** At least this many 5-minute readings in an hour before it says anything (12 is a full hour). */
const MIN_READINGS = 6;

/** One `CO2Emis` reading: the 5 minutes from `at` (ms), in g/kWh. */
export interface Co2Reading {
  at: number;
  g: number;
}

/** One `DayAheadPrices` quarter: the 15 minutes from `at` (ms), in kroner per kWh. */
export interface Quarter {
  at: number;
  dkk: number;
}

/** What `world` sends: everything the client needs for the grid at any moment of today. */
export interface Grid {
  /** Today's quarters (and tomorrow's, once they're out), oldest first. */
  prices: Quarter[];
  /** Hour starts (ms) of the last day that were green, oldest first. */
  green: number[];
  /** The newest CO₂ reading, if there is one. */
  co2: Co2Reading | null;
}

export const NO_GRID: Grid = { prices: [], green: [], co2: null };

const finite = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
/** Energi Data Service's times are UTC without a zone (`2026-10-27T10:45:00`). */
const utc = (v: unknown): number | null => {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(v)) return null;
  const ms = Date.parse(`${v}Z`);
  return Number.isFinite(ms) ? ms : null;
};
const recordsOf = (body: unknown): Record<string, unknown>[] | null => {
  const r = (body as { records?: unknown } | null)?.records;
  return Array.isArray(r)
    ? r.filter((x): x is Record<string, unknown> => !!x && typeof x === "object")
    : null;
};

/** A `CO2Emis` response's readings, oldest first; null if it isn't one. */
export function co2From(body: unknown): Co2Reading[] | null {
  const records = recordsOf(body);
  if (!records) return null;
  const out: Co2Reading[] = [];
  for (const r of records) {
    const at = utc(r.Minutes5UTC);
    if (at !== null && finite(r.CO2Emission) && r.CO2Emission >= 0) out.push({ at, g: r.CO2Emission });
  }
  return out.sort((a, b) => a.at - b.at);
}

/** A `DayAheadPrices` response's quarters in kroner per kWh (it gives DKK per MWh), oldest first; null if it isn't one. */
export function pricesFrom(body: unknown): Quarter[] | null {
  const records = recordsOf(body);
  if (!records) return null;
  const out: Quarter[] = [];
  for (const r of records) {
    const at = utc(r.TimeUTC);
    if (at !== null && finite(r.DayAheadPriceDKK))
      out.push({ at, dkk: Math.round(r.DayAheadPriceDKK) / 1000 });
  }
  return out.sort((a, b) => a.at - b.at);
}

export const hourStart = (ms: number): number => Math.floor(ms / HOUR_MS) * HOUR_MS;

/**
 * The green hours `readings` decide: each hour whose hour before averaged `GREEN_CO2` or less, over
 * at least `MIN_READINGS` readings. The same readings always decide the same hours, whenever they're read.
 */
export function greenHours(readings: readonly Co2Reading[]): number[] {
  const byHour = new Map<number, number[]>();
  for (const r of readings) {
    const h = hourStart(r.at);
    const had = byHour.get(h);
    if (had) had.push(r.g);
    else byHour.set(h, [r.g]);
  }
  const out: number[] = [];
  for (const [h, gs] of byHour)
    if (gs.length >= MIN_READINGS && sumBy(gs, (g) => g) / gs.length <= GREEN_CO2) out.push(h + HOUR_MS);
  return out.sort((a, b) => a - b);
}

/** Whether `at` is in a green hour. */
export const isGreen = (grid: Grid, at: number): boolean => grid.green.includes(hourStart(at));

/** The quarter `at` is in, if the prices have it. */
export const quarterAt = (prices: readonly Quarter[], at: number): Quarter | null =>
  prices.find((q) => at >= q.at && at < q.at + QUARTER_MS) ?? null;

/** Whether power is expensive at `at`: see `EXPENSIVE_DKK`. Unknown prices are never expensive. */
export function isExpensive(prices: readonly Quarter[], at: number): boolean {
  const now = quarterAt(prices, at);
  if (!now || now.dkk < EXPENSIVE_DKK) return false;
  const day = dayKey(at);
  const sorted = prices
    .filter((q) => dayKey(q.at) === day)
    .map((q) => q.dkk)
    .sort((a, b) => a - b);
  return now.dkk >= sorted[Math.floor(0.75 * (sorted.length - 1))]!;
}

/** The grid as it is at `at`: what the banner, the price board and the lamps show. */
export interface GridNow {
  green: boolean;
  /** Kroner per kWh, null when the prices are missing. */
  dkk: number | null;
  expensive: boolean;
  /** The newest CO₂ reading in g/kWh, null when there's none from the last 2 hours. */
  co2: number | null;
}

export function gridNow(grid: Grid, at: number): GridNow {
  return {
    green: isGreen(grid, at),
    dkk: quarterAt(grid.prices, at)?.dkk ?? null,
    expensive: isExpensive(grid.prices, at),
    co2: grid.co2 && at - grid.co2.at < 2 * HOUR_MS ? Math.round(grid.co2.g) : null,
  };
}

/** Where the price board hangs: the square's north-east lamp post (`L`, `PLAZA.right`, `PLAZA.top`). */
export const PRICE_LAMP = { x: 19, y: 1 } as const;

/** The price board's text, and whether it reads green, expensive or plain. */
export function priceSign(now: GridNow): { text: string; tone: "green" | "dear" | "plain" } {
  if (now.dkk === null) return { text: "⚡ Power price: no data", tone: "plain" };
  const price = `⚡ ${now.dkk.toFixed(2)} kr/kWh`;
  if (now.expensive) return { text: `${price} · dear, lamps dimmed`, tone: "dear" };
  if (now.green) return { text: `${price} · 🌱 green hour`, tone: "green" };
  return { text: price, tone: "plain" };
}

/** The green hour's banner: its headline, and the line under it. */
export function greenBanner(now: GridNow): { title: string; line: string } | null {
  if (!now.green) return null;
  return {
    title: now.co2 === null ? "🌱 Green hour" : `🌱 Green hour · ${now.co2} g CO₂/kWh`,
    line: "The grid is running clean: tokens burned this hour earn bonus coins.",
  };
}

/** `?grid=green`, `expensive`, `both` or `off`: a made-up grid for screenshots, around `at`. */
export function presetGrid(name: string, at: number): Grid | null {
  if (!["green", "expensive", "both", "off"].includes(name)) return null;
  if (name === "off") return NO_GRID;
  const green = name !== "expensive";
  const dear = name !== "green";
  const from = hourStart(at) - 12 * HOUR_MS;
  const prices = Array.from({ length: 24 * 4 }, (_, i) => ({ at: from + i * QUARTER_MS, dkk: 0.6 }));
  for (const q of prices) if (dear && Math.abs(q.at - at) < 2 * HOUR_MS) q.dkk = 1.85;
  return {
    prices,
    green: green ? [hourStart(at)] : [],
    co2: { at: hourStart(at), g: green ? 38 : 160 },
  };
}

// MARK: Coins

/**
 * What a day's green-hour tokens pay on top: a quarter of what they'd pay as a day of their own
 * (`coinsForTokens`), so 100M green tokens pay 2, 600M pay 6, 1.5B pay 9. Not part of the streak, nor
 * matched into the company wallet (like quests).
 */
export const greenCoins = (tokens: number): number => Math.floor(legacyTokenCoins(tokens) / 4);

/** World hours (0–23) `hours` (hour starts) are, by world day. */
export function greenByDay(hours: readonly number[]): Map<string, number[]> {
  const out = new Map<string, number[]>();
  for (const h of hours) {
    const day = dayKey(h);
    out.set(day, [...(out.get(day) ?? []), worldClock(h).hour]);
  }
  return out;
}

/**
 * Tokens a day burned in its green hours: `hourTokens` is the day's tokens by world hour (24
 * comma-separated numbers, as `player` reports them), `green` the world hours that were green.
 * ponytail: the night clocks go back, 02:00 comes twice and counts as one hour, green if either was.
 */
export function greenTokens(hourTokens: string, green: readonly number[]): number {
  if (!hourTokens || green.length === 0) return 0;
  const byHour = hourTokens.split(",").map((n) => Number(n) || 0);
  return sumBy([...new Set(green)], (h) => Math.max(0, byHour[h] ?? 0));
}
