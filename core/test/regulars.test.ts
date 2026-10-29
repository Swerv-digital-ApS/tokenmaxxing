import { expect, test } from "bun:test";
import {
  lastWeekOf,
  plaqueOf,
  plateText,
  REGULARS_TOP,
  rankRegulars,
  tabHours,
  tabLine,
} from "../src/regulars.ts";

test("last week is the Monday to Sunday before this one's", () => {
  expect(lastWeekOf("2026-10-22")).toEqual({ from: "2026-10-12", to: "2026-10-18" });
  expect(lastWeekOf("2026-10-19")).toEqual({ from: "2026-10-12", to: "2026-10-18" });
  expect(lastWeekOf("2026-10-25")).toEqual({ from: "2026-10-12", to: "2026-10-18" });
  expect(lastWeekOf("2026-01-01")).toEqual({ from: "2025-12-22", to: "2025-12-28" });
});

test("ranking: 30 minutes to count, most time first, ties to the lower id, five at most", () => {
  const rows = [
    { userId: 9, name: "i", minutes: 29 },
    { userId: 3, name: "c", minutes: 60 },
    { userId: 2, name: "b", minutes: 60 },
    ...[4, 5, 6, 7].map((n) => ({ userId: n, name: `n${n}`, minutes: 30 + n })),
  ];
  expect(rankRegulars(rows).map((r) => [r.rank, r.userId])).toEqual([
    [1, 2],
    [2, 3],
    [3, 7],
    [4, 6],
    [5, 5],
  ]);
  expect(rankRegulars([])).toEqual([]);
});

test("chalk lines show names and hours, never tokens or cost", () => {
  expect(tabLine({ name: "ada", minutes: 90 })).toEqual(["ADA", "1.5H"]);
  expect(tabLine({ name: "a-very-long-handle", minutes: 31 })).toEqual(["A-VERY", "0.5H"]);
  expect(tabHours(600)).toBe("10H");
  expect(tabHours(59)).toBe("0.9H");
});

test("five plates: the first three on the left plaque, the rest on the right", () => {
  expect(REGULARS_TOP).toBe(5);
  expect([1, 2, 3, 4, 5].map(plaqueOf)).toEqual([0, 0, 0, 1, 1]);
});

test("a plaque row says what fits of the name, in capitals", () => {
  expect(plateText({ name: "ada" })).toBe("ADA");
  expect(plateText({ name: "a-very-long-handle" })).toBe("A-V");
});
