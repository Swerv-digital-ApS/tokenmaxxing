/**
 * Turns daily rollups into totals and rankings. Pure, so it's tested without
 * Rivet; the `town` actor feeds it rows straight from SQLite.
 */
import { isOneOf, sumBy } from "hanzio";
import { computeRowCostUsd, type PricingCache, roundUsd } from "./pricing.ts";

/** One model's sums for one user and day (or range, once summed). */
export interface UsageRow {
  model: string;
  input: number;
  output: number;
  cacheCreation: number;
  cacheRead: number;
  turns: number;
  reportedCostCents?: number;
}

export interface ActivityRow {
  prompts: number;
  prs: number;
  /** Σ over 5-minute buckets of agents running in that bucket. */
  agentBuckets: number;
  /** 5-minute buckets with at least one agent running. */
  activeBuckets: number;
  peakAgents: number;
}

export type SortKey = "tokens" | "cost" | "hours" | "parallelism" | "prs";
const SORT_KEYS: readonly SortKey[] = ["tokens", "cost", "hours", "parallelism", "prs"];
export const isSortKey = (v: unknown): v is SortKey => isOneOf(SORT_KEYS, v);

/** Below this, parallelism is null so one short burst can't top the board. */
const MIN_ACTIVE_HOURS = 1;
/** Agents are counted per 5-minute bucket (parallelism and agent hours). */
export const AGENT_BUCKET_MS = 5 * 60_000;
const BUCKET_HOURS = AGENT_BUCKET_MS / 3_600_000;

export interface Totals {
  tokens: number;
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
  costUsd: number;
  /** Assistant turns. */
  turns: number;
  /** Human prompts. */
  prompts: number;
  /** Pull requests created (from `gh`). */
  prs: number;
  /** Average number of agents running at once while any was running. */
  parallelism: number | null;
  peakAgents: number;
  /** Agent hours: time with at least one agent running (a company: its members' hours added up). */
  activeHours: number;
  tokensPerActiveHour: number | null;
  topModel: string | null;
}

export const rowTokens = (r: UsageRow): number => r.input + r.output + r.cacheCreation + r.cacheRead;

export const rowCost = (pricing: PricingCache, r: UsageRow): number => {
  const price = pricing.lookup(r.model);
  return price ? computeRowCostUsd(r, price) : (r.reportedCostCents ?? 0) / 100;
};

/** `usage` holds one row per model; `activity` is already summed over the range. */
export function totals(
  pricing: PricingCache,
  usage: readonly UsageRow[],
  activity: ActivityRow | null,
): Totals {
  const t: Totals = {
    tokens: 0,
    inputTokens: 0,
    outputTokens: 0,
    cacheCreationTokens: 0,
    cacheReadTokens: 0,
    costUsd: 0,
    turns: 0,
    prompts: activity?.prompts ?? 0,
    prs: activity?.prs ?? 0,
    parallelism: null,
    peakAgents: activity?.peakAgents ?? 0,
    activeHours: 0,
    tokensPerActiveHour: null,
    topModel: null,
  };
  let top = -1;
  for (const r of usage) {
    const tokens = rowTokens(r);
    t.tokens += tokens;
    t.inputTokens += r.input;
    t.outputTokens += r.output;
    t.cacheCreationTokens += r.cacheCreation;
    t.cacheReadTokens += r.cacheRead;
    t.costUsd += rowCost(pricing, r);
    t.turns += r.turns;
    if (tokens > top) {
      top = tokens;
      t.topModel = r.model;
    }
  }
  t.costUsd = roundUsd(t.costUsd);
  if (activity && activity.activeBuckets > 0) {
    const hours = activity.activeBuckets * BUCKET_HOURS;
    t.activeHours = Math.round(hours * 100) / 100;
    if (hours >= MIN_ACTIVE_HOURS) {
      t.parallelism = Math.round((activity.agentBuckets / activity.activeBuckets) * 100) / 100;
      t.tokensPerActiveHour = Math.round(t.tokens / hours);
    }
  }
  return t;
}

const SORTS: Record<SortKey, (a: Totals, b: Totals) => number> = {
  tokens: (a, b) => b.tokens - a.tokens,
  cost: (a, b) => b.costUsd - a.costUsd || b.tokens - a.tokens,
  hours: (a, b) => b.activeHours - a.activeHours || b.tokens - a.tokens,
  parallelism: (a, b) => (b.parallelism ?? -1) - (a.parallelism ?? -1) || b.tokens - a.tokens,
  prs: (a, b) => b.prs - a.prs || b.tokens - a.tokens,
};

/** Sorted by `sort`, ties by name, with 1-based ranks. */
export function rank<T extends Totals & { name: string }>(
  rows: T[],
  sort: SortKey,
): (T & { rank: number })[] {
  return [...rows]
    .sort((a, b) => SORTS[sort](a, b) || a.name.localeCompare(b.name))
    .map((r, i) => ({ ...r, rank: i + 1 }));
}

/** A company's totals: its members' summed, with parallelism as agents running at once across the company. */
export function companyTotals(members: readonly Totals[]): Totals {
  const running = members.filter((t) => t.parallelism !== null);
  const tokens = sumBy(members, "tokens");
  const activeHours = Math.round(sumBy(members, "activeHours") * 100) / 100;
  return {
    tokens,
    inputTokens: sumBy(members, "inputTokens"),
    outputTokens: sumBy(members, "outputTokens"),
    cacheCreationTokens: sumBy(members, "cacheCreationTokens"),
    cacheReadTokens: sumBy(members, "cacheReadTokens"),
    costUsd: roundUsd(sumBy(members, "costUsd")),
    turns: sumBy(members, "turns"),
    prompts: sumBy(members, "prompts"),
    prs: sumBy(members, "prs"),
    parallelism: running.length ? Math.round(sumBy(members, "parallelism") * 100) / 100 : null,
    peakAgents: sumBy(members, "peakAgents"),
    activeHours,
    tokensPerActiveHour: activeHours >= MIN_ACTIVE_HOURS ? Math.round(tokens / activeHours) : null,
    topModel: null,
  };
}
