import { expect, test } from "bun:test";
import { casePieceOf } from "@tokenmaxxing/core/case-furniture.ts";
import { NUSANTARA_BASE, NUSANTARA_ITEMS } from "@tokenmaxxing/core/case-nusantara.ts";
import { NUSANTARA_PIECES } from "@tokenmaxxing/core/case-nusantara-furniture.ts";
import * as THREE from "three";
import { CASE_PET_SPECIES, NUSANTARA_PET_SPECIES, PET_NAME, speciesAt } from "../src/render3d/data/pets.ts";
import { installHeadlessGlobals } from "../src/render3d/perf/stubs.ts";

installHeadlessGlobals();

const meshes = (o: THREE.Object3D) => {
  let n = 0;
  o.traverse((c) => {
    if ((c as THREE.Mesh).isMesh) n++;
  });
  return n;
};

test("a pet index is the Night Market's from 300, the Nusantara's from 400, and nothing past a case's six", () => {
  expect(CASE_PET_SPECIES.map((_, i) => speciesAt(300 + i))).toEqual([...CASE_PET_SPECIES]);
  expect(NUSANTARA_PET_SPECIES.map((_, i) => speciesAt(NUSANTARA_BASE + i))).toEqual([
    ...NUSANTARA_PET_SPECIES,
  ]);
  expect(speciesAt(NUSANTARA_BASE + 6)).toBeUndefined();
  expect(speciesAt(306)).toBeUndefined();
  expect(speciesAt(1)).toBe("duck");
  for (const s of NUSANTARA_PET_SPECIES) expect(PET_NAME[s]).toBeTruthy();
});

test("every Nusantara cosmetic has its 3D builder, under its name or its look index", async () => {
  const { HAT_BUILDERS, FACE_BUILDERS, HELD_BUILDERS, BACK_BUILDERS, OUTFIT_BUILDERS, outfitColours } =
    await import("../src/render3d/people/gear3d.ts");
  const { AURA_BUILDERS } = await import("../src/render3d/people/gear3dAura.ts");
  for (const item of NUSANTARA_ITEMS) {
    const where = `${item.slot}: ${item.name}`;
    if (item.slot === "hat") expect(HAT_BUILDERS[item.name], where).toBeTypeOf("function");
    if (item.slot === "glasses") expect(FACE_BUILDERS[item.name], where).toBeTypeOf("function");
    if (item.slot === "held") expect(HELD_BUILDERS[item.name], where).toBeTypeOf("function");
    if (item.slot === "back") expect(BACK_BUILDERS[item.name], where).toBeTypeOf("function");
    if (item.slot === "aura") expect(AURA_BUILDERS[item.name], where).toBeTypeOf("function");
    if (item.slot === "outfit") {
      expect(OUTFIT_BUILDERS[item.index], where).toBeTypeOf("function");
      // Not the shop's default colours: the outfit has its own.
      expect(outfitColours(item.index).outfit[0]).not.toBe(outfitColours(0).outfit[0]);
    }
  }
});

test("a character wearing each Nusantara cosmetic is dressed in more than a bare one, and its animation runs", async () => {
  const { avatarFor } = await import("../src/render3d/people/gear3d.ts");
  const bare = { style: 0, skin: 1, hair: 2, outfit: 1 };
  const base = meshes(avatarFor(bare).root);
  for (const item of NUSANTARA_ITEMS) {
    if (item.slot === "pet") continue;
    const look = { ...bare, [item.slot]: item.index };
    const a = avatarFor(look);
    expect(meshes(a.root), `${item.slot}: ${item.name}`).toBeGreaterThan(base);
    for (const t of [0, 0.7, 1.9]) a.update(1 / 30, t);
    a.pose = "walk";
    a.update(1 / 30, 2.5);
    a.dispose();
  }
});

test("each Nusantara pet stands up, walks and is named", async () => {
  const { petFrom2D } = await import("../src/render3d/pets/pets3d.ts");
  const { view } = await import("../src/render3d/perf/freeze.ts");
  view.sees = () => true;
  NUSANTARA_PET_SPECIES.forEach((species, i) => {
    const pet = petFrom2D(NUSANTARA_BASE + i);
    expect(pet.species).toBe(species);
    expect(pet.label).toBe(PET_NAME[species]);
    expect(meshes(pet.root)).toBeGreaterThan(3);
    pet.update(1);
    pet.moving = true;
    for (let t = 1; t < 2; t += 0.1) pet.update(t, 0.05);
    pet.moving = false;
    pet.pose = "sleep";
    for (let t = 2; t < 3; t += 0.1) pet.update(t);
    pet.dispose();
  });
});

test("each Nusantara piece has a model that fits its footprint, and the wall piece hangs", async () => {
  const { extraAssetById, WALL_ASSET_IDS } = await import("../src/render3d/furniture/furniture3d.ts");
  for (const p of NUSANTARA_PIECES) {
    const asset = extraAssetById.get(p.art);
    expect(asset, p.name).toBeTruthy();
    expect(asset!.name).toBe(p.name);
    expect(asset!.w).toBe(p.w ?? 1);
    expect(WALL_ASSET_IDS.has(p.art), `${p.name} hangs`).toBe(!!p.wall);
    expect(casePieceOf(p.ch)?.art).toBe(p.art);
    const model = asset!.build();
    const box = new THREE.Box3().setFromObject(model);
    expect(box.max.x - box.min.x, `${p.name}: width`).toBeLessThanOrEqual((p.w ?? 1) + 0.35);
    expect(box.max.z - box.min.z, `${p.name}: depth`).toBeLessThanOrEqual(1.2);
    expect(meshes(model), p.name).toBeGreaterThan(5);
  }
});

test("each case draws its own box and key, the Night Market's unchanged", async () => {
  const { buildCaseBox, buildCaseKey } = await import("../src/render3d/case-box3d.ts");
  for (const open of [false, true]) {
    const night = buildCaseBox(open);
    expect(meshes(buildCaseBox(open, "night-market"))).toBe(meshes(night));
    expect(meshes(buildCaseBox(open, "nusantara"))).not.toBe(meshes(night));
  }
  expect(meshes(buildCaseKey("nusantara"))).not.toBe(meshes(buildCaseKey()));
});
