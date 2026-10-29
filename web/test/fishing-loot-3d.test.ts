import { expect, test } from "bun:test";
import { FISHING_BASE, FISHING_ITEMS } from "@tokenmaxxing/core/fishing-loot.ts";
import type * as THREE from "three";
import { PET_NAME, POND_PET_SPECIES, speciesAt } from "../src/render3d/data/pets.ts";
import { installHeadlessGlobals } from "../src/render3d/perf/stubs.ts";

installHeadlessGlobals();

const meshes = (o: THREE.Object3D) => {
  let n = 0;
  o.traverse((c) => {
    if ((c as THREE.Mesh).isMesh) n++;
  });
  return n;
};

test("a pet index is the pond's from 600, two of them, named, and no other range is disturbed", () => {
  expect(POND_PET_SPECIES.map((_, i) => speciesAt(FISHING_BASE + i))).toEqual([...POND_PET_SPECIES]);
  expect(speciesAt(FISHING_BASE + POND_PET_SPECIES.length)).toBeUndefined();
  expect(speciesAt(500)).toBe("huginn");
  expect(speciesAt(300)).toBe("koi");
  for (const s of POND_PET_SPECIES) expect(PET_NAME[s]).toBeTruthy();
  // The catalogue's pets are the ones the 3D draws, in order.
  const pets = FISHING_ITEMS.filter((i) => i.slot === "pet");
  expect(pets.map((p) => PET_NAME[speciesAt(p.index)!])).toEqual(pets.map((p) => p.name));
});

test("every pond treasure has its 3D builder, under its name", async () => {
  const { HAT_BUILDERS, FACE_BUILDERS, HELD_BUILDERS, BACK_BUILDERS } =
    await import("../src/render3d/people/gear3d.ts");
  const { AURA_BUILDERS } = await import("../src/render3d/people/gear3dAura.ts");
  const { COVERS_HAIR } = await import("../src/render3d/people/gear3dHead.ts");
  for (const item of FISHING_ITEMS) {
    const where = `${item.slot}: ${item.name}`;
    if (item.slot === "hat") {
      expect(HAT_BUILDERS[item.name], where).toBeTypeOf("function");
      expect(COVERS_HAIR.has(item.name), `${where} covers the hair`).toBe(true);
    }
    if (item.slot === "glasses") expect(FACE_BUILDERS[item.name], where).toBeTypeOf("function");
    if (item.slot === "held") expect(HELD_BUILDERS[item.name], where).toBeTypeOf("function");
    if (item.slot === "back") expect(BACK_BUILDERS[item.name], where).toBeTypeOf("function");
    if (item.slot === "aura") expect(AURA_BUILDERS[item.name], where).toBeTypeOf("function");
    if (item.slot === "pet") expect(speciesAt(item.index), where).toBeDefined();
  }
});

test("a character wearing each pond treasure, blocky or smooth, is dressed in more than a bare one, and its animation runs", async () => {
  const { avatarFor } = await import("../src/render3d/people/gear3d.ts");
  const bare = { style: 0, skin: 1, hair: 2, outfit: 1 };
  for (const style of ["voxel", "grown"] as const) {
    const base = meshes(avatarFor(bare, undefined, style).root);
    for (const item of FISHING_ITEMS) {
      // The pack's builder draws on the blocky torso only (`BACK_BUILDERS` are not called on the others).
      if (item.slot === "pet" || (item.slot === "back" && style !== "voxel")) continue;
      const look = { ...bare, [item.slot]: item.index };
      const a = avatarFor(look, undefined, style);
      expect(meshes(a.root), `${style} ${item.slot}: ${item.name}`).toBeGreaterThan(base);
      for (const t of [0, 0.7, 1.9, 3.1]) a.update(1 / 30, t);
      a.pose = "walk";
      a.update(1 / 30, 4.5);
      a.dispose();
    }
  }
});

test("each pond pet stands up, walks, sleeps and is named, and its parts move", async () => {
  const { petFrom2D } = await import("../src/render3d/pets/pets3d.ts");
  const { view } = await import("../src/render3d/perf/freeze.ts");
  view.sees = () => true;
  POND_PET_SPECIES.forEach((species, i) => {
    const pet = petFrom2D(FISHING_BASE + i);
    expect(pet.species).toBe(species);
    expect(pet.label).toBe(PET_NAME[species]);
    expect(meshes(pet.root)).toBeGreaterThan(5);
    // Something moves on its own when it stands: the pose differs a second on.
    const before: string[] = [];
    pet.update(1);
    pet.root.traverse((c) => before.push(c.rotation.toArray().join()));
    pet.update(1.6);
    const after: string[] = [];
    pet.root.traverse((c) => after.push(c.rotation.toArray().join()));
    expect(after).not.toEqual(before);
    pet.moving = true;
    for (let t = 1.6; t < 3; t += 0.1) pet.update(t, 0.05);
    pet.moving = false;
    pet.pose = "sleep";
    for (let t = 3; t < 4; t += 0.1) pet.update(t);
    pet.dispose();
  });
});
