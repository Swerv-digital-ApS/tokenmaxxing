import { expect, test } from "bun:test";
import {
  badgeCoins,
  isModel,
  levelUpCoins,
  modelKey,
  STREAK_FROM,
  streakBonus,
  streakExtra,
  streakMultipliers,
  streakNow,
  TROPHY_COINS,
  trophyCoins,
} from "../src/economy.ts";
import { TROPHIES } from "../src/trophies.ts";

test("level-up coins skip the milestone levels", () => {
  expect(levelUpCoins(0)).toBe(0);
  expect(levelUpCoins(9)).toBe(2 * 9 + 45);
  // Level 10 pays its milestone's coins instead.
  expect(levelUpCoins(10)).toBe(levelUpCoins(9));
  expect(levelUpCoins(26)).toBe(369);
  expect(levelUpCoins(50)).toBe(1375 - (12 + 22 + 32 + 42 + 52));
});

test("a badge pays each tier it reached once", () => {
  expect(badgeCoins(0)).toBe(0);
  expect([1, 2, 3, 4].map(badgeCoins)).toEqual([40, 140, 340, 740]);
});

test("every trophy has a price and a trophy pays once", () => {
  for (const t of TROPHIES) expect(TROPHY_COINS[t.id]).toBeDefined();
  expect(trophyCoins(["million", "million", "zeros", "piday"])).toBe(20 + 100);
});

test("the streak climbs half a step a day to x3", () => {
  const days = ["2026-11-01", "2026-11-02", "2026-11-03", "2026-11-04", "2026-11-05", "2026-11-06"];
  expect([...streakMultipliers(days).values()]).toEqual([1, 1.5, 2, 2.5, 3, 3]);
});

test("a missed day resets the streak to x1", () => {
  const m = streakMultipliers([
    "2026-11-01",
    "2026-11-02",
    "2026-11-03",
    "2026-11-04",
    "2026-11-05",
    "2026-11-07",
    "2026-11-08",
  ]);
  expect(m.get("2026-11-05")).toBe(3);
  // x3 had 4 steps; one day off resets it, so the day back is paid at x1 and the run climbs again.
  expect(m.get("2026-11-07")).toBe(1);
  expect(m.get("2026-11-08")).toBe(1.5);
  // A long gap takes it back to x1.
  expect(streakMultipliers(["2026-11-01", "2026-11-02", "2026-11-03", "2026-11-20"]).get("2026-11-20")).toBe(
    1,
  );
});

test("the extra is whole coins on top of the plain ones", () => {
  expect(streakExtra(10, 1)).toBe(0);
  expect(streakExtra(10, 2.5)).toBe(15);
  expect(streakExtra(3, 1.5)).toBe(1);
});

test("days before STREAK_FROM keep their plain coins, but still build the streak", () => {
  const before = (n: number) => {
    const d = new Date(`${STREAK_FROM}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() - n);
    return d.toISOString().slice(0, 10);
  };
  const days = [before(3), before(2), before(1), STREAK_FROM];
  // The fourth day of a run is x2.5: 10 coins pay 15 more.
  expect(streakBonus(days, () => 10)).toBe(15);
});

test("what today would be worth before it has tokens", () => {
  const days = ["2026-11-01", "2026-11-02", "2026-11-03"];
  expect(streakNow(days, "2026-11-03")).toBe(2);
  expect(streakNow(days, "2026-11-04")).toBe(2.5);
  expect(streakNow(days, "2026-11-05")).toBe(1);
  expect(streakNow([], "2026-11-05")).toBe(1);
});

test("a model is the same across OpenRouter's id and a client's", () => {
  expect(modelKey("anthropic/claude-opus-5.5")).toBe("claude-opus-5-5");
  expect(modelKey("openai/gpt-6:free")).toBe("gpt-6");
  expect(isModel("claude-opus-5-5", "claude-opus-5-5")).toBe(true);
  expect(isModel("Claude-Opus-5-5-20261027", "claude-opus-5-5")).toBe(true);
  // Another model that shares the start of the name isn't it.
  expect(isModel("claude-opus-5", "claude-opus-5-5")).toBe(false);
  expect(isModel("claude-opus-5-5-mini", "claude-opus-5-5")).toBe(false);
});
