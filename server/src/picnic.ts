import { forcedOutage, isDown, nextOutage, type Outage, STATUS_PAGES } from "@tokenmaxxing/core/picnic.ts";
import { typedEntries, typedFromEntries } from "hanzio";

/** One round for the whole world, not per player: two small requests every 5 minutes. */
export const OUTAGE_EVERY_MS = 5 * 60_000;
const TIMEOUT_MS = 5_000;

/** Whether one status page says it's down; null if it can't be read (keep what we had). */
async function readPage(url: string, fetcher: typeof fetch): Promise<boolean | null> {
  try {
    const res = await fetcher(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    return res.ok ? isDown(await res.json()) : null;
  } catch {
    return null;
  }
}

/** Reads every status page and works out the outage after `prev`. */
export async function checkOutage(
  prev: Outage | null,
  now: number,
  fetcher: typeof fetch = fetch,
): Promise<Outage | null> {
  const readings = await Promise.all(
    typedEntries(STATUS_PAGES).map(async ([p, url]) => [p, await readPage(url, fetcher)] as const),
  );
  return nextOutage(prev, typedFromEntries(readings), now);
}

/**
 * `PICNIC_OUTAGE=claude|openai|both` forces a picnic (dev, screenshots), `off` turns it off (a feed
 * gone wrong). Undefined when unset: the status pages decide.
 */
export const forced = (now: number, env: Record<string, string | undefined> = process.env) =>
  forcedOutage(env.PICNIC_OUTAGE, now);
