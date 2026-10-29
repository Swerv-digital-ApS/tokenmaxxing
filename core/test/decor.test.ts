import { describe, expect, test } from "bun:test";
import { decorItem, decorOf, FLOORS, isPlain, ownsDecor, WALLPAPERS } from "../src/decor.ts";

describe("decor", () => {
  test("ten of each, unique ids, the plain one first, prices up to 450, two earned", () => {
    for (const [kind, list] of [
      ["wall", WALLPAPERS],
      ["floor", FLOORS],
    ] as const) {
      expect(list).toHaveLength(10);
      expect(new Set(list.map((d) => d.id)).size).toBe(10);
      expect(list[0]!.price).toBe(0);
      expect(isPlain(kind, list[0]!.id)).toBe(true);
      for (const d of list.slice(1)) {
        if (d.level === undefined) expect(d.price).toBeGreaterThanOrEqual(60);
        expect(d.price).toBeLessThanOrEqual(450);
      }
    }
    expect([...WALLPAPERS, ...FLOORS].filter((d) => d.level !== undefined)).toHaveLength(2);
  });

  test("unknown ids are plain", () => {
    expect(isPlain("wall", "nope")).toBe(true);
    expect(isPlain("wall", null)).toBe(true);
    expect(isPlain("wall", "nyhavn")).toBe(false);
    expect(decorOf("floor", "nyhavn")).toBeUndefined();
  });

  test("owning: plain is free, bought ones need a purchase, earned ones a level", () => {
    const nyhavn = decorOf("wall", "nyhavn")!;
    const tivoli = decorOf("wall", "tivoli")!;
    expect(ownsDecor("wall", WALLPAPERS[0]!, 10, new Set())).toBe(true);
    expect(ownsDecor("wall", nyhavn, 99, new Set())).toBe(false);
    expect(ownsDecor("wall", nyhavn, 10, new Set([decorItem("wall", "nyhavn")]))).toBe(true);
    expect(ownsDecor("wall", tivoli, 24, new Set())).toBe(false);
    expect(ownsDecor("wall", tivoli, 25, new Set())).toBe(true);
  });
});
