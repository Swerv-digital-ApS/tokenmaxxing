/**
 * Fastelavn in 2D (`core/src/fastelavn.ts`): on Fastelavn Sunday the barrel hangs from its frame on the lawn
 * under the square, cracking as the town whacks it (the hits are `world`'s `barrel`), and E on it is a whack.
 * Once it breaks its staves lie on the grass under a sign naming the kattekonge. On the server's clock, since
 * the server decides. The 3D barrel is `render3d/town/barrel3d.ts`, from the same state.
 */
import { BARREL, barrelUp, cracks, HITS, isBarrel } from "@tokenmaxxing/core/fastelavn.ts";
import type { Facing, StepResult } from "@tokenmaxxing/core/world.ts";
import { TILE } from "@tokenmaxxing/core/world.ts";
import { BARREL_AT, barrelSprite, brokenSprite, FRAME_PX, frameSprite } from "../art/fastelavn.ts";
import { conn } from "../net.ts";
import { hud } from "../store.ts";
import { type Frame, inView } from "./frame.ts";
import { sign } from "./labels.ts";
import { serverNow, world } from "./world.ts";

/** What the sign over it says: whacks to go, or the king. */
export function barrelSign(): string {
  const b = hud.get().barrel;
  if (b?.king) return `🐱 Kattekonge: ${b.king.name}`;
  return `🪅 Fastelavn barrel · ${HITS - (b?.hits ?? 0)} whacks to go`;
}

/** Whether the barrel is up now, in town. */
export const barrelNow = (): boolean => world.room === "town" && barrelUp(serverNow());

export function drawBarrel(f: Frame): void {
  if (!barrelNow()) return;
  const left = (BARREL.x - 1) * TILE;
  const bottom = (BARREL.y + 1) * TILE;
  const top = bottom - FRAME_PX.h;
  if (!inView(f, left, top, FRAME_PX.w, FRAME_PX.h, TILE)) return;
  const b = hud.get().barrel;
  const frame = frameSprite();
  f.items.push({ y: bottom - 1, draw: () => f.g.drawImage(frame, left, top) });
  if (b?.king) {
    const rest = brokenSprite();
    f.items.push({ y: bottom - 2, draw: () => f.g.drawImage(rest, left + 14, bottom - rest.height - 1) });
  } else {
    // A whack swings it a little: a pixel either way, off the hits so far.
    const swing = (b?.hits ?? 0) % 3 === 1 ? 1 : (b?.hits ?? 0) % 3 === 2 ? -1 : 0;
    const s = barrelSprite(cracks(b?.hits ?? 0));
    f.items.push({
      y: bottom - 1,
      draw: () => f.g.drawImage(s, left + BARREL_AT.x + swing, top + BARREL_AT.y),
    });
  }
  const [sx, sy] = f.toScreen(left + FRAME_PX.w / 2, top);
  f.labels.push(() => sign(f.g, sx, sy - 4 * f.dpr, barrelSign(), f.dpr, !!b?.king));
}

/** The barrel's tile on its day: a step onto it is no step. */
export const blocksBarrel = (x: number, y: number): boolean =>
  world.room === "town" && isBarrel(x, y, serverNow());

/** E facing the barrel: a whack. False when it isn't there. */
export function barrelInteract(
  me: { x: number; y: number; facing: Facing },
  x: number,
  y: number,
  send: (r: Promise<StepResult>) => void,
): boolean {
  if (!blocksBarrel(x, y)) return false;
  send(conn.whack(me.facing));
  return true;
}
