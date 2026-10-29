import { afterEach, expect, setSystemTime, test } from "bun:test";
import { COSTUMES } from "@tokenmaxxing/core/costumes.ts";
import { pumpkinSpots } from "@tokenmaxxing/core/halloween.ts";
import { plotId, townMap } from "@tokenmaxxing/core/maps.ts";
import { TILE } from "@tokenmaxxing/core/world.ts";
import { installHeadlessGlobals } from "../src/render3d/perf/stubs.ts";

installHeadlessGlobals();
// Some of the 3D modules reach the network client, which reads the page origin on import.
Object.assign(globalThis.location, { origin: "http://localhost" });

const { drawPumpkins } = await import("../src/game/halloween.ts");
const { world } = await import("../src/game/world.ts");
const { Pumpkins } = await import("../src/render3d/town/pumpkins3d.ts");
const { itemFrame } = await import("../src/art/characters.ts");
const { COVERS_HAIR, HAT_BUILDERS } = await import("../src/render3d/people/gear3dHead.ts");
const { CLOTHES } = await import("../src/render3d/shops/data/clothes.ts");
const { buildClothesItems } = await import("../src/render3d/shops/clothes-items.ts");
const { purchaseOf } = await import("../src/render3d/shops/purchase.ts");

/** Halloween night, and a day in June. */
const HALLOWEEN = new Date("2026-10-31T20:00:00Z");
const JUNE = new Date("2027-06-10T12:00:00Z");
const map = townMap([plotId(-2, 0), plotId(0, 2)]);
/** Tiles to the 3D town's world units, as `buildTown3d` lays them out. */
const toWorld = (tx: number, ty: number): [number, number] => [tx - map.x0 + 1.5, ty - map.y0 + 1.5];

afterEach(() => setSystemTime());

/** The tiles the 2D town draws pumpkins on, read back from where each sprite goes. */
function drawn2D(): [number, number][] {
  const items: { y: number; draw: () => void }[] = [];
  const at: [number, number][] = [];
  const g = { drawImage: (_s: unknown, x: number, y: number) => at.push([x, y]) };
  drawPumpkins({ g, items, now: 0 } as never);
  for (const i of items) i.draw();
  return at.map(([x, y]) => [Math.floor(x / TILE), Math.floor(y / TILE)]);
}

test("the 2D and the 3D town put the same pumpkins on the same tiles, only round Halloween", () => {
  Object.assign(world, { room: "town", map });
  const spots = pumpkinSpots(map);
  const tiles = spots.map((s): [number, number] => [s.x, s.y]);
  const town = new Pumpkins(map, toWorld);
  expect(town.pumpkins).toEqual(spots);

  setSystemTime(HALLOWEEN);
  expect(drawn2D().sort()).toEqual([...tiles].sort());
  town.update(0);
  expect(town.group.visible).toBe(true);

  setSystemTime(JUNE);
  expect(drawn2D()).toEqual([]);
  town.update(0);
  expect(town.group.visible).toBe(false);
});

test("however many pumpkins, the 3D ones are a handful of meshes", () => {
  const town = new Pumpkins(map, toWorld);
  let meshes = 0;
  town.group.traverse((o) => {
    if ((o as { isMesh?: boolean }).isMesh) meshes++;
  });
  expect(town.pumpkins.length).toBeGreaterThan(5);
  expect(meshes).toBeLessThanOrEqual(4);
});

test("every costume has 2D art, a 3D hat and, unless earned, a place in the 3D shop, in season", () => {
  for (const c of COSTUMES) {
    expect(itemFrame(c), c.name).not.toBeNull();
    expect(HAT_BUILDERS[c.name], c.name).toBeDefined();
    expect(COVERS_HAIR.has(c.name), c.name).toBe(true);
    // An earned one (the kattekonge's crown) is never on a shelf.
    if (c.earned) expect(CLOTHES.some((r) => r.id === c.id)).toBe(false);
    else
      expect(CLOTHES.find((r) => r.id === c.id)).toMatchObject({
        name: c.name,
        price: c.price,
        rarity: c.rarity,
      });
  }
  const ids = () => buildClothesItems().hats.map((h) => h.id);
  setSystemTime(HALLOWEEN);
  expect(ids()).toContain(COSTUMES[0]!.id);
  expect(purchaseOf(COSTUMES[0]!.id)).toEqual({ kind: "item", id: COSTUMES[0]!.id });
  setSystemTime(JUNE);
  expect(ids()).not.toContain(COSTUMES[0]!.id);
  expect(purchaseOf(COSTUMES[0]!.id)).toEqual({ kind: "unsold", why: "season" });
});
