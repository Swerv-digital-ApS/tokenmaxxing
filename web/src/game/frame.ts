/** Something in the world to draw: everything is sorted by `y` (world pixels) and drawn back to front. */
interface Draw {
  y: number;
  draw: () => void;
}

/**
 * One frame of the scene, as each part of it sees it (`render`): the canvas, the world things to draw and
 * the labels to put over them, the time and the view.
 */
export interface Frame {
  g: CanvasRenderingContext2D;
  items: Draw[];
  /** Drawn last, in canvas (device) pixels, over everything else. */
  labels: (() => void)[];
  /** `performance.now()` for this frame. */
  now: number;
  dpr: number;
  /** Device pixels per world pixel. */
  scale: number;
  /** The world pixels on screen. */
  view: { x0: number; y0: number; x1: number; y1: number };
  /** World pixels to canvas pixels. */
  toScreen: (px: number, py: number) => readonly [number, number];
}

/** Whether the world rect at (`x`, `y`), `w`×`h`, reaches into the view, or within `margin` world pixels of it. */
export const inView = (f: Frame, x: number, y: number, w: number, h: number, margin = 0): boolean =>
  x + w + margin > f.view.x0 &&
  x - margin < f.view.x1 &&
  y + h + margin > f.view.y0 &&
  y - margin < f.view.y1;
