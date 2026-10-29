import { expect, test } from "bun:test";
import {
  activeLaunches,
  facesStand,
  findProvider,
  forcedLaunches,
  isStand,
  isStandFront,
  type Launch,
  launchesFrom,
  nameOf,
  PROVIDERS,
  pamphletOf,
  priceLine,
  STAND,
  sameLaunches,
  standCloses,
  standOf,
} from "../src/launch.ts";
import { clockMinutes } from "../src/street.ts";

/** Copenhagen wall time on 21 October 2026 (summer time, UTC+2) as epoch ms. */
const cph = (h: number, m = 0) => Date.UTC(2026, 9, 21, h - 2, m);

const NO_PRICE = { input: null, output: null, cache: null };
const launch = (at: number, model = "One"): Launch => ({
  provider: "grok",
  model,
  id: "",
  price: NO_PRICE,
  tagline: "Hi.",
  at,
});
/** A model that came out alongside, priced. */
const also = (model: string, id = "", price = NO_PRICE) => ({ model, id, price });

const DAY = 24 * 3_600_000;

test("an edition's stand packs up at 18:00: today's for news before 16:00, tomorrow's after", () => {
  // Before the soft cut: today's edition, hard cutoff 18:00 today.
  for (const [h, m] of [
    [0, 0],
    [9, 0],
    [15, 59],
  ] as const)
    expect(standCloses(cph(h, m))).toBe(cph(18));
  // From 16:00 on: tomorrow's edition, so it stays until 18:00 tomorrow, even at 17:00 with today's still up.
  for (const [h, m] of [
    [16, 0],
    [17, 0],
    [17, 59],
    [18, 0],
    [19, 13],
    [23, 59],
  ] as const)
    expect(standCloses(cph(h, m))).toBe(cph(18) + DAY);
});

test("the clocks changing doesn't move 18:00", () => {
  // 25 October 2026: summer time ends, the day has 25 hours. 18:00 is then UTC+1.
  for (const at of [
    Date.UTC(2026, 9, 24, 10, 0),
    Date.UTC(2026, 9, 24, 20, 0),
    Date.UTC(2026, 9, 25, 3, 0),
    Date.UTC(2026, 9, 25, 10, 0),
    Date.UTC(2026, 9, 25, 16, 30),
  ]) {
    const end = standCloses(at);
    expect(clockMinutes(end)).toBe(18 * 60);
    expect(end).toBeGreaterThan(at);
    expect(end - at).toBeLessThanOrEqual(2 * DAY);
  }
  // 29 March 2026: spring forward, a 23 hour day.
  for (const at of [Date.UTC(2026, 2, 28, 22, 0), Date.UTC(2026, 2, 29, 8, 0), Date.UTC(2026, 2, 29, 15, 0)])
    expect(clockMinutes(standCloses(at))).toBe(18 * 60);
});

test("a launch before 16:00 is up from its time until 18:00 sharp, and not before", () => {
  const l = launch(cph(9, 30));
  expect(activeLaunches(cph(9, 29), [l])).toEqual([]);
  expect(activeLaunches(cph(9, 30), [l])).toEqual([l]);
  expect(activeLaunches(cph(15, 59), [l])).toEqual([l]);
  // It sticks past the soft cut, to the hard one.
  expect(activeLaunches(cph(16, 30), [l])).toEqual([l]);
  expect(activeLaunches(cph(17, 59), [l])).toEqual([l]);
  expect(activeLaunches(cph(18), [l])).toEqual([]);
});

test("a launch after 16:00 is tomorrow's news: it stays until 18:00 the next day", () => {
  for (const h of [16, 17, 19, 23]) {
    const l = launch(cph(h, 5));
    expect(activeLaunches(cph(h, 5), [l])).toEqual([l]);
    expect(activeLaunches(cph(10) + DAY, [l])).toEqual([l]);
    expect(activeLaunches(cph(17, 59) + DAY, [l])).toEqual([l]);
    expect(activeLaunches(cph(18) + DAY, [l])).toEqual([]);
  }
});

test("a release at 17:00 doesn't hold the morning's up: today's edition still ends at 18:00", () => {
  const morning = launch(cph(9), "Morning");
  const evening = launch(cph(17), "Evening");
  // 17:30: today's news has half an hour left and tomorrow's has begun, so both are on the stand.
  expect(activeLaunches(cph(17, 30), [morning, evening])).toEqual([evening, morning]);
  // 18:00: the hard cutoff takes the morning's down; the evening's carries on into tomorrow.
  expect(activeLaunches(cph(18), [morning, evening])).toEqual([evening]);
  expect(activeLaunches(cph(12) + DAY, [morning, evening])).toEqual([evening]);
  expect(activeLaunches(cph(18) + DAY, [morning, evening])).toEqual([]);
});

test("everything that's up is on the stand, newest first; yesterday's editions are gone", () => {
  const yesterday = launch(cph(10) - DAY, "Old");
  const lastNight = launch(cph(20) - DAY, "Last night");
  const a = launch(cph(8), "A");
  const b = launch(cph(12), "B");
  // Last night's news is today's edition, up until 18:00 today.
  expect(activeLaunches(cph(10), [a, b, yesterday, lastNight])).toEqual([a, lastNight]);
  expect(activeLaunches(cph(13), [a, b, yesterday, lastNight])).toEqual([b, a, lastNight]);
  expect(activeLaunches(cph(18, 1), [a, b, yesterday, lastNight])).toEqual([]);
});

test("the stand takes its tiles, and E faces it from the square", () => {
  const tiles: [number, number][] = [];
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) if (isStand(x, y)) tiles.push([x, y]);
  expect(tiles).toHaveLength(STAND.w * STAND.h);
  expect(facesStand(STAND.x + STAND.w, STAND.y, "left")).toBe(true);
  expect(facesStand(STAND.x + STAND.w, STAND.y, "right")).toBe(false);
  expect(facesStand(STAND.x, STAND.y + STAND.h, "up")).toBe(true);
});

test("every provider in the pool can be found, however it's written", () => {
  expect(PROVIDERS.map((p) => p.name)).toEqual([
    "Claude",
    "Codex",
    "Google",
    "Grok",
    "Z AI",
    "Kimi",
    "Meta",
    "Minimax",
  ]);
  for (const p of PROVIDERS) {
    expect(findProvider(p.id)?.id).toBe(p.id);
    expect(findProvider(p.name.toUpperCase())?.id).toBe(p.id);
    expect(p.accent).toMatch(/^#[0-9a-f]{6}$/);
  }
  expect(findProvider("z-ai")?.id).toBe("zai");
  expect(findProvider("acme")).toBeUndefined();
  expect(new Set(PROVIDERS.map((p) => p.accent)).size).toBe(PROVIDERS.length);
});

test("walking onto the row in front of the stand is where you're handed the pamphlet", () => {
  const front: [number, number][] = [];
  for (let y = 0; y < 8; y++) for (let x = -3; x < 8; x++) if (isStandFront(x, y)) front.push([x, y]);
  expect(front).toHaveLength(STAND.w + 2);
  expect(front.every(([, y]) => y === STAND.y + STAND.h)).toBe(true);
  // Not on the stand itself, and not the row behind it.
  expect(isStandFront(STAND.x, STAND.y)).toBe(false);
  expect(isStandFront(STAND.x, STAND.y - 1)).toBe(false);
});

test("one launch: its provider's stand, and a pamphlet about it", () => {
  const l = { ...launch(5), provider: "zai" as const, model: "GLM 5" };
  expect(standOf([l])).toMatchObject({ accent: "#6366f1", sign: "🚀 NEW: Z AI GLM 5" });
  const p = pamphletOf([l]);
  expect(p).toMatchObject({ rainbow: false, kicker: "🚀 Just shipped", title: "📣 Pamphlet" });
  expect(p.entries).toEqual([
    {
      provider: "zai",
      accent: "#6366f1",
      headline: "Z AI GLM 5",
      body: "Hi.",
      models: [{ name: "GLM 5", price: null, url: null }],
    },
  ]);
});

test("one provider, several models: its stand, and every model on the pamphlet", () => {
  const sol = {
    ...launch(cph(9)),
    provider: "codex" as const,
    model: "GPT-6 Sol",
    also: [also("GPT-6 Sol Pro"), also("GPT-6 Luna")],
  };
  const nova = { ...launch(cph(11)), provider: "codex" as const, model: "GPT-6 Nova" };
  const up = activeLaunches(cph(12), [sol, nova]);
  expect(standOf(up)).toMatchObject({ accent: "#10a37f", sign: "🚀 NEW: Codex GPT-6 Nova +3" });
  const p = pamphletOf(up);
  expect(p.rainbow).toBe(false);
  expect(p.kicker).toBe("🚀 4 new from Codex");
  expect(p.entries.map((e) => e.headline)).toEqual(["Codex GPT-6 Nova", "Codex GPT-6 Sol"]);
  expect(p.entries[1]!.models.map((m) => m.name)).toEqual(["GPT-6 Sol", "GPT-6 Sol Pro", "GPT-6 Luna"]);
});

test("several providers: a rainbow stand, and the newsletter has all of them", () => {
  const opus = { ...launch(cph(9)), provider: "claude" as const, model: "Claude Opus 5.5" };
  const sol = {
    ...launch(cph(11)),
    provider: "codex" as const,
    model: "GPT-6 Sol",
    also: [also("GPT-6 Luna")],
  };
  const up = activeLaunches(cph(12), [opus, sol]);
  const stand = standOf(up);
  expect(stand.accent).toBeNull();
  expect(stand.sign).toBe("🌈 NEW: Codex · Claude");
  const p = pamphletOf(up);
  expect(p).toMatchObject({ rainbow: true, title: "📰 The launch-day newsletter" });
  expect(p.kicker).toBe("🌈 3 new models from 2 providers");
  expect(p.entries.map((e) => [e.headline, e.accent])).toEqual([
    ["Codex GPT-6 Sol", "#10a37f"],
    ["Claude Opus 5.5", "#d97757"],
  ]);
});

test("a new launch is a new pamphlet; the same ones in another order aren't", () => {
  const a = launch(cph(9), "A");
  const b = { ...launch(cph(11), "B"), provider: "kimi" as const };
  expect(standOf([a]).key).not.toBe(standOf([b, a]).key);
  expect(standOf([b, a]).key).toBe(standOf([a, b]).key);
});

test("?launch= forces one stand or several, or hides it", () => {
  expect(forcedLaunches(null, 5)).toBeUndefined();
  expect(forcedLaunches("", 5)).toBeUndefined();
  expect(forcedLaunches("off", 5)).toEqual([]);
  expect(forcedLaunches("on", 5)).toMatchObject([{ at: 5, provider: "claude" }]);
  expect(forcedLaunches("kimi", 5)).toMatchObject([{ provider: "kimi", model: "Model 1" }]);
  expect(forcedLaunches("Z AI: GLM 5,grok:Grok 5", 120_000)).toMatchObject([
    { provider: "zai", model: "GLM 5", at: 120_000 },
    { provider: "grok", model: "Grok 5", at: 60_000 },
  ]);
});

/** An OpenRouter model, as its list has it (`created` in seconds). */
const or = (
  id: string,
  name: string,
  at: number,
  description = "A model. It's good.",
  pricing: Record<string, string> = { prompt: "0.000001", completion: "0.000005" },
) => ({ id, name, created: at / 1000, description, pricing });

test("OpenRouter's list becomes launches: the pool's providers, listed in the last day", () => {
  const now = cph(12);
  const list = {
    data: [
      or(
        "openai/gpt-6.1-terra",
        "OpenAI: GPT-6.1 Terra",
        cph(9),
        "GPT-6.1 Terra is the mid-tier model. It is suited for everyday work.",
        { prompt: "0.000001", completion: "0.000005", input_cache_read: "0.00000005", web_search: "0.01" },
      ),
      or("openai/gpt-6.1-terra:batch", "OpenAI: GPT-6.1 Terra (batch)", cph(9)),
      or("~openai/gpt-terra-latest", "OpenAI: GPT Terra Latest", cph(9)),
      or("deepseek/deepseek-v5", "DeepSeek: V5", cph(10)),
      or("moonshotai/kimi-k3.1-pro", "MoonshotAI: Kimi K3.1 Pro", cph(8)),
      or("anthropic/claude-haiku-5.5", "Anthropic: Claude Haiku 5.5", cph(12) - 3 * 86_400_000),
      or("x-ai/grok-5", "SpaceXAI: Grok 5", cph(13)),
      { id: "google/broken", created: "yesterday", name: "Google: Broken" },
    ],
  };
  const got = launchesFrom(list, now)!;
  expect(got.map((l) => [l.provider, l.model])).toEqual([
    ["kimi", "Kimi K3.1 Pro"],
    ["codex", "GPT-6.1 Terra"],
  ]);
  expect(got[1]).toMatchObject({ at: cph(9), tagline: "GPT-6.1 Terra is the mid-tier model." });
  expect(got[1]).toMatchObject({ id: "openai/gpt-6.1-terra", price: { input: 1, output: 5, cache: 0.05 } });
  expect(got[1]!.also).toBeUndefined();
});

test("a family put out together is one launch, the shortest name leading", () => {
  const list = {
    data: [
      or("openai/gpt-6-sol-pro", "OpenAI: GPT-6 Sol Pro", cph(9, 1)),
      or("openai/gpt-6-sol", "OpenAI: GPT-6 Sol", cph(9, 0)),
      or("openai/gpt-6-luna", "OpenAI: GPT-6 Luna", cph(9, 1)),
      // Two hours on is a launch of its own.
      or("openai/gpt-6-nova", "OpenAI: GPT-6 Nova", cph(11, 30)),
    ],
  };
  const got = launchesFrom(list, cph(12))!;
  expect(got).toHaveLength(2);
  expect(got[0]).toMatchObject({
    model: "GPT-6 Sol",
    at: cph(9),
    also: [
      { model: "GPT-6 Sol Pro", id: "openai/gpt-6-sol-pro" },
      { model: "GPT-6 Luna", id: "openai/gpt-6-luna" },
    ],
  });
  expect(got[1]).toMatchObject({ model: "GPT-6 Nova", at: cph(11, 30) });
  expect(pamphletOf([got[0]!]).entries[0]!.models).toEqual([
    {
      name: "GPT-6 Sol",
      price: "In $1 · Out $5 per 1M tokens",
      url: "https://openrouter.ai/openai/gpt-6-sol",
    },
    {
      name: "GPT-6 Sol Pro",
      price: "In $1 · Out $5 per 1M tokens",
      url: "https://openrouter.ai/openai/gpt-6-sol-pro",
    },
    {
      name: "GPT-6 Luna",
      price: "In $1 · Out $5 per 1M tokens",
      url: "https://openrouter.ai/openai/gpt-6-luna",
    },
  ]);
});

test("a long description is cut down for the pamphlet, and a missing one says something", () => {
  const long = `${"Very ".repeat(60)}long.`;
  const [a, b] = launchesFrom(
    {
      data: [or("google/g1", "Google: G1", cph(9), long), or("meta-llama/l5", "Meta: Llama 5", cph(10), "")],
    },
    cph(12),
  )!;
  expect(a!.tagline.length).toBeLessThanOrEqual(160);
  expect(a!.tagline.endsWith("…")).toBe(true);
  expect(b!.tagline).toBe("Just landed.");
});

test("a list that isn't one keeps what we had; an empty one is no launches", () => {
  expect(launchesFrom(null, 0)).toBeNull();
  expect(launchesFrom({ error: "rate limited" }, 0)).toBeNull();
  expect(launchesFrom({ data: [] }, 0)).toEqual([]);
  const l = launch(1);
  expect(sameLaunches([l], [{ ...l }])).toBe(true);
  expect(sameLaunches([l], [])).toBe(false);
});

test("the name says who made it once", () => {
  expect(nameOf({ ...launch(0), provider: "claude", model: "Claude Haiku 5.5" })).toBe("Claude Haiku 5.5");
  expect(nameOf({ ...launch(0), provider: "minimax", model: "MiniMax M3.1 Flash" })).toBe(
    "MiniMax M3.1 Flash",
  );
  expect(nameOf({ ...launch(0), provider: "codex", model: "GPT-6.1 Terra" })).toBe("Codex GPT-6.1 Terra");
});

test("prices read as dollars per million tokens, as short as they go", () => {
  expect(priceLine({ input: 1, output: 5, cache: 0.05 })).toBe("In $1 · Out $5 · Cache $0.05 per 1M tokens");
  expect(priceLine({ input: 2.5, output: 12, cache: null })).toBe("In $2.5 · Out $12 per 1M tokens");
  expect(priceLine({ input: 0.075, output: 0.3, cache: 0.0188 })).toBe(
    "In $0.075 · Out $0.3 · Cache $0.0188 per 1M tokens",
  );
  expect(priceLine(NO_PRICE)).toBeNull();
  // A free model is $0, not missing; junk is missing.
  const [free] = launchesFrom(
    {
      data: [
        or("google/g1", "Google: G1", cph(9), "", { prompt: "0", completion: "0", input_cache_read: "abc" }),
      ],
    },
    cph(12),
  )!;
  expect(free!.price).toEqual({ input: 0, output: 0, cache: null });
});
