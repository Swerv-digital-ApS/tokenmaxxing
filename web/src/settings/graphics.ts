import { clamp } from "hanzio";
import { storage } from "../storage.ts";

export const TIERS = ["low", "medium", "high", "ultra"] as const;
export type Tier = (typeof TIERS)[number];
export type TierChoice = Tier | "auto";
export type Shadows = "off" | "low" | "high";
export type FpsCap = 30 | 60 | 0;
/** Which labels over things show: those near the player (fading with distance) or all of them. */
export type Labels = "near" | "all";

export interface Post {
  haze: boolean;
  tiltShift: boolean;
  grade: boolean;
}

/** Everything a renderer reads. `tier` decides which renderer: `low` is the classic 2D canvas. */
export interface GraphicsSettings {
  tier: Tier;
  renderer: "2d" | "3d";
  /** Render resolution as a share of the window (0.5 to 1.5). */
  renderScale: number;
  /** Frames per second; 0 is uncapped. */
  fpsCap: FpsCap;
  shadows: Shadows;
  /** Shadow map edge in pixels: 0 off, 1024 low, 2048 high, 4096 on Ultra. */
  shadowMap: number;
  ao: boolean;
  post: Post;
  /** Weather particle density, 0 to 1. */
  weather: number;
  /** The most device pixels per CSS pixel to render at. */
  dprCap: number;
  reduceMotion: boolean;
  labels: Labels;
}

export type Overrides = Partial<Omit<GraphicsSettings, "tier" | "renderer" | "shadowMap" | "post">> & {
  post?: Partial<Post>;
};

export const TIER_NAMES: Record<Tier, string> = {
  low: "Low (classic 2D)",
  medium: "Medium",
  high: "High",
  ultra: "Ultra",
};

export const TIER_BLURBS: Record<TierChoice, string> = {
  auto: "Picks for this machine and eases off if it stutters.",
  low: "The original pixel canvas. Lightest on old laptops and batteries.",
  medium: "Pixel-style 3D at reduced resolution. No shadows or effects.",
  high: "Voxel look with ambient occlusion, soft shadows, haze and colour grade.",
  ultra: "Everything: 4K shadows, full effects.",
};

const ALL_POST: Post = { haze: true, tiltShift: true, grade: true };
const NO_POST: Post = { haze: false, tiltShift: false, grade: false };

type TierBase = Omit<GraphicsSettings, "tier" | "shadowMap" | "reduceMotion" | "labels">;

const BASE: Record<Tier, TierBase> = {
  low: {
    renderer: "2d",
    renderScale: 1,
    fpsCap: 60,
    shadows: "off",
    ao: false,
    post: NO_POST,
    weather: 1,
    dprCap: 4,
  },
  medium: {
    renderer: "3d",
    renderScale: 0.75,
    fpsCap: 60,
    shadows: "off",
    ao: false,
    post: NO_POST,
    weather: 0.5,
    dprCap: 1.5,
  },
  high: {
    renderer: "3d",
    renderScale: 1,
    fpsCap: 60,
    shadows: "high",
    ao: true,
    post: { haze: true, tiltShift: false, grade: true },
    weather: 0.75,
    dprCap: 1.5,
  },
  ultra: {
    renderer: "3d",
    renderScale: 1.25,
    fpsCap: 60,
    shadows: "high",
    ao: true,
    post: ALL_POST,
    weather: 1,
    dprCap: 3,
  },
};

const SHADOW_MAP: Record<Shadows, number> = { off: 0, low: 1024, high: 2048 };

export function shadowMapSize(tier: Tier, shadows: Shadows): number {
  return tier === "ultra" && shadows === "high" ? 4096 : SHADOW_MAP[shadows];
}

/** A tier's settings with the player's overrides on top. Pure: `prefersReducedMotion` is passed in. */
export function resolveSettings(
  tier: Tier,
  overrides: Overrides = {},
  prefersReducedMotion = false,
): GraphicsSettings {
  const base = BASE[tier];
  const shadows = overrides.shadows ?? base.shadows;
  return {
    tier,
    renderer: base.renderer,
    renderScale: clamp(overrides.renderScale ?? base.renderScale, 0.5, 1.5),
    fpsCap: overrides.fpsCap ?? base.fpsCap,
    shadows,
    shadowMap: shadowMapSize(tier, shadows),
    ao: overrides.ao ?? base.ao,
    post: { ...base.post, ...overrides.post },
    weather: clamp(overrides.weather ?? base.weather, 0, 1),
    dprCap: clamp(overrides.dprCap ?? base.dprCap, 1, 4),
    reduceMotion: overrides.reduceMotion ?? prefersReducedMotion,
    labels: overrides.labels ?? "near",
  };
}

export const tierBelow = (tier: Tier): Tier => TIERS[Math.max(0, TIERS.indexOf(tier) - 1)]!;
export const tierAbove = (tier: Tier): Tier => TIERS[Math.min(TIERS.length - 1, TIERS.indexOf(tier) + 1)]!;

/** What detection found, kept so the benchmark doesn't run every launch. */
export interface Detected {
  tier: Tier;
  gpu: string | null;
  reasons: string[];
  at: number;
}

export const DETECT_TTL_MS = 14 * 24 * 60 * 60 * 1000;
export const freshDetected = (d: Detected | null, gpu: string | null, now = Date.now()): d is Detected =>
  d !== null && now - d.at < DETECT_TTL_MS && d.gpu === gpu;

interface Saved {
  choice: TierChoice;
  overrides: Overrides;
  meter: boolean;
  detected: Detected | null;
}

export const GRAPHICS_KEY = "tokenmaxxing.graphics";
const VERSION = 1;

const isTier = (v: unknown): v is Tier => TIERS.includes(v as Tier);
const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const bool = (v: unknown): boolean | undefined => (typeof v === "boolean" ? v : undefined);

/** Whatever was stored, as valid overrides: unknown or out-of-range values are dropped. */
export function sanitizeOverrides(raw: unknown): Overrides {
  const o = (typeof raw === "object" && raw ? raw : {}) as Record<string, unknown>;
  const out: Overrides = {};
  if (isNum(o.renderScale)) out.renderScale = clamp(o.renderScale, 0.5, 1.5);
  if (o.fpsCap === 30 || o.fpsCap === 60 || o.fpsCap === 0) out.fpsCap = o.fpsCap;
  if (o.shadows === "off" || o.shadows === "low" || o.shadows === "high") out.shadows = o.shadows;
  const ao = bool(o.ao);
  if (ao !== undefined) out.ao = ao;
  if (isNum(o.weather)) out.weather = clamp(o.weather, 0, 1);
  if (isNum(o.dprCap)) out.dprCap = clamp(o.dprCap, 1, 4);
  const reduce = bool(o.reduceMotion);
  if (reduce !== undefined) out.reduceMotion = reduce;
  if (o.labels === "near" || o.labels === "all") out.labels = o.labels;
  if (typeof o.post === "object" && o.post) {
    const p = o.post as Record<string, unknown>;
    const post: Partial<Post> = {};
    for (const k of ["haze", "tiltShift", "grade"] as const) {
      const v = bool(p[k]);
      if (v !== undefined) post[k] = v;
    }
    if (Object.keys(post).length) out.post = post;
  }
  return out;
}

export function parseSaved(raw: string | null): Saved {
  const empty: Saved = { choice: "auto", overrides: {}, meter: false, detected: null };
  try {
    const s = JSON.parse(raw ?? "null") as Record<string, unknown> | null;
    if (!s || s.v !== VERSION) return empty;
    const d = s.detected as Partial<Detected> | null;
    return {
      choice: s.choice === "auto" || isTier(s.choice) ? s.choice : "auto",
      overrides: sanitizeOverrides(s.overrides),
      meter: s.meter === true,
      detected:
        d && isTier(d.tier) && isNum(d.at)
          ? {
              tier: d.tier,
              gpu: typeof d.gpu === "string" ? d.gpu : null,
              reasons: Array.isArray(d.reasons)
                ? d.reasons.filter((r: unknown) => typeof r === "string")
                : [],
              at: d.at,
            }
          : null,
    };
  } catch {
    return empty;
  }
}

/** Not saved: what the governor did this session, and the toast about it. */
export interface Runtime {
  /** The tier auto settled on after slowness; null while it follows detection. */
  governed: Tier | null;
  /** Detection's first guess, before the benchmark has run. */
  quick: Tier | null;
  /** The governor's share of the render scale, 1 down to 0.5. */
  scaleMul: number;
  /** Set when 3D failed to start or died: the game stays on 2D until reload. */
  failed3d: string | null;
  toast: { text: string; at: number; undo?: () => void } | null;
}

export interface GraphicsState extends Saved {
  runtime: Runtime;
}

type Storage = Pick<globalThis.Storage, "getItem" | "setItem">;

export function createGraphics(storage?: Storage, prefersReducedMotion = () => false) {
  const read = (): Saved => {
    try {
      return parseSaved(storage?.getItem(GRAPHICS_KEY) ?? null);
    } catch {
      return parseSaved(null);
    }
  };
  let state: GraphicsState = {
    ...read(),
    runtime: { governed: null, quick: null, scaleMul: 1, failed3d: null, toast: null },
  };
  const listeners = new Set<() => void>();

  const set = (patch: Partial<GraphicsState>, persist = true) => {
    state = { ...state, ...patch };
    if (persist)
      try {
        const { choice, overrides, meter, detected } = state;
        storage?.setItem(GRAPHICS_KEY, JSON.stringify({ v: VERSION, choice, overrides, meter, detected }));
      } catch {}
    for (const l of listeners) l();
  };

  /** The tier in force: the player's, or for Auto the governor's, else detection's, else Medium. */
  const tier = (): Tier => {
    const { choice, detected, runtime } = state;
    const auto = runtime.governed ?? detected?.tier ?? runtime.quick ?? "medium";
    const t = choice === "auto" ? auto : choice;
    return runtime.failed3d ? "low" : t;
  };

  return {
    get: () => state,
    subscribe(l: () => void) {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    tier,
    /** The settings a renderer should use right now. */
    effective(): GraphicsSettings {
      const s = resolveSettings(tier(), state.overrides, prefersReducedMotion());
      return { ...s, renderScale: clamp(s.renderScale * state.runtime.scaleMul, 0.5, 1.5) };
    },
    /** A new tier choice drops the governor's adjustments, and gives 3D another go if it had stopped. */
    setChoice(choice: TierChoice) {
      set({ choice, runtime: { ...state.runtime, governed: null, scaleMul: 1, failed3d: null } });
    },
    setOverrides(overrides: Overrides) {
      set({ overrides: sanitizeOverrides(overrides) });
    },
    /** One override changed; `undefined` puts it back to the tier's. */
    override<K extends keyof Overrides>(key: K, value: Overrides[K] | undefined) {
      const next = { ...state.overrides };
      if (value === undefined) delete next[key];
      else next[key] = value;
      set({ overrides: sanitizeOverrides(next) });
    },
    setMeter: (meter: boolean) => set({ meter }),
    setDetected: (detected: Detected) => set({ detected }),
    setRuntime: (patch: Partial<Runtime>) => set({ runtime: { ...state.runtime, ...patch } }, false),
    toast(text: string, undo?: () => void) {
      set({ runtime: { ...state.runtime, toast: { text, at: Date.now(), undo } } }, false);
    },
  };
}

export type GraphicsStore = ReturnType<typeof createGraphics>;

export const graphics = createGraphics(
  storage,
  () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches,
);
