import { describe, expect, test } from "bun:test";
import { LEGEND, MAPS } from "../src/maps.ts";
import {
  COMPANY_FURNITURE,
  canHang,
  doorsFor,
  hqMap,
  PASSAGE_X,
  pieceOf,
  WALL_ROW,
  wallSpot,
  withPieces,
  withSlots,
} from "../src/office.ts";
import { isPoster, POSTERS } from "../src/posters.ts";
import { rarityOf } from "../src/rarity.ts";
import { itemById } from "../src/shop.ts";
import { route } from "../src/world.ts";

describe("poster catalog", () => {
  test("about ten, with unique characters and art, one for each in the company catalog", () => {
    expect(POSTERS.length).toBe(10);
    expect(new Set(POSTERS.map((p) => p.ch)).size).toBe(POSTERS.length);
    expect(new Set(POSTERS.map((p) => p.art)).size).toBe(POSTERS.length);
    expect(new Set(POSTERS.map((p) => p.name)).size).toBe(POSTERS.length);
    const all = COMPANY_FURNITURE.map((f) => f.ch);
    expect(new Set(all).size).toBe(all.length);
    expect(COMPANY_FURNITURE.filter((f) => f.wall)).toEqual([...POSTERS]);
    // Appended after the floor pieces, so those keep their place in the shop.
    expect(COMPANY_FURNITURE.slice(0, 29).some((f) => f.wall)).toBe(false);
    expect(COMPANY_FURNITURE.slice(29).every((f) => isPoster(f.ch))).toBe(true);
  });

  test("every poster char is in the legend with a joke line, and nothing else took it", () => {
    for (const p of POSTERS) {
      expect(LEGEND[p.ch]).toMatchObject({ name: `${p.name} poster` });
      expect(LEGEND[p.ch]?.text?.length).toBeGreaterThan(30);
      // Scenery, not floor: nobody walks onto one.
      expect(LEGEND[p.ch]?.walk).toBeUndefined();
      expect(LEGEND[p.ch]?.portal).toBeUndefined();
    }
    for (const map of Object.values(MAPS))
      for (const row of map.rows) for (const ch of row) expect(isPoster(ch)).toBe(false);
  });

  test("a wall-sized price, cheapest first, rarity by price like the rest", () => {
    const prices = POSTERS.map((p) => p.price);
    expect(prices).toEqual([...prices].sort((a, b) => a - b));
    for (const p of POSTERS) {
      expect(p.price).toBeGreaterThanOrEqual(60);
      expect(p.price).toBeLessThanOrEqual(250);
      expect([1, 2]).toContain(p.w ?? 1);
      expect(itemById(`furn.${p.ch}`)).toMatchObject({ company: true, tradeable: false, price: p.price });
      expect(rarityOf(itemById(`furn.${p.ch}`)!)).toBe(p.price >= 160 ? "uncommon" : "common");
      expect(pieceOf(p.ch)?.wall).toBe(true);
    }
    expect(new Set(POSTERS.map((p) => p.w)).size).toBe(2);
  });
});

describe("hanging them", () => {
  const house = doorsFor(withSlots([1, 2, 3].map((id) => ({ userId: id, name: `u${id}` }))));
  // Row 2 under the wall: shelves at 1-2, beds at 4 6 8 10, a plant at 12, the passage at 13-14, desks at 15-18, a coffee machine at 20.
  const clear = [3, 5, 7, 9, 11, 19];

  test("only on the building's top wall, over bare wall, with floor to stand on below it", () => {
    const map = hqMap(house);
    expect(map.at(1, WALL_ROW)).toBe("W");
    expect(clear.every((x) => canHang(map, x, WALL_ROW, 1))).toBe(true);
    // A wide one needs only one free tile under it, to face it by: half a poster behind a bed is fine.
    expect(canHang(map, 3, WALL_ROW, 2)).toBe(true);
    expect(canHang(map, 4, WALL_ROW, 2)).toBe(true);
    // All furniture below: nobody could face it to take it down.
    expect(canHang(map, 1, WALL_ROW, 2)).toBe(false);
    expect(canHang(map, 15, WALL_ROW, 2)).toBe(false);
    // Not the floor, not the hallway walls above, not another room.
    expect(canHang(map, 3, WALL_ROW + 1, 1)).toBe(false);
    expect(canHang(map, 3, WALL_ROW - 1, 1)).toBe(false);
    expect(canHang(map, 1, -2, 1)).toBe(false);
    expect(canHang(MAPS.inn, 3, WALL_ROW, 1)).toBe(false);
    // The passage up to the hallways is open floor, and a wide one can't straddle it.
    expect(map.at(PASSAGE_X, WALL_ROW)).toBe("_");
    expect(canHang(map, PASSAGE_X - 1, WALL_ROW, 2)).toBe(false);
    expect(canHang(map, PASSAGE_X, WALL_ROW, 1)).toBe(false);
    expect(canHang(map, PASSAGE_X + 1, WALL_ROW, 1)).toBe(false);
    expect(canHang(map, 0, WALL_ROW, 1)).toBe(false);
  });

  test("a poster is wall under it: nothing about walking changes, and a floor piece can't take its place", () => {
    const base = hqMap(house);
    const hung = withPieces(
      [
        { ch: "0", x: 3, y: WALL_ROW },
        { ch: "7", x: 9, y: WALL_ROW },
      ],
      base,
    );
    expect([hung.at(3, 1), hung.at(4, 1), hung.at(9, 1)]).toEqual(["0", "0", "7"]);
    expect(base.at(3, 1)).toBe("W");
    for (let y = base.y0; y < base.y0 + base.height; y++)
      for (let x = 0; x < base.width; x++) expect(hung.walkable(x, y)).toBe(base.walkable(x, y));
    // The way out of the building is as open as before.
    expect(route(hung, [10, 12], [PASSAGE_X, -1])).toEqual(route(base, [10, 12], [PASSAGE_X, -1]));
    // A poster on the floor, on the passage or over a bookshelf writes nothing; a sofa on the wall neither.
    const wrong = withPieces(
      [
        { ch: "0", x: 3, y: 5 },
        { ch: "7", x: PASSAGE_X, y: WALL_ROW },
        { ch: "7", x: 1, y: WALL_ROW },
        { ch: "Σ", x: 3, y: WALL_ROW },
      ],
      base,
    );
    expect(wrong.rows).toEqual(base.rows);
  });

  test("the nearest clear slot to you; a hung poster takes its wall, and a full wall has none", () => {
    let map = hqMap(house);
    for (const x of clear) expect(wallSpot(map, x, 1)).toEqual({ x, y: WALL_ROW });
    expect(wallSpot(map, 6, 1)?.x).toBeOneOf([5, 7]);
    expect(wallSpot(map, 0, 1)).toEqual({ x: 3, y: WALL_ROW });
    expect(wallSpot(map, 21, 1)).toEqual({ x: 19, y: WALL_ROW });
    // A wide one by a shelf or a bed still has a slot, with its free tile to stand at.
    expect(wallSpot(map, 1, 2)?.x).toBeOneOf([2, 3]);
    map = withPieces([{ ch: "0", x: 5, y: WALL_ROW }], map);
    expect(wallSpot(map, 5, 1)?.x).toBeOneOf([3, 7]);
    expect(wallSpot(map, 5, 2)?.x).not.toBeOneOf([4, 5]);
    // Every spot with floor to stand on taken: none left, wide or not.
    const full = withPieces(
      clear.map((x) => ({ ch: "7", x, y: WALL_ROW })),
      hqMap(house),
    );
    expect(wallSpot(full, 6, 1)).toBeNull();
    expect(wallSpot(full, 6, 2)).toBeNull();
  });
});
