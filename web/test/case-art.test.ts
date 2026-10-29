import { afterAll, beforeAll, expect, test } from "bun:test";
import { CASE_BASE, CASE_ITEMS } from "@tokenmaxxing/core/case.ts";
import { NUSANTARA_BASE, NUSANTARA_ITEMS } from "@tokenmaxxing/core/case-nusantara.ts";
import { CASE_GLASSES, CASE_HATS } from "../src/art/case.ts";
import { CA_H, CA_MS, CA_W } from "../src/art/case-aura.ts";
import { CASE_BACKS, CASE_HELD, CASE_OUTFITS } from "../src/art/case-body.ts";
import { CASE_BOX_FRAMES, CASE_BOX_SIZE, type CaseBoxKind } from "../src/art/case-box.ts";
import { editionFrame } from "../src/art/editions.ts";
import { PET_H, PET_W, PETS } from "../src/art/pet-base.ts";
import type { Palette } from "../src/art/pixels.ts";

/** A browser's canvas that only counts what is painted on it. */
let painted = 0;
const realDocument = (globalThis as { document?: unknown }).document;
beforeAll(() => {
  const g = {
    fillStyle: "",
    fillRect() {
      painted++;
    },
    clearRect() {},
    drawImage() {},
  };
  (globalThis as { document?: unknown }).document = {
    createElement: () => ({ width: 0, height: 0, getContext: () => g }),
  };
});
afterAll(() => {
  (globalThis as { document?: unknown }).document = realDocument;
});

/** A module of its own (the query makes it a new instance), so nothing another test baked is in its cache. */
const fresh = <T>(path: string): Promise<T> => import(`${path}?fresh`);

// The Night Market's and the Nusantara's only: Ragnarok Eve's art is checked in `case-ragnarok-art.test.ts`.
const items = (slot: string) => [...CASE_ITEMS, ...NUSANTARA_ITEMS].filter((i) => i.slot === slot);
/** Letters an item may leave to the wearer: outline and hair (and the hand, `h`, of something held). */
const WEARER = new Set([".", "o", "h", "H"]);
const letters = (rows: readonly string[], pal: Palette, extra: ReadonlySet<string> = WEARER) => {
  for (const row of rows)
    for (const ch of row) expect(ch in pal || extra.has(ch), `letter "${ch}" in "${row}"`).toBe(true);
};

test("the Nusantara cosmetics are 30, all from NUSANTARA_BASE, and the art tables line up with the catalog", () => {
  expect(NUSANTARA_ITEMS).toHaveLength(30);
  for (const i of NUSANTARA_ITEMS) expect(i.index).toBeGreaterThanOrEqual(NUSANTARA_BASE);
  expect(items("pet").filter((i) => i.index >= NUSANTARA_BASE)).toHaveLength(6);
  expect(items("aura").filter((i) => i.index >= NUSANTARA_BASE)).toHaveLength(4);
});

test("every case hat and glasses has art that fits the frame and only uses its own colours", () => {
  for (const [slot, table, rowsMax] of [
    ["hat", CASE_HATS, 16],
    ["glasses", CASE_GLASSES, 3],
  ] as const)
    for (const item of items(slot)) {
      const art = table[item.id];
      expect(art, `${item.name}: art`).toBeDefined();
      for (const rows of [art!.down, art!.side, art!.up]) {
        if (!rows) continue;
        expect(rows.length, `${item.name}: rows`).toBeLessThanOrEqual(rowsMax);
        for (const row of rows) expect(row, `${item.name}: row width`).toHaveLength(16);
        letters(rows, art!.pal);
      }
      // The bag, the shop and the floor draw it through `editionFrame`, which looks the id up in these tables.
      expect(editionFrame(item), `${item.name}: icon`).not.toBeNull();
    }
});

test("every case outfit has colours, marks for all three views and nothing that falls off the body", () => {
  for (const item of items("outfit")) {
    const o = CASE_OUTFITS[item.index];
    expect(o, `${item.name}: outfit`).toBeDefined();
    for (const c of [o!.c, o!.C, o!.p]) expect(c).toMatch(/^#[0-9a-f]{6}$/i);
    for (const view of ["down", "side", "up"] as const) {
      const rows = o!.marks[view];
      expect(rows.length, `${item.name} ${view}: rows`).toBeGreaterThanOrEqual(3);
      expect(rows.length, `${item.name} ${view}: rows`).toBeLessThanOrEqual(5);
      for (const row of rows) expect(row, `${item.name} ${view}: row width`).toHaveLength(16);
      letters(rows, o!.pal, new Set(["."]));
    }
  }
});

test("every case held item has exactly one hand, and every back item fits 16x16 in every view", () => {
  for (const item of items("held")) {
    const h = CASE_HELD[item.index];
    expect(h, `${item.name}: held`).toBeDefined();
    expect(h!.rows.join("").split("h").length - 1, `${item.name}: hands`).toBe(1);
    letters(h!.rows, h!.pal);
  }
  for (const item of items("back")) {
    const b = CASE_BACKS[item.index];
    expect(b, `${item.name}: back`).toBeDefined();
    for (const view of [b!.views, b!.walk ?? {}])
      for (const v of Object.values(view))
        for (const rows of [v.behind, v.front]) {
          if (!rows) continue;
          expect(rows.length).toBeLessThanOrEqual(16);
          for (const row of rows) expect(row.length).toBeLessThanOrEqual(16);
          letters(rows, b!.pal, new Set(["."]));
        }
  }
});

test("every case pet is filed at its look index with two 12x10 frames, from both cases", () => {
  const pets = items("pet");
  expect(pets.length).toBeGreaterThanOrEqual(12);
  for (const item of pets) {
    const pet = PETS[item.index];
    expect(pet, `${item.name}: pet`).toBeDefined();
    expect(pet!.frames).toHaveLength(2);
    for (const rows of pet!.frames) {
      expect(rows, `${item.name}: rows`).toHaveLength(PET_H);
      for (const row of rows) expect(row, `${item.name}: row width`).toHaveLength(PET_W);
      letters(rows, pet!.pal, new Set(["."]));
    }
    // The hop moves it: the frames differ.
    expect(pet!.frames[0]).not.toEqual(pet!.frames[1]);
  }
  expect(PETS[CASE_BASE]).toBeTruthy();
  expect(PETS[NUSANTARA_BASE]).toBeTruthy();
});

test("every case aura draws a frame behind the character, in both cases, and loops", async () => {
  // A copy of the module of its own, so nothing another test baked is in its cache and every frame is painted here.
  const { caseAuraFrame, caseAuraIcon } =
    await fresh<typeof import("../src/art/case-aura.ts")>("../src/art/case-aura.ts");
  const auras = items("aura");
  expect(auras).toHaveLength(8);
  for (const item of auras) {
    for (let f = 0; f < 8; f++) {
      painted = 0;
      expect(caseAuraFrame(item.index, f * CA_MS), `${item.name}: frame ${f}`).not.toBeNull();
      expect(painted, `${item.name}: frame ${f} paints`).toBeGreaterThan(0);
    }
    expect(caseAuraIcon(item.index), `${item.name}: icon`).not.toBeNull();
  }
  expect(caseAuraFrame(CASE_BASE + 99, 0)).toBeNull();
  expect([CA_W, CA_H]).toEqual([28, 28]);
});

test("each case has its own box, open box and key, and the Night Market's is unchanged by the new argument", async () => {
  // A copy of the module of its own, so nothing another test baked is in its cache and every frame is painted here.
  const box = await fresh<typeof import("../src/art/case-box.ts")>("../src/art/case-box.ts");
  const kinds = ["closed", "open", "key"] as const satisfies readonly CaseBoxKind[];
  for (const kind of kinds) {
    painted = 0;
    const night = box.caseBoxSprite(kind);
    expect(painted, `night ${kind}`).toBeGreaterThan(0);
    expect(box.caseBoxSprite(kind, 0, "night-market")).toBe(night);
    painted = 0;
    const nus = box.caseBoxSprite(kind, 0, "nusantara");
    expect(painted, `nusantara ${kind}`).toBeGreaterThan(0);
    expect(nus).not.toBe(night);
    expect([nus.width, nus.height]).toEqual([CASE_BOX_SIZE[kind].w, CASE_BOX_SIZE[kind].h]);
    for (let f = 1; f < CASE_BOX_FRAMES[kind]; f++) {
      painted = 0;
      expect(box.caseBoxSprite(kind, f, "nusantara")).not.toBe(nus);
      expect(painted, `nusantara ${kind} ${f}`).toBeGreaterThan(0);
    }
  }
});
