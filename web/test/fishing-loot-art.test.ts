import { expect, test } from "bun:test";
import { ALL_CASE_ITEMS } from "@tokenmaxxing/core/case.ts";
import { FISHING_BASE, FISHING_ITEMS } from "@tokenmaxxing/core/fishing-loot.ts";
import { CASE_HATS } from "../src/art/case.ts";
import { FISHING_BACKS, FISHING_HATS, FISHING_HELD } from "../src/art/fishing-loot.ts";
import { FISHING_AURAS } from "../src/art/fishing-loot-aura.ts";
import { FISHING_PETS } from "../src/art/fishing-loot-pets.ts";
import { PETS } from "../src/art/pet-base.ts";
import { Pen } from "../src/art/pixels.ts";

/** Every row is a line of `pal`'s characters (or `.`), no wider than `width` (16, the character's frame). */
const checkRows = (what: string, rows: readonly string[], pal: Record<string, string>, width = 16) => {
  for (const [y, row] of rows.entries()) {
    expect(row.length, `${what} row ${y} is ${row.length} wide`).toBeLessThanOrEqual(width);
    for (const c of row)
      if (c !== ".") expect(pal[c], `${what} row ${y}: "${c}" is not in the palette`).toBeDefined();
  }
};

/** A pen that only records where it paints, so a sprite can be checked against its canvas without one. */
const recorder = (w: number, h: number) => {
  const bad: string[] = [];
  let painted = 0;
  const g = {
    fillStyle: "",
    fillRect(x: number, y: number, rw: number, rh: number) {
      if (rw <= 0 || rh <= 0) return;
      painted++;
      if (![x, y, rw, rh].every(Number.isInteger) || x < 0 || y < 0 || x + rw > w || y + rh > h)
        bad.push(`${x},${y} ${rw}x${rh}`);
    },
  };
  return { pen: new Pen(g as unknown as CanvasRenderingContext2D), bad, painted: () => painted };
};

const of = (slot: string) => FISHING_ITEMS.filter((i) => i.slot === slot);

test("the pond treasures are worn like case items, and have art in every slot they use", () => {
  expect(of("hat").length).toBe(1);
  expect(of("held").length).toBe(1);
  expect(of("back").length).toBe(1);
  expect(of("pet").length).toBe(2);
  expect(of("aura").length).toBe(1);
  for (const it of FISHING_ITEMS) expect(ALL_CASE_ITEMS.map((c) => c.id)).toContain(it.id);
});

test("every pond hat has art on the character's 16 columns, merged into the case hats", () => {
  for (const it of of("hat")) {
    const art = CASE_HATS[it.id];
    expect(art, `${it.name} (${it.id})`).toBeDefined();
    expect(art).toBe(FISHING_HATS[it.id]!);
    for (const view of ["down", "side", "up"] as const)
      if (art![view]) checkRows(`${it.name} ${view}`, art![view]!, art!.pal);
  }
  // And nothing beyond the catalog.
  const ids = new Set(FISHING_ITEMS.map((i) => i.id));
  for (const id of Object.keys(FISHING_HATS)) expect(ids.has(id), `${id} is in the catalog`).toBe(true);
});

test("the pond rod and tackle box have art, found by their look index", () => {
  for (const it of of("held")) {
    const h = FISHING_HELD[it.index];
    expect(h, it.name).toBeDefined();
    expect(
      h!.rows.some((r) => r.includes("h")),
      `${it.name} has a hand`,
    ).toBe(true);
    checkRows(it.name, h!.rows, { ...h!.pal, h: "x" }, 9);
  }
  for (const it of of("back")) {
    const b = FISHING_BACKS[it.index];
    expect(b, it.name).toBeDefined();
    for (const view of ["down", "side", "up"] as const) {
      const v = b!.views[view];
      expect(v.behind ?? v.front, `${it.name} ${view}`).toBeDefined();
      for (const rows of [v.behind, v.front, b!.walk?.[view]?.behind, b!.walk?.[view]?.front])
        if (rows) {
          expect(rows.length, `${it.name} ${view}`).toBeLessThanOrEqual(16);
          checkRows(`${it.name} ${view}`, rows, b!.pal);
        }
    }
  }
});

test("every pond pet has two 12x10 frames in PETS at its look index", () => {
  expect(FISHING_PETS.length).toBe(of("pet").length);
  for (const it of of("pet")) {
    const pet = PETS[it.index];
    expect(pet, it.name).toBeTruthy();
    expect(pet).toBe(FISHING_PETS[it.index - FISHING_BASE]!);
    expect(pet!.frames.length).toBe(2);
    for (const rows of pet!.frames) {
      expect(rows.length, it.name).toBe(10);
      for (const r of rows) expect(r.length, `${it.name}: "${r}"`).toBe(12);
      checkRows(it.name, rows, pet!.pal, 12);
    }
  }
});

test("the pond aura draws something on every frame, inside its 28x28 canvas", () => {
  for (const it of of("aura")) {
    const draw = FISHING_AURAS[it.index];
    expect(draw, it.name).toBeDefined();
    for (let f = 0; f < 8; f++) {
      const r = recorder(28, 28);
      draw!(r.pen, f);
      expect({ name: it.name, f, bad: r.bad }).toEqual({ name: it.name, f, bad: [] });
      expect(r.painted(), `${it.name} frame ${f}`).toBeGreaterThan(15);
    }
  }
  expect(Object.keys(FISHING_AURAS).map(Number)).toEqual(of("aura").map((i) => i.index));
});

test("the ranges stay apart: no pond table reaches below its base", () => {
  for (const table of [FISHING_HELD, FISHING_BACKS, FISHING_AURAS])
    for (const k of Object.keys(table)) expect(Number(k)).toBeGreaterThanOrEqual(FISHING_BASE);
  for (const id of Object.keys(FISHING_HATS))
    expect(Number(id.split(".")[1])).toBeGreaterThanOrEqual(FISHING_BASE);
});
