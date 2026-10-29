import { expect, test } from "bun:test";
import {
  announced,
  awardLine,
  BADGES,
  type BadgeFacts,
  badgeStates,
  badgesFor,
  CACHE_FLOOR,
  FRAMES,
  frameOf,
  longestRun,
  progressOf,
  streakOf,
} from "../src/badges.ts";
import { BADGE_TIER_COINS, badgeCoins } from "../src/economy.ts";

const none: BadgeFacts = {
  streak: 0,
  bestDay: 0,
  podiums: 0,
  peakAgents: 0,
  prs: 0,
  wins: 0,
  biggestPot: 0,
  founder: false,
};

const thresholds = (id: string) => BADGES.find((b) => b.id === id)!.tiers.map((t) => t.at);

test("streaks count back from today, or from yesterday before today's first tokens, and stop at a gap", () => {
  const days = new Set(["2026-09-27", "2026-09-29", "2026-09-30", "2026-10-01"]);
  expect(streakOf(days, "2026-10-01")).toBe(3);
  expect(streakOf(days, "2026-10-02")).toBe(3);
  expect(streakOf(days, "2026-10-03")).toBe(0);
  expect(streakOf(new Set(), "2026-10-01")).toBe(0);
});

test("the longest run is the best stretch of days in a row, wherever it was", () => {
  expect(longestRun(new Set())).toBe(0);
  expect(longestRun(new Set(["2026-09-27", "2026-09-29", "2026-09-30", "2026-10-01", "2026-10-03"]))).toBe(3);
  // A single day with any tokens counts, as for the streak: no floor.
  expect(longestRun(new Set(["2026-02-28", "2026-03-01"]))).toBe(2);
});

test("badges show the highest tier met, and nothing below the first", () => {
  expect(badgesFor(none)).toEqual([]);
  const [streak] = badgesFor({ ...none, streak: 31 });
  expect(streak).toMatchObject({
    id: "streak",
    emoji: "🔥",
    label: "30-day streak",
    tier: 2,
    frame: "silver",
  });
  expect(badgesFor({ ...none, founder: true })[0]).toMatchObject({ id: "founder", tier: 1, frame: "gold" });
});

test("existing thresholds are unchanged: the long ladders only add tiers on top", () => {
  expect(thresholds("streak").slice(0, 3)).toEqual([7, 30, 100]);
  // 3B replaces 1B as the first tier; the tiers a player already holds past it keep their number.
  expect(thresholds("bigday")).toEqual([3e9, 5e9, 10e9, 20e9, 50e9, 100e9]);
  expect(thresholds("podium").slice(0, 3)).toEqual([1, 10, 50]);
  expect(thresholds("octopus")).toEqual([5, 10, 20, 100, 300, 1000]);
  expect(thresholds("shipper").slice(0, 3)).toEqual([10, 50, 250]);
  expect(thresholds("shark").slice(0, 3)).toEqual([5, 25, 100]);
  expect(thresholds("whale").slice(0, 2)).toEqual([500, 2000]);
  expect(thresholds("founder")).toEqual([1]);
  expect(thresholds("picnic")).toEqual([1, 5]);
  // The five with a diamond tier keep it as their fourth.
  expect(thresholds("streak")[3]).toBe(365);
  expect(thresholds("podium")[3]).toBe(200);
  expect(thresholds("shipper")[3]).toBe(1000);
  expect(thresholds("shark")[3]).toBe(500);
  expect(thresholds("whale")[3]).toBe(10000);
});

test("frames: bronze up to gold, diamond on top of four, a lone tier is gold", () => {
  expect([1, 2, 3, 4].map((t) => frameOf(t, 4))).toEqual(["bronze", "silver", "gold", "diamond"]);
  expect([1, 2, 3].map((t) => frameOf(t, 3))).toEqual(["bronze", "silver", "gold"]);
  expect(frameOf(1, 1)).toBe("gold");
  const [s] = badgesFor({ ...none, prs: 1000 });
  expect(s).toMatchObject({ id: "shipper", frame: "diamond", rarity: "legendary", next: { at: 2500 } });
});

test("past diamond: mythic and cosmic, the top of the longest ladders", () => {
  expect([1, 2, 3, 4, 5, 6].map((t) => frameOf(t, 6))).toEqual([
    "bronze",
    "silver",
    "gold",
    "diamond",
    "mythic",
    "cosmic",
  ]);
  const [s] = badgesFor({ ...none, prs: 10000 });
  expect(s).toMatchObject({ id: "shipper", tier: 6, frame: "cosmic", rarity: "legendary", next: null });
  expect(announced("shipper", 5)).toBe(true);
  expect(announced("shipper", 6)).toBe(true);
  expect(awardLine("Ada", "octopus", 6)).toBe("🏅 Ada earned Octopus cosmic: 1000 agents: Skynet");
});

test("every ladder climbs, has a frame for each tier and a coin price for each", () => {
  for (const b of BADGES) {
    expect(b.tiers.length).toBeLessThanOrEqual(FRAMES.length);
    expect(b.tiers.length).toBeLessThanOrEqual(BADGE_TIER_COINS.length);
    b.tiers.forEach((t, i) => {
      expect(t.label).not.toBe("");
      if (i > 0) expect(t.at).toBeGreaterThan(b.tiers[i - 1]!.at);
    });
  }
  expect(badgeCoins(6)).toBe(3740);
});

test("the crazy ladders", () => {
  const tier = (id: string, f: Partial<BadgeFacts>) =>
    badgesFor({ ...none, ...f }).find((b) => b.id === id)?.tier ?? 0;
  // Big day: 3B, 5B, 10B, 20B, then 50B and 100B.
  expect([2.9e9, 3e9, 5e9, 10e9, 20e9, 50e9, 100e9].map((bestDay) => tier("bigday", { bestDay }))).toEqual([
    0, 1, 2, 3, 4, 5, 6,
  ]);
  // Agents at once, up to a thousand.
  expect([4, 5, 10, 20, 100, 300, 1000].map((peakAgents) => tier("octopus", { peakAgents }))).toEqual([
    0, 1, 2, 3, 4, 5, 6,
  ]);
  // The furnace counts lifetime tokens.
  expect(
    [1e9 - 1, 1e9, 10e9, 100e9, 1e12, 10e12, 100e12].map((lifetime) => tier("furnace", { lifetime })),
  ).toEqual([0, 1, 2, 3, 4, 5, 6]);
});

test("progress: where they stand, the next tier and the bar", () => {
  const [s] = badgesFor({ ...none, prs: 30 });
  expect(s).toMatchObject({ tier: 1, value: 30, prev: 10, next: { at: 50, label: "50 PRs" } });
  expect(progressOf(s!)).toBe(0.5);
  // Not earned yet: from 0 toward the first tier, in the log only.
  const unearned = badgeStates(none).find((b) => b.id === "shipper")!;
  expect(unearned).toMatchObject({ tier: 0, value: 0, prev: 0, next: { at: 10 } });
  expect(progressOf({ value: 5, next: { at: 10, label: "" }, prev: 0 })).toBe(0.5);
  expect(progressOf({ value: 9999, next: null, prev: 10 })).toBe(1);
});

test("the new badges", () => {
  const tier = (id: string, f: Partial<BadgeFacts>) =>
    badgesFor({ ...none, ...f }).find((b) => b.id === id)?.tier ?? 0;
  expect([9, 10, 30, 100].map((shipDays) => tier("shipdays", { shipDays }))).toEqual([0, 1, 2, 3]);
  expect([2, 3, 6, 10, 49, 50, 250, 999, 1000].map((models) => tier("polyglot", { models }))).toEqual([
    0, 1, 2, 3, 3, 4, 5, 5, 6,
  ]);
  expect([13, 14, 60, 200].map((longestRun) => tier("longrun", { longestRun }))).toEqual([0, 1, 2, 3]);
  expect([0, 1, 10, 50].map((raidKills) => tier("raider", { raidKills }))).toEqual([0, 1, 2, 3]);
  expect([9, 10, 50, 250].map((gamesPlayed) => tier("regular", { gamesPlayed }))).toEqual([0, 1, 2, 3]);
  expect([1, 2, 4].map((gameTypes) => tier("allgames", { gameTypes }))).toEqual([0, 1, 2]);
  expect(tier("hunter", { lootOwned: 5 })).toBe(2);
});

test("cache wizard needs its token floor, then a share", () => {
  const f = { cacheShare: 0.96 };
  expect(badgesFor({ ...none, ...f, lifetime: CACHE_FLOOR - 1 }).some((b) => b.id === "cache")).toBe(false);
  expect(badgesFor({ ...none, ...f, lifetime: CACHE_FLOOR }).find((b) => b.id === "cache")).toMatchObject({
    tier: 3,
    value: 96,
  });
  expect(
    badgesFor({ ...none, cacheShare: 0.85, lifetime: CACHE_FLOOR }).find((b) => b.id === "cache")?.tier,
  ).toBe(1);
});

test("gold and diamond are announced, bronze and silver aren't, nor a founder", () => {
  expect(announced("shipper", 1)).toBe(false);
  expect(announced("shipper", 2)).toBe(false);
  expect(announced("shipper", 3)).toBe(true);
  expect(announced("shipper", 4)).toBe(true);
  expect(announced("longrun", 3)).toBe(true);
  expect(announced("founder", 1)).toBe(false);
  expect(announced("nope", 1)).toBe(false);
  expect(awardLine("Ada", "shipper", 3)).toBe("🏅 Ada earned Shipper gold: 250 PRs");
  expect(awardLine("Ada", "shipper", 9)).toBeNull();
});
