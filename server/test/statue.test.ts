import { expect, test } from "bun:test";
import { LMARENA_ROWS, RANKING } from "@tokenmaxxing/core/statue.ts";
import { readLeader } from "../src/statue.ts";

const rows = {
  rows: [
    {
      row: {
        model_name: "Gemini 4 Argon (High)",
        organization: "google",
        rating: 1525.7,
        rank: 1,
        category: "overall",
        leaderboard_publish_date: "2026-10-22",
      },
    },
  ],
};
/** A fetch that answers LMArena's rows with `reply`, or fails; it counts its calls. */
function answer(reply: unknown, ok = true) {
  const f = Object.assign(
    async (url: string) => {
      f.calls++;
      if (url !== LMARENA_ROWS) throw new Error(`unexpected ${url}`);
      if (reply instanceof Error) throw reply;
      return { ok, json: async () => reply };
    },
    { calls: 0 },
  );
  return f as unknown as typeof fetch & { calls: number };
}

test("reads the #1 off LMArena's rows", async () => {
  expect(await readLeader(answer(rows), {})).toEqual({
    model: "Gemini 4 Argon (High)",
    org: "google",
    ranking: RANKING,
    score: 1525.7,
    asOf: "2026-10-22",
  });
});

test("a failed read gives nothing, so the statue that's up stays", async () => {
  expect(await readLeader(answer(new Error("offline")), {})).toBeNull();
  expect(await readLeader(answer(rows, false), {})).toBeNull();
  expect(await readLeader(answer({ error: "temporary internal issue" }), {})).toBeNull();
  expect(await readLeader(answer(new SyntaxError("not JSON")), {})).toBeNull();
});

test("STATUE_FEED=off reads nothing", async () => {
  const f = answer(rows);
  expect(await readLeader(f, { STATUE_FEED: "off" })).toBeNull();
  expect(f.calls).toBe(0);
});
