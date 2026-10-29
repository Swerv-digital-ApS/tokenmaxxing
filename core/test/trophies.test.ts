import { expect, test } from "bun:test";
import { palindromeDate, SHELF_SLOTS, TROPHIES, type TrophyFacts, trophiesFor } from "../src/trophies.ts";

/** Copenhagen wall-clock time as ms (CEST, UTC+2, in summer; CET, UTC+1, in winter). */
const cph = (iso: string) => {
  const ms = Date.parse(`${iso}Z`);
  const summer = iso.slice(5, 7) >= "04" && iso.slice(5, 7) <= "10";
  return ms - (summer ? 2 : 1) * 3_600_000;
};
const hour = (iso: string, tokens: number, prompts = 0) => ({ hour: cph(iso), tokens, prompts });
const none: TrophyFacts = { hours: [], prs: [], today: "2026-10-21" };
const ids = (f: Partial<TrophyFacts>) => trophiesFor({ ...none, ...f }).map((t) => t.id);

test("every trophy has its own id", () => {
  expect(new Set(TROPHIES.map((t) => t.id)).size).toBe(TROPHIES.length);
  expect(TROPHIES.length).toBeGreaterThanOrEqual(15);
  expect(TROPHIES.length).toBeLessThanOrEqual(SHELF_SLOTS);
});

test("nothing earned from nothing", () => {
  expect(trophiesFor(none)).toEqual([]);
});

test("PR trophies go by the Copenhagen clock and say the day they were first earned", () => {
  const pr = (iso: string, hash = "ab") => ({ at: cph(iso), hash });
  expect(trophiesFor({ ...none, prs: [pr("2026-07-10T03:15:00"), pr("2026-07-01T03:59:00")] })).toEqual([
    { id: "3am", day: "2026-07-01" },
    // 10 July 2026 is a Friday, but 3 AM isn't after five.
  ]);
  expect(ids({ prs: [pr("2026-07-10T04:00:00")] })).toEqual([]);
  expect(ids({ prs: [pr("2026-07-10T17:00:00")] })).toEqual(["friday"]);
  expect(ids({ prs: [pr("2027-01-01T12:00:00"), pr("2026-12-25T12:00:00")] })).toEqual([
    "newyear",
    "holiday",
  ]);
});

test("vanity hashes", () => {
  const pr = (hash: string) => ({ at: cph("2026-07-07T12:00:00"), hash });
  expect(ids({ prs: [pr("00af")] })).toEqual(["zeros"]);
  expect(ids({ prs: [pr("12beef34")] })).toEqual(["deadbeef"]);
  expect(ids({ prs: [pr("99c0ffee00")] })).toEqual(["c0ffee"]);
  expect(ids({ prs: [pr("0a0b")] })).toEqual([]);
});

test("day totals count only once the day is over", () => {
  const today = { hours: [hour("2026-10-21T10:00:00", 12_344_321)] };
  // An hour of 12M tokens with no prompt is also an agent left to run.
  expect(ids(today)).toEqual(["million", "setforget"]);
  expect(ids({ ...today, today: "2026-10-22" })).toEqual(["million", "palintotal", "setforget"]);
  // Two hours make the day's total.
  const day = (tokens: number) => ({
    today: "2026-10-22",
    hours: [hour("2026-10-20T10:00:00", 1_000), hour("2026-10-20T11:00:00", tokens - 1_000)],
  });
  expect(ids(day(5_000_000))).toEqual(["million", "round", "exactmillion"]);
  expect(ids(day(2_000_777))).toEqual(["million", "jackpot"]);
  expect(ids(day(213_370))).toEqual(["leet"]);
});

test("hours of the day: early bird, midnight oil, round the clock", () => {
  expect(ids({ hours: [hour("2026-10-20T05:30:00", 5)] })).toEqual(["earlybird"]);
  const night = [0, 1, 2, 3, 4].map((h) => hour(`2026-10-20T0${h}:00:00`, 5));
  expect(ids({ hours: night })).toEqual(["midnight"]);
  const allDay = Array.from({ length: 24 }, (_, h) =>
    hour(`2026-10-20T${String(h).padStart(2, "0")}:00:00`, 5),
  );
  expect(ids({ hours: allDay })).toEqual(["earlybird", "midnight", "allday", "insomniac"]);
});

test("a seven-day streak is earned on its seventh day", () => {
  const days = (from: number, n: number) =>
    Array.from({ length: n }, (_, i) => hour(`2026-10-${String(from + i).padStart(2, "0")}T12:00:00`, 5));
  // 4-6 October, a gap, then 8-14 October (10 and 11 October 2026 are a weekend).
  const t = trophiesFor({ ...none, hours: [...days(4, 3), ...days(8, 7)] });
  expect(t.find((x) => x.id === "streak")).toEqual({ id: "streak", day: "2026-10-14" });
  expect(t.find((x) => x.id === "weekend")).toEqual({ id: "weekend", day: "2026-10-04" });
});

test("calendar days and prompts", () => {
  expect(ids({ hours: [hour("2025-03-14T12:00:00", 1)] })).toEqual(["piday"]);
  expect(ids({ hours: [hour("2026-07-07T12:00:00", 0, 60)] })).toEqual(["storm"]);
  expect(ids({ hours: [hour("2026-06-22T12:00:00", 1)] })).toEqual(["palindate"]);
});

test("palindrome dates", () => {
  expect(["2021-12-02", "2026-06-20", "2026-02-06", "2030-03-02"].map(palindromeDate)).toEqual([
    true,
    true,
    true,
    true,
  ]);
  expect(["2026-10-21", "2026-06-19"].map(palindromeDate)).toEqual([false, false]);
});

test("switch-hitter: three tools in one day, across its hours", () => {
  const h = (iso: string, sources: string[]) => ({ ...hour(iso, 100), sources });
  expect(ids({ hours: [h("2026-07-07T09:00:00", ["a", "b"]), h("2026-07-07T10:00:00", ["b"])] })).toEqual([]);
  const f = { hours: [h("2026-07-07T09:00:00", ["a", "b"]), h("2026-07-07T10:00:00", ["c"])] };
  expect(trophiesFor({ ...none, ...f }).find((t) => t.id === "switch")).toEqual({
    id: "switch",
    day: "2026-07-07",
  });
  // Three tools over three days is not it.
  expect(
    ids({
      hours: [
        h("2026-07-07T09:00:00", ["a"]),
        h("2026-07-08T09:00:00", ["b"]),
        h("2026-07-09T09:00:00", ["c"]),
      ],
    }),
  ).not.toContain("switch");
});

test("perfect week: tokens every day from a Monday to the Sunday, dated that Sunday", () => {
  // 6 July 2026 is a Monday.
  const days = (from: number, to: number) =>
    Array.from({ length: to - from + 1 }, (_, i) =>
      hour(`2026-07-${String(from + i).padStart(2, "0")}T12:00:00`, 10),
    );
  expect(ids({ hours: days(6, 11) })).not.toContain("perfectweek");
  expect(trophiesFor({ ...none, hours: days(6, 12) }).find((t) => t.id === "perfectweek")).toEqual({
    id: "perfectweek",
    day: "2026-07-12",
  });
  // Seven in a row, but Tuesday to Monday.
  expect(ids({ hours: days(7, 13) })).not.toContain("perfectweek");
});

// MARK: The crazy ones

/** One finished day of a total, in two hours. */
const total = (tokens: number, day = "2026-10-20") => [
  hour(`${day}T10:00:00`, 1),
  hour(`${day}T11:00:00`, tokens - 1, 1),
];
const earnedOn = (f: Partial<TrophyFacts>, id: string) =>
  trophiesFor({ ...none, today: "2027-12-31", ...f }).find((t) => t.id === id)?.day;

test("day totals with a ring to them", () => {
  const got = (tokens: number) => ids({ today: "2026-10-22", hours: total(tokens) });
  expect(got(12_369)).toEqual(["nice"]);
  expect(got(5_420)).toEqual(["blaze"]);
  expect(got(36_660)).toContain("beast");
  expect(got(77_777)).toContain("repdigit");
  expect(got(54_321)).toContain("countdown");
  expect(got(3_000_000)).toContain("exactmillion");
  // Too small, or only today's, doesn't count.
  expect(got(69)).toEqual([]);
  expect(got(7_777_778)).not.toContain("repdigit");
  expect(ids({ hours: total(77_777, "2026-10-21") })).toEqual([]);
});

test("streaks of 30, 100 and 365 days", () => {
  const run = (n: number) =>
    Array.from({ length: n }, (_, i) =>
      hour(`${new Date(Date.UTC(2026, 0, 1 + i)).toISOString().slice(0, 10)}T12:00:00`, 5),
    );
  expect(earnedOn({ hours: run(29) }, "streak30")).toBeUndefined();
  expect(earnedOn({ hours: run(30) }, "streak30")).toBe("2026-01-30");
  expect(earnedOn({ hours: run(100) }, "streak100")).toBe("2026-04-10");
  expect(earnedOn({ hours: run(364) }, "streak365")).toBeUndefined();
  expect(earnedOn({ hours: run(365) }, "streak365")).toBe("2026-12-31");
});

test("the big hours and days", () => {
  expect(ids({ hours: [hour("2026-07-07T12:00:00", 99e6, 5)] })).not.toContain("firehose");
  expect(ids({ hours: [hour("2026-07-07T12:00:00", 100e6, 5)] })).toContain("firehose");
  expect(earnedOn({ hours: [hour("2026-07-07T12:00:00", 1e9, 5)] }, "tsunami")).toBe("2026-07-07");
  expect(earnedOn({ hours: [hour("2026-07-07T12:00:00", 99e9, 5)] }, "hundredb")).toBeUndefined();
  expect(earnedOn({ hours: [hour("2026-07-07T12:00:00", 100e9, 5)] }, "hundredb")).toBe("2026-07-07");
});

test("prompts: a hurricane, and an agent left on its own", () => {
  expect(earnedOn({ hours: [hour("2026-07-07T12:00:00", 5, 199)] }, "hurricane")).toBeUndefined();
  expect(earnedOn({ hours: [hour("2026-07-07T12:00:00", 5, 200)] }, "hurricane")).toBe("2026-07-07");
  expect(earnedOn({ hours: [hour("2026-07-07T12:00:00", 10e6, 1)] }, "setforget")).toBe("2026-07-07");
  expect(earnedOn({ hours: [hour("2026-07-07T12:00:00", 10e6, 2)] }, "setforget")).toBeUndefined();
  expect(earnedOn({ hours: [hour("2026-07-07T12:00:00", 9e6, 0)] }, "setforget")).toBeUndefined();
});

test("insomniac: twenty different hours of one day, not spread over two", () => {
  const hours = (n: number, day: string) =>
    Array.from({ length: n }, (_, h) => hour(`${day}T${String(h).padStart(2, "0")}:00:00`, 5));
  expect(earnedOn({ hours: hours(19, "2026-10-20") }, "insomniac")).toBeUndefined();
  expect(earnedOn({ hours: hours(20, "2026-10-20") }, "insomniac")).toBe("2026-10-20");
  expect(
    earnedOn({ hours: [...hours(10, "2026-10-20"), ...hours(10, "2026-10-21")] }, "insomniac"),
  ).toBeUndefined();
});

test("calendar: leap day, Friday the 13th, Halloween", () => {
  const on = (day: string) => ({ hours: [hour(`${day}T12:00:00`, 1)] });
  expect(earnedOn(on("2028-02-29"), "leapday")).toBe("2028-02-29");
  expect(earnedOn(on("2028-02-28"), "leapday")).toBeUndefined();
  // 13 March 2026 is a Friday, 13 April 2026 a Monday.
  expect(earnedOn(on("2026-03-13"), "friday13")).toBe("2026-03-13");
  expect(earnedOn(on("2026-04-13"), "friday13")).toBeUndefined();
  expect(earnedOn(on("2026-10-31"), "halloween")).toBe("2026-10-31");
});

test("a PR spree: ten PRs in a day", () => {
  const prs = (n: number, day: string) =>
    Array.from({ length: n }, (_, i) => ({
      at: cph(`${day}T${String(8 + i).padStart(2, "0")}:00:00`),
      hash: "ab",
    }));
  expect(earnedOn({ prs: prs(9, "2026-07-07") }, "spree")).toBeUndefined();
  expect(earnedOn({ prs: prs(10, "2026-07-07") }, "spree")).toBe("2026-07-07");
  // Five on each of two days is not it.
  expect(earnedOn({ prs: [...prs(5, "2026-07-07"), ...prs(5, "2026-07-08")] }, "spree")).toBeUndefined();
});
