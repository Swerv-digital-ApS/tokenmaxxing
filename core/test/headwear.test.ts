import { expect, test } from "bun:test";
import { EDITION_BASE } from "../src/editions.ts";
import { FACE_COUNT, HAT_COUNT, HEADWEAR_ITEMS, PACK_FACES, PACK_HATS } from "../src/headwear.ts";
import { LOOT_COUNT } from "../src/loot.ts";
import { RARITIES, rarityForPrice, rarityOf } from "../src/rarity.ts";
import { ITEMS, itemById, itemsIn } from "../src/shop.ts";
import { LOOK_OPTIONS, parseLook } from "../src/world.ts";

test("the pack is 30-odd hats and face things, every one wearable", () => {
  expect(HEADWEAR_ITEMS.length).toBeGreaterThanOrEqual(30);
  // Raid loot comes after the pack (`LOOT_FIRST`).
  expect(HAT_COUNT).toBe(5 + PACK_HATS.length);
  expect(FACE_COUNT).toBe(4 + PACK_FACES.length);
  expect(LOOK_OPTIONS.hat).toBe(HAT_COUNT + LOOT_COUNT.hat);
  expect(LOOK_OPTIONS.glasses).toBe(FACE_COUNT + LOOT_COUNT.glasses);
  const look = {
    style: 0,
    skin: 0,
    hair: 0,
    outfit: 0,
    glasses: FACE_COUNT - 1,
    hat: HAT_COUNT - 1,
    pet: 0,
    held: 0,
    back: 0,
    petwear: 0,
    petVariant: 0,
    merch: 0,
    merchWorn: 0,
  };
  expect(parseLook(look)).toEqual(look);
  expect(parseLook({ ...look, hat: LOOK_OPTIONS.hat })).toBeNull();
  expect(itemsIn(look).map((i) => i.name)).toEqual(["Aurora crown", "Nebula visor"]);
});

test("ids and names are unique across the whole shop", () => {
  expect(new Set(ITEMS.map((i) => i.id)).size).toBe(ITEMS.length);
  expect(new Set(ITEMS.map((i) => i.name)).size).toBe(ITEMS.length);
  expect(itemById("hat.18")).toMatchObject({ name: "Viking helmet", price: 450, tradeable: true });
  expect(itemById("glasses.13")).toMatchObject({ name: "Rate-limit visor", rarity: "uncommon" });
});

test("a sold item's rarity is what its price says; rewards name theirs", () => {
  for (const i of HEADWEAR_ITEMS) {
    expect(i.blurb?.length).toBeGreaterThan(0);
    if (i.level === undefined) expect(rarityForPrice(i.price)).toBe(i.rarity!);
    else expect([i.price, i.tradeable]).toEqual([0, false]);
  }
  // Every rarity has something in it.
  expect(RARITIES.every((r) => HEADWEAR_ITEMS.some((i) => i.rarity === r))).toBe(true);
  // Older items go by price; their level rewards are epic.
  expect(rarityOf(itemById("hat.4")!)).toBe("epic");
  expect([
    rarityOf(itemById("glasses.1")!),
    rarityOf(itemById("hat.3")!),
    rarityOf(itemById("pet.4")!),
  ]).toEqual(["common", "rare", "legendary"]);
});

test("the pack can never grow into the merchant editions' indices", () => {
  expect(HAT_COUNT).toBeLessThanOrEqual(EDITION_BASE);
  expect(FACE_COUNT).toBeLessThanOrEqual(EDITION_BASE);
  for (const i of HEADWEAR_ITEMS) expect(i.index).toBeLessThan(EDITION_BASE);
});
