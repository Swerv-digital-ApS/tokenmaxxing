import { expect, setDefaultTimeout, test } from "bun:test";
import { providerOf } from "@tokenmaxxing/core/launch.ts";
import { MAPS } from "@tokenmaxxing/core/maps.ts";
import { RANKING, STATUE_TILE, UNVEIL_MS } from "@tokenmaxxing/core/statue.ts";
import * as THREE from "three";
import { installHeadlessGlobals } from "../src/render3d/perf/stubs.ts";

installHeadlessGlobals();
// The game's modules connect to where the page came from, and labels come and go.
Object.assign(globalThis.location, { origin: "http://localhost" });
const element = document.createElement.bind(document);
Object.assign(document, { createElement: (tag: string) => Object.assign(element(tag), { remove() {} }) });
setDefaultTimeout(60_000);

const { buildTown3d } = await import("../src/render3d/town/town3d.ts");
const { StatueLayer } = await import("../src/render3d/town/statue3d.ts");
const { STATUE_TOP } = await import("../src/render3d/town/fx3d-town.ts");
const { plaqueNow, setStatue } = await import("../src/game/statue.ts");

/** An overlay that only remembers the labels it was asked to make. */
function overlay() {
  const made: { textContent: string; style: Record<string, string> }[] = [];
  return {
    made,
    layer: { append() {} },
    make() {
      const el = { textContent: "", style: {} as Record<string, string>, addEventListener() {}, remove() {} };
      made.push(el);
      return el;
    },
    place: () => true,
    project: () => [0, 0] as [number, number],
  };
}

const frame = (o: ReturnType<typeof overlay>, now = 0) =>
  ({
    now,
    t: now / 1000,
    dt: 1 / 60,
    camera: new THREE.OrthographicCamera(),
    overlay: o,
    me: null,
    calm: false,
    density: 1,
  }) as never;

const gemini = { model: "Gemini 4 Argon", org: "google", ranking: RANKING, score: 1525, asOf: null };

test("the 3D statue stands on the tile the 2D map has it on", () => {
  const town = buildTown3d([]);
  const tile = town.map.find(STATUE_TILE)[0]!;
  expect(tile).toEqual(MAPS.town.find(STATUE_TILE)[0]!);
  const layer = new StatueLayer(tile, (tx, ty) => town.toWorld(tx, ty));
  const [x, z] = town.toWorld(tile[0], tile[1]);
  layer.update(frame(overlay()));
  const box = new THREE.Box3().setFromObject(layer.group);
  const centre = box.getCenter(new THREE.Vector3());
  expect(Math.abs(centre.x - x)).toBeLessThan(0.5);
  expect(Math.abs(centre.z - z)).toBeLessThan(0.5);
  layer.dispose();
});

test("it's draped until there's a leader, the drape lifts off as one is unveiled, and the sign says who", () => {
  const layer = new StatueLayer([5, 5], (tx, ty) => [tx, ty]);
  const drape = layer.group.children[1]!;
  const o = overlay();
  setStatue({ leader: null, since: 0, pinned: false });
  layer.update(frame(o));
  expect(drape.visible).toBe(true);
  expect(drape.position.y).toBe(STATUE_TOP);
  expect(o.made[0]!.textContent).toContain("Unveiling soon");

  setStatue({ leader: gemini, since: Date.now() - UNVEIL_MS / 2, pinned: false });
  layer.update(frame(o, 16));
  expect(drape.visible).toBe(true);
  expect(drape.position.y).toBeGreaterThan(STATUE_TOP);
  expect(o.made[0]!.textContent).toBe("🏆 #1 Gemini 4 Argon");
  expect(plaqueNow().accent).toBe(providerOf("google").accent);
  // The confetti went up: its emoji are made straight into the layer, not through `make`.
  expect(o.made).toHaveLength(1);

  setStatue({ leader: gemini, since: Date.now() - 2 * UNVEIL_MS, pinned: false });
  layer.update(frame(o, 32));
  expect(drape.visible).toBe(false);
  layer.dispose();
});
