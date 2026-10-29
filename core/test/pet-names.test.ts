import { describe, expect, test } from "bun:test";
import { cleanPetName, PET_NAME_MAX, PET_NAMED, PET_VARIANTS, petOutfit } from "../src/pets.ts";
import { parseLook } from "../src/world.ts";

const dog = (id: string) => ({ pet: 3, petVariant: PET_VARIANTS[3]!.indexOf(id) + 1 });
const base = { style: 1, skin: 2, hair: 3, outfit: 4, glasses: 0, hat: 0 };

describe("pet names", () => {
  test("cleaned: trimmed, spaces collapsed, plain characters only, bounded", () => {
    expect(cleanPetName("  Penny ")).toBe("Penny");
    expect(cleanPetName("Sir   Barks-a-Lot")).toBe("Sir Barks-a-Lot");
    expect(cleanPetName("D'Artagnan")).toBe("D'Artagnan");
    expect(cleanPetName("Åse 2")).toBe("Åse 2");
    expect(cleanPetName("x".repeat(PET_NAME_MAX))).not.toBeNull();
    for (const bad of ["", "   ", "x".repeat(PET_NAME_MAX + 1), "<b>", "a\nb", "😀", "-dash", 7, null])
      expect(cleanPetName(bad)).toBeNull();
  });

  test("saved with the look; old looks have none; a bad one refuses the look", () => {
    const old = { ...base, pet: 3 };
    expect(parseLook(old)?.petName).toBeUndefined();
    expect(parseLook({ ...old, petName: "" })?.petName).toBeUndefined();
    expect(parseLook({ ...old, petName: "  Penny  " })?.petName).toBe("Penny");
    expect(parseLook({ ...old, petName: "<script>" })).toBeNull();
    expect(parseLook({ ...old, petName: 5 })).toBeNull();
  });

  test("named outfits match the name case-insensitively, trimmed, on the right pet and look", () => {
    const penny = { ...dog("greyhound"), petName: "Penny" };
    expect(petOutfit(penny)).toBe("penny-sweater");
    expect(petOutfit({ ...penny, petName: "  pEnNy " })).toBe("penny-sweater");
    expect(petOutfit({ ...dog("pug"), petName: "Nemo" })).toBe("nemo-wookiee");
    // Wrong look, wrong pet, wrong name, no name: no costume.
    expect(petOutfit({ ...dog("pug"), petName: "Penny" })).toBeNull();
    expect(petOutfit({ ...dog("greyhound"), petName: "Nemo" })).toBeNull();
    expect(petOutfit({ pet: 3, petVariant: 0, petName: "Penny" })).toBeNull();
    expect(petOutfit({ pet: 2, petVariant: 1, petName: "Penny" })).toBeNull();
    expect(petOutfit({ ...dog("greyhound") })).toBeNull();
    expect(petOutfit({ ...penny, petName: "Penny 2" })).toBeNull();
    // Renaming it away takes the costume off.
    expect(petOutfit({ ...penny, petName: "Rex" })).toBeNull();
  });

  test("every named outfit is for a real look, once", () => {
    for (const n of PET_NAMED) expect(PET_VARIANTS[n.pet]).toContain(n.variant);
    const keys = PET_NAMED.map((n) => `${n.name.toLowerCase()}:${n.pet}:${n.variant}`);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
