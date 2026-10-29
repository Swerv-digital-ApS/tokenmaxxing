import { expect, test } from "bun:test";
import { LOOT } from "@tokenmaxxing/core/loot.ts";
import { PET_VARIANTS } from "@tokenmaxxing/core/pets.ts";
import { itemById } from "@tokenmaxxing/core/shop.ts";
import { parseLook } from "@tokenmaxxing/core/world.ts";
import { FACE_ROWS } from "../src/render3d/shops/data/barber.ts";
import { CLOTHES } from "../src/render3d/shops/data/clothes.ts";
import { FURNITURE_SHOP_ROWS } from "../src/render3d/shops/data/furniture.ts";
import { CATALOG_PETS, SHOP_PETWEAR, SHOP_VARIANTS } from "../src/render3d/shops/data/pets.ts";
import {
  equipOf,
  failOf,
  lookWith,
  petVariantOf,
  purchaseOf,
  realMerchId,
  wornIn,
} from "../src/render3d/shops/purchase.ts";

const LOOK = {
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
  merch: 0,
  merchWorn: 0,
};

test("every shelf id maps onto a core item, decor or desk", () => {
  const ids = [
    ...CLOTHES.map((r) => r.id),
    ...FACE_ROWS.map((r) => r.id),
    ...CATALOG_PETS.map((p) => p.id),
    ...SHOP_PETWEAR.map((p) => p.id),
    ...FURNITURE_SHOP_ROWS.map((r) => r.id),
  ];
  for (const id of ids) expect(purchaseOf(id).kind, id).not.toBe("unknown");
  // And what the server sells is sold at the shelf's price.
  for (const r of [...CLOTHES, ...FACE_ROWS, ...CATALOG_PETS, ...SHOP_PETWEAR]) {
    const i = itemById(r.id)!;
    expect(i.price, r.id).toBe(r.price);
    expect(i.level, r.id).toBe((r as { level?: number }).level);
  }
  for (const r of FURNITURE_SHOP_ROWS.filter((x) => x.id.startsWith("furn.")))
    expect(itemById(r.id)?.price, r.id).toBe(r.price);
});

test("every pet variation on the shelf is one core knows", () => {
  for (const p of CATALOG_PETS.filter((x) => x.species in SHOP_VARIANTS)) {
    expect(PET_VARIANTS[p.index], p.species).toEqual(SHOP_VARIANTS[p.species as keyof typeof SHOP_VARIANTS]);
    for (const [i, v] of (PET_VARIANTS[p.index] ?? []).entries()) {
      const id = `${p.id}.${v}`;
      expect(petVariantOf(id)).toEqual({ pet: p.index, variant: i + 1 });
      expect(purchaseOf(id)).toEqual({ kind: "variant", pet: p.index, variant: i + 1 });
    }
  }
  expect(petVariantOf("pet.2.nope")).toBeNull();
});

test("a purchase is the call the Shop page makes", () => {
  expect(purchaseOf("pet.2")).toEqual({ kind: "item", id: "pet.2" });
  expect(purchaseOf("petwear.3")).toEqual({ kind: "item", id: "petwear.3" });
  expect(purchaseOf("outfit.9")).toEqual({ kind: "item", id: "outfit.9" });
  expect(purchaseOf("glasses.2")).toEqual({ kind: "item", id: "glasses.2" });
  expect(purchaseOf("furn.p")).toEqual({ kind: "item", id: "furn.p" });
  expect(purchaseOf("furn.ε")).toEqual({ kind: "piece", id: "furn.ε" });
  expect(purchaseOf("furn.7")).toEqual({ kind: "piece", id: "furn.7" });
  expect(purchaseOf("decor.wall.hygge")).toEqual({ kind: "decor", decor: "wall", id: "hygge" });
  expect(purchaseOf("decor.floor.checker")).toEqual({ kind: "decor", decor: "floor", id: "checker" });
  expect(purchaseOf("desk.triple")).toEqual({ kind: "desk", id: "triple" });
  expect(purchaseOf("desk.ultrawide")).toEqual({ kind: "desk", id: "ultrawide" });
});

test("what is free, earned or looted is never bought", () => {
  for (const id of ["style.1", "skin.3", "hair.5", "decor.wall.plain", "decor.floor.boards", "desk.laptop"])
    expect(purchaseOf(id).kind, id).toBe("free");
  expect(purchaseOf("decor.wall.tivoli")).toEqual({ kind: "unsold", why: "level" });
  expect(purchaseOf("hat.4")).toEqual({ kind: "unsold", why: "level" });
  expect(purchaseOf("pet.6")).toEqual({ kind: "unsold", why: "level" });
  expect(purchaseOf("furn.g")).toEqual({ kind: "unsold", why: "earned" });
  expect(purchaseOf(LOOT[0]!.id)).toEqual({ kind: "unsold", why: "loot" });
  expect(purchaseOf("nothing.1").kind).toBe("unknown");
});

test("merch is a real company's, or nothing", () => {
  expect(realMerchId("merch.7.cap")).toBe("merch.7.cap");
  expect(realMerchId("merch.acmecorp.tee")).toBeNull();
  expect(realMerchId("merch.7.sock")).toBeNull();
  expect(purchaseOf("merch.7.mug")).toEqual({ kind: "merch", id: "merch.7.mug", companyId: 7 });
  expect(purchaseOf("merch.globex.mug").kind).toBe("unknown");
});

test("wearing maps onto a look the server accepts", () => {
  const on = (id: string) => lookWith(LOOK, equipOf(id));
  expect(on("outfit.9").outfit).toBe(9);
  expect(on("style.2").style).toBe(2);
  expect(on("petwear.3").petwear).toBe(3);
  const cat = on("pet.2.tuxedo");
  expect([cat.pet, cat.petVariant]).toEqual([2, 2]);
  expect(on("pet.4").petVariant).toBe(0);
  expect(lookWith(on("petwear.3"), equipOf("petwear.3"), false).petwear).toBe(0);
  const merch = lookWith(LOOK, equipOf("merch.7.hoodie"));
  expect([merch.merch, merch.merchWorn]).toEqual([7, 2]);
  expect(parseLook(on("pet.2.tuxedo"))).not.toBeNull();
  expect(wornIn(on("outfit.9"), "outfit.9")).toBe(true);
  expect(wornIn(LOOK, "outfit.9")).toBe(false);
  expect(wornIn(cat, "pet.2.tuxedo")).toBe(true);
  expect(equipOf("desk.dual")).toEqual({ kind: "desk", id: "dual" });
  expect(equipOf("decor.floor.checker")).toEqual({ kind: "decor", decor: "floor", id: "checker" });
  expect(equipOf("furn.p")).toEqual({ kind: "place", id: "furn.p" });
});

test("a refusal says why", () => {
  expect(failOf({ code: "too_poor", message: "Rejected: Not enough coins yet." })).toEqual({
    ok: false,
    reason: "coins",
    message: "Not enough coins yet.",
  });
  expect(failOf({ code: "owned", message: "You have that already." }).reason).toBe("owned");
  expect(failOf({ code: "not_member", message: "Join a company first." }).reason).toBe("company");
  expect(failOf({ code: "not_owned", message: "Buy that one first." }).reason).toBe("unowned");
  expect(failOf({ code: "rate_limited", message: "x" }).reason).toBe("slow");
  expect(failOf(new Error("boom"))).toMatchObject({ reason: "other" });
  expect(failOf(null).message).toBe("Something went wrong.");
});
