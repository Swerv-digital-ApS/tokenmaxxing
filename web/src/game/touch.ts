import { viewHooks, zoom } from "./camera.ts";

/** How much the fingers' distance changes for one zoom step, and how far they twist for one turn of the view. */
const PINCH_STEP = 1.35;
const TWIST_STEP = 0.7;
/** A tap that ends a gesture is not a click on the world. */
const SETTLE_MS = 350;

/**
 * Two fingers on the world: pinch to zoom, twist to turn the 3D view (the keys and the minimap's buttons do the
 * same). Without it a phone can only tap to walk.
 */
export function bindTouch(el: HTMLElement): void {
  const fingers = new Map<number, { x: number; y: number }>();
  let last: { d: number; a: number } | null = null;
  let gestureEnd = -Infinity;

  const measure = () => {
    const [a, b] = [...fingers.values()] as [{ x: number; y: number }, { x: number; y: number }];
    return { d: Math.hypot(b.x - a.x, b.y - a.y), a: Math.atan2(b.y - a.y, b.x - a.x) };
  };

  el.addEventListener("pointerdown", (e) => {
    if (e.pointerType !== "touch") return;
    fingers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (fingers.size === 2) last = measure();
  });
  el.addEventListener("pointermove", (e) => {
    if (!fingers.has(e.pointerId)) return;
    fingers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (fingers.size !== 2 || !last) return;
    const now = measure();
    gestureEnd = performance.now();
    if (now.d > last.d * PINCH_STEP || now.d < last.d / PINCH_STEP) {
      zoom(now.d > last.d ? 1 : -1);
      last = now;
      return;
    }
    // The shortest way round, not across the +-pi seam.
    const turn = Math.atan2(Math.sin(now.a - last.a), Math.cos(now.a - last.a));
    if (Math.abs(turn) > TWIST_STEP) {
      viewHooks.rotate?.(turn > 0 ? 1 : -1);
      last = now;
    }
  });
  const lift = (e: PointerEvent) => {
    if (!fingers.delete(e.pointerId)) return;
    if (fingers.size < 2) {
      if (last) gestureEnd = performance.now();
      last = null;
    }
  };
  el.addEventListener("pointerup", lift);
  el.addEventListener("pointercancel", lift);
  // Before the game's own click handler: lifting the fingers of a pinch must not walk anywhere.
  el.addEventListener(
    "click",
    (e) => {
      if (performance.now() - gestureEnd < SETTLE_MS) e.stopImmediatePropagation();
    },
    true,
  );
}
