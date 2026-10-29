import { expect, test } from "bun:test";
import { isStand, isStandFront, PROVIDERS, providerOf } from "../src/launch.ts";
import { LEGEND, MAPS, PLAZA, TOWN_SPAWN } from "../src/maps.ts";
import { CART_SPOT, underCart } from "../src/merchant.ts";
import {
  afterRead,
  BRONZE,
  forcedStatue,
  type Leader,
  leaderFrom,
  makerOf,
  NO_STATUE,
  plaqueOf,
  providerFor,
  RANKING,
  STATUE_TILE,
  shownStatue,
  UNVEIL_MS,
  unveiling,
  unveilLine,
  withPin,
} from "../src/statue.ts";
import { isCart, SNAIL } from "../src/street.ts";

/** One of LMArena's rows, as the datasets server sends it. */
const row = (rank: number, model: string, organization: string, extra: Record<string, unknown> = {}) => ({
  row: {
    model_name: model,
    organization,
    license: "Proprietary",
    rating: 1600 - rank * 10,
    vote_count: 10_000,
    rank,
    category: "overall",
    leaderboard_publish_date: "2026-10-22",
    ...extra,
  },
});
const page = (...rows: unknown[]) => ({ features: [], rows, num_rows_total: 11_099, partial: false });

const leader = (model: string, org = "google"): Leader => ({
  model,
  org,
  ranking: RANKING,
  score: 1525,
  asOf: "2026-10-22",
});

test("the leader is the overall row ranked 1, with its maker, score and day", () => {
  const body = page(
    row(1, "Gemini 4 Argon (High)", "google"),
    row(2, "Claude Opus 5.5 (High)", "anthropic"),
    row(3, "GPT-6.1 Terra", "openai"),
  );
  expect(leaderFrom(body)).toEqual({
    model: "Gemini 4 Argon (High)",
    org: "google",
    ranking: RANKING,
    score: 1590,
    asOf: "2026-10-22",
  });
});

test("two sharing #1: the higher score leads, wherever it is on the page", () => {
  const body = page(
    row(1, "Claude Opus 5.5", "anthropic", { rating: 1510 }),
    row(1, "Gemini 4 Argon", "google", { rating: 1525 }),
  );
  expect(leaderFrom(body)?.model).toBe("Gemini 4 Argon");
});

test("a page that isn't the ranking keeps the statue that's up", () => {
  for (const body of [
    null,
    "oops",
    { error: "Authentication check on the Hugging Face Hub failed" },
    { rows: "nope" },
    page(),
    // Only other categories, or nothing ranked 1.
    page(row(1, "Coder", "openai", { category: "coding" })),
    page(row(2, "Second", "openai"), row(3, "Third", "google")),
    // A #1 without a name or a maker.
    page(row(1, "", "google"), row(1, "Nameless", "")),
    page({ row: null }, { nope: 1 }, row(1, "Ranked as text", "google", { rank: "1" })),
  ])
    expect(leaderFrom(body)).toBeNull();
});

test("names off the feed are one line, cut to fit the plaque", () => {
  const long = "A very long model name that goes on and on past the plaque edge";
  const l = leaderFrom(page(row(1, `  ${long}\n`, "google", { leaderboard_publish_date: "soon" })))!;
  expect(l.model.length).toBe(48);
  expect(l.model.endsWith("…")).toBe(true);
  expect(l.model).not.toContain("\n");
  expect(l.asOf).toBeNull();
  expect(leaderFrom(page(row(1, "X", "google", { rating: Number.NaN })))!.score).toBeNull();
});

test("LMArena's organisations are the pool's providers, in their colours", () => {
  expect(
    ["anthropic", "openai", "google", "xai", "zai", "moonshot", "meta", "minimax"].map(providerFor),
  ).toEqual(["claude", "codex", "google", "grok", "zai", "kimi", "meta", "minimax"]);
  // As OpenRouter or the admin page might write them.
  expect(["x-ai", "moonshotai", "Z AI", "Claude", "Codex"].map(providerFor)).toEqual([
    "grok",
    "kimi",
    "zai",
    "claude",
    "codex",
  ]);
  expect(providerFor("deepseek")).toBeNull();
  expect(makerOf(leader("Gemini 4", "google"))).toEqual({
    name: "Google",
    accent: providerOf("google").accent,
  });
  // Outside the pool: their own name, in bronze.
  expect(makerOf(leader("V5", "deepseek"))).toEqual({ name: "Deepseek", accent: BRONZE });
  expect(makerOf(leader("V5", "DeepSeek"))).toEqual({ name: "DeepSeek", accent: BRONZE });
  expect(PROVIDERS.every((p) => providerFor(p.name) === p.id)).toBe(true);
});

test("a new leader takes the plinth from the read; the same one keeps its unveiling; no answer keeps it", () => {
  const first = afterRead(NO_STATUE, leader("Gemini 4"), 1000, 5000);
  expect(first).toEqual({ read: { leader: leader("Gemini 4"), since: 1000 }, pin: null, nextAt: 5000 });
  const again = afterRead(first, { ...leader("Gemini 4"), score: 1530, asOf: "2026-10-29" }, 9000, 13_000);
  expect(again.read?.since).toBe(1000);
  expect(again.read?.leader.score).toBe(1530);
  expect(afterRead(again, null, 20_000, 21_000)).toEqual({ ...again, nextAt: 21_000 });
  const next = afterRead(again, leader("Claude Opus 5.5", "anthropic"), 30_000, 31_000);
  expect(next.read?.since).toBe(30_000);
});

test("the admin's pin shows over the ranking's, and the ranking's comes back when it's unpinned", () => {
  const read = afterRead(NO_STATUE, leader("Gemini 4"), 1000, 0);
  expect(shownStatue(undefined)).toEqual({ leader: null, since: 0, pinned: false });
  expect(shownStatue(read)).toEqual({ leader: leader("Gemini 4"), since: 1000, pinned: false });
  const pinned = withPin(read, leader("Grok 5", "Grok"), 2000);
  expect(shownStatue(pinned)).toEqual({ leader: leader("Grok 5", "Grok"), since: 2000, pinned: true });
  // Reads go on under the pin.
  const under = afterRead(pinned, leader("Claude Opus 5.5", "anthropic"), 3000, 0);
  expect(shownStatue(under).leader?.model).toBe("Grok 5");
  expect(withPin(under, leader("Grok 5", "Grok"), 4000).pin?.since).toBe(2000);
  expect(shownStatue(withPin(under, null, 5000))).toEqual({
    leader: leader("Claude Opus 5.5", "anthropic"),
    since: 3000,
    pinned: false,
  });
});

test("the plaque names the model, its maker and the ranking; with none, it's under a drape", () => {
  const p = plaqueOf({ leader: leader("Gemini 4 Argon (High)"), since: 1, pinned: false });
  expect(p.sign).toBe("🏆 #1 Gemini 4 Argon (High)");
  expect(p.accent).toBe(providerOf("google").accent);
  expect(p.text).toBe(
    "The statue of the #1 model: Gemini 4 Argon (High), by Google. It leads LMArena Text Arena (score 1525, as of 22 Oct 2026).",
  );
  const pinned = plaqueOf({
    leader: { ...leader("Grok 5", "grok"), ranking: "SWE-bench Verified", score: null, asOf: null },
    since: 1,
    pinned: true,
  });
  expect(pinned.text).toBe(
    "The statue of the #1 model: Grok 5, by Grok. It leads SWE-bench Verified. Put up by the town.",
  );
  const none = plaqueOf({ leader: null, since: 0, pinned: false });
  expect(none.sign).toContain("Unveiling soon");
  expect(none.accent).toBe(BRONZE);
});

test("the drape comes off over the first seconds after a new leader, and not for none", () => {
  const s = { leader: leader("Gemini 4"), since: 10_000, pinned: false };
  // A clock a little behind the server's waits under the drape; far behind, it's not this unveiling at all.
  expect(unveiling(s, 9_000)).toBe(0);
  expect(unveiling(s, 10_000 - UNVEIL_MS)).toBeNull();
  expect(unveiling(s, 10_000)).toBe(0);
  expect(unveiling(s, 10_000 + UNVEIL_MS / 2)).toBe(0.5);
  expect(unveiling(s, 10_000 + UNVEIL_MS)).toBeNull();
  expect(unveiling({ leader: null, since: 10_000, pinned: false }, 10_001)).toBeNull();
});

test("the town's line about a new statue names it", () => {
  const line = unveilLine(leader("Claude Opus 5.5", "anthropic"), () => 0.5);
  expect(line).toContain("Claude Opus 5.5");
  expect(line).not.toContain("{");
  for (const r of [0, 0.4, 0.99]) expect(unveilLine(leader("X"), () => r)).toContain("X");
});

test("?statue= puts one up for screenshots", () => {
  expect(forcedStatue(null, 5)).toBeUndefined();
  expect(forcedStatue(" ", 5)).toBeUndefined();
  expect(forcedStatue("none", 5)).toEqual({ leader: null, since: 0, pinned: false });
  const s = forcedStatue("grok:Grok 5", 5)!;
  expect(s.since).toBe(5);
  expect(s.leader).toMatchObject({ model: "Grok 5", org: "Grok", ranking: RANKING });
  expect(makerOf(s.leader!).accent).toBe(providerOf("grok").accent);
  expect(forcedStatue("kimi", 5)!.leader?.model).toBe("Kimi Model 1");
});

test("the plinth is one tile inside the square, clear of the street's things, with a way up to it", () => {
  const town = MAPS.town;
  const tiles = town.find(STATUE_TILE);
  expect(tiles).toHaveLength(1);
  const [x, y] = tiles[0]!;
  expect(LEGEND[STATUE_TILE]?.walk).toBeFalsy();
  expect(x > PLAZA.left && x < PLAZA.right && y > PLAZA.top && y < PLAZA.bottom).toBe(true);
  expect([x, y]).not.toEqual(TOWN_SPAWN);
  // Not the pølsevogn, the merchant's cart or where the merchant stands, nor the launch stand or its front.
  const merchant = x === CART_SPOT.x - 1 && y === CART_SPOT.y;
  expect(isCart(x, y) || underCart(x, y) || merchant || isStand(x, y) || isStandFront(x, y)).toBe(false);
  // The snail crawls along its row all day: never through the statue.
  expect(y === SNAIL.y && x >= SNAIL.from && x <= SNAIL.to).toBe(false);
  // Someone can stand in front of it and read the plaque.
  expect(town.walkable(x, y + 1)).toBe(true);
});
