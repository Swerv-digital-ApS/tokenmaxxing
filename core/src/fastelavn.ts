/**
 * Fastelavn, seven weeks before Easter (`holidays.ts`): all that Sunday a barrel hangs on the lawn under the
 * square, and everyone in town whacks it (E). It takes `HITS` whacks between them; whoever lands the last is
 * kattekonge, the cat king, and gets the crown (`costumes.ts`, never sold), and everyone who whacked it gets
 * their loot: a handful of coins, now and then a pair of cat ears. What each gets is fixed by the year and who
 * they are, so it can't be rolled again. The hits and the king are the server's (`server/src/town/fastelavn.ts`).
 */
import { COSTUME_BASE } from "./costumes.ts";
import { near } from "./holidays.ts";
import { worldWall } from "./range.ts";

/** The barrel's tile: on the lawn under the square, left of the picnic. Nobody walks into it while it hangs. */
export const BARREL = { x: 9, y: 10 } as const;

/** Whacks it takes, everyone's together. */
export const HITS = 60;

/** Between one player's whacks (ms). */
export const WHACK_MS = 600;

/** The kattekonge's crown, and the cat ears some of the loot holds (`headwear.ts`). */
export const CROWN = `hat.${COSTUME_BASE + 1}`;
export const CAT_EARS = "hat.10";
/** The kattekonge's coins, on top of their loot. */
export const KING_COINS = 50;

/** Whether the barrel hangs at `ms`: all of Fastelavn Sunday. */
export const barrelUp = (ms: number): boolean => near("fastelavn", ms, 0, 0);

/** The year a Fastelavn falls in: the key the hits and the king are kept under. */
export const fastelavnYear = (ms: number): number => worldWall(ms).y;

export const isBarrel = (x: number, y: number, ms: number): boolean =>
  x === BARREL.x && y === BARREL.y && barrelUp(ms);

/** The barrel as everyone sees it: how many whacks it has taken this year, and who broke it, if anyone has. */
export interface Barrel {
  year: number;
  hits: number;
  king: { id: number; name: string } | null;
}

/** How cracked it looks: 0 whole to 3 about to go. */
export const cracks = (hits: number): number => Math.min(3, Math.floor((hits / HITS) * 4));

/** A small stable hash of the year and a player, so the loot is the same however often it's asked. */
const hash = (year: number, userId: number): number =>
  Math.imul(Math.imul(year + 0x9e3779b9, 0x85ebca6b) ^ Math.imul(userId + 1, 0xc2b2ae35), 0x27d4eb2f) >>> 0;

/** What `userId` finds when the barrel breaks: 5 to 15 coins, and one time in five the cat ears. */
export function lootFor(year: number, userId: number): { coins: number; item: string | null } {
  const h = hash(year, userId);
  return { coins: 5 + (h % 11), item: (h >>> 8) % 5 === 0 ? CAT_EARS : null };
}
