/** Shared wall pieces: a framed board whose face is a canvas you can redraw (posters, boards, screens). */
import type * as THREE from "three";
import { canvasTexture, glow, Model, painted } from "./kit.ts";

export interface Panel extends Model {
  /** Repaint the face. */
  redraw: (draw: (g: CanvasRenderingContext2D, w: number, h: number) => void) => void;
}

/**
 * A framed panel `w` x `h` world units, raised `lift` off the floor (0 for a free-standing board, a wall
 * height for a hanging one). The face looks along +z. `px` is canvas pixels per world unit; `lit` makes the
 * face emissive (screens, neon).
 */
export function panel(
  w: number,
  h: number,
  draw: (g: CanvasRenderingContext2D, w: number, h: number) => void,
  opts: { frame?: string; lift?: number; px?: number; lit?: boolean; smooth?: boolean } = {},
): Panel {
  const { frame = "#5b3a24", lift = 0, px = 24, lit = false, smooth = false } = opts;
  const cw = Math.round(w * px);
  const ch = Math.round(h * px);
  const m = new Model() as Panel;
  m.box([w + 0.12, h + 0.12, 0.08], frame, [0, lift, 0]);
  const tex: THREE.CanvasTexture = canvasTexture(cw, ch, (g) => draw(g, cw, ch), smooth);
  m.plane(w, h, lit ? glow("#fff", tex) : painted(tex), [0, lift + (h + 0.12) / 2, 0.045]);
  m.redraw = (d) => {
    const g = (tex.image as HTMLCanvasElement).getContext("2d")!;
    g.clearRect(0, 0, cw, ch);
    d(g, cw, ch);
    tex.needsUpdate = true;
  };
  return m;
}
