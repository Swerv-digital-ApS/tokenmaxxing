import { expect, test } from "bun:test";
import { STARS_API } from "@tokenmaxxing/core/stars.ts";
import { fetchStars } from "../src/github-stars.ts";

const reply = (body: unknown, ok = true) =>
  (async () => ({ ok, json: async () => body })) as unknown as typeof fetch;

test("reads stargazers_count from the repo, with the token when there is one", async () => {
  const asked: { url: string; headers: Record<string, string> }[] = [];
  const fetcher = (async (url: string, init: { headers: Record<string, string> }) => {
    asked.push({ url, headers: init.headers });
    return { ok: true, json: async () => ({ stargazers_count: 412 }) };
  }) as unknown as typeof fetch;
  expect(await fetchStars(fetcher, {})).toBe(412);
  expect(await fetchStars(fetcher, { GITHUB_TOKEN: "ghp_x" })).toBe(412);
  expect(asked.map((a) => a.url)).toEqual([STARS_API, STARS_API]);
  expect(asked[0]!.headers.authorization).toBeUndefined();
  expect(asked[1]!.headers.authorization).toBe("Bearer ghp_x");
});

test("a failed read is null, so the last count stays", async () => {
  expect(await fetchStars(reply({ message: "API rate limit exceeded" }, false), {})).toBeNull();
  expect(await fetchStars(reply({ message: "Not Found" }), {})).toBeNull();
  expect(
    await fetchStars((async () => Promise.reject(new Error("down"))) as unknown as typeof fetch, {}),
  ).toBeNull();
});

test("GITHUB_STARS pins the count, or turns the reads off", async () => {
  const never = (async () => {
    throw new Error("fetched");
  }) as unknown as typeof fetch;
  expect(await fetchStars(never, { GITHUB_STARS: "480" })).toBe(480);
  expect(await fetchStars(never, { GITHUB_STARS: "off" })).toBeNull();
  expect(await fetchStars(never, { GITHUB_STARS: "lots" })).toBeNull();
});
