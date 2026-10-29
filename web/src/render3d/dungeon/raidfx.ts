import { countdown } from "@tokenmaxxing/core/format.ts";
import type { RungBoss } from "@tokenmaxxing/core/raid.ts";
import type { Raid } from "@tokenmaxxing/server/registry";

/**
 * The raid as the 3D dungeon and the town's gate show it: pure rules over the server's raid state (`Raid`), the
 * same numbers the 2D game uses (`game/raid.ts`), so a hit, a kill or a shut gate reads the same in either.
 */

/** HP left on the current rung. */
export const hpLeft = (r: Pick<Raid, "hp" | "damage">): number => Math.max(0, r.hp - r.damage);

/** Missiles a second from a laptop burning `burn` tokens a minute: 1 at 100k, ~3 at 1M, at most 6. */
export const fireRate = (burn: number): number => (burn > 0 ? Math.min(6, Math.sqrt(burn / 1e5)) : 0);
/** Agents running with nothing synced lately: the odd sputter. */
export const SPUTTER = 0.08;

/** A raider's missiles a second: a closed week fires none; a quiet laptop only sputters. */
export const raiderRate = (burn: number, closed: boolean): number => (closed ? 0 : fireRate(burn) || SPUTTER);

/** Nobody fires: the gate isn't open yet, the week is over, or the whole ladder has fallen. */
export const resting = (r: Pick<Raid, "prelaunch" | "closed"> & { cleared?: boolean }): boolean =>
  r.prelaunch || r.closed || r.cleared === true;

/** Where a raider's body sits: the height of the chair's seat, in the war desks' rows. */
export const RAID_SEAT_Y = 0.33;

/** Your pet fires a quarter as fast as you, at least one every five seconds, and sputters when you do. */
export const petRate = (burn: number, rate: number): number =>
  rate && (fireRate(burn) ? Math.max(0.2, rate / 4) : rate / 2);

/** A minion fires a third as fast as its raider, and sputters when its raider does. */
export const minionRate = (burn: number, rate: number): number =>
  rate && (fireRate(burn) ? Math.max(0.25, rate / 3) : rate / 2);

/** Shots due after `dtMs` at `rate` a second, given the fraction already `owed`: whole shots fired, the rest carried. */
export function owedShots(owed: number, rate: number, dtMs: number): { owed: number; shots: number } {
  if (rate <= 0) return { owed, shots: 0 };
  let o = owed + (rate * dtMs) / 1000;
  const shots = Math.floor(o);
  o -= shots;
  return { owed: o, shots };
}

/** What a hit on the raid boss between two polls looks like. */
export interface RaidEvents {
  /** The gate's boards burst off (the first raid launched). */
  launch: boolean;
  /** The boss that fell since `before`, if one did. */
  kill: RungBoss | null;
  /** Damage that landed, and how much of it was the viewer's. */
  hit: number;
  mine: number;
}

/** What `after` did since `before`, as the 2D game's `noteRaid` reads it. */
export function raidEvents(before: Raid | null, after: Raid): RaidEvents {
  const none: RaidEvents = { launch: false, kill: null, hit: 0, mine: 0 };
  if (before?.prelaunch && !after.prelaunch) return { ...none, launch: true };
  if (!before || before.week !== after.week) return none;
  const kill = after.kills.slice(before.kills.length).at(-1)?.boss ?? null;
  const hit = Math.max(0, after.totalDamage - before.totalDamage);
  const mine = hit > 0 ? Math.max(0, (after.me?.damage ?? 0) - (before.me?.damage ?? 0)) : 0;
  return { launch: false, kill, hit, mine };
}

/** How many minions to draw for a raider with `agents` running: the first agent is them. */
export const minionsOf = (agents: number, perRaider: number): number =>
  Math.max(0, Math.min(perRaider, agents - 1));

/** What the dungeon draws at once, by how much the machine can take (the raid is the busiest room in the game). */
export interface Caps {
  /** Raiders drawn as people at their desks (the rest keep the glowing laptop). */
  people: number;
  /** Minions per raider, and in all. */
  minions: number;
  minionsTotal: number;
  /** Missiles in flight. */
  missiles: number;
  sparks: number;
}

export const CAPS: Record<"lean" | "full", Caps> = {
  lean: { people: 14, minions: 2, minionsTotal: 24, missiles: 28, sparks: 40 },
  full: { people: 40, minions: 4, minionsTotal: 100, missiles: 80, sparks: 120 },
};

/** The raiders to draw as people, the busiest first, never more than `cap`. */
export function peopleShown<T extends { id: number; burn: number }>(raiders: readonly T[], cap: number): T[] {
  if (raiders.length <= cap) return [...raiders];
  return [...raiders].sort((a, b) => b.burn - a.burn || a.id - b.id).slice(0, cap);
}

/** The gate in town: open, boarded up before the first raid, or shut (a portcullis) till the week opens. */
export type GateState = "open" | "boarded" | "shut";

export function gateState(r: Pick<Raid, "prelaunch" | "closed"> | null): GateState {
  if (!r) return "open";
  if (r.prelaunch) return "boarded";
  return r.closed ? "shut" : "open";
}

/** "08:00": when a closed week's next ladder opens. */
const opensAt = (r: Pick<Raid, "rules">): string => `${String(r.rules.opensHour).padStart(2, "0")}:00`;

/** The words over the gate (the 2D game's), or null when there is no raid yet. */
export function gateText(r: Raid | null, now = Date.now()): string | null {
  if (!r) return null;
  if (r.prelaunch)
    return now < r.launchAt ? `⚠️ Something is coming… ${countdown(r.launchAt)}` : "⚔️ The gate is opening…";
  if (r.closed) return `⚔️ Raid Dungeon · shut · opens ${opensAt(r)}`;
  if (r.cleared) return `⚔️ Raid Dungeon · cleared · back Monday ${opensAt(r)}`;
  const pct = r.hp > 0 ? Math.ceil((hpLeft(r) / r.hp) * 100) : 0;
  return `⚔️ Raid Dungeon · ${r.boss.emoji} ${r.boss.name} · rung ${r.boss.rung} · ${pct}%`;
}

/** The boss plate's line when the week is over (the 2D game's), else null. */
export function weekOverText(
  r: Pick<Raid, "closed" | "kills" | "rules"> & { cleared?: boolean },
): string | null {
  return r.closed || r.cleared
    ? `🏁 ${r.cleared ? "Ladder cleared" : "Week over"} · ${r.kills.length} fell · opens ${opensAt(r)} Mon`
    : null;
}

/** Where an item flies from and to, as a share of the fall: the loot's beam is `POP` of the way, the flight after. */
export const LOOT_POP_S = 0.7;
export const LOOT_FLY_S = 1.1;
export const LOOT_LAND_S = 1.4;
/** After the news, while the boss slumps: then the loot comes out; one after another. */
export const LOOT_DELAY_S = 1.3;
export const LOOT_STAGGER_S = 0.35;

/** The rarity beam's width in world units: wider for rarer drops. */
export const beamWidth = (rank: number): number => 0.05 + rank * 0.03;

/** A quadratic bezier along a missile's arc, `t` of the way (0 to 1). */
export function arc(from: number, control: number, to: number, t: number): number {
  const u = 1 - t;
  return u * u * from + 2 * u * t * control + t * t * to;
}
