import { expect, test } from "bun:test";
import {
  BOSSES,
  bossAt,
  dayDamage,
  dayStart,
  HP_GROWTH,
  HP_SHARE,
  hpFor,
  launchWeek,
  MIN_HP,
  nextWeekHp,
  opensAt,
  PR_HIT,
  RAID_COINS,
  RAIDER_AT,
  type RaidDay,
  REWARD_GROWTH,
  raidCoins,
  raidWeekAt,
  raidWeeks,
  rewardFor,
  rungHp,
  seatFor,
  WEEKLY_GROWTH,
  weekOf,
} from "../src/raid.ts";
import { addDays, dayKey } from "../src/range.ts";

/** Noon on a world day. */
const noon = (day: string) => dayStart(day) + 12 * 3_600_000;
const hit = (userId: number, day: string, tokens: number, prs = 0): RaidDay => ({ userId, day, tokens, prs });
/** The first raid's week in these tests. */
const START = "2026-10-26";
const day = (n: number) => addDays(START, n);
const raids = (days: readonly RaidDay[], now: number) => raidWeeks(days, now, START);

test("weeks start on Monday, world time", () => {
  expect(weekOf("2026-10-19")).toBe("2026-10-19");
  expect(weekOf("2026-10-25")).toBe("2026-10-19");
  expect(weekOf("2026-10-26")).toBe("2026-10-26");
  expect(weekOf(START)).toBe(START);
  // Copenhagen's midnight, in summer and in winter time.
  expect(dayKey(dayStart("2026-07-01"))).toBe("2026-07-01");
  expect(dayKey(dayStart("2026-07-01") - 1)).toBe("2026-06-30");
  expect(dayKey(dayStart("2026-12-01"))).toBe("2026-12-01");
  expect(dayKey(dayStart("2026-12-01") - 1)).toBe("2026-11-30");
});

test("the gate opens at 08:00 on Monday, Copenhagen time, summer and winter", () => {
  // 2026-10-19 is in summer time (UTC+2), 2026-11-02 in winter time (UTC+1).
  const summer = "2026-10-19";
  const winter = "2026-11-02";
  expect(opensAt(summer)).toBe(Date.UTC(2026, 9, 19, 6));
  expect(opensAt(winter)).toBe(Date.UTC(2026, 10, 2, 7));
  for (const week of [summer, winter]) {
    const gate = opensAt(week);
    expect(raidWeekAt(gate - 60_000)).toBe(addDays(week, -7)); // 07:59
    expect(raidWeekAt(gate)).toBe(week); // 08:00
    expect(raidWeekAt(dayStart(week))).toBe(addDays(week, -7)); // midnight
    expect(raidWeekAt(dayStart(addDays(week, 7)) - 1)).toBe(week); // Sunday 23:59:59
  }
});

test('the ladder is five bosses, easiest first, and a level makes the same five "II", "III"…', () => {
  expect([1, 2, 3, 4, 5].map((r) => bossAt(r).name)).toEqual([
    "The Rate Limit",
    "The Context Window",
    "Merge Conflict",
    "The Hallucination",
    "The Invoice",
  ]);
  expect(bossAt(1).id).toBe(BOSSES[0]!.id);
  expect(bossAt(1, 2)).toMatchObject({ id: "rate-limit", name: "The Rate Limit II", rung: 1, level: 2 });
  expect(bossAt(3, 2)).toMatchObject({ id: "merge-conflict", name: "Merge Conflict II", rung: 3, level: 2 });
  expect(bossAt(5, 3)).toMatchObject({ id: "invoice", name: "The Invoice III", level: 3 });
});

test("each rung has 1.5× the HP; a kill pays 40, 100, 200, 300, 400, and 10% more each level", () => {
  expect(rungHp(2e9, 1)).toBe(2e9);
  expect(rungHp(2e9, 2)).toBe(3e9);
  expect(rungHp(2e9, 3)).toBe(4.5e9);
  expect(HP_GROWTH).toBe(1.5);
  expect([1, 2, 3, 4, 5].map((r) => rewardFor(r))).toEqual([40, 100, 200, 300, 400]);
  expect(rewardFor(1)).toBe(RAID_COINS);
  expect(REWARD_GROWTH).toBe(1.1);
  // A level up pays 10% more, level on level.
  expect([1, 2, 3].map((l) => rewardFor(5, l))).toEqual([400, 440, 484]);
  expect(rewardFor(1, 2)).toBe(44);
  expect(rewardFor(2, 2)).toBe(110);
  expect(rewardFor(2, 2, "2026-10-26")).toBe(110);
  // Weeks before RAID_REWARDS_FROM kept the old payout: nothing is paid again for them.
  expect([1, 2, 3, 4, 5].map((r) => rewardFor(r, 1, "2026-10-19"))).toEqual([10, 25, 50, 75, 100]);
  expect(rewardFor(2, 2, "2026-10-19")).toBe(28); // 27.5, rounded
});

test("a day hits for all its tokens, no cap, and a PR is a special attack", () => {
  expect(dayDamage({ tokens: 5e6, prs: 0 })).toBe(5e6);
  expect(dayDamage({ tokens: 50e9, prs: 0 })).toBe(50e9);
  expect(dayDamage({ tokens: 0, prs: 2 })).toBe(2 * PR_HIT);
});

test("a boss falls and the next appears at once, with the overflow", () => {
  // Rung 1 is 2B, rung 2 is 3B, rung 3 is 4.5B.
  const days = [
    hit(1, day(0), 900e6),
    hit(2, day(1), 900e6),
    hit(3, day(2), 900e6), // 2.7B: rung 1 falls, 0.7B into rung 2
    hit(1, day(3), 900e6),
    hit(2, day(3), 900e6),
    hit(3, day(3), 900e6), // 5.4B: rung 2 falls with 0.4B into rung 3
  ];
  const [w] = raids(days, noon(day(4)));
  expect(w!.hp).toBe(MIN_HP);
  expect(w!.damage).toBe(5.4e9);
  expect(w!.kills.map((k) => [k.rung, k.boss.name, k.day])).toEqual([
    [1, "The Rate Limit", day(2)],
    [2, "The Context Window", day(3)],
  ]);
  expect(w!.current).toMatchObject({ hp: 4.5e9, damage: 0.4e9 });
  expect(w!.current.boss.name).toBe("Merge Conflict");
});

test("a big day brings down several, all that day, in order", () => {
  const days = [1, 2, 3, 4, 5, 6].map((u) => hit(u, day(1), 1e9)); // 6B: 2B + 3B, 1B over
  const [w] = raids(days, noon(day(1)));
  expect(w!.kills.map((k) => [k.rung, k.day])).toEqual([
    [1, day(1)],
    [2, day(1)],
  ]);
  expect(w!.current.damage).toBe(1e9);
  expect(raidCoins([w!], 1)).toBe(rewardFor(1) + rewardFor(2));
});

test("the first raid's rung 1 follows the week before; a week's ladder only levels up if the one before cleared it", () => {
  expect(WEEKLY_GROWTH).toBe(1.1);
  expect(hpFor(0)).toBe(MIN_HP);
  expect(BOSSES).toHaveLength(5);
  const history = Array.from({ length: 20 }, (_, u) => hit(u, day(-7), 2e9)); // 40B the week before
  const first = 40e9 * HP_SHARE; // 4B: all five rungs are 4B × 13.1875 = 52.75B
  // A huge week 1 clears every rung; nothing at all after it: the next weeks stay at level 2.
  const busy = raids(
    [...history, ...Array.from({ length: 20 }, (_, u) => hit(u, day(0), 3e9))], // 60B
    noon(day(21)),
  );
  expect(busy.map((w) => w.week)).toEqual([day(0), day(7), day(14), day(21)]);
  expect(busy[0]!.cleared).toBe(true);
  expect(busy.map((w) => w.cleared)).toEqual([true, false, false, false]);
  expect(busy.map((w) => w.level)).toEqual([1, 2, 2, 2]);
  expect(busy.map((w) => w.hp)).toEqual([first, first * 1.1, first * 1.1, first * 1.1].map(Math.round));
  expect(busy[1]!.current.boss.name).toBe("The Rate Limit II");
  // A town that never gets through the whole ladder never levels up.
  const stalled = raids(
    [...history, ...Array.from({ length: 20 }, (_, u) => hit(u, day(0), 1e9))], // 20B: three rungs
    noon(day(21)),
  );
  expect(stalled[0]!.kills.length).toBeLessThan(5);
  expect(stalled.map((w) => w.level)).toEqual([1, 1, 1, 1]);
  expect(stalled.map((w) => w.hp)).toEqual([first, first, first, first]);
  // Four rungs is not enough; five is.
  expect(nextWeekHp(first, 4)).toBe(first);
  expect(nextWeekHp(first, 5)).toBe(Math.round(first * 1.1));
  // Level 2 cleared too: level 3, and 10% more again. Level 2 not cleared: back at level 2.
  const days = [
    ...history,
    ...Array.from({ length: 20 }, (_, u) => hit(u, day(0), 3e9)),
    ...Array.from({ length: 20 }, (_, u) => hit(u, day(7), 4e9)), // 80B against 4.4B × 13.1875 = 58B
  ];
  const twice = raids(days, noon(day(14)));
  expect(twice.map((w) => w.level)).toEqual([1, 2, 3]);
  expect(twice.map((w) => w.hp)).toEqual([first, first * 1.1, first * 1.21].map(Math.round));
  expect(twice[2]!.current.boss.name).toBe("The Rate Limit III");
  const failed = raids(
    [...history, ...Array.from({ length: 20 }, (_, u) => hit(u, day(0), 3e9)), hit(1, day(7), 1e9)],
    noon(day(14)),
  );
  expect(failed.map((w) => w.level)).toEqual([1, 2, 2]);
  expect(failed.map((w) => w.hp)).toEqual([first, first * 1.1, first * 1.1].map(Math.round));
  // No history: the first raid has the least HP, and a quiet week leaves the next the same.
  expect(raids([], noon(day(7))).map((w) => w.hp)).toEqual([MIN_HP, MIN_HP]);
});

test("once the Invoice falls the ladder is cleared: no more bosses, the overflow still counts as damage", () => {
  // Rung 1 is 2B: the five cost 26.375B. 30B on day 0 clears it with 3.6B over.
  const [w] = raids(
    Array.from({ length: 10 }, (_, u) => hit(u, day(0), 3e9)),
    noon(day(3)),
  );
  expect(w!.kills.map((k) => k.rung)).toEqual([1, 2, 3, 4, 5]);
  expect(w!.kills.map((k) => k.boss.name).at(-1)).toBe("The Invoice");
  expect(w!.cleared).toBe(true);
  expect(w!.damage).toBe(30e9);
  expect(w!.current.boss.name).toBe("The Invoice");
  expect(w!.current.damage).toBe(w!.current.hp);
  expect(w!.raiders).toHaveLength(10);
  // More after it hits nothing: no sixth kill, and the same coins.
  const [more] = raids(
    [...Array.from({ length: 10 }, (_, u) => hit(u, day(0), 3e9)), hit(1, day(2), 500e9)],
    noon(day(3)),
  );
  expect(more!.kills).toHaveLength(5);
  expect(more!.damage).toBe(530e9);
  expect(raidCoins([more!], 1)).toBe(raidCoins([w!], 1) + 0);
});

test("a steady town clears about four rungs in the first week", () => {
  // 20 players, ~300M a day each, every day: 42B a week.
  const days: RaidDay[] = [];
  for (let w = -1; w < 3; w++)
    for (let d = 0; d < 7; d++) for (let u = 1; u <= 20; u++) days.push(hit(u, day(7 * w + d), 300e6));
  const weeks = raids(days, noon(day(20)));
  // Rung 1 is 4.2B, then 4.62B: four fall each week, 40 + 100 + 200 + 300 coins.
  for (const w of weeks.slice(0, 2)) {
    expect(w.current.boss.rung).toBe(5);
    expect(raidCoins([w], 1)).toBe(640);
  }
  // A quieter week (60%) still gets past the first three; a busier one (1.7×) five.
  const busy = (share: number) => {
    const d2: RaidDay[] = [];
    for (let d = 0; d < 7; d++)
      for (let u = 1; u <= 20; u++) {
        d2.push(hit(u, day(-7 + d), 300e6));
        d2.push(hit(u, day(d), 300e6 * share));
      }
    return raids(d2, noon(day(6)))[0]!.kills.length;
  };
  expect(busy(0.6)).toBe(3);
  expect(busy(1.7)).toBe(5);
});

test("weeks before the first raid only set its HP", () => {
  const before = addDays(START, -7);
  const old = Array.from({ length: 20 }, (_, u) => hit(u, before, 1e9));
  const weeks = raids(old, noon(START));
  expect(weeks.map((w) => w.week)).toEqual([START]);
  expect(weeks[0]!.hp).toBe(20e9 * HP_SHARE);
  expect(raidCoins(weeks, 1)).toBe(0);
});

test("raiders who did enough by the day of a kill are paid for it, and nobody when nothing falls", () => {
  const weeks = raids(
    [
      hit(1, day(0), 1e9),
      hit(1, day(1), 1e9), // rung 1 falls on day 1
      hit(2, day(0), RAIDER_AT),
      hit(3, day(0), RAIDER_AT - 1),
    ],
    noon(day(3)),
  );
  expect(weeks[0]!.kills.map((k) => k.day)).toEqual([day(1)]);
  expect(weeks[0]!.raiders.map((r) => r.userId)).toEqual([1, 2, 3]);
  expect(raidCoins(weeks, 1)).toBe(RAID_COINS);
  expect(raidCoins(weeks, 2)).toBe(RAID_COINS);
  expect(raidCoins(weeks, 3)).toBe(0);
  const standing = raids([hit(1, day(0), MIN_HP / 2)], noon(day(0)));
  expect(standing[0]!.kills).toEqual([]);
  expect(raidCoins(standing, 1)).toBe(0);
});

test("a late joiner isn't paid for the kills before they joined", () => {
  const days = [
    hit(1, day(0), 1e9),
    hit(2, day(0), 1e9), // rung 1 (2B) falls on Monday
    hit(1, day(6), 1e9),
    hit(2, day(6), 1e9),
    hit(3, day(6), 1e9), // rung 2 (3B) falls on Sunday
  ];
  const weeks = raids(days, noon(day(6)));
  expect(weeks[0]!.kills.map((k) => [k.rung, k.raiders])).toEqual([
    [1, [1, 2]],
    [2, [1, 2, 3]],
  ]);
  expect(raidCoins(weeks, 1)).toBe(rewardFor(1) + rewardFor(2));
  expect(raidCoins(weeks, 3)).toBe(rewardFor(2));
});

test("one player's big day hits for all of it", () => {
  const [w] = raids([hit(1, day(0), 6e9)], noon(day(0)));
  expect(w!.damage).toBe(6e9);
  expect(w!.kills.map((k) => [k.rung, k.raiders])).toEqual([
    [1, [1]],
    [2, [1]],
  ]);
});

test("until 08:00 Monday it's last week, as it ended, and its kills still pay", () => {
  const next = day(7);
  const days = [
    hit(1, day(0), 1e9),
    hit(2, day(0), 1e9),
    ...Array.from({ length: 6 }, (_, u) => hit(10 + u, next, 1e9)),
  ];
  const early = raids(days, opensAt(next) - 60_000);
  expect(early.map((w) => w.week)).toEqual([START]);
  expect(early[0]!.kills).toHaveLength(1);
  expect(raidCoins(early, 1)).toBe(RAID_COINS);
  expect(raidCoins(early, 10)).toBe(0);
  const open = raids(days, opensAt(next));
  expect(open.map((w) => w.week)).toEqual([START, next]);
  // Monday's early tokens are in: 6B against a 2B rung 1 (last week only cleared one, so no 10% up) and 3B rung 2.
  expect(open[1]!.hp).toBe(MIN_HP);
  expect(open[1]!.damage).toBe(6e9);
  expect(open[1]!.kills.map((k) => k.rung)).toEqual([1, 2]);
  expect(raidCoins(open, 10)).toBe(rewardFor(1) + rewardFor(2));
  expect(raidCoins(open, 1)).toBe(RAID_COINS);
});

test("the raid launches on the next Monday at 08:00, whatever day it is", () => {
  // Tuesday, Sunday night and Monday morning before the gate: all wait for the Monday after.
  expect(launchWeek(noon(day(1)))).toBe(day(7));
  expect(launchWeek(dayStart(day(7)) - 1)).toBe(day(7));
  expect(launchWeek(opensAt(day(7)) - 60_000)).toBe(day(14));
  const days = [hit(1, day(0), 30e9), hit(1, day(7), 9e9)];
  // Before 08:00 that Monday there's no raid, so nothing pays; the week before only sets its HP.
  expect(raidWeeks(days, opensAt(day(7)) - 60_000, day(7))).toEqual([]);
  const [w] = raidWeeks(days, opensAt(day(7)), day(7));
  expect(w!.week).toBe(day(7));
  expect(w!.hp).toBe(3e9);
  expect(w!.kills.map((k) => k.rung)).toEqual([1, 2]);
});

test("a raider's desk comes from their id, so a reload keeps it", () => {
  const none = new Set<number>();
  const own = seatFor(42, none, 40);
  expect(seatFor(42, none, 40)).toBe(own);
  // Taken: the next free one, round the room.
  expect(seatFor(42, new Set([own]), 40)).toBe((own + 1) % 40);
  const taken = new Set<number>();
  for (let id = 1; id <= 40; id++) taken.add(seatFor(id, taken, 40));
  expect(taken.size).toBe(40);
});
