import { describe, expect, test } from "bun:test";
import { ALL_CASE_ITEMS, CASE_BASE, CASE_ITEMS, caseAt } from "../src/case.ts";
import { NUSANTARA_BASE, NUSANTARA_ITEMS } from "../src/case-nusantara.ts";
import { EDITIONS } from "../src/editions.ts";
import { HEADWEAR_ITEMS } from "../src/headwear.ts";
import { LOOT } from "../src/loot.ts";
import { ITEMS, itemById } from "../src/shop.ts";
import { WARDROBE } from "../src/wardrobe.ts";
import { defaultLook, parseLook } from "../src/world.ts";

const others = [...ITEMS.filter((i) => !i.case), ...EDITIONS, ...HEADWEAR_ITEMS, ...WARDROBE, ...LOOT];

test("a case item is new: no id or name matches the shop, wardrobe, headwear, editions or raid loot", () => {
  const names = new Set(others.map((i) => i.name.toLowerCase()));
  const ids = new Set(others.map((i) => i.id));
  for (const c of ALL_CASE_ITEMS) {
    expect(names.has(c.name.toLowerCase())).toBe(false);
    expect(ids.has(c.id)).toBe(false);
  }
});

test("case items are unique among themselves, tradeable, free of a price, and above CASE_BASE", () => {
  expect(new Set(CASE_ITEMS.map((c) => c.id)).size).toBe(CASE_ITEMS.length);
  expect(new Set(CASE_ITEMS.map((c) => c.name.toLowerCase())).size).toBe(CASE_ITEMS.length);
  for (const c of CASE_ITEMS) {
    expect(c.index).toBeGreaterThanOrEqual(CASE_BASE);
    expect(c).toMatchObject({ price: 0, tradeable: true });
    expect(itemById(c.id)).toBe(c);
  }
});

test("caseAt finds a case item by slot and index, and nothing for a shop index", () => {
  const c = CASE_ITEMS[0]!;
  expect(caseAt(c.slot, c.index)).toBe(c);
  expect(caseAt(c.slot, 1)).toBeUndefined();
});

test("the four auras are legendary, tradeable, and in the aura slot", () => {
  const auras = CASE_ITEMS.filter((c) => c.slot === "aura");
  expect(auras.map((a) => [a.name, a.index, a.rarity, a.tradeable])).toEqual([
    ["Lantern Sky", 300, "legendary", true],
    ["Sakura Storm", 301, "legendary", true],
    ["Firefly Swarm", 302, "legendary", true],
    ["Koi Current", 303, "legendary", true],
  ]);
});

test("a look wears an aura 200..203, an old look without the field still parses, 999 is refused", () => {
  const look = defaultLook(1);
  for (const aura of [300, 301, 302, 303]) expect(parseLook({ ...look, aura })?.aura).toBe(aura);
  const old = { ...look };
  expect(parseLook(old)).toEqual(look);
  expect(parseLook(old)?.aura).toBeUndefined();
  expect(parseLook({ ...look, aura: 0 })).toEqual(look);
  expect(parseLook({ ...look, aura: 999 })).toBeNull();
  expect(parseLook({ ...look, aura: 1 })).toBeNull();
});

describe("the Nusantara case", () => {
  test("its 30 cosmetics: 11 common, 6 uncommon, 5 rare, 4 epic and 4 legendary auras, as the Night Market's", () => {
    const count = (list: readonly { rarity: string }[]) =>
      Object.fromEntries(
        ["common", "uncommon", "rare", "epic", "legendary"].map((r) => [
          r,
          list.filter((i) => i.rarity === r).length,
        ]),
      );
    expect(count(NUSANTARA_ITEMS)).toEqual({ common: 11, uncommon: 6, rare: 5, epic: 4, legendary: 4 });
    expect(count(NUSANTARA_ITEMS)).toEqual(count(CASE_ITEMS));
    expect(NUSANTARA_ITEMS.filter((i) => i.rarity === "legendary").every((i) => i.slot === "aura")).toBe(
      true,
    );
  });

  test("indices are 400 and up, one per slot and number, and clear of the Night Market's 300 to 399", () => {
    expect(NUSANTARA_BASE).toBe(400);
    for (const c of NUSANTARA_ITEMS) {
      expect(c.index).toBeGreaterThanOrEqual(NUSANTARA_BASE);
      expect(c.index).toBeLessThan(500);
      expect(c.id).toBe(`${c.slot}.${c.index}`);
      expect(c).toMatchObject({ price: 0, tradeable: true, case: true });
      expect(c.blurb.length).toBeGreaterThan(10);
      expect(itemById(c.id)).toBe(c);
    }
    for (const c of CASE_ITEMS) expect(c.index).toBeLessThan(NUSANTARA_BASE);
    expect(new Set(ALL_CASE_ITEMS.map((c) => c.id)).size).toBe(ALL_CASE_ITEMS.length);
    expect(new Set(NUSANTARA_ITEMS.map((c) => c.name.toLowerCase())).size).toBe(NUSANTARA_ITEMS.length);
    // Each slot counts up from 0 without a gap.
    for (const slot of new Set(NUSANTARA_ITEMS.map((c) => c.slot))) {
      const ns = NUSANTARA_ITEMS.filter((c) => c.slot === slot)
        .map((c) => c.index - NUSANTARA_BASE)
        .sort((a, b) => a - b);
      expect(ns).toEqual(ns.map((_, i) => i));
    }
  });

  test("caseAt resolves both cases' items, and refuses an index of neither", () => {
    for (const c of ALL_CASE_ITEMS) expect(caseAt(c.slot, c.index)).toBe(c);
    expect(caseAt("aura", 300)?.name).toBe("Lantern Sky");
    expect(caseAt("aura", 400)?.name).toBe("Mega Mendung");
    expect(caseAt("pet", 405)?.name).toBe("Orangutan");
    expect(caseAt("hat", 406)).toBeUndefined();
    expect(caseAt("aura", 700)).toBeUndefined();
    // A slot's index in another slot is not an item.
    expect(caseAt("hat", 400 + 4)).toBeUndefined();
  });

  test("the shop catalogue carries them as free, tradeable case items, found by slot and index too", () => {
    for (const c of NUSANTARA_ITEMS) {
      expect(ITEMS.filter((i) => i.id === c.id)).toHaveLength(1);
      expect(itemById(c.id)).toMatchObject({ price: 0, tradeable: true, case: true, rarity: c.rarity });
    }
  });

  test("a look wears a Nusantara aura, pet, hat and outfit; 404 aura and an unknown 450 are refused", () => {
    const look = defaultLook(1);
    for (const aura of [400, 401, 402, 403]) expect(parseLook({ ...look, aura })?.aura).toBe(aura);
    expect(parseLook({ ...look, aura: 404 })).toBeNull();
    expect(parseLook({ ...look, hat: 403 })?.hat).toBe(403);
    expect(parseLook({ ...look, outfit: 405 })?.outfit).toBe(405);
    expect(parseLook({ ...look, glasses: 402 })?.glasses).toBe(402);
    expect(parseLook({ ...look, pet: 405 })?.pet).toBe(405);
    expect(parseLook({ ...look, hat: 450 })).toBeNull();
    expect(parseLook({ ...look, aura: 300 })?.aura).toBe(300);
  });
});
