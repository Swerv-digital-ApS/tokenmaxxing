import { type Leader, LMARENA_ROWS, leaderFrom } from "@tokenmaxxing/core/statue.ts";

/** One read for the whole world, four times a day: the ranking changes every few days at most. */
export const STATUE_EVERY_MS = 6 * 3_600_000;
/** After a read that failed, the next try. */
export const STATUE_RETRY_MS = 30 * 60_000;
const TIMEOUT_MS = 15_000;

/**
 * The #1 model on LMArena's Text Arena, or null when it can't be read (offline, an error page, rows that
 * changed shape): the statue that's up stays. `STATUE_FEED=off` stops reading it, and the last leader stays too.
 */
export async function readLeader(
  fetcher: typeof fetch = fetch,
  env: Record<string, string | undefined> = process.env,
): Promise<Leader | null> {
  if (env.STATUE_FEED?.trim().toLowerCase() === "off") return null;
  try {
    const res = await fetcher(LMARENA_ROWS, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    return res.ok ? leaderFrom(await res.json()) : null;
  } catch {
    return null;
  }
}
