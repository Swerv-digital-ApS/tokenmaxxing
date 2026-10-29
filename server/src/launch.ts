import {
  type Launch,
  launchesOf,
  OPENROUTER_MODELS,
  type PoolModel,
  poolModels,
} from "@tokenmaxxing/core/launch.ts";

/** One read for the whole world, not per player: OpenRouter's model list (~800 KB) every 10 minutes. */
export const LAUNCHES_EVERY_MS = 10 * 60_000;
const TIMEOUT_MS = 15_000;

/**
 * One read of OpenRouter's list at `now`, for the stand and the graveyard: the launches it says are
 * recent, and every pool model in it (`pool`). When it can't be read (offline, an error page, a list
 * that changed shape) the launches are `prev` and `pool` is null, so a bad read never takes a stand
 * down or buries anyone. `LAUNCH_FEED=off` is the kill switch for a feed gone wrong: no launches at
 * all, and the graveyard stays as it is.
 */
export async function checkModels(
  prev: Launch[],
  now: number,
  fetcher: typeof fetch = fetch,
  env: Record<string, string | undefined> = process.env,
): Promise<{ launches: Launch[]; pool: PoolModel[] | null }> {
  if (env.LAUNCH_FEED?.trim().toLowerCase() === "off") return { launches: [], pool: null };
  try {
    const res = await fetcher(OPENROUTER_MODELS, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    const pool = res.ok ? poolModels(await res.json()) : null;
    return pool ? { launches: launchesOf(pool, now), pool } : { launches: prev, pool: null };
  } catch {
    return { launches: prev, pool: null };
  }
}
