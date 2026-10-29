import { expect, test } from "bun:test";
import { canSit, ownSeatAt } from "../src/raidseat.ts";

test("E takes a seat only on its own seat tile or its desk", () => {
  const mine: [number, number] = [8, 9];
  expect(ownSeatAt(mine, 8, 9)).toBe(true);
  expect(ownSeatAt(mine, 8, 8)).toBe(true);
  expect(ownSeatAt(mine, 8, 10)).toBe(false);
  expect(ownSeatAt(mine, 9, 9)).toBe(false);
  // Someone else's seat, or the next row's: not mine.
  expect(ownSeatAt(mine, 10, 9)).toBe(false);
  expect(ownSeatAt(mine, 8, 11)).toBe(false);
});

test("without a seat nothing is offered", () => {
  expect(ownSeatAt(null, 8, 9)).toBe(false);
  expect(canSit("dungeon", null, "idle")).toBe(false);
});

test("you can sit in the dungeon when you have a seat and are standing about", () => {
  const seat: [number, number] = [8, 9];
  expect(canSit("dungeon", seat, "idle")).toBe(true);
  expect(canSit("town", seat, "idle")).toBe(false);
  expect(canSit("dungeon", seat, "away")).toBe(false);
  expect(canSit("dungeon", seat, "playing")).toBe(false);
  expect(canSit("dungeon", seat, "sit")).toBe(false);
});
