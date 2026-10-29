import { STARS_API, starsFrom } from "@tokenmaxxing/core/stars.ts";

/** One read for the whole world: 4 an hour, well inside GitHub's 60 an hour for a server without a token. */
export const STARS_EVERY_MS = 15 * 60_000;
const TIMEOUT_MS = 5_000;

/**
 * The repo's GitHub stars (`GET /repos/{owner}/{repo}`), or null when they can't be had, so the last count
 * stays. `GITHUB_TOKEN`, if set, is sent along (a higher rate limit; it needs no scopes for a public repo).
 * `GITHUB_STARS=480` pins the count instead (dev and screenshots: pin it past a milestone and restart to see
 * the fireworks); `GITHUB_STARS=off` reads nothing (the tests).
 */
export async function fetchStars(
  fetcher: typeof fetch = fetch,
  env: Record<string, string | undefined> = process.env,
): Promise<number | null> {
  const pinned = env.GITHUB_STARS?.trim().toLowerCase();
  if (pinned === "off") return null;
  if (pinned) return starsFrom({ stargazers_count: Number(pinned) });
  const headers: Record<string, string> = {
    accept: "application/vnd.github+json",
    "x-github-api-version": "2022-11-28",
    "user-agent": "tokenmaxxing",
  };
  if (env.GITHUB_TOKEN) headers.authorization = `Bearer ${env.GITHUB_TOKEN}`;
  try {
    const res = await fetcher(STARS_API, { headers, signal: AbortSignal.timeout(TIMEOUT_MS) });
    return res.ok ? starsFrom(await res.json()) : null;
  } catch {
    return null;
  }
}
