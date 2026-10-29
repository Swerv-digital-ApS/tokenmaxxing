import { describe, expect, test } from "bun:test";
import { MAPS } from "../src/maps.ts";
import { MARKET_SLOTS, slotAt, slotTile } from "../src/market.ts";
import { displayTab, SHOP_DISPLAY_CHAR, SHOPS } from "../src/shoprooms.ts";

describe("Torvehallen's floor", () => {
  const map = MAPS["shop-market"];

  test("every display tile is a slot, in order, and nothing else is", () => {
    const tiles = [...map.find(SHOP_DISPLAY_CHAR.market)];
    expect(MARKET_SLOTS).toBe(tiles.length);
    expect(MARKET_SLOTS).toBe(40);
    // Row by row, left to right: the back wall's sixteen, then the two rows of cases.
    tiles.sort((a, b) => a[1] - b[1] || a[0] - b[0]);
    tiles.forEach(([x, y], slot) => {
      expect(slotTile(slot)).toEqual([x, y]);
      expect(slotAt(x, y)).toBe(slot);
      expect(displayTab("market", x, y)).toBe("market");
    });
    expect(slotAt(0, 0)).toBeNull();
    expect(slotTile(MARKET_SLOTS)).toBeUndefined();
    expect(tiles.slice(0, 16).every(([, y]) => y === SHOPS.market.displays[0]![1])).toBe(true);
  });

  test("every slot can be reached from a walkable tile next to it, from the door", () => {
    const [ex, ey] = SHOPS.market.door;
    const seen = new Set([`${ex},${ey - 1}`]);
    const queue: [number, number][] = [[ex, ey - 1]];
    while (queue.length) {
      const [x, y] = queue.shift()!;
      for (const [dx, dy] of [
        [0, 1],
        [0, -1],
        [1, 0],
        [-1, 0],
      ] as const) {
        const [nx, ny] = [x + dx, y + dy];
        if (seen.has(`${nx},${ny}`) || !map.walkable(nx, ny)) continue;
        seen.add(`${nx},${ny}`);
        queue.push([nx, ny]);
      }
    }
    for (let slot = 0; slot < MARKET_SLOTS; slot++) {
      const [x, y] = slotTile(slot)!;
      const next = [
        [x, y + 1],
        [x, y - 1],
        [x + 1, y],
        [x - 1, y],
      ];
      expect(
        next.some(([nx, ny]) => seen.has(`${nx},${ny}`)),
        `slot ${slot} at ${x},${y}`,
      ).toBe(true);
    }
  });
});
