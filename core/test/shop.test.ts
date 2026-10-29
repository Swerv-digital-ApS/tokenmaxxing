import { expect, test } from "bun:test";
import { CROWN } from "../src/fastelavn.ts";
import { TOUCHED_GRASS } from "../src/picnic.ts";
import {
  canDropIn,
  coinsForTokens,
  ITEMS,
  isKeepsake,
  isTradeable,
  itemById,
  levelItems,
  parseSide,
  TOKEN_COIN_MULT_FROM,
  TOKEN_COINS_FROM,
} from "../src/shop.ts";
import { LOOK_OPTIONS } from "../src/world.ts";

test("level items: the shop's milestones at 10-50, the wardrobe's at 5, 15, 25, the head pack's at 7, 17, 27", () => {
  expect(levelItems(4)).toEqual([]);
  expect(levelItems(10).map((i) => i.name)).toEqual(["Top hat", "Rubber-duck hat", "Rubber duck"]);
  expect(
    levelItems(50)
      .map((i) => i.level)
      .sort((a, b) => a! - b!),
  ).toEqual([5, 7, 10, 15, 17, 20, 25, 27, 30, 40, 50]);
  expect(
    levelItems(50)
      .filter((i) => i.level! >= 40)
      .map((i) => i.name),
  ).toEqual(["Nebula visor", "Golden regalia"]);
  // One reward a level.
  expect(new Set(levelItems(Infinity).map((i) => i.level)).size).toBe(levelItems(Infinity).length);
  for (const i of ITEMS.filter((i) => i.level !== undefined)) {
    expect(i.price).toBe(0);
    // Rewards are all wearables.
    expect(i.index).toBeLessThan(LOOK_OPTIONS[i.slot as keyof typeof LOOK_OPTIONS]);
  }
});

test("rewards never change hands; furniture is sold and does", () => {
  expect(levelItems(50).some((i) => isTradeable(i.id))).toBe(false);
  expect([isTradeable("hat.1"), isTradeable("furn.s"), isTradeable("nope")]).toEqual([true, true, false]);
  expect(itemById("furn.t")).toMatchObject({ slot: "furniture", name: "TV", price: 180 });
  expect(parseSide({ coins: 0, items: ["hat.4"] })).toBeNull();
  expect(parseSide({ coins: 5, items: ["furn.s", "hat.1"] })).toEqual({
    coins: 5,
    items: ["furn.s", "hat.1"],
  });
});

test("no two items share a slot and index: a look's number means one thing", () => {
  const worn = ITEMS.filter((i) => i.slot !== "furniture").map((i) => `${i.slot}.${i.index}`);
  expect(new Set(worn).size).toBe(worn.length);
});

test("Touched grass: earned at a picnic, never sold or traded, and only for your own office's floor", () => {
  expect(itemById(TOUCHED_GRASS)).toMatchObject({
    slot: "furniture",
    name: "Touched grass",
    price: 0,
    tradeable: false,
  });
  expect(itemById(TOUCHED_GRASS)?.earned).toBeTruthy();
  // Nothing else is earned but the kattekonge's crown (`fastelavn.ts`): the shop sells the rest.
  expect(ITEMS.filter((i) => i.earned).map((i) => i.id)).toEqual([CROWN, TOUCHED_GRASS]);
  expect([isKeepsake(TOUCHED_GRASS), isKeepsake("furn.s"), isKeepsake("hat.4")]).toEqual([
    true,
    false,
    false,
  ]);
  expect(parseSide({ coins: 0, items: [TOUCHED_GRASS] })).toBeNull();
  expect(canDropIn(TOUCHED_GRASS, "office:7", 7)).toBe(true);
  expect(canDropIn(TOUCHED_GRASS, "office:8", 7)).toBe(false);
  expect(canDropIn(TOUCHED_GRASS, "town", 7)).toBe(false);
  expect(canDropIn("furn.s", "town", 7)).toBe(true);
  expect(canDropIn("hat.4", "office:7", 7)).toBe(false);
  expect(canDropIn("nope", "office:7", 7)).toBe(false);
});

test("a day's tokens pay the square root before 27 Oct, 2.5 × (millions)^0.6 on 27 Oct, and 1.5 × (millions)^0.6 from 28 Oct", () => {
  const tokens = [10e6, 120e6, 600e6, 1.5e9];
  // Earlier days are not paid again: they keep the square root.
  const before = "2026-10-26";
  expect(before < TOKEN_COINS_FROM).toBe(true);
  expect(tokens.map((t) => coinsForTokens(t, before))).toEqual([3, 10, 24, 38]);
  // 27 Oct keeps the 2.5 rate it was paid at.
  expect(TOKEN_COINS_FROM < TOKEN_COIN_MULT_FROM).toBe(true);
  expect(tokens.map((t) => coinsForTokens(t, TOKEN_COINS_FROM))).toEqual([9, 44, 116, 201]);
  // From 28 Oct, the 1.5 rate, and today (no day) is the same.
  expect(tokens.map((t) => coinsForTokens(t, TOKEN_COIN_MULT_FROM))).toEqual([5, 26, 69, 120]);
  expect(coinsForTokens(1.5e9)).toBe(120);
  expect(coinsForTokens(-5, before)).toBe(0);
  expect(coinsForTokens(-5, TOKEN_COIN_MULT_FROM)).toBe(0);
});
