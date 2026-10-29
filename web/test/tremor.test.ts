import { describe, expect, test } from "bun:test";
import { buzz, jitter, tremor, tremor2d, tremorPhase } from "../src/game/tremor.ts";

const samples = (cups: number, hz: number, seconds: number, phase = 0.7) =>
  Array.from({ length: Math.round(hz * seconds) }, (_, i) => tremor(cups, i / hz, phase));

describe("tremor", () => {
  test("none without coffee, easing in as a cup arrives and out as it wears off", () => {
    expect(tremor(0, 1.234, 2)).toEqual({ dx: 0, dz: 0, lift: 0 });
    expect(tremor2d(0, 1234, 2)).toEqual({ dx: 0, dy: 0 });
    expect(buzz(0)).toBe(0);
    expect(buzz(0.1)).toBeLessThan(buzz(0.25));
    expect(buzz(0.25)).toBeLessThan(buzz(0.5));
    expect(buzz(9)).toBe(buzz(4));
  });

  test("bounded by its amplitude, a third of the old nudge", () => {
    for (const cups of [0.3, 1, 2, 4, 9]) {
      const reach = buzz(cups) / 3 / 16;
      for (const s of samples(cups, 120, 8)) {
        expect(Math.abs(s.dx)).toBeLessThanOrEqual(reach + 1e-12);
        expect(Math.abs(s.dz)).toBeLessThanOrEqual(reach / 2 + 1e-12);
        expect(s.lift).toBeGreaterThanOrEqual(0);
        expect(s.lift).toBeLessThanOrEqual(reach * 0.35 + 1e-12);
      }
    }
    // Four cups used to nudge up to 4 px (0.25 tile) every frame; now under 0.09 tile.
    expect(Math.max(...samples(4, 120, 8).map((s) => Math.abs(s.dx)))).toBeLessThan(4 / 16 / 3);
  });

  test("smooth: neighbouring samples at 120 Hz are close", () => {
    const s = samples(4, 120, 8);
    for (let i = 1; i < s.length; i++) {
      expect(Math.abs(s[i]!.dx - s[i - 1]!.dx)).toBeLessThan(0.05);
      expect(Math.abs(s[i]!.dz - s[i - 1]!.dz)).toBeLessThan(0.025);
    }
  });

  test("the same at any frame rate: it is a function of the clock", () => {
    const at = (t: number) => tremor(3, t, 1.1);
    for (const hz of [30, 60, 144])
      for (let i = 0; i < hz; i++) expect(tremor(3, i / hz, 1.1)).toEqual(at(i / hz));
    // The mean energy per second matches whatever rate it is sampled at.
    const rms = (hz: number) => Math.sqrt(samples(3, hz, 10).reduce((a, s) => a + s.dx ** 2, 0) / (hz * 10));
    expect(Math.abs(rms(60) - rms(144))).toBeLessThan(rms(60) * 0.05);
  });

  test("people shake out of step", () => {
    expect(tremorPhase(1)).not.toBe(tremorPhase(2));
    expect(tremor(2, 1, tremorPhase(1)).dx).not.toBe(tremor(2, 1, tremorPhase(2)).dx);
  });

  test("2D: whole pixels, held 1/15 s, a pixel at most, two at four cups", () => {
    for (let ms = 0; ms < 20_000; ms += 1000 / 144) {
      for (const cups of [0.5, 1, 2, 3.9]) {
        const p = tremor2d(cups, ms, 0.3);
        expect(Number.isInteger(p.dx) && Number.isInteger(p.dy)).toBe(true);
        expect(Math.abs(p.dx)).toBeLessThanOrEqual(1);
        expect(Math.abs(p.dy)).toBeLessThanOrEqual(1);
      }
      const four = tremor2d(4, ms, 0.3);
      expect(Math.abs(four.dx)).toBeLessThanOrEqual(2);
      expect(Math.abs(four.dy)).toBeLessThanOrEqual(2);
    }
    expect(tremor2d(2, 1000, 0.3)).toEqual(tremor2d(2, 1000 + 30, 0.3)); // same 1/15 s
    // It reaches two pixels at four cups at some point.
    let most = 0;
    for (let ms = 0; ms < 20_000; ms += 20) most = Math.max(most, Math.abs(tremor2d(4, ms, 0.3).dx));
    expect(most).toBe(2);
  });
});

describe("jitter", () => {
  test("none without coffee; about a degree a cup at most, in fits, the same at any frame rate", () => {
    expect(jitter(0, 1.234, 2)).toEqual({ roll: 0, pitch: 0, lift: 0 });
    const roll = (cups: number, from: number, to: number) => {
      let peak = 0;
      for (let t = from; t < to; t += 1 / 240) peak = Math.max(peak, Math.abs(jitter(cups, t, 0.7).roll));
      return peak;
    };
    for (const cups of [0.5, 2, 4, 9]) {
      expect(roll(cups, 0, 8)).toBeLessThanOrEqual(buzz(cups) * 0.018 + 1e-12);
      for (let t = 0; t < 8; t += 1 / 60) expect(jitter(cups, t, 0.7).lift).toBeGreaterThanOrEqual(0);
    }
    expect(jitter(3, 0.5, 1.1)).toEqual(jitter(3, 0.5, 1.1));
    // A fit and the lull between: the peak changes over the 1.6 s cycle.
    const peaks = Array.from({ length: 8 }, (_, i) => roll(3, i * 0.2, i * 0.2 + 0.2));
    expect(Math.max(...peaks)).toBeGreaterThan(Math.min(...peaks) * 1.5);
  });
});
