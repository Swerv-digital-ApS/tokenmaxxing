import { beforeAll, expect, test } from "bun:test";
import { MAPS } from "@tokenmaxxing/core/maps.ts";
import { type Listing, MARKET_SLOTS } from "@tokenmaxxing/core/market.ts";
import { SHOP_INSET } from "@tokenmaxxing/core/shoprooms.ts";
import { installHeadlessGlobals } from "../src/render3d/perf/stubs.ts";

installHeadlessGlobals();

type Shops = typeof import("../src/render3d/shops/catalog.ts");
type Slots = typeof import("../src/render3d/shops/market-slots.ts");
let shops: Shops;
let slots: Slots;
beforeAll(async () => {
  shops = await import("../src/render3d/shops/catalog.ts");
  slots = await import("../src/render3d/shops/market-slots.ts");
});

const listing = (id: number, slot: number, item = "hat.1", price = 120): Listing => ({
  id,
  slot,
  item,
  price,
  sellerId: 7,
  seller: "Ada",
  expiresAt: 0,
  edition: null,
});

test("every slot has a place inside the hall, on a different spot", () => {
  const seen = new Set<string>();
  for (let slot = 0; slot < MARKET_SLOTS; slot++) {
    const s = slots.slotSpot(slot)!;
    expect(s).not.toBeNull();
    expect(s.x).toBeGreaterThan(0);
    expect(s.x).toBeLessThan(22);
    expect(s.z).toBeGreaterThan(0);
    expect(s.z).toBeLessThan(14);
    seen.add(`${s.x},${s.z}`);
  }
  expect(seen.size).toBe(MARKET_SLOTS);
  expect(slots.slotSpot(MARKET_SLOTS)).toBeNull();
  // The sixteen on the back wall stand on the shelves, the rest in the cases.
  expect(slots.slotSpot(0)!.shelf).toBe(true);
  expect(slots.slotSpot(15)!.shelf).toBe(true);
  expect(slots.slotSpot(16)!.shelf).toBe(false);
});

test("the hall blocks the tiles the server blocks, and every slot is on a blocked tile", async () => {
  // Its animation callbacks are taken out of the kit's global list, as a room does, so other tests do not see them.
  const { withTicks } = await import("../src/render3d/rooms/rooms.ts");
  const built = withTicks(() => shops.shopRoom("market")).value;
  const core = MAPS["shop-market"];
  expect(built.map.width).toBe(core.width);
  expect(built.map.height).toBe(core.height);
  for (let y = 0; y < core.height; y++)
    for (let x = 0; x < core.width; x++)
      if (core.walkable(x, y) !== built.map.walkable(x, y)) throw new Error(`tile ${x},${y} differs`);
  for (let slot = 0; slot < MARKET_SLOTS; slot++) {
    const s = slots.slotSpot(slot)!;
    expect(built.map.walkable(Math.floor(s.x) + SHOP_INSET[0], Math.floor(s.z) + SHOP_INSET[1])).toBe(false);
  }
  shops.forgetShopRoom("market");
});

test("an item gets the picture the shop would show it in", () => {
  const { itemById } = require("@tokenmaxxing/core/shop.ts") as typeof import("@tokenmaxxing/core/shop.ts");
  expect(slots.iconOf(itemById("pet.2")!)).toEqual({ kind: "pet", pet: 2, variant: 0 });
  const hat = slots.iconOf(itemById("hat.1")!)!;
  expect(hat.kind).toBe("avatar");
  expect((hat as { focus?: string }).focus).toBe("head");
  expect((hat as { look: { hat: number } }).look.hat).toBe(1);
});

test("the layer puts a card on each listing and a marker on each free slot, and rebuilds only what changed", async () => {
  const { hud } = await import("../src/store.ts");
  const THREE = await import("three");
  // No icon queue in the test: the cards keep their stand-in pictures.
  const layer = new slots.MarketSlots(async () => ({
    iconsAvailable: () => false,
    requestIcon: () => {
      throw new Error("no icons");
    },
  }));
  const frame = {
    camera: { getWorldDirection: (v: import("three").Vector3) => v.set(-0.6, -0.5, -0.6) },
  } as unknown as Parameters<typeof layer.update>[0];
  const cards = () => layer.group.children.filter((c) => c.name.startsWith("market-slot-"));

  // Nothing known yet: nothing drawn, not even markers.
  hud.set({ market: null });
  layer.update(frame);
  expect(cards().length).toBe(0);
  expect((layer.group.children[0] as import("three").InstancedMesh).count).toBe(0);

  hud.set({ market: { listings: [listing(1, 0), listing(2, 20, "pet.2", 400)], mine: null, at: 1 } });
  layer.update(frame);
  expect(cards().length).toBe(2);
  const marks = layer.group.children[0] as import("three").InstancedMesh;
  expect(marks.count).toBe(MARKET_SLOTS - 2);
  const first = cards().find((c) => c.name === "market-slot-0")!;
  // Facing the camera: the card's normal is the way back along the view.
  expect(first.rotation.y).toBeCloseTo(Math.atan2(0.6, 0.6));
  expect(THREE.MathUtils.radToDeg(first.rotation.y)).toBeCloseTo(45);

  // The same listings in a new object (a poll): the cards are the same objects.
  hud.set({ market: { listings: [listing(2, 20, "pet.2", 400), listing(1, 0)], mine: null, at: 2 } });
  layer.update(frame);
  expect(cards().find((c) => c.name === "market-slot-0")).toBe(first);

  // One sold and one new: the sold card goes, the new one comes.
  hud.set({ market: { listings: [listing(1, 0), listing(3, 21, "hat.2", 90)], mine: null, at: 3 } });
  layer.update(frame);
  expect(
    cards()
      .map((c) => c.name)
      .sort(),
  ).toEqual(["market-slot-0", "market-slot-21"]);
  expect(cards().find((c) => c.name === "market-slot-0")).toBe(first);

  layer.dispose();
  expect(layer.group.parent).toBeNull();
  hud.set({ market: null });
});
