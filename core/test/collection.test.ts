import { expect, test } from "bun:test";
import { BADGES } from "../src/badges.ts";
import {
  CATALOG,
  type CollectionState,
  GROUPS,
  owned,
  ownedPins,
  PIN_MAX,
  resolvePins,
  titlesAt,
} from "../src/collection.ts";
import { MILESTONES } from "../src/milestones.ts";
import { TROPHIES } from "../src/trophies.ts";

const state: CollectionState = {
  userId: 1,
  badges: [
    { id: "shipper", tier: 3, value: 300, at: 5 },
    { id: "streak", tier: 1, value: 8, at: null },
    { id: "whale", tier: 0, value: 0, at: null },
  ],
  trophies: [
    { id: "3am", day: "2026-07-01" },
    { id: "million", day: "2026-07-02" },
  ],
  titles: [10],
};

test("every badge, trophy and milestone is in the catalogue once, in a group, with a way to earn it", () => {
  const ids = CATALOG.map((e) => e.id);
  expect(new Set(ids).size).toBe(ids.length);
  expect(CATALOG).toHaveLength(BADGES.length + TROPHIES.length + MILESTONES.length);
  for (const b of BADGES) expect(ids).toContain(`badge:${b.id}`);
  for (const t of TROPHIES) expect(ids).toContain(`trophy:${t.id}`);
  for (const e of CATALOG) {
    expect(GROUPS).toContain(e.group);
    expect(e.how.length).toBeGreaterThan(0);
    expect(e.name.length).toBeGreaterThan(0);
  }
  // Every group has something in it.
  for (const g of GROUPS) expect(CATALOG.some((e) => e.group === g)).toBe(true);
});

test("pins resolve to what's owned: in order, once each, no more than PIN_MAX", () => {
  expect(PIN_MAX).toBe(3);
  const views = resolvePins(state, [{ id: "trophy:3am" }, { id: "badge:shipper" }]);
  expect(views.map((v) => v.id)).toEqual(["trophy:3am", "badge:shipper"]);
  expect(views[1]).toMatchObject({ kind: "badge", tier: 3, frame: "gold", rarity: "epic", at: 5 });
  expect(views[1]!.name).toBe("Shipper: 250 PRs");
  expect(views[0]).toMatchObject({ kind: "trophy", name: "3 AM PR", at: Date.parse("2026-07-01T12:00:00Z") });
  const many = resolvePins(state, [
    { id: "badge:shipper" },
    { id: "badge:shipper" },
    { id: "badge:streak" },
    { id: "trophy:3am" },
    { id: "trophy:million" },
  ]);
  expect(many.map((v) => v.id)).toEqual(["badge:shipper", "badge:streak", "trophy:3am"]);
});

test("pins that aren't owned, or aren't pinnable, are dropped silently", () => {
  expect(
    resolvePins(state, [
      { id: "badge:whale" },
      { id: "badge:nope" },
      { id: "trophy:storm" },
      { id: "title:10" },
      { id: "garbage" },
      { id: "badge:streak" },
    ]).map((v) => v.id),
  ).toEqual(["badge:streak"]);
});

test("the picker offers everything owned and pinnable", () => {
  expect(ownedPins(state).map((v) => v.id)).toEqual([
    "badge:streak",
    "badge:shipper",
    "trophy:million",
    "trophy:3am",
  ]);
});

test("how much of the log someone has", () => {
  expect(owned(state)).toEqual({ have: 2 + 2 + 1, of: CATALOG.length });
  expect(titlesAt(0)).toEqual([]);
  expect(titlesAt(30)).toEqual([10, 20, 30]);
});
