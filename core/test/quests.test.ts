import { expect, test } from "bun:test";
import {
  type Baseline,
  baselineOf,
  COUNT_CAP,
  type Counts,
  dailyQuests,
  EMPTY_COUNTS,
  EMPTY_DAY,
  LEGACY_FROM,
  legacyQuestCoins,
  POOL,
  QUEST_MULT_FROM,
  questCoins,
  questProgress,
  WEEKLY_COINS,
  weeklyCoins,
  weeklyProgress,
  weekStart,
} from "../src/quests.ts";
import { addDays } from "../src/range.ts";

const ZERO = baselineOf([]);
const BUSY: Baseline = {
  days: 30,
  peakAgents: 4,
  activeBuckets: 30,
  prs: 2,
  prompts: 100,
  tokens: 80e6,
  models: 3,
};
const WHALE: Baseline = {
  days: 30,
  peakAgents: 40,
  activeBuckets: 280,
  prs: 20,
  prompts: 2000,
  tokens: 2e9,
  models: 5,
};

/** The facts and counters with just `n` in whichever one `id` reads. */
function withValue(id: string, n: number): { f: typeof EMPTY_DAY; c: Counts } {
  const q = POOL.find((p) => p.id === id)!;
  for (const k of Object.keys(EMPTY_DAY) as (keyof typeof EMPTY_DAY)[]) {
    const f = { ...EMPTY_DAY, [k]: n };
    if (q.value(f, EMPTY_COUNTS) === n) return { f, c: EMPTY_COUNTS };
  }
  for (const k of Object.keys(EMPTY_COUNTS) as (keyof Counts)[]) {
    const c = { ...EMPTY_COUNTS, [k]: n };
    if (q.value(EMPTY_DAY, c) === n) return { f: EMPTY_DAY, c };
  }
  throw new Error(id);
}

test("each quest is done at its target, not one below", () => {
  for (const q of POOL) {
    const dq = { id: q.id, target: q.target(BUSY) };
    const at = withValue(q.id, dq.target);
    const below = withValue(q.id, dq.target - 1);
    expect(questProgress(dq, at.f, at.c).done).toBe(true);
    expect(questProgress(dq, below.f, below.c).done).toBe(false);
    expect(questProgress(dq, EMPTY_DAY, EMPTY_COUNTS).done).toBe(false);
  }
});

test("a day's quests are the same every time, one per tier, at most one in town", () => {
  const seen = new Set<string>();
  for (let i = 0; i < 200; i++) {
    const day = addDays("2026-11-01", i);
    const a = dailyQuests(day, BUSY);
    expect(dailyQuests(day, BUSY)).toEqual(a);
    expect(a).toHaveLength(3);
    const defs = a.map((q) => POOL.find((p) => p.id === q.id)!);
    expect(defs.map((d) => d.tier)).toEqual([1, 2, 3]);
    expect(defs.filter((d) => d.town).length).toBeLessThanOrEqual(1);
    for (const d of defs) seen.add(d.id);
  }
  // Every quest turns up, coffee too: it counts drinks in the Tavern.
  expect(POOL.filter((q) => !seen.has(q.id)).map((q) => q.id)).toEqual([]);
});

test("never the same quest two days running", () => {
  let prev: string[] = [];
  for (let i = 0; i < 100; i++) {
    const a = dailyQuests(addDays("2026-11-01", i), BUSY, prev).map((q) => q.id);
    for (const id of a) expect(prev).not.toContain(id);
    prev = a;
  }
});

test("a player with no history gets three quests, at the floors", () => {
  for (let i = 0; i < 100; i++) {
    const ids = dailyQuests(addDays("2026-11-01", i), ZERO).map((q) => q.id);
    expect(ids).toHaveLength(3);
    // No PRs or second model in sight: those two are never dealt.
    expect(ids).not.toContain("ship");
    expect(ids).not.toContain("minds");
  }
  const floor = (id: string) => POOL.find((p) => p.id === id)!.target(ZERO);
  expect(floor("warm")).toBe(2e6);
  expect(floor("chatter")).toBe(10);
  expect(floor("steady")).toBe(6);
  expect(floor("parallel")).toBe(2);
  expect(floor("haul")).toBe(12);
  expect(floor("swarm")).toBe(4);
});

test("a whale's targets are capped", () => {
  const cap = (id: string) => POOL.find((p) => p.id === id)!.target(WHALE);
  expect(cap("warm")).toBe(25e6);
  expect(cap("chatter")).toBe(150);
  expect(cap("steady")).toBe(24);
  expect(cap("parallel")).toBe(6);
  expect(cap("ship")).toBe(3);
  expect(cap("haul")).toBe(72);
  expect(cap("swarm")).toBe(8);
  // Scaled in between for a busy player.
  expect(POOL.find((p) => p.id === "parallel")!.target(BUSY)).toBe(5);
});

test("the baseline is the median over active days", () => {
  const day = (peakAgents: number) => ({ ...EMPTY_DAY, tokens: 1e6, peakAgents, activeBuckets: 10 });
  expect(baselineOf([day(1), day(5), day(3)]).peakAgents).toBe(3);
  expect(baselineOf([day(1), day(5), day(3), day(9)]).peakAgents).toBe(4);
  // Idle days don't pull it down.
  expect(baselineOf([day(1), day(5), day(3), EMPTY_DAY, EMPTY_DAY, EMPTY_DAY]).peakAgents).toBe(3);
  // Too few active days: nothing, so the floors apply.
  expect(baselineOf([day(9), day(9)])).toMatchObject({ days: 2, peakAgents: 0, activeBuckets: 0 });
  expect(baselineOf([]).days).toBe(0);
  // Models: the most on one day.
  expect(
    baselineOf([
      { ...day(1), models: 2 },
      { ...day(1), models: 1 },
    ]).models,
  ).toBe(2);
});

test("old days pay the old rule: a full day pays 7", () => {
  expect(legacyQuestCoins({ peakAgents: 5, activeBuckets: 24 })).toBe(7);
  expect(legacyQuestCoins({ peakAgents: 4, activeBuckets: 23 })).toBe(0);
  expect(legacyQuestCoins({ peakAgents: 5, activeBuckets: 0 })).toBe(5);
  expect(LEGACY_FROM).toMatch(/^\d{4}-\d{2}-\d{2}$/);
});

test("a day pays the tiers of what's done", () => {
  const qs = [
    { id: "chatter", target: 10 },
    { id: "parallel", target: 2 },
    { id: "haul", target: 12 },
  ];
  const full = { ...EMPTY_DAY, prompts: 10, peakAgents: 2, activeBuckets: 12 };
  expect(questCoins(qs, full, EMPTY_COUNTS)).toBe(30);
  expect(questCoins(qs, { ...EMPTY_DAY, prompts: 10 }, EMPTY_COUNTS)).toBe(5);
  // The days before the x5 keep what they paid.
  expect(questCoins(qs, full, EMPTY_COUNTS, "2026-10-28")).toBe(6);
  expect(questCoins(qs, full, EMPTY_COUNTS, QUEST_MULT_FROM)).toBe(30);
  expect(questCoins(qs, EMPTY_DAY, EMPTY_COUNTS)).toBe(0);
  // Progress shows the value up to the target.
  const p = questProgress(qs[0]!, { ...EMPTY_DAY, prompts: 99 }, EMPTY_COUNTS);
  expect(p).toMatchObject({ value: 10, target: 10, coins: 5 });
  expect(COUNT_CAP).toBe(3);
});

test("the weekly quest: seeded by the week, 75 coins at its target, 15 for the weeks before 2 Nov", () => {
  expect(weekStart("2026-10-26")).toBe("2026-10-26");
  expect(weekStart("2026-11-01")).toBe("2026-10-26");
  expect(weekStart("2026-11-02")).toBe("2026-11-02");
  const week = (id: string) => {
    for (let i = 0; ; i++) {
      const w = addDays("2026-10-26", i * 7);
      if (weeklyProgress(w, []).id === id) return w;
    }
  };
  expect(weeklyProgress(week("active"), [])).toEqual(weeklyProgress(week("active"), []));
  const a = week("active");
  const days = (n: number) => Array.from({ length: n }, () => ({ active: true, cleared: 0 }));
  expect(weeklyProgress(a, days(4)).done).toBe(false);
  expect(weeklyProgress(a, days(5))).toMatchObject({ done: true, coins: weeklyCoins(a), target: 5 });
  const c = week("cleared");
  expect(weeklyProgress(c, [{ active: true, cleared: 7 }]).done).toBe(false);
  expect(weeklyProgress(c, [{ active: true, cleared: 8 }]).done).toBe(true);
  expect(WEEKLY_COINS).toBe(75);
  expect([weeklyCoins("2026-10-26"), weeklyCoins("2026-11-02"), weeklyCoins()]).toEqual([15, 75, 75]);
});
