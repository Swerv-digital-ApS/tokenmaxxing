import { expect, test } from "bun:test";
import { COSTUME_BASE, COSTUMES, costumeAt, offSeason, onSale } from "../src/costumes.ts";
import { EDITION_BASE, EDITIONS } from "../src/editions.ts";
import { pumpkinSpots, pumpkinsOut } from "../src/halloween.ts";
import { doorOf, plotId, SHOP_BLOCKS, townMap } from "../src/maps.ts";
import { ITEMS, itemById, itemsIn } from "../src/shop.ts";
import { copenhagenToMs } from "../src/sky.ts";
import { paperSpot } from "../src/street.ts";
import { LOOK_OPTIONS, lookWith, parseLook } from "../src/world.ts";

const cph = (at: string) => copenhagenToMs(at)!;

test("the pumpkins are out for the week up to Halloween and the day after", () => {
  expect(pumpkinsOut(cph("2026-10-23T23:59"))).toBe(false);
  expect(pumpkinsOut(cph("2026-10-24T00:00"))).toBe(true);
  expect(pumpkinsOut(cph("2026-10-31T21:00"))).toBe(true);
  expect(pumpkinsOut(cph("2026-11-01T23:59"))).toBe(true);
  expect(pumpkinsOut(cph("2026-11-02T00:00"))).toBe(false);
  expect(pumpkinsOut(cph("2027-06-23T21:00"))).toBe(false);
});

test("one on every doorstep and three in the patch, all on the grass", () => {
  const plots = [plotId(-2, 0), plotId(0, 2), plotId(1, -1)];
  const map = townMap(plots);
  const spots = pumpkinSpots(map);
  // The Tavern, three companies, four shops, and the patch.
  expect(spots).toHaveLength(1 + plots.length + Object.keys(SHOP_BLOCKS).length + 3);
  expect(new Set(spots.map((s) => `${s.x},${s.y}`)).size).toBe(spots.length);
  for (const s of spots) expect(map.at(s.x, s.y)).toBe(".");
  for (const plot of plots) {
    const [x, y] = doorOf(plot);
    // Left of the path below the door: the paper lands on its right.
    expect(spots).toContainEqual(expect.objectContaining({ x: x - 1, y: y + 1 }));
    const [px, py] = paperSpot([x, y]);
    expect(spots.some((s) => s.x === px && s.y === py)).toBe(false);
  }
  // The Tavern's path runs left from its door, so its pumpkin sits to the right.
  const [ix, iy] = map.find("I")[0]!;
  expect(spots).toContainEqual(expect.objectContaining({ x: ix + 1, y: iy + 1 }));
  expect(spots.some((s) => s.big) && spots.some((s) => !s.big)).toBe(true);
});

test("the costume is sold only round its holiday, and worn all year", () => {
  const hat = itemById(`hat.${COSTUME_BASE}`)!;
  expect(hat).toMatchObject({ name: "Jack-o'-lantern", holiday: "halloween", tradeable: true });
  expect(ITEMS).toContain(hat);
  expect(onSale(hat, cph("2026-10-16T23:59"))).toBe(false);
  expect(onSale(hat, cph("2026-10-17T00:00"))).toBe(true);
  expect(onSale(hat, cph("2026-11-02T23:59"))).toBe(true);
  expect(onSale(hat, cph("2026-11-03T00:00"))).toBe(false);
  // Anything that isn't a costume is always on sale.
  expect(onSale(itemById("hat.5")!, cph("2026-06-01T12:00"))).toBe(true);
  expect(offSeason("halloween")).toBe("That one is only sold round Halloween.");
  const look = lookWith({ style: 0, skin: 0, hair: 0, outfit: 0, hat: hat.index });
  expect(parseLook(look)).toEqual(look);
  expect(itemsIn(look).map((i) => i.id)).toEqual([hat.id]);
  expect(parseLook({ ...look, hat: COSTUME_BASE + COSTUMES.length })).toBeNull();
});

test("costumes never meet the shop, the raid's loot or the merchant's editions", () => {
  expect(LOOK_OPTIONS.hat).toBeLessThanOrEqual(EDITION_BASE);
  expect(Math.max(...EDITIONS.map((e) => e.index))).toBeLessThan(COSTUME_BASE);
  for (const c of COSTUMES) {
    expect(costumeAt(c.slot, c.index)).toBe(c);
    expect(c.blurb.length).toBeGreaterThan(0);
  }
  expect(costumeAt("glasses", COSTUME_BASE)).toBeUndefined();
});
