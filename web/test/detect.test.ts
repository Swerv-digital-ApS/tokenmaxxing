import { expect, test } from "bun:test";
import { classifyGpu, type Signals, scoreTier } from "../src/settings/score.ts";

const base: Signals = {
  webgl2: true,
  gpu: null,
  memory: 8,
  cores: 8,
  mobile: false,
  batteryLow: false,
  saveData: false,
  desktopApp: false,
  benchMs: null,
};
const tier = (s: Partial<Signals>) => scoreTier({ ...base, ...s }).tier;

test("GPU names", () => {
  expect(classifyGpu("ANGLE (Intel, Intel(R) UHD Graphics 620)", false)).toBe("weak");
  expect(classifyGpu("Mali-G78", true)).toBe("weak");
  expect(classifyGpu("Adreno (TM) 619", true)).toBe("weak");
  expect(classifyGpu("Adreno (TM) 740", true)).toBe("mid");
  expect(classifyGpu("Apple M2 Pro", false)).toBe("strong");
  expect(classifyGpu("ANGLE (NVIDIA, NVIDIA GeForce RTX 3070)", false)).toBe("strong");
  expect(classifyGpu("ANGLE (Intel, Intel(R) Iris(R) Xe Graphics)", false)).toBe("mid");
  expect(classifyGpu("Google SwiftShader", false)).toBe("weak");
  expect(classifyGpu("Apple GPU", false, true)).toBe("strong");
  expect(classifyGpu(null, false)).toBe("unknown");
});

test("no WebGL2 is Low", () => {
  expect(tier({ webgl2: false, gpu: "Apple M2" })).toBe("low");
});

test("a strong desktop is High, never Ultra (that is opt-in)", () => {
  expect(tier({ gpu: "Apple M2" })).toBe("high");
  expect(tier({ gpu: "Apple M2", benchMs: 1 })).toBe("high");
  expect(tier({ gpu: "Apple M2", benchMs: 1, cores: 4 })).toBe("high");
  expect(tier({ gpu: "Apple M2", benchMs: 1, powerSaver: true })).toBe("medium");
});

test("weak GPUs are Low unless the benchmark says otherwise", () => {
  expect(tier({ gpu: "Intel(R) UHD Graphics" })).toBe("low");
  expect(tier({ gpu: "Intel(R) UHD Graphics", benchMs: 2 })).toBe("medium");
  expect(tier({ gpu: "NVIDIA GeForce RTX 4090", benchMs: 40 })).toBe("medium");
});

test("phones, low battery and little memory cap the tier", () => {
  expect(tier({ gpu: "Apple GPU", mobile: true, benchMs: 1 })).toBe("medium");
  expect(tier({ gpu: "NVIDIA GeForce RTX 4090", batteryLow: true })).toBe("medium");
  expect(tier({ gpu: "NVIDIA GeForce RTX 4090", memory: 2 })).toBe("low");
  expect(tier({ gpu: "NVIDIA GeForce RTX 4090", cores: 2 })).toBe("medium");
});

test("the desktop app with a hidden GPU name starts High", () => {
  expect(tier({ gpu: null, desktopApp: true })).toBe("high");
  expect(tier({ gpu: null })).toBe("medium");
});
