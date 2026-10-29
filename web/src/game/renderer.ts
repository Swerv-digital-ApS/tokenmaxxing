import { TILE } from "@tokenmaxxing/core/world.ts";
import { hasWebGL2 } from "../settings/detect.ts";
import type { GraphicsSettings } from "../settings/graphics.ts";
import { camera } from "./camera.ts";
import { render } from "./render.ts";

export interface Tile {
  x: number;
  y: number;
}

/** What the game loop draws through. 2D and 3D both implement it; the loop never knows which. */
export interface Renderer {
  readonly kind: "2d" | "3d";
  /** Puts the renderer's canvas in `host`. */
  mount(host: HTMLElement): void;
  /** Draws the world as it is at `now` (ms, the rAF clock). The loop has already stepped the game. */
  frame(now: number): void;
  /** The window in CSS pixels and the device pixel ratio; called when any of them change. */
  resize(w: number, h: number, dpr: number): void;
  /** New graphics settings (a tier or an override changed); apply without a reload. */
  setQuality(settings: GraphicsSettings): void;
  /** The tile under a point in the window (client pixels), or null if it is not over the map. */
  pick(clientX: number, clientY: number): Tile | null;
  /** The renderer died (context lost, a shader error): the game switches to 2D. Called by the renderer. */
  onFail?(cb: (reason: string) => void): void;
  dispose(): void;
}

/** The classic canvas renderer (`render.ts`), unchanged. It sizes itself to the window. */
export class Renderer2D implements Renderer {
  readonly kind = "2d";
  private canvas = document.createElement("canvas");
  private dpr = window.devicePixelRatio || 1;
  private dprCap = Infinity;

  mount(host: HTMLElement): void {
    this.canvas.id = "world";
    host.append(this.canvas);
  }

  frame(now: number): void {
    render(this.canvas, now, Math.min(this.dpr, this.dprCap));
  }

  resize(_w: number, _h: number, dpr: number): void {
    this.dpr = dpr;
  }

  setQuality(s: GraphicsSettings): void {
    this.dprCap = s.dprCap;
  }

  pick(clientX: number, clientY: number): Tile | null {
    const { x, y, scale, dpr } = camera;
    return {
      x: Math.floor(((clientX * dpr) / scale + x) / TILE),
      y: Math.floor(((clientY * dpr) / scale + y) / TILE),
    };
  }

  dispose(): void {
    this.canvas.remove();
  }
}

export type RendererKind = "2d" | "3d";

/**
 * The renderer for a kind. 3D is imported on demand, so its code is only fetched when it is used. Falls back
 * to 2D when 3D can't run: `reason` says why (null: simply not available, which is not worth a toast).
 */
export async function loadRenderer(
  kind: RendererKind,
): Promise<{ renderer: Renderer; reason: string | null; fellBack: boolean }> {
  if (kind === "3d") {
    let reason: string | null = null;
    if (!hasWebGL2()) reason = "WebGL2 isn't available";
    else
      try {
        const r = (await import("../render3d/index.ts")).create3D();
        if (r) return { renderer: r, reason: null, fellBack: false };
      } catch (e) {
        reason = e instanceof Error ? e.message : String(e);
      }
    return { renderer: new Renderer2D(), reason, fellBack: true };
  }
  return { renderer: new Renderer2D(), reason: null, fellBack: false };
}
