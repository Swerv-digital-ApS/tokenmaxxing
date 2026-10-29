import { describe, expect, test } from "bun:test";
import { CASE_ITEMS } from "../src/case.ts";
import { CASE_PIECES } from "../src/case-furniture.ts";
import { NUSANTARA_ITEMS } from "../src/case-nusantara.ts";
import { NUSANTARA_PIECES } from "../src/case-nusantara-furniture.ts";
import {
  CASE_SHELVES,
  CASES,
  type CaseDef,
  caseById,
  caseOfItem,
  rollCase,
  slideOfShelf,
  VENDOR_COINS,
} from "../src/cases.ts";
import { RARITIES, type Rarity } from "../src/rarity.ts";
import type { Item } from "../src/shop.ts";
import { SHOPS, shelfAt } from "../src/shoprooms.ts";

/** A small seeded generator, so the distribution test is repeatable. */
const seeded = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const night = caseById("night-market")!;
const fake = (id: string, rarity: Rarity): Item => ({
  id,
  slot: "hat",
  index: 0,
  name: id,
  price: 0,
  tradeable: true,
  rarity,
});
const mini = (items: Item[]): CaseDef => ({ ...night, items });
const none = new Set<string>();

describe("cases", () => {
  test("every case has a shelf on Natmarked's back wall", () => {
    expect(CASES.length).toBeLessThanOrEqual(CASE_SHELVES);
  });

  test("E on a shelf opens the case on it: both tiles of a shelf, locked shelves on Coming soon", () => {
    const tiles = SHOPS.natmarked.displays.map(([x, y]) => shelfAt(x, y));
    expect(tiles).toEqual(Array.from({ length: CASE_SHELVES * 2 }, (_, i) => Math.floor(i / 2)));
    expect(shelfAt(0, 0)).toBeNull();
    // A case's shelf opens on that case; the counter (no shelf) on the first.
    for (let i = 0; i < CASES.length; i++) expect(slideOfShelf(i)).toBe(i);
    expect(slideOfShelf(undefined)).toBe(0);
    // A shelf with no case yet opens the locked slide, one past the last case, while a shelf is empty.
    if (CASES.length < CASE_SHELVES) expect(slideOfShelf(CASES.length)).toBe(CASES.length);
    expect(slideOfShelf(CASE_SHELVES + 3)).toBe(CASES.length < CASE_SHELVES ? CASES.length : 0);
  });

  test("odds sum to 1, the night market exists, vendor pays by rarity", () => {
    for (const c of CASES) expect(Object.values(c.odds).reduce((a, b) => a + b, 0)).toBeCloseTo(1, 10);
    expect(night.keyPrice).toBe(75);
    expect(caseById("nope")).toBeUndefined();
    expect(VENDOR_COINS.legendary).toBe(50);
    expect(night.items.length).toBeGreaterThanOrEqual(32);
    expect(new Set(night.items.map((i) => i.id)).size).toBe(night.items.length);
    expect(night.items.every((i) => i.case)).toBe(true);
  });

  test("tier distribution over 200k rolls follows the odds", () => {
    // A pool with every tier, so nothing falls through.
    const def = mini(RARITIES.flatMap((r) => [fake(`${r}1`, r), fake(`${r}2`, r)]));
    const rand = seeded(42);
    const n = 200_000;
    const seen: Record<string, number> = {};
    for (let i = 0; i < n; i++) {
      const { tier } = rollCase(def, rand, none, 0);
      seen[tier] = (seen[tier] ?? 0) + 1;
    }
    for (const r of RARITIES) expect(Math.abs((seen[r] ?? 0) / n - def.odds[r])).toBeLessThan(0.006);
  });

  test("the tenth opening is rare or better after nine dry ones, whatever the dice say", () => {
    const def = mini(RARITIES.flatMap((r) => [fake(`${r}1`, r)]));
    const low = () => 0; // always common when unguaranteed
    expect(rollCase(def, low, none, 8).tier).toBe("common");
    expect(rollCase(def, low, none, 9).tier).toBe("rare");
    // Over a long run with a counter, no 10 in a row below rare.
    const rand = seeded(7);
    let dry = 0;
    let worst = 0;
    for (let i = 0; i < 50_000; i++) {
      const { tier } = rollCase(def, rand, none, dry);
      dry = RARITIES.indexOf(tier) >= 2 ? 0 : dry + 1;
      worst = Math.max(worst, dry);
    }
    expect(worst).toBeLessThanOrEqual(9);
  });

  test("a dupe is drawn again once, within its tier", () => {
    const def = mini([fake("a", "common"), fake("b", "common"), fake("c", "rare")]);
    const owned = new Set(["a"]);
    // First draw 0 -> a (owned), second 0.9 -> b.
    const seq = [0, 0, 0.9];
    expect(rollCase(def, () => seq.shift() ?? 0, owned, 0).item.id).toBe("b");
    // Both draws land on the owned one: it stays (one reroll only).
    const same = [0, 0, 0];
    expect(rollCase(def, () => same.shift() ?? 0, owned, 0).item.id).toBe("a");
    // Never leaves the tier.
    for (let i = 0; i < 100; i++) {
      const r = rollCase(def, seeded(i), new Set(["a", "b"]), 0);
      expect(r.item.rarity).toBe(r.tier);
    }
  });

  test("an empty tier falls to the next lower one with items", () => {
    const def = mini([fake("a", "common"), fake("r", "rare")]);
    // legendary roll (0.99) with no legendary, epic or uncommon items: lands on rare.
    expect(rollCase(def, () => 0.99, none, 0)).toMatchObject({ tier: "rare" });
    // uncommon roll (0.6) falls to common.
    const seq = [0.6, 0];
    expect(rollCase(def, () => seq.shift() ?? 0, none, 0).tier).toBe("common");
    // Nothing below common: goes up.
    const up = mini([fake("r", "rare")]);
    expect(rollCase(up, () => 0, none, 0).tier).toBe("rare");
  });
});

describe("the Nusantara case", () => {
  const nus = caseById("nusantara")!;

  test("is a second case with the Night Market's odds and guarantee, a 100 coin key, and only its own items", () => {
    expect(CASES.map((c) => c.id)).toEqual(["night-market", "nusantara", "ragnarok-eve"]);
    expect(nus).toMatchObject({ name: "Nusantara case", keyPrice: 100, rareWithin: 10, dupeRerolls: 1 });
    expect(nus.odds).toEqual(night.odds);
    expect(nus.blurb.length).toBeGreaterThan(20);
    expect(nus.items).toHaveLength(NUSANTARA_ITEMS.length + NUSANTARA_PIECES.length);
    expect(nus.items.map((i) => i.id).sort()).toEqual(
      [...NUSANTARA_ITEMS.map((i) => i.id), ...NUSANTARA_PIECES.map((p) => `furn.${p.ch}`)].sort(),
    );
    expect(nus.items.every((i) => i.case)).toBe(true);
  });

  test("the Night Market's pool is exactly what it was: 30 cosmetics and 6 pieces, none of the Nusantara's", () => {
    expect(night.items).toHaveLength(CASE_ITEMS.length + CASE_PIECES.length);
    expect(night.items).toHaveLength(36);
    const ids = new Set(night.items.map((i) => i.id));
    for (const i of nus.items) expect(ids.has(i.id)).toBe(false);
  });

  test("an item belongs to one case; the two pools split the rarities alike", () => {
    for (const i of nus.items) expect(caseOfItem(i.id)).toBe(nus);
    for (const i of night.items) expect(caseOfItem(i.id)).toBe(night);
    const tiers = (c: CaseDef) =>
      RARITIES.map((r) => c.items.filter((i) => (i.rarity ?? "common") === r).length);
    // 11 + 3 pieces, 6 + 2, 5 + 1, 4, 4.
    expect(tiers(nus)).toEqual([14, 8, 6, 4, 4]);
    expect(tiers(nus)).toEqual(tiers(night));
  });

  test("a roll only ever gives one of its items, and every item can be rolled", () => {
    const rand = seeded(11);
    const seen = new Set<string>();
    for (let i = 0; i < 20_000; i++) {
      const { item } = rollCase(nus, rand, none, i % 10);
      expect(nus.items.includes(item)).toBe(true);
      seen.add(item.id);
    }
    expect(seen.size).toBe(nus.items.length);
  });

  test("the tenth opening is rare or better, counted on its own", () => {
    const low = () => 0;
    expect(rollCase(nus, low, none, 8).tier).toBe("common");
    expect(["rare", "epic", "legendary"]).toContain(rollCase(nus, low, none, 9).tier);
  });
});
