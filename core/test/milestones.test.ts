import { expect, test } from "bun:test";
import { MAX_LEVEL } from "../src/format.ts";
import {
  LEGENDARY_LEVEL,
  MILESTONES,
  milestoneCoins,
  milestoneItems,
  milestonesBetween,
  milestoneText,
  milestoneTitle,
  nextMilestone,
} from "../src/milestones.ts";
import { ITEMS } from "../src/shop.ts";

test("a milestone every 10 levels to the top, each with an item, a title and more coins than the last", () => {
  expect(MILESTONES.map((m) => m.level)).toEqual([10, 20, 30, 40, 50]);
  expect(LEGENDARY_LEVEL).toBe(MAX_LEVEL);
  expect(new Set(MILESTONES.map((m) => m.title)).size).toBe(MILESTONES.length);
  for (const [i, m] of MILESTONES.entries()) {
    expect(milestoneItems(m).length).toBeGreaterThan(0);
    if (i > 0) expect(m.coins).toBeGreaterThan(MILESTONES[i - 1]!.coins);
  }
  // The item packs' rewards (5, 7, 15, ...) come between milestones, never on one.
  for (const i of ITEMS.filter((i) => i.level !== undefined && i.level % 10 !== 0))
    expect(MILESTONES.some((m) => m.level === i.level)).toBe(false);
});

test("coins add up once per milestone reached; the title is the last one's", () => {
  expect(milestoneCoins(9)).toBe(0);
  expect(milestoneCoins(10)).toBe(100);
  expect(milestoneCoins(39)).toBe(850);
  expect(milestoneCoins(50)).toBe(4350);
  expect(milestoneTitle(9)).toBeNull();
  expect(milestoneTitle(31)).toBe("Orbkeeper");
  expect(milestoneTitle(50)).toBe("Golden Legend");
  expect(nextMilestone(31)?.level).toBe(40);
  expect(nextMilestone(50)).toBeUndefined();
});

test("a big sync can pass two milestones at once", () => {
  expect(milestonesBetween(29, 41).map((m) => m.level)).toEqual([30, 40]);
  expect(milestonesBetween(40, 49)).toEqual([]);
  expect(milestoneText(MILESTONES[3]!)).toBe("Nebula visor, 🪙 1000 and the Starwalker title");
  expect(milestoneText(MILESTONES[4]!)).toBe(
    "Golden regalia, a golden aura and a crown for your pet, 🪙 2500 and the Golden Legend title",
  );
});
