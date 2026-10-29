import { describe, expect, test } from "bun:test";
import { EDITION_BASE, EDITIONS, editionAt } from "../src/editions.ts";
import {
  CART_SPOT,
  cartOpen,
  editionLabel,
  lineup,
  PER_WEEK,
  ROTATION,
  underCart,
  weekOf,
} from "../src/merchant.ts";
import { addDays } from "../src/range.ts";
import { ITEMS, isTradeable } from "../src/shop.ts";
import { CART, isCart } from "../src/street.ts";
import { parseLook } from "../src/world.ts";

/** Copenhagen wall time in October 2026 (summer time, UTC+2). */
const cph = (day: string, hh: number, mm = 0) =>
  Date.parse(`${day}T00:00:00Z`) + ((hh - 2) * 60 + mm) * 60_000;

describe("the merchant's week", () => {
  test("turns over on Monday at 08:00 Copenhagen", () => {
    expect(weekOf(cph("2026-10-19", 7, 59))).toBe("2026-10-12");
    expect(weekOf(cph("2026-10-19", 8))).toBe("2026-10-19");
    expect(weekOf(cph("2026-10-25", 23))).toBe("2026-10-19");
  });

  test("the cart is in from Thursday 08:00 until the week turns over", () => {
    const open = (day: string, hh: number, mm = 0) => cartOpen(cph(day, hh, mm));
    expect(open("2026-10-21", 12)).toBe(false); // Wednesday
    expect(open("2026-10-22", 7, 59)).toBe(false); // Thursday, early
    expect(open("2026-10-22", 8)).toBe(true);
    expect(open("2026-10-24", 3)).toBe(true); // Saturday night
    expect(open("2026-10-19", 7, 59)).toBe(true); // Monday, before the turnover
    expect(open("2026-10-19", 8)).toBe(false);
  });
});

describe("the lineup", () => {
  test("is the same for everyone, and four different editions", () => {
    const week = lineup("2026-10-19");
    expect(week).toHaveLength(PER_WEEK);
    expect(new Set(week.map((e) => e.id)).size).toBe(PER_WEEK);
    expect(lineup("2026-10-19")).toEqual(week);
  });

  test("shows every edition once per rotation before any comes back", () => {
    // Weeks count from 1970-01-05; 2026-09-28 is week 2960, the first of a rotation, as is 2026-11-02.
    for (const start of ["2026-09-28", "2026-11-02"]) {
      const seen = Array.from({ length: ROTATION }, (_, w) => lineup(addDays(start, 7 * w))).flat();
      expect(new Set(seen.map((e) => e.id)).size).toBe(EDITIONS.length);
    }
    expect(ROTATION).toBeGreaterThanOrEqual(4);
  });

  test("changes from one week to the next", () => {
    const ids = (w: string) => lineup(w).map((e) => e.id);
    expect(ids("2026-10-26")).not.toEqual(ids("2026-10-19"));
  });
});

describe("merchant editions", () => {
  test("at least 16, with names, flavour and a supply, never in the plain shop's indices", () => {
    expect(EDITIONS.length).toBeGreaterThanOrEqual(16);
    expect(new Set(EDITIONS.map((e) => e.id)).size).toBe(EDITIONS.length);
    for (const e of EDITIONS) {
      expect(e.index).toBeGreaterThanOrEqual(EDITION_BASE);
      expect(e.blurb.length).toBeGreaterThan(10);
      expect(e.supply).toBeGreaterThan(0);
      expect(ITEMS).toContain(e);
      expect(isTradeable(e.id)).toBe(true);
    }
  });

  test("can be worn; made-up indices can't", () => {
    const base = {
      style: 0,
      skin: 0,
      hair: 0,
      outfit: 0,
      glasses: 0,
      hat: 0,
      pet: 0,
      held: 0,
      back: 0,
      petwear: 0,
      petVariant: 0,
      merch: 0,
      merchWorn: 0,
    };
    expect(parseLook({ ...base, hat: EDITION_BASE })).toEqual({ ...base, hat: EDITION_BASE });
    expect(parseLook({ ...base, glasses: EDITION_BASE + 1 })).not.toBeNull();
    expect(parseLook({ ...base, hat: EDITION_BASE - 1 })).toBeNull();
    expect(parseLook({ ...base, hat: EDITION_BASE + 600 })).toBeNull();
    expect(editionAt("pet", EDITION_BASE)).toBeUndefined();
  });

  test("are numbered", () => {
    expect(editionLabel(3, { supply: 20 })).toBe("#3 of 20");
  });
});

describe("the merchant's spot", () => {
  test("is clear of the pølsevogn, both the cart and where he stands", () => {
    expect(CART.some(([x, y]) => underCart(x, y))).toBe(false);
    expect(isCart(CART_SPOT.x - 1, CART_SPOT.y)).toBe(false);
  });
});
