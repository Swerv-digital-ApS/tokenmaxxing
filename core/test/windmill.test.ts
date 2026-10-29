import { expect, test } from "bun:test";
import { LEGEND, MAPS, plotId, townMap } from "../src/maps.ts";
import { CALM, presetWeather } from "../src/sky.ts";
import { millSays, newMill, SAILS, sailRps, turnMill, WINDMILL } from "../src/windmill.ts";

const wind = (windMs: number, windDir = 270) => ({ windMs, windDir });

/** Runs `mill` for `seconds` of `w` in 60 fps frames. */
const run = (mill: ReturnType<typeof newMill>, w: ReturnType<typeof wind>, seconds: number) => {
  for (let i = 0; i < seconds * 60; i++) turnMill(mill, w, 1 / 60);
  return mill;
};

test("calm air leaves the sails still, a breeze turns them in step, a storm hits the cap", () => {
  expect(sailRps(0)).toBe(0);
  expect(sailRps(CALM.windMs)).toBe(0);
  expect(sailRps(SAILS.cutIn - 0.1)).toBe(0);
  expect(sailRps(SAILS.cutIn)).toBeGreaterThan(0);
  expect(sailRps(10)).toBeCloseTo(sailRps(5) * 2, 10);
  expect(sailRps(presetWeather("storm")!.windMs)).toBe(SAILS.maxRps);
  expect(sailRps(40)).toBe(SAILS.maxRps);
  expect(sailRps(presetWeather("rain")!.windMs)).toBeLessThan(sailRps(presetWeather("storm")!.windMs));
});

test("the sails spin up and wind down gradually, and come to rest in calm air", () => {
  const mill = newMill(wind(0));
  expect(mill.rps).toBe(0);
  run(mill, wind(14), 1);
  expect(mill.rps).toBeGreaterThan(0);
  expect(mill.rps).toBeLessThan(SAILS.maxRps / 2);
  run(mill, wind(14), 30);
  expect(mill.rps).toBeCloseTo(SAILS.maxRps, 3);
  expect(mill.turn).toBeGreaterThanOrEqual(0);
  expect(mill.turn).toBeLessThan(1);
  run(mill, wind(1), 60);
  expect(mill.rps).toBe(0);
  const turn = mill.turn;
  run(mill, wind(1), 5);
  expect(mill.turn).toBe(turn);
});

test("a page that opens in a gale finds the mill already turning, into the wind", () => {
  const mill = newMill(wind(20, 200));
  expect(mill.rps).toBe(SAILS.maxRps);
  expect(mill.facing).toBe(200);
});

test("the cap winds round the shorter way, never past the wind", () => {
  const mill = newMill(wind(5, 350));
  run(mill, wind(5, 10), 1);
  expect(mill.facing).toBeCloseTo(5, 5);
  run(mill, wind(5, 10), 10);
  expect(mill.facing).toBeCloseTo(10, 5);
  // From the east to the west is half a turn either way: it takes 180 / winding seconds, and stops there.
  const back = newMill(wind(5, 90));
  run(back, wind(5, 270), 180 / SAILS.winding + 5);
  expect(back.facing).toBeCloseTo(270, 5);
  const west = newMill(wind(5, 270));
  run(west, wind(5, 300), 0.5);
  expect(west.facing).toBeCloseTo(270 + SAILS.winding / 2, 5);
});

test("E on the windmill tells the wind and how the sails take it", () => {
  expect(millSays(wind(1.5, 270))).toBe(
    "🌬 The windmill stands still: 1.5 m/s over Aarhus, and its sails need 2 to turn.",
  );
  expect(millSays(wind(5, 225))).toBe(
    "🌬 The wind over Aarhus is 5 m/s from the SW: the sails turn 15 times a minute.",
  );
  expect(millSays(wind(18, 250))).toContain("flat out at 42 turns a minute");
});

test("the windmill stands on 2×2 tiles beside the Tavern, in every town, and nobody walks through it", () => {
  expect(LEGEND[WINDMILL]?.walk).toBeUndefined();
  for (const town of [MAPS.town, townMap([]), townMap([plotId(2, 1), plotId(-1, 0)])]) {
    const tiles = town.find(WINDMILL);
    expect(tiles).toEqual([
      [18, 15],
      [19, 15],
      [18, 16],
      [19, 16],
    ]);
    for (const [x, y] of tiles) expect(town.walkable(x, y)).toBe(false);
    // The Tavern's door and the path in front of it stay clear.
    const [ix, iy] = town.find("I")[0]!;
    expect(town.walkable(ix, iy + 1)).toBe(true);
  }
});
