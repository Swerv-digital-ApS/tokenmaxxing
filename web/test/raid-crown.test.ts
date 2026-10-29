import { expect, test } from "bun:test";
import { lootById } from "@tokenmaxxing/core/loot.ts";
import { LOOT_HATS as pixelHats } from "../src/art/loot.ts";
import { LOOT_HATS as displayHats, LOOT_TABLE } from "../src/render3d/data/dungeon.ts";
import { Model } from "../src/render3d/kit/kit.ts";
import { HAT_BUILDERS } from "../src/render3d/people/gear3dHead.ts";
import { vpart } from "../src/render3d/people/voxgear.ts";
import { CLOTHES } from "../src/render3d/shops/data/clothes.ts";

test("the Hallucination legendary keeps its owned item ID and agrees across displays", () => {
  const crown = lootById("hat.31")!;
  expect(crown).toMatchObject({
    id: "hat.31",
    index: 31,
    name: "Mirage Crown",
    boss: "hallucination",
    rarity: "legendary",
  });
  expect(LOOT_TABLE.find((item) => item.id === crown.id)).toMatchObject(crown);
  expect(CLOTHES.find((item) => item.id === crown.id)).toMatchObject({
    name: crown.name,
    boss: crown.boss,
    rarity: crown.rarity,
  });
  const two = pixelHats[3]!;
  expect(displayHats[3]).toEqual(two);
  for (const rows of Object.values(two.rows)) {
    expect(rows).toHaveLength(5);
    for (const row of rows) {
      expect(row).toHaveLength(16);
      for (const ch of row.replaceAll(".", "")) expect(two.pal[ch]).toBeDefined();
    }
  }
});

test("the crown fits smooth and voxel heads and its golden sparks orbit", () => {
  for (const voxel of [false, true]) {
    const root = voxel ? vpart(new Model()) : new Model();
    const ticks: ((t: number) => void)[] = [];
    HAT_BUILDERS["Mirage Crown"]!(root, {
      skin: "#f0c49c",
      hair: "#754b34",
      outfit: ["#fff", "#ddd"],
      pants: "#333",
      tick: (fn) => ticks.push(fn),
    });
    const orbit = root.getObjectByName("mirage-orbit")!;
    const crest = root.getObjectByName("mirage-crest")!;
    expect(orbit.children).toHaveLength(4);
    expect(crest.children.length).toBeGreaterThan(0);
    expect(ticks).toHaveLength(1);
    const start = orbit.position.y;
    ticks[0]!(1);
    expect(orbit.rotation.y).not.toBe(0);
    expect(orbit.position.y).not.toBe(start);
    expect(crest.scale.x).not.toBe(1);
  }
});
