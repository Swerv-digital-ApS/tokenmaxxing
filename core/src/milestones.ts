/**
 * Every tenth level is a milestone, a bigger moment than the levels between: a title for the
 * player card, coins, and the level-reward items in `shop.ts` with that level. The top one,
 * `LEGENDARY_LEVEL`, also lights a golden aura around you and a crown on your pet, drawn from the
 * level alone. Nothing here is stored: coins are worked out from the level like the rest of the
 * wallet, so someone who passed a milestone before it paid gets theirs on their next wallet.
 */
import { sumBy } from "hanzio";
import { MAX_LEVEL } from "./format.ts";
import { ITEMS, type Item } from "./shop.ts";

export interface Milestone {
  level: number;
  /** Shown under your level from here on, until the next milestone replaces it. */
  title: string;
  coins: number;
  /** What comes besides the items, for the toast and the card. */
  perks?: string;
}

export const LEGENDARY_LEVEL = MAX_LEVEL;

export const MILESTONES: readonly Milestone[] = [
  { level: 10, title: "Dapper Prompter", coins: 100 },
  { level: 20, title: "Rack Knight", coins: 250 },
  { level: 30, title: "Orbkeeper", coins: 500 },
  { level: 40, title: "Starwalker", coins: 1000 },
  {
    level: LEGENDARY_LEVEL,
    title: "Golden Legend",
    coins: 2500,
    perks: "a golden aura and a crown for your pet",
  },
];

/** Every milestone's coins up to `level`, once each. */
export const milestoneCoins = (level: number): number =>
  sumBy(MILESTONES, (m) => (m.level <= level ? m.coins : 0));

/** The title of the last milestone reached, or null before the first. */
export const milestoneTitle = (level: number): string | null =>
  MILESTONES.findLast((m) => m.level <= level)?.title ?? null;

export const nextMilestone = (level: number): Milestone | undefined =>
  MILESTONES.find((m) => m.level > level);

/** The milestones passed going up from `from` to `to`: a big sync can pass more than one. */
export const milestonesBetween = (from: number, to: number): Milestone[] =>
  MILESTONES.filter((m) => m.level > from && m.level <= to);

export const milestoneItems = (m: Milestone): Item[] => ITEMS.filter((i) => i.level === m.level);

/** "Nebula visor, 🪙 1000 and the Starwalker title", for the card and the toast. */
export function milestoneText(m: Milestone): string {
  const parts = [...milestoneItems(m).map((i) => i.name), ...(m.perks ? [m.perks] : []), `🪙 ${m.coins}`];
  return `${parts.join(", ")} and the ${m.title} title`;
}
