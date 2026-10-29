/**
 * How much of the screen the HUD's panels cover on each side, measured from the real elements, so the
 * 3D camera can centre the player and frame the room in the free area between them (`render3d/engine/rig.ts`).
 * A side counts in proportion (softened, a stack that fills a third of an edge still counts most) to how much of its edge the panels fill: a lone corner chip does not move
 * the picture, a chat and a map along the bottom do.
 */
export const hudInset = { left: 0, top: 0, right: 0, bottom: 0, version: 0 };

const SELECTOR = ".hints, .stats-chip, .corner, .minimap, .chat-dock, .dialog, .raid-box, .games-box";
/** Panels this close to an edge belong to it. */
const FULL_COVER = 0.6;

interface Rect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

type Side = "left" | "top" | "right" | "bottom";

/** Pure: the insets for these panel rects in a w x h window. */
export function computeInsets(
  rects: readonly Rect[],
  w: number,
  h: number,
): Omit<typeof hudInset, "version"> {
  const thick = { left: 0, top: 0, right: 0, bottom: 0 };
  const span = { left: 0, top: 0, right: 0, bottom: 0 };
  for (const r of rects) {
    const rw = r.right - r.left;
    const rh = r.bottom - r.top;
    if (rw <= 0 || rh <= 0) continue;
    const dist: Record<Side, number> = { left: r.left, top: r.top, right: w - r.right, bottom: h - r.bottom };
    const wide = rw >= rh;
    // The nearest edge; a tie goes to the long way of the panel.
    let side: Side = "top";
    let best = Infinity;
    for (const s of ["left", "top", "right", "bottom"] as const) {
      const horizontal = s === "top" || s === "bottom";
      const d = dist[s] + (horizontal === wide ? 0 : 16);
      if (d < best) {
        best = d;
        side = s;
      }
    }
    const depth =
      side === "left" ? r.right : side === "right" ? w - r.left : side === "top" ? r.bottom : h - r.top;
    thick[side] = Math.max(thick[side], Math.min(depth, (side === "left" || side === "right" ? w : h) * 0.5));
    span[side] += side === "left" || side === "right" ? rh / h : rw / w;
  }
  const weigh = (s: Side) => Math.round(thick[s] * Math.sqrt(Math.min(1, span[s] / FULL_COVER)));
  return { left: weigh("left"), top: weigh("top"), right: weigh("right"), bottom: weigh("bottom") };
}

let pending = false;
let watching = false;

function measure(): void {
  pending = false;
  const rects = [...document.querySelectorAll<HTMLElement>(SELECTOR)].map((el) => el.getBoundingClientRect());
  const next = computeInsets(rects, innerWidth, innerHeight);
  if (
    next.left === hudInset.left &&
    next.top === hudInset.top &&
    next.right === hudInset.right &&
    next.bottom === hudInset.bottom
  )
    return;
  Object.assign(hudInset, next);
  hudInset.version++;
}

function schedule(): void {
  if (pending) return;
  pending = true;
  requestAnimationFrame(measure);
}

/** Measures now and again whenever the window resizes or a panel appears, goes or changes size. */
export function watchHudInsets(): void {
  if (watching || typeof document === "undefined") return;
  watching = true;
  addEventListener("resize", schedule);
  const hud = document.getElementById("hud");
  if (hud) new MutationObserver(schedule).observe(hud, { childList: true, subtree: true });
  if (typeof ResizeObserver === "function" && hud) {
    const ro = new ResizeObserver(schedule);
    const seen = new WeakSet<Element>();
    const hook = () => {
      for (const el of hud.querySelectorAll(SELECTOR)) {
        if (seen.has(el)) continue;
        seen.add(el);
        ro.observe(el);
      }
    };
    new MutationObserver(hook).observe(hud, { childList: true, subtree: true });
    hook();
  }
  schedule();
}
