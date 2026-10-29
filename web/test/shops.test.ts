import { expect, test } from "bun:test";
import { LEGEND, MAPS, townMap } from "@tokenmaxxing/core/maps.ts";
import { SHOP_IDS, SHOP_ROOM, SHOPS } from "@tokenmaxxing/core/shoprooms.ts";
import { TILE } from "@tokenmaxxing/core/world.ts";

/** Every canvas the art bakes, with its size and the rects painted on it. */
const canvases: { w: number; h: number; bad: string[]; painted: number }[] = [];
const ctx = (c: { w: number; h: number; bad: string[]; painted: number }) => ({
  fillStyle: "",
  fillRect(x: number, y: number, w: number, h: number) {
    if (w <= 0 || h <= 0) return;
    c.painted++;
    if (![x, y, w, h].every(Number.isInteger) || x < 0 || y < 0 || x + w > c.w || y + h > c.h)
      c.bad.push(`${x},${y} ${w}x${h} in ${c.w}x${c.h}`);
  },
  drawImage() {},
});
(globalThis as unknown as { document: unknown }).document = {
  createElement() {
    const rec = { w: 0, h: 0, bad: [] as string[], painted: 0 };
    canvases.push(rec);
    return {
      get width() {
        return rec.w;
      },
      set width(v: number) {
        rec.w = v;
      },
      get height() {
        return rec.h;
      },
      set height(v: number) {
        rec.h = v;
      },
      getContext: () => ctx(rec),
    };
  },
};

const { objectAt } = await import("../src/art/objects.ts");
const { barTabSide } = await import("../src/art/tavern.ts");

test("every tile of every shop, and of the Tavern, draws on whole pixels inside its sprite", () => {
  const rooms = [MAPS.inn, ...SHOP_IDS.map((id) => MAPS[SHOP_ROOM[id]])];
  for (const map of rooms)
    for (let y = map.y0; y < map.y0 + map.height; y++)
      for (let x = map.x0; x < map.x0 + map.width; x++) objectAt(map, x, y);
  // And the storefronts in the town (its trees and fountain are older art).
  const town = townMap([]);
  for (const [x, y] of town.find("Ħ")) objectAt(town, x, y);
  expect(canvases.length).toBeGreaterThan(20);
  for (const c of canvases) expect(c.bad).toEqual([]);
});

test("Torvehallen: every display slot draws a case or a shelf, and the price tags draw inside their sprite", async () => {
  const { MARKET_SLOTS, slotTile } = await import("@tokenmaxxing/core/market.ts");
  const { priceTag, tagText } = await import("../src/art/market.ts");
  const before = canvases.length;
  const hall = MAPS["shop-market"];
  for (let slot = 0; slot < MARKET_SLOTS; slot++) {
    const [x, y] = slotTile(slot)!;
    expect(objectAt(hall, x, y)).not.toBeNull();
  }
  for (const price of [1, 99, 150, 999, 1000, 1200, 6000]) priceTag(price, price % 2 === 0);
  expect(canvases.length).toBeGreaterThan(before);
  for (const c of canvases.slice(before)) expect(c.bad).toEqual([]);
  expect([1, 999, 1000, 1200, 6000].map(tagText)).toEqual(["1", "999", "1K", "1.2K", "6K"]);
});

test("the storefronts are five tiles wide and four deep, with a door tile in the middle", () => {
  const town = townMap([]);
  for (const id of SHOP_IDS) {
    const [dx, dy] = town.find(
      { furniture: "ƒ", clothes: "Ç", barber: "Ð", pets: "ð", natmarked: "Ñ", market: "Ƭ" }[id],
    )[0]!;
    const front = objectAt(town, dx - 2, dy - 3);
    expect(front?.canvas).toBeDefined();
    const rec = canvases.find((c) => c.w === 5 * TILE && c.h === 4 * TILE && c.painted > 40);
    expect(rec).toBeDefined();
    // Only the top-left tile of the front draws it.
    expect(objectAt(town, dx - 1, dy - 3)).toBeNull();
    expect(objectAt(town, dx, dy)).toBeNull();
  }
});

test("each shop's counter and displays draw, and the shopkeeper's spot is open floor", () => {
  for (const id of SHOP_IDS) {
    const map = MAPS[SHOP_ROOM[id]];
    expect(objectAt(map, ...SHOPS[id].counter)).not.toBeNull();
    for (const [x, y] of SHOPS[id].displays) expect(objectAt(map, x, y)).not.toBeNull();
    expect(LEGEND[map.at(...SHOPS[id].keeper)]!.walk).toBe(true);
  }
});

test("the bar tab on the west wall fits its four tiles and crowns last week's winner", () => {
  const tab = barTabSide(["ADA", "BOB", "CYD"], 1);
  expect(tab.width).toBe(TILE);
  expect(tab.height).toBe(4 * TILE);
  expect(MAPS.inn.find("J")).toHaveLength(4);
});
