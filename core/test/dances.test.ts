import { expect, test } from "bun:test";
import {
  AURA_FULL_MS,
  auraOf,
  DANCE_ITEMS,
  DANCES,
  danceId,
  danceOfItem,
  inBattle,
  isFree,
  knownDances,
} from "../src/dances.ts";
import { isTradeable, itemById } from "../src/shop.ts";
import { shopForSlot } from "../src/shoprooms.ts";

test("dances are numbered from 1 with no gaps, and every one has a name, an emoji and a line", () => {
  expect(DANCES.map((d) => d.index)).toEqual(DANCES.map((_, i) => i + 1));
  expect(new Set(DANCES.map((d) => d.move)).size).toBe(DANCES.length);
  for (const d of DANCES) {
    expect(d.name.length).toBeGreaterThan(0);
    expect(d.emoji.length).toBeGreaterThan(0);
    expect(d.blurb.length).toBeGreaterThan(0);
  }
});

test("two are free for everyone; the rest are sold at Thread & Token, once, and never traded", () => {
  expect(DANCES.filter(isFree).map((d) => d.name)).toEqual(["Two-step", "Raise the roof"]);
  expect(DANCE_ITEMS.length).toBe(DANCES.length - 2);
  for (const i of DANCE_ITEMS) {
    expect(itemById(i.id)).toBe(i);
    expect(i.price).toBeGreaterThan(0);
    expect(isTradeable(i.id)).toBe(false);
    expect(danceOfItem(i.id)?.index).toBe(i.index);
  }
  expect(itemById(danceId(1))).toBeUndefined();
  expect(shopForSlot("dance")).toBe("clothes");
  expect(danceOfItem("dance.0")).toBeUndefined();
  expect(danceOfItem("dance.1e3")).toBeUndefined();
});

test("you know the free dances and the ones in your bag", () => {
  expect(knownDances([]).map((d) => d.index)).toEqual([1, 2]);
  expect(knownDances(["dance.15", "hat.1", "dance.3"]).map((d) => d.index)).toEqual([1, 2, 3, 15]);
});

test("aura dances are the trend's, each in its own colour", () => {
  const aura = DANCES.filter((d) => d.aura);
  expect(aura.map((d) => d.move)).toEqual(["boat", "unbothered", "powerup", "domain", "levitate"]);
  for (const d of aura) expect(d.aura).toMatch(/^#[0-9a-f]{6}$/);
});

test("aura builds up over half a minute and holds; a clock running behind counts as none yet", () => {
  expect(auraOf(1000, 1000)).toBe(0);
  expect(auraOf(1000, 500)).toBe(0);
  expect(auraOf(0, AURA_FULL_MS / 2)).toBeGreaterThan(0.5);
  expect(auraOf(0, AURA_FULL_MS)).toBe(1);
  expect(auraOf(0, AURA_FULL_MS * 10)).toBe(1);
});

test("an aura battle is within three tiles, either way or across", () => {
  expect(inBattle({ x: 0, y: 0 }, { x: 3, y: 3 })).toBe(true);
  expect(inBattle({ x: 0, y: 0 }, { x: 4, y: 0 })).toBe(false);
});
