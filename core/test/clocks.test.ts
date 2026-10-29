import { expect, test } from "bun:test";
import {
  CLOCKS,
  cityTime,
  clocksLine,
  hhmm,
  hoursBehind,
  inLaunchWindow,
  nextWindow,
} from "../src/clocks.ts";
import { worldWall } from "../src/range.ts";

const SF = "America/Los_Angeles";
const NY = "America/New_York";
/** `HH:MM` in a city at a UTC instant. */
const at = (tz: string, ms: number) => hhmm(cityTime(tz, ms));

test("Copenhagen's clock is the world's", () => {
  expect(CLOCKS.map((c) => c.short)).toEqual(["SF", "NY", "CPH"]);
  for (const ms of [
    Date.UTC(2026, 0, 15, 12, 34),
    Date.UTC(2026, 6, 1, 23, 5),
    Date.UTC(2026, 9, 25, 0, 59),
  ]) {
    const w = worldWall(ms);
    const c = cityTime(CLOCKS[2].tz, ms);
    expect([c.y, c.m, c.d, c.weekday, c.hour, c.minute]).toEqual([
      w.y,
      w.m,
      w.d,
      w.weekday,
      w.hour,
      w.minute,
    ]);
  }
});

test("each city switches on its own date (2026: US 8 March and 1 November, EU 29 March and 25 October)", () => {
  // SF springs forward at 02:00 PST (10:00 UTC) on 8 March, and falls back at 02:00 PDT (09:00 UTC) on 1 November.
  expect(at(SF, Date.UTC(2026, 2, 8, 9, 59))).toBe("01:59");
  expect(at(SF, Date.UTC(2026, 2, 8, 10, 0))).toBe("03:00");
  expect(at(SF, Date.UTC(2026, 10, 1, 8, 59))).toBe("01:59");
  expect(at(SF, Date.UTC(2026, 10, 1, 9, 0))).toBe("01:00");
  // New York does the same at its own 02:00.
  expect(at(NY, Date.UTC(2026, 2, 8, 6, 59))).toBe("01:59");
  expect(at(NY, Date.UTC(2026, 2, 8, 7, 0))).toBe("03:00");
  // Copenhagen at 01:00 UTC on the last Sundays of March and October.
  expect(at(CLOCKS[2].tz, Date.UTC(2026, 2, 29, 0, 59))).toBe("01:59");
  expect(at(CLOCKS[2].tz, Date.UTC(2026, 2, 29, 1, 0))).toBe("03:00");
  expect(at(CLOCKS[2].tz, Date.UTC(2026, 9, 25, 0, 59))).toBe("02:59");
  expect(at(CLOCKS[2].tz, Date.UTC(2026, 9, 25, 1, 0))).toBe("02:00");
  expect(cityTime(SF, Date.UTC(2026, 0, 1)).offset).toBe(-8 * 60);
  expect(cityTime(SF, Date.UTC(2026, 6, 1)).offset).toBe(-7 * 60);
});

test("the gap to Copenhagen shrinks by an hour in the weeks the two are out of step", () => {
  const days: [number, number, number, number][] = [
    // month, day, SF behind, NY behind
    [2, 1, 9, 6],
    [2, 7, 9, 6],
    [2, 15, 8, 5],
    [2, 28, 8, 5],
    [2, 30, 9, 6],
    [9, 24, 9, 6],
    [9, 27, 8, 5],
    [9, 31, 8, 5],
    [10, 2, 9, 6],
  ];
  for (const [m, d, sf, ny] of days) {
    const ms = Date.UTC(2026, m, d, 8);
    expect([hoursBehind(SF, ms), hoursBehind(NY, ms)]).toEqual([sf, ny]);
  }
});

test("the launch window is SF's working day, and lands an hour earlier here while the US is out of step", () => {
  // Tuesday 3 November: SF is on PST, so 09:00 there is 17:00 UTC, 18:00 in Copenhagen.
  expect(inLaunchWindow(Date.UTC(2026, 10, 3, 16, 59))).toBe(false);
  expect(inLaunchWindow(Date.UTC(2026, 10, 3, 17, 0))).toBe(true);
  expect(inLaunchWindow(Date.UTC(2026, 11, 4, 0, 59))).toBe(true);
  expect(inLaunchWindow(Date.UTC(2026, 11, 4, 1, 0))).toBe(false);
  // Tuesday 27 October: Copenhagen is back on CET but SF is still on PDT, so 09:00 SF is 17:00 here.
  expect(inLaunchWindow(Date.UTC(2026, 9, 27, 15, 59))).toBe(false);
  expect(inLaunchWindow(Date.UTC(2026, 9, 27, 16, 0))).toBe(true);
  expect(worldWall(Date.UTC(2026, 9, 27, 16, 0)).hour).toBe(17);
  // The same in March, the other way round: the US has sprung forward, Europe hasn't.
  expect(inLaunchWindow(Date.UTC(2026, 2, 17, 16, 0))).toBe(true);
  expect(worldWall(Date.UTC(2026, 2, 17, 16, 0)).hour).toBe(17);
  // Weekends are shut, Friday's window runs to 17:00 SF.
  expect(inLaunchWindow(Date.UTC(2026, 9, 31, 18, 0))).toBe(false);
  expect(inLaunchWindow(Date.UTC(2026, 9, 30, 23, 59))).toBe(true);
  expect(inLaunchWindow(Date.UTC(2026, 9, 31, 0, 0))).toBe(false);
});

test("the next window is SF's next working morning, across a switch", () => {
  // Friday 30 October, after hours (PDT): Monday 2 November 09:00 PST is 17:00 UTC.
  expect(nextWindow(Date.UTC(2026, 9, 31, 1, 0))).toBe(Date.UTC(2026, 10, 2, 17, 0));
  // Monday 9 March 06:00 PDT, the day after the US sprang forward: 09:00 PDT is 16:00 UTC.
  expect(nextWindow(Date.UTC(2026, 2, 9, 13, 0))).toBe(Date.UTC(2026, 2, 9, 16, 0));
  // In the window: the next one is tomorrow's.
  expect(nextWindow(Date.UTC(2026, 9, 27, 18, 0))).toBe(Date.UTC(2026, 9, 28, 16, 0));
});

test("the line on the clocks", () => {
  const open = clocksLine(Date.UTC(2026, 10, 3, 17, 30));
  expect(open).toContain("San Francisco 09:30, New York 12:30, Copenhagen 18:30");
  expect(open).toContain("It's 09:30 in SF: launches tend to land now");
  expect(open).toContain("launch stand");
  expect(open).not.toContain("hours behind");
  // Copenhagen's lunchtime: the window opens at 18:00 the same day.
  expect(clocksLine(Date.UTC(2026, 10, 3, 11, 0))).toContain(
    "the next window opens at 18:00, Copenhagen time",
  );
  // Saturday evening: Monday. And in the odd week, the gap is called out.
  const weekend = clocksLine(Date.UTC(2026, 9, 31, 18, 0));
  expect(weekend).toContain("opens at 18:00 on Monday");
  const odd = clocksLine(Date.UTC(2026, 9, 27, 11, 0));
  expect(odd).toContain("opens at 17:00, Copenhagen time");
  expect(odd).toContain("SF is 8 hours behind this week");
  // Sunday lunchtime, after both have switched: tomorrow at 18:00.
  expect(clocksLine(Date.UTC(2026, 10, 1, 11, 0))).toContain("opens at 18:00 tomorrow, Copenhagen time");
});
