import { COP_ID, SIREN, TICKET_MARK } from "@tokenmaxxing/core/cop.ts";
import type { Pose } from "../art/characters.ts";
import { copFrame, drawSiren, drawSirenGlow } from "../art/cop.ts";
import type { Avatar } from "./world.ts";

/**
 * The 429 Cop on screen (`core/src/cop.ts`). The client only hears his lines, so it reads them: a
 * pull-over line (`SIREN` first) means he's chasing, until he writes the ticket (`TICKET_MARK`) or a
 * minute passes; while the ticket is over his head he stands writing it.
 */

const CHASE_MS = 60_000;
let chasingSince = 0;

export const isCop = (a: Avatar): boolean => a.info.id === COP_ID;

/** Draws him in place of `characterFrame`, at `top`, with his siren on when he's on a case. */
export function drawCop(
  g: CanvasRenderingContext2D,
  a: Avatar,
  pose: Pose,
  px: number,
  top: number,
  py: number,
  now: number,
): void {
  const line = a.bubble && a.bubble.until > now ? a.bubble.text : "";
  const writing = line.startsWith(SIREN) && line.includes(TICKET_MARK);
  if (line.startsWith(SIREN) && !writing) chasingSince = now;
  if (writing) chasingSince = 0;
  const scribble = writing && pose === "stand" ? ((Math.floor(now / 200) % 2) as 0 | 1) : null;
  const siren = writing || (chasingSince > 0 && now - chasingSince < CHASE_MS);
  if (siren) drawSirenGlow(g, px, py, now);
  g.drawImage(copFrame(a.facing, pose, scribble), px, top);
  if (siren) drawSiren(g, px, top, now);
}
