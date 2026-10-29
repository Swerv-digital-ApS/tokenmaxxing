import { expect, test } from "bun:test";
import { FISH } from "@tokenmaxxing/core/fishing.ts";
import * as THREE from "three";
import { buildFish, sculpted } from "../src/render3d/town/fish3d.ts";

test("every fish in the pond has a sculpture, and nothing else does", () => {
  expect(sculpted().sort()).toEqual(FISH.map((f) => f.id).sort());
});

test("each catch builds solid, roughly centred, a fish-sized model; the fish have tails that swing", () => {
  const odd = new Set(["duck", "bug", "boot", "spaghetti", "kraken", "notfound", "eel"]);
  for (const f of FISH) {
    const rig = buildFish(f.id);
    const box = new THREE.Box3().setFromObject(rig.root);
    const size = box.getSize(new THREE.Vector3());
    const mid = box.getCenter(new THREE.Vector3());
    expect(size.x, `${f.id} length`).toBeGreaterThan(0.2);
    expect(Math.max(size.x, size.y, size.z), `${f.id} size`).toBeLessThan(1.3);
    // Real volume, not a flat cut-out.
    expect(size.z, `${f.id} depth`).toBeGreaterThan(0.06);
    expect(Math.abs(mid.y), `${f.id} centred`).toBeLessThan(0.15);
    expect(rig.tail !== null, `${f.id} tail`).toBe(!odd.has(f.id));
  }
});
