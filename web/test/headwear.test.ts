import { expect, test } from "bun:test";
import { PACK_FACES, PACK_HATS } from "@tokenmaxxing/core/headwear.ts";
import { FACE_ART, HAT_ART, type Wear } from "../src/art/headwear.ts";

/** Letters an item may leave to the wearer: outline and hair. */
const WEARER = new Set(["o", "h", "H"]);

const check = (art: readonly Wear[], count: number) => {
  expect(art).toHaveLength(count);
  for (const w of art)
    for (const rows of [w.down, w.side, w.up]) {
      for (const row of rows ?? []) {
        expect(row).toHaveLength(16);
        // A letter the item doesn't colour would take the wearer's skin or shirt by accident.
        for (const ch of row.replaceAll(".", "")) expect(ch in w.pal || WEARER.has(ch)).toBe(true);
      }
      // Nothing hangs off the bottom of the 16×16 frame.
      expect((w.y ?? 0) + (rows?.length ?? 0)).toBeLessThanOrEqual(16);
    }
};

test("every pack item has art, in the catalog's order, that fits the frame", () => {
  check(HAT_ART, PACK_HATS.length);
  check(FACE_ART, PACK_FACES.length);
});
