import { expect, test } from "bun:test";
import { GRACE_MS, stonesOf, tend } from "@tokenmaxxing/core/graveyard.ts";
import { OPENROUTER_MODELS } from "@tokenmaxxing/core/launch.ts";
import { loadPlots, migrateGraveyard, savePlots } from "../src/graveyard.ts";
import { checkModels } from "../src/launch.ts";
import { memorySql } from "./memory-sql.ts";

const now = Date.UTC(2026, 9, 27, 6, 0);
const entry = (id: string, name: string) => ({
  id,
  name,
  created: 1_712_620_800,
  pricing: { prompt: "0.00001", completion: "0.00003" },
});
const FULL = {
  data: [entry("openai/gpt-4-turbo", "OpenAI: GPT-4 Turbo"), entry("openai/gpt-5", "OpenAI: GPT-5")],
};
const LESS = { data: [entry("openai/gpt-5", "OpenAI: GPT-5")] };
const answer = (reply: unknown) =>
  (async (url: string) => {
    if (url !== OPENROUTER_MODELS) throw new Error(`unexpected ${url}`);
    return { ok: true, json: async () => reply };
  }) as unknown as typeof fetch;

/** One of `world`'s reads, from its plots in SQL, as after a restart every time. */
async function read(sql: ReturnType<typeof memorySql>["sql"], list: unknown, at: number) {
  const { pool } = await checkModels([], at, answer(list), {});
  await savePlots(sql, tend(await loadPlots(sql), pool!, at));
}

test("the dead stay buried through restarts: plots are kept in SQL, the grace period too", async () => {
  const { sql } = memorySql();
  await migrateGraveyard(sql);
  await migrateGraveyard(sql);
  await read(sql, FULL, now);
  expect((await loadPlots(sql)).map((p) => p.id).sort()).toEqual(["openai/gpt-4-turbo", "openai/gpt-5"]);
  await read(sql, LESS, now + 60_000);
  await read(sql, LESS, now + GRACE_MS - 1);
  expect(stonesOf(await loadPlots(sql))).toEqual([]);
  await read(sql, LESS, now + 60_000 + GRACE_MS);
  expect(stonesOf(await loadPlots(sql))).toEqual([
    {
      id: "openai/gpt-4-turbo",
      model: "GPT-4 Turbo",
      provider: "codex",
      listed: 1_712_620_800_000,
      price: { input: 10, output: 30, cache: null },
      gone: now + 60_000,
      buried: now + 60_000 + GRACE_MS,
      plot: 0,
    },
  ]);
});
