import { describe, expect, test } from "bun:test";
import { ALL_CASE_ITEMS, CASE_BASE, CASE_ITEMS, caseAt } from "../src/case.ts";
import { ALL_CASE_PIECES, CASE_PIECES, casePieceOf } from "../src/case-furniture.ts";
import { NUSANTARA_ITEMS } from "../src/case-nusantara.ts";
import { RAGNAROK_BASE, RAGNAROK_ITEMS } from "../src/case-ragnarok.ts";
import { RAGNAROK_PIECES } from "../src/case-ragnarok-furniture.ts";
import { CASES, caseById, caseOfItem } from "../src/cases.ts";
import { EDITIONS } from "../src/editions.ts";
import { FISHING_ITEMS } from "../src/fishing-loot.ts";
import { HEADWEAR_ITEMS } from "../src/headwear.ts";
import { HOME_PIECES } from "../src/home.ts";
import { LOOT, TROPHIES } from "../src/loot.ts";
import { LEGEND, MAPS } from "../src/maps.ts";
import { COMPANY_FURNITURE, FURNITURE, pieceOf } from "../src/office.ts";
import { POSTERS } from "../src/posters.ts";
import { RARITIES } from "../src/rarity.ts";
import { canDropIn, ITEMS, isTradeable, itemById } from "../src/shop.ts";
import { WARDROBE } from "../src/wardrobe.ts";
import { defaultLook, parseLook } from "../src/world.ts";

const eve = caseById("ragnarok-eve")!;
const night = caseById("night-market")!;

describe("Ragnarok Eve wearables", () => {
  test("the pool is 30 wearables: 11 common, 6 uncommon, 5 rare, 4 epic, 4 legendary auras", () => {
    const by = (r: string) => RAGNAROK_ITEMS.filter((i) => i.rarity === r);
    expect(RARITIES.map((r) => by(r).length)).toEqual([11, 6, 5, 4, 4]);
    expect(by("legendary").every((i) => i.slot === "aura")).toBe(true);
    expect(RAGNAROK_ITEMS).toHaveLength(30);
  });

  test("each is new, free, tradeable, a case item, in its own 500 range and in the catalogue", () => {
    const others = [
      ...ITEMS.filter((i) => !i.case),
      ...EDITIONS,
      ...HEADWEAR_ITEMS,
      ...WARDROBE,
      ...LOOT,
      ...CASE_ITEMS,
    ];
    const names = new Set(others.map((i) => i.name.toLowerCase()));
    const ids = new Set(others.map((i) => i.id));
    expect(new Set(RAGNAROK_ITEMS.map((c) => c.id)).size).toBe(RAGNAROK_ITEMS.length);
    expect(new Set(RAGNAROK_ITEMS.map((c) => c.name.toLowerCase())).size).toBe(RAGNAROK_ITEMS.length);
    for (const c of RAGNAROK_ITEMS) {
      expect(names.has(c.name.toLowerCase())).toBe(false);
      expect(ids.has(c.id)).toBe(false);
      expect(c.id).toBe(`${c.slot}.${c.index}`);
      expect(c.index).toBeGreaterThanOrEqual(RAGNAROK_BASE);
      expect(c.index).toBeLessThan(RAGNAROK_BASE + 100);
      expect(c).toMatchObject({ price: 0, tradeable: true, case: true });
      expect(c.blurb.length).toBeGreaterThan(0);
      expect(itemById(c.id)).toBe(c);
    }
  });

  test("a slot's indices run 500, 501, ... with no gaps, and never meet Night Market's range", () => {
    const slots = new Set(RAGNAROK_ITEMS.map((c) => c.slot));
    for (const slot of slots) {
      const at = RAGNAROK_ITEMS.filter((c) => c.slot === slot)
        .map((c) => c.index)
        .sort((a, b) => a - b);
      expect(at).toEqual(at.map((_, n) => RAGNAROK_BASE + n));
    }
    expect(RAGNAROK_BASE).toBeGreaterThan(CASE_BASE + 99);
    expect(ALL_CASE_ITEMS).toHaveLength(
      CASE_ITEMS.length + NUSANTARA_ITEMS.length + RAGNAROK_ITEMS.length + FISHING_ITEMS.length,
    );
    const keys = ALL_CASE_ITEMS.map((c) => `${c.slot}.${c.index}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  test("caseAt resolves both cases, and nothing in between", () => {
    for (const c of RAGNAROK_ITEMS) expect(caseAt(c.slot, c.index)).toBe(c);
    expect(caseAt(CASE_ITEMS[0]!.slot, CASE_ITEMS[0]!.index)).toBe(CASE_ITEMS[0]!);
    expect(caseAt("aura", 499)).toBeUndefined();
    expect(caseAt("aura", 550)).toBeUndefined();
    expect(caseAt("hat", 1)).toBeUndefined();
  });

  test("the four auras are 500 to 503, and a look can wear every Ragnarok slot", () => {
    const auras = RAGNAROK_ITEMS.filter((c) => c.slot === "aura");
    expect(auras.map((a) => [a.name, a.index, a.rarity])).toEqual([
      ["Bifröst", 500, "legendary"],
      ["Valkyrie Lights", 501, "legendary"],
      ["Rune Gale", 502, "legendary"],
      ["Ginnungagap", 503, "legendary"],
    ]);
    const look = defaultLook(1);
    for (const a of auras) expect(parseLook({ ...look, aura: a.index })?.aura).toBe(a.index);
    expect(parseLook({ ...look, aura: 504 })).toBeNull();
    for (const c of RAGNAROK_ITEMS.filter((i) => i.slot !== "aura")) {
      const worn = parseLook({ ...look, [c.slot]: c.index });
      expect(worn?.[c.slot as "hat"]).toBe(c.index);
    }
    expect(parseLook({ ...look, hat: 504 })).toBeNull();
    expect(parseLook({ ...look, pet: 506 })).toBeNull();
  });
});

describe("Ragnarok Eve furniture", () => {
  const others = [
    ...FURNITURE,
    ...COMPANY_FURNITURE,
    ...POSTERS,
    ...TROPHIES,
    ...HOME_PIECES,
    ...CASE_PIECES,
  ];

  test("six pieces on З Ы Ч Н Т Х that nothing else uses", () => {
    expect(RAGNAROK_PIECES.map((p) => p.ch).join("")).toBe("ЗЫЧНТХ");
    const taken = new Set(others.map((p) => p.ch));
    for (const m of Object.values(MAPS)) for (const row of m.rows) for (const c of row) taken.add(c);
    for (const ch of Object.keys(LEGEND)) if (!ALL_CASE_PIECES.some((p) => p.ch === ch)) taken.add(ch);
    for (const p of RAGNAROK_PIECES) {
      expect([...p.ch]).toHaveLength(1);
      expect(taken.has(p.ch)).toBe(false);
      expect(pieceOf(p.ch)).toBe(p);
      expect(casePieceOf(p.ch)).toBe(p);
    }
    expect(new Set(ALL_CASE_PIECES.map((p) => p.ch)).size).toBe(ALL_CASE_PIECES.length);
  });

  test("names and art ids are unique across every case's pieces, and match no other catalog", () => {
    const names = new Set(others.map((p) => p.name.toLowerCase()));
    expect(new Set(RAGNAROK_PIECES.map((p) => p.name.toLowerCase())).size).toBe(RAGNAROK_PIECES.length);
    const arts = [...CASE_PIECES, ...RAGNAROK_PIECES].map((p) => p.art);
    expect(new Set(arts).size).toBe(arts.length);
    for (const p of RAGNAROK_PIECES) {
      expect(names.has(p.name.toLowerCase())).toBe(false);
      expect(ITEMS.filter((i) => i.id === `furn.${p.ch}`)).toHaveLength(1);
    }
    expect(new Set(ITEMS.map((i) => i.id)).size).toBe(ITEMS.length);
  });

  test("the table: rarity, width, wall and flat hints", () => {
    expect(RAGNAROK_PIECES.map((p) => [p.name, p.rarity, p.w, !!p.wall, !!p.flat])).toEqual([
      ["Raven banner", "common", 2, true, false],
      ["Bearskin rug", "common", 2, false, true],
      ["Mead stump", "common", 1, false, false],
      ["Feast table", "uncommon", 2, false, false],
      ["Painted runestone", "uncommon", 1, false, false],
      ["Yggdrasil sapling", "rare", 3, false, false],
    ]);
  });

  test("every piece is a free, tradeable case item placeable only in its owner's office", () => {
    for (const p of RAGNAROK_PIECES) {
      const item = itemById(`furn.${p.ch}`)!;
      expect(item).toMatchObject({ slot: "furniture", price: 0, tradeable: true, case: true, home: true });
      expect(item.rarity).toBe(p.rarity);
      expect(item.blurb).toBe(p.blurb);
      expect(isTradeable(item.id)).toBe(true);
      expect(canDropIn(item.id, "office:7", 7)).toBe(true);
      expect(canDropIn(item.id, "office:8", 7)).toBe(false);
      expect(canDropIn(item.id, "hq:1", 7)).toBe(false);
    }
  });
});

describe("the Ragnarok Eve case", () => {
  test("is the third case, tuned like Night Market with a 100 coin key", () => {
    expect(CASES.map((c) => c.id)).toEqual(["night-market", "nusantara", "ragnarok-eve"]);
    expect(eve.name).toBe("Ragnarok Eve case");
    expect({ k: eve.keyPrice, o: eve.odds, r: eve.rareWithin, d: eve.dupeRerolls }).toEqual({
      k: 100,
      o: night.odds,
      r: night.rareWithin,
      d: night.dupeRerolls,
    });
  });

  test("holds exactly its 30 wearables and 6 pieces, none of Night Market's", () => {
    expect(eve.items).toHaveLength(36);
    expect(eve.items.every((i) => i.case)).toBe(true);
    const want = new Set([...RAGNAROK_ITEMS.map((i) => i.id), ...RAGNAROK_PIECES.map((p) => `furn.${p.ch}`)]);
    expect(new Set(eve.items.map((i) => i.id))).toEqual(want);
    const nightIds = new Set(night.items.map((i) => i.id));
    for (const i of eve.items) {
      expect(nightIds.has(i.id)).toBe(false);
      expect(caseOfItem(i.id)).toBe(eve);
    }
    for (const i of night.items) expect(caseOfItem(i.id)).toBe(night);
  });

  test("Night Market's pool is unchanged", () => {
    expect(night.items).toHaveLength(CASE_ITEMS.length + CASE_PIECES.length);
    expect(night.items.every((i) => (i.slot === "furniture" ? true : i.index < CASE_BASE + 100))).toBe(true);
  });

  test("every tier has items, so no roll falls through", () => {
    for (const r of RARITIES) expect(eve.items.some((i) => (i.rarity ?? "common") === r)).toBe(true);
  });
});
