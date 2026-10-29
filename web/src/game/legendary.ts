import { LEGENDARY_LEVEL } from "@tokenmaxxing/core/milestones.ts";
import { AURA_X, AURA_Y, auraFrame, HALO_LIFT, petCrown } from "../art/aura.ts";
import { CA_X, CA_Y, caseAuraFrame } from "../art/case-aura.ts";
import type { Avatar } from "./world.ts";

/** The legendary level's glow and halo, behind a character drawn at (x, y). */
export function drawAura(g: CanvasRenderingContext2D, a: Avatar, x: number, y: number, now: number): void {
  if (a.info.level >= LEGENDARY_LEVEL) g.drawImage(auraFrame(now), x - AURA_X, y - AURA_Y);
  const worn = a.info.look.aura ? caseAuraFrame(a.info.look.aura, now) : null;
  if (worn) g.drawImage(worn, x - CA_X, y - CA_Y);
}

/** Their pet's crown, over a pet frame drawn at (x, y). */
export function drawPetCrown(
  g: CanvasRenderingContext2D,
  a: Avatar,
  x: number,
  y: number,
  left: boolean,
  hop: boolean,
): void {
  const crown = a.info.level >= LEGENDARY_LEVEL && petCrown(a.info.look.pet, left, hop);
  if (crown) g.drawImage(crown[0], x + crown[1], y + crown[2]);
}

/** World pixels to lift their name tag by, so it sits over the halo rather than on it. */
export const labelLift = (a: Avatar): number => (a.info.level >= LEGENDARY_LEVEL ? HALO_LIFT : 0);
