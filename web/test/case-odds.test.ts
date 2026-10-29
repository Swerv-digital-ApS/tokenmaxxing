import { expect, test } from "bun:test";
import { CASES, VENDOR_COINS } from "@tokenmaxxing/core/cases.ts";
import { RARITIES } from "@tokenmaxxing/core/rarity.ts";
import { itemChances, percent, spareCopies, tierChances } from "../src/hud/caseOdds.ts";

const night = CASES[0]!;

test("every item's chance is its tier's chance split over the tier, and they sum to one", () => {
  const rows = itemChances(night);
  expect(rows).toHaveLength(night.items.length);
  expect(rows.reduce((a, r) => a + r.chance, 0)).toBeCloseTo(1, 9);
  const tiers = tierChances(night);
  for (const r of RARITIES) {
    const inTier = rows.filter((x) => x.tier === r);
    for (const x of inTier) expect(x.chance).toBeCloseTo(tiers[r] / inTier.length, 12);
  }
});

test("an empty tier hands its chance to the next lower tier that has items", () => {
  const only = night.items.filter((i) => (i.rarity ?? "common") !== "legendary");
  const tiers = tierChances({ ...night, items: only });
  expect(tiers.legendary).toBe(0);
  expect(tiers.epic).toBeCloseTo(night.odds.epic + night.odds.legendary, 12);
});

test("percentages read plainly", () => {
  expect(percent(0.475)).toBe("47.5%");
  expect(percent(0.0125)).toBe("1.25%");
  expect(percent(0.5)).toBe("50%");
  expect(percent(0.05)).toBe("5%");
});

test("spare copies are everything past the first of each item, at the vendor's price", () => {
  const [a, b] = night.items;
  const bag = [
    { item: a!.id, count: 3 },
    { item: b!.id, count: 1 },
    { item: "not.in.the.case", count: 9 },
  ];
  const { copies, coins } = spareCopies(night, bag);
  expect(copies).toBe(2);
  expect(coins).toBe(2 * VENDOR_COINS[a!.rarity ?? "common"]);
  expect(spareCopies(night, [])).toEqual({ copies: 0, coins: 0 });
});
