/**
 * How someone works with agents, from a month of habits. Pure, and nothing here looks at cost or raw
 * token volume: only how many agents, how long and how hands-on.
 */

export interface AgentFacts {
  /** Days with tokens, in the window. */
  activeDays: number;
  /** Hours with an agent running. */
  activeHours: number;
  /** Agents running at once, on average while any ran. */
  parallelism: number;
  peakAgents: number;
  /** Share of agent-buckets that were subagents, 0 to 1. */
  subShare: number;
  /** Assistant turns per prompt; null with no prompts. */
  turnsPerPrompt: number | null;
}

export interface AgentType {
  id: "apprentice" | "swarm" | "marathoner" | "delegator" | "pair" | "sprinter";
  label: string;
  blurb: string;
}

const TYPES: Record<AgentType["id"], AgentType> = {
  apprentice: { id: "apprentice", label: "Apprentice", blurb: "Still finding their feet." },
  swarm: { id: "swarm", label: "Swarm Commander", blurb: "Many agents at once." },
  marathoner: { id: "marathoner", label: "Marathoner", blurb: "Long days at the keyboard." },
  delegator: { id: "delegator", label: "Delegator", blurb: "One prompt, then off it goes." },
  pair: { id: "pair", label: "Pair Programmer", blurb: "Talks it through, step by step." },
  sprinter: { id: "sprinter", label: "Sprinter", blurb: "Short bursts, done fast." },
};

/** Thresholds, in the order the rules are tried. */
export const AGENT_RULES = {
  minDays: 5,
  minHours: 5,
  swarmParallel: 2.5,
  swarmSubShare: 0.35,
  marathonHoursPerDay: 5,
  delegatorTurns: 30,
  pairTurns: 8,
} as const;

/** The first rule that matches wins. */
export function agentTypeOf(f: AgentFacts): AgentType {
  const r = AGENT_RULES;
  if (f.activeDays < r.minDays || f.activeHours < r.minHours) return TYPES.apprentice;
  if (f.parallelism >= r.swarmParallel || f.subShare >= r.swarmSubShare) return TYPES.swarm;
  if (f.activeHours / f.activeDays >= r.marathonHoursPerDay) return TYPES.marathoner;
  if (f.turnsPerPrompt !== null && f.turnsPerPrompt >= r.delegatorTurns) return TYPES.delegator;
  if (f.turnsPerPrompt !== null && f.turnsPerPrompt <= r.pairTurns) return TYPES.pair;
  return TYPES.sprinter;
}

export interface WorkHours {
  id: "owl" | "lark" | "day";
  label: string;
}

/**
 * When someone works, from 24 counts of active buckets by world hour: half or more from 22:00 to
 * 05:00 is a night owl, half or more from 05:00 to 09:00 an early bird, else the day shift.
 * Null with nothing counted.
 */
export function workHours(hours: readonly number[]): WorkHours | null {
  const total = hours.reduce((n, h) => n + h, 0);
  if (total <= 0) return null;
  const sum = (from: number, to: number) => hours.slice(from, to).reduce((n, h) => n + h, 0);
  const night = sum(22, 24) + sum(0, 5);
  if (night * 2 >= total) return { id: "owl", label: "Night owl" };
  if (sum(5, 9) * 2 >= total) return { id: "lark", label: "Early bird" };
  return { id: "day", label: "Day shift" };
}
