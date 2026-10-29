import { beforeAll, expect, test } from "bun:test";
import type { WorldGame } from "@tokenmaxxing/core/world.ts";

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

type Games = typeof import("../src/render3d/town/games3d.ts");
type World = typeof import("../src/game/world.ts");
let games: Games;
let w: World;
beforeAll(async () => {
  games = await import("../src/render3d/town/games3d.ts");
  w = await import("../src/game/world.ts");
});

const table = (id: number, o: Partial<WorldGame> = {}): WorldGame => ({
  id,
  game: "hype",
  spot: { x: 7, y: 5, w: 3, h: 3, kind: "table" },
  players: [2, 3],
  seats: [
    { x: 7, y: 6, facing: "right" },
    { x: 9, y: 6, facing: "left" },
  ],
  status: {},
  board: null,
  watchers: 0,
  headline: "Round 2/3",
  endsAt: null,
  ...o,
});

const arena = (id: number): WorldGame => ({
  id,
  game: "tokenmaxxing",
  spot: { x: 2, y: 10, w: 3, h: 3, kind: "arena" },
  players: [4, 5, 6],
  seats: [0, 1, 2].map((i) => ({ x: 2 + i, y: 11, facing: "up" as const })),
  status: {},
  board: [
    { player: 5, value: 9e6, label: "9.0M" },
    { player: 4, value: 3e6, label: "3.0M" },
  ],
  watchers: 2,
  headline: null,
  endsAt: Date.now() + 60_000,
});

const meshes = (root: import("three").Object3D): number => {
  let n = 0;
  root.traverse((o) => {
    if ((o as import("three").Mesh).isMesh) n++;
  });
  return n;
};

test("a game on the square gets its table and stools, and takes them away when it ends", () => {
  w.world.games.clear();
  const layer = new games.GamesLayer((x, y) => [x + 0.5, y + 0.5]);
  layer.update(0);
  expect(layer.group.visible).toBe(false);
  expect(meshes(layer.group)).toBe(0);
  w.world.games.set(1, table(1));
  layer.update(0.1);
  expect(layer.group.visible).toBe(true);
  const built = meshes(layer.group);
  // The table (its watchers' sign hidden) and a stool for each of the two seats.
  expect(built).toBeGreaterThan(8);
  w.world.games.delete(1);
  layer.update(0.2);
  expect(meshes(layer.group)).toBe(0);
  layer.dispose();
});

test("a third player at the table means another stool; a changed headline doesn't rebuild anything", () => {
  w.world.games.clear();
  const layer = new games.GamesLayer((x, y) => [x + 0.5, y + 0.5]);
  w.world.games.set(1, table(1));
  layer.update(0);
  const two = meshes(layer.group);
  const same = layer.group.children[0]!;
  w.world.games.set(1, table(1, { headline: "Round 3/3", watchers: 3 }));
  layer.update(0.1);
  expect(layer.group.children[0]).toBe(same);
  w.world.games.set(
    1,
    table(1, { players: [2, 3, 4], seats: [...table(1).seats, { x: 8, y: 7, facing: "up" }] }),
  );
  layer.update(0.2);
  expect(meshes(layer.group)).toBeGreaterThan(two);
  layer.dispose();
});

test("an arena gets a desk for each player and a banner over it to click, with the callout above", () => {
  w.world.games.clear();
  const layer = new games.GamesLayer((x, y) => [x + 0.5, y + 0.5]);
  w.world.games.set(7, arena(7));
  layer.update(0);
  layer.update(0.5);
  const signs = layer.signs();
  const banner = signs.find((s) => s.key === "game:7");
  expect(banner?.text).toStartWith("🏁 Tokenmaxxing");
  expect(banner?.text).toContain("👀 2");
  expect(banner?.onClick).toBeFunction();
  expect(signs.some((s) => s.key === "say:7")).toBe(false);
  w.world.tableBubbles.set(7, { text: "Fight!", until: performance.now() + 5000 });
  const said = layer.signs().find((s) => s.key === "say:7");
  expect(said).toMatchObject({ text: "Fight!", cls: "bubble" });
  layer.dispose();
  w.world.tableBubbles.clear();
  w.world.games.clear();
});
