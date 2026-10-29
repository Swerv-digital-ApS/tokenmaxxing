import { describe, expect, test } from "bun:test";
import { fetchPollen, fetchWeather, pinnedSeason, pinnedWeather } from "../src/weather.ts";

const reply = (body: unknown, ok = true) =>
  (async () => ({ ok, json: async () => body })) as unknown as typeof fetch;
const down = (async () => Promise.reject(new Error("down"))) as unknown as typeof fetch;

describe("weather", () => {
  test("reads Open-Meteo's current block", async () => {
    const w = await fetchWeather(
      reply({
        current: {
          weather_code: 61,
          precipitation: 1,
          cloud_cover: 90,
          wind_speed_10m: 6,
          wind_direction_10m: 250,
          temperature_2m: -2.5,
          visibility: 800,
        },
      }),
    );
    expect(w?.kind).toBe("rain");
    expect(w?.windDir).toBe(250);
    expect(w?.tempC).toBe(-2.5);
    expect(w?.visibilityM).toBe(800);
  });

  test("asks for the temperature and visibility, and pollen from the air-quality API", async () => {
    const urls: string[] = [];
    const spy = (async (url: string) => {
      urls.push(url);
      return { ok: true, json: async () => ({}) };
    }) as unknown as typeof fetch;
    await fetchWeather(spy);
    await fetchPollen(spy);
    expect(urls[0]).toContain("temperature_2m");
    expect(urls[0]).toContain("visibility");
    expect(urls[1]).toStartWith("https://air-quality-api.open-meteo.com/");
    expect(urls[1]).toContain("birch_pollen");
  });

  test("reads the pollen", async () => {
    expect(await fetchPollen(reply({ current: { birch_pollen: 150, grass_pollen: 5 } }))).toBe(1.5);
  });

  test("failure gives null, so the last good weather (or pollen) stays", async () => {
    expect(await fetchWeather(reply({}, false))).toBeNull();
    expect(await fetchWeather(reply({ current: {} }))).toBeNull();
    expect(await fetchWeather(down)).toBeNull();
    expect(await fetchPollen(reply({}, false))).toBeNull();
    expect(await fetchPollen(reply({ current: {} }))).toBeNull();
    expect(await fetchPollen(down)).toBeNull();
  });

  test("SKY_WEATHER pins it", () => {
    expect(pinnedWeather({ SKY_WEATHER: "snow" })?.kind).toBe("snow");
    expect(pinnedWeather({ SKY_WEATHER: "frost" })?.tempC).toBeLessThan(0);
    expect(pinnedWeather({ SKY_WEATHER: "pollen" })?.pollen).toBeGreaterThanOrEqual(1);
    expect(pinnedWeather({})).toBeNull();
    expect(pinnedWeather({ SKY_WEATHER: "nope" })).toBeNull();
  });

  test("SKY_SEASON pins the town's season, by name or date", () => {
    expect(pinnedSeason({ SKY_SEASON: "autumn" })).toBe(pinnedSeason({ SKY_SEASON: "10-27" }));
    expect(pinnedSeason({ SKY_SEASON: "01-01" })).toBe(0);
    expect(pinnedSeason({})).toBeNull();
    expect(pinnedSeason({ SKY_SEASON: "monsoon" })).toBeNull();
  });
});
