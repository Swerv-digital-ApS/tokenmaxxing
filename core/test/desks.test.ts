import { describe, expect, test } from "bun:test";
import {
  cleanDesk,
  DESKS,
  deskIndex,
  deskItem,
  effectiveDesk,
  LAPTOP,
  nextFleet,
  ownsDesk,
} from "../src/desks.ts";

describe("desk setups", () => {
  test("five tiers, unique ids, the laptop first and free, prices in the coin-sink range and rising", () => {
    expect(DESKS).toHaveLength(5);
    expect(new Set(DESKS.map((d) => d.id)).size).toBe(5);
    expect(DESKS[LAPTOP]).toMatchObject({ id: "laptop", price: 0, fleet: 0 });
    for (const [i, d] of DESKS.entries()) {
      if (i === 0) continue;
      expect(d.price).toBeGreaterThanOrEqual(60);
      expect(d.price).toBeLessThanOrEqual(900);
      expect(d.price).toBeGreaterThan(DESKS[i - 1]!.price);
      expect(d.fleet).toBeGreaterThan(DESKS[i - 1]!.fleet);
      // The company pays more than a person for the same tier: it's the whole house.
      expect(d.fleet).toBeGreaterThan(d.price);
    }
    expect(DESKS.filter((d) => d.level !== undefined).map((d) => d.id)).toEqual([
      "ultrawide",
      "battlestation",
    ]);
  });

  test("unknown ids and tiers are the laptop (old saves, old servers)", () => {
    expect(deskIndex(null)).toBe(0);
    expect(deskIndex("nope")).toBe(0);
    expect(deskIndex("triple")).toBe(2);
    for (const v of [undefined, null, -1, 1.5, 99, "2", Number.NaN]) expect(cleanDesk(v)).toBe(0);
    expect(cleanDesk(4)).toBe(4);
  });

  test("the setup at a company desk is the better of the sitter's and the house's", () => {
    expect(effectiveDesk(undefined)).toBe(0);
    expect(effectiveDesk(0, 0)).toBe(0);
    expect(effectiveDesk(1, 3)).toBe(3);
    expect(effectiveDesk(4, 2)).toBe(4);
    expect(effectiveDesk(2, undefined)).toBe(2);
    expect(effectiveDesk(undefined, 2)).toBe(2);
    expect(effectiveDesk(99, 1)).toBe(1);
  });

  test("owning: the laptop is free, bought ones need a purchase, high ones also come with a level", () => {
    const [laptop, dual, , ultra] = DESKS;
    expect(ownsDesk(laptop!, 0, new Set())).toBe(true);
    expect(ownsDesk(dual!, 99, new Set())).toBe(false);
    expect(ownsDesk(dual!, 0, new Set([deskItem("dual")]))).toBe(true);
    expect(ownsDesk(ultra!, 24, new Set())).toBe(false);
    expect(ownsDesk(ultra!, 25, new Set())).toBe(true);
    expect(ownsDesk(ultra!, 1, new Set([deskItem("ultrawide")]))).toBe(true);
  });

  test("the fleet goes up one tier at a time, to the top", () => {
    expect(nextFleet(undefined)).toMatchObject({ tier: 1, setup: { id: "dual" } });
    expect(nextFleet(3)).toMatchObject({ tier: 4, setup: { id: "battlestation" } });
    expect(nextFleet(4)).toBeNull();
  });
});
