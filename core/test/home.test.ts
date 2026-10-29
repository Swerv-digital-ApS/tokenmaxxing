import { describe, expect, test } from "bun:test";
import { HOME_PIECES, homePieceOf, isHomePiece } from "../src/home.ts";
import { TROPHIES } from "../src/loot.ts";
import { LEGEND, MAPS } from "../src/maps.ts";
import {
  COMPANY_FURNITURE,
  canHang,
  doorsFor,
  FURNITURE,
  hqMap,
  OFFICE_WALL_ROW,
  officeMap,
  pieceOf,
  STARTER_OFFICE,
  wallSpot,
  withPieces,
} from "../src/office.ts";
import { canDropIn, ITEMS, isTradeable, itemById } from "../src/shop.ts";
import { cutsOff, route } from "../src/world.ts";

describe("personal office furniture catalog", () => {
  test("12 to 14 pieces, cheapest first, 60 to 450 coins, unique chars, art and names", () => {
    expect(HOME_PIECES.length).toBeGreaterThanOrEqual(12);
    expect(HOME_PIECES.length).toBeLessThanOrEqual(14);
    const prices = HOME_PIECES.map((p) => p.price);
    expect(prices).toEqual([...prices].sort((a, b) => a - b));
    for (const p of HOME_PIECES) {
      expect(p.price).toBeGreaterThanOrEqual(60);
      expect(p.price).toBeLessThanOrEqual(450);
      expect([1, 2]).toContain(p.w ?? 1);
      expect(p.home).toBe(true);
    }
    for (const key of ["ch", "art", "name"] as const)
      expect(new Set(HOME_PIECES.map((p) => p[key])).size).toBe(HOME_PIECES.length);
  });

  test("the requested ones are there", () => {
    const names = HOME_PIECES.map((p) => p.name.toLowerCase()).join("|");
    for (const n of ["fiddle", "cactus", "hanging plant", "bonsai", "keyboard", "whiteboard", "neon"])
      expect(names).toContain(n);
    expect(homePieceOf("Å")?.wall).toBe(true);
  });

  test("no character clashes with the rest of the furniture, trophies, posters or the maps", () => {
    const others = [...FURNITURE, ...COMPANY_FURNITURE, ...TROPHIES].map((f) => f.ch);
    for (const p of HOME_PIECES) expect(others).not.toContain(p.ch);
    for (const map of Object.values(MAPS))
      for (const row of map.rows) for (const ch of row) expect(isHomePiece(ch)).toBe(false);
  });

  test("each has a legend entry; seats sit, rugs are walked over, the rest block", () => {
    for (const p of HOME_PIECES) {
      const kind = LEGEND[p.ch]!;
      expect(kind.name.length).toBeGreaterThan(2);
      expect(kind.portal).toBeUndefined();
      if (p.flat) expect(kind.walk).toBe(true);
      else {
        expect(kind.walk).toBeUndefined();
        expect(p.text.length).toBeGreaterThan(30);
      }
      expect(kind.seat).toBe(p.seat);
    }
    expect(HOME_PIECES.filter((p) => p.flat)).toHaveLength(1);
  });

  test("shop items: sold for coins, tradeable, home-only, with nothing that earns", () => {
    for (const p of HOME_PIECES) {
      const item = itemById(`furn.${p.ch}`)!;
      expect(item).toMatchObject({ slot: "furniture", name: p.name, price: p.price, home: true });
      expect(item.company).toBeUndefined();
      expect(item.earned).toBeUndefined();
      expect(isTradeable(item.id)).toBe(true);
      expect(pieceOf(p.ch)).toBe(p);
    }
    expect(ITEMS.filter((i) => i.id.startsWith("furn.")).length).toBeGreaterThan(HOME_PIECES.length);
    const ids = ITEMS.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test("they go down only in your own office: not the town, the building, nor someone else's", () => {
    const fig = "furn.æ";
    expect(canDropIn(fig, "office:7", 7)).toBe(true);
    expect(canDropIn(fig, "office:8", 7)).toBe(false);
    expect(canDropIn(fig, "town", 7)).toBe(false);
    expect(canDropIn(fig, "hq:3", 7)).toBe(false);
    // The old furniture is unchanged.
    expect(canDropIn("furn.s", "town", 7)).toBe(true);
  });
});

describe("hanging on an office's wall", () => {
  const office = MAPS.office;
  // The trophy shelf takes x 5 to 8 of row 1, so there is nothing to stand on under row 0 there.
  const free = [1, 2, 3, 4, 9, 10, 11, 12];

  test("on the top wall face, over bare wall, with floor to stand on in front", () => {
    expect(OFFICE_WALL_ROW).toBe(0);
    for (const x of free) expect(canHang(office, x, 0, 1, true)).toBe(true);
    expect(canHang(office, 3, 0, 2, true)).toBe(true);
    // Not over the trophy shelf, the corners, the floor, the bottom wall or the door.
    for (const x of [5, 6, 7, 8]) expect(canHang(office, x, 0, 1, true)).toBe(false);
    expect(canHang(office, 0, 0, 1, true)).toBe(false);
    expect(canHang(office, 13, 0, 1, true)).toBe(false);
    expect(canHang(office, 12, 0, 2, true)).toBe(false);
    expect(canHang(office, 3, 1, 1, true)).toBe(false);
    expect(canHang(office, 5, 10, 1, true)).toBe(false);
    // Posters stay in the building, and personal pieces out of it.
    expect(canHang(office, 3, 0, 1)).toBe(false);
    expect(canHang(hqMap(doorsFor([])), 3, 1, 1, true)).toBe(false);
    expect(canHang(MAPS.inn, 3, 0, 1, true)).toBe(false);
  });

  test("written over wall only: nothing about walking changes", () => {
    const hung = withPieces(
      [
        { ch: "Å", x: 1, y: 0 },
        { ch: "ê", x: 10, y: 0 },
      ],
      office,
    );
    expect([hung.at(1, 0), hung.at(2, 0), hung.at(10, 0)]).toEqual(["Å", "Å", "ê"]);
    for (let y = 0; y < office.height; y++)
      for (let x = 0; x < office.width; x++) expect(hung.walkable(x, y)).toBe(office.walkable(x, y));
    // Not on the floor, over the shelf, nor in the building.
    const wrong = withPieces(
      [
        { ch: "ê", x: 2, y: 3 },
        { ch: "ê", x: 6, y: 0 },
        { ch: "Å", x: 0, y: 0 },
      ],
      office,
    );
    expect(wrong.rows).toEqual(office.rows);
    const hq = hqMap(doorsFor([]));
    expect(withPieces([{ ch: "ê", x: 3, y: 1 }], hq).rows).toEqual(hq.rows);
    expect(withPieces([{ ch: "ø", x: 3, y: 5 }], hq).rows).toEqual(hq.rows);
  });

  test("the nearest clear slot; a hung piece takes it, and a full wall has none", () => {
    expect(wallSpot(office, 2, 1, true)).toEqual({ x: 2, y: 0 });
    expect(wallSpot(office, 9, 2, true)).toEqual({ x: 9, y: 0 });
    // A wide one is never placed over the shelf or a corner.
    for (let x = 0; x < office.width; x++) {
      const spot = wallSpot(office, x, 2, true)!;
      expect(canHang(office, spot.x, spot.y, 2, true)).toBe(true);
    }
    // Furniture under a slot makes it the last choice.
    const chair = withPieces([{ ch: "c", x: 2, y: 1 }], office);
    expect(wallSpot(chair, 2, 1, true)?.x).not.toBe(2);
    const all = withPieces(
      [
        { ch: "Å", x: 1, y: 0 },
        { ch: "Å", x: 3, y: 0 },
        { ch: "Å", x: 9, y: 0 },
        { ch: "Å", x: 11, y: 0 },
      ],
      office,
    );
    expect(wallSpot(all, 3, 1, true)).toBeNull();
    // The building keeps its own row.
    expect(wallSpot(hqMap(doorsFor([])), 3, 1)).toEqual({ x: 3, y: 1 });
    expect(wallSpot(MAPS.inn, 3, 1, true)).toBeNull();
  });

  test("bigger offices have more wall, and never the corner", () => {
    for (const tier of [1, 2, 3] as const) {
      const map = officeMap(tier);
      expect(canHang(map, map.width - 2, 0, 1, true)).toBe(true);
      expect(canHang(map, map.width - 1, 0, 1, true)).toBe(false);
    }
  });
});

describe("keeping the door, the desk and the seats reachable", () => {
  const door = MAPS.office.find("x")[0]!;
  const furnished = withPieces(STARTER_OFFICE, MAPS.office);

  test("anything fits in the starter office, one at a time", () => {
    for (const p of HOME_PIECES.filter((q) => !q.wall))
      expect(cutsOff(furnished, { ch: p.ch, x: 2, y: 3 })).toBe(false);
  });

  test("a piece that walls in the door is refused", () => {
    // The door's only way in is the tile above it: the exit at (5, 8) opens onto (5, 7).
    expect(cutsOff(MAPS.office, { ch: "æ", x: door[0], y: door[1] - 1 })).toBe(true);
  });

  test("a piece that walls in the desk or the chair is refused, whole rows included", () => {
    // Desk (5,3) and chair (5,4) with furniture all round them: the chair is the last reachable seat.
    const boxed = withPieces(
      [
        ...STARTER_OFFICE,
        { ch: "æ", x: 4, y: 4 },
        { ch: "æ", x: 6, y: 4 },
        { ch: "æ", x: 4, y: 3 },
        { ch: "æ", x: 6, y: 3 },
      ],
      MAPS.office,
    );
    expect(cutsOff(boxed, { ch: "æ", x: 5, y: 5 })).toBe(true);
    expect(cutsOff(boxed, { ch: "æ", x: 2, y: 7 })).toBe(false);
  });

  test("a wide one counts all its tiles, and the new piece must itself be reachable", () => {
    // A bookcase across the whole row under the shelf cuts nothing off, but one in a closed pocket is itself unreachable.
    expect(cutsOff(furnished, { ch: "ü", x: 1, y: 6 })).toBe(false);
    const walls = withPieces(
      [
        { ch: "æ", x: 2, y: 6 },
        { ch: "æ", x: 3, y: 7 },
        { ch: "æ", x: 1, y: 5 },
        { ch: "æ", x: 2, y: 5 },
        { ch: "æ", x: 1, y: 7 },
      ],
      MAPS.office,
    );
    expect(cutsOff(walls, { ch: "ø", x: 1, y: 6 })).toBe(true);
  });

  test("a rug is floor: it never cuts anything off, and a seat still can be reached over it", () => {
    const rugged = withPieces([...STARTER_OFFICE, { ch: "ç", x: 4, y: 6 }], MAPS.office);
    expect(rugged.walkable(4, 6)).toBe(true);
    expect(route(rugged, door, [5, 4])).not.toBeNull();
    expect(cutsOff(furnished, { ch: "ç", x: 4, y: 6 })).toBe(false);
    // A bean bag is a seat, and reachable.
    expect(cutsOff(furnished, { ch: "é", x: 9, y: 5 })).toBe(false);
    expect(LEGEND.é?.seat).toBe("sofa");
  });
});
