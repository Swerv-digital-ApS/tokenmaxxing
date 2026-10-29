import { C } from "../art/palette.ts";
import { bake } from "../art/pixels.ts";
import { world } from "./world.ts";

/**
 * Town doors swing open when someone walks up to them and shut again once they've gone: a few frames
 * of the door's own panel turning on its left hinge, the lit hall showing behind it. Nothing is sent;
 * it's worked out from where everyone is drawn, so other people open doors too.
 */

/** Frames past shut: 0 is the door as the building sprite draws it, `SWING_FRAMES` wide open. */
export const SWING_FRAMES = 3;
/** Per frame, so a full swing is about a fifth of a second. */
export const FRAME_MS = 60;
/** How long a door stays open after the last person by it has gone. */
export const LINGER_MS = 600;

interface Swing {
  frame: number;
  /** When someone was last by it. */
  seen: number;
  /** When it last moved a frame. */
  at: number;
}

export const shut = (): Swing => ({ frame: 0, seen: -Infinity, at: -Infinity });

/** One step of a door's swing: toward open while someone is by it (or just was), else toward shut. */
export function swingStep(s: Swing, near: boolean, now: number): number {
  if (near) s.seen = now;
  const target = now - s.seen < LINGER_MS ? SWING_FRAMES : 0;
  if (s.frame !== target && now - s.at >= FRAME_MS) {
    s.frame += Math.sign(target - s.frame);
    s.at = now;
  }
  return s.frame;
}

/** By the door at (`dx`, `dy`), in tiles: on it, or on the step in front of it (diagonals too). */
export const byDoor = (x: number, y: number, dx: number, dy: number): boolean =>
  Math.abs(x - dx) <= 1.2 && y >= dy - 0.5 && y <= dy + 1.6;

/** Each map's doors, by tile (`dx * 1e6 + dy`). */
const swings = new Map<string, Map<number, Swing>>();

/**
 * This frame's swing for the door at (`dx`, `dy`), from where everyone in the room (and anyone just
 * leaving) is drawn this frame: `spots`, in tiles.
 */
export function doorSwing(
  dx: number,
  dy: number,
  now: number,
  spots: readonly { x: number; y: number }[],
): number {
  let doors = swings.get(world.map.id);
  if (!doors) {
    doors = new Map();
    swings.set(world.map.id, doors);
  }
  const key = dx * 1e6 + dy;
  let s = doors.get(key);
  if (!s) {
    s = shut();
    doors.set(key, s);
  }
  let near = false;
  for (const p of spots)
    if (byDoor(p.x, p.y, dx, dy)) {
      near = true;
      break;
    }
  return swingStep(s, near, now);
}

/** The door panel's width each frame, as it turns away from us on its hinge. */
const PANEL_W = [12, 8, 4, 2];
/**
 * The door (art/buildings `door`) sits in the middle of the sprite's bottom edge: 12 wide inside its
 * frame, from 17 pixels up to the stone step 2 up, which stays put.
 */
const DOOR_W = 12;
const DOOR_H = 15;
const DOOR_UP = 17;

const frames = new WeakMap<HTMLCanvasElement, HTMLCanvasElement[]>();

/** The doorway at frame `n`, cut from the building's own door, so a brand's door colour swings too. */
function doorFrame(sprite: HTMLCanvasElement, n: number): HTMLCanvasElement {
  const list = frames.get(sprite) ?? [];
  frames.set(sprite, list);
  const sx = sprite.width / 2 - DOOR_W / 2;
  const sy = sprite.height - DOOR_UP;
  list[n] ??= bake(DOOR_W, DOOR_H, (p) => {
    // The hall inside: dark at the top, lamplight on the floor.
    p.rect(0, 0, DOOR_W, DOOR_H, "#3a2c26");
    p.rect(0, 0, DOOR_W, 3, "#2a201c");
    p.rect(0, DOOR_H - 4, DOOR_W, 4, "#6e4f36");
    p.rect(0, DOOR_H - 4, DOOR_W, 1, "#8a6644");
    // A lamp hanging in the hall, and a peg with a coat on it.
    p.px(DOOR_W - 4, 0, C.ink);
    p.px(DOOR_W - 4, 1, C.ink);
    p.rect(DOOR_W - 5, 2, 3, 1, C.lamp);
    p.px(DOOR_W - 4, 3, "#c9a85a");
    p.rect(DOOR_W - 3, 6, 2, 4, C.rug);
    // The panel, squeezed toward the hinge, with its edge showing.
    const w = PANEL_W[n]!;
    p.g.imageSmoothingEnabled = false;
    p.g.drawImage(sprite, sx, sy, DOOR_W, DOOR_H, 0, 0, w, DOOR_H);
    p.rect(w, 0, 1, DOOR_H, C.ink);
    if (w > 2) p.rect(w - 1, 0, 1, DOOR_H, "rgba(20, 16, 28, 0.35)");
  });
  return list[n]!;
}

/** Draws the swing over a building sprite at (`left`, `top`); a shut door is the sprite's own. */
export function drawDoorSwing(
  g: CanvasRenderingContext2D,
  sprite: HTMLCanvasElement,
  left: number,
  top: number,
  frame: number,
): void {
  if (frame <= 0) return;
  const x = left + sprite.width / 2 - DOOR_W / 2;
  const y = top + sprite.height - DOOR_UP;
  g.drawImage(doorFrame(sprite, frame), x, y);
  const bottom = y + DOOR_UP - 1;
  // Light spilling out onto the step.
  g.fillStyle = `rgba(255, 226, 138, ${0.08 * frame})`;
  g.fillRect(x + 1, bottom, DOOR_W - 2, 1);
  g.fillRect(x + 3, bottom + 1, DOOR_W - 6, 1);
}
