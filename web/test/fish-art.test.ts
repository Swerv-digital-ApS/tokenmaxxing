import { expect, test } from "bun:test";
import { FISH } from "@tokenmaxxing/core/fishing.ts";
import { drawFish, FISH_ART, FISH_H, FISH_W, missingFishArt } from "../src/art/fish.ts";
import { Pen } from "../src/art/pixels.ts";
import { leap } from "../src/game/fishing-line.ts";

test("every fish in the pond has a 16x10 sprite, and nothing else does", () => {
  expect(missingFishArt()).toEqual([]);
  expect(Object.keys(FISH_ART).sort()).toEqual(FISH.map((f) => f.id).sort());
  for (const [id, art] of Object.entries(FISH_ART)) {
    expect(art.rows.length, id).toBe(FISH_H);
    for (const [y, row] of art.rows.entries()) {
      expect(row.length, `${id} row ${y}`).toBe(FISH_W);
      for (const c of row) if (c !== ".") expect(art.pal[c], `${id} row ${y}: "${c}"`).toBeDefined();
    }
  }
});

test("a fish paints inside its canvas, the off-by-one bass a pixel lower at the front", () => {
  for (const id of Object.keys(FISH_ART)) {
    const bad: string[] = [];
    let painted = 0;
    const g = {
      fillStyle: "",
      fillRect(x: number, y: number, w: number, h: number) {
        painted++;
        if (x < 0 || y < 0 || x + w > FISH_W || y + h > FISH_H + 1) bad.push(`${x},${y} ${w}x${h}`);
      },
    };
    drawFish(new Pen(g as unknown as CanvasRenderingContext2D), id);
    expect({ id, bad }).toEqual({ id, bad: [] });
    expect(painted, id).toBeGreaterThan(5);
  }
});

test("a catch leaps from the water to the hand, is held, and drops back in", () => {
  expect(leap(0)).toEqual({ k: 0, lift: 0 });
  expect(leap(0.3).k).toBe(1);
  expect(leap(0.5)).toMatchObject({ k: 1 });
  expect(leap(0.5).lift).toBeCloseTo(1, 1);
  expect(leap(0.999).k).toBeLessThan(0.01);
  for (let t = 0; t < 1; t += 0.05) {
    const { k, lift } = leap(t);
    expect(k).toBeGreaterThanOrEqual(0);
    expect(k).toBeLessThanOrEqual(1);
    expect(lift).toBeGreaterThanOrEqual(0);
    expect(lift).toBeLessThan(1.5);
  }
});
