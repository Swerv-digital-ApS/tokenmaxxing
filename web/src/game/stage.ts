import { startDetection } from "../settings/detect.ts";
import { Governor, percentile, refreshInterval, type Step } from "../settings/governor.ts";
import { graphics, TIER_NAMES } from "../settings/graphics.ts";
import { hud } from "../store.ts";
import { FrameCadence } from "./cadence.ts";
import { loadRenderer, type Renderer, type RendererKind, type Tile } from "./renderer.ts";
import { world } from "./world.ts";

/** Live numbers for the FPS meter. */
export const perf = { fps: 0, ms: 0, p95: 0, renderer: "", scale: 1 };

/** How long the first frames are watched to learn the display's refresh interval. */
const REFRESH_PROBE_MS = 1000;
const UNDO_HOLD_MS = 5 * 60_000;

let active: Renderer | null = null;
let photoRequested = false;
let photoTimer: ReturnType<typeof setTimeout> | null = null;

/** Save the next freshly rendered frame, including the people gathered on screen. */
export function takePhoto(pose?: () => void): void {
  if (photoTimer !== null) return;
  let count = 3;
  const countdown = () => {
    hud.set({ banner: { text: `📷 Photo in ${count}…`, at: Date.now() } });
    if (--count > 0) photoTimer = setTimeout(countdown, 1000);
    else
      photoTimer = setTimeout(() => {
        hud.set({ banner: { text: "📷 Smile!", at: Date.now() } });
        pose?.();
        photoTimer = setTimeout(
          () => {
            photoRequested = true;
            photoTimer = null;
          },
          pose ? 150 : 0,
        );
      }, 1000);
  };
  countdown();
}

/** The tile under a point in the window, as the current renderer sees it. */
export const pickTile = (clientX: number, clientY: number): Tile | null =>
  active?.pick(clientX, clientY) ?? null;

/**
 * Runs the game's frame loop through whichever renderer the graphics settings call for, and swaps it when
 * they change. `tick` steps the game on each visible, scheduled frame and says whether there is a world to draw.
 */
export function startStage(host: HTMLElement, tick: (now: number) => boolean): void {
  let renderer: Renderer | null = null;
  let loading: RendererKind | null = null;
  /** Counts swaps: one that finds a newer one started while it loaded is out of date and drops its renderer. */
  let swaps = 0;
  let size = "";
  const cadence = new FrameCadence();
  cadence.wake(performance.now());
  const wake = () => cadence.wake(performance.now());
  for (const event of ["pointerdown", "pointermove", "keydown", "wheel", "touchstart", "visibilitychange"])
    window.addEventListener(event, wake, { passive: true });
  /** Gaps between the first animation frames, to measure the display's refresh rate. */
  const probe: number[] = [];
  let probeLast = 0;
  /** ms per display refresh: 60 Hz until measured. */
  let refreshMs = 1000 / 60;
  const probeStart = performance.now();
  let fpsFrames = 0;
  let fpsSince = performance.now();
  const gaps: number[] = [];
  const governor = new Governor(graphics.tier(), graphics.get().runtime.scaleMul, performance.now());
  /** The tier and scale the governor last set, to tell its changes from the player's. */
  let mine = `${governor.tier}:${governor.scaleMul}`;

  const fail = (reason: string) => {
    graphics.setRuntime({ failed3d: reason });
    graphics.toast(`3D graphics stopped (${reason}). Using classic 2D.`);
  };

  const swap = async (kind: RendererKind) => {
    loading = kind;
    const turn = ++swaps;
    const { renderer: next, reason, fellBack } = await loadRenderer(kind);
    if (turn !== swaps) return next.dispose();
    loading = null;
    next.mount(host);
    next.onFail?.(fail);
    renderer?.dispose();
    renderer = active = next;
    size = "";
    next.setQuality(graphics.effective());
    if (fellBack) {
      graphics.setRuntime({ failed3d: reason ?? "not available" });
      if (reason) graphics.toast(`3D graphics couldn't start (${reason}). Using classic 2D.`);
    }
  };

  const sync = () => {
    const s = graphics.effective();
    // The HUD's skin follows the tier (hud.css `html[data-tier]`).
    document.documentElement.dataset.tier = graphics.tier();
    if (s.renderer !== (loading ?? renderer?.kind)) void swap(s.renderer);
    else renderer?.setQuality(s);
    const { choice } = graphics.get();
    governor.autoUp = choice === "auto";
    const now = `${graphics.tier()}:${graphics.get().runtime.scaleMul}`;
    if (now !== mine) {
      governor.reset(graphics.tier(), graphics.get().runtime.scaleMul, performance.now());
      mine = now;
    }
  };
  graphics.subscribe(sync);
  sync();
  startDetection();

  const apply = (step: Step) => {
    const before = graphics.tier();
    const beforeMul = graphics.get().runtime.scaleMul;
    mine = `${governor.tier}:${governor.scaleMul}`;
    graphics.setRuntime({ governed: governor.tier, scaleMul: governor.scaleMul });
    if (step.kind === "scale") return;
    const undo = () => {
      governor.reset(before, beforeMul, performance.now(), UNDO_HOLD_MS);
      mine = `${before}:${beforeMul}`;
      graphics.setRuntime({ governed: before, scaleMul: beforeMul });
      graphics.toast(`Back to ${TIER_NAMES[before]} graphics`);
    };
    graphics.toast(
      step.kind === "tier"
        ? `Switched to ${TIER_NAMES[step.tier]} graphics to keep it smooth`
        : `Stable for a while: now on ${TIER_NAMES[step.tier]} graphics`,
      undo,
    );
  };

  const frame = (now: number) => {
    requestAnimationFrame(frame);
    if (now - probeStart < REFRESH_PROBE_MS) {
      if (probeLast) probe.push(now - probeLast);
      probeLast = now;
    } else if (probe.length) {
      refreshMs = refreshInterval(probe);
      probe.length = 0;
    }
    if (!renderer) return;
    const settings = graphics.effective();
    const busy =
      world.portalPending ||
      world.leaving.length > 0 ||
      world.games.size > 0 ||
      world.room === "dungeon" ||
      [...world.avatars.values()].some(
        (a) => a.from || a.queue.length || a.jump !== null || a.warp || a.burst || a.bubble,
      );
    const step = cadence.step(now, settings.fpsCap, busy || photoRequested, document.hidden);
    if (!step || !tick(now)) return;
    const { gap, idle } = step;

    const dpr = window.devicePixelRatio || 1;
    const key = `${window.innerWidth}x${window.innerHeight}@${dpr}`;
    if (key !== size) {
      size = key;
      renderer.resize(window.innerWidth, window.innerHeight, dpr);
    }
    try {
      renderer.frame(now);
    } catch (e) {
      if (renderer.kind === "2d") throw e;
      return fail(e instanceof Error ? e.message : "render error");
    }
    if (photoRequested) {
      photoRequested = false;
      const canvas = host.querySelector<HTMLCanvasElement>("canvas#world");
      canvas?.toBlob((blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `tokenmaxxing-photo-${Date.now()}.png`;
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 60_000);
      }, "image/png");
    }

    if (gap < 500) {
      gaps.push(gap);
      if (gaps.length > 60) gaps.shift();
      perf.ms = gap;
      perf.p95 = percentile(
        [...gaps].sort((a, b) => a - b),
        0.95,
      );
    }
    fpsFrames++;
    if (now - fpsSince >= 500) {
      perf.fps = Math.round((fpsFrames * 1000) / (now - fpsSince));
      fpsFrames = 0;
      fpsSince = now;
    }
    perf.renderer = renderer.kind;
    perf.scale = settings.renderScale;

    if (graphics.get().choice === "auto" && settings.tier !== "low" && !idle && gap < 500) {
      // Judged against what the display can show (or the player's own cap), so a 120 Hz screen is held to 120.
      const step = governor.push(gap, settings.fpsCap === 0 ? refreshMs : 1000 / settings.fpsCap, now);
      if (step) apply(step);
    }
  };
  requestAnimationFrame(frame);
}
