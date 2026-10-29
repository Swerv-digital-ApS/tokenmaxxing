import { beforeAll, expect, test } from "bun:test";
import { displayTab, SHOPS } from "@tokenmaxxing/core/shoprooms.ts";
import { installHeadlessGlobals } from "../src/render3d/perf/stubs.ts";

installHeadlessGlobals();

let shops: typeof import("../src/render3d/shops/catalog.ts");
beforeAll(async () => {
  shops = await import("../src/render3d/shops/catalog.ts");
});

/** The tab each group of the 3D showroom's catalogue is sold under. */
const TAB: Record<string, string> = {
  Desks: "desk",
  Wallpaper: "decor",
  Floors: "decor",
  Company: "company",
  Posters: "company",
  Furniture: "furniture",
  Home: "furniture",
};

test("every shelf in the 3D showroom opens, in the map, the tab that sells it", () => {
  const room = shops.shopRoom("furniture");
  const tabs = new Set<string>();
  for (const d of room.displays) {
    const [x, y] = [d.tile[0] + 1, d.tile[1] + 2];
    // Wall samples and hangings sit on the wall column / row of the map, one tile out from the shelf.
    const at = [
      [x, y],
      [x - 1, y],
      [x, y - 1],
    ].map(([a, b]) => displayTab("furniture", a!, b!));
    const want = TAB[d.item.group ?? ""];
    expect(want, d.item.id).toBeDefined();
    tabs.add(want!);
    // A shelf bank mixes groups on one tile and counts as furniture; a rug is floor, not a map display.
    const present = at.filter((t) => t !== null);
    if (present.length)
      expect(
        present.some((t) => t === want || t === "furniture"),
        `${d.item.id} at ${x},${y}: ${present}`,
      ).toBe(true);
  }
  expect([...tabs].sort()).toEqual(["company", "decor", "desk", "furniture"]);
});

test("the catalogue desk is a tile of the map that opens the company tab", () => {
  const tiles = SHOPS.furniture.displays.filter(([, , t]) => t === "company");
  expect(tiles.length).toBeGreaterThan(20);
});
