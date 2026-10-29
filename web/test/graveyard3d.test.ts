import { expect, test } from "bun:test";
import { forcedStones, GRAVES } from "@tokenmaxxing/core/graveyard.ts";

const pixels = () => ({ data: new Uint8ClampedArray(1 << 22), width: 1024, height: 1024 });
const ctx = new Proxy(
  {},
  {
    get: (_t, k) => (k === "canvas" ? {} : k === "getImageData" ? pixels : () => ({ addColorStop() {} })),
    set: () => true,
  },
);
const fake = { width: 0, height: 0, style: {}, getContext: () => ctx, addEventListener() {} };
Object.assign(globalThis, {
  document: { createElement: () => ({ ...fake }), body: { append() {} }, addEventListener() {} },
  window: globalThis,
  localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
  location: { search: "", origin: "http://localhost:1", href: "http://localhost:1/" },
  navigator: { userAgent: "bun" },
});

test("the 3D graveyard's stones stand on the plots the 2D game draws and blocks them on", async () => {
  const { setGraves, blocksGrave } = await import("../src/game/graveyard.ts");
  const { world } = await import("../src/game/world.ts");
  const { Graveyard3D } = await import("../src/render3d/town/graveyard3d.ts");
  const stones = forcedStones("3", Date.now())!;
  setGraves(stones);
  const yard = new Graveyard3D((tx, ty) => [tx + 0.5, ty + 0.5]);
  yard.update(0);
  expect(yard.group.children.map((c) => [c.position.x - 0.5, c.position.z - 0.5])).toEqual(
    stones.map((s) => [...GRAVES[s.plot]!]),
  );
  expect(yard.signs().map((s) => s.text)).toContain("GPT-4 Turbo");
  const room = world.room;
  world.room = "town";
  expect(stones.every((s) => blocksGrave(...GRAVES[s.plot]!))).toBe(true);
  expect(blocksGrave(...GRAVES[GRAVES.length - 1]!)).toBe(false);
  world.room = room;
  setGraves([]);
  yard.update(CHECK_AFTER);
  expect(yard.group.children).toHaveLength(0);
  yard.dispose();
});

/** Past `Graveyard3D`'s once-a-second look at the stones. */
const CHECK_AFTER = 5000;
