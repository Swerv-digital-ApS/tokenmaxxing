import { TIERS, type Tier, tierAbove, tierBelow } from "./graphics.ts";

export const WINDOW = 120;
/** Slow for this long, without a break, before anything changes. */
export const SUSTAIN_MS = 4000;
/** After a change, wait this long before judging again. */
export const COOLDOWN_MS = 10_000;
/** In Auto, this long without a single slow spell earns a step back up. */
export const STABLE_MS = 3 * 60_000;
/** A downgrade this soon after stepping up means the higher tier is not for this machine. */
export const FLAP_MS = 2 * 60_000;
export const SCALE_STEP = 0.125;
export const MIN_SCALE = 0.625;
/** A frame this long is a hidden tab or a pause, not slowness. */
const GAP_MS = 500;
/** Slow is the p75 frame taking more than this share over the target. */
const SLOW_RATIO = 1.35;
/** So slow (under a third of the target rate) that lowering the scale a notch won't do: go straight to the tier below. */
export const SEVERE_RATIO = 3;

export function percentile(sorted: readonly number[], p: number): number {
  if (sorted.length === 0) return 0;
  return sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))]!;
}

/** Fastest and slowest refresh intervals taken as a display's own (240 Hz, 60 Hz): a slow machine must not look like a slow screen. */
const MIN_REFRESH_MS = 1000 / 240;
const MAX_REFRESH_MS = 1000 / 60;

/** The display's refresh interval from the gaps between its first animation frames: their median, bounded. */
export function refreshInterval(gaps: readonly number[]): number {
  const ok = gaps.filter((g) => g > 0 && g < GAP_MS);
  if (ok.length < 5) return MAX_REFRESH_MS;
  const med = percentile(
    [...ok].sort((a, b) => a - b),
    0.5,
  );
  return Math.min(MAX_REFRESH_MS, Math.max(MIN_REFRESH_MS, med));
}

export type Step =
  | { kind: "scale"; scaleMul: number }
  | { kind: "tier"; tier: Tier; scaleMul: 1 }
  | { kind: "up"; tier: Tier; scaleMul: 1 };

/**
 * Watches the gaps between drawn frames. When they run over the target for a sustained spell it lowers the
 * render scale step by step, then the tier. It only steps up on its own after a long clean run, and not
 * past a tier it has already had to leave right after stepping up.
 */
export class Governor {
  private times: number[] = [];
  private slowSince: number | null = null;
  private quietUntil = 0;
  private lastSlow = 0;
  private lastUp = -Infinity;
  private ceiling: Tier = "ultra";
  /** Whether to also step back up (Auto only). */
  autoUp = true;

  constructor(
    public tier: Tier,
    public scaleMul = 1,
    now = 0,
  ) {
    this.lastSlow = now;
  }

  /** The tier or scale changed from outside (the player, an Undo): start fresh, and hold off for a while. */
  reset(tier: Tier, scaleMul: number, now: number, holdMs = COOLDOWN_MS): void {
    this.tier = tier;
    this.scaleMul = scaleMul;
    this.times = [];
    this.slowSince = null;
    this.quietUntil = now + holdMs;
    this.lastSlow = now;
  }

  /** Percentile of the recent frame gaps (ms). */
  p(p: number): number {
    return percentile(
      [...this.times].sort((a, b) => a - b),
      p,
    );
  }

  /** One drawn frame: `dt` ms since the last, against `target` ms (the fps cap). Returns a change to make, if any. */
  push(dt: number, target: number, now: number): Step | null {
    if (dt > GAP_MS) {
      this.times = [];
      this.slowSince = null;
      return null;
    }
    this.times.push(dt);
    if (this.times.length > WINDOW) this.times.shift();
    if (now < this.quietUntil || this.times.length < WINDOW / 2) return null;

    const slow = this.p(0.75) > target * SLOW_RATIO;
    if (slow) {
      this.lastSlow = now;
      this.slowSince ??= now;
      if (now - this.slowSince >= SUSTAIN_MS) return this.stepDown(now, this.p(0.75) > target * SEVERE_RATIO);
      return null;
    }
    this.slowSince = null;
    const room =
      this.scaleMul < 1 ||
      (this.tier !== "ultra" && TIERS.indexOf(tierAbove(this.tier)) <= TIERS.indexOf(this.ceiling));
    if (this.autoUp && room && now - this.lastSlow >= STABLE_MS) return this.stepUp(now);
    return null;
  }

  private settle(now: number): void {
    this.times = [];
    this.slowSince = null;
    this.quietUntil = now + COOLDOWN_MS;
    this.lastSlow = now;
  }

  private stepDown(now: number, severe: boolean): Step | null {
    this.settle(now);
    if (!severe && this.scaleMul - SCALE_STEP >= MIN_SCALE - 1e-9) {
      this.scaleMul = Math.round((this.scaleMul - SCALE_STEP) * 1000) / 1000;
      return { kind: "scale", scaleMul: this.scaleMul };
    }
    if (this.tier === "low") return null;
    // Leaving a tier we only just stepped up to: that one is out of reach for this session.
    if (now - this.lastUp < FLAP_MS) this.ceiling = tierBelow(this.tier);
    this.tier = tierBelow(this.tier);
    this.scaleMul = 1;
    return { kind: "tier", tier: this.tier, scaleMul: 1 };
  }

  private stepUp(now: number): Step {
    this.settle(now);
    if (this.scaleMul < 1) {
      this.scaleMul = Math.min(1, Math.round((this.scaleMul + SCALE_STEP) * 1000) / 1000);
      return { kind: "scale", scaleMul: this.scaleMul };
    }
    this.lastUp = now;
    this.tier = tierAbove(this.tier);
    this.scaleMul = 1;
    return { kind: "up", tier: this.tier, scaleMul: 1 };
  }
}
