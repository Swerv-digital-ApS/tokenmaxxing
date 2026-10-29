import { beforeAll, expect, test } from "bun:test";
import { MAPS } from "@tokenmaxxing/core/maps.ts";
import { bossAt } from "@tokenmaxxing/core/raid.ts";

// A canvas that draws nothing: enough for the kit's painted textures to be "built" without a browser.
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

type Live = typeof import("../src/render3d/dungeon/dungeon-live.ts");
type Fx = typeof import("../src/render3d/dungeon/raidfx.ts");
type Raid = typeof import("../src/game/raid.ts");
type Store = typeof import("../src/store.ts");
let live: Live;
let fx: Fx;
let raidState: Raid;
let store: Store;
let THREE: typeof import("three");
beforeAll(async () => {
  THREE = await import("three");
  live = await import("../src/render3d/dungeon/dungeon-live.ts");
  fx = await import("../src/render3d/dungeon/raidfx.ts");
  raidState = await import("../src/game/raid.ts");
  store = await import("../src/store.ts");
  await (await import("../src/render3d/kit/registry.ts")).loadSlices();
});

const raid = (o: Record<string, unknown> = {}) =>
  ({
    prelaunch: false,
    launchAt: 0,
    week: "2026-10-19",
    closed: false,
    boss: bossAt(2),
    hp: 3e9,
    damage: 1e9,
    kills: [],
    totalDamage: 1e9,
    me: null,
    rules: { opensHour: 8 },
    ...o,
  }) as never;

const look = {
  style: 0,
  skin: 0,
  hair: 0,
  outfit: 0,
  glasses: 0,
  hat: 0,
  pet: 0,
  held: 0,
  back: 0,
  petwear: 0,
  petVariant: 0,
  merchWorn: 0,
  merch: 0,
};
const crowd = (n: number) => ({
  top: Array.from({ length: n }, (_, i) => ({
    id: i + 1,
    name: `r${i}`,
    look: { ...look, hair: i % 8, outfit: i % 12 },
    agents: 1 + (i % 6),
    burn: 1e5 * (1 + (i % 7)),
  })),
  more: 0,
});

/** Draw calls one pass over the group would make: visible meshes, and an instanced mesh is one. */
function drawCalls(root: import("three").Object3D): number {
  let n = 0;
  root.traverse((o) => {
    const m = o as import("three").Mesh;
    if (!m.isMesh) return;
    for (let p: import("three").Object3D | null = m; p; p = p.parent) if (!p.visible) return;
    n++;
  });
  return n;
}

function run(l: InstanceType<Live["DungeonLive"]>, seconds: number): void {
  for (let t = 0.016; t < seconds; t += 0.016) l.update(t);
}

test("the full dungeon with every war desk taken stays inside its draw-call budget, and Medium inside a smaller one", () => {
  store.hud.set({ raid: raid() });
  raidState.setRaiders(crowd(40));
  const full = new live.DungeonLive(MAPS.dungeon, fx.CAPS.full);
  run(full, 3);
  const calls = drawCalls(full.group);
  // Forty people at nine meshes each, the boss, the terminal, and a few instanced draws for the laptops, minions and shots.
  expect(calls).toBeLessThan(650);
  full.dispose();

  const lean = new live.DungeonLive(MAPS.dungeon, fx.CAPS.lean);
  run(lean, 3);
  const leanCalls = drawCalls(lean.group);
  expect(leanCalls).toBeLessThan(calls / 2);
  expect(leanCalls).toBeLessThan(260);
  lean.dispose();
  raidState.setRaiders(null);
});

test("raiders are seated where the game seats them, and leave when the server says they have", () => {
  store.hud.set({ raid: raid() });
  raidState.setRaiders(crowd(6));
  const l = new live.DungeonLive(MAPS.dungeon, fx.CAPS.full);
  run(l, 1);
  const names = l.signs().filter((s) => s.key.startsWith("raider:"));
  expect(names).toHaveLength(6);
  // Each name stands over its own seat tile (the south of its desk).
  for (const s of names) {
    const id = Number(s.key.split(":")[1]);
    const [tx, ty] = raidState.seatTile(id)!;
    expect(s.at[0]).toBeCloseTo(tx + 0.5);
    expect(s.at[2]).toBeCloseTo(ty + 0.5);
  }
  raidState.setRaiders(crowd(2));
  run(l, 2);
  expect(l.signs().filter((s) => s.key.startsWith("raider:"))).toHaveLength(2);
  l.dispose();
  raidState.setRaiders(null);
});

test("a kill makes the boss fall and the next rung arrive, with a plaque for the one that fell", () => {
  const first = raid({ boss: bossAt(1), hp: 2e9, damage: 1.9e9 });
  store.hud.set({ raid: first });
  raidState.setRaiders(null);
  const l = new live.DungeonLive(MAPS.dungeon, fx.CAPS.full);
  let t = 0;
  const step = (s: number) => {
    for (const end = t + s; t < end; t += 0.016) l.update(t);
  };
  step(1);
  expect(l.boss.fallen).toBe(false);
  expect(l.boss.rung).toBe(1);
  const fell = { rung: 1, boss: bossAt(1), day: "2026-10-20", coins: 10, raiders: 3, paid: true };
  store.hud.set({ raid: raid({ boss: bossAt(2), kills: [fell], hp: 3e9, damage: 1e8, totalDamage: 2.1e9 }) });
  step(0.5);
  expect(l.boss.fallen).toBe(true);
  expect(l.signs().some((s) => s.key === "plaque:0")).toBe(true);
  // After its fall the next boss drops onto the dais.
  step(3);
  expect(l.boss.fallen).toBe(false);
  expect(l.boss.rung).toBe(2);
  expect(l.boss.bossId).toBe("context-window");
  l.dispose();
});

test("when the week is over nobody fires, and before the first raid the room is dark", () => {
  store.hud.set({
    raid: raid({
      closed: true,
      kills: [{ rung: 1, boss: bossAt(1), day: "2026-10-20", coins: 10, raiders: 3, paid: true }],
    }),
  });
  raidState.setRaiders(crowd(5));
  const l = new live.DungeonLive(MAPS.dungeon, fx.CAPS.full);
  run(l, 2);
  let missiles = 0;
  l.group.traverse((o) => {
    const m = o as import("three").InstancedMesh;
    if (
      m.isInstancedMesh &&
      m.userData.nobatch &&
      m.count > 0 &&
      m.material instanceof THREE.MeshBasicMaterial &&
      (m.geometry as { parameters?: { width?: number } }).parameters?.width === 0.08
    )
      missiles++;
  });
  expect(missiles).toBe(0);
  l.dispose();
  store.hud.set({ raid: raid({ prelaunch: true, closed: true, launchAt: Date.now() + 36e5 }) });
  const lair = new live.DungeonLive(MAPS.dungeon, fx.CAPS.full);
  run(lair, 1);
  const dark = lair.group.children.find(
    (c) =>
      (c as import("three").Mesh).isMesh &&
      (c as import("three").Mesh).geometry.type === "PlaneGeometry" &&
      c.visible,
  );
  expect(dark).toBeDefined();
  expect(lair.boss.silhouette).toBe(true);
  lair.dispose();
  raidState.setRaiders(null);
});

test("server seating hides the clone, updates the prompt, and lets a pet fire while seated", async () => {
  const seatMod = await import("../src/game/raidseat.ts");
  const w = (await import("../src/game/world.ts")).world;
  store.hud.set({ raid: raid() });
  raidState.setRaiders(crowd(6));
  const me = 2;
  const seat = raidState.seatTile(me)!;
  w.room = "dungeon";
  w.selfId = me;
  const avatar = (pet: number, x: number, y: number) =>
    ({ info: { id: me, look: { ...look, pet } }, x, y, facing: "up", state: "idle" }) as never;
  // Standing adjacent to my seat, with a pet.
  w.avatars.set(me, avatar(1, seat[0], seat[1] + 1));
  const l = new live.DungeonLive(MAPS.dungeon, fx.CAPS.full);
  run(l, 1);
  const prompt = () => l.signs().find((s) => s.key === "sit")?.text;
  const petShots = () =>
    (l as unknown as { flying: { by: string }[] }).flying.filter((m) => m.by === "pet").length;
  // Standing next to my own desk the pet stays quiet, however long I wait.
  let standing = 0;
  for (let t = 1.5; t < 40; t += 0.016) {
    l.update(t);
    standing = Math.max(standing, petShots());
  }
  expect(standing).toBe(0);
  expect(prompt()).toBe("E · take your seat");
  expect(seatMod.seated()).toBe(false);
  // Someone else's seat or desk is not mine to take.
  const other = raidState.seatTile(1)!;
  expect(seatMod.sitsAt(other[0], other[1])).toBe(false);
  expect(seatMod.seated()).toBe(false);
  // Mine is, from the seat tile or the laptop.
  expect(seatMod.sitsAt(seat[0], seat[1] - 1)).toBe(true);
  Object.assign(w.avatars.get(me)!, { x: seat[0], y: seat[1], state: "sit" });
  expect(seatMod.seated()).toBe(true);
  run(l, 2);
  expect(prompt()).toBe("E · stand up");
  // My clone is not drawn while I sit in it; everyone else's still is.
  const clone = (id: number) =>
    (l as unknown as { seated: Map<number, { avatar: { root: { visible: boolean } } | null }> }).seated.get(
      id,
    )?.avatar;
  expect(clone(me)?.root.visible).toBe(false);
  expect(clone(1)?.root.visible).toBe(true);
  let fired = 0;
  for (let t = 50; t < 110; t += 0.016) {
    l.update(t);
    fired = Math.max(fired, petShots());
  }
  expect(fired).toBeGreaterThan(0);
  Object.assign(w.avatars.get(me)!, { state: "idle" });
  expect(seatMod.seated()).toBe(false);
  // Stood up again, it stops: nothing new comes out after the ones in the air have landed.
  (l as unknown as { flying: unknown[] }).flying.length = 0;
  let after = 0;
  for (let t = 110; t < 150; t += 0.016) {
    l.update(t);
    after = Math.max(after, petShots());
  }
  expect(after).toBe(0);
  // Without a pet it fires nothing, even seated.
  w.avatars.set(me, avatar(0, seat[0], seat[1]));
  Object.assign(w.avatars.get(me)!, { state: "sit" });
  (l as unknown as { flying: unknown[] }).flying.length = 0;
  let none = 0;
  for (let t = 150; t < 190; t += 0.016) {
    l.update(t);
    none = Math.max(none, petShots());
  }
  expect(none).toBe(0);
  Object.assign(w.avatars.get(me)!, { state: "idle" });
  // Not a raider: no seat, nothing offered.
  raidState.setRaiders({ top: crowd(6).top.filter((r) => r.id !== me), more: 0 });
  run(l, 2);
  expect(seatMod.sitsAt(seat[0], seat[1])).toBe(false);
  expect(prompt()).toBeUndefined();
  l.dispose();
  raidState.setRaiders(null);
  w.avatars.clear();
  w.room = "town";
  w.selfId = 0;
});
