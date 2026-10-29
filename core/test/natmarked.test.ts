import { describe, expect, test } from "bun:test";
import { LEGEND, MAPS, SHOP_BLOCKS, townMap } from "../src/maps.ts";
import { GREETINGS, SHOPKEEPERS } from "../src/shopkeepers.ts";
import {
  displayTab,
  SHOP_DISPLAY_CHAR,
  SHOP_DOOR_CHAR,
  SHOP_IDS,
  SHOP_ROOM,
  SHOP_SELLS,
  SHOP_TABS,
  SHOPS,
  shopOfRoom,
} from "../src/shoprooms.ts";
import { parseRoom } from "../src/world.ts";

describe("Natmarked, the case shop, is registered like every other shop", () => {
  test("it has an id in every table a shop needs", () => {
    expect(SHOP_IDS).toContain("natmarked");
    expect(SHOP_ROOM.natmarked).toBe("shop-natmarked");
    expect(shopOfRoom("shop-natmarked")).toBe("natmarked");
    expect(parseRoom("shop-natmarked")).toBe("shop-natmarked");
    expect(MAPS["shop-natmarked"].name).toBe("Natmarked");
    expect(SHOP_SELLS.natmarked.length).toBeGreaterThan(0);
    expect(SHOP_TABS.natmarked).toEqual(["case"]);
    expect(SHOP_BLOCKS.natmarked).toBeDefined();
    expect(GREETINGS.natmarked.length).toBeGreaterThan(0);
  });

  test("its door and display tiles are its own, in the legend, and in the town once", () => {
    for (const table of [SHOP_DOOR_CHAR, SHOP_DISPLAY_CHAR])
      expect(new Set(SHOP_IDS.map((id) => table[id])).size).toBe(SHOP_IDS.length);
    expect(LEGEND[SHOP_DOOR_CHAR.natmarked]!.portal).toBe(true);
    expect(LEGEND[SHOP_DISPLAY_CHAR.natmarked]!.shop).toBe("natmarked");
    expect(townMap([]).find(SHOP_DOOR_CHAR.natmarked)).toHaveLength(1);
  });

  test("its shelves open the case page, and the counter is where the keeper faces", () => {
    const shop = SHOPS.natmarked;
    expect(shop.displays.length).toBeGreaterThan(0);
    for (const [x, y] of shop.displays) expect(displayTab("natmarked", x, y)).toBe("case");
    expect(MAPS["shop-natmarked"].kind(...shop.counter).counter).toBe(true);
  });

  test("the keeper stands on her tile, talks about the market, and never about odds or money", () => {
    const mei = SHOPKEEPERS.find((k) => k.home?.room === SHOP_ROOM.natmarked)!;
    expect(mei.name).toBe(SHOPS.natmarked.keeperName);
    expect([mei.home!.x, mei.home!.y]).toEqual(SHOPS.natmarked.keeper);
    expect(mei.lines.length).toBeGreaterThanOrEqual(5);
    expect(mei.lines.length).toBeLessThanOrEqual(8);
    for (const line of [...mei.lines, ...GREETINGS.natmarked])
      expect(line).not.toMatch(/odds|chance|percent|%|dollar|euro|real money|\$|€/i);
    expect(new Set(SHOPKEEPERS.map((k) => k.id)).size).toBe(SHOPKEEPERS.length);
  });
});
