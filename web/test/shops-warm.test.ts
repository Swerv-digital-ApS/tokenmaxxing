import { beforeAll, expect, test } from "bun:test";
import { installHeadlessGlobals } from "../src/render3d/perf/stubs.ts";

installHeadlessGlobals();

let shops: typeof import("../src/render3d/shops/catalog.ts");
beforeAll(async () => {
  shops = await import("../src/render3d/shops/catalog.ts");
});

test("the pet shop builds ahead in slices, and walking in then takes what was built", () => {
  let steps = 0;
  while (!shops.warmShop("pets")) steps++;
  expect(steps).toBeGreaterThan(5);
  expect(shops.warmShop("pets")).toBe(true);
  const room = shops.shopRoom("pets");
  expect(room.displays.length).toBeGreaterThan(20);
  expect(shops.shopRoom("pets")).toBe(room);
});

test("a shop with no slices is simply built when it is asked for", () => {
  expect(shops.warmShop("barber")).toBe(true);
});

test("entering a partially prepared shop keeps its work and releases its animation callbacks on disposal", async () => {
  const { disposeObject } = await import("../src/render3d/engine/dispose.ts");
  const { ticks } = await import("../src/render3d/kit/kit.ts");
  const old = shops.shopRoom("pets");
  disposeObject(old.room.group);
  shops.forgetShopRoom("pets");
  const before = ticks.length;
  for (let i = 0; i < 12; i++) shops.warmShop("pets");
  const room = shops.shopRoom("pets");
  expect(room.displays.length).toBeGreaterThan(20);
  disposeObject(room.room.group);
  shops.forgetShopRoom("pets");
  expect(ticks.length).toBe(before);
});

test("cancelling shop preparation drops pending animation callbacks and permits a fresh build", async () => {
  const { ticks } = await import("../src/render3d/kit/kit.ts");
  const before = ticks.length;
  for (let i = 0; i < 12; i++) shops.warmShop("pets");
  shops.dropWarmedShops();
  expect(ticks.length).toBe(before);
  expect(shops.warmShop("pets")).toBe(false);
  shops.dropWarmedShops();
});
