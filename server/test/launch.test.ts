import { expect, test } from "bun:test";
import { type Launch, OPENROUTER_MODELS } from "@tokenmaxxing/core/launch.ts";
import { checkModels } from "../src/launch.ts";

const now = Date.UTC(2026, 9, 27, 6, 0);
const list = {
  data: [
    {
      id: "openai/gpt-6.1-terra",
      name: "OpenAI: GPT-6.1 Terra",
      created: (now - 3_600_000) / 1000,
      description: "Terra. Mid-tier.",
      pricing: { prompt: "0.000001", completion: "0.000005", input_cache_read: "0.00000005" },
    },
  ],
};
/** A fetch that answers OpenRouter's list with `reply`, or fails. */
const answer = (reply: unknown, ok = true) =>
  (async (url: string) => {
    if (url !== OPENROUTER_MODELS) throw new Error(`unexpected ${url}`);
    if (reply instanceof Error) throw reply;
    return { ok, json: async () => reply };
  }) as unknown as typeof fetch;
const prev: Launch[] = [
  {
    provider: "kimi",
    model: "K3",
    id: "",
    price: { input: null, output: null, cache: null },
    tagline: "Hi.",
    at: 1,
  },
];

test("reads OpenRouter's list into launches, and every pool model for the graveyard", async () => {
  const read = await checkModels([], now, answer(list), {});
  expect(read.pool?.map((m) => m.id)).toEqual(["openai/gpt-6.1-terra"]);
  expect(read.launches).toEqual([
    {
      provider: "codex",
      model: "GPT-6.1 Terra",
      id: "openai/gpt-6.1-terra",
      price: { input: 1, output: 5, cache: 0.05 },
      tagline: "Terra.",
      at: now - 3_600_000,
    },
  ]);
});

test("a failed read keeps what we had, and tells the graveyard nothing", async () => {
  for (const reply of [
    answer(new Error("offline")),
    answer(list, false),
    answer({ error: "rate limited" }),
  ]) {
    const read = await checkModels(prev, now, reply, {});
    expect(read.launches).toBe(prev);
    expect(read.pool).toBeNull();
  }
});

test("LAUNCH_FEED=off takes every stand down and leaves the graveyard be", async () => {
  expect(await checkModels(prev, now, answer(list), { LAUNCH_FEED: "off" })).toEqual({
    launches: [],
    pool: null,
  });
});
