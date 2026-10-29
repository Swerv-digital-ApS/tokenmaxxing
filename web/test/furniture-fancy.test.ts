import { expect, test } from "bun:test";
import { TILE } from "@tokenmaxxing/core/world.ts";
import { FANCY_FURNITURE } from "../src/art/furniture-fancy.ts";
import { Pen } from "../src/art/pixels.ts";

test("every fancy piece has a unique id, a valid footprint, frames and a price", () => {
  expect(FANCY_FURNITURE.length).toBeGreaterThanOrEqual(25);
  expect(new Set(FANCY_FURNITURE.map((f) => f.id)).size).toBe(FANCY_FURNITURE.length);
  for (const f of FANCY_FURNITURE) {
    for (const n of [f.w, f.h, f.frames]) expect(Number.isInteger(n) && n >= 1).toBe(true);
    expect(f.w * f.h).toBeLessThanOrEqual(6);
    expect(f.frames).toBeLessThanOrEqual(4);
    expect(f.height).toBeGreaterThanOrEqual(f.h * TILE);
    expect(f.frameMs).toBeGreaterThan(0);
    expect(f.price).toBeGreaterThan(0);
    if (f.tint !== null) expect(f.tint).toMatch(/^#[0-9a-f]{6}$/);
  }
});

test("every frame draws something, on whole pixels inside its sprite", () => {
  for (const f of FANCY_FURNITURE)
    for (let frame = 0; frame < f.frames; frame++) {
      const out: string[] = [];
      let painted = 0;
      const g = {
        fillStyle: "",
        fillRect(x: number, y: number, w: number, h: number) {
          if (w <= 0 || h <= 0) return;
          painted++;
          if (
            ![x, y, w, h].every(Number.isInteger) ||
            x < 0 ||
            y < 0 ||
            x + w > f.w * TILE ||
            y + h > f.height
          )
            out.push(`${x},${y} ${w}x${h}`);
        },
      };
      f.draw(new Pen(g as unknown as CanvasRenderingContext2D), frame, f.tint ?? "#6d7fc4");
      expect({ id: f.id, frame, out }).toEqual({ id: f.id, frame, out: [] });
      expect(painted).toBeGreaterThan(10);
    }
});
