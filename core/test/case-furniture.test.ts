import { expect, test } from "bun:test";
import { ALL_CASE_PIECES, CASE_PIECES, casePieceOf, isCasePiece } from "../src/case-furniture.ts";
import { NUSANTARA_PIECES } from "../src/case-nusantara-furniture.ts";
import { RAGNAROK_PIECES } from "../src/case-ragnarok-furniture.ts";
import { HOME_PIECES } from "../src/home.ts";
import { TROPHIES } from "../src/loot.ts";
import { LEGEND, MAPS } from "../src/maps.ts";
import { COMPANY_FURNITURE, FURNITURE, pieceOf } from "../src/office.ts";
import { POSTERS } from "../src/posters.ts";
import { canDropIn, ITEMS, isTradeable, itemById } from "../src/shop.ts";

const others = [...FURNITURE, ...COMPANY_FURNITURE, ...POSTERS, ...TROPHIES, ...HOME_PIECES];

test("a case piece's character is its own: no other catalog, map row or legend tile uses it", () => {
  const taken = new Set(others.map((p) => p.ch));
  for (const m of Object.values(MAPS)) for (const row of m.rows) for (const c of row) taken.add(c);
  for (const ch of Object.keys(LEGEND)) if (!ALL_CASE_PIECES.some((p) => p.ch === ch)) taken.add(ch);
  for (const p of ALL_CASE_PIECES) {
    expect([...p.ch]).toHaveLength(1);
    expect(taken.has(p.ch)).toBe(false);
    // The first-wins lookup finds it, not something else.
    expect(pieceOf(p.ch)).toBe(p);
    expect(casePieceOf(p.ch)).toBe(p);
    expect(isCasePiece(p.ch)).toBe(true);
  }
  expect(new Set(ALL_CASE_PIECES.map((p) => p.ch)).size).toBe(ALL_CASE_PIECES.length);
});

test("ids and names are unique and match no shop, home, company or loot piece", () => {
  const names = new Set(others.map((p) => p.name.toLowerCase()));
  expect(new Set(ALL_CASE_PIECES.map((p) => p.name.toLowerCase())).size).toBe(ALL_CASE_PIECES.length);
  expect(new Set(ALL_CASE_PIECES.map((p) => p.art)).size).toBe(ALL_CASE_PIECES.length);
  for (const p of ALL_CASE_PIECES) {
    expect(names.has(p.name.toLowerCase())).toBe(false);
    expect(ITEMS.filter((i) => i.id === `furn.${p.ch}`)).toHaveLength(1);
  }
  expect(new Set(ITEMS.map((i) => i.id)).size).toBe(ITEMS.length);
});

test("every case piece is a free, tradeable case item with a rarity, placeable in its owner's office only", () => {
  expect(CASE_PIECES.map((p) => p.name)).toEqual([
    "Lantern string",
    "Koi rug",
    "Tea stool",
    "Ramen counter",
    "Arcade claw machine",
    "Torii gate",
  ]);
  for (const p of ALL_CASE_PIECES) {
    const item = itemById(`furn.${p.ch}`)!;
    expect(item).toMatchObject({ slot: "furniture", price: 0, tradeable: true, case: true, home: true });
    expect(item.rarity).toBe(p.rarity);
    expect(item.blurb).toBe(p.blurb);
    expect(isTradeable(item.id)).toBe(true);
    expect(canDropIn(item.id, "office:7", 7)).toBe(true);
    expect(canDropIn(item.id, "office:8", 7)).toBe(false);
    expect(canDropIn(item.id, "hq:1", 7)).toBe(false);
    expect(item.loot).toBeUndefined();
  }
  expect(CASE_PIECES.find((p) => p.name === "Torii gate")!.rarity).toBe("rare");
});

test("the Nusantara case's six pieces: characters, widths, wall and flat, and a rarity spread like the Night Market's", () => {
  expect(NUSANTARA_PIECES.map((p) => [p.ch, p.art, p.name, p.rarity, p.w, !!p.wall, !!p.flat])).toEqual([
    ["Б", "nus-batik-hanging", "Batik hanging", "common", 2, true, false],
    ["Г", "nus-sawah-rug", "Sawah rug", "common", 2, false, true],
    ["Ш", "nus-warung-stool", "Warung stool", "common", 1, false, false],
    ["Э", "nus-angkringan-cart", "Angkringan cart", "uncommon", 2, false, false],
    ["Ю", "nus-bonang-rack", "Bonang rack", "uncommon", 2, false, false],
    ["Й", "nus-pinisi", "Pinisi on the stand", "rare", 3, false, false],
  ]);
  expect(NUSANTARA_PIECES.map((p) => p.rarity)).toEqual(CASE_PIECES.map((p) => p.rarity));
  // Neither case's pieces are in the other's list; the combined list is every case's, Night Market first.
  expect(ALL_CASE_PIECES).toEqual([...CASE_PIECES, ...NUSANTARA_PIECES, ...RAGNAROK_PIECES]);
  for (const p of NUSANTARA_PIECES) expect(CASE_PIECES.includes(p)).toBe(false);
});
