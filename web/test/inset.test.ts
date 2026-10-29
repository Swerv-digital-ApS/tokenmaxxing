import { expect, test } from "bun:test";
import { computeInsets } from "../src/game/inset.ts";

const rect = (left: number, top: number, w: number, h: number) => ({
  left,
  top,
  right: left + w,
  bottom: top + h,
});

test("a lone corner chip leaves the picture alone", () => {
  const i = computeInsets([rect(12, 12, 40, 30)], 1440, 900);
  expect(i.top + i.left + i.right + i.bottom).toBeLessThan(30);
});

test("a chat and a map along the bottom lift the picture", () => {
  const i = computeInsets([rect(12, 640, 400, 250), rect(1220, 660, 200, 230)], 1440, 900);
  expect(i.bottom).toBeGreaterThan(100);
  expect(i.left).toBe(0);
});

test("on a phone the top bar and the bottom tray count in full", () => {
  const i = computeInsets([rect(8, 8, 374, 44), rect(8, 790, 150, 44)], 390, 844);
  expect(i.top).toBeGreaterThan(40);
  expect(i.bottom).toBeGreaterThan(25);
});
