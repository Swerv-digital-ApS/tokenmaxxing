import { COP } from "@tokenmaxxing/core/cop.ts";
import type { Facing } from "@tokenmaxxing/core/world.ts";
import { characterFrame, type Pose, type View } from "./characters.ts";
import { C } from "./palette.ts";
import { bake, cached, gradient, type Palette } from "./pixels.ts";

/**
 * Officer 429: his look (a blue shirt) with a uniform drawn over it. A peaked cap with a gold badge,
 * a badge on the chest, a duty belt, and a notepad and pencil while he writes a ticket. The siren on
 * his cap, and its glow, are drawn live (`drawSiren`, `drawSirenGlow`).
 */

const PAL: Palette = {
  o: C.ink,
  n: "#24336b", // navy cap
  N: "#33498f",
  k: "#15161f", // visor, belt
  K: "#4a4f63", // the visor's shine
  y: "#f5c842", // badges, buckle
  Y: "#c9971f",
  w: C.white, // collar, notepad
  l: "#8fb3d9", // the notepad's lines
  p: "#f19a8b", // the pencil's eraser
  g: "#f0b53c", // the pencil
};

// Pixel art reads as a grid.
// prettier-ignore
const CAP: Record<View, string[]> = {
  down: [
    "................",
    "...oooooooooo...",
    "..oNNNNNNNNNNo..",
    "...onnnyYnnno...",
    "....okKkkkko....",
  ],
  side: [
    "................",
    "...ooooooooo....",
    "..oNNNNNNNNNo...",
    "...onnnnnnyYo...",
    "...okkkkkkkKkko.",
  ],
  up: [
    "................",
    "...oooooooooo...",
    "..oNNNNNNNNNNo..",
    "...onnnnnnnno...",
    "...okkkkkkkko...",
  ],
};

/** Over the body, from row 9: collar and tie, a badge on the chest, the belt and its buckle. */
// Pixel art reads as a grid.
// prettier-ignore
const UNIFORM: Record<View, string[]> = {
  down: [
    "......wnnw......",
    ".........y......",
    ".....kkyykk.....",
  ],
  side: [
    "........w.......",
    "........y.......",
    ".....kkk.kk.....",
  ],
  up: [
    "......nnnn......",
    "................",
    ".....kkkkkk.....",
  ],
};

/** The notepad held up in front, from row 9; the pencil's tip moves along it (`scribble`). */
// Pixel art reads as a grid.
// prettier-ignore
const NOTEPAD: Record<"down" | "side", string[]> = {
  down: [
    "........ooooo...",
    "........owwwo...",
    "........ollwo...",
    "........owwwo...",
    "........ooooo...",
  ],
  side: [
    "..........oooo..",
    "..........owwo..",
    "..........ollo..",
    "..........owwo..",
    "..........oooo..",
  ],
};

/** One 16×16 frame of him, like `characterFrame`. `scribble` is 0 or 1 while he writes, else null. */
export const copFrame = cached(
  (facing: Facing, pose: Pose, scribble: 0 | 1 | null) => `${facing}:${pose}:${scribble}`,
  (facing: Facing, pose: Pose, scribble: 0 | 1 | null) => {
    const view: View = facing === "left" || facing === "right" ? "side" : facing;
    const flip = facing === "left";
    return bake(16, 16, (p) => {
      p.g.drawImage(characterFrame(COP.look, facing, pose), 0, 0);
      p.grid(UNIFORM[view], PAL, 0, 9, flip);
      p.grid(CAP[view], PAL, 0, 0, flip);
      if (scribble === null || view === "up") return;
      p.grid(NOTEPAD[view], PAL, 0, 9, flip);
      // The pencil: eraser up, tip on the page, a pixel along every other frame.
      const x = (view === "down" ? 10 : 11) + scribble;
      const at = (px: number) => (flip ? 15 - px : px);
      p.px(at(x + 1), 9, PAL.p!);
      p.px(at(x + 1), 10, PAL.g!);
      p.px(at(x), 11, C.ink);
    });
  },
);

const sirenRed = (now: number) => Math.floor(now / 170) % 2 === 0;
const sirenHot = (red: boolean) => (red ? "#ff4a4a" : "#4a9bff");

/**
 * Behind him while his siren is on: a red and blue glow in turns, round him and washed over the
 * ground, so it reads even under his name tag.
 */
export function drawSirenGlow(g: CanvasRenderingContext2D, px: number, py: number, now: number): void {
  const red = sirenRed(now);
  // Made once for each colour round (0, 0), and moved to him.
  g.save();
  g.translate(px, py);
  g.globalAlpha = 0.45;
  g.fillStyle = gradient(g, `siren ${red}`, () => {
    const glow = g.createRadialGradient(8, 6, 2, 8, 6, 15);
    glow.addColorStop(0, sirenHot(red));
    glow.addColorStop(1, "transparent");
    return glow;
  });
  g.fillRect(-8, -10, 32, 32);
  g.restore();
  g.globalAlpha = 0.2;
  g.fillStyle = sirenHot(!red);
  g.beginPath();
  g.ellipse(px + 8, py + 15, 12, 4, 0, 0, Math.PI * 2);
  g.fill();
  g.globalAlpha = 1;
}

/** The light bar on his cap, red and blue in turns. `top` is where his frame was drawn. */
export function drawSiren(g: CanvasRenderingContext2D, px: number, top: number, now: number): void {
  const red = sirenRed(now);
  const hot = sirenHot(red);
  g.fillStyle = C.ink;
  g.fillRect(px + 5, top - 2, 6, 3);
  g.fillStyle = red ? hot : "#7a2a2e";
  g.fillRect(px + 6, top - 1, 2, 2);
  g.fillStyle = red ? "#25406e" : hot;
  g.fillRect(px + 8, top - 1, 2, 2);
}
