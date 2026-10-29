import { expect, test } from "bun:test";
import {
  hover,
  hoverStrength,
  LABEL_FAR,
  LABEL_NEAR,
  labelAlpha,
  nearAlpha,
  setHover,
} from "../src/game/near.ts";

test("labels are full up close, fade between near and far, and are gone past far", () => {
  expect(nearAlpha(0)).toBe(1);
  expect(nearAlpha(LABEL_NEAR)).toBe(1);
  expect(nearAlpha((LABEL_NEAR + LABEL_FAR) / 2)).toBeCloseTo(0.5);
  expect(nearAlpha(LABEL_FAR)).toBe(0);
  expect(nearAlpha(100)).toBe(0);
});

test("a hover brings a far label back, as far as the reveal has come in", () => {
  expect(labelAlpha(20)).toBe(0);
  expect(labelAlpha(20, 1, 1)).toBe(1);
  expect(labelAlpha(20, 1, 0.5)).toBe(0.5);
  expect(labelAlpha(20, 9, 1)).toBe(0);
  expect(labelAlpha(6.5, 1, 0.5)).toBeCloseTo(0.75);
  expect(labelAlpha(1, 20, 0)).toBe(1);
});

test("the hover eases in over the fade time and out again once the pointer leaves", () => {
  setHover({ x: 3, y: 4 }, 1000);
  expect(hoverStrength(1000)).toBe(0);
  expect(hoverStrength(1075)).toBeCloseTo(0.5);
  expect(hoverStrength(1400)).toBe(1);
  setHover(null, 2000);
  expect(hoverStrength(2075)).toBeCloseTo(0.5);
  expect(hover.x).toBe(3);
  expect(hoverStrength(2200)).toBe(0);
  expect(Number.isNaN(hover.x)).toBe(true);
  expect(hoverStrength(2300)).toBe(0);
});
