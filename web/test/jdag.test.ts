import { afterEach, expect, setSystemTime, test } from "bun:test";
import { TRUCK } from "@tokenmaxxing/core/jdag.ts";
import { townMap } from "@tokenmaxxing/core/maps.ts";
import { TILE } from "@tokenmaxxing/core/world.ts";
import { installHeadlessGlobals } from "../src/render3d/perf/stubs.ts";

installHeadlessGlobals();
// Some of the 3D modules reach the network client, which reads the page origin on import.
Object.assign(globalThis.location, { origin: "http://localhost" });

const { drawTruck, TRUCK_SIGN } = await import("../src/game/jdag.ts");
const { world } = await import("../src/game/world.ts");
const { Truck3d } = await import("../src/render3d/town/truck3d.ts");
const { TRUCK_PX } = await import("../src/art/jdag.ts");

/** J-dag 2026, parked (21:30 Copenhagen), driving in (20:59:30), and a night in June. */
const PARKED = new Date("2026-11-06T20:30:00Z");
const DRIVING = new Date("2026-11-06T19:59:30Z");
const JUNE = new Date("2027-06-10T21:00:00Z");
const map = townMap([]);
/** Tiles to the 3D town's world units, as `buildTown3d` lays them out. */
const toWorld = (tx: number, ty: number): [number, number] => [tx - map.x0 + 1.5, ty - map.y0 + 1.5];

afterEach(() => setSystemTime());

/** Where the 2D town draws the truck (its back tile, its row) and whether it signs it. */
function drawn2D(): { at: [number, number] | null; signed: boolean } {
  const items: { y: number; draw: () => void }[] = [];
  const labels: (() => void)[] = [];
  let at: [number, number] | null = null;
  const g = {
    drawImage: (_s: unknown, x: number, y: number) => {
      at = [x / TILE, (y + TRUCK_PX.h) / TILE - 1];
    },
  };
  const view = { x0: -1e4, y0: -1e4, x1: 1e4, y1: 1e4 };
  drawTruck({
    g,
    items,
    labels,
    now: 0,
    dpr: 1,
    scale: 1,
    view,
    toScreen: (x: number, y: number) => [x, y],
  } as never);
  for (const i of items) i.draw();
  return { at, signed: labels.length > 0 };
}

test("the 2D and the 3D truck are in the same place, signed only once parked, and gone in June", () => {
  Object.assign(world, { room: "town", map });
  const truck = new Truck3d(toWorld);
  const middle = (TRUCK.w - 1) / 2;

  setSystemTime(PARKED);
  expect(drawn2D()).toEqual({ at: [TRUCK.park, TRUCK.y], signed: true });
  truck.update();
  expect(truck.group.visible).toBe(true);
  expect(truck.group.position.x).toBeCloseTo(toWorld(TRUCK.park, TRUCK.y)[0] + middle);
  expect(truck.group.position.z).toBeCloseTo(toWorld(TRUCK.park, TRUCK.y)[1]);
  expect(truck.signs().map((s) => s.text)).toEqual([TRUCK_SIGN]);

  setSystemTime(DRIVING);
  const driving = drawn2D();
  expect(driving.signed).toBe(false);
  truck.update();
  expect(truck.group.position.x).toBeCloseTo(toWorld(driving.at![0], TRUCK.y)[0] + middle, 1);
  expect(truck.signs()).toEqual([]);

  setSystemTime(JUNE);
  expect(drawn2D().at).toBeNull();
  truck.update();
  expect(truck.group.visible).toBe(false);
});

test("the 3D truck is a handful of meshes", () => {
  let meshes = 0;
  new Truck3d(toWorld).group.traverse((o) => {
    if ((o as { isMesh?: boolean }).isMesh) meshes++;
  });
  expect(meshes).toBeLessThanOrEqual(16);
});
