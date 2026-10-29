import { describe, expect, test } from "bun:test";
import { C } from "../src/art/palette.ts";
import {
  BREATH_TICKS,
  curl,
  eyesOf,
  type Grid,
  SLEEP_H,
  SLEEP_W,
  sleeping,
  sleepingFrame,
  Z_TICKS,
  zs,
} from "../src/art/pet-sleep.ts";
import { outfitArt } from "../src/art/pet-variants/index.ts";
import { bedSpot } from "../src/game/pets.ts";

/** A sprite from rows: `.` clear, `o` ink, `e` an eye (ink), anything else a colour. */
const sprite = (rows: string[]): Grid =>
  rows.map((r) =>
    [...r].map((ch) => (ch === "." ? null : ch === "o" || ch === "e" ? C.ink : `#${ch.repeat(6)}`)),
  );

// A cat-ish animal facing right: ears, a head with an eye, a body, legs.
const ANIMAL = sprite([
  "............",
  ".......o..o.",
  "......obbbbo",
  "......obebbo",
  "..oooobbbbo.",
  ".obbbbbbbbo.",
  ".obbbbbbbo..",
  ".obobbbobo..",
  ".o.o..o.o...",
]);

const count = (g: Grid) => g.flat().filter((c) => c !== null).length;
const bounds = (g: Grid) => {
  const ys = g.flatMap((r, y) => (r.some((c) => c) ? [y] : []));
  return [Math.min(...ys), Math.max(...ys)] as const;
};

describe("pet sleep", () => {
  test("eyes: ink inside the sprite, not its outline", () => {
    expect(eyesOf(ANIMAL)).toContainEqual([8, 3]);
  });

  test("curled: squashed, sitting on the bottom row, inside the frame", () => {
    const out = curl(ANIMAL, false, 0);
    expect(out).toHaveLength(SLEEP_H);
    for (const row of out) expect(row).toHaveLength(SLEEP_W);
    const [top, bottom] = bounds(out);
    expect(bottom).toBe(SLEEP_H - 1);
    expect(bottom - top + 1).toBeLessThan(ANIMAL.length - 1);
    expect(bottom - top + 1).toBeGreaterThanOrEqual(5);
  });

  test("curled: the legs are tucked in, and the underside is one line", () => {
    const out = curl(ANIMAL, false, 0);
    const under = out[SLEEP_H - 1]!;
    const xs = under.flatMap((c, x) => (c ? [x] : []));
    expect(xs.length).toBeGreaterThan(4);
    for (let x = xs[0]!; x <= xs[xs.length - 1]!; x++) expect(under[x]).not.toBeNull();
  });

  test("curled: eyes are shut (a dash, wider than the eye was)", () => {
    const out = curl(ANIMAL, false, 0);
    const ink = out.flatMap((r, y) => r.flatMap((c, x) => (c === C.ink ? [[x, y] as const] : [])));
    // Somewhere an ink pixel has an ink neighbour on its row with body colour above and below it.
    expect(
      ink.some(([x, y]) => out[y]![x + 1] === C.ink && out[y - 1]?.[x] && out[y - 1]![x] !== C.ink),
    ).toBe(true);
  });

  test("breathing lifts the back a row, and nothing is lost", () => {
    const a = curl(ANIMAL, false, 0);
    const b = curl(ANIMAL, false, 1);
    expect(bounds(b)[0]).toBe(bounds(a)[0] - 1);
    expect(bounds(b)[1]).toBe(bounds(a)[1]);
  });

  test("an empty or round sprite doesn't blow up", () => {
    expect(count(curl([[null]], true, 0))).toBe(0);
    const orb = sprite(["..oooo..", ".oppppo.", "oppkkppo", ".oppppo.", "..oooo.."]);
    expect(count(curl(orb, false, 0))).toBeGreaterThan(10);
  });

  test("z's rise, change size, and loop", () => {
    const first = zs(false, 0)[0]!;
    const later = zs(false, 4)[0]!;
    expect(later.y).toBeLessThan(first.y);
    expect(zs(false, 0).some((z) => z.big)).toBe(true);
    expect(zs(true, 2).every((z) => z.x < SLEEP_W / 2)).toBe(true);
    expect(zs(false, 2).every((z) => z.x >= SLEEP_W / 2 - 1)).toBe(true);
    expect(JSON.stringify(zs(false, 3))).toBe(JSON.stringify(zs(false, 3 + Z_TICKS)));
    for (let t = 0; t < Z_TICKS; t++) for (const z of zs(false, t)) expect(z.y).toBeGreaterThanOrEqual(0);
  });

  test("the whole frame cycles and keeps the z's off the pet", () => {
    for (let t = 0; t < Z_TICKS; t++) {
      const out = sleeping(ANIMAL, false, t);
      expect(count(out)).toBeGreaterThan(count(curl(ANIMAL, false, 0)) - 5);
    }
    expect(JSON.stringify(sleeping(ANIMAL, false, 0))).toBe(JSON.stringify(sleeping(ANIMAL, false, Z_TICKS)));
    expect(BREATH_TICKS).toBe(4);
  });

  test("no pet, no frame; the bed spot is inside its tile", () => {
    expect(sleepingFrame(null, false, 0)).toBeNull();
    const [x, y] = bedSpot([10, 7]);
    expect([x, y]).toEqual([162, 114]);
  });
});

describe("a thin dog in a sweater", () => {
  // The tail's lone pixel on the body row must not make that row look like legs, or the body (and the sweater) is lost.
  const art = outfitArt("penny-sweater")!;
  const grid: Grid = art.frames[0].map((row) => [...row].map((ch) => (ch === "." ? null : art.pal[ch]!)));
  test("still shows the sweater when curled up asleep", () => {
    for (const left of [false, true])
      for (const breath of [0, 1]) expect(curl(grid, left, breath).flat()).toContain(art.pal.S!);
  });
});
