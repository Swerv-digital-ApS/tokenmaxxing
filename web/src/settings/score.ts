import { type Tier, tierBelow } from "./graphics.ts";

export type GpuClass = "weak" | "mid" | "strong" | "unknown";

export interface Signals {
  webgl2: boolean;
  gpu: string | null;
  /** GB, as `navigator.deviceMemory` rounds it. */
  memory?: number;
  cores?: number;
  mobile: boolean;
  batteryLow: boolean;
  /** Unplugged and under half: a laptop saving power. */
  powerSaver?: boolean;
  saveData: boolean;
  desktopApp: boolean;
  /** Milliseconds for the benchmark's frame; null if it didn't run. */
  benchMs: number | null;
}

/** Benchmark frames faster than this are a good GPU; slower than the other, a poor one. */
export const BENCH_FAST_MS = 2.5;
export const BENCH_SLOW_MS = 10;

export function classifyGpu(gpu: string | null, mobile: boolean, desktopApp = false): GpuClass {
  // The desktop app's webview hides the GPU's name; it runs on Macs, and the benchmark catches a weak one.
  if (!gpu || /^apple gpu$/i.test(gpu)) return desktopApp && !mobile ? "strong" : "unknown";
  if (/swiftshader|llvmpipe|software|basic render|microsoft basic/i.test(gpu)) return "weak";
  if (/mali|powervr|videocore|vivante|intel.*\b(hd|uhd)\b/i.test(gpu)) return "weak";
  const adreno = /adreno.*?(\d{3})/i.exec(gpu)?.[1];
  if (adreno) return Number(adreno) >= 700 ? "mid" : "weak";
  if (/apple/i.test(gpu)) return mobile ? "mid" : "strong";
  if (/nvidia|geforce|rtx|gtx|quadro|radeon (rx|pro)|radeon\(tm\) rx/i.test(gpu)) return "strong";
  if (/iris|intel.*arc|radeon|amd|vega/i.test(gpu)) return "mid";
  return "unknown";
}

const RANK: Tier[] = ["low", "medium", "high", "ultra"];
const cap = (t: Tier, max: Tier): Tier => (RANK.indexOf(t) > RANK.indexOf(max) ? max : t);

/** The recommended tier (never Ultra) for what we know about this machine, and why. Pure. */
export function scoreTier(s: Signals): { tier: Tier; reasons: string[] } {
  if (!s.webgl2) return { tier: "low", reasons: ["no WebGL2"] };
  const reasons: string[] = [];
  const cls = classifyGpu(s.gpu, s.mobile, s.desktopApp);
  const start: Record<GpuClass, Tier> = { weak: "low", mid: "medium", strong: "high", unknown: "medium" };
  let tier = start[cls];
  reasons.push(`${cls} GPU`);
  if (s.benchMs !== null) {
    if (s.benchMs <= BENCH_FAST_MS) {
      tier = cls === "weak" ? "medium" : "high";
      reasons.push("fast benchmark");
    } else if (s.benchMs >= BENCH_SLOW_MS) {
      tier = tierBelow(tier);
      reasons.push("slow benchmark");
    }
  }
  const limit = (max: Tier, why: string) => {
    if (RANK.indexOf(tier) > RANK.indexOf(max)) reasons.push(why);
    tier = cap(tier, max);
  };
  if (s.mobile) limit("medium", "mobile");
  if (s.batteryLow) limit("medium", "low battery");
  if (s.powerSaver) limit("medium", "battery saver");
  if (s.saveData) limit("medium", "data saver");
  if (s.memory !== undefined && s.memory <= 2) limit("low", "2 GB or less memory");
  if (s.cores !== undefined && s.cores <= 2) limit("medium", "2 cores");
  // Ultra is never picked for the player: it is opt-in, and the governor still steps down from whatever is chosen.
  return { tier, reasons };
}
