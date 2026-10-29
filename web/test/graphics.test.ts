import { expect, test } from "bun:test";
import {
  createGraphics,
  DETECT_TTL_MS,
  freshDetected,
  GRAPHICS_KEY,
  parseSaved,
  resolveSettings,
  sanitizeOverrides,
  TIERS,
  tierBelow,
} from "../src/settings/graphics.ts";

const memory = (init: Record<string, string> = {}) => {
  const data = { ...init };
  return {
    data,
    getItem: (k: string) => data[k] ?? null,
    setItem: (k: string, v: string) => {
      data[k] = v;
    },
  };
};

test("the tier table", () => {
  const [low, medium, high, ultra] = (["low", "medium", "high", "ultra"] as const).map((t) =>
    resolveSettings(t),
  );
  expect(low).toMatchObject({ renderer: "2d", shadows: "off", ao: false });
  expect(medium).toMatchObject({ renderer: "3d", fpsCap: 60, renderScale: 0.75, shadowMap: 0, ao: false });
  expect(medium!.post).toEqual({ haze: false, tiltShift: false, grade: false });
  expect(high).toMatchObject({ renderer: "3d", ao: true, shadowMap: 2048, fpsCap: 60 });
  expect(ultra).toMatchObject({ fpsCap: 60, shadowMap: 4096, ao: true });
  expect(ultra!.post).toEqual({ haze: true, tiltShift: true, grade: true });
});

test("overrides win over the tier, and are clamped", () => {
  const s = resolveSettings("medium", { ao: true, renderScale: 9, post: { haze: true }, shadows: "low" });
  expect(s).toMatchObject({ ao: true, renderScale: 1.5, shadowMap: 1024 });
  expect(s.post).toEqual({ haze: true, tiltShift: false, grade: false });
  expect(resolveSettings("high", { shadows: "high" }).shadowMap).toBe(2048);
});

test("reduce motion follows the system unless overridden", () => {
  expect(resolveSettings("high", {}, true).reduceMotion).toBe(true);
  expect(resolveSettings("high", { reduceMotion: false }, true).reduceMotion).toBe(false);
});

test("stored junk is ignored", () => {
  expect(sanitizeOverrides({ renderScale: "big", fpsCap: 45, shadows: "x", ao: 1, weather: 7 })).toEqual({
    weather: 1,
  });
  expect(parseSaved("{nope")).toMatchObject({ choice: "auto", overrides: {} });
  expect(parseSaved(JSON.stringify({ v: 99, choice: "ultra" })).choice).toBe("auto");
  expect(parseSaved(JSON.stringify({ v: 1, choice: "high", meter: true }))).toMatchObject({
    choice: "high",
    meter: true,
  });
});

test("the store saves choices and overrides, not what the governor did", () => {
  const storage = memory();
  const g = createGraphics(storage);
  g.setChoice("high");
  g.override("ao", false);
  g.setRuntime({ governed: "medium" });
  const saved = JSON.parse(storage.data[GRAPHICS_KEY]!);
  expect(saved).toMatchObject({ v: 1, choice: "high", overrides: { ao: false } });
  expect(saved.runtime).toBeUndefined();
  expect(createGraphics(storage).effective()).toMatchObject({ tier: "high", ao: false });
});

test("auto follows the governor, then detection; a chosen tier ignores it", () => {
  const g = createGraphics(memory());
  expect(g.tier()).toBe("medium");
  g.setDetected({ tier: "ultra", gpu: null, reasons: [], at: 1 });
  expect(g.tier()).toBe("ultra");
  g.setRuntime({ governed: "high", scaleMul: 0.75 });
  expect(g.effective()).toMatchObject({ tier: "high", renderScale: 0.75 });
  g.setChoice("medium");
  expect(g.get().runtime).toMatchObject({ governed: null, scaleMul: 1 });
  expect(g.tier()).toBe("medium");
});

test("a failed 3D renderer pins the game to 2D", () => {
  const g = createGraphics(memory());
  g.setChoice("ultra");
  g.setRuntime({ failed3d: "context lost" });
  expect(g.effective().renderer).toBe("2d");
  // Picking a tier again is a retry.
  g.setChoice("high");
  expect(g.effective().renderer).toBe("3d");
});

test("subscribers hear about changes", () => {
  const g = createGraphics(memory());
  let n = 0;
  const off = g.subscribe(() => n++);
  g.setMeter(true);
  off();
  g.setMeter(false);
  expect(n).toBe(1);
});

test("detection results expire, and with the GPU", () => {
  const d = { tier: "high" as const, gpu: "x", reasons: [], at: 1000 };
  expect(freshDetected(d, "x", 2000)).toBe(true);
  expect(freshDetected(d, "x", 1000 + DETECT_TTL_MS)).toBe(false);
  expect(freshDetected(d, "y", 2000)).toBe(false);
  expect(freshDetected(null, "x")).toBe(false);
  expect(tierBelow("low")).toBe("low");
});

test("tiers default to 60 fps and allow an explicit uncapped override", () => {
  for (const t of TIERS) expect(resolveSettings(t).fpsCap).toBe(60);
  expect(resolveSettings("high", { fpsCap: 0 }).fpsCap).toBe(0);
});

test("the FPS meter is off by default, saved with the other settings, and junk values leave it off", () => {
  expect(parseSaved(null).meter).toBe(false);
  expect(createGraphics(memory()).get().meter).toBe(false);
  const storage = memory();
  const g = createGraphics(storage);
  g.setMeter(true);
  g.setChoice("high");
  expect(JSON.parse(storage.data[GRAPHICS_KEY]!)).toMatchObject({ v: 1, choice: "high", meter: true });
  expect(createGraphics(storage).get().meter).toBe(true);
  for (const junk of ["yes", 1, null, {}])
    expect(parseSaved(JSON.stringify({ v: 1, meter: junk })).meter).toBe(false);
});
