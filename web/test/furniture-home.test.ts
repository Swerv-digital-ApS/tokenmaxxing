import { expect, test } from "bun:test";
import { ALL_CASE_PIECES } from "@tokenmaxxing/core/case-furniture.ts";
import { HOME_PIECES } from "@tokenmaxxing/core/home.ts";
import { TILE } from "@tokenmaxxing/core/world.ts";
import { fancyPiece } from "../src/art/furniture-fancy.ts";
import { CASE_FURNITURE, HOME_FURNITURE, NUSANTARA_FURNITURE } from "../src/art/furniture-home.ts";
import { RAGNAROK_FURNITURE } from "../src/art/furniture-ragnarok.ts";
import { Pen } from "../src/art/pixels.ts";

test("every personal-office piece has its art, and every art is a piece", () => {
  expect(HOME_FURNITURE.map((f) => f.id).sort()).toEqual(HOME_PIECES.map((p) => p.art).sort());
  expect(new Set(HOME_FURNITURE.map((f) => f.id)).size).toBe(HOME_FURNITURE.length);
  for (const p of HOME_PIECES) {
    const art = fancyPiece(p.art)!;
    expect(art).toBeDefined();
    expect(art.w).toBe(p.w ?? 1);
    expect(art.name).toBe(p.name);
    expect(art.price).toBe(p.price);
    // Wall pieces fit the office's single row of wall face; rugs lie flat.
    if (p.wall) {
      expect(art.placement).toBe("wall");
      expect(art.height).toBe(TILE);
    }
    expect(art.placement === "flat").toBe(p.flat === true);
    expect(art.height).toBeGreaterThanOrEqual(TILE);
  }
});

test("every case piece (every case's) has its art, and every case art is a piece", () => {
  const art = [...CASE_FURNITURE, ...NUSANTARA_FURNITURE, ...RAGNAROK_FURNITURE];
  expect(art.map((f) => f.id).sort()).toEqual(ALL_CASE_PIECES.map((p) => p.art).sort());
  expect(new Set(art.map((f) => f.id)).size).toBe(art.length);
  for (const p of ALL_CASE_PIECES) {
    const f = fancyPiece(p.art)!;
    expect(f, `art for ${p.name}`).toBeDefined();
    expect(f.w, `${p.name}: width`).toBe(p.w ?? 1);
    expect(f.name, `${p.name}: name`).toBe(p.name);
    expect(f.price, `${p.name}: price`).toBe(p.price);
    expect(f.rarity, `${p.name}: rarity`).toBe(p.rarity);
    expect(f.placement === "flat").toBe(p.flat === true);
    expect(f.placement === "wall").toBe(p.wall === true);
    if (p.wall) expect(f.height).toBe(TILE);
    expect(f.height).toBeGreaterThanOrEqual(TILE);
  }
});

// The Night Market's torii glow spills one row past its sprite (clipped, so unseen), so only the personal office's
// pieces and the Nusantara's and Ragnarok Eve's are held to the bounds.
test("every frame draws something, on whole pixels inside its sprite", () => {
  for (const f of [...HOME_FURNITURE, ...NUSANTARA_FURNITURE, ...RAGNAROK_FURNITURE])
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
