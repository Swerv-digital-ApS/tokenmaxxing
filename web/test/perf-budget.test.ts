import { beforeAll, expect, test } from "bun:test";
import { BUDGETS, budgetFor } from "../src/render3d/perf/budgets.ts";

import { installHeadlessGlobals } from "../src/render3d/perf/stubs.ts";

installHeadlessGlobals();

type Mod = typeof import("../src/render3d/perf/headless.ts");
let h: Mod;
beforeAll(async () => {
  h = await import("../src/render3d/perf/headless.ts");
  await h.loadAllSlices();
});

for (const room of Object.keys(BUDGETS.high)) {
  test(`${room} stays inside its draw-call and triangle budget`, () => {
    const s = h.measureRoom(room);
    const b = budgetFor(room);
    expect(s.drawCalls).toBeLessThanOrEqual(b.drawCalls);
    expect(s.triangles).toBeLessThanOrEqual(b.triangles);
    expect(s.materials).toBeLessThanOrEqual(b.materials);
    expect(s.textureMB).toBeLessThanOrEqual(b.textureMB);
  });
}

test("the town stays inside its budget all year round: in leaf, turning, in blossom and bare", async () => {
  const { hud } = await import("../src/store.ts");
  const { pinnedDay } = await import("@tokenmaxxing/core/seasons.ts");
  const b = budgetFor("town");
  try {
    for (const pin of ["summer", "10-10", "autumn", "winter", "spring"]) {
      hud.set({ seasonDay: pinnedDay(pin) });
      // A fresh world, so the town is built for the pinned day.
      (globalThis as { __perfWorld?: unknown }).__perfWorld = undefined;
      const s = h.measureRoom("town");
      expect(s.drawCalls).toBeLessThanOrEqual(b.drawCalls);
      expect(s.triangles).toBeLessThanOrEqual(b.triangles);
      expect(s.materials).toBeLessThanOrEqual(b.materials);
    }
  } finally {
    hud.set({ seasonDay: null });
    (globalThis as { __perfWorld?: unknown }).__perfWorld = undefined;
  }
}, 60_000);

test("a chamfered box is 44 triangles with unit normals", async () => {
  const { chamferBox } = await import("../src/render3d/kit/kit.ts");
  const g = chamferBox(1, 2, 3, 0.03);
  expect(g.getAttribute("position").count / 3).toBe(44);
  const n = g.getAttribute("normal");
  for (let i = 0; i < n.count; i++) expect(Math.hypot(n.getX(i), n.getY(i), n.getZ(i))).toBeCloseTo(1, 5);
});

test("tiers get lighter going down: Medium has no shadows or AO, Ultra has the most", async () => {
  const { resolveSettings } = await import("../src/settings/graphics.ts");
  const { pipelineOptions } = await import("../src/render3d/perf/tiers.ts");
  const m = pipelineOptions(resolveSettings("medium"));
  const hi = pipelineOptions(resolveSettings("high"));
  const u = pipelineOptions(resolveSettings("ultra"));
  expect(m.shadowSize).toBe(0);
  expect(m.crease).toBe(0);
  expect(hi.aoSamples!).toBeLessThan(u.aoSamples!);
  expect(hi.shadowSize!).toBeLessThan(u.shadowSize!);
  expect(hi.msaa!).toBeGreaterThan(0);
  expect(hi.msaa!).toBeLessThan(u.msaa!);
  expect(u.dprCap! * u.renderScale!).toBeLessThanOrEqual(2.0001);
});

test("medium never budgets more than high", () => {
  for (const room of Object.keys(BUDGETS.high)) {
    const m = BUDGETS.medium[room]!;
    const hi = BUDGETS.high[room]!;
    expect(m.triangles).toBeLessThanOrEqual(hi.triangles);
    expect(m.drawCalls).toBeLessThanOrEqual(hi.drawCalls);
  }
});

test("live room measurements stay independent of earlier frozen measurements", () => {
  const live = h.measureRoom("shop-pets", { actors: "live" });
  const frozen = h.measureRoom("shop-pets");
  const again = h.measureRoom("shop-pets", { actors: "live" });
  expect(frozen.drawCalls).toBeLessThan(live.drawCalls);
  expect(again.drawCalls).toBe(live.drawCalls);
  expect(again.triangles).toBe(live.triangles);
});
