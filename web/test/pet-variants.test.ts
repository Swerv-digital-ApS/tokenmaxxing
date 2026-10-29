import { describe, expect, test } from "bun:test";
import { PET_NAMED, PET_VARIANTS } from "@tokenmaxxing/core/pets.ts";
import { missingArt, outfitArt, variantArt } from "../src/art/pet-variants/index.ts";
import { PETS } from "../src/art/pets.ts";

const WIDTH = 12;
const HEIGHT = 10;

describe("pet variation art", () => {
  test("every id in PET_VARIANTS has art", () => {
    expect(missingArt()).toEqual([]);
  });

  for (const [pet, ids] of Object.entries(PET_VARIANTS)) {
    ids.forEach((id, i) => {
      const art = variantArt(Number(pet), i + 1);
      test(`${pet}:${id}`, () => {
        // Missing art is reported by the test above, once.
        if (!art) return;
        expect(art.id).toBe(id);
        expect(art.frames).toHaveLength(2);
        for (const rows of art.frames) {
          expect(rows).toHaveLength(HEIGHT);
          for (const row of rows) {
            expect(row).toHaveLength(WIDTH);
            for (const ch of row) if (ch !== ".") expect(art.pal[ch]).toBeDefined();
          }
        }
        // Not a copy of the base pet.
        const base = PETS[Number(pet)]!;
        expect(JSON.stringify([art.frames[0], art.pal])).not.toBe(JSON.stringify([base.frames[0], base.pal]));
      });
    });
  }
});

describe("named outfit art", () => {
  for (const n of PET_NAMED) {
    test(`${n.name}: ${n.art}`, () => {
      const art = outfitArt(n.art)!;
      expect(art).not.toBeNull();
      const plain = variantArt(n.pet, PET_VARIANTS[n.pet]!.indexOf(n.variant) + 1)!;
      for (const [f, rows] of art.frames.entries()) {
        expect(rows).toHaveLength(HEIGHT);
        for (const row of rows) {
          expect(row).toHaveLength(WIDTH);
          for (const ch of row) if (ch !== ".") expect(art.pal[ch]).toBeDefined();
        }
        // Dressed, and it only adds to the pet: nothing of the plain look is rubbed out.
        expect(rows).not.toEqual(plain.frames[f]);
        for (const [y, row] of rows.entries())
          for (const [x, ch] of [...row].entries())
            if (plain.frames[f]![y]![x] !== ".") expect(ch).not.toBe(".");
      }
    });
  }
});
