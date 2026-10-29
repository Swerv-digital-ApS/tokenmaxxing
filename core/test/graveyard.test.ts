import { expect, test } from "bun:test";
import {
  epitaphOf,
  forcedStones,
  GRACE_MS,
  GRAVES,
  type Plot,
  sameStones,
  stoneAt,
  stoneFaced,
  stoneInFront,
  stonesOf,
  tend,
  withChanges,
} from "../src/graveyard.ts";
import type { PoolModel } from "../src/launch.ts";
import { poolModels } from "../src/launch.ts";
import { MAPS } from "../src/maps.ts";

const DAY = 24 * 3_600_000;
const now = Date.UTC(2026, 9, 27, 10);
const PRICE = { input: 10, output: 30, cache: null };

const model = (id: string, at = Date.UTC(2024, 3, 9)): PoolModel => ({
  provider: "codex",
  name: id.split("/")[1]!,
  id: `openai/${id.split("/")[1]}`,
  price: PRICE,
  description: "",
  at,
});

/** The plots after reading `pool` at each of `at`, starting from `plots`. */
function read(plots: Plot[], pool: PoolModel[], ...at: number[]): Plot[] {
  for (const t of at) plots = withChanges(plots, tend(plots, pool, t));
  return plots;
}

const ALL = ["openai/gpt-4-turbo", "openai/gpt-5", "openai/gpt-6"].map((id) => model(id));
const LESS = ALL.filter((m) => m.id !== "openai/gpt-4-turbo");

test("the first read sees what's listed and buries nothing, however much was gone before", () => {
  const plots = read([], LESS, now);
  expect(plots.map((p) => p.id).sort()).toEqual(["openai/gpt-5", "openai/gpt-6"]);
  expect(plots.every((p) => p.gone === null && p.buried === null)).toBe(true);
  expect(stonesOf(plots)).toEqual([]);
  // Nothing new to write when the list hasn't changed.
  expect(tend(plots, LESS, now + 600_000)).toEqual([]);
});

test("a model gone from every read for the grace period is buried, dated from its listing to when it went", () => {
  let plots = read([], ALL, now - DAY);
  plots = read(plots, LESS, now, now + DAY, now + GRACE_MS - 1);
  expect(stonesOf(plots)).toEqual([]);
  expect(plots.find((p) => p.id === "openai/gpt-4-turbo")?.gone).toBe(now);
  plots = read(plots, LESS, now + GRACE_MS);
  const [stone] = stonesOf(plots);
  expect(stone).toMatchObject({
    id: "openai/gpt-4-turbo",
    model: "gpt-4-turbo",
    provider: "codex",
    listed: Date.UTC(2024, 3, 9),
    gone: now,
    buried: now + GRACE_MS,
    price: PRICE,
    plot: 0,
  });
  // Buried is buried: more reads without it change nothing.
  expect(tend(plots, LESS, now + 2 * GRACE_MS)).toEqual([]);
});

test("a model that blips off the list and back isn't buried, and its grace starts again", () => {
  let plots = read([], ALL, now);
  plots = read(plots, LESS, now + DAY, now + 2 * DAY);
  plots = read(plots, ALL, now + 2.5 * DAY);
  expect(plots.every((p) => p.gone === null)).toBe(true);
  plots = read(plots, LESS, now + 3 * DAY, now + 5.5 * DAY);
  expect(stonesOf(plots)).toEqual([]);
  expect(stonesOf(read(plots, LESS, now + 6 * DAY))).toHaveLength(1);
});

test("one that comes back from the dead is dug up", () => {
  let plots = read([], ALL, now);
  plots = read(plots, LESS, now + DAY, now + DAY + GRACE_MS);
  expect(stonesOf(plots)).toHaveLength(1);
  plots = read(plots, ALL, now + 10 * DAY);
  expect(stonesOf(plots)).toEqual([]);
  expect(plots.find((p) => p.id === "openai/gpt-4-turbo")).toMatchObject({ gone: null, buried: null });
});

test("a read that comes back half empty is the list gone wrong: nobody goes missing", () => {
  const many = Array.from({ length: 10 }, (_, i) => model(`openai/m-${i}`));
  let plots = read([], many, now);
  plots = read(plots, many.slice(0, 4), now + DAY, now + DAY + GRACE_MS);
  expect(plots.every((p) => p.gone === null)).toBe(true);
  // An empty list is no models at all, not a feed that changed shape: still nobody dies of it.
  expect(tend(plots, [], now + 20 * DAY)).toEqual([]);
});

test("a changed price or name is kept, so the stone has the last one", () => {
  const plots = read([], ALL, now);
  const cheaper = ALL.map((m) => (m.id === "openai/gpt-5" ? { ...m, price: { ...PRICE, input: 1 } } : m));
  expect(tend(plots, cheaper, now + 1).map((p) => [p.id, p.price.input])).toEqual([["openai/gpt-5", 1]]);
});

test("the graveyard shows the newest stones, each keeping its plot as newer ones age out the oldest", () => {
  const n = GRAVES.length + 2;
  const many = Array.from({ length: 2 * n }, (_, i) => model(`openai/m-${String(i).padStart(2, "0")}`));
  let plots = read([], many, now);
  const plotOf = new Map<string, number>();
  for (let i = 0; i < n; i++) {
    const left = many.filter((_, j) => j > i);
    plots = read(plots, left, now + i * 10 * DAY, now + i * 10 * DAY + GRACE_MS);
    const stones = stonesOf(plots);
    expect(stones).toHaveLength(Math.min(i + 1, GRAVES.length));
    // Newest first, every one on its own plot, and a stone never moves.
    expect(stones[0]!.id).toBe(many[i]!.id);
    expect(new Set(stones.map((s) => s.plot)).size).toBe(stones.length);
    for (const s of stones) {
      expect(plotOf.get(s.id) ?? s.plot).toBe(s.plot);
      plotOf.set(s.id, s.plot);
    }
  }
  // The two oldest have aged out.
  expect(stonesOf(plots).map((s) => s.id)).not.toContain(many[0]!.id);
  expect(stonesOf(plots).map((s) => s.id)).not.toContain(many[1]!.id);
});

test("every plot and the tile in front of it is grass, clear of the Tavern, so the stones always fit", () => {
  for (const [x, y] of GRAVES) {
    expect(MAPS.town.at(x, y)).toBe(".");
    expect(MAPS.town.at(x, y + 1)).toBe(".");
  }
});

test("a stone is on its plot, read from the tile below it, and bumped into facing it", () => {
  const stones = forcedStones("2", now)!;
  const [x, y] = GRAVES[1]!;
  expect(stoneAt(stones, x, y)?.id).toBe(stones[1]!.id);
  expect(stoneInFront(stones, x, y + 1)?.id).toBe(stones[1]!.id);
  expect(stoneInFront(stones, x, y - 1)).toBeUndefined();
  expect(stoneFaced(stones, x, y + 1, "up")?.id).toBe(stones[1]!.id);
  expect(stoneFaced(stones, x, y + 1, "down")).toBeUndefined();
  // An empty plot is just grass.
  const [ex, ey] = GRAVES[4]!;
  expect(stoneAt(stones, ex, ey)).toBeUndefined();
});

test("a tombstone reads its name, its maker, its dates and its last price", () => {
  const [s] = stonesOf(
    read(read([], ALL, Date.UTC(2026, 9, 1)), LESS, Date.UTC(2026, 9, 20), Date.UTC(2026, 9, 24)),
  );
  const e = epitaphOf(s!);
  expect(e.name).toBe("gpt-4-turbo");
  expect(e.provider).toBe("Codex");
  expect(e.dates).toBe("Listed 9 Apr 2024 – 20 Oct 2026");
  expect(e.price).toBe("Last price: In $10 · Out $30 per 1M tokens");
  expect(e.epitaph).toBe(epitaphOf(s!).epitaph);
  expect(epitaphOf({ ...s!, price: { input: null, output: null, cache: null } }).price).toBe(
    "Last price: never listed",
  );
});

test("?graveyard= fills the plots for screenshots, some of them, or none", () => {
  expect(forcedStones(null, now)).toBeUndefined();
  expect(forcedStones("off", now)).toEqual([]);
  expect(forcedStones("on", now)).toHaveLength(GRAVES.length);
  expect(forcedStones("2", now)!.map((s) => s.plot)).toEqual([0, 1]);
  expect(forcedStones("99", now)).toHaveLength(GRAVES.length);
  expect(sameStones(forcedStones("on", now)!, forcedStones("on", now)!)).toBe(true);
});

test("the graveyard reads the same list as the stand: every pool model, however old", () => {
  const pool = poolModels({
    data: [
      { id: "openai/gpt-4-turbo", name: "OpenAI: GPT-4 Turbo", created: 1_712_620_800 },
      { id: "openai/gpt-4-turbo:free", name: "OpenAI: GPT-4 Turbo (free)", created: 1_712_620_800 },
      { id: "mistralai/mistral-7b", name: "Mistral: 7B", created: 1_712_620_800 },
    ],
  });
  expect(pool?.map((m) => [m.id, m.name, m.at])).toEqual([
    ["openai/gpt-4-turbo", "GPT-4 Turbo", 1_712_620_800_000],
  ]);
});
