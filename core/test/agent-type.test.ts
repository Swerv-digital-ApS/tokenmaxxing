import { describe, expect, test } from "bun:test";
import { type AgentFacts, agentTypeOf, workHours } from "../src/agentType.ts";
import { badgeStates } from "../src/badges.ts";
import { mondayOf } from "../src/regulars.ts";
import { isTavernRoom } from "../src/tavern.ts";

const base: AgentFacts = {
  activeDays: 20,
  activeHours: 40,
  parallelism: 1.5,
  peakAgents: 3,
  subShare: 0.1,
  turnsPerPrompt: 15,
};
const id = (f: Partial<AgentFacts>) => agentTypeOf({ ...base, ...f }).id;

describe("agent types", () => {
  test("the fallback is the sprinter", () => expect(id({})).toBe("sprinter"));

  test("apprentice: under 5 active days or 5 active hours", () => {
    expect(id({ activeDays: 4 })).toBe("apprentice");
    expect(id({ activeDays: 5, activeHours: 20 })).toBe("sprinter");
    expect(id({ activeHours: 4.9 })).toBe("apprentice");
    expect(id({ activeHours: 5 })).not.toBe("apprentice");
    // It beats every later rule.
    expect(id({ activeDays: 1, parallelism: 9 })).toBe("apprentice");
  });

  test("swarm commander: 2.5 agents at once or 35% subagents", () => {
    expect(id({ parallelism: 2.49 })).toBe("sprinter");
    expect(id({ parallelism: 2.5 })).toBe("swarm");
    expect(id({ subShare: 0.34 })).toBe("sprinter");
    expect(id({ subShare: 0.35 })).toBe("swarm");
    expect(id({ parallelism: 3, activeHours: 200 })).toBe("swarm");
  });

  test("marathoner: 5 active hours a day", () => {
    expect(id({ activeDays: 10, activeHours: 49 })).toBe("sprinter");
    expect(id({ activeDays: 10, activeHours: 50 })).toBe("marathoner");
  });

  test("delegator at 30 turns a prompt, pair programmer at 8", () => {
    expect(id({ turnsPerPrompt: 29.9 })).toBe("sprinter");
    expect(id({ turnsPerPrompt: 30 })).toBe("delegator");
    expect(id({ turnsPerPrompt: 8.1 })).toBe("sprinter");
    expect(id({ turnsPerPrompt: 8 })).toBe("pair");
    // No prompts: neither.
    expect(id({ turnsPerPrompt: null })).toBe("sprinter");
  });

  test("no rule looks at anything but the facts' habits", () => {
    expect(Object.keys(base).sort()).toEqual(
      ["activeDays", "activeHours", "parallelism", "peakAgents", "subShare", "turnsPerPrompt"].sort(),
    );
  });
});

describe("work hours", () => {
  const at = (...pairs: [number, number][]) => {
    const h = Array<number>(24).fill(0);
    for (const [hour, n] of pairs) h[hour] = n;
    return h;
  };

  test("nothing counted is nothing", () => expect(workHours(Array(24).fill(0))).toBeNull());

  test("owl: half or more from 22:00 to 05:00", () => {
    expect(workHours(at([22, 5], [12, 5]))?.id).toBe("owl");
    expect(workHours(at([4, 5], [12, 6]))?.id).toBe("day");
    expect(workHours(at([5, 5], [4, 5]))?.id).toBe("owl");
    expect(workHours(at([21, 10]))?.id).toBe("day");
  });

  test("lark: half or more from 05:00 to 09:00", () => {
    expect(workHours(at([5, 5], [12, 5]))?.id).toBe("lark");
    expect(workHours(at([8, 5], [9, 6]))?.id).toBe("day");
    expect(workHours(at([9, 10]))?.id).toBe("day");
  });
});

test("mondayOf starts the week on Monday", () => {
  expect(mondayOf("2026-10-19")).toBe("2026-10-19");
  expect(mondayOf("2026-10-22")).toBe("2026-10-19");
  expect(mondayOf("2026-10-25")).toBe("2026-10-19");
  expect(mondayOf("2026-10-26")).toBe("2026-10-26");
  expect(mondayOf("2026-01-01")).toBe("2025-12-29");
});

test("the basement counts as the Tavern, the town doesn't", () => {
  expect(isTavernRoom("inn")).toBe(true);
  expect(isTavernRoom("basement")).toBe(true);
  expect(isTavernRoom("town")).toBe(false);
  expect(isTavernRoom("office:3")).toBe(false);
});

test("the Tavern and Helper badges climb their tiers", () => {
  const f = {
    streak: 0,
    bestDay: 0,
    podiums: 0,
    peakAgents: 0,
    prs: 0,
    wins: 0,
    biggestPot: 0,
    founder: false,
  };
  const tier = (badge: string, facts: object) =>
    badgeStates({ ...f, ...facts }).find((b) => b.id === badge)!.tier;
  expect(tier("tavern", { tavernDays: 6 })).toBe(0);
  expect(tier("tavern", { tavernDays: 7 })).toBe(1);
  expect(tier("tavern", { tavernDays: 100 })).toBe(3);
  expect(tier("helper", { helped: 1 })).toBe(1);
  expect(tier("helper", { helped: 10 })).toBe(2);
  expect(tier("helper", { helped: 50 })).toBe(3);
});
