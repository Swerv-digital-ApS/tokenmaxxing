import type { GraphicsSettings } from "../../settings/graphics.ts";
import type { Pipeline, PipelineOptions } from "../engine/pipeline.ts";
import { setGeometryDetail, setTextureCap } from "../kit/kit.ts";

/** Past this many device pixels per CSS pixel nobody sees the difference, and the fill cost keeps growing. */
export const MAX_PIXEL_RATIO = 2;

/**
 * What each graphics tier means for the 3D pipeline. Medium is the genuinely light one: the classic look at a
 * lower resolution with silhouette lines only (one scene pass, no normals, no depth float, no shadows).
 * High caps density at 1.5 by default, with 12-sample AO, haze, grade, 2x MSAA and split 2K shadows; Ultra adds tilt-shift, 4x MSAA
 * and a 4K shadow map drawn every frame.
 */
export function pipelineOptions(s: GraphicsSettings): Partial<PipelineOptions> {
  const ratioCap = Math.min(s.dprCap, MAX_PIXEL_RATIO / Math.max(0.5, s.renderScale));
  if (s.tier === "medium" || s.tier === "low") {
    return {
      style: "classic",
      pixelSize: 3 / s.renderScale,
      outline: 1,
      crease: 0,
      shadowSize: 0,
      blob: true,
      crowd: 8,
      shadowEvery: 1,
      dprCap: 1,
      renderScale: 1,
    };
  }
  const ultra = s.tier === "ultra";
  return {
    style: "voxel",
    pixelSize: 1,
    renderScale: s.renderScale,
    dprCap: ratioCap,
    shadowSize: s.shadows === "off" ? 0 : s.shadowMap,
    blob: s.shadows === "off",
    shadowEvery: ultra ? 1 : 2,
    aoSamples: s.ao ? (ultra ? 24 : 12) : 0,
    aoScale: 0.5,
    crowd: ultra ? 32 : 16,
    msaa: ultra ? 4 : 2,
    tilt: s.post.tiltShift,
    haze: s.post.haze,
    grade: s.post.grade,
  };
}

/** The renderer's `setQuality` in one line: `applyGraphics(pipe, settings)`. */
export function applyGraphics(pipe: Pipeline, s: GraphicsSettings): void {
  // For rooms built from now on: plain boxes and 1024 px surfaces on Medium.
  const lean = s.tier === "medium" || s.tier === "low";
  setGeometryDetail(lean ? 0 : 1);
  setTextureCap(lean ? 1024 : 2048);
  pipe.configure(pipelineOptions(s));
}
