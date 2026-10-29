import { expect, test } from "bun:test";
import { ALL_CASE_ITEMS } from "@tokenmaxxing/core/case.ts";
import { RAGNAROK_BASE, RAGNAROK_ITEMS } from "@tokenmaxxing/core/case-ragnarok.ts";
import { CASES } from "@tokenmaxxing/core/cases.ts";
import { CASE_GLASSES, CASE_HATS } from "../src/art/case.ts";
import { CASE_BOX_SIZE } from "../src/art/case-box.ts";
import { RAGNAROK_GLASSES, RAGNAROK_HATS } from "../src/art/case-ragnarok.ts";
import { RAGNAROK_AURAS } from "../src/art/case-ragnarok-aura.ts";
import { RAGNAROK_BACKS, RAGNAROK_HELD, RAGNAROK_OUTFITS } from "../src/art/case-ragnarok-body.ts";
import { drawRagnarokBox } from "../src/art/case-ragnarok-box.ts";
import { PETS } from "../src/art/pet-base.ts";
import { Pen } from "../src/art/pixels.ts";

/** Every row is a line of `pal`'s characters (or `.`), no wider than 16 (the character's frame). */
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

const ragnarok = RAGNAROK_ITEMS;
const of = (slot: string) => ragnarok.filter((i) => i.slot === slot);

test("every Ragnarok hat and pair of glasses has art, on the character's 16 columns", () => {
  for (const [slot, table] of [
    ["hat", CASE_HATS],
    ["glasses", CASE_GLASSES],
  ] as const)
    for (const it of of(slot)) {
      const art = table[it.id];
      expect(art, `${it.name} (${it.id})`).toBeDefined();
      for (const view of ["down", "side", "up"] as const)
        if (art![view]) checkRows(`${it.name} ${view}`, art![view]!, art!.pal);
    }
  // And nothing beyond the catalog.
  const ids = new Set(ragnarok.map((i) => i.id));
  for (const id of [...Object.keys(RAGNAROK_HATS), ...Object.keys(RAGNAROK_GLASSES)])
    expect(ids.has(id), `${id} is in the catalog`).toBe(true);
});

test("every Ragnarok outfit, held thing and back item has art, found by its look index", () => {
  for (const it of of("outfit")) {
    const o = RAGNAROK_OUTFITS[it.index];
    expect(o, it.name).toBeDefined();
    for (const view of ["down", "side", "up"] as const) {
      expect(o!.marks[view].length, `${it.name} ${view}`).toBeGreaterThan(0);
      checkRows(`${it.name} ${view}`, o!.marks[view], o!.pal);
    }
  }
  for (const it of of("held")) {
    const h = RAGNAROK_HELD[it.index];
    expect(h, it.name).toBeDefined();
    expect(
      h!.rows.some((r) => r.includes("h")),
      `${it.name} has a hand`,
    ).toBe(true);
    checkRows(it.name, h!.rows, { ...h!.pal, h: "x" }, 9);
  }
  for (const it of of("back")) {
    const b = RAGNAROK_BACKS[it.index];
    expect(b, it.name).toBeDefined();
    for (const view of ["down", "side", "up"] as const) {
      const v = b!.views[view];
      expect(v.behind ?? v.front, `${it.name} ${view}`).toBeDefined();
      for (const rows of [v.behind, v.front, b!.walk?.[view]?.behind, b!.walk?.[view]?.front])
        if (rows) checkRows(`${it.name} ${view}`, rows, b!.pal);
    }
  }
});

test("every Ragnarok pet has two 12x10 frames in PETS at its look index", () => {
  expect(of("pet").length).toBe(6);
  for (const it of of("pet")) {
    const pet = PETS[it.index];
    expect(pet, it.name).toBeTruthy();
    expect(pet!.frames.length).toBe(2);
    for (const rows of pet!.frames) {
      expect(rows.length, it.name).toBe(10);
      for (const r of rows) expect(r.length, `${it.name}: "${r}"`).toBe(12);
      checkRows(it.name, rows, pet!.pal, 12);
    }
  }
});

test("every Ragnarok aura draws something on every frame, inside its 28x28 canvas", () => {
  for (const it of of("aura")) {
    const draw = RAGNAROK_AURAS[it.index];
    expect(draw, it.name).toBeDefined();
    for (let f = 0; f < 8; f++) {
      const r = recorder(28, 28);
      draw!(r.pen, f);
      expect({ name: it.name, f, bad: r.bad }).toEqual({ name: it.name, f, bad: [] });
      expect(r.painted(), `${it.name} frame ${f}`).toBeGreaterThan(15);
    }
  }
  expect(Object.keys(RAGNAROK_AURAS).map(Number)).toEqual(of("aura").map((i) => i.index));
});

test("the ranges stay apart: no Ragnarok table reaches below its base", () => {
  for (const table of [RAGNAROK_OUTFITS, RAGNAROK_HELD, RAGNAROK_BACKS, RAGNAROK_AURAS])
    for (const k of Object.keys(table)) expect(Number(k)).toBeGreaterThanOrEqual(RAGNAROK_BASE);
  expect(ALL_CASE_ITEMS.length).toBeGreaterThanOrEqual(ragnarok.length);
});

test("each case has box and key art that stays on the canvas", () => {
  expect(CASES.map((c) => c.id)).toContain("ragnarok-eve");
  for (const kind of ["closed", "open", "key"] as const)
    for (const frame of kind === "open" ? [0, 1] : [0]) {
      const { w, h } = CASE_BOX_SIZE[kind];
      const r = recorder(w, h);
      drawRagnarokBox(r.pen, kind, frame);
      expect({ kind, frame, bad: r.bad }).toEqual({ kind, frame, bad: [] });
      expect(r.painted(), `${kind} ${frame}`).toBeGreaterThan(30);
    }
});
