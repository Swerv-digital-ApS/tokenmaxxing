import { expect, test } from "bun:test";
import { pinnedDay, seasonLook } from "@tokenmaxxing/core/seasons.ts";
import * as THREE from "three";
import { installHeadlessGlobals } from "../src/render3d/perf/stubs.ts";

installHeadlessGlobals();

const { seasonalTree, tree } = await import("../src/render3d/town/props.ts");
const { FallingLeaves } = await import("../src/render3d/town/leaves3d.ts");

const look = (pin: string) => seasonLook(pinnedDay(pin)!);
/** Each mesh's shape and colour, in order. */
const parts = (m: THREE.Object3D) => {
  const out: string[] = [];
  m.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (mesh.isMesh)
      out.push(`${mesh.geometry.type}:${(mesh.material as THREE.MeshToonMaterial).color.getHexString()}`);
  });
  return out;
};
const balls = (m: THREE.Object3D) => parts(m).filter((p) => p.startsWith("SphereGeometry")).length;

test("in high summer a seasonal tree is the plain one", () => {
  for (const seed of [1, 2, 3]) {
    expect(parts(seasonalTree("round", seed, 1, look("summer")))).toEqual(parts(tree("round", seed, 1)));
    expect(parts(seasonalTree("oak", seed, 1.2, look("summer")))).toEqual(parts(tree("oak", seed, 1.2)));
  }
});

test("broadleaves go bare in winter and pines stay green", () => {
  const bare = seasonalTree("round", 4, 1, look("winter"));
  expect(balls(bare)).toBe(0);
  expect(parts(bare).length).toBeGreaterThan(4);
  expect(parts(seasonalTree("pine", 4, 1, look("winter")))).toEqual(parts(tree("pine", 4, 1)));
});

test("leaves turn and thin a lobe at a time through the autumn", () => {
  const full = balls(tree("oak", 9, 1));
  const counts = ["09-25", "10-20", "11-05", "11-20", "12-01"].map((d) =>
    balls(seasonalTree("oak", 9, 1, look(d))),
  );
  for (let i = 1; i < counts.length; i++) expect(counts[i]!).toBeLessThanOrEqual(counts[i - 1]!);
  expect(counts[0]).toBe(full);
  expect(counts.at(-1)).toBe(0);
  // Late October: most of what's left has turned.
  const green = new Set(parts(tree("round", 5, 1)));
  const now = parts(seasonalTree("round", 5, 1, look("autumn"))).filter((p) => p.startsWith("Sphere"));
  expect(now.filter((p) => !green.has(p)).length).toBeGreaterThan(now.length / 2);
});

test("cherries blossom in spring; the others don't", () => {
  const pink = parts(tree("pink", 1, 1)).filter((p) => p.startsWith("Sphere"));
  const cherry = parts(seasonalTree("cherry", 6, 1, look("spring")));
  expect(cherry.some((p) => pink.includes(p))).toBe(true);
  expect(parts(seasonalTree("round", 6, 1, look("spring"))).some((p) => pink.includes(p))).toBe(false);
});

test("falling leaves: only in the season, near you, and never more than the cap", () => {
  const crowns = Array.from({ length: 40 }, (_, i) => [i % 8, 1.4, Math.floor(i / 8)] as const);
  const leaves = new FallingLeaves(crowns);
  const mesh = leaves.group.children[0] as THREE.InstancedMesh;
  const calm = new THREE.Vector2();
  for (let f = 0; f < 600; f++) leaves.update(1 / 60, f / 60, 1, 1, calm, 4, 2);
  expect(mesh.count).toBeGreaterThan(50);
  expect(mesh.count).toBeLessThanOrEqual(mesh.instanceMatrix.count);
  // Far from every tree, none fall; and out of season the ones down are let lie and go.
  for (let f = 0; f < 600; f++) leaves.update(1 / 60, 10 + f / 60, 0, 1, calm, 4, 2);
  expect(mesh.count).toBe(0);
  expect(mesh.visible).toBe(false);
  for (let f = 0; f < 600; f++) leaves.update(1 / 60, 20 + f / 60, 1, 1, calm, 400, 400);
  expect(mesh.count).toBe(0);
});
