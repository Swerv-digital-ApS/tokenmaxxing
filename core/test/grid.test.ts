import { describe, expect, test } from "bun:test";
import {
  co2From,
  EXPENSIVE_DKK,
  GREEN_CO2,
  type Grid,
  greenBanner,
  greenByDay,
  greenCoins,
  greenHours,
  greenTokens,
  gridNow,
  HOUR_MS,
  isExpensive,
  NO_GRID,
  presetGrid,
  priceSign,
  pricesFrom,
  type Quarter,
} from "../src/grid.ts";

/** 27 October 2026, 10:00 UTC (11:00 in Copenhagen, winter time). */
const H = Date.UTC(2026, 9, 27, 10);
const MIN5 = 5 * 60_000;
/** An hour of 5-minute readings from `from`, all `g`. */
const hourOf = (from: number, g: number, n = 12) =>
  Array.from({ length: n }, (_, i) => ({ at: from + i * MIN5, g }));

describe("reading Energi Data Service", () => {
  test("CO2Emis: 5-minute readings in UTC, oldest first", () => {
    const body = {
      dataset: "CO2Emis",
      records: [
        {
          Minutes5UTC: "2026-10-27T10:45:00",
          Minutes5DK: "2026-10-27T11:45:00",
          PriceArea: "DK1",
          CO2Emission: 34,
        },
        { Minutes5UTC: "2026-10-27T10:40:00", PriceArea: "DK1", CO2Emission: 36.5 },
        { Minutes5UTC: "nonsense", CO2Emission: 1 },
        { Minutes5UTC: "2026-10-27T10:35:00", CO2Emission: null },
      ],
    };
    expect(co2From(body)).toEqual([
      { at: Date.UTC(2026, 9, 27, 10, 40), g: 36.5 },
      { at: Date.UTC(2026, 9, 27, 10, 45), g: 34 },
    ]);
    expect(co2From({ error: "down" })).toBeNull();
    expect(co2From(null)).toBeNull();
  });

  test("DayAheadPrices: quarters, DKK per MWh to kroner per kWh", () => {
    const body = {
      records: [
        { TimeUTC: "2026-10-27T22:45:00", TimeDK: "2026-10-27T23:45:00", DayAheadPriceDKK: 1102.607711 },
        { TimeUTC: "2026-10-27T22:30:00", DayAheadPriceDKK: -12.4 },
      ],
    };
    expect(pricesFrom(body)).toEqual([
      { at: Date.UTC(2026, 9, 27, 22, 30), dkk: -0.012 },
      { at: Date.UTC(2026, 9, 27, 22, 45), dkk: 1.103 },
    ]);
    expect(pricesFrom({ records: "no" })).toBeNull();
  });
});

describe("green hours", () => {
  test("an hour is green when the hour before it averaged GREEN_CO2 or less", () => {
    const readings = [...hourOf(H - HOUR_MS, GREEN_CO2), ...hourOf(H, GREEN_CO2 + 1)];
    // 10:00 is green (09:00–10:00 was at the line); 11:00 isn't.
    expect(greenHours(readings)).toEqual([H]);
  });

  test("too few readings decide nothing", () => {
    expect(greenHours(hourOf(H, 10, 5))).toEqual([]);
    expect(greenHours(hourOf(H, 10, 6))).toEqual([H + HOUR_MS]);
  });

  test("the same readings, read in any order, decide the same hours", () => {
    const readings = [...hourOf(H - 2 * HOUR_MS, 40), ...hourOf(H - HOUR_MS, 140), ...hourOf(H, 20)];
    expect(greenHours([...readings].reverse())).toEqual(greenHours(readings));
    expect(greenHours(readings)).toEqual([H - HOUR_MS, H + HOUR_MS]);
  });

  test("by world day and hour: Copenhagen's clock, winter and summer", () => {
    expect(greenByDay([H, Date.UTC(2026, 6, 1, 22)])).toEqual(
      new Map([
        ["2026-10-27", [11]],
        ["2026-07-02", [0]],
      ]),
    );
  });
});

describe("expensive power", () => {
  // A day of 96 quarters at 0.80 kr, a morning bump (07:00–10:00 Copenhagen) at 1.20 and an evening peak
  // (17:00–24:00, 28 quarters: more than the top quarter of the day) at 1.60.
  const day0 = Date.UTC(2026, 9, 26, 23);
  const prices: Quarter[] = Array.from({ length: 96 }, (_, i) => {
    const at = day0 + i * 15 * 60_000;
    const hour = new Date(at).getUTCHours();
    return { at, dkk: hour >= 16 && hour < 23 ? 1.6 : hour >= 6 && hour < 9 ? 1.2 : 0.8 };
  });

  test("the day's dearest quarter, over the floor", () => {
    expect(isExpensive(prices, Date.UTC(2026, 9, 27, 17, 20))).toBe(true);
    expect(isExpensive(prices, Date.UTC(2026, 9, 27, 7))).toBe(false); // dear-ish, but under the day's 75th percentile
    expect(isExpensive(prices, Date.UTC(2026, 9, 27, 12))).toBe(false);
  });

  test("a cheap day dims nothing: under EXPENSIVE_DKK is never expensive", () => {
    const cheap = prices.map((q) => ({ ...q, dkk: q.dkk / 4 }));
    expect(Math.max(...cheap.map((q) => q.dkk))).toBeLessThan(EXPENSIVE_DKK);
    expect(cheap.some((q) => isExpensive(cheap, q.at))).toBe(false);
  });

  test("no price for the moment is never expensive", () => {
    expect(isExpensive([], H)).toBe(false);
    expect(isExpensive(prices, Date.UTC(2026, 9, 29, 17))).toBe(false);
  });
});

describe("the grid now", () => {
  const grid: Grid = {
    prices: [{ at: H, dkk: 1.42 }],
    green: [H],
    co2: { at: H - 10 * 60_000, g: 41.6 },
  };

  test("green, priced, and the latest reading rounded", () => {
    expect(gridNow(grid, H + 5 * 60_000)).toEqual({ green: true, dkk: 1.42, expensive: true, co2: 42 });
  });

  test("an hour later: not green, no price, and a reading 2 hours old is dropped", () => {
    expect(gridNow(grid, H + 2 * HOUR_MS)).toEqual({ green: false, dkk: null, expensive: false, co2: null });
  });

  test("no grid at all reads as nothing going on", () => {
    expect(gridNow(NO_GRID, H)).toEqual({ green: false, dkk: null, expensive: false, co2: null });
  });

  test("the price board and the banner", () => {
    expect(priceSign({ green: true, dkk: 0.4, expensive: false, co2: 30 })).toEqual({
      text: "⚡ 0.40 kr/kWh · 🌱 green hour",
      tone: "green",
    });
    expect(priceSign({ green: true, dkk: 1.9, expensive: true, co2: 30 }).tone).toBe("dear");
    expect(priceSign({ green: false, dkk: null, expensive: false, co2: null }).text).toBe(
      "⚡ Power price: no data",
    );
    expect(greenBanner({ green: true, dkk: null, expensive: false, co2: 30 })?.title).toBe(
      "🌱 Green hour · 30 g CO₂/kWh",
    );
    expect(greenBanner({ green: false, dkk: 1, expensive: false, co2: 30 })).toBeNull();
  });

  test("?grid= presets", () => {
    expect(gridNow(presetGrid("green", H)!, H)).toMatchObject({ green: true, expensive: false });
    expect(gridNow(presetGrid("expensive", H)!, H)).toMatchObject({ green: false, expensive: true });
    expect(gridNow(presetGrid("both", H)!, H)).toMatchObject({ green: true, expensive: true });
    expect(presetGrid("off", H)).toBe(NO_GRID);
    expect(presetGrid("", H)).toBeNull();
  });
});

describe("green coins", () => {
  test("a quarter of what the green tokens would pay on their own", () => {
    expect(greenCoins(0)).toBe(0);
    expect(greenCoins(100e6)).toBe(2);
    expect(greenCoins(600e6)).toBe(6);
    expect(greenCoins(1.5e9)).toBe(9);
  });

  test("a day's tokens in its green hours", () => {
    const hours = Array(24).fill(0);
    hours[9] = 5e6;
    hours[10] = 7e6;
    hours[11] = 11e6;
    expect(greenTokens(hours.join(","), [10, 11, 11])).toBe(18e6);
    expect(greenTokens(hours.join(","), [])).toBe(0);
    expect(greenTokens("", [10])).toBe(0);
  });
});
