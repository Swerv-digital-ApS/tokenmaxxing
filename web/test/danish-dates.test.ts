import { afterEach, expect, setSystemTime, test } from "bun:test";
import { BARREL, HITS } from "@tokenmaxxing/core/fastelavn.ts";
import { townMap } from "@tokenmaxxing/core/maps.ts";
import { BONFIRE } from "@tokenmaxxing/core/sankthans.ts";
import { TILE } from "@tokenmaxxing/core/world.ts";
import { installHeadlessGlobals } from "../src/render3d/perf/stubs.ts";

installHeadlessGlobals();
// Some of the 3D modules reach the network client, which reads the page origin on import.
Object.assign(globalThis.location, { origin: "http://localhost" });

const { drawBarrel, barrelSign } = await import("../src/game/fastelavn.ts");
const { drawBonfire } = await import("../src/game/sankthans.ts");
const { rocketsNow } = await import("../src/game/fireworks.ts");
const { world } = await import("../src/game/world.ts");
const { hud } = await import("../src/store.ts");
const { Barrel3d } = await import("../src/render3d/town/barrel3d.ts");
const { Bonfire3d } = await import("../src/render3d/town/bonfire3d.ts");

const FASTELAVN = new Date("2027-02-07T11:00:00Z");
const SANKT_HANS = new Date("2027-06-23T20:30:00Z"); // 22:30 in Copenhagen
const MIDNIGHT = new Date("2026-12-31T23:00:05Z"); // 00:00:05 on 1 January in Copenhagen
const JUNE = new Date("2027-06-10T12:00:00Z");
const map = townMap([]);
/** Tiles to the 3D town's world units, as `buildTown3d` lays them out. */
const toWorld = (tx: number, ty: number): [number, number] => [tx - map.x0 + 1.5, ty - map.y0 + 1.5];

afterEach(() => setSystemTime());

/** Draws a 2D pass and returns the tiles its sprites' bottom-left corners land on, and its labels' count. */
function drawn2D(draw: (f: never) => void): { tiles: [number, number][]; labels: number } {
  const items: { y: number; draw: () => void }[] = [];
  const labels: (() => void)[] = [];
  const tiles: [number, number][] = [];
  const g = {
    drawImage: (s: { height: number }, x: number, y: number) =>
      tiles.push([Math.floor(x / TILE), Math.floor((y + s.height - 1) / TILE)]),
  };
  const view = { x0: -1e4, y0: -1e4, x1: 1e4, y1: 1e4 };
  draw({
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
  return { tiles, labels: labels.length };
}

test("the fastelavn barrel: up on its day in 2D and 3D, cracked by the whacks, staves and a king once broken", () => {
  Object.assign(world, { room: "town", map });
  const barrel3d = new Barrel3d(toWorld);
  expect(barrel3d.group.position.x).toBeCloseTo(toWorld(BARREL.x, BARREL.y)[0]);

  setSystemTime(FASTELAVN);
  hud.set({ barrel: { year: 2027, hits: 12, king: null } });
  const up = drawn2D(drawBarrel);
  // The frame from the tile left of the barrel's, the barrel itself on the barrel's row.
  expect(up.tiles[0]).toEqual([BARREL.x - 1, BARREL.y]);
  expect(up.tiles).toHaveLength(2);
  expect(up.labels).toBe(1);
  barrel3d.update(0);
  expect(barrel3d.group.visible).toBe(true);
  expect(barrel3d.signs().map((s) => s.text)).toEqual([`🪅 Fastelavn barrel · ${HITS - 12} whacks to go`]);

  hud.set({ barrel: { year: 2027, hits: HITS, king: { id: 2, name: "Ada" } } });
  expect(barrelSign()).toBe("🐱 Kattekonge: Ada");
  barrel3d.update(0);
  expect(barrel3d.signs().map((s) => s.text)).toEqual(["🐱 Kattekonge: Ada"]);

  setSystemTime(JUNE);
  hud.set({ barrel: null });
  expect(drawn2D(drawBarrel).tiles).toEqual([]);
  barrel3d.update(0);
  expect(barrel3d.group.visible).toBe(false);
  expect(barrel3d.signs()).toEqual([]);
});

test("the Sankt Hans bonfire burns in both renderers on its evening only", () => {
  Object.assign(world, { room: "town", map });
  const bonfire3d = new Bonfire3d(toWorld);
  expect(bonfire3d.group.position.x).toBeCloseTo(toWorld(BONFIRE.x, BONFIRE.y)[0] + (BONFIRE.w - 1) / 2);
  setSystemTime(SANKT_HANS);
  // The pile and its fire, from the bonfire's own tile.
  expect(drawn2D(drawBonfire).tiles).toEqual([
    [BONFIRE.x, BONFIRE.y],
    [BONFIRE.x, BONFIRE.y],
  ]);
  bonfire3d.update(0);
  expect(bonfire3d.group.visible).toBe(true);
  setSystemTime(JUNE);
  expect(drawn2D(drawBonfire).tiles).toEqual([]);
  bonfire3d.update(0);
  expect(bonfire3d.group.visible).toBe(false);
});

test("rockets go up over the town at midnight on New Year's Eve", () => {
  Object.assign(world, { room: "town", map });
  setSystemTime(MIDNIGHT);
  expect(rocketsNow().length).toBeGreaterThan(0);
  setSystemTime(JUNE);
  expect(rocketsNow()).toEqual([]);
});
