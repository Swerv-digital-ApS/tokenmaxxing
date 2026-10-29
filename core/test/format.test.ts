import { expect, test } from "bun:test";
import {
  clock,
  countdown,
  hoursText,
  levelAt,
  levelFor,
  levelTitle,
  MAX_LEVEL,
  minutesText,
  plural,
  secondsUntil,
} from "../src/format.ts";

test("clocks, durations and plurals", () => {
  expect(clock(65_000)).toBe("1:05");
  expect(clock(3_725_000)).toBe("1:02:05");
  expect(clock(-5)).toBe("0:00");
  expect(secondsUntil(1_500, 0)).toBe(2);
  expect(secondsUntil(0, 10)).toBe(0);
  expect(hoursText(0.5)).toBe("30m");
  expect(hoursText(3 + 25 / 60)).toBe("3h 25m");
  expect(minutesText(15)).toBe("15 min");
  expect(minutesText(60)).toBe("1 hour");
  expect(minutesText(1440)).toBe("24 hours");
  expect(plural(1, "game")).toBe("1 game");
  expect(plural(2, "PR")).toBe("2 PRs");
});

test("levelAt is where levelFor ticks over, up to The Tokenmaxxer at 50", () => {
  expect(MAX_LEVEL).toBe(50);
  expect(levelAt(0)).toBe(0);
  expect(levelAt(1)).toBe(1e6);
  expect(levelAt(7)).toBe(1e9);
  expect(levelAt(10)).toBe(10e9);
  expect(levelAt(30)).toBe(30e9);
  expect(levelAt(40)).toBe(55e9);
  expect(levelAt(50)).toBe(130e9);
  expect(levelAt(51)).toBe(Infinity);
  expect(levelFor(31e9)).toBe(30);
  expect(levelFor(1e15)).toBe(50);
  expect(levelTitle(13)).toBe("Examaxxer");
  expect(levelTitle(30)).toBe("Singularity");
  expect(levelTitle(50)).toBe("The Tokenmaxxer");
  expect(levelTitle(99)).toBe("The Tokenmaxxer");
  for (let level = 1; level <= MAX_LEVEL; level++) {
    expect(levelFor(levelAt(level))).toBe(level);
    expect(levelFor(levelAt(level) - 1)).toBe(level - 1);
    expect(levelTitle(level)).not.toBe(levelTitle(level - 1));
  }
});

test("levels 1 to 30 are where they were, so nobody's level moves down", () => {
  // The table from before the cap went to 50.
  const old = [0, 1e6, 3e6, 10e6, 30e6, 100e6, 300e6, 1e9, 3e9, 6e9];
  for (let level = 0; level <= 30; level++) expect(levelAt(level)).toBe(old[level] ?? level * 1e9);
});

test("past 30 each level costs at least as much as the one before, and 50 is a long way off", () => {
  const steps = Array.from({ length: 20 }, (_, i) => levelAt(31 + i) - levelAt(30 + i));
  for (let i = 1; i < steps.length; i++) expect(steps[i]!).toBeGreaterThanOrEqual(steps[i - 1]!);
  expect(steps[0]).toBe(2e9);
  expect(steps.at(-1)).toBe(10e9);
  // A heavy day is ~600M: about 6 weeks past 30 to reach 40, then 4 months more to 50.
  expect((levelAt(40) - levelAt(30)) / 600e6).toBeCloseTo(41.7, 0);
  expect((levelAt(50) - levelAt(40)) / 600e6).toBeCloseTo(125, 0);
});

test("the raid's countdown ticks to the second, days apart", () => {
  const at = Date.UTC(2026, 9, 26, 7);
  expect(countdown(at, at - (3 * 86_400 + 4 * 3600 + 12 * 60 + 55) * 1000)).toBe("3d 04:12:55");
  expect(countdown(at, at - 61_000)).toBe("00:01:01");
  expect(countdown(at, at + 5000)).toBe("00:00:00");
});
