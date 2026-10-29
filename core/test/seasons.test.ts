import { describe, expect, test } from "bun:test";
import {
  lookKey,
  pinnedDay,
  type SeasonLook,
  seasonAt,
  seasonLook,
  townDay,
  yearDay,
} from "../src/seasons.ts";

/** The look at noon on a date in Aarhus. */
const on = (date: string): SeasonLook => seasonLook(yearDay(Date.parse(`${date}T11:00:00Z`)));
const PARTS = ["leaf", "turn", "blossom", "fresh", "falling", "litter", "dormant"] as const;

describe("seasons", () => {
  test("seasons follow the Aarhus calendar, including October in fall", () => {
    expect(seasonAt(Date.parse("2026-03-01T12:00:00Z"))).toBe("spring");
    expect(seasonAt(Date.parse("2026-06-01T12:00:00Z"))).toBe("summer");
    expect(seasonAt(Date.parse("2026-10-27T12:00:00Z"))).toBe("fall");
    expect(seasonAt(Date.parse("2026-12-01T12:00:00Z"))).toBe("winter");
    expect(seasonAt(Date.parse("2026-08-31T22:30:00Z"))).toBe("fall");
  });

  test("late October: the trees have turned, and their leaves are coming down", () => {
    const l = on("2026-10-27");
    expect(l.turn).toBeGreaterThan(0.85);
    expect(l.falling).toBeGreaterThan(0.8);
    expect(l.leaf).toBeGreaterThan(0.3);
    expect(l.leaf).toBeLessThan(0.85);
  });

  test("bare in winter, blossom and fresh green in spring, full green in summer", () => {
    const winter = on("2027-01-20");
    expect(winter.leaf).toBe(0);
    expect(winter.falling).toBe(0);
    expect(winter.dormant).toBe(1);
    const spring = on("2027-04-27");
    expect(spring.blossom).toBeGreaterThan(0.9);
    expect(spring.fresh).toBeGreaterThan(0.9);
    const summer = on("2027-07-15");
    expect(summer).toEqual({ leaf: 1, turn: 0, blossom: 0, fresh: 0, falling: 0, litter: 0, dormant: 0 });
  });

  test("it changes over weeks, never overnight, round the whole year and over New Year", () => {
    let last = on("2026-01-01");
    for (let day = 1; day <= 366; day++) {
      const next = on(new Date(Date.UTC(2026, 0, 1 + day)).toISOString().slice(0, 10));
      for (const k of PARTS) expect(Math.abs(next[k] - last[k])).toBeLessThan(0.1);
      last = next;
    }
  });

  test("while the trees turn, what is baked changes every few days, not every day", () => {
    let changes = 0;
    let last = lookKey(on("2026-10-01"));
    for (let day = 1; day < 61; day++) {
      const key = lookKey(on(new Date(Date.UTC(2026, 9, 1 + day)).toISOString().slice(0, 10)));
      if (key !== last) changes++;
      last = key;
    }
    expect(changes).toBeGreaterThan(5);
    expect(changes).toBeLessThan(45);
  });

  test("29 February is a day like 1 March", () => {
    expect(Math.floor(yearDay(Date.parse("2028-02-29T11:00:00Z")))).toBe(59);
    expect(Math.floor(yearDay(Date.parse("2028-03-01T11:00:00Z")))).toBe(59);
  });

  test("pins: a season's name or a date, keeping the time of day", () => {
    expect(pinnedDay("autumn")).toBe(pinnedDay("fall"));
    expect(pinnedDay("Winter")).toBe(14);
    expect(pinnedDay("11-12")).toBe(315);
    for (const bad of ["", "monsoon", "13-01", "1-1", "2026-10-27"]) expect(pinnedDay(bad)).toBeNull();
    const noon = Date.parse("2026-10-27T11:00:00Z");
    expect(townDay(noon, 14)).toBeCloseTo(14.5, 5);
    expect(townDay(noon, null)).toBeCloseTo(yearDay(noon), 5);
    expect(seasonLook(pinnedDay("winter")!).leaf).toBe(0);
  });
});
