import { describe, expect, test } from "bun:test";
import {
  breathShows,
  clockTime,
  copenhagenToMs,
  fogOf,
  iceOver,
  isWinter,
  lightAt,
  moonPhase,
  nightDepth,
  PRESET_NAMES,
  pollenFrom,
  pollenLevel,
  presetWeather,
  SNEEZE_MS,
  sameWeather,
  scarvesOn,
  sneezeAt,
  snowCover,
  sunTimes,
  WINTER_MONTHS,
  weatherFrom,
  winterSnow,
} from "../src/sky.ts";

const mins = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3));

describe("sun", () => {
  test("midsummer and midwinter sunrise and sunset in local time", () => {
    const summer = sunTimes(Date.UTC(2026, 5, 21, 10));
    expect(Math.abs(mins(clockTime(summer.sunrise)) - mins("04:31"))).toBeLessThanOrEqual(3);
    expect(Math.abs(mins(clockTime(summer.sunset)) - mins("22:10"))).toBeLessThanOrEqual(3);
    const winter = sunTimes(Date.UTC(2026, 11, 21, 10));
    expect(Math.abs(mins(clockTime(winter.sunrise)) - mins("08:49"))).toBeLessThanOrEqual(3);
    expect(Math.abs(mins(clockTime(winter.sunset)) - mins("15:44"))).toBeLessThanOrEqual(3);
  });

  test("the clock follows daylight saving", () => {
    expect(clockTime(Date.UTC(2026, 6, 1, 10, 0))).toBe("12:00");
    expect(clockTime(Date.UTC(2026, 0, 1, 10, 0))).toBe("11:00");
  });

  test("midsummer nights stay twilight blue, and winter's get fully dark", () => {
    // Around 01:20 in Aarhus the sun is at its lowest: about ten degrees down in June, over fifty in December.
    expect(lightAt(Date.UTC(2026, 5, 20, 23, 20)).darkness).toBeLessThan(0.8);
    expect(lightAt(Date.UTC(2026, 11, 20, 23, 20)).darkness).toBe(1);
    expect(nightDepth(Date.UTC(2026, 9, 27))).toBe(1);
    // The light nights come and go over weeks.
    let last = nightDepth(Date.UTC(2026, 3, 1));
    for (let day = 1; day < 200; day++) {
      const d = nightDepth(Date.UTC(2026, 3, 1 + day));
      expect(Math.abs(d - last)).toBeLessThan(0.03);
      last = d;
    }
  });

  test("phases and a smooth darkness", () => {
    const { sunrise, sunset } = sunTimes(Date.UTC(2026, 9, 21, 10));
    expect(lightAt(Date.UTC(2026, 9, 21, 10)).phase).toBe("day");
    expect(lightAt(Date.UTC(2026, 9, 21, 10)).darkness).toBe(0);
    expect(lightAt(Date.UTC(2026, 9, 21, 22)).phase).toBe("night");
    expect(lightAt(Date.UTC(2026, 9, 21, 22)).darkness).toBe(1);
    expect(lightAt(sunrise - 20 * 60_000).phase).toBe("dawn");
    expect(lightAt(sunset + 20 * 60_000).phase).toBe("dusk");
    let last = 0;
    for (let t = sunset - 3_600_000; t < sunset + 3 * 3_600_000; t += 300_000) {
      const d = lightAt(t).darkness;
      expect(d).toBeGreaterThanOrEqual(last);
      expect(d - last).toBeLessThan(0.2);
      last = d;
    }
  });
});

describe("moon", () => {
  test("known phases", () => {
    expect(moonPhase(Date.UTC(2026, 0, 18, 19, 52)).name).toBe("new moon"); // new moon 2026-01-18
    expect(moonPhase(Date.UTC(2026, 0, 3, 10, 3)).lit).toBeGreaterThan(0.97); // full moon 2026-01-03
    expect(moonPhase(Date.UTC(2026, 0, 3, 10, 3)).name).toBe("full moon");
  });
});

describe("weather", () => {
  const cur = (weather_code: number, extra = {}) => ({
    weather_code,
    precipitation: 0,
    cloud_cover: 50,
    wind_speed_10m: 5.04,
    wind_direction_10m: 365,
    ...extra,
  });

  test("maps WMO codes to kinds", () => {
    const kind = (code: number) => weatherFrom(cur(code))?.kind;
    expect([0, 1, 2, 3, 45, 48, 51, 55, 61, 65, 71, 75, 80, 95, 99].map(kind)).toEqual([
      "clear",
      "clear",
      "cloudy",
      "cloudy",
      "fog",
      "fog",
      "drizzle",
      "drizzle",
      "rain",
      "rain",
      "snow",
      "snow",
      "rain",
      "storm",
      "storm",
    ]);
    expect(kind(1234)).toBe("clear");
  });

  test("wind, cloud and intensity are tidied", () => {
    const w = weatherFrom(cur(63, { precipitation: 2 }))!;
    expect(w.windMs).toBe(5);
    expect(w.windDir).toBe(5);
    expect(w.cloud).toBe(0.6); // rain implies cloud
    expect(w.intensity).toBeGreaterThan(0.5);
    expect(w.intensity).toBeLessThanOrEqual(1);
    expect(weatherFrom(cur(0))?.intensity).toBe(0);
  });

  test("garbage is refused", () => {
    expect(weatherFrom(null)).toBeNull();
    expect(weatherFrom({ weather_code: "rain" })).toBeNull();
  });

  test("presets", () => {
    expect(presetWeather("storm")?.kind).toBe("storm");
    expect(presetWeather("lava")).toBeNull();
    expect(PRESET_NAMES).toContain("frost");
    expect(PRESET_NAMES).toContain("pollen");
  });

  test("temperature and visibility are read, with calm defaults when missing", () => {
    const w = weatherFrom(cur(3, { temperature_2m: -3.04, visibility: 24_140 }))!;
    expect(w.tempC).toBe(-3);
    expect(w.visibilityM).toBe(24_140);
    expect(w.pollen).toBe(0);
    const bare = weatherFrom(cur(3))!;
    expect(bare.tempC).toBeGreaterThan(7);
    expect(bare.visibilityM).toBeGreaterThan(10_000);
  });

  test("a clear or cloudy code under a kilometre of visibility is fog; rain stays rain", () => {
    const mist = weatherFrom(cur(2, { visibility: 300 }))!;
    expect(mist.kind).toBe("fog");
    expect(mist.intensity).toBeGreaterThan(0.6);
    expect(weatherFrom(cur(2, { visibility: 2_000 }))?.kind).toBe("cloudy");
    expect(weatherFrom(cur(63, { visibility: 300 }))?.kind).toBe("rain");
  });

  test("fog thickens as the visibility drops", () => {
    const at = (visibilityM: number) => fogOf({ ...presetWeather("rain")!, visibilityM });
    expect(at(20_000)).toBe(0);
    expect(at(5_000)).toBe(0);
    expect(at(2_000)).toBeGreaterThan(0);
    expect(at(2_000)).toBeLessThan(at(500));
    expect(at(100)).toBe(1);
    // A fog code is fog however far the model says you can see.
    expect(fogOf({ ...presetWeather("fog")!, visibilityM: 20_000 })).toBe(0.8);
  });

  test("cold: breath, then scarves, then ice", () => {
    const at = (tempC: number) => ({ ...presetWeather("clear")!, tempC });
    expect([breathShows(at(12)), scarvesOn(at(12)), iceOver(at(12))]).toEqual([false, false, false]);
    expect([breathShows(at(6)), scarvesOn(at(6)), iceOver(at(6))]).toEqual([true, false, false]);
    expect([breathShows(at(2)), scarvesOn(at(2)), iceOver(at(2))]).toEqual([true, true, false]);
    expect([breathShows(at(-1)), scarvesOn(at(-1)), iceOver(at(-1))]).toEqual([true, true, true]);
    expect(iceOver(presetWeather("frost")!)).toBe(true);
  });

  test("the new fields count as a change", () => {
    const w = presetWeather("clear")!;
    expect(sameWeather(w, { ...w })).toBe(true);
    expect(sameWeather(w, { ...w, tempC: w.tempC - 1 })).toBe(false);
    expect(sameWeather(w, { ...w, visibilityM: 200 })).toBe(false);
    expect(sameWeather(w, { ...w, pollen: 1 })).toBe(false);
  });
});

describe("pollen", () => {
  test("the worst pollen against its own high mark", () => {
    expect(pollenFrom({ birch_pollen: 50, grass_pollen: 10 })).toBe(0.5);
    expect(pollenFrom({ birch_pollen: 50, grass_pollen: 100 })).toBe(2);
    expect(pollenFrom({ alder_pollen: 0, birch_pollen: 0 })).toBe(0);
    expect(pollenFrom({ grass_pollen: 1e6 })).toBe(5);
  });

  test("no counts at all is nothing to go on", () => {
    expect(pollenFrom(null)).toBeNull();
    expect(pollenFrom({})).toBeNull();
    expect(pollenFrom({ birch_pollen: null, grass_pollen: "high" })).toBeNull();
  });

  test("levels", () => {
    expect([0, 0.2, 0.6, 1, 3].map(pollenLevel)).toEqual(["none", "low", "moderate", "high", "high"]);
  });

  test("sneezes: only when it's high, the same for everyone, now and then", () => {
    const day = Date.UTC(2026, 4, 10, 10);
    const sneezing = (id: number, pollen: number) => {
      let n = 0;
      for (let ms = day; ms < day + 3_600_000; ms += 100) if (sneezeAt(id, ms, pollen) !== null) n++;
      return (n * 100) / SNEEZE_MS;
    };
    expect(sneezing(7, 0.9)).toBe(0);
    // About one sneeze in every 20 s slot that comes up: 180 slots an hour.
    const high = sneezing(7, 1);
    expect(high).toBeGreaterThan(3);
    expect(high).toBeLessThan(40);
    expect(sneezing(7, 3)).toBeGreaterThan(high);
    expect(sneezeAt(7, day + 1234, 3)).toBe(sneezeAt(7, day + 1234, 3));
    // People sneeze at their own times.
    const at = (id: number) =>
      Array.from({ length: 600 }, (_, i) => sneezeAt(id, day + i * 1_000, 3) !== null).join();
    expect(at(1)).not.toBe(at(2));
  });
});

describe("copenhagenToMs", () => {
  test("reads wall time with the right offset", () => {
    expect(copenhagenToMs("2026-10-21T22:30")).toBe(Date.UTC(2026, 9, 21, 20, 30));
    expect(copenhagenToMs("2026-12-21T08:00")).toBe(Date.UTC(2026, 11, 21, 7, 0));
    expect(copenhagenToMs("soon")).toBeNull();
  });
});

describe("winter snow", () => {
  const jan = Date.UTC(2026, 0, 15, 11);
  const jul = Date.UTC(2026, 6, 15, 11);
  const w = (k: string) => presetWeather(k)!;

  test("winter is December to February on the Copenhagen calendar", () => {
    expect(WINTER_MONTHS).toEqual([12, 1, 2]);
    expect(isWinter(jan)).toBe(true);
    expect(isWinter(Date.UTC(2026, 11, 1, 12))).toBe(true);
    expect(isWinter(Date.UTC(2026, 2, 1, 12))).toBe(false);
    // 23:30 UTC on 31 Jan is already 1 Feb in Copenhagen; 23:30 UTC on 28 Feb is 1 Mar.
    expect(isWinter(Date.UTC(2026, 1, 28, 23, 30))).toBe(false);
    expect(isWinter(Date.UTC(2026, 10, 30, 23, 30))).toBe(true);
  });

  test("precipitation falls as snow in winter, dry days get a light snowfall, fog stays", () => {
    for (const k of ["drizzle", "rain", "storm"]) expect(winterSnow(w(k), jan).kind).toBe("snow");
    const clear = winterSnow({ ...w("clear"), cloud: 0.05 }, jan);
    expect(clear.kind).toBe("snow");
    expect(clear.intensity).toBeLessThan(0.4);
    expect(clear.cloud).toBe(0.05);
    expect(winterSnow(w("cloudy"), jan).kind).toBe("snow");
    expect(winterSnow(w("fog"), jan).kind).toBe("fog");
    expect(winterSnow(w("snow"), jan)).toEqual(w("snow"));
  });

  test("outside winter nothing changes", () => {
    for (const k of ["clear", "rain", "storm", "snow"]) expect(winterSnow(w(k), jul)).toEqual(w(k));
  });

  test("snow cover: while it snows, and all winter", () => {
    expect(snowCover(w("snow"), jul)).toBe(true);
    expect(snowCover(w("rain"), jul)).toBe(false);
    expect(snowCover(w("fog"), jan)).toBe(true);
    expect(snowCover(w("clear"), jan)).toBe(true);
  });
});
