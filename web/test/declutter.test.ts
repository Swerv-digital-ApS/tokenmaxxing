import { expect, test } from "bun:test";
import { declutterTags, TAG_H, type TagSlot } from "../src/render3d/engine/declutter.ts";

const slot = (tx: number, ty: number, tdist: number): TagSlot => ({
  tx,
  ty,
  tdist,
  tshift: 0,
  talpha: 1,
  thide: false,
});

test("tags that would cover each other stack, the nearest keeps its place", () => {
  const items = [slot(100, 200, 8), slot(104, 200, 2), slot(98, 200, 4)];
  declutterTags(items, 3, 12);
  expect(items[0]!.tdist).toBe(2);
  expect(items[0]!.tshift).toBe(0);
  expect(items[1]!.tshift).toBe(TAG_H);
  expect(items[2]!.tshift).toBe(TAG_H * 2);
  expect(items.every((s) => !s.thide)).toBe(true);
});

test("a crowd past the cap, or past the lifts, hides the farthest", () => {
  const pile = Array.from({ length: 8 }, (_, i) => slot(100, 200, i));
  declutterTags(pile, 8, 12);
  expect(pile.filter((s) => !s.thide).length).toBe(4);
  const spread = Array.from({ length: 6 }, (_, i) => slot(i * 300, 200, i));
  declutterTags(spread, 6, 3);
  expect(spread.filter((s) => !s.thide).length).toBe(3);
  expect(spread[5]!.thide).toBe(true);
});

test("farther tags fade, but never away", () => {
  const items = [slot(0, 0, 1), slot(500, 0, 9), slot(1000, 0, 40)];
  declutterTags(items, 3, 12);
  expect(items[0]!.talpha).toBe(1);
  expect(items[1]!.talpha).toBeLessThan(1);
  expect(items[2]!.talpha).toBeGreaterThanOrEqual(0.4);
});
