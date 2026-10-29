import { describe, expect, test } from "bun:test";
import {
  BUFFS,
  buffOf,
  copenhagenDay,
  hasSpecial,
  SPECIAL,
  SPECIALS,
  STRIDE,
  serveUntil,
  specialBuff,
  specialIndex,
  specialOn,
  TAVERN,
} from "../src/tavern.ts";

const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
const at = (iso: string) => new Date(iso);

describe("the daily special", () => {
  test("the stride shares no factor with the list, so every special comes round before a repeat", () => {
    expect(gcd(STRIDE, SPECIALS.length)).toBe(1);
    const day = copenhagenDay(at("2026-10-22T10:00:00Z"));
    const seen = new Set(Array.from({ length: SPECIALS.length }, (_, i) => specialIndex(day + i)));
    expect(seen.size).toBe(SPECIALS.length);
  });

  test("the special is the same all Copenhagen day and turns over at its midnight", () => {
    // 23 October is CEST until the 25th: midnight in Copenhagen is 22:00 UTC.
    const before = specialOn(at("2026-10-22T21:59:00Z"));
    expect(specialOn(at("2026-10-22T00:00:00Z"))).toBe(before);
    expect(specialOn(at("2026-10-22T22:00:00Z"))).not.toBe(before);
    // In winter it is 23:00 UTC.
    expect(copenhagenDay(at("2026-01-15T22:59:00Z"))).toBe(copenhagenDay(at("2026-01-15T12:00:00Z")));
    expect(copenhagenDay(at("2026-01-15T23:00:00Z"))).toBe(copenhagenDay(at("2026-01-15T12:00:00Z")) + 1);
  });
});

describe("what a served special does", () => {
  test("it is free and cosmetic: 15 minutes and nothing else", () => {
    expect(TAVERN).toBe(true);
    expect(SPECIAL).toEqual({ ms: 15 * 60_000 });
    expect([...BUFFS]).toEqual(["jitter", "glow"]);
  });

  test("the day picks the effect, and both effects come round", () => {
    const day = copenhagenDay(at("2026-10-22T10:00:00Z"));
    const week = Array.from({ length: 14 }, (_, i) => buffOf(day + i));
    expect(new Set(week)).toEqual(new Set(BUFFS));
    // Alternating, so no run of the same effect.
    for (let i = 1; i < week.length; i++) expect(week[i]).not.toBe(week[i - 1]);
    expect(buffOf(day)).toBe(buffOf(day));
  });

  test("it lasts 15 minutes and can't be served again while it does", () => {
    const now = Date.parse("2026-10-22T10:00:00Z");
    const until = serveUntil(now);
    expect(until - now).toBe(15 * 60_000);
    expect(hasSpecial(until, now)).toBe(true);
    expect(hasSpecial(until, until - 1)).toBe(true);
    expect(hasSpecial(until, until)).toBe(false);
    // Never served: nothing to wear off.
    expect(hasSpecial(0, now)).toBe(false);
  });

  test("it keeps the effect it was served with when it runs past midnight", () => {
    // Served at 23:55 Copenhagen time (22:55 UTC in January); it wears off at 00:10 the next day.
    const served = Date.parse("2026-01-15T22:55:00Z");
    const until = serveUntil(served);
    expect(copenhagenDay(new Date(until - 1))).toBe(copenhagenDay(new Date(served)) + 1);
    expect(specialBuff(until)).toBe(buffOf(copenhagenDay(new Date(served))));
    expect(specialBuff(until)).not.toBe(buffOf(copenhagenDay(new Date(until))));
  });

  test("whoever is served at any time of day gets that day's effect", () => {
    const day = copenhagenDay(at("2026-10-22T10:00:00Z"));
    for (const iso of ["2026-10-21T22:00:00Z", "2026-10-22T08:30:00Z", "2026-10-22T21:59:00Z"])
      expect(specialBuff(serveUntil(Date.parse(iso)))).toBe(buffOf(day));
  });
});
