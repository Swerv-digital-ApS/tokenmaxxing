import { expect, test } from "bun:test";
import { ITEMS, itemById, itemsIn, levelItems } from "../src/shop.ts";
import { WARDROBE, WARDROBE_OPTIONS } from "../src/wardrobe.ts";
import { defaultLook, LOOK_OPTIONS, parseLook } from "../src/world.ts";

test("every wardrobe slot is filled from 1 with no gaps, and every item is a valid look", () => {
  for (const slot of ["held", "back", "petwear"] as const) {
    const indices = WARDROBE.filter((i) => i.slot === slot).map((i) => i.index);
    expect(indices).toEqual(Array.from({ length: WARDROBE_OPTIONS[slot] - 1 }, (_, i) => i + 1));
  }
  // Outfits carry on from the shop's last one (12, the server-rack armour).
  expect(WARDROBE.filter((i) => i.slot === "outfit").map((i) => i.index)[0]).toBe(13);
  for (const i of WARDROBE) expect(i.index).toBeLessThan(LOOK_OPTIONS[i.slot as keyof typeof LOOK_OPTIONS]);
  expect(WARDROBE.length).toBeGreaterThanOrEqual(30);
});

test("ids are unique across the whole shop, and each one has a rarity and flavour", () => {
  expect(new Set(ITEMS.map((i) => i.id)).size).toBe(ITEMS.length);
  for (const i of WARDROBE) {
    expect(itemById(i.id)).toBe(i);
    expect(i.rarity).toBeDefined();
    expect(i.blurb?.length).toBeGreaterThan(0);
  }
});

test("the rarest are earned at levels 5, 15, 25 and 50 and can't be traded; the rest are sold", () => {
  const earned = WARDROBE.filter((i) => i.level !== undefined);
  expect(earned.map((i) => [i.name, i.level])).toEqual([
    ["Golden regalia", 50],
    ["Rubber duck", 5],
    ["Cape", 15],
    ["Jetpack", 25],
  ]);
  expect(levelItems(5).map((i) => i.id)).toEqual(["held.2"]);
  for (const i of earned) expect([i.price, i.tradeable]).toEqual([0, false]);
  for (const i of WARDROBE.filter((i) => i.level === undefined)) {
    expect(i.price).toBeGreaterThan(0);
    expect(i.tradeable).toBe(true);
  }
});

test("old looks gain empty wardrobe slots; worn ones are shop items", () => {
  const old = { style: 1, skin: 0, hair: 2, outfit: 3, glasses: 0, hat: 0, pet: 0 };
  expect(parseLook(old)).toEqual({
    ...old,
    held: 0,
    back: 0,
    petwear: 0,
    petVariant: 0,
    merch: 0,
    merchWorn: 0,
  });
  expect(defaultLook(7)).toMatchObject({ held: 0, back: 0, petwear: 0 });
  expect(parseLook({ ...old, held: WARDROBE_OPTIONS.held })).toBeNull();
  const look = parseLook({ ...old, outfit: 14, held: 1, back: 2, pet: 3, petwear: 4 })!;
  expect(itemsIn(look).map((i) => i.name)).toEqual([
    "Dog",
    "Rain jacket (Copenhagen edition)",
    "Coffee mug",
    "Jetpack",
    "Party hat",
  ]);
});
