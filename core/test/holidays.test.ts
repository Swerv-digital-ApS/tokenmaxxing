import { expect, test } from "bun:test";
import { dateLabel, easter, firstWeekday, HOLIDAYS, near } from "../src/holidays.ts";
import { copenhagenToMs } from "../src/sky.ts";

/** Copenhagen wall time, `YYYY-MM-DDTHH:MM`, as epoch ms. */
const cph = (at: string) => copenhagenToMs(at)!;

test("each holiday falls on its Danish date", () => {
  expect(easter(2026)).toEqual([4, 5]);
  expect(easter(2027)).toEqual([3, 28]);
  expect(easter(2038)).toEqual([4, 25]);
  expect(HOLIDAYS.fastelavn.date(2027)).toEqual([2, 7]);
  expect(HOLIDAYS.fastelavn.date(2026)).toEqual([2, 15]);
  // J-dag: the first Friday of November.
  expect(firstWeekday(2026, 11, 5)).toBe(6);
  expect(HOLIDAYS.jDag.date(2026)).toEqual([11, 6]);
  expect(HOLIDAYS.jDag.date(2030)).toEqual([11, 1]);
  expect(HOLIDAYS.halloween.date(2026)).toEqual([10, 31]);
  expect(HOLIDAYS.sanktHans.date(2027)).toEqual([6, 23]);
});

test("a window counts whole Copenhagen days, both ends included", () => {
  expect(near("halloween", cph("2026-10-31T00:00"), 0, 0)).toBe(true);
  expect(near("halloween", cph("2026-10-30T23:59"), 0, 0)).toBe(false);
  // 23:30 UTC on the 30th is already the 31st in Copenhagen (winter time, UTC+1).
  expect(near("halloween", Date.UTC(2026, 9, 30, 23, 30), 0, 0)).toBe(true);
  expect(near("halloween", cph("2026-10-24T00:00"), 7, 1)).toBe(true);
  expect(near("halloween", cph("2026-10-23T23:59"), 7, 1)).toBe(false);
  expect(near("halloween", cph("2026-11-01T23:59"), 7, 1)).toBe(true);
  expect(near("halloween", cph("2026-11-02T00:00"), 7, 1)).toBe(false);
});

test("a window may cross New Year, either way", () => {
  expect(near("newYear", cph("2027-01-01T00:30"), 0, 1)).toBe(true);
  expect(near("newYear", cph("2027-01-02T00:30"), 0, 1)).toBe(false);
  expect(near("fastelavn", cph("2026-12-30T12:00"), 50, 0)).toBe(true);
});

test("the date a window ends on, for the shop", () => {
  expect(dateLabel("halloween", cph("2026-10-20T12:00"), 2)).toBe("2 November");
  expect(dateLabel("jDag", cph("2026-11-01T12:00"))).toBe("6 November");
});
