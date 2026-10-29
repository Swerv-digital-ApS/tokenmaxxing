import type { RequestEntry } from "@tokenmaxxing/core/requests.ts";

/** Waits before each retry; a receiver still down after the last one misses this request. */
const RETRY_MS = [5_000, 30_000, 120_000];
const TIMEOUT_MS = 10_000;

export type PushedRequest = Pick<RequestEntry, "id" | "userId" | "name" | "text" | "createdAt">;

/**
 * POSTs a new request on the Tavern's pile as JSON to `NEW_REQUEST_PUSH_URL`, so an agent can start on it
 * right away. Production only, and unset sends nothing. The URL carries the receiver's token, so it is
 * never logged. Retried in the background: posting a request never waits on it.
 */
export async function pushNewRequest(
  request: PushedRequest,
  env: Record<string, string | undefined> = process.env,
  wait = (ms: number) => Bun.sleep(ms),
): Promise<boolean> {
  const url = env.NEW_REQUEST_PUSH_URL;
  if (!url || env.NODE_ENV !== "production") return false;
  for (let attempt = 0; ; attempt++) {
    const sent = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(request),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    }).then(
      (res) => res.ok || `HTTP ${res.status}`,
      (err: unknown) => String(err),
    );
    if (sent === true) return true;
    const delay = RETRY_MS[attempt];
    if (delay === undefined) {
      console.warn(`[request push] #${request.id} gave up: ${sent}`);
      return false;
    }
    await wait(delay);
  }
}
