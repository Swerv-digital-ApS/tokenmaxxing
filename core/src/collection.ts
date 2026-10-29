/**
 * The collection log: everything there is to earn (badges, trophies, milestone titles) with how to
 * earn it, so the client greys out what's missing and the server only sends what someone has.
 * Also what can be pinned to a card's showcase.
 */
import { BADGES, FRAME_RARITY, type Frame, frameOf, type Group } from "./badges.ts";
import { MILESTONES } from "./milestones.ts";
import type { Rarity } from "./rarity.ts";
import { TROPHIES, type Trophy } from "./trophies.ts";

export type { Group };

/** The order the log's tabs come in. */
export const GROUPS: readonly Group[] = ["Usage", "Social", "Town", "Raid", "Games", "Fishing", "Seasonal"];

/** How many things a player may pin to their card. */
export const PIN_MAX = 3;

export interface CatalogEntry {
  /** Namespaced: `badge:shipper`, `trophy:3am`, `title:30`. This is also the pin's id. */
  id: string;
  kind: "badge" | "trophy" | "title";
  group: Group;
  name: string;
  how: string;
  /** The badge's tiers, lowest first. */
  tiers?: { at: number; label: string }[];
  pinnable: boolean;
}

/** Where each trophy goes in the log: a few are seasonal or town things, the rest usage. */
const TROPHY_GROUP: Record<string, Group> = {
  newyear: "Seasonal",
  holiday: "Seasonal",
  piday: "Seasonal",
  palindate: "Seasonal",
  storm: "Seasonal",
  hurricane: "Seasonal",
  leapday: "Seasonal",
  friday13: "Seasonal",
  halloween: "Seasonal",
};

export const CATALOG: readonly CatalogEntry[] = [
  ...BADGES.map((b): CatalogEntry => ({
    id: `badge:${b.id}`,
    kind: "badge",
    group: b.group,
    name: b.name,
    how: b.how,
    tiers: b.tiers,
    pinnable: true,
  })),
  ...TROPHIES.map((t): CatalogEntry => ({
    id: `trophy:${t.id}`,
    kind: "trophy",
    group: TROPHY_GROUP[t.id] ?? "Usage",
    name: t.name,
    how: t.how,
    pinnable: true,
  })),
  ...MILESTONES.map((m): CatalogEntry => ({
    id: `title:${m.level}`,
    kind: "title",
    group: "Town",
    name: m.title,
    how: `Reach level ${m.level}`,
    pinnable: false,
  })),
];

export const entryOf = (id: string): CatalogEntry | undefined => CATALOG.find((e) => e.id === id);

/** What the server knows of someone: compact, the client has the words. */
export interface CollectionState {
  userId: number;
  /** Every badge's standing, earned or not. `at` is when its current tier was awarded (null: before awards were kept). */
  badges: { id: string; tier: number; value: number; at: number | null }[];
  trophies: Trophy[];
  /** Milestone levels reached. */
  titles: number[];
}

/** A pin as the card stores it. `tier` only to show what it was when pinned. */
export interface Pin {
  id: string;
  tier?: number;
}

/** A pin as the card shows it. */
export interface PinView {
  id: string;
  kind: CatalogEntry["kind"];
  name: string;
  emoji: string | null;
  tier: number;
  frame: Frame | null;
  rarity: Rarity;
  at: number | null;
}

/** What someone owns of `id` (a catalogue id), or null if they don't have it. */
function viewOf(state: CollectionState, id: string): PinView | null {
  const e = entryOf(id);
  if (!e?.pinnable) return null;
  const key = id.slice(id.indexOf(":") + 1);
  if (e.kind === "badge") {
    const b = state.badges.find((x) => x.id === key);
    const def = BADGES.find((x) => x.id === key);
    if (!b || !def || b.tier < 1) return null;
    const frame = frameOf(b.tier, def.tiers.length);
    return {
      id,
      kind: "badge",
      name: `${def.name}: ${def.tiers[b.tier - 1]!.label}`,
      emoji: def.emoji,
      tier: b.tier,
      frame,
      rarity: FRAME_RARITY[frame],
      at: b.at,
    };
  }
  const t = state.trophies.find((x) => x.id === key);
  if (!t) return null;
  // A trophy is a dated one-off: the day it came, noon, as its time.
  return {
    id,
    kind: "trophy",
    name: e.name,
    emoji: null,
    tier: 1,
    frame: null,
    rarity: "epic",
    at: Date.parse(`${t.day}T12:00:00Z`),
  };
}

/** Everything someone owns that can be pinned, for the picker. */
export const ownedPins = (state: CollectionState): PinView[] =>
  CATALOG.flatMap((e) => viewOf(state, e.id) ?? []);

/**
 * A card's pins as shown: in order, at most `PIN_MAX`, each once; what isn't owned (a bad id, an
 * unearned badge) is dropped silently.
 */
export function resolvePins(state: CollectionState, pinned: readonly Pin[]): PinView[] {
  const seen = new Set<string>();
  const out: PinView[] = [];
  for (const p of pinned) {
    if (out.length >= PIN_MAX) break;
    if (seen.has(p.id)) continue;
    seen.add(p.id);
    const v = viewOf(state, p.id);
    if (v) out.push(v);
  }
  return out;
}

/** How many entries someone has, of how many in the log: badges at tier 1 or more, trophies and titles. */
export function owned(state: CollectionState): { have: number; of: number } {
  const have = state.badges.filter((b) => b.tier > 0).length + state.trophies.length + state.titles.length;
  return { have, of: CATALOG.length };
}

/** The titles reached at `level`, as milestone levels. */
export const titlesAt = (level: number): number[] =>
  MILESTONES.filter((m) => m.level <= level).map((m) => m.level);
