import type { ProbeResult } from "./watchdog.ts";

/** Coalesce readiness probes so a stuck engine never gets a backlog of health requests. */
export function healthCheck(
  probe: () => Promise<unknown>,
  version: string,
  timeoutMs = 5_000,
  /** Told how each probe went (once it answered, or timed out), so a failure can be logged with its cause. */
  onProbe?: (result: ProbeResult) => void,
) {
  let pending: Promise<boolean> | undefined;
  return async (): Promise<Response> => {
    pending ??= new Promise<boolean>((resolve) => {
      const started = performance.now();
      let timedOut = false;
      const timer = setTimeout(() => {
        timedOut = true;
        onProbe?.({ ok: false, ms: Math.round(performance.now() - started), reason: "timeout" });
        resolve(false);
      }, timeoutMs);
      void Promise.resolve()
        .then(probe)
        .then(
          () => {
            clearTimeout(timer);
            // A probe that answered after its timeout isn't reported again as a pass.
            if (!timedOut) onProbe?.({ ok: true, ms: Math.round(performance.now() - started), reason: "ok" });
            resolve(true);
            pending = undefined;
          },
          (err) => {
            clearTimeout(timer);
            if (!timedOut)
              onProbe?.({
                ok: false,
                ms: Math.round(performance.now() - started),
                reason: "error",
                error: err instanceof Error ? err.message : String(err),
              });
            resolve(false);
            pending = undefined;
          },
        );
    });
    const ok = await pending;
    return Response.json({ ok, version }, { status: ok ? 200 : 503 });
  };
}
