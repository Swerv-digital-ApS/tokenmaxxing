import { expect, test } from "bun:test";
import { HEADLINES, headlines, type PaperFacts } from "../src/paper.ts";

const QUIET: PaperFacts = {
  day: "2026-10-20",
  tokens: 0,
  people: 0,
  burner: null,
  company: null,
  prs: 0,
  shipper: null,
  prompts: 0,
  model: null,
  pet: null,
  game: null,
};

const BUSY: PaperFacts = {
  ...QUIET,
  tokens: 9_300_000_000,
  people: 7,
  burner: { name: "ada", tokens: 4_100_000_000 },
  company: { name: "ACME", tokens: 6_000_000_000, members: 3 },
  prs: 23,
  shipper: { name: "bo", prs: 9 },
  prompts: 812,
  model: { name: "claude-opus-4-1", tokens: 5e9 },
  pet: { owner: "cy", pet: "Duck", place: "the Inn" },
  game: { name: "dee", game: "Hype Cycle", won: 140 },
};

test("a busy day leads with the biggest burner, filled in", () => {
  const front = headlines(BUSY);
  expect(front).toHaveLength(HEADLINES);
  expect(front[0]!.title).toContain("ada");
  expect(front[0]!.title).toMatch(/4\.1B/);
  for (const h of front) expect(`${h.title} ${h.deck}`).not.toMatch(/[{}]/);
});

test("the same day reads the same; another day can read differently", () => {
  expect(headlines(BUSY)).toEqual(headlines(BUSY));
  const days = Array.from({ length: 10 }, (_, i) => `2026-10-${String(i + 10).padStart(2, "0")}`);
  const fronts = new Set(days.map((day) => JSON.stringify(headlines({ ...BUSY, day }))));
  expect(fronts.size).toBeGreaterThan(1);
});

test("a quiet day still fills the front page, with no stories about nothing", () => {
  const front = headlines(QUIET);
  expect(front).toHaveLength(HEADLINES);
  expect(new Set(front.map((h) => h.title)).size).toBe(HEADLINES);
  expect(front.some((h) => h.title.includes("burns"))).toBe(false);
});

test("a pet sighting names its owner and the place", () => {
  const days = Array.from({ length: 20 }, (_, i) => `2026-11-${String(i + 1).padStart(2, "0")}`);
  const pets = days
    .flatMap((day) => headlines({ ...QUIET, day, pet: BUSY.pet }))
    .filter((h) => /Duck/.test(h.title));
  expect(pets.length).toBeGreaterThan(0);
  for (const h of pets) expect(`${h.title} ${h.deck}`).toMatch(/cy/);
  for (const h of pets) expect(`${h.title} ${h.deck}`).toMatch(/the Inn/);
});
