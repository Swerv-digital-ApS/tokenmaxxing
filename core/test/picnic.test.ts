import { describe, expect, test } from "bun:test";
import { badgesFor } from "../src/badges.ts";
import { townMap } from "../src/maps.ts";
import {
  BASKET,
  BLANKETS,
  bannerFor,
  forcedOutage,
  isDown,
  nextOutage,
  onBlanket,
  PICNIC_SEATS,
  sameOutage,
} from "../src/picnic.ts";

/** A Statuspage `summary.json`, cut down to what we read. */
const summary = (indicator: string, components: [string, string][] = []) => ({
  page: { id: "x", name: "Claude" },
  status: { indicator, description: "…" },
  components: components.map(([name, status]) => ({ name, status })),
});

describe("isDown", () => {
  test("a major or critical indicator is an outage", () => {
    expect(isDown(summary("major"))).toBe(true);
    expect(isDown(summary("critical"))).toBe(true);
  });

  test("all clear, maintenance and degraded performance are not", () => {
    expect(isDown(summary("none", [["Claude API (api.anthropic.com)", "operational"]]))).toBe(false);
    expect(isDown(summary("maintenance"))).toBe(false);
    expect(isDown(summary("minor", [["Claude Code", "degraded_performance"]]))).toBe(false);
  });

  test("a partial outage of something agents need is, even under a minor indicator", () => {
    expect(isDown(summary("minor", [["Claude API (api.anthropic.com)", "partial_outage"]]))).toBe(true);
    expect(isDown(summary("minor", [["Claude Code", "major_outage"]]))).toBe(true);
    expect(isDown(summary("minor", [["Codex in ChatGPT Desktop", "partial_outage"]]))).toBe(true);
    expect(isDown(summary("minor", [["Chat Completions", "partial_outage"]]))).toBe(true);
  });

  test("a side component going down is not", () => {
    expect(isDown(summary("minor", [["Fine-tuning", "major_outage"]]))).toBe(false);
    expect(isDown(summary("minor", [["Voice mode", "partial_outage"]]))).toBe(false);
  });

  test("the plain status.json (no components) works too", () => {
    expect(isDown({ status: { indicator: "major" } })).toBe(true);
    expect(isDown({ status: { indicator: "minor" } })).toBe(false);
  });

  test("anything that isn't a summary is unreadable, not fine", () => {
    for (const v of [null, undefined, "<html>", {}, { status: {} }, { status: { indicator: 3 } }])
      expect(isDown(v)).toBeNull();
  });
});

describe("nextOutage", () => {
  test("starts, keeps its start while anyone is down, and ends", () => {
    const first = nextOutage(null, { Claude: true, OpenAI: false }, 1000);
    expect(first).toEqual({ down: ["Claude"], since: 1000 });
    // OpenAI goes down too: the same picnic.
    expect(nextOutage(first, { Claude: true, OpenAI: true }, 2000)).toEqual({
      down: ["Claude", "OpenAI"],
      since: 1000,
    });
    expect(nextOutage(first, { Claude: false, OpenAI: false }, 3000)).toBeNull();
  });

  test("a page that can't be read keeps what it said last", () => {
    const down = { down: ["Claude" as const], since: 1000 };
    expect(nextOutage(down, { Claude: null, OpenAI: false }, 2000)).toEqual(down);
    expect(nextOutage(null, { OpenAI: null }, 2000)).toBeNull();
  });

  test("sameOutage compares who and which", () => {
    const a = { down: ["Claude" as const], since: 1 };
    expect(sameOutage(a, { ...a })).toBe(true);
    expect(sameOutage(a, { ...a, since: 2 })).toBe(false);
    expect(sameOutage(a, null)).toBe(false);
    expect(sameOutage(null, null)).toBe(true);
  });
});

test("forcing: claude, openai, both, off, and anything else isn't forced", () => {
  expect(forcedOutage("claude", 5)).toEqual({ down: ["Claude"], since: 5 });
  expect(forcedOutage(" OpenAI ", 5)?.down).toEqual(["OpenAI"]);
  expect(forcedOutage("both", 5)?.down).toEqual(["Claude", "OpenAI"]);
  expect(forcedOutage("off", 5)).toBeNull();
  for (const v of [undefined, null, "", "yes"]) expect(forcedOutage(v, 5)).toBeUndefined();
});

test("the banner", () => {
  expect(bannerFor({ down: ["Claude"], since: 0 })).toBe("Claude is down. Touch grass.");
  expect(bannerFor({ down: ["Claude", "OpenAI"], since: 0 })).toBe(
    "Claude and OpenAI are down. Touch grass.",
  );
});

test("blankets, seats and basket lie on open grass, in a town of any size", () => {
  for (const town of [townMap([]), townMap([0, 1, 2, 3])]) {
    for (const b of BLANKETS)
      for (let y = b.y; y < b.y + b.h; y++)
        for (let x = b.x; x < b.x + b.w; x++) expect(town.at(x, y)).toBe(".");
    expect(town.at(...BASKET)).toBe(".");
  }
  for (const [x, y] of PICNIC_SEATS) expect(onBlanket(x, y)).toBe(true);
  expect(new Set(PICNIC_SEATS.map(String)).size).toBe(PICNIC_SEATS.length);
  expect(onBlanket(...BASKET)).toBe(false);
});

test("the badge: I was there, then five", () => {
  const facts = {
    streak: 0,
    bestDay: 0,
    podiums: 0,
    peakAgents: 0,
    prs: 0,
    wins: 0,
    biggestPot: 0,
    founder: false,
  };
  expect(badgesFor(facts)).toEqual([]);
  expect(badgesFor({ ...facts, picnics: 1 }).map((b) => [b.id, b.label, b.tier])).toEqual([
    ["picnic", "I was there", 1],
  ]);
  expect(badgesFor({ ...facts, picnics: 6 })[0]?.label).toBe("5 outage picnics");
});
