import { afterEach, expect, setSystemTime, test } from "bun:test";
import { MAPS } from "@tokenmaxxing/core/maps.ts";
import { CALM } from "@tokenmaxxing/core/sky.ts";
import { TILE } from "@tokenmaxxing/core/world.ts";
import * as THREE from "three";
import { installHeadlessGlobals } from "../src/render3d/perf/stubs.ts";

installHeadlessGlobals();
// Some of the 3D modules reach the network client, which reads the page origin on import.
Object.assign(globalThis.location, { origin: "http://localhost" });

const { drawJulefrokost } = await import("../src/game/december.ts");
const { weatherNow } = await import("../src/game/sky.ts");
const { world } = await import("../src/game/world.ts");
const { hud } = await import("../src/store.ts");
const { JulefrokostSpread } = await import("../src/render3d/rooms/julefrokost3d.ts");

/** Friday 11 December 2026 at 20:00 in Copenhagen (a julefrokost), and the Sunday after. */
const FRIDAY = new Date("2026-12-11T19:00:00Z");
const SUNDAY = new Date("2026-12-13T19:00:00Z");

afterEach(() => setSystemTime());

function drawn2D(): [number, number][] {
  const items: { y: number; draw: () => void }[] = [];
  const at: [number, number][] = [];
  const g = { drawImage: (_s: unknown, x: number, y: number) => at.push([x / TILE, y / TILE]) };
  drawJulefrokost({ g, items } as never);
  for (const i of items) i.draw();
  return at;
}

test("julefrokost lays every Tavern table in 2D, and the 3D spread shows on the same evenings", () => {
  Object.assign(world, { room: "inn", map: MAPS.inn });
  const tables = [new THREE.Vector3(4, 0, 6), new THREE.Vector3(9, 0, 6), new THREE.Vector3(4, 0, 10)].map(
    (p) => {
      const t = new THREE.Mesh(new THREE.BoxGeometry(1.92, 0.75, 0.86));
      t.position.copy(p);
      return t;
    },
  );
  const room = { group: new THREE.Group() };
  room.group.add(...tables);
  const spread = new JulefrokostSpread(room as never, tables);
  let meshes = 0;
  spread.group.traverse((o) => {
    if ((o as { isMesh?: boolean }).isMesh) meshes++;
  });
  expect(meshes).toBeLessThanOrEqual(8);

  setSystemTime(FRIDAY);
  expect(drawn2D().sort()).toEqual(
    MAPS.inn
      .find("n")
      .map(([x, y]): [number, number] => [x, y])
      .sort(),
  );
  spread.update();
  expect(spread.group.visible).toBe(true);

  setSystemTime(SUNDAY);
  expect(drawn2D()).toEqual([]);
  spread.update();
  expect(spread.group.visible).toBe(false);
});

test("the town's weather is snow all December, whatever the server says", () => {
  hud.set({ weather: { ...CALM, kind: "fog", intensity: 0.6 } });
  setSystemTime(FRIDAY);
  expect(weatherNow().kind).toBe("snow");
  setSystemTime(new Date("2026-11-20T12:00:00Z"));
  hud.set({ weather: { ...CALM, kind: "rain", intensity: 0.5 } });
  expect(weatherNow().kind).toBe("rain");
});
