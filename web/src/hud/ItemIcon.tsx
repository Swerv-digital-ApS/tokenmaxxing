import { type ReactNode, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { merchKey } from "../art/merch.ts";
import type { IconSize, IconSpec } from "../render3d/icons.ts";
import { graphics } from "../settings/graphics.ts";
import { useHud } from "../store.ts";

type Icons = typeof import("../render3d/icons.ts");
let icons: Promise<Icons> | null = null;
/** The 3D icons module, loaded once and only on the 3D tiers (the Bag's stage uses it too). */
export const loadIcons = () => (icons ??= import("../render3d/icons.ts"));
const load = loadIcons;

/**
 * An item as the world shows it. On the 3D tiers: its voxel model, drawn by `render3d/icons.ts` once its turn
 * comes, with the children (the pixel sprite) dimmed underneath until then. On Low, or without WebGL, just the
 * children: the 2D world keeps its own pictures. `size` is CSS pixels; the icon is drawn at 64 or 128 and scaled.
 */
export function ItemIcon({
  spec,
  size = 64,
  className,
  label,
  children,
}: {
  spec: IconSpec;
  size?: number;
  className?: string;
  /** What it shows, for a picture that stands on its own. */
  label?: string;
  children?: ReactNode;
}) {
  const tier = useSyncExternalStore(graphics.subscribe, graphics.tier);
  const three = tier !== "low";
  // A character in merch is drawn from its company's colours and print: another picture when they change.
  const merch = useHud(() =>
    spec.kind === "avatar" && spec.look.merch && spec.look.merchWorn ? merchKey(spec.look.merch) : "",
  );
  const key = three ? `${tier === "medium" ? "c" : "v"}:${JSON.stringify(spec)}:${merch}` : "";
  const bucket: IconSize = size > 64 ? 128 : 64;
  const [icon, setIcon] = useState<{ key: string; canvas: HTMLCanvasElement } | null>(null);
  const [fallback, setFallback] = useState(false);
  const ref = useRef<HTMLCanvasElement>(null);
  const latest = useRef(spec);
  latest.current = spec;
  useEffect(() => {
    if (!three) return;
    let live = true;
    let cancel = () => {};
    void load().then(
      (m) => {
        if (!live) return;
        if (!m.iconsAvailable()) {
          setFallback(true);
          return;
        }
        const r = m.requestIcon(latest.current, bucket);
        cancel = r.cancel;
        void r.promise.then(
          (canvas) => live && setIcon({ key, canvas }),
          () => live && setFallback(true),
        );
      },
      () => live && setFallback(true),
    );
    return () => {
      live = false;
      cancel();
    };
  }, [key, bucket, three]);
  const shown = icon?.key === key ? icon.canvas : null;
  useEffect(() => {
    const c = ref.current;
    if (!c || !shown) return;
    c.width = c.height = shown.width;
    c.getContext("2d")?.drawImage(shown, 0, 0);
  }, [shown]);
  if (!three || fallback) return <>{children}</>;
  return (
    <span
      className={`icon3d${shown ? "" : " waiting"}${className ? ` ${className}` : ""}`}
      style={{ width: size, height: size }}
      {...(label ? { role: "img", "aria-label": label } : {})}
    >
      {!shown && <span className="icon3d-wait">{children}</span>}
      <canvas ref={ref} hidden={!shown} style={{ width: size, height: size }} />
    </span>
  );
}
