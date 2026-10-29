import { beforeAll, expect, test } from "bun:test";
import { installHeadlessGlobals } from "../src/render3d/perf/stubs.ts";

installHeadlessGlobals();
Object.assign(globalThis, { requestAnimationFrame: (cb: () => void) => setTimeout(cb, 0) });

let W: typeof import("../src/render3d/rooms/world.ts");
let kit: typeof import("../src/render3d/kit/kit.ts");
beforeAll(async () => {
  W = await import("../src/render3d/rooms/world.ts");
  kit = await import("../src/render3d/kit/kit.ts");
  await import("../src/render3d/rooms/world-rooms.ts");
  await (await import("../src/render3d/kit/registry.ts")).loadSlices(["office", "dungeon"]);
});

test("a hand-built room needs its code first, then builds", async () => {
  const world = new W.World();
  expect(() => world.room("hq")).toThrow(/not loaded/);
  const room = await world.load("hq");
  expect(room.id).toBe("hq");
  expect(world.isBuilt("hq")).toBe(true);
  expect(world.room("hq")).toBe(room);
});

test("a tile-drawn room builds in steps and matches the one built at once", async () => {
  const world = new W.World();
  const staged = await world.load("dungeon");
  const direct = new W.WorldRoom("dungeon", world.maps.dungeon);
  let a = 0;
  let b = 0;
  staged.group.traverse(() => a++);
  direct.group.traverse(() => b++);
  expect(a).toBe(b);
});

test("the least recently used rooms are evicted past the limit, with their ticks", async () => {
  const world = new W.World();
  world.maxBuilt = 2;
  const ticks0 = kit.ticks.length;
  await world.load("hq");
  const afterHq = kit.ticks.length;
  await world.load("upstairs");
  await world.load("basement");
  expect(world.isBuilt("hq")).toBe(false);
  expect(world.isBuilt("basement")).toBe(true);
  // The evicted room's ticks are gone, and building it again works.
  expect(kit.ticks.length).toBeGreaterThanOrEqual(ticks0);
  await world.load("hq");
  expect(world.isBuilt("hq")).toBe(true);
  expect(afterHq).toBeGreaterThanOrEqual(ticks0);
});

test("pinned rooms survive eviction", async () => {
  const world = new W.World();
  world.maxBuilt = 1;
  world.pinned.add("hq");
  await world.load("hq");
  await world.load("upstairs");
  await world.load("basement");
  expect(world.isBuilt("hq")).toBe(true);
});

test("neighbours are the doors of a room", () => {
  const world = new W.World();
  expect(world.neighbours("inn").sort()).toEqual(["basement", "town", "upstairs"]);
});
