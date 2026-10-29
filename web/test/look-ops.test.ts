import { expect, test } from "bun:test";
import type { Look } from "@tokenmaxxing/core/world.ts";
import { sameLook } from "../src/hud/lookOps.ts";

const look: Look = {
  style: 2,
  skin: 3,
  hair: 5,
  outfit: 5,
  glasses: 0,
  hat: 0,
  pet: 0,
  held: 1,
  back: 0,
  petwear: 0,
  petVariant: 0,
  merch: 0,
  merchWorn: 0,
};

test("a look is the same whatever order the server lists it in, and an empty pet name is no name", () => {
  const reordered = Object.fromEntries(Object.entries(look).reverse()) as unknown as Look;
  expect(sameLook(reordered, look)).toBe(true);
  expect(sameLook({ ...look, petName: "" }, look)).toBe(true);
  expect(sameLook({ ...look, hair: 4 }, look)).toBe(false);
  expect(sameLook({ ...look, petName: "Rex" }, look)).toBe(false);
});
