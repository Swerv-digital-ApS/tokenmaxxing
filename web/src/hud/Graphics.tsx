import { useEffect, useState, useSyncExternalStore } from "react";
import { perf } from "../game/stage.ts";
import { gpuName } from "../settings/detect.ts";
import {
  type FpsCap,
  type GraphicsState,
  graphics,
  type Labels,
  type Shadows,
  TIER_BLURBS,
  TIER_NAMES,
  TIERS,
  type TierChoice,
} from "../settings/graphics.ts";
import { Modal, Pills, useFresh } from "./ui.tsx";

function useGraphics<T>(select: (s: GraphicsState) => T): T {
  return useSyncExternalStore(graphics.subscribe, () => select(graphics.get()));
}

const CHOICES: readonly TierChoice[] = ["auto", ...TIERS];
const FPS: readonly (readonly [string, string])[] = [
  ["30", "30"],
  ["60", "60"],
  ["0", "Uncapped"],
];
const LABELS: readonly (readonly [Labels, string])[] = [
  ["near", "Nearby"],
  ["all", "All"],
];
const SHADOWS: readonly (readonly [Shadows, string])[] = [
  ["off", "Off"],
  ["low", "Low"],
  ["high", "High"],
];

/** Esc menu, Graphics: the quality tier, the detected hardware, and the individual settings. */
export function GraphicsPanel() {
  const { choice, detected, meter, runtime } = useGraphics((s) => s);
  const { failed3d } = runtime;
  const effective = graphics.effective();
  const gpu = detected?.gpu ?? gpuName();
  const recommended = TIER_NAMES[detected?.tier ?? graphics.get().runtime.quick ?? "medium"];
  const set = graphics.override;
  return (
    <Modal title="🖼 Graphics">
      <p className="muted small">
        Detected: {gpu ?? "unknown GPU"} → recommended {recommended}
      </p>
      {failed3d && (
        <p className="muted small" role="status">
          3D stopped ({failed3d}), so the game is on Low. Pick a tier to try again.
        </p>
      )}
      <nav className="menu graphics-tiers" aria-label="Quality">
        {CHOICES.map((c) => (
          <button key={c} type="button" aria-pressed={c === choice} onClick={() => graphics.setChoice(c)}>
            {c === "auto" ? "Auto" : TIER_NAMES[c]}
            <span className="muted small"> {TIER_BLURBS[c]}</span>
          </button>
        ))}
      </nav>
      <label>
        <input type="checkbox" checked={meter} onChange={(e) => graphics.setMeter(e.target.checked)} /> Show
        FPS meter
      </label>
      <span>
        Labels <Pills value={effective.labels} options={LABELS} onChange={(v) => set("labels", v)} />
      </span>
      <details>
        <summary>Advanced</summary>
        {effective.renderer === "2d" && (
          <p className="muted small">These apply to the 3D tiers; Low only uses the pixel density cap.</p>
        )}
        <div className="graphics-adv">
          <label>
            {effective.tier === "medium" ? "Pixel detail" : "Resolution"}{" "}
            {Math.round(effective.renderScale * 100)}%
            <input
              type="range"
              min={0.5}
              max={1.5}
              step={0.05}
              value={effective.renderScale}
              onChange={(e) => set("renderScale", Number(e.target.value))}
            />
          </label>
          <span>
            Frame rate{" "}
            <Pills
              value={String(effective.fpsCap)}
              options={FPS}
              onChange={(v) => set("fpsCap", Number(v) as FpsCap)}
            />
          </span>
          <span>
            Shadows <Pills value={effective.shadows} options={SHADOWS} onChange={(v) => set("shadows", v)} />
          </span>
          <label>
            <input type="checkbox" checked={effective.ao} onChange={(e) => set("ao", e.target.checked)} />{" "}
            Ambient occlusion
          </label>
          {(["haze", "tiltShift", "grade"] as const).map((k) => (
            <label key={k}>
              <input
                type="checkbox"
                checked={effective.post[k]}
                onChange={(e) => set("post", { ...graphics.get().overrides.post, [k]: e.target.checked })}
              />{" "}
              {{ haze: "Haze", tiltShift: "Tilt-shift", grade: "Colour grade" }[k]}
            </label>
          ))}
          <label>
            Weather particles {Math.round(effective.weather * 100)}%
            <input
              type="range"
              min={0}
              max={1}
              step={0.25}
              value={effective.weather}
              onChange={(e) => set("weather", Number(e.target.value))}
            />
          </label>
          <label>
            Pixel density cap {effective.dprCap}x
            <input
              type="range"
              min={1}
              max={3}
              step={0.5}
              value={Math.min(3, effective.dprCap)}
              onChange={(e) => set("dprCap", Number(e.target.value))}
            />
          </label>
          <label>
            <input
              type="checkbox"
              checked={effective.reduceMotion}
              onChange={(e) => set("reduceMotion", e.target.checked)}
            />{" "}
            Reduce motion
          </label>
          <button type="button" onClick={() => graphics.setOverrides({})}>
            Reset to tier defaults
          </button>
        </div>
      </details>
    </Modal>
  );
}

/** A small FPS and frame-time readout, when the meter is on. */
export function FpsMeter() {
  const on = useGraphics((s) => s.meter);
  const [, tick] = useState(0);
  useEffect(() => {
    if (!on) return;
    const id = setInterval(() => tick((n) => n + 1), 500);
    return () => clearInterval(id);
  }, [on]);
  if (!on) return null;
  return (
    <div className="panel fps-meter" aria-hidden="true">
      {perf.fps} fps · {perf.ms.toFixed(1)} ms · p95 {perf.p95.toFixed(1)} · {perf.renderer.toUpperCase()}{" "}
      {Math.round(perf.scale * 100)}%
    </div>
  );
}

const TOAST_MS = 10_000;

/** Why the graphics changed, with an Undo when the governor lowered them. */
export function GraphicsToast() {
  const toast = useGraphics((s) => s.runtime.toast);
  const fresh = useFresh(toast?.at, TOAST_MS);
  if (!fresh || !toast) return null;
  const dismiss = () => graphics.setRuntime({ toast: null });
  return (
    <div className="toast mention-toast" role="status">
      {toast.text}
      {toast.undo && (
        <>
          {" "}
          <button
            type="button"
            onClick={() => {
              dismiss();
              toast.undo?.();
            }}
          >
            Undo
          </button>
        </>
      )}
      <button type="button" className="icon" aria-label="Dismiss" onClick={dismiss}>
        ✕
      </button>
    </div>
  );
}
